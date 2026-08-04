/**
 * Import dei due elenchi Excel storici di Elettra (anagrafiche + offerte).
 *
 *   npx tsx scripts/import-excel.ts <anagrafiche.xls> <offerte.xls> [--pulisci] [--prova]
 *
 * --pulisci  svuota anagrafiche/commesse (e dipendenti) prima di importare.
 *            Consigliato al primo import, per non mescolare i dati demo del seed.
 * --prova    analizza e riporta senza scrivere nulla nel database.
 *
 * Scelte non ovvie, dedotte dai dati reali:
 *
 * - Le righe F####/C####/D#### con lo **stesso numero** sono la stessa azienda
 *   (verificato: 1042 numeri su 1062 hanno ragione sociale coerente; i 20 diversi
 *   sono destinazioni che portano il nome del sito). Vengono quindi **unite in una
 *   sola Anagrafica** con codiceCliente + codiceFornitore: è la "doppia natura"
 *   per cui lo schema è nato, e 865 aziende sono davvero sia cliente sia fornitore.
 *   Senza il merge si creerebbero 3243 record al posto di ~1064, con la stessa
 *   P.IVA ripetuta fino a 5 volte.
 *
 * - Le righe D#### diventano `Destinazione` (sedi di consegna/cantiere), non
 *   anagrafiche: solo 108 su 1118 hanno P.IVA.
 *
 * - "INT." della colonna Tipol. Lavoro non viene importata come tipologia: le
 *   commesse interne sono quelle del cliente ELETTRA S.r.l. (C0000).
 *
 * - I PM che non esistono come utenti vengono creati **disattivati e senza
 *   password utilizzabile**, così lo storico resta assegnato senza aprire accessi.
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();

/* =============================== conversione ============================== */

/** Converte un .xls in CSV (un file per foglio) e ne restituisce le righe. */
function leggiFogli(xlsPath: string): Map<string, string[][]> {
  if (!existsSync(xlsPath)) throw new Error(`File non trovato: ${xlsPath}`);

  const out = mkdtempSync(join(tmpdir(), "elettra-xls-"));
  try {
    execFileSync(
      "libreoffice",
      [
        "--headless",
        "--convert-to",
        // L'ultimo -1 esporta tutti i fogli, non solo il primo.
        "csv:Text - txt - csv (StarCalc):44,34,76,1,,0,false,true,false,false,false,-1",
        "--outdir",
        out,
        xlsPath,
      ],
      { stdio: "pipe" },
    );
  } catch {
    throw new Error(
      "Conversione fallita: serve LibreOffice nel PATH.\n" +
        "  Debian/Ubuntu: sudo apt install libreoffice-calc\n" +
        "  In alternativa converti a mano i fogli in CSV e passa quelli.",
    );
  }

  const fogli = new Map<string, string[][]>();
  const base = basename(xlsPath).replace(/\.xls$/i, "");
  for (const f of readdirSync(out).filter((n) => n.endsWith(".csv"))) {
    // libreoffice nomina i file "<base>-<Nome foglio>.csv" (o "<base>.csv").
    const nome = f.slice(0, -4) === base ? "principale" : f.slice(base.length + 1, -4);
    fogli.set(nome, parseCsv(readFileSync(join(out, f), "utf8")));
  }
  if (fogli.size === 0) throw new Error(`Nessun foglio estratto da ${xlsPath}`);
  return fogli;
}

/** Parser CSV: virgola separatore, doppi apici per il quoting ("" = apice). */
function parseCsv(testo: string): string[][] {
  const righe: string[][] = [];
  let riga: string[] = [];
  let campo = "";
  let inApici = false;

  for (let i = 0; i < testo.length; i++) {
    const c = testo[i];
    if (inApici) {
      if (c === '"') {
        if (testo[i + 1] === '"') {
          campo += '"';
          i++;
        } else inApici = false;
      } else campo += c;
      continue;
    }
    if (c === '"') inApici = true;
    else if (c === ",") {
      riga.push(campo);
      campo = "";
    } else if (c === "\n") {
      riga.push(campo);
      righe.push(riga);
      riga = [];
      campo = "";
    } else if (c !== "\r") campo += c;
  }
  if (campo !== "" || riga.length) {
    riga.push(campo);
    righe.push(riga);
  }
  return righe;
}

