import { PrismaClient } from "../src/generated/prisma";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Password degli utenti creati dal seed. Nessun default nel codice: un valore
// scritto qui sarebbe pubblico nel repository, e su un'istanza raggiungibile da
// internet equivarrebbe a regalare un Super Admin. Va impostata SEED_PASSWORD
// (in `.env` in locale, fra le variabili d'ambiente in produzione).
function passwordRichiesta(): string {
  const p = process.env.SEED_PASSWORD;
  if (!p) {
    console.error(
      "SEED_PASSWORD non impostata: il seed creerebbe utenti senza una password\n" +
        "definita. Aggiungila al file .env (vedi .env.example) e riprova.",
    );
    process.exit(1);
  }
  return p;
}

const DEV_PASSWORD = passwordRichiesta();

async function main() {
  const hash = bcrypt.hashSync(DEV_PASSWORD, 10);

  // Pulizia (ordine rispettoso delle FK) per un seed idempotente.
  await prisma.attivita.deleteMany();
  await prisma.aiConversation.deleteMany();
  await prisma.aiOperation.deleteMany();
  await prisma.aiSchedule.deleteMany();
  await prisma.notifica.deleteMany();
  await prisma.allegatoSegnalazione.deleteMany();
  await prisma.segnalazione.deleteMany();
  await prisma.documento.deleteMany();
  await prisma.rigaOrdineFornitore.deleteMany();
  await prisma.ordineFornitore.deleteMany();
  await prisma.assegnazioneOperaio.deleteMany();
  await prisma.milestone.deleteMany();
  await prisma.operaio.deleteMany();
  await prisma.commessa.deleteMany();
  await prisma.referente.deleteMany();
  await prisma.prodotto.deleteMany();
  await prisma.anagrafica.deleteMany();
  await prisma.user.deleteMany();

  /* -------------------------------- Utenti -------------------------------- */
  const [fabio] = await Promise.all([
    prisma.user.create({
      data: {
        email: "fabio.greco@elettra.it",
        passwordHash: hash,
        nome: "Fabio",
        cognome: "Greco",
        ruolo: "SUPER_ADMIN",
      },
    }),
    prisma.user.create({
      data: {
        email: "roberto.baldares@elettra.it",
        passwordHash: hash,
        nome: "Roberto",
        cognome: "Baldares",
        ruolo: "BACKOFFICE",
      },
    }),
    prisma.user.create({
      data: {
        email: "tommaso.esposito@elettra.it",
        passwordHash: hash,
        nome: "Tommaso",
        cognome: "Esposito",
        ruolo: "PROJECT_MANAGER",
      },
    }),
    prisma.user.create({
      data: {
        email: "gianluca.marseglia@elettra.it",
        passwordHash: hash,
        nome: "Gianluca",
        cognome: "Marseglia",
        ruolo: "PROJECT_MANAGER",
      },
    }),
    prisma.user.create({
      data: {
        email: "giuseppe.fiorino@elettra.it",
        passwordHash: hash,
        nome: "Giuseppe",
        cognome: "Fiorino",
        ruolo: "PROJECT_MANAGER",
      },
    }),
    prisma.user.create({
      data: {
        email: "ufficio.tecnico@elettra.it",
        passwordHash: hash,
        nome: "Ufficio",
        cognome: "Tecnico",
        ruolo: "UFFICIO_TECNICO",
      },
    }),
    prisma.user.create({
      data: {
        email: "amministrazione@elettra.it",
        passwordHash: hash,
        nome: "Amministrazione",
        cognome: "Elettra",
        ruolo: "AMMINISTRAZIONE",
      },
    }),
  ]);

  const pmEsposito = await prisma.user.findUniqueOrThrow({
    where: { email: "tommaso.esposito@elettra.it" },
  });
  const pmFiorino = await prisma.user.findUniqueOrThrow({
    where: { email: "giuseppe.fiorino@elettra.it" },
  });

  /* ------------------------------ Anagrafiche ----------------------------- */

  const prysmian = await prisma.anagrafica.create({
    data: {
      ragioneSociale: "PRYSMIAN POWERLINK SRL",
      codiceCliente: "C0004",
      isCliente: true,
      partitaIva: "01988060990",
      localita: "Milano",
      provincia: "MI",
      email: "info@prysmian.com",
      modalitaPagamento: "B.B. 60 GG DF FM",
      referenti: {
        create: [
          {
            titolo: "ING",
            nome: "Andrea",
            cognome: "Tenani",
            email: "andrea.tenani@prysmian.com",
            ruoloAzienda: "Riferimento tecnico",
            principale: true,
          },
        ],
      },
    },
    include: { referenti: true },
  });

  const nappi = await prisma.anagrafica.create({
    data: {
      ragioneSociale: "NAPPI 1911 S.p.A.",
      codiceCliente: "C0069",
      isCliente: true,
      localita: "Napoli",
      provincia: "NA",
      modalitaPagamento: "RI.BA. 60 GG DF FM",
      referenti: {
        create: [
          {
            titolo: "SIG",
            nome: "Saverino",
            cognome: "Russo",
            email: "saverino.russo.ext@nappi.com",
            principale: true,
          },
        ],
      },
    },
    include: { referenti: true },
  });

  const sorari = await prisma.anagrafica.create({
    data: {
      ragioneSociale: "SO.RA.RI. Srl",
      codiceCliente: "C0821",
      isCliente: true,
      localita: "Caserta",
      provincia: "CE",
      referenti: {
        create: [
          {
            titolo: "DOTT",
            nome: "Luigi",
            cognome: "Giacometti",
            email: "amministrazione@sorarisrl.com",
            principale: true,
          },
        ],
      },
    },
    include: { referenti: true },
  });

  const bst = await prisma.anagrafica.create({
    data: {
      ragioneSociale: "BST S.p.A.",
      codiceCliente: "C0456",
      isCliente: true,
      referenti: {
        create: [
          {
            titolo: "ING",
            nome: "Fabrizio",
            cognome: "Santopietro",
            email: "fabrizio.santopietro.bst@eurooci.it",
            principale: true,
          },
        ],
      },
    },
    include: { referenti: true },
  });

  // Doppia natura: cliente E fornitore (due codici, stessa anagrafica).
  await prisma.anagrafica.create({
    data: {
      ragioneSociale: "FERRARELLE S.P.A.",
      codiceCliente: "C0063",
      codiceFornitore: "F0063",
      isCliente: true,
      isFornitore: true,
      localita: "Riardo",
      provincia: "CE",
      modalitaPagamento: "B.B. 60 GG DF FM",
      prodottiTrattati: "Materiale idrico / commerciale",
      referenti: {
        create: [
          {
            titolo: "GEOM",
            nome: "Angelo",
            cognome: "Ferrarelle",
            principale: true,
          },
        ],
      },
    },
  });

  // Fornitori
  const rebosio = await prisma.anagrafica.create({
    data: {
      ragioneSociale: "EB REBOSIO SRL",
      codiceFornitore: "F0153",
      isFornitore: true,
      cap: "25018",
      localita: "Montichiari",
      provincia: "BS",
      email: "chiara.alberti@gruppo-bonomi.com",
      modalitaPagamento: "RI.BA. 45 GG DF FM",
      prodottiTrattati: "Materiale elettrico",
      referenti: {
        create: [
          { titolo: "SIGRA", nome: "Irena", cognome: "Ballio", principale: true },
        ],
      },
    },
  });

  const sarel = await prisma.anagrafica.create({
    data: {
      ragioneSociale: "SAREL SRL",
      codiceFornitore: "F0156",
      isFornitore: true,
      cap: "26900",
      localita: "Lodi",
      provincia: "LO",
      email: "gabriele.farne@sarel.it",
      modalitaPagamento: "Ordine a vista fattura, saldo B.B. 60 GG DF FM",
      prodottiTrattati: "Materiale elettrico",
      referenti: {
        create: [
          { titolo: "SIG", nome: "Gabriele", cognome: "Farné", principale: true },
        ],
      },
    },
  });

  await prisma.anagrafica.create({
    data: {
      ragioneSociale: "DE FEUSCO S.r.l.",
      codiceFornitore: "F0168",
      isFornitore: true,
      localita: "Caianello",
      provincia: "CE",
      modalitaPagamento: "Contanti alla consegna",
      prodottiTrattati: "Ferramenta",
    },
  });

  /* ------------------------------- Commesse ------------------------------- */

  const commessaNappi = await prisma.commessa.create({
    data: {
      numero: "261041",
      anno: 2026,
      progressivo: 1041,
      clienteId: nappi.id,
      referenteId: nappi.referenti[0]?.id,
      pmId: pmEsposito.id,
      referenteCommerciale: "FG",
      stato: "ORDINE_CONFERMATO",
      tipologia: "C",
      descrizione: "Lavori Elettrici Febbraio 2026",
      dataInvio: new Date("2026-02-11"),
      importoOfferta: "3901.13",
      importoOrdine: "3901.13",
      dataOrdine: new Date("2026-03-03"),
      metodoRicezioneOrdine: "EMAIL",
      // Cantiere aperto e nei tempi (Fase 7).
      dataInizioLavori: new Date("2026-07-06"),
      scadenzaLavori: new Date("2026-09-12"),
      noteCantiere:
        "Accesso al cantiere solo la mattina; chiedere il badge alla portineria.",
    },
  });

  await prisma.commessa.create({
    data: {
      numero: "261045",
      anno: 2026,
      progressivo: 1045,
      clienteId: prysmian.id,
      referenteId: prysmian.referenti[0]?.id,
      pmId: pmEsposito.id,
      referenteCommerciale: "FG",
      stato: "INVIATA",
      tipologia: "P",
      descrizione: "RDO Heating System to LT TEST on Extruded Cables",
      dataInvio: new Date("2026-02-13"),
      importoOfferta: "297000",
    },
  });

  await prisma.commessa.create({
    data: {
      numero: "261053",
      anno: 2026,
      progressivo: 1053,
      clienteId: sorari.id,
      referenteId: sorari.referenti[0]?.id,
      pmId: pmFiorino.id,
      referenteCommerciale: "FG",
      stato: "IN_FOLLOWUP",
      tipologia: "P",
      descrizione: "Sostituzione n. 3 inverter da 27kW",
      dataInvio: new Date("2026-03-13"),
      importoOfferta: "15165.00",
    },
  });

  await prisma.commessa.create({
    data: {
      numero: "261070",
      anno: 2026,
      progressivo: 1070,
      clienteId: bst.id,
      referenteId: bst.referenti[0]?.id,
      pmId: pmFiorino.id,
      stato: "PREVENTIVO",
      tipologia: "P",
      descrizione: "Impianto di alimentazione elettrica per climatizzatore",
      importoOfferta: "697.00",
    },
  });

  // Cantiere in ritardo: scadenza superata e milestone scadute (Fase 7).
  const commessaRitardo = await prisma.commessa.create({
    data: {
      numero: "261082",
      anno: 2026,
      progressivo: 1082,
      clienteId: sorari.id,
      referenteId: sorari.referenti[0]?.id,
      pmId: pmFiorino.id,
      referenteCommerciale: "FG",
      stato: "IN_ESECUZIONE",
      tipologia: "C",
      descrizione: "Rifacimento quadri di distribuzione capannone B",
      dataInvio: new Date("2026-05-04"),
      importoOfferta: "48200.00",
      importoOrdine: "46800.00",
      dataOrdine: new Date("2026-05-22"),
      metodoRicezioneOrdine: "NUMERO_ORDINE",
      dataInizioLavori: new Date("2026-06-08"),
      scadenzaLavori: new Date("2026-07-28"),
      noteCantiere:
        "Fermo tre settimane per ritardo nella fornitura degli interruttori.",
    },
  });

  // Cantiere chiuso: tutte le milestone completate e commessa fatturata.
  const commessaChiusa = await prisma.commessa.create({
    data: {
      numero: "261012",
      anno: 2026,
      progressivo: 1012,
      clienteId: bst.id,
      referenteId: bst.referenti[0]?.id,
      pmId: pmEsposito.id,
      referenteCommerciale: "FG",
      stato: "FATTURATA",
      tipologia: "C",
      descrizione: "Manutenzione cabina MT e verifica differenziali",
      dataInvio: new Date("2026-03-16"),
      importoOfferta: "12400.00",
      importoOrdine: "12400.00",
      dataOrdine: new Date("2026-04-02"),
      metodoRicezioneOrdine: "CONTROFIRMA",
      dataInizioLavori: new Date("2026-04-07"),
      scadenzaLavori: new Date("2026-05-30"),
      dataFineLavori: new Date("2026-05-28"),
    },
  });

  /* ------------------------- Operai e squadre (Fase 7) ---------------------- */

  const operai = await Promise.all(
    [
      { nome: "Salvatore", cognome: "Improta", qualifica: "Capo squadra", squadra: "Squadra A", telefono: "334 1122334" },
      { nome: "Ciro", cognome: "Ferrara", qualifica: "Elettricista", squadra: "Squadra A", telefono: "339 2233445" },
      { nome: "Antonio", cognome: "Coppola", qualifica: "Elettricista", squadra: "Squadra A" },
      { nome: "Gennaro", cognome: "Ruggiero", qualifica: "Capo squadra", squadra: "Squadra B", telefono: "347 5566778" },
      { nome: "Pasquale", cognome: "Esposito", qualifica: "Aiutante", squadra: "Squadra B" },
      {
        nome: "Vincenzo",
        cognome: "Sannino",
        qualifica: "Manutentore",
        attivo: false,
        note: "In distacco su un altro cantiere fino a settembre.",
      },
    ].map((data) => prisma.operaio.create({ data })),
  );

  const [improta, ferrara, coppola, ruggiero, pasquale] = operai;

  /* --------------------------- Milestone di progetto ------------------------ */
  // L'avanzamento del progetto è derivato da queste righe (src/lib/progetti.ts):
  // 2/5 completate sul cantiere NAPPI, 1/3 su quello in ritardo, 4/4 sul chiuso.

  const milestone: {
    commessaId: string;
    titolo: string;
    ordine: number;
    stato: string;
    dataPianificata?: Date;
    dataEffettiva?: Date;
    note?: string;
  }[] = [
    // 261041 — in corso, nei tempi
    { commessaId: commessaNappi.id, titolo: "Rilievo in campo", ordine: 0, stato: "COMPLETATA", dataPianificata: new Date("2026-07-08"), dataEffettiva: new Date("2026-07-08") },
    { commessaId: commessaNappi.id, titolo: "Progetto esecutivo", ordine: 1, stato: "COMPLETATA", dataPianificata: new Date("2026-07-21"), dataEffettiva: new Date("2026-07-23") },
    { commessaId: commessaNappi.id, titolo: "Fornitura materiali", ordine: 2, stato: "IN_CORSO", dataPianificata: new Date("2026-08-12"), note: "Cavi già ordinati, mancano le canaline." },
    { commessaId: commessaNappi.id, titolo: "Montaggio e cablaggio", ordine: 3, stato: "DA_FARE", dataPianificata: new Date("2026-08-29") },
    { commessaId: commessaNappi.id, titolo: "Collaudo e consegna", ordine: 4, stato: "DA_FARE", dataPianificata: new Date("2026-09-10") },

    // 261082 — in ritardo
    { commessaId: commessaRitardo.id, titolo: "Smontaggio quadri esistenti", ordine: 0, stato: "COMPLETATA", dataPianificata: new Date("2026-06-12"), dataEffettiva: new Date("2026-06-13") },
    { commessaId: commessaRitardo.id, titolo: "Posa nuovi quadri", ordine: 1, stato: "IN_CORSO", dataPianificata: new Date("2026-07-10"), note: "In attesa degli interruttori dal fornitore." },
    { commessaId: commessaRitardo.id, titolo: "Verifiche e collaudo", ordine: 2, stato: "DA_FARE", dataPianificata: new Date("2026-07-25") },

    // 261012 — completato
    { commessaId: commessaChiusa.id, titolo: "Sopralluogo cabina", ordine: 0, stato: "COMPLETATA", dataPianificata: new Date("2026-04-10"), dataEffettiva: new Date("2026-04-09") },
    { commessaId: commessaChiusa.id, titolo: "Manutenzione trasformatore", ordine: 1, stato: "COMPLETATA", dataPianificata: new Date("2026-04-30"), dataEffettiva: new Date("2026-05-04") },
    { commessaId: commessaChiusa.id, titolo: "Verifica differenziali", ordine: 2, stato: "COMPLETATA", dataPianificata: new Date("2026-05-20"), dataEffettiva: new Date("2026-05-19") },
    { commessaId: commessaChiusa.id, titolo: "Rilascio dichiarazione di conformità", ordine: 3, stato: "COMPLETATA", dataPianificata: new Date("2026-05-28"), dataEffettiva: new Date("2026-05-28") },
  ];

  await Promise.all(milestone.map((data) => prisma.milestone.create({ data })));

  /* ------------------------- Squadre assegnate ai cantieri ------------------ */

  await Promise.all(
    [
      { commessaId: commessaNappi.id, operaioId: improta.id, ruoloCantiere: "CAPO_SQUADRA", dal: new Date("2026-07-06") },
      { commessaId: commessaNappi.id, operaioId: ferrara.id, ruoloCantiere: "ELETTRICISTA", dal: new Date("2026-07-06") },
      { commessaId: commessaNappi.id, operaioId: coppola.id, ruoloCantiere: "ELETTRICISTA", dal: new Date("2026-07-20") },
      { commessaId: commessaRitardo.id, operaioId: ruggiero.id, ruoloCantiere: "CAPO_SQUADRA", dal: new Date("2026-06-08") },
      { commessaId: commessaRitardo.id, operaioId: pasquale.id, ruoloCantiere: "AIUTANTE", dal: new Date("2026-06-08") },
      { commessaId: commessaChiusa.id, operaioId: improta.id, ruoloCantiere: "CAPO_SQUADRA", dal: new Date("2026-04-07"), al: new Date("2026-05-28") },
    ].map((data) => prisma.assegnazioneOperaio.create({ data })),
  );

  /* --------------------------- Ordini a fornitore -------------------------- */

  // Ordine collegato alla commessa NAPPI, merce in parte già entrata.
  await prisma.ordineFornitore.create({
    data: {
      numero: "ODA-2026-014",
      data: new Date("2026-03-05"),
      fornitoreId: rebosio.id,
      commessaId: commessaNappi.id,
      stato: "ENTRATA",
      righe: {
        create: [
          {
            codiceProdotto: "FG16OR16-3G2.5",
            descrizione: "Cavo FG16OR16 0,6/1kV 3G2,5 mmq",
            unitaMisura: "m",
            quantita: 200,
            prezzoUnitario: 1.85,
            sconto: 10,
            imponibile: 333,
            aliquotaIva: 22,
            dataConsegnaPrevista: new Date("2026-03-12"),
            quantitaRicevuta: 200,
            ddtNumero: "DDT/512",
            ddtData: new Date("2026-03-11"),
          },
          {
            codiceProdotto: "MT-4P25",
            descrizione: "Interruttore magnetotermico 4P 25A 6kA",
            unitaMisura: "pz",
            quantita: 6,
            prezzoUnitario: 48.5,
            imponibile: 291,
            aliquotaIva: 22,
            dataConsegnaPrevista: new Date("2026-03-20"),
          },
        ],
      },
    },
  });

  // Ordine appena emesso, senza entrata merce.
  await prisma.ordineFornitore.create({
    data: {
      numero: "ODA-2026-021",
      data: new Date("2026-03-18"),
      fornitoreId: rebosio.id,
      stato: "ORDINATO",
      righe: {
        create: [
          {
            descrizione: "Quadro elettrico da parete IP55 24 moduli",
            unitaMisura: "pz",
            quantita: 1,
            prezzoUnitario: 420,
            imponibile: 420,
            aliquotaIva: 22,
          },
        ],
      },
    },
  });

  // Ordine completamente ricevuto e fatturato.
  await prisma.ordineFornitore.create({
    data: {
      numero: "ODA-2026-009",
      data: new Date("2026-02-20"),
      fornitoreId: sarel.id,
      stato: "RICEVUTO",
      righe: {
        create: [
          {
            codiceProdotto: "CANALE-100",
            descrizione: "Canale portacavi asolato 100x75 mm",
            unitaMisura: "m",
            quantita: 48,
            prezzoUnitario: 6.2,
            sconto: 5,
            imponibile: 282.72,
            aliquotaIva: 22,
            dataConsegnaPrevista: new Date("2026-02-27"),
            quantitaRicevuta: 48,
            ddtNumero: "DDT/1188",
            ddtData: new Date("2026-02-26"),
            fatturaNumero: "FT/2026/337",
            fatturaData: new Date("2026-02-28"),
          },
        ],
      },
    },
  });

  // Riacquisti successivi degli stessi materiali (alimentano lo storico prezzi
  // interrogabile: stesso codice/descrizione, date e prezzi diversi).
  await prisma.ordineFornitore.create({
    data: {
      numero: "ODA-2026-034",
      data: new Date("2026-04-22"),
      fornitoreId: sarel.id,
      commessaId: commessaNappi.id,
      stato: "RICEVUTO",
      righe: {
        create: [
          {
            codiceProdotto: "FG16OR16-3G2.5",
            descrizione: "Cavo FG16OR16 0,6/1kV 3G2,5 mmq",
            unitaMisura: "m",
            quantita: 150,
            prezzoUnitario: 1.98,
            sconto: 8,
            imponibile: 273.24,
            aliquotaIva: 22,
          },
          {
            codiceProdotto: "CANALE-100",
            descrizione: "Canale portacavi asolato 100x75 mm",
            unitaMisura: "m",
            quantita: 60,
            prezzoUnitario: 5.95,
            sconto: 5,
            imponibile: 339.15,
            aliquotaIva: 22,
          },
        ],
      },
    },
  });

  await prisma.ordineFornitore.create({
    data: {
      numero: "ODA-2026-047",
      data: new Date("2026-06-10"),
      fornitoreId: rebosio.id,
      stato: "ORDINATO",
      righe: {
        create: [
          {
            codiceProdotto: "FG16OR16-3G2.5",
            descrizione: "Cavo FG16OR16 0,6/1kV 3G2,5 mmq",
            unitaMisura: "m",
            quantita: 300,
            prezzoUnitario: 2.1,
            sconto: 12,
            imponibile: 554.4,
            aliquotaIva: 22,
          },
        ],
      },
    },
  });

  const anagrafiche = await prisma.anagrafica.count();
  const utenti = await prisma.user.count();
  const commesse = await prisma.commessa.count();
  const ordini = await prisma.ordineFornitore.count();
  const nOperai = await prisma.operaio.count();
  const nMilestone = await prisma.milestone.count();
  console.log(
    `Seed completato: ${utenti} utenti, ${anagrafiche} anagrafiche, ${commesse} commesse, ${ordini} ordini, ${nOperai} operai, ${nMilestone} milestone.`,
  );
  // La password non va nei log: su Coolify l'output del container è consultabile.
  console.log(`Super Admin: ${fabio.email}  ·  password: quella in SEED_PASSWORD`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
