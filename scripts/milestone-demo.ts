/**
 * Pianificazione dimostrativa su alcune commesse reali, per mostrare la sezione
 * Progetti durante la presentazione.
 *
 *   npm run demo:milestone              # crea
 *   npm run demo:milestone -- --rimuovi # elimina tutto ciò che ha creato
 *
 * Gli elenchi Excel di Elettra non contengono pianificazione di cantiere, quindi
 * dopo l'import i 597 cantieri risultano tutti "da pianificare" e la sezione
 * sembra vuota. Queste milestone servono solo a farla vedere all'opera.
 *
 * Sono marcate con `Milestone.dimostrativa = true`, non con una convenzione sul
 * titolo: l'interfaccia lo dichiara con un banner e un badge, e `--rimuovi` le
 * cancella tutte senza toccare eventuale pianificazione vera inserita a mano.
 *
 * Le commesse, i clienti e gli importi restano quelli reali: di finto ci sono
 * solo le milestone, le date di cantiere e le note.
 */

import { prisma } from "../src/lib/prisma";

type Passo = {
  titolo: string;
  stato: "DA_FARE" | "IN_CORSO" | "COMPLETATA";
  /** Giorni rispetto a oggi: negativi nel passato. */
  pianificata: number;
  effettiva?: number;
  note?: string;
};

type Scenario = {
  numero: string;
  /** Cosa deve dimostrare questo cantiere in presentazione. */
  mostra: string;
  inizio: number;
  scadenza: number;
  fine?: number;
  note?: string;
  passi: Passo[];
};

/**
 * Quattro cantieri scelti fra le commesse acquisite reali, uno per ciascuno
 * stato che la lista sa distinguere.
 */
const SCENARI: Scenario[] = [
  {
    numero: "261001",
    mostra: "cantiere avviato e nei tempi",
    inizio: -50,
    scadenza: +87,
    note: "Accesso al sito solo su appuntamento con il responsabile di stazione.",
    passi: [
      { titolo: "Sopralluogo e rilievo impianti esistenti", stato: "COMPLETATA", pianificata: -44, effettiva: -45 },
      { titolo: "Progetto esecutivo e schemi unifilari", stato: "COMPLETATA", pianificata: -30, effettiva: -28 },
      { titolo: "Approvvigionamento raddrizzatori e batterie", stato: "COMPLETATA", pianificata: -12, effettiva: -9 },
      { titolo: "Installazione stazioni di continuità", stato: "IN_CORSO", pianificata: +21, note: "Prima delle due stazioni in posa." },
      { titolo: "Commutazione e prove di autonomia", stato: "DA_FARE", pianificata: +55 },
      { titolo: "Collaudo finale e documentazione", stato: "DA_FARE", pianificata: +80 },
    ],
  },
  {
    numero: "261118",
    mostra: "cantiere in ritardo, con milestone scaduta",
    inizio: -92,
    scadenza: -11,
    note: "Fermo in attesa della fornitura degli interruttori MT.",
    passi: [
      { titolo: "Rilievo cabina esistente", stato: "COMPLETATA", pianificata: -86, effettiva: -86 },
      { titolo: "Progetto di revamping", stato: "COMPLETATA", pianificata: -68, effettiva: -62 },
      { titolo: "Fornitura quadri MT/BT", stato: "IN_CORSO", pianificata: -25, note: "Consegna slittata dal fornitore." },
      { titolo: "Smontaggio e posa nuovi quadri", stato: "DA_FARE", pianificata: -13 },
      { titolo: "Verifiche e messa in servizio", stato: "DA_FARE", pianificata: -4 },
    ],
  },
  {
    numero: "261140",
    mostra: "cantiere chiuso al 100%",
    inizio: -155,
    scadenza: -46,
    fine: -48,
    passi: [
      { titolo: "Progetto cabina di consegna", stato: "COMPLETATA", pianificata: -140, effettiva: -142 },
      { titolo: "Allestimento cabina in officina", stato: "COMPLETATA", pianificata: -108, effettiva: -105 },
      { titolo: "Trasporto e posa in campo", stato: "COMPLETATA", pianificata: -76, effettiva: -74 },
      { titolo: "Allacciamento impianto FV", stato: "COMPLETATA", pianificata: -58, effettiva: -57 },
      { titolo: "Collaudo e dichiarazione di conformità", stato: "COMPLETATA", pianificata: -47, effettiva: -48 },
    ],
  },
  {
    numero: "261070",
    mostra: "cantiere appena partito",
    inizio: -7,
    scadenza: +101,
    passi: [
      { titolo: "Sopralluogo cabine A e B", stato: "COMPLETATA", pianificata: -5, effettiva: -5 },
      { titolo: "Progetto sostituzione quadri MT", stato: "IN_CORSO", pianificata: +14 },
      { titolo: "Ordine quadri e accessori", stato: "DA_FARE", pianificata: +35 },
      { titolo: "Sostituzione in cabina A", stato: "DA_FARE", pianificata: +66 },
      { titolo: "Sostituzione in cabina B", stato: "DA_FARE", pianificata: +87 },
      { titolo: "Collaudo e consegna", stato: "DA_FARE", pianificata: +99 },
    ],
  },
];

