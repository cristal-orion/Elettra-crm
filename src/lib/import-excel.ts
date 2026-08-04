/**
 * Import dei due elenchi Excel storici di Elettra (anagrafiche + offerte).
 *
 * Logica condivisa fra la pagina `/impostazioni/import` (drag & drop) e lo
 * script `scripts/import-excel.ts`: i dati non passano mai da GitHub.
 *
 * I file `.xls` (BIFF8) si leggono con SheetJS, non convertendoli con
 * LibreOffice: l'import deve funzionare **dentro il container**, dove
 * LibreOffice non c'è e aggiungerlo costerebbe centinaia di MB.
 *
 * Scelte non ovvie, dedotte dai dati reali:
 *
 * - Le righe F####/C####/D#### con lo **stesso numero** sono la stessa azienda
 *   (1042 numeri su 1062 hanno ragione sociale coerente; i 20 diversi sono
 *   destinazioni che portano il nome del sito). Vengono **unite in una sola
 *   Anagrafica** con codiceCliente + codiceFornitore: è la "doppia natura" per
 *   cui lo schema è nato. Senza il merge nascerebbero 3243 record al posto di
 *   ~1044, con la stessa P.IVA ripetuta fino a 5 volte.
 *
 * - Le righe D#### diventano `Destinazione` (sedi di consegna/cantiere), non
 *   anagrafiche: solo 108 su 1118 hanno P.IVA.
 *
 * - "INT." non è una tipologia: le commesse interne sono quelle del cliente
 *   ELETTRA S.r.l. (C0000).
 *
 * - I PM che non esistono come utenti vengono creati **disattivati e senza
 *   password utilizzabile**, così lo storico resta assegnato senza aprire
 *   accessi che nessuno ha autorizzato.
 */

import bcrypt from "bcryptjs";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";

/** Valore di cella così come lo restituisce SheetJS in modalità grezza. */
type Cella = string | number | boolean | Date;
type Riga = Record<string, Cella>;

/* ================================ lettura ================================= */

/**
 * Legge tutti i fogli di una cartella .xls/.xlsx.
 *
 * `raw: true` è deliberato: con `raw: false` SheetJS applica il formato della
 * cella e restituisce gli importi all'inglese ("€ 604,423.89"), che un parser
 * italiano leggerebbe come 604,42. Con i valori grezzi i numeri restano numeri
 * e le date restano Date, senza alcuna conversione di mezzo.
 */
export function leggiFogli(dati: ArrayBuffer | Buffer): Map<string, Cella[][]> {
  const wb = XLSX.read(dati, { type: "buffer", cellDates: true });
  const fogli = new Map<string, Cella[][]>();
  for (const nome of wb.SheetNames) {
    fogli.set(
      nome,
      XLSX.utils.sheet_to_json<Cella[]>(wb.Sheets[nome], {
        header: 1,
        raw: true,
        defval: "",
        blankrows: true,
      }),
    );
  }
  return fogli;
}

/**
 * Converte le righe in oggetti usando come intestazione la prima riga che
 * contiene tutte le colonne attese: i fogli hanno titoli e totali in cima, e
 * l'intestazione vera non è la prima riga.
 */
function aRecord(righe: Cella[][], colonneAttese: string[]): Riga[] {
  const testa = (r: Cella[]) => r.map((c) => String(c ?? "").trim());

  const idx = righe.findIndex((r) => {
    const set = new Set(testa(r));
    return colonneAttese.every((c) => set.has(c));
  });
  if (idx === -1) {
    throw new Error(
      `Foglio non riconosciuto: mancano le colonne ${colonneAttese.join(", ")}.`,
    );
  }

  const header = testa(righe[idx]);
  return righe.slice(idx + 1).map((r) => {
    const o: Riga = {};
    header.forEach((h, i) => {
      if (h) o[h] = r[i] ?? "";
    });
    return o;
  });
}

