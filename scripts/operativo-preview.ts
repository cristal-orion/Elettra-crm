/** Anteprima locale su schema temporaneo: nessun dato o account di produzione. */
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createServer, request } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { SignJWT } from "jose";
import { PrismaClient } from "../src/generated/prisma";
import { testDatabase } from "./test-database";
import { createProblema } from "../src/lib/cantiere";
import { randomUUID } from "node:crypto";

async function main() {
  const database = testDatabase();
  const db = new PrismaClient({ datasourceUrl: database.url });
  const uploads = await mkdtemp("/tmp/opencode/elettra-preview-");
  const secret = randomBytes(48).toString("hex");
  const admin = await db.user.create({ data: { id: "preview-admin", email: "direzione@example.test", passwordHash: "unused", nome: "Direzione", cognome: "Elettra", ruolo: "SUPER_ADMIN", guidaVista: "*" } });
  await db.user.create({ data: { id: "preview-pm", email: "pm@example.test", passwordHash: "unused", nome: "Marco", cognome: "Rinaldi", ruolo: "PROJECT_MANAGER", guidaVista: "*" } });
  await db.anagrafica.create({ data: { id: "preview-cliente", ragioneSociale: "Officina Nord · collaudo", isCliente: true } });
  await db.commessa.create({ data: { id: "preview-cantiere", clienteId: "preview-cliente", pmId: "preview-pm", numero: "269001", anno: 2026, progressivo: 9001,
    stato: "IN_ESECUZIONE", descrizione: "Impianto elettrico officina", indirizzoCantiere: "Località Pian del Bosco · Belluno", importoOrdine: 18500, scadenzaLavori: new Date("2026-11-15"),
    milestone: { create: [{ titolo: "Rilievo e tracciamento", ordine: 0, durataGiorni: 1, stato: "COMPLETATA" }, { titolo: "Posa canaline", ordine: 1, durataGiorni: 60, stato: "IN_CORSO" }, { titolo: "Cablaggio quadro", ordine: 2, durataGiorni: 20 }, { titolo: "Collaudo impianto", ordine: 3, durataGiorni: 2 }] } } });
  await db.squadra.create({ data: { id: "preview-squadra", nome: "Installazioni" } });
  await db.squadra.create({ data: { id: "preview-manutenzione", nome: "Manutenzione" } });
  await db.commessa.create({ data: { id: "preview-altro", clienteId: "preview-cliente", numero: "269002", anno: 2026, progressivo: 9002, stato: "IN_ESECUZIONE", descrizione: "Manutenzione impianti" } });
  await db.operaio.create({ data: { nome: "Luca", cognome: "Marini", qualifica: "Elettricista", squadre: { connect: [{ id: "preview-squadra" }, { id: "preview-manutenzione" }] }, assegnazioni: { create: [{ commessaId: "preview-cantiere" }, { commessaId: "preview-altro" }] } } });
  await db.operaio.create({ data: { nome: "Giulia", cognome: "Ferri", qualifica: "Caposquadra", squadre: { connect: { id: "preview-squadra" } } } });
  await db.operaio.create({ data: { nome: "Paolo", cognome: "Bassi", qualifica: "Elettricista" } });
  await db.attivita.create({ data: { titolo: "Confermare accesso al cantiere", userId: admin.id, commessaId: "preview-cantiere", scadenza: new Date() } });
  const problema = await db.$transaction((tx) => createProblema(tx, "preview-pm", "preview-cantiere", { richiestaId: randomUUID(), titolo: "Interruttore del quadro da consegnare", descrizione: "La posa è pronta. Attendiamo il componente per completare il cablaggio e programmare il collaudo.", priorita: "ALTA", assegnatarioId: admin.id, scadenza: new Date().toISOString().slice(0, 10), creaAttivita: true }));
  console.log(`Problema anteprima: /problemi/${problema.id}`);
  const token = await new SignJWT({ userId: admin.id, ruolo: admin.ruolo, nome: admin.nome, sessionVersion: 0 }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("8h").sign(new TextEncoder().encode(secret));
  const production = process.env.PREVIEW_PRODUCTION === "1";
  const port = Number(process.env.PREVIEW_PORT ?? 3217);
  const proxyPort = port + 1;
  const app = spawn(process.execPath, ["node_modules/next/dist/bin/next", ...(production ? ["start"] : ["dev", "--webpack"]), "--hostname", "127.0.0.1", "--port", String(port)], {
    env: { ...process.env, NODE_ENV: production ? "production" : "development", DATABASE_URL: database.url, SESSION_SECRET: secret, DATA_ENCRYPTION_SECRET: randomBytes(48).toString("hex"), APP_ORIGIN: `http://127.0.0.1:${port}`, GEMINI_API_KEY: "", UPLOADS_DIR: uploads }, stdio: "inherit",
  });
  // Il proxy autenticato ascolta esclusivamente su loopback, sul DB isolato sopra.
  const proxy = createServer((req, res) => {
    const upstream = request({ hostname: "127.0.0.1", port, path: req.url, method: req.method,
      headers: { ...req.headers, host: `127.0.0.1:${port}`, origin: `http://127.0.0.1:${port}`, cookie: `elettra_session=${token}` } }, (reply) => {
      res.writeHead(reply.statusCode ?? 502, reply.headers); reply.pipe(res);
    });
    upstream.on("error", () => { res.writeHead(503); res.end("Anteprima in avvio"); }); req.pipe(upstream);
  }).listen(proxyPort, "127.0.0.1", () => console.log(`Anteprima isolata: http://127.0.0.1:${proxyPort}/progetti/preview-cantiere`));
  const close = async () => { proxy.close(); app.kill("SIGTERM"); await database.cleanup(db); await rm(uploads, { recursive: true, force: true }); process.exit(0); };
  process.once("SIGINT", close); process.once("SIGTERM", close);
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