/** Mezzanotte UTC a N giorni da oggi: le date restano stabili fra i fusi. */
function giorno(offset: number): Date {
  const d = new Date();
  return new Date(
    Date.UTC(d.getFullYear(), d.getMonth(), d.getDate() + offset),
  );
}

async function rimuovi() {
  const milestone = await prisma.milestone.deleteMany({
    where: { dimostrativa: true },
  });

  // Le date di cantiere non hanno un flag proprio: si azzerano solo sulle
  // commesse degli scenari, per non toccare pianificazioni inserite a mano.
  const commesse = await prisma.commessa.updateMany({
    where: { numero: { in: SCENARI.map((s) => s.numero) } },
    data: {
      dataInizioLavori: null,
      scadenzaLavori: null,
      dataFineLavori: null,
      noteCantiere: null,
    },
  });

  console.log(
    `\n▸ Rimosse ${milestone.count} milestone dimostrative e azzerate le date di cantiere su ${commesse.count} commesse.\n`,
  );
}

async function crea() {
  console.log("\n▸ Pianificazione dimostrativa su commesse reali\n");
  let totale = 0;
  const mancanti: string[] = [];

  for (const s of SCENARI) {
    const commessa = await prisma.commessa.findUnique({
      where: { numero: s.numero },
      include: { cliente: { select: { ragioneSociale: true } } },
    });
    if (!commessa) {
      mancanti.push(s.numero);
      continue;
    }

    // Si sostituiscono solo le dimostrative: se qualcuno ha inserito milestone
    // vere su questa commessa, restano dove sono.
    await prisma.milestone.deleteMany({
      where: { commessaId: commessa.id, dimostrativa: true },
    });

    await prisma.commessa.update({
      where: { id: commessa.id },
      data: {
        dataInizioLavori: giorno(s.inizio),
        scadenzaLavori: giorno(s.scadenza),
        dataFineLavori: s.fine !== undefined ? giorno(s.fine) : null,
        noteCantiere: s.note ?? null,
      },
    });

    const base = await prisma.milestone.aggregate({
      where: { commessaId: commessa.id },
      _max: { ordine: true },
    });
    let ordine = (base._max.ordine ?? -1) + 1;

    for (const p of s.passi) {
      await prisma.milestone.create({
        data: {
          commessaId: commessa.id,
          titolo: p.titolo,
          ordine: ordine++,
          stato: p.stato,
          dataPianificata: giorno(p.pianificata),
          dataEffettiva:
            p.stato === "COMPLETATA"
              ? giorno(p.effettiva ?? p.pianificata)
              : null,
          note: p.note ?? null,
          dimostrativa: true,
        },
      });
    }

    totale += s.passi.length;
    const fatte = s.passi.filter((p) => p.stato === "COMPLETATA").length;
    console.log(
      `  ${s.numero}  ${String(commessa.cliente.ragioneSociale).slice(0, 28).padEnd(30)} ${String(fatte + "/" + s.passi.length).padStart(5)}  ${s.mostra}`,
    );
  }

  if (mancanti.length) {
    console.log(
      `\n  ⚠ Commesse non trovate: ${mancanti.join(", ")}. Hai già importato gli elenchi Excel?`,
    );
  }
  console.log(
    `\n▸ Create ${totale} milestone, marcate come dimostrative e segnalate nell'interfaccia.`,
  );
  console.log("  Per eliminarle: npm run demo:milestone -- --rimuovi\n");
}

async function main() {
  if (process.argv.includes("--rimuovi")) await rimuovi();
  else await crea();
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error("\nInterrotto:", e instanceof Error ? e.message : e);
    await prisma.$disconnect();
    process.exit(1);
  });
