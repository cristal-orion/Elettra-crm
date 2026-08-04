/**
 * Import da riga di comando degli elenchi Excel di Elettra.
 *
 *   npm run db:import -- <anagrafiche.xls> <offerte.xls> [--pulisci] [--prova]
 *
 * --pulisci  svuota anagrafiche e commesse prima di importare (consigliato al
 *            primo giro, per non mescolare i dati demo del seed)
 * --prova    analizza e riporta senza scrivere nulla
 *
 * La logica sta in `src/lib/import-excel.ts`, condivisa con la pagina
 * `/impostazioni/import`: da lì i file si caricano in drag & drop, senza farli
 * passare da GitHub né dal filesystem del server.
 */

import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { importaExcel, type EsitoImport } from "../src/lib/import-excel";
import { prisma } from "../src/lib/prisma";

function stampa(e: EsitoImport) {
  const a = e.anagrafiche;
  const c = e.commesse;

  console.log(
    `\n▸ Righe lette: ${e.righeLette.anagrafiche} anagrafiche, ${e.righeLette.offerte} offerte`,
  );

  console.log(`\n▸ Anagrafiche${e.prova ? " (prova)" : ""}`);
  console.log(`  aziende            ${a.aziende}`);
  console.log(`  di cui clienti     ${a.clienti}`);
  console.log(`  di cui fornitori   ${a.fornitori}`);
  console.log(`  sia C sia F        ${a.entrambi}`);
  console.log(`  referenti          ${a.referenti}`);
  console.log(`  destinazioni       ${a.destinazioni}`);

  console.log(`\n▸ Commesse${e.prova ? " (prova)" : ""}`);
  console.log(`  importate          ${c.importate}`);
  console.log(`  di cui interne     ${c.interne}`);
  console.log(`  numeri pre-allocati saltati  ${c.preallocate}`);
  console.log(`  nuovi referenti    ${c.referentiNuovi}`);
  console.log(`  per stato:      ${JSON.stringify(c.perStato)}`);
  console.log(`  per tipologia:  ${JSON.stringify(c.perTipologia)}`);

  if (e.pmCreati.length) {
    console.log(`\n  PM creati disattivati (${e.pmCreati.length}):`);
    for (const p of e.pmCreati) console.log(`    · ${p}`);
  }

  const eur = (n: number) =>
    n.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  console.log(`\n▸ Somme di controllo (confrontale con i totali nel foglio)`);
  console.log(`  importi offerta    € ${eur(e.totali.offerte)}`);
  console.log(`  importi ordine     € ${eur(e.totali.ordini)}`);

  for (const a of e.avvisi) console.log(`\n  ⚠ ${a}`);
}

async function main() {
  const argv = process.argv.slice(2);
  const files = argv.filter((a) => !a.startsWith("--"));
  if (files.length < 2) {
    console.error(
      "Uso: npm run db:import -- <anagrafiche.xls> <offerte.xls> [--pulisci] [--prova]",
    );
    process.exit(1);
  }

  const [fileAnag, fileOff] = files;
  console.log(`▸ Lettura ${basename(fileAnag)} e ${basename(fileOff)}`);

  const esito = await importaExcel({
    anagrafiche: readFileSync(fileAnag),
    offerte: readFileSync(fileOff),
    pulisci: argv.includes("--pulisci"),
    prova: argv.includes("--prova"),
  });

  stampa(esito);
  console.log(
    esito.prova
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