/** Primo foglio della cartella che contiene le colonne attese. */
function foglioCon(fogli: Map<string, Cella[][]>, colonne: string[]): Riga[] {
  for (const righe of fogli.values()) {
    try {
      return aRecord(righe, colonne);
    } catch {
      continue;
    }
  }
  throw new Error(
    `Nessun foglio contiene le colonne attese (${colonne.join(", ")}). ` +
      `Hai invertito i due file?`,
  );
}

/* ============================== normalizzatori ============================ */

function testo(v: Cella | undefined): string | null {
  if (v === undefined || v === null) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(v).trim();
  return s.length ? s : null;
}

/** Toglie il prefisso IT alle sole partite IVA italiane; le estere restano. */
function normalizzaPiva(v: Cella | undefined): string | null {
  const s = (testo(v) ?? "").replace(/\s+/g, "");
  if (!s) return null;
  const m = /^IT(\d{11})$/i.exec(s);
  return m ? m[1] : s;
}

/**
 * Data di cella. SheetJS costruisce le Date nel fuso locale, quindi
 * `toISOString()` su "29/12/2025" in Europe/Rome darebbe 2025-12-28: si leggono
 * i componenti **locali** e si ricompone una mezzanotte UTC, così il giorno
 * resta quello scritto nel foglio.
 */
function parseData(v: Cella | undefined): Date | null {
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return null;
    return new Date(Date.UTC(v.getFullYear(), v.getMonth(), v.getDate()));
  }
  const s = testo(v);
  if (!s) return null;
  const m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/.exec(s);
  if (!m) return null;
  const [, g, mm, aRaw] = m;
  const anno = aRaw.length === 2 ? 2000 + Number(aRaw) : Number(aRaw);
  const d = new Date(Date.UTC(anno, Number(mm) - 1, Number(g)));
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Importo di cella. Con `raw: true` gli importi sono già numeri; la variante
 * testuale resta gestita per i file salvati come testo (virgola decimale
 * italiana o punto inglese).
 */
