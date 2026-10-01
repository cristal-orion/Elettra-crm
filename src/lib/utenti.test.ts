import assert from "node:assert/strict";
import test, { before, after } from "node:test";
import { PrismaClient } from "@/generated/prisma";
import { testDatabase } from "../../scripts/test-database";
import { eliminaUtente } from "./utenti";

let database: ReturnType<typeof testDatabase>;
let db: PrismaClient;

before(async () => {
  database = testDatabase();
  db = new PrismaClient({ datasourceUrl: database.url });
  for (const [id, ruolo, attivo] of [
    ["admin", "SUPER_ADMIN", true],
    ["altro-admin", "SUPER_ADMIN", true],
    ["pm", "PROJECT_MANAGER", true],
    ["lettore", "AMMINISTRAZIONE", true],
    ["disattivato", "SUPER_ADMIN", false],
    ["uscente", "PROJECT_MANAGER", true],
    ["senza-dati", "BACKOFFICE", false],
  ] as const) {
    await db.user.create({ data: { id, ruolo, attivo, nome: id, cognome: "Test", email: `${id}@example.test`, passwordHash: "test-only" } });
  }
  await db.anagrafica.create({ data: { id: "cliente", ragioneSociale: "Cliente test", isCliente: true } });
  await db.commessa.create({ data: { id: "commessa", numero: "261001", anno: 2026, progressivo: 1001, clienteId: "cliente", pmId: "uscente", stato: "IN_ESECUZIONE", importoOrdine: 1234.56 } });
  await db.documento.create({ data: { id: "documento", commessaId: "commessa", nomeFile: "test.txt", percorso: "261001/test.txt" } });
  await db.milestone.create({ data: { id: "milestone", commessaId: "commessa", titolo: "Consegna", ordine: 0 } });
  await db.attivita.create({ data: { id: "attivita", userId: "uscente", titolo: "Follow-up", commessaId: "commessa", stato: "DA_FARE" } });
  await db.attivita.create({ data: { id: "attivita-conclusa", userId: "uscente", titolo: "Sopralluogo", stato: "COMPLETATA" } });
  await db.segnalazione.create({ data: { id: "segnalazione", autoreId: "uscente", titolo: "Problema", descrizione: "Descrizione originale", stato: "CONCLUSA", risoluzione: "Risolto" } });
  await db.allegatoSegnalazione.create({ data: { id: "allegato", segnalazioneId: "segnalazione", nomeFile: "screen.png", percorso: "segnalazioni/segnalazione/screen.png" } });
});

after(async () => {
  if (db && database) await database.cleanup(db);
});

const conferma = { emailConferma: "uscente@example.test", subentranteId: "pm" };

test("eliminazione: autorizzazione verificata sul ruolo e stato attuali", async () => {
  for (const actor of ["pm", "lettore", "disattivato", "inesistente"]) {
    await assert.rejects(eliminaUtente(actor, "uscente", conferma, db), /permessi/);
  }
  await db.user.update({ where: { id: "altro-admin" }, data: { ruolo: "BACKOFFICE" } });
  await assert.rejects(eliminaUtente("altro-admin", "uscente", conferma, db), /permessi/);
  await db.user.update({ where: { id: "altro-admin" }, data: { ruolo: "SUPER_ADMIN" } });
  assert.ok(await db.user.findUnique({ where: { id: "uscente" } }));
});

test("eliminazione: proprio account protetto e conferma email obbligatoria", async () => {
  await assert.rejects(eliminaUtente("admin", "admin", { emailConferma: "admin@example.test", subentranteId: "" }, db), /stesso account/);
  await assert.rejects(eliminaUtente("admin", "uscente", { ...conferma, emailConferma: "altra@example.test" }, db), /confermare/);
  await assert.rejects(eliminaUtente("admin", "inesistente", conferma, db), /non trovato/);
  assert.equal(await db.user.count({ where: { ruolo: "SUPER_ADMIN", attivo: true } }), 2);
});

test("eliminazione: dati collegati richiedono un subentrante valido, per le commesse deve essere PM", async () => {
  for (const subentranteId of ["", "uscente", "inesistente", "disattivato"]) {
    await assert.rejects(eliminaUtente("admin", "uscente", { ...conferma, subentranteId }, db), /altro utente attivo/);
  }
  await assert.rejects(eliminaUtente("admin", "uscente", { ...conferma, subentranteId: "lettore" }, db), /Project Manager/);
  assert.equal((await db.commessa.findUniqueOrThrow({ where: { id: "commessa" } })).pmId, "uscente");
  assert.equal((await db.attivita.findUniqueOrThrow({ where: { id: "attivita" } })).userId, "uscente");
  assert.equal((await db.segnalazione.findUniqueOrThrow({ where: { id: "segnalazione" } })).descrizione, "Descrizione originale");
});

