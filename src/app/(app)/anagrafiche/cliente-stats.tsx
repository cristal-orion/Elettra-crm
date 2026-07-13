import Link from "next/link";
import { formatEuro, toNumber } from "@/lib/format";
import type { Prisma } from "@/generated/prisma";
import {
  classificaEsito,
  giorniDa,
  serieMensile,
  winRate,
  STATI_PENDING,
} from "@/lib/statistiche";
import { BarraEsito, IstogrammaMensile } from "@/components/charts";

/** Campi di commessa necessari alla sintesi cliente-centrica (§7 del flusso). */
type CommessaStat = {
  id: string;
  numero: string;
  stato: string;
  importoOfferta: Prisma.Decimal | null;
  importoOrdine: Prisma.Decimal | null;
  dataInvio: Date | null;
  dataOrdine: Date | null;
  createdAt: Date;
};

/**
 * Sintesi commerciale di un singolo cliente: conversione, valore, offerte in
 * attesa (con giorni trascorsi) e andamento acquisito. Componente server.
 */
export default function ClienteStats({
  commesse,
  adesso,
}: {
  commesse: CommessaStat[];
  adesso: Date;
}) {
  let vinte = 0;
  let attesa = 0;
  let perse = 0;
  let valoreOfferto = 0;
  let valoreAcquisito = 0;
  let valorePipeline = 0;

  const puntiAcquisito: { data: Date | null; importo: number }[] = [];
  const inAttesa: { id: string; numero: string; giorni: number; importo: number }[] =
    [];

  for (const c of commesse) {
    const esito = classificaEsito(c.stato);
    const offerta = toNumber(c.importoOfferta);
    const ordine = toNumber(c.importoOrdine);
    valoreOfferto += offerta;

    if (esito === "VINTA") {
      vinte++;
      valoreAcquisito += ordine;
      puntiAcquisito.push({
        data: c.dataOrdine ?? c.dataInvio ?? c.createdAt,
        importo: ordine,
      });
    } else if (esito === "PERSA") {
      perse++;
    } else {
      attesa++;
      valorePipeline += offerta;
      if (STATI_PENDING.has(c.stato)) {
        inAttesa.push({
          id: c.id,
          numero: c.numero,
          giorni: giorniDa(c.dataInvio ?? c.createdAt, adesso),
          importo: offerta,
        });
      }
    }
  }

  // le offerte più "vecchie" (più giorni d'attesa) in cima: da sollecitare
  inAttesa.sort((a, b) => b.giorni - a.giorni);

  const conversione = winRate(vinte, perse);
  const serie = serieMensile(puntiAcquisito, adesso, 12);
  const haAcquisito = serie.some((p) => p.valore > 0);

  return (
    <section className="rounded-xl border border-line bg-panel p-6">
      <h2 className="text-sm font-semibold">Sintesi commerciale</h2>

      {/* Tiles */}
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Conversione" value={`${conversione}%`} accent>
          {vinte} vinte · {perse} perse
        </Tile>
        <Tile label="Acquisito" value={formatEuro(valoreAcquisito)}>
          ordini confermati
        </Tile>
        <Tile label="Offerto" value={formatEuro(valoreOfferto)}>
          {commesse.length} commesse
        </Tile>
        <Tile label="In pipeline" value={formatEuro(valorePipeline)}>
          {attesa} in attesa
        </Tile>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        {/* Esito + attesa */}
        <div>
          <BarraEsito vinte={vinte} attesa={attesa} perse={perse} />

          {inAttesa.length > 0 && (
            <div className="mt-5">
              <p className="font-mono text-[11px] uppercase tracking-wider text-ink-faint">
                Offerte in attesa di risposta
              </p>
              <ul className="mt-2 flex flex-col divide-y divide-line">
                {inAttesa.slice(0, 5).map((o) => (
                  <li key={o.id} className="py-2 first:pt-0">
                    <Link
                      href={`/commesse/${o.id}`}
                      className="flex items-center gap-3 text-sm hover:text-brand-deep"
                    >
                      <span className="font-mono tabular-nums font-medium">
                        {o.numero}
                      </span>
                      <span className="flex-1 text-right tabular-nums text-ink-soft">
                        {formatEuro(o.importo)}
                      </span>
                      <span
                        className={`w-24 text-right font-mono text-xs ${
                          o.giorni >= 30 ? "font-semibold text-warn" : "text-ink-faint"
                        }`}
                      >
                        {o.giorni} gg
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Andamento acquisito */}
        <div>
          <p className="font-mono text-[11px] uppercase tracking-wider text-ink-faint">
            Acquisito (12 mesi)
          </p>
          <div className="mt-3">
            {haAcquisito ? (
              <IstogrammaMensile punti={serie} />
            ) : (
              <p className="py-10 text-center text-sm text-ink-faint">
                Nessun ordine acquisito nel periodo.
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function Tile({
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
      className={`rounded-lg border p-4 ${
        accent ? "border-brand/30 bg-brand-soft/40" : "border-line bg-paper/40"
      }`}
    >
      <p className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
        {label}
      </p>
      <p className="mt-1.5 text-xl font-bold tabular-nums tracking-tight">
        {value}
      </p>
      <p className="mt-0.5 text-[11px] text-ink-soft">{children}</p>
    </div>
  );
}