/**
 * Trasforma le righe in oggetti usando come intestazione la prima riga che
 * contiene tutte le colonne attese (i fogli hanno titoli e totali in cima).
 */
function aRecord(
  righe: string[][],
  colonneAttese: string[],
): Record<string, string>[] {
  const idx = righe.findIndex((r) => {
    const set = new Set(r.map((c) => c.trim()));
    return colonneAttese.every((c) => set.has(c));
  });
  if (idx === -1) {
    throw new Error(
      `Intestazione non trovata. Attese le colonne: ${colonneAttese.join(", ")}`,
    );
  }
  const header = righe[idx].map((c) => c.trim());
  return righe.slice(idx + 1).map((r) => {
    const o: Record<string, string> = {};
    header.forEach((h, i) => {
      if (h) o[h] = (r[i] ?? "").trim();
    });
    return o;
  });
}

/* =============================== normalizzatori =========================== */

const vuoto = (v: string | undefined): string | null => {
  const s = (v ?? "").trim();
  return s.length ? s : null;
};

/** Toglie il prefisso IT alle sole partite IVA italiane; le estere restano. */
function normalizzaPiva(v: string | undefined): string | null {
  const s = (v ?? "").trim().replace(/\s+/g, "");
  if (!s) return null;
  const m = /^IT(\d{11})$/i.exec(s);
  return m ? m[1] : s;
}

/**
 * "Fax/Cod. Univoco" mescola numeri di fax e codici SDI (32 casi su 1021),
 * a volte con etichetta ("SDI: W7YVJK9"). Un codice destinatario è di 6-7
 * caratteri alfanumerici e contiene almeno una lettera.
 */
function dividiFaxSdi(v: string | undefined): {
  fax: string | null;
  sdi: string | null;
} {
  const s = (v ?? "").trim();
  if (!s) return { fax: null, sdi: null };

  const conEtichetta = /(?:codice\s*)?sdi\s*:?\s*([A-Z0-9]{6,7})\b/i.exec(s);
  if (conEtichetta) return { fax: null, sdi: conEtichetta[1].toUpperCase() };

  const nudo = /^[A-Z0-9]{6,7}$/i.test(s) && /[A-Z]/i.test(s);
  if (nudo) return { fax: null, sdi: s.toUpperCase() };

  return { fax: s, sdi: null };
}

/**
 * "E-Mail: - WEB" può contenere più indirizzi separati da " - " e qualche sito.
 * Ritorna la prima email come principale, il resto va nelle note per non perderlo.
 */
function dividiEmailWeb(v: string | undefined): {
  email: string | null;
  web: string | null;
  extra: string | null;
} {
  const s = (v ?? "").trim();
  if (!s) return { email: null, web: null, extra: null };

  const pezzi = s
    .split(/\s+-\s+|;|(?<=\S),(?=\S)/)
    .map((p) => p.trim())
    .filter(Boolean);

  const email = pezzi.filter((p) => p.includes("@"));
  const web = pezzi.filter((p) => !p.includes("@") && /^(https?:\/\/|www\.)/i.test(p));
  const resto = pezzi.filter((p) => !email.includes(p) && !web.includes(p));

  return {
    email: email[0] ?? null,
    web: web[0] ?? null,
    // Email successive alla prima + valori non riconosciuti (es. "infomenafra.it").
    extra: [...email.slice(1), ...web.slice(1), ...resto].join(" · ") || null,
  };
}

const TITOLI_TESTO: Record<string, string> = {
  "sig.ra": "SIGRA",
  "sig.": "SIG",
  sig: "SIG",
  "dott.ssa": "DOTTSSA",
  "dott.": "DOTT",
  dott: "DOTT",
  "ing.": "ING",
  ing: "ING",
  "geom.": "GEOM",
  "arch.": "ARCH",
  "rag.": "RAG",
  "avv.": "AVV",
  "prof.": "PROF",
  "p.i.": "PERITO",
};

