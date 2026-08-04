import Link from "next/link";
import { requireRuolo } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { ImportForm } from "./import-ui";
import { eseguiImport } from "./actions";

export const metadata = { title: "Import dati — CRM Elettra" };

export default async function ImportPage() {
  await requireRuolo(["SUPER_ADMIN"]);

  const [anagrafiche, commesse, destinazioni] = await Promise.all([
    prisma.anagrafica.count(),
    prisma.commessa.count(),
    prisma.destinazione.count(),
  ]);

  return (
    <div className="flex flex-col gap-7">
      <header>
        <Link
          href="/impostazioni"
          className="font-mono text-xs uppercase tracking-wider text-ink-faint hover:text-brand-deep"
        >
          ← Impostazioni
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          Import dati da Excel
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-soft">
          Carica i due elenchi storici di Elettra. I file restano su questo
          server: non passano da GitHub e non vengono conservati dopo
          l&apos;elaborazione.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <Contatore label="Anagrafiche" valore={anagrafiche} />
        <Contatore label="Commesse" valore={commesse} />
        <Contatore label="Destinazioni" valore={destinazioni} />
      </div>

      <section className="rounded-xl border border-line bg-panel p-6">
        <ImportForm action={eseguiImport} />
      </section>

      <section className="rounded-xl border border-line bg-panel p-6">
        <h2 className="text-sm font-semibold">Come vengono interpretati i file</h2>
        <ul className="mt-3 flex list-disc flex-col gap-2 pl-4 text-sm text-ink-soft">
          <li>
            I codici <span className="font-mono">F0042</span>,{" "}
            <span className="font-mono">C0042</span> e{" "}
            <span className="font-mono">D0042</span> sono la{" "}
            <strong>stessa azienda</strong>: diventano una sola anagrafica con
            entrambi i codici, non tre record distinti.
          </li>
          <li>
            Le righe <span className="font-mono">D####</span> diventano{" "}
            <strong>destinazioni</strong> (sedi di consegna e cantiere), non
            anagrafiche a sé.
          </li>
          <li>
            Le commesse senza stato né importi né date sono lavori aperti
            direttamente a consuntivo: entrano in stato{" "}
            <strong>Consuntivo</strong>.
          </li>
          <li>
            I numeri di commessa riservati per il futuro, quelli con solo numero
            e cliente, vengono <strong>saltati</strong>.
          </li>
          <li>
            Le commesse <strong>interne</strong> sono quelle intestate a ELETTRA
            S.r.l. (<span className="font-mono">C0000</span>).
          </li>
          <li>
            L&apos;import è <strong>ripetibile</strong>: rilanciarlo aggiorna i
            record esistenti invece di duplicarli.
          </li>
        </ul>
      </section>
    </div>
  );
}

function Contatore({ label, valore }: { label: string; valore: number }) {
  return (
    <div className="rounded-xl border border-line bg-panel p-5">
      <p className="font-mono text-[11px] uppercase tracking-wider text-ink-faint">
        {label} in archivio
      </p>
      <p className="mt-1 text-2xl font-bold tabular-nums">
        {valore.toLocaleString("it-IT")}
      </p>
    </div>
  );
}
