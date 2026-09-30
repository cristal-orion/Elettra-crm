/**
 * Imposta la stessa password su tutti gli utenti attivi.
 *
 *   npm run auth:password -- '<password>'     # esplicita
 *   npm run auth:password                     # usa SEED_PASSWORD dal .env
 *
 * Serve a ruotare la password dopo un import o dopo aver condiviso quella
 * iniziale. Tocca **solo gli utenti attivi**: i project manager storici creati
 * dall'import restano disattivati e senza password utilizzabile, che è il loro
 * scopo.
 *
 * La password non va scritta nel repository: passala come argomento oppure
 * tienila in `.env` (che è gitignorato).
 */

import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";
import { passwordError } from "../src/lib/password";

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("Password collettive disabilitate in produzione: usare Gestione utenti.");
  const daArgomento = process.argv.slice(2).find((a) => !a.startsWith("--"));
  const password = daArgomento ?? process.env.SEED_PASSWORD;

  if (!password) {
    console.error(
      "Password mancante.\n" +
        "  npm run auth:password -- '<password>'\n" +
        "  oppure imposta SEED_PASSWORD nel file .env",
    );
    process.exit(1);
  }
  const error = passwordError(password);
  if (error) throw new Error(error);

  const attivi = await prisma.user.findMany({
    where: { attivo: true },
    select: { id: true, email: true, ruolo: true },
    orderBy: { email: "asc" },
  });

  if (attivi.length === 0) {
    console.log("Nessun utente attivo: niente da fare.");
    return;
  }

  const hash = bcrypt.hashSync(password, 12);
  await prisma.user.updateMany({
    where: { id: { in: attivi.map((u) => u.id) } },
    data: { passwordHash: hash, sessionVersion: { increment: 1 } },
  });

  const disattivati = await prisma.user.count({ where: { attivo: false } });

  console.log(`\n▸ Password aggiornata su ${attivi.length} utenti attivi:\n`);
  for (const u of attivi) console.log(`  ${u.email.padEnd(32)} ${u.ruolo}`);
  if (disattivati > 0) {
    console.log(
      `\n  ${disattivati} utenti disattivati non sono stati toccati (restano senza accesso).`,
    );
  }
  console.log();
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error("\nInterrotto:", e instanceof Error ? e.message : e);
    await prisma.$disconnect();
    process.exit(1);
  });