test("eliminazione: trasferimento conserva storico, commesse, attività concluse e allegati", async () => {
  await db.aiConversation.create({ data: { id: "chat", userId: "uscente", title: "Privata", messages: { create: { id: "messaggio", payload: { text: "Ciao" } } } } });
  await db.aiOperation.create({ data: { id: "operazione", userId: "uscente", conversationId: "chat", requestKey: "request-test", command: {}, preview: {}, expiresAt: new Date() } });
  await db.aiSchedule.create({ data: { id: "automazione-personale", userId: "uscente", name: "Personale", recipientIds: ["uscente"] } });
  await db.aiSchedule.create({ data: { id: "automazione-team", userId: "admin", name: "Team", recipientIds: ["uscente", "pm"] } });
  await db.notifica.create({ data: { id: "notifica", userId: "uscente", titolo: "Test", testo: "Test", href: "/" } });

  await eliminaUtente("admin", "uscente", { ...conferma, emailConferma: " USCENTE@example.test " }, db);

  assert.equal(await db.user.findUnique({ where: { id: "uscente" } }), null);
  const commessa = await db.commessa.findUniqueOrThrow({ where: { id: "commessa" } });
  assert.equal(commessa.pmId, "pm");
  assert.equal(commessa.stato, "IN_ESECUZIONE");
  assert.equal(commessa.importoOrdine?.toString(), "1234.56");
  assert.equal(await db.documento.count(), 1);
  assert.equal(await db.milestone.count(), 1);
  assert.equal(await db.attivita.count({ where: { userId: "pm" } }), 2);
  assert.equal((await db.attivita.findUniqueOrThrow({ where: { id: "attivita-conclusa" } })).stato, "COMPLETATA");
  const segnalazione = await db.segnalazione.findUniqueOrThrow({ where: { id: "segnalazione" } });
  assert.equal(segnalazione.autoreId, "pm");
  assert.ok(segnalazione.descrizione.startsWith("Descrizione originale"));
  assert.match(segnalazione.descrizione, /uscente Test \(uscente@example.test\)/);
  assert.equal(segnalazione.risoluzione, "Risolto");
  assert.equal(segnalazione.stato, "CONCLUSA");
  assert.equal(await db.allegatoSegnalazione.count(), 1);
  assert.equal(await db.aiConversation.count({ where: { userId: "uscente" } }), 0);
  assert.equal(await db.aiMessage.count(), 0);
  assert.equal(await db.aiOperation.count({ where: { userId: "uscente" } }), 0);
  assert.equal(await db.aiSchedule.findUnique({ where: { id: "automazione-personale" } }), null);
  assert.equal(await db.notifica.count({ where: { userId: "uscente" } }), 0);
  assert.deepEqual((await db.aiSchedule.findUniqueOrThrow({ where: { id: "automazione-team" } })).recipientIds, ["pm"]);
});

test("eliminazione: account senza dati eliminabile senza trasferimento", async () => {
  await eliminaUtente("admin", "senza-dati", { emailConferma: "senza-dati@example.test", subentranteId: "" }, db);
  assert.equal(await db.user.findUnique({ where: { id: "senza-dati" } }), null);
});

test("eliminazione: attività e segnalazioni senza commesse trasferibili anche a un altro ruolo", async () => {
  await db.user.create({ data: { id: "backoffice", nome: "Anna", cognome: "Test", email: "backoffice@example.test", ruolo: "BACKOFFICE", passwordHash: "test-only" } });
  await db.attivita.create({ data: { id: "attivita-backoffice", userId: "backoffice", titolo: "Controllo" } });
  await eliminaUtente("admin", "backoffice", { emailConferma: "backoffice@example.test", subentranteId: "lettore" }, db);
  assert.equal((await db.attivita.findUniqueOrThrow({ where: { id: "attivita-backoffice" } })).userId, "lettore");
});

test("eliminazione di un altro Super Admin lascia un amministratore attivo", async () => {
  await eliminaUtente("admin", "altro-admin", { emailConferma: "altro-admin@example.test", subentranteId: "" }, db);
  assert.equal(await db.user.count({ where: { ruolo: "SUPER_ADMIN", attivo: true } }), 1);
  await assert.rejects(eliminaUtente("admin", "admin", { emailConferma: "admin@example.test", subentranteId: "" }, db), /stesso account/);
});