function parseImporto(v: Cella | undefined): string | null {
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : null;
  let s = (testo(v) ?? "").replace(/[€\s]/g, "");
  if (!s || s === "-") return null;

  const virgola = s.lastIndexOf(",");
  const punto = s.lastIndexOf(".");
  if (virgola > punto) s = s.replace(/\./g, "").replace(",", "."); // 1.234,56
  else if (punto > virgola) s = s.replace(/,/g, ""); // 1,234.56
  else s = s.replace(",", ".");

  const n = Number(s);
  return Number.isFinite(n) ? String(n) : null;
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
 * Spezza un riferimento libero in titolo/nome/cognome. L'ordine nei fogli è
 * incoerente ("Cristian Pozzi" ma anche "Sabatasso Stefano"): si assume
 * **Nome Cognome**, che è la maggioranza, e il testo originale resta nelle note
 * del referente perché la correzione sia sempre possibile.
 */
function parseReferente(
  v: string,
): { titolo: string; nome: string; cognome: string } | null {
  let s = v.trim().replace(/\s+/g, " ");
  if (!s) return null;

  let titolo = "NESSUNO";
  for (const [t, chiave] of Object.entries(TITOLI_TESTO)) {
    if (s.toLowerCase().startsWith(t)) {
      titolo = chiave;
      s = s.slice(t.length).trim();
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
  return { prefisso: m[1].toUpperCase(), numero: m[2], suffisso: m[3] || null };
}

/**
 * "Fax/Cod. Univoco" mescola numeri di fax e codici SDI (32 casi su 1021), a
 * volte etichettati ("SDI: W7YVJK9"). Un codice destinatario è di 6-7 caratteri
 * alfanumerici e contiene almeno una lettera.
 */
function dividiFaxSdi(v: string | null): { fax: string | null; sdi: string | null } {
  const s = (v ?? "").trim();
  if (!s) return { fax: null, sdi: null };

  const etichettato = /(?:codice\s*)?sdi\s*:?\s*([A-Z0-9]{6,7})\b/i.exec(s);
  if (etichettato) return { fax: null, sdi: etichettato[1].toUpperCase() };

  if (/^[A-Z0-9]{6,7}$/i.test(s) && /[A-Z]/i.test(s)) {
    return { fax: null, sdi: s.toUpperCase() };
  }
  return { fax: s, sdi: null };
}

/**
 * "E-Mail: - WEB" può contenere più indirizzi separati da " - " e qualche sito.
 * La prima email diventa quella principale; il resto finisce nelle note, per
 * non perdere nulla.
 */
function dividiEmailWeb(v: string | null): {
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
    extra: [...email.slice(1), ...web.slice(1), ...resto].join(" · ") || null,
  };
}

/* ================================= esito ================================= */

export type EsitoImport = {
  prova: boolean;
  righeLette: { anagrafiche: number; offerte: number };
  anagrafiche: {
    aziende: number;
    clienti: number;
    fornitori: number;
    entrambi: number;
    referenti: number;
    destinazioni: number;
    senzaRagioneSociale: number;
    codiciNonValidi: number;
  };
  commesse: {
    importate: number;
    interne: number;
    preallocate: number;
    senzaCliente: number;
    numeroNonValido: number;
    referentiNuovi: number;
    perStato: Record<string, number>;
    perTipologia: Record<string, number>;
  };
  pmCreati: string[];
  /** Somme di controllo, da confrontare con i totali scritti nell'Excel. */
  totali: { offerte: number; ordini: number };
  avvisi: string[];
};

/* ============================== anagrafiche =============================== */

const COL_ANAG = ["Codice", "Ragione sociale", "Indirizzo", "P. IVA"];
const COL_OFF = ["Nr. Commessa", "Cod. Cliente", "Cliente", "P.M.", "STATO"];

function primo(righe: Riga[], colonna: string): string | null {
  for (const r of righe) {
    const v = testo(r[colonna]);
    if (v) return v;
  }
  return null;
}

type Azienda = { righeC: Riga[]; righeF: Riga[]; righeD: Riga[] };

async function importaAnagrafiche(
  righe: Riga[],
  prova: boolean,
  esito: EsitoImport,
): Promise<Map<string, string>> {
  const aziende = new Map<string, Azienda>();

  for (const r of righe) {
    const codice = testo(r["Codice"]);
    if (!codice) continue;
    const parti = spezzaCodice(codice);
    if (!parti || !"CFD".includes(parti.prefisso)) {
      esito.anagrafiche.codiciNonValidi++;
      continue;
    }
    const a =
      aziende.get(parti.numero) ?? ({ righeC: [], righeF: [], righeD: [] } as Azienda);
    if (parti.prefisso === "C") a.righeC.push(r);
    else if (parti.prefisso === "F") a.righeF.push(r);
    else a.righeD.push(r);
    aziende.set(parti.numero, a);
  }

  const mappaCodici = new Map<string, string>();

  for (const az of aziende.values()) {
    // Il record cliente ha la precedenza sui dati di testa, poi il fornitore,
    // poi le sedi: i campi mancanti si completano a cascata.
    const ordinate = [...az.righeC, ...az.righeF, ...az.righeD];
    const ragioneSociale = primo(ordinate, "Ragione sociale");
    if (!ragioneSociale) {
      esito.anagrafiche.senzaRagioneSociale++;
      continue;
    }

    const codiceCliente = testo(az.righeC[0]?.["Codice"]);
    const codiceFornitore = testo(az.righeF[0]?.["Codice"]);
    const { fax, sdi } = dividiFaxSdi(primo(ordinate, "Fax/Cod. Univoco"));
    const { email, web, extra } = dividiEmailWeb(primo(ordinate, "E-Mail:  -  WEB"));
    const note = [primo(ordinate, "NOTE"), extra].filter(Boolean).join(" · ") || null;

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
      note,
    };

    esito.anagrafiche.aziende++;
    if (dati.isCliente) esito.anagrafiche.clienti++;
    if (dati.isFornitore) esito.anagrafiche.fornitori++;
    if (dati.isCliente && dati.isFornitore) esito.anagrafiche.entrambi++;

    const riferimento = primo(ordinate, "Riferimento");
    const ref = riferimento ? parseReferente(riferimento) : null;
    if (ref) esito.anagrafiche.referenti++;
    const sedi = az.righeD.filter((d) => testo(d["Codice"]));
    esito.anagrafiche.destinazioni += sedi.length;

    if (prova) {
      if (codiceCliente) mappaCodici.set(codiceCliente.toUpperCase(), "prova");
      if (codiceFornitore) mappaCodici.set(codiceFornitore.toUpperCase(), "prova");
      continue;
    }

    // Chiave di upsert stabile fra le esecuzioni → l'import è ripetibile.
    const chiave = codiceCliente
      ? { codiceCliente }
      : codiceFornitore
        ? { codiceFornitore }
        : null;

    const anagrafica = chiave
      ? await prisma.anagrafica.upsert({ where: chiave, create: dati, update: dati })
      : await prisma.anagrafica.create({ data: dati });

    if (codiceCliente) mappaCodici.set(codiceCliente.toUpperCase(), anagrafica.id);
    if (codiceFornitore) mappaCodici.set(codiceFornitore.toUpperCase(), anagrafica.id);

    if (ref) {
      const esistente = await prisma.referente.findFirst({
        where: { anagraficaId: anagrafica.id, nome: ref.nome, cognome: ref.cognome },
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
      const codice = testo(d["Codice"])!;
      const nome = testo(d["Ragione sociale"]);
      const datiSede = {
        anagraficaId: anagrafica.id,
        codice,
        descrizione:
          nome && nome.toUpperCase() !== ragioneSociale.toUpperCase() ? nome : null,
        indirizzo: testo(d["Indirizzo"]),
        cap: testo(d["Cap"]),
        localita: testo(d["Località"]),
        provincia: testo(d["Prov."]),
        telefono: testo(d["Telefono"]),
        note: testo(d["NOTE"]),
      };
      await prisma.destinazione.upsert({
        where: { codice },
        create: datiSede,
        update: datiSede,
      });
    }
  }

  return mappaCodici;
}

/* ================================ commesse =============================== */

/**
 * STATO dell'Excel → stati del CRM. Il foglio valorizza STATO solo su 203 righe
 * su 723, con 4 valori (OK, "da inviare", ANNULLATA, più "ok" minuscolo).
 *
 * Le 520 righe senza STATO non sono preventivi: sono tutte tipologia C o
 * interne, **senza alcun importo e senza alcuna data**. Sono lavori aperti
 * direttamente a consuntivo, quindi vanno in CONSUNTIVO. Il riconoscimento è
 * sui dati (nessun segnale commerciale), non sulla tipologia, così copre anche
 * le interne che tipologia non ne hanno.
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

  return !ha.importoOfferta && !ha.dataRichiesta && !ha.dataInvio
    ? "CONSUNTIVO"
    : "PREVENTIVO";
}

function mappaTipologia(v: string): string | null {
  const s = v.trim().toUpperCase();
  if (s === "P" || s === "C" || s === "T") return s;
  if (s === "GARA") return "GARA";
  return null; // "INT." e vuoto: non sono tipologie
}

/** "261041" → anno 2026, progressivo 1041.  "2600" → anno 2026, progressivo 0. */
function spezzaNumero(numero: string): { anno: number; progressivo: number } | null {
  const s = numero.trim();
  if (!/^\d{4,6}$/.test(s)) return null;
  const progressivo = Number(s.slice(2));
  return Number.isFinite(progressivo)
    ? { anno: 2000 + Number(s.slice(0, 2)), progressivo }
    : null;
}

async function risolviPm(
  nome: string,
  cache: Map<string, string | null>,
  utenti: { id: string; nome: string; cognome: string }[],
  esito: EsitoImport,
  prova: boolean,
): Promise<string | null> {
  const chiave = nome.trim().toLowerCase();
  if (!chiave || chiave === "interna" || chiave === "test") return null;
  if (cache.has(chiave)) return cache.get(chiave)!;

  // Il foglio scrive "Cognome Nome"; si confrontano entrambe le combinazioni,
  // tollerando la variante "Florino"/"Fiorino" presente nei dati.
  const norm = (v: string) =>
    v.toLowerCase().replace(/[^a-z]/g, "").replace(/fl/g, "fi");
  const cercato = norm(nome);
  const trovato = utenti.find(
    (u) => norm(u.nome + u.cognome) === cercato || norm(u.cognome + u.nome) === cercato,
  );
  if (trovato) {
    cache.set(chiave, trovato.id);
    return trovato.id;
  }

  const parti = nome.trim().split(/\s+/);
  const cognome = parti[0];
  const nomeProprio = parti.slice(1).join(" ") || cognome;
  const email =
    `${nomeProprio}.${cognome}`.toLowerCase().replace(/[^a-z.]/g, "").replace(/\.+/g, ".") +
    "@elettra.it";

  if (prova) {
    esito.pmCreati.push(`${nome.trim()} → ${email}`);
    cache.set(chiave, null);
    return null;
  }

  // PM storico assente fra gli utenti: creato disattivato e con una password
  // casuale mai comunicata, così lo storico resta assegnato a un nome reale
  // senza aprire un accesso che nessuno ha autorizzato.
  const creato = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      passwordHash: bcrypt.hashSync(
        `import-${Math.random().toString(36).slice(2)}-${Date.now()}`,
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
  esito.pmCreati.push(`${nome.trim()} → ${email}`);
  utenti.push({ id: creato.id, nome: nomeProprio, cognome });
  cache.set(chiave, creato.id);
  return creato.id;
}

async function importaCommesse(
  righe: Riga[],
  mappaCodici: Map<string, string>,
  prova: boolean,
  esito: EsitoImport,
): Promise<void> {
  const cachePm = new Map<string, string | null>();
  const utenti = await prisma.user.findMany({
    select: { id: true, nome: true, cognome: true },
  });

  for (const r of righe) {
    const numero = testo(r["Nr. Commessa"]);
    if (!numero) continue;

    const codCliente = testo(r["Cod. Cliente"]);
    const tipologiaRaw = testo(r["Tipol. Lavoro"]) ?? "";
    const descrizione = testo(r["Descrizione attività"]);

    // Numeri riservati per il futuro: hanno solo numero e nome cliente.
    const haSostanza =
      codCliente ||
      tipologiaRaw ||
      descrizione ||
      testo(r["STATO"]) ||
      testo(r["IMPORTO OFFERTA"]) ||
      testo(r["Data Richiesta"]);
    if (!haSostanza) {
      esito.commesse.preallocate++;
      continue;
    }
    if (tipologiaRaw.toLowerCase() === "test") continue;

    const parti = spezzaNumero(numero);
    if (!parti) {
      esito.commesse.numeroNonValido++;
      continue;
    }
    const clienteId = codCliente
      ? mappaCodici.get(codCliente.toUpperCase())
      : undefined;
    if (!clienteId) {
      esito.commesse.senzaCliente++;
      continue;
    }
    if (codCliente?.toUpperCase() === "C0000") esito.commesse.interne++;

    const dataOrdine = parseData(r["Data dell'ordine"]);
    const dataInvio = parseData(r["Data Invio"]);
    const dataRichiesta = parseData(r["Data Richiesta"]);
    const importoOfferta = parseImporto(r["IMPORTO OFFERTA"]);
    const importoOrdine = parseImporto(r["IMPORTO ORDINE ACQUISTO"]);

    if (importoOfferta) esito.totali.offerte += Number(importoOfferta);
    if (importoOrdine) esito.totali.ordini += Number(importoOrdine);

    const stato = mappaStato(String(r["STATO"] ?? ""), {
      dataOrdine: !!dataOrdine,
      importoOrdine: !!importoOrdine,
      importoOfferta: !!importoOfferta,
      dataInvio: !!dataInvio,
      dataRichiesta: !!dataRichiesta,
    });
    const tipologia = mappaTipologia(tipologiaRaw);

    esito.commesse.perStato[stato] = (esito.commesse.perStato[stato] ?? 0) + 1;
    const kTip = tipologia ?? "(nessuna)";
    esito.commesse.perTipologia[kTip] = (esito.commesse.perTipologia[kTip] ?? 0) + 1;
    esito.commesse.importate++;

    const pmId = await risolviPm(
      String(r["P.M."] ?? ""),
      cachePm,
      utenti,
      esito,
      prova,
    );
    if (prova) continue;

    // Referente indicato sulla commessa: agganciato al cliente e riusato se già
    // presente, così 193 righe non generano 193 duplicati.
    let referenteId: string | null = null;
    const refRaw = testo(r["Referente Cliente"]);
    if (refRaw) {
      const ref = parseReferente(refRaw);
      if (ref) {
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
              email: testo(r["Email referente"]),
              note: `Importato da elenco offerte: "${refRaw}"`,
            },
            select: { id: true },
          });
          referenteId = creato.id;
          esito.commesse.referentiNuovi++;
        }
      }
    }

    const dati = {
      anno: parti.anno,
      progressivo: parti.progressivo,
      clienteId,
      pmId,
      referenteId,
      referenteCommerciale: testo(r["Referente Commerciale"]),
      stato,
      tipologia,
      descrizione,
      dataRichiesta: dataRichiesta ?? new Date(Date.UTC(parti.anno, 0, 1)),
      dataInvio,
      importoOfferta,
      importoOrdine,
      dataOrdine,
      oda: testo(r["ODA"]),
    };

    await prisma.commessa.upsert({
      where: { numero },
      create: { numero, ...dati },
      update: dati,
    });
  }
}

