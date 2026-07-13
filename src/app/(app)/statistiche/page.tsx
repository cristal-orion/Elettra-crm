import Link from "next/link";
import { formatEuro } from "@/lib/format";
import { winRate } from "@/lib/statistiche";
import { BarraEsito, IstogrammaMensile } from "@/components/charts";
import { getStatisticheGlobali } from "./data";

export default async function StatistichePage() {
  const s = await getStatisticheGlobali(new Date());
  const conversione = winRate(s.vinte, s.perse);
  const picco = Math.max(0, ...s.serieAcquisito.map((p) => p.valore));

  return (
    <div className="flex flex-col gap-8">
      <header>
        <p className="font-mono text-xs uppercase tracking-[0.16em] text-brand-deep">
          Statistiche
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">
          Andamento commerciale
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          Conversione, valore acquisito e clienti principali sull&apos;intero
          portafoglio.
        </p>
      </header>

      {/* KPI */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Commesse totali" value={String(s.totali)}>
          <span className="text-ink-soft">{s.clientiConCommesse} clienti</span>
        </Stat>
        <Stat label="Tasso di conversione" value={`${conversione}%`} accent>
          <span className="text-ink-soft">
            {s.vinte} vinte · {s.perse} perse
          </span>
        </Stat>
        <Stat label="Valore acquisito" value={formatEuro(s.valoreAcquisito)}>
          <span className="text-ink-soft">ordini confermati</span>
        </Stat>
        <Stat label="In pipeline" value={formatEuro(s.valorePipeline)}>
          <span className="text-ink-soft">{s.attesa} offerte in attesa</span>
        </Stat>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Imbuto esiti */}
        <section className="rounded-xl border border-line bg-panel p-6">
          <h2 className="text-sm font-semibold">Esito delle commesse</h2>
          <p className="mt-0.5 text-xs text-ink-soft">
            Conversione = vinte / (vinte + perse). Le offerte in attesa non sono
            ancora decise.
          </p>
          <div className="mt-5">
            <BarraEsito vinte={s.vinte} attesa={s.attesa} perse={s.perse} />
          </div>
          <dl className="mt-6 grid grid-cols-3 gap-3 border-t border-line pt-5 text-center">
            <ValoreEsito label="Acquisito" value={s.valoreAcquisito} tono="ok" />
            <ValoreEsito
              label="In pipeline"
              value={s.valorePipeline}
              tono="warn"
            />
            <ValoreEsito label="Perso" value={s.valorePerso} tono="danger" />
          </dl>
        </section>

        {/* Andamento acquisito */}
        <section className="rounded-xl border border-line bg-panel p-6">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-sm font-semibold">Ordini acquisiti (12 mesi)</h2>
            {picco > 0 && (
              <span className="font-mono text-[11px] text-ink-faint">
                picco {formatEuro(picco)}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-ink-soft">
            Valore degli ordini confermati per mese.
          </p>
          <div className="mt-5">
            <IstogrammaMensile punti={s.serieAcquisito} />
          </div>
        </section>
      </div>

      {/* Top clienti */}
      <section className="rounded-xl border border-line bg-panel">
        <div className="border-b border-line px-6 py-4">
          <h2 className="text-sm font-semibold">Clienti principali</h2>
          <p className="mt-0.5 text-xs text-ink-soft">
            Per valore acquisito, con conversione per numero di commesse.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left font-mono text-[11px] uppercase tracking-wider text-ink-faint">
                <th className="px-6 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 text-right font-medium">Offerte</th>
                <th className="px-4 py-3 text-right font-medium">Vinte</th>
                <th className="px-4 py-3 text-right font-medium">Conv.</th>
                <th className="px-6 py-3 text-right font-medium">Acquisito</th>
              </tr>
            </thead>
            <tbody>
              {s.topClienti.map((c) => (
                <tr key={c.id} className="border-t border-line hover:bg-paper/50">
                  <td className="px-6 py-3">
                    <Link
                      href={`/anagrafiche/${c.id}`}
                      className="font-medium hover:text-brand-deep"
                    >
                      {c.ragioneSociale}
                    </Link>
                    {c.codiceCliente && (
                      <span className="ml-2 font-mono text-[11px] text-ink-faint">
                        {c.codiceCliente}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-ink-soft">
                    {c.offerte}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-ink-soft">
                    {c.vinte}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium">
                    {winRate(c.vinte, c.perse)}%
                  </td>
                  <td className="px-6 py-3 text-right tabular-nums font-medium">
                    {formatEuro(c.valoreAcquisito)}
                  </td>
                </tr>
              ))}
              {s.topClienti.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-6 text-center text-ink-faint">
                    Nessuna commessa registrata.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
  children,
}: {
  label: string;
  value: string;
  accent?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-xl border p-5 ${
        accent ? "border-brand/30 bg-brand-soft/40" : "border-line bg-panel"
      }`}
    >
      <p className="font-mono text-[11px] uppercase tracking-wider text-ink-faint">
        {label}
      </p>
      <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight">
        {value}
      </p>
      <p className="mt-1 text-xs">{children}</p>
    </div>
  );
}

function ValoreEsito({
  label,
  value,
  tono,
}: {
  label: string;
  value: number;
  tono: "ok" | "warn" | "danger";
}) {
  const colore =
    tono === "ok" ? "text-ok" : tono === "warn" ? "text-warn" : "text-danger";
  return (
    <div>
      <dt className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
        {label}
      </dt>
      <dd className={`mt-1 text-sm font-semibold tabular-nums ${colore}`}>
        {formatEuro(value)}
      </dd>
    </div>
  );
}