/**
 * Spezza un riferimento libero in titolo/nome/cognome.
 *
 * L'ordine nei fogli è incoerente ("Cristian Pozzi" ma anche "Sabatasso
 * Stefano"): si assume **Nome Cognome**, che è la maggioranza dei casi, e il
 * testo originale viene comunque conservato nelle note del referente perché la
 * correzione resti possibile.
 */
function parseReferente(v: string): {
  titolo: string;
  nome: string;
  cognome: string;
} | null {
  let s = v.trim().replace(/\s+/g, " ");
  if (!s) return null;

  let titolo = "NESSUNO";
  for (const [testo, chiave] of Object.entries(TITOLI_TESTO)) {
    if (s.toLowerCase().startsWith(testo)) {
      titolo = chiave;
      s = s.slice(testo.length).trim();
      break;
    }
  }
  if (!s) return null;

  const parti = s.split(" ");
  if (parti.length === 1) return { titolo, nome: "", cognome: parti[0] };
  return {
    titolo,
    nome: parti.slice(0, -1).join(" "),
    cognome: parti[parti.length - 1],
  };
}

/** Date italiane "GG/MM/AAAA" (anche con anno a 2 cifre). */
function parseDataIt(v: string | undefined): Date | null {
  const s = (v ?? "").trim();
  if (!s) return null;
  const m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/.exec(s);
  if (!m) return null;
  const [, g, mm, aRaw] = m;
  const anno = aRaw.length === 2 ? 2000 + Number(aRaw) : Number(aRaw);
  const d = new Date(Date.UTC(anno, Number(mm) - 1, Number(g)));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Importi con virgola decimale e separatore di migliaia opzionale. */
function parseImportoIt(v: string | undefined): string | null {
  let s = (v ?? "").trim().replace(/[€\s]/g, "");
  if (!s || s === "-") return null;
  // "1.234.567,89" → "1234567.89";  "604423,89" → "604423.89"
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? String(n) : null;
}

/* ============================== anagrafiche =============================== */

// Nomi già normalizzati con trim(), come le chiavi prodotte da aRecord():
// nel foglio l'intestazione è "P. IVA " con uno spazio finale.
const COL_ANAG = ["Codice", "Ragione sociale", "Indirizzo", "P. IVA"];

type RigaAnag = Record<string, string>;

/**
 * "D0042-1" → { prefisso:"D", numero:"0042", suffisso:"1" }
 * Il suffisso distingue più sedi della stessa azienda; oltre a "-1" compare
 * anche attaccato e con lettere (D0048CE, D0048BA: le sedi Prysmian di Caserta
 * e Bari), quindi si accetta qualunque coda dopo le cifre.
 */
function spezzaCodice(
  codice: string,
): { prefisso: string; numero: string; suffisso: string | null } | null {
  const m = /^([A-Za-z])(\d+)-?([A-Za-z0-9]*)$/.exec(codice.trim());
  if (!m) return null;
  return {
    prefisso: m[1].toUpperCase(),
    numero: m[2],
    suffisso: m[3] || null,
  };
}

/** Primo valore non vuoto della colonna fra le righe date, nell'ordine. */
function primo(righe: RigaAnag[], colonna: string): string | null {
  for (const r of righe) {
    const v = vuoto(r[colonna]);
    if (v) return v;
  }
  return null;
}

type Azienda = {
  numero: string;
  righeC: RigaAnag[];
  righeF: RigaAnag[];
  righeD: RigaAnag[];
};

function raggruppaAziende(righe: RigaAnag[]): {
  aziende: Map<string, Azienda>;
  scartate: number;
} {
  const aziende = new Map<string, Azienda>();
  let scartate = 0;

  for (const r of righe) {
    const codice = vuoto(r["Codice"]);
    if (!codice) continue;
    const parti = spezzaCodice(codice);
    if (!parti) {
      scartate++;
      continue;
    }
    const a =
      aziende.get(parti.numero) ??
      ({ numero: parti.numero, righeC: [], righeF: [], righeD: [] } as Azienda);
    if (parti.prefisso === "C") a.righeC.push(r);
    else if (parti.prefisso === "F") a.righeF.push(r);
    else if (parti.prefisso === "D") a.righeD.push(r);
    else {
      scartate++;
      continue;
    }
    aziende.set(parti.numero, a);
  }
  return { aziende, scartate };
}

type EsitoAnagrafiche = {
  aziende: number;
  clienti: number;
  fornitori: number;
  entrambi: number;
  referenti: number;
  destinazioni: number;
  senzaRagioneSociale: number;
  codiciNonValidi: number;
  /** codice Excel (C0042 / F0042) → id Anagrafica, per collegare le commesse. */
  mappaCodici: Map<string, string>;
};

async function importaAnagrafiche(
  righe: RigaAnag[],
  prova: boolean,
): Promise<EsitoAnagrafiche> {
  const { aziende, scartate } = raggruppaAziende(righe);
  const esito: EsitoAnagrafiche = {
    aziende: 0,
    clienti: 0,
    fornitori: 0,
    entrambi: 0,
    referenti: 0,
    destinazioni: 0,
    senzaRagioneSociale: 0,
    codiciNonValidi: scartate,
    mappaCodici: new Map(),
  };

  for (const az of aziende.values()) {
    // Priorità al record cliente per i dati di testa, poi fornitore, poi sedi.
    const ordinate = [...az.righeC, ...az.righeF, ...az.righeD];
    const ragioneSociale = primo(ordinate, "Ragione sociale");
    if (!ragioneSociale) {
      esito.senzaRagioneSociale++;
      continue;
    }

    const codiceCliente = vuoto(az.righeC[0]?.["Codice"]);
    const codiceFornitore = vuoto(az.righeF[0]?.["Codice"]);
    if (!codiceCliente && !codiceFornitore) {
      // Solo destinazioni, senza testa cliente/fornitore: si aggancia comunque
      // creando l'anagrafica, altrimenti le sedi resterebbero orfane.
    }

    const { fax, sdi } = dividiFaxSdi(primo(ordinate, "Fax/Cod. Univoco") ?? "");
    const { email, web, extra } = dividiEmailWeb(
      primo(ordinate, "E-Mail:  -  WEB") ?? "",
    );

    const noteParti = [primo(ordinate, "NOTE"), extra].filter(Boolean);

    const dati = {
      ragioneSociale,
      codiceCliente,
      codiceFornitore,
      isCliente: az.righeC.length > 0,
      isFornitore: az.righeF.length > 0,
      partitaIva: normalizzaPiva(primo(ordinate, "P. IVA") ?? undefined),
      codiceFiscale: primo(ordinate, "Cod. Fisc."),
      codiceSDI: sdi,
      indirizzo: primo(ordinate, "Indirizzo"),
      cap: primo(ordinate, "Cap"),
      localita: primo(ordinate, "Località"),
      provincia: primo(ordinate, "Prov."),
      telefono: primo(ordinate, "Telefono"),
      fax,
      email,
      web,
      modalitaPagamento: primo(ordinate, "Modalità pagamento"),
      prodottiTrattati: primo(ordinate, "Prodotti trattati"),
      note: noteParti.length ? noteParti.join(" · ") : null,
    };

    esito.aziende++;
    if (dati.isCliente) esito.clienti++;
    if (dati.isFornitore) esito.fornitori++;
    if (dati.isCliente && dati.isFornitore) esito.entrambi++;

    const riferimento = primo(ordinate, "Riferimento");
    const ref = riferimento ? parseReferente(riferimento) : null;
    if (ref) esito.referenti++;
    const sedi = az.righeD.filter((d) => vuoto(d["Codice"]));
    esito.destinazioni += sedi.length;

    if (prova) {
      if (codiceCliente) esito.mappaCodici.set(codiceCliente, "prova");
      if (codiceFornitore) esito.mappaCodici.set(codiceFornitore, "prova");
      continue;
    }

    // Chiave di upsert: il codice cliente se c'è, altrimenti quello fornitore.
    // Restano stabili fra le esecuzioni, quindi l'import è ripetibile.
    const chiave = codiceCliente
      ? { codiceCliente }
      : codiceFornitore
        ? { codiceFornitore }
        : null;

    const anagrafica = chiave
      ? await prisma.anagrafica.upsert({
          where: chiave,
          create: dati,
          update: dati,
        })
      : await prisma.anagrafica.create({ data: dati });

    if (codiceCliente) esito.mappaCodici.set(codiceCliente, anagrafica.id);
    if (codiceFornitore) esito.mappaCodici.set(codiceFornitore, anagrafica.id);

    if (ref) {
      const esistente = await prisma.referente.findFirst({
        where: {
          anagraficaId: anagrafica.id,
          nome: ref.nome,
          cognome: ref.cognome,
        },
        select: { id: true },
      });
      if (!esistente) {
        await prisma.referente.create({
          data: {
            anagraficaId: anagrafica.id,
            ...ref,
            principale: true,
            note: `Importato da Excel: "${riferimento}"`,
          },
        });
      }
    }

    for (const d of sedi) {
      const codice = vuoto(d["Codice"])!;
      const nome = vuoto(d["Ragione sociale"]);
      const datiSede = {
        anagraficaId: anagrafica.id,
        codice,
        // Si tiene solo se il sito ha un nome proprio diverso dall'azienda.
        descrizione:
          nome && nome.toUpperCase() !== ragioneSociale.toUpperCase() ? nome : null,
        indirizzo: vuoto(d["Indirizzo"]),
        cap: vuoto(d["Cap"]),
        localita: vuoto(d["Località"]),
        provincia: vuoto(d["Prov."]),
        telefono: vuoto(d["Telefono"]),
        note: vuoto(d["NOTE"]),
      };
      await prisma.destinazione.upsert({
        where: { codice },
        create: datiSede,
        update: datiSede,
      });
    }
  }

  return esito;
}

/* ================================ commesse =============================== */

const COL_OFF = ["Nr. Commessa", "Cod. Cliente", "Cliente", "P.M.", "STATO"];

/**
 * STATO dell'Excel → stati del CRM. Il foglio valorizza STATO solo su 203 righe
 * delle 723 reali, e usa 4 valori: OK, "da inviare", ANNULLATA (più "ok" minuscolo).
 *
 * Le 520 righe senza STATO non sono preventivi: sono tutte tipologia C (499) o
 * interne (21), **senza alcun importo e senza alcuna data**. Sono lavori aperti
 * direttamente a consuntivo, cioè senza fase di offerta, quindi vanno in
 * CONSUNTIVO — che è esattamente ciò che la riga dichiara. Il riconoscimento è
 * sui dati (nessun segnale commerciale), non sulla tipologia, così copre anche
 * le interne che non hanno tipologia.
 */
function mappaStato(
  statoRaw: string,
  ha: {
    dataOrdine: boolean;
    importoOrdine: boolean;
    importoOfferta: boolean;
    dataInvio: boolean;
    dataRichiesta: boolean;
  },
): string {
  const s = statoRaw.trim().toLowerCase();
  const acquisita = ha.dataOrdine || ha.importoOrdine;

  if (s.startsWith("annull")) return "PERSA";
  if (s === "da inviare") return "PREVENTIVO";
  if (s === "ok") return acquisita ? "ORDINE_CONFERMATO" : "INVIATA";

  if (acquisita) return "ORDINE_CONFERMATO";
  if (ha.dataInvio) return "INVIATA";

  const senzaTracciaCommerciale =
    !ha.importoOfferta && !ha.dataRichiesta && !ha.dataInvio;
  return senzaTracciaCommerciale ? "CONSUNTIVO" : "PREVENTIVO";
}

/** "INT." non è una tipologia (vedi testata del file); "Test" è una riga di prova. */
function mappaTipologia(v: string): string | null {
  const s = v.trim().toUpperCase();
  if (s === "P" || s === "C" || s === "T") return s;
  if (s === "GARA") return "GARA";
  return null;
}

/** "261041" → anno 2026, progressivo 1041.  "2600" → anno 2026, progressivo 0. */
function spezzaNumero(
  numero: string,
): { anno: number; progressivo: number } | null {
  const s = numero.trim();
  if (!/^\d{4,6}$/.test(s)) return null;
  const anno = 2000 + Number(s.slice(0, 2));
  const progressivo = Number(s.slice(2));
  return Number.isFinite(progressivo) ? { anno, progressivo } : null;
}

async function risolviPm(
  nome: string,
  cache: Map<string, string | null>,
  creati: string[],
  prova: boolean,
): Promise<string | null> {
  const chiave = nome.trim().toLowerCase();
  if (!chiave || chiave === "interna" || chiave === "test") return null;
  if (cache.has(chiave)) return cache.get(chiave)!;

  // Il foglio scrive "Cognome Nome"; si cerca su entrambe le combinazioni,
  // tollerando la variante "Florino"/"Fiorino" presente nei dati.
  const parti = nome.trim().split(/\s+/);
  const utenti = await prisma.user.findMany({
    select: { id: true, nome: true, cognome: true },
  });
  const norm = (v: string) =>
    v.toLowerCase().replace(/[^a-z]/g, "").replace("fl", "fi");
  const cercato = norm(parti.join(""));

  const trovato = utenti.find(
    (u) => norm(u.nome + u.cognome) === cercato || norm(u.cognome + u.nome) === cercato,
  );
  if (trovato) {
    cache.set(chiave, trovato.id);
    return trovato.id;
  }

  if (prova) {
    creati.push(nome.trim());
    cache.set(chiave, null);
    return null;
  }

  // PM storico non presente fra gli utenti: si crea disattivato e senza
  // password utilizzabile, così le commesse restano assegnate a un nome reale
  // ma non si apre un accesso che nessuno ha autorizzato.
  const cognome = parti[0];
  const nomeProprio = parti.slice(1).join(" ") || cognome;
  const email = `${nomeProprio}.${cognome}`
    .toLowerCase()
    .replace(/[^a-z.]/g, "")
    .replace(/\.+/g, ".") + "@elettra.it";

  const creato = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      passwordHash: bcrypt.hashSync(
        `import-${Math.random().toString(36).slice(2)}`,
        10,
      ),
      nome: nomeProprio,
      cognome,
      ruolo: "PROJECT_MANAGER",
      attivo: false,
    },
    update: {},
    select: { id: true },
  });
  creati.push(`${nome.trim()} → ${email}`);
  cache.set(chiave, creato.id);
  return creato.id;
}