/* ================================= pulizia =============================== */

/** Svuota anagrafiche e commesse. Utenti, operai e catalogo restano. */
export async function pulisciDatiAnagrafici(): Promise<void> {
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

/* ================================== main ================================= */

export type OpzioniImport = {
  anagrafiche: ArrayBuffer | Buffer;
  offerte: ArrayBuffer | Buffer;
  /** Svuota i dati esistenti prima di importare (consigliato al primo giro). */
  pulisci?: boolean;
  /** Analizza e riporta senza scrivere nulla. */
  prova?: boolean;
};

export async function importaExcel(opz: OpzioniImport): Promise<EsitoImport> {
  const prova = opz.prova ?? false;

  const righeAnag = foglioCon(leggiFogli(opz.anagrafiche), COL_ANAG);
  const righeOff = foglioCon(leggiFogli(opz.offerte), COL_OFF);

  const esito: EsitoImport = {
    prova,
    righeLette: { anagrafiche: righeAnag.length, offerte: righeOff.length },
    anagrafiche: {
      aziende: 0,
      clienti: 0,
      fornitori: 0,
      entrambi: 0,
      referenti: 0,
      destinazioni: 0,
      senzaRagioneSociale: 0,
      codiciNonValidi: 0,
    },
    commesse: {
      importate: 0,
      interne: 0,
      preallocate: 0,
      senzaCliente: 0,
      numeroNonValido: 0,
      referentiNuovi: 0,
      perStato: {},
      perTipologia: {},
    },
    pmCreati: [],
    totali: { offerte: 0, ordini: 0 },
    avvisi: [],
  };

  if (opz.pulisci && !prova) await pulisciDatiAnagrafici();

  const mappaCodici = await importaAnagrafiche(righeAnag, prova, esito);
  await importaCommesse(righeOff, mappaCodici, prova, esito);

  if (esito.anagrafiche.senzaRagioneSociale > 0) {
    esito.avvisi.push(
      `${esito.anagrafiche.senzaRagioneSociale} gruppi di codici sono privi di ragione sociale e sono stati saltati.`,
    );
  }
  if (esito.commesse.senzaCliente > 0) {
    esito.avvisi.push(
      `${esito.commesse.senzaCliente} commesse non hanno un codice cliente valido e sono state saltate.`,
    );
  }
  esito.totali.offerte = Math.round(esito.totali.offerte * 100) / 100;
  esito.totali.ordini = Math.round(esito.totali.ordini * 100) / 100;

  return esito;
}