type EsitoCommesse = {
  importate: number;
  preallocate: number;
  senzaCliente: number;
  numeroNonValido: number;
  interne: number;
  referentiCommessa: number;
  pmCreati: string[];
  perStato: Record<string, number>;
  perTipologia: Record<string, number>;
};

async function importaCommesse(
  righe: Record<string, string>[],
  mappaCodici: Map<string, string>,
  prova: boolean,
): Promise<EsitoCommesse> {
  const esito: EsitoCommesse = {
    importate: 0,
    preallocate: 0,
    senzaCliente: 0,
    numeroNonValido: 0,
    interne: 0,
    referentiCommessa: 0,
    pmCreati: [],
    perStato: {},
    perTipologia: {},
  };
  const cachePm = new Map<string, string | null>();

  for (const r of righe) {
    const numero = vuoto(r["Nr. Commessa"]);
    if (!numero) continue;

    const codCliente = vuoto(r["Cod. Cliente"]);
    const tipologiaRaw = vuoto(r["Tipol. Lavoro"]) ?? "";
    const descrizione = vuoto(r["Descrizione attività"]);

    // Numeri riservati per il futuro: hanno solo numero e nome cliente.
    const sostanza =
      codCliente || tipologiaRaw || descrizione || vuoto(r["STATO"]) ||
      vuoto(r["IMPORTO OFFERTA"]) || vuoto(r["Data Richiesta"]);
    if (!sostanza) {
      esito.preallocate++;
      continue;
    }
    if (tipologiaRaw.toLowerCase() === "test") continue;

    const parti = spezzaNumero(numero);
    if (!parti) {
      esito.numeroNonValido++;
      continue;
    }
    if (!codCliente) {
      esito.senzaCliente++;
      continue;
    }
    const clienteId = mappaCodici.get(codCliente.toUpperCase());
    if (!clienteId) {
      esito.senzaCliente++;
      continue;
    }
    if (codCliente.toUpperCase() === "C0000") esito.interne++;

    const dataOrdine = parseDataIt(r["Data dell'ordine"]);
    const importoOrdine = parseImportoIt(r["IMPORTO ORDINE ACQUISTO"]);
    const dataInvio = parseDataIt(r["Data Invio"]);

    const importoOfferta = parseImportoIt(r["IMPORTO OFFERTA"]);
    const dataRichiesta = parseDataIt(r["Data Richiesta"]);

    const stato = mappaStato(r["STATO"] ?? "", {
      dataOrdine: !!dataOrdine,
      importoOrdine: !!importoOrdine,
      importoOfferta: !!importoOfferta,
      dataInvio: !!dataInvio,
      dataRichiesta: !!dataRichiesta,
    });
    const tipologia = mappaTipologia(tipologiaRaw);

    esito.perStato[stato] = (esito.perStato[stato] ?? 0) + 1;
    const kTip = tipologia ?? "(nessuna)";
    esito.perTipologia[kTip] = (esito.perTipologia[kTip] ?? 0) + 1;

    const pmId = await risolviPm(r["P.M."] ?? "", cachePm, esito.pmCreati, prova);

    esito.importate++;
    if (prova) continue;

    // Referente indicato sulla commessa: agganciato al cliente, riusato se già
    // presente, così 193 righe non generano 193 duplicati.
    let referenteId: string | null = null;
    const refRaw = vuoto(r["Referente Cliente"]);
    if (refRaw) {
      const ref = parseReferente(refRaw);
      if (ref) {
        const emailRef = vuoto(r["Email referente"]);
        const esistente = await prisma.referente.findFirst({
          where: { anagraficaId: clienteId, nome: ref.nome, cognome: ref.cognome },
          select: { id: true },
        });
        if (esistente) referenteId = esistente.id;
        else {
          const creato = await prisma.referente.create({
            data: {
              anagraficaId: clienteId,
              ...ref,
              email: emailRef,
              note: `Importato da elenco offerte: "${refRaw}"`,
            },
            select: { id: true },
          });
          referenteId = creato.id;
          esito.referentiCommessa++;
        }
      }
    }

    const dati = {
      anno: parti.anno,
      progressivo: parti.progressivo,
      clienteId,
      pmId,
      referenteId,
      referenteCommerciale: vuoto(r["Referente Commerciale"]),
      stato,
      tipologia,
      descrizione,
      dataRichiesta: dataRichiesta ?? new Date(Date.UTC(parti.anno, 0, 1)),
      dataInvio,
      importoOfferta,
      importoOrdine,
      dataOrdine,
      oda: vuoto(r["ODA"]),
    };

    await prisma.commessa.upsert({
      where: { numero },
      create: { numero, ...dati },
      update: dati,
    });
  }

  return esito;
}

/* ================================== main ================================= */

async function pulisci() {
  // Ordine rispettoso delle FK; utenti, operai e catalogo restano.
  await prisma.documento.deleteMany();
  await prisma.rigaOrdineFornitore.deleteMany();
  await prisma.ordineFornitore.deleteMany();
  await prisma.assegnazioneOperaio.deleteMany();
  await prisma.milestone.deleteMany();
  await prisma.commessa.deleteMany();
  await prisma.destinazione.deleteMany();
  await prisma.referente.deleteMany();
  await prisma.anagrafica.deleteMany();
}

async function main() {
  const argv = process.argv.slice(2);
  const flag = (n: string) => argv.includes(n);
  const files = argv.filter((a) => !a.startsWith("--"));
  const prova = flag("--prova");

  if (files.length < 2) {
    console.error(
      "Uso: npx tsx scripts/import-excel.ts <anagrafiche.xls> <offerte.xls> [--pulisci] [--prova]",
    );
    process.exit(1);
  }
  const [fileAnag, fileOff] = files;

  console.log(`\n▸ Conversione ${basename(fileAnag)}`);
  const fogliAnag = leggiFogli(fileAnag);
  console.log(`  fogli: ${[...fogliAnag.keys()].join(", ")}`);
  console.log(`▸ Conversione ${basename(fileOff)}`);
  const fogliOff = leggiFogli(fileOff);
  console.log(`  fogli: ${[...fogliOff.keys()].join(", ")}`);

  const righeAnag = (() => {
    for (const righe of fogliAnag.values()) {
      try {
        return aRecord(righe, COL_ANAG);
      } catch {
        continue;
      }
    }
    throw new Error("Foglio anagrafiche non riconosciuto.");
  })();
  const righeOff = (() => {
    for (const righe of fogliOff.values()) {
      try {
        return aRecord(righe, COL_OFF);
      } catch {
        continue;
      }
    }
    throw new Error("Foglio offerte non riconosciuto.");
  })();

  console.log(
    `\n▸ Righe lette: ${righeAnag.length} anagrafiche, ${righeOff.length} offerte`,
  );

  if (flag("--pulisci")) {
    if (prova) console.log("▸ --pulisci ignorato in modalità prova");
    else {
      console.log("▸ Pulizia di anagrafiche e commesse esistenti");
      await pulisci();
    }
  }

  console.log(`\n▸ Import anagrafiche${prova ? " (prova)" : ""}`);
  const a = await importaAnagrafiche(righeAnag, prova);
  console.log(`  aziende            ${a.aziende}`);
  console.log(`  di cui clienti     ${a.clienti}`);
  console.log(`  di cui fornitori   ${a.fornitori}`);
  console.log(`  sia C sia F        ${a.entrambi}`);
  console.log(`  referenti          ${a.referenti}`);
  console.log(`  destinazioni       ${a.destinazioni}`);
  if (a.senzaRagioneSociale)
    console.log(`  scartate (no nome) ${a.senzaRagioneSociale}`);
  if (a.codiciNonValidi) console.log(`  codici non validi  ${a.codiciNonValidi}`);

  console.log(`\n▸ Import commesse${prova ? " (prova)" : ""}`);
  const c = await importaCommesse(righeOff, a.mappaCodici, prova);
  console.log(`  importate          ${c.importate}`);
  console.log(`  di cui interne     ${c.interne}`);
  console.log(`  numeri pre-allocati saltati  ${c.preallocate}`);
  if (c.senzaCliente) console.log(`  senza cliente valido         ${c.senzaCliente}`);
  if (c.numeroNonValido) console.log(`  numero non valido            ${c.numeroNonValido}`);
  console.log(`  nuovi referenti    ${c.referentiCommessa}`);
  console.log(`  per stato:      ${JSON.stringify(c.perStato)}`);
  console.log(`  per tipologia:  ${JSON.stringify(c.perTipologia)}`);
  if (c.pmCreati.length) {
    console.log(`  PM creati disattivati (${c.pmCreati.length}):`);
    for (const p of c.pmCreati) console.log(`    · ${p}`);
  }

  console.log(
    prova
      ? "\n▸ Prova completata: nessuna scrittura sul database.\n"
      : "\n▸ Import completato.\n",
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error("\nImport interrotto:", e instanceof Error ? e.message : e);
    await prisma.$disconnect();
    process.exit(1);
  });
