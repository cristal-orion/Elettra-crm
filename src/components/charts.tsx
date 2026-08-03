// Fase 5 — primitivi grafici senza dipendenze esterne (solo SVG/CSS + Tailwind).
// Renderizzabili lato server (nessun hook). Palette allineata a globals.css.

import { formatEuro } from "@/lib/format";
import type { PuntoMese } from "@/lib/statistiche";

/**
 * Istogramma a colonne per una serie mensile di importi.
 * Altezze in percentuale sul picco; le colonne a zero restano sull'asse.
 */
export function IstogrammaMensile({ punti }: { punti: PuntoMese[] }) {
  const max = Math.max(1, ...punti.map((p) => p.valore));
  const hasValori = punti.some((p) => p.valore > 0);

  if (!hasValori) {
    return (
      <p className="py-10 text-center text-sm text-ink-faint">
        Nessun ordine acquisito nel periodo.
      </p>
    );
  }

  return (
    <div>
      <div className="flex h-44 items-end gap-1 border-b border-line">
        {punti.map((p) => {
          const pct = p.valore > 0 ? Math.max(3, (p.valore / max) * 100) : 0;
          return (
            <div
              key={p.chiave}
              className="group relative flex-1"
              style={{ height: "100%" }}
            >
              <div className="flex h-full items-end">
                <div
                  className="w-full rounded-t bg-brand/80 transition group-hover:bg-brand"
                  style={{ height: `${pct}%` }}
                />
              </div>
              {/* tooltip */}
              <div className="pointer-events-none absolute -top-1 left-1/2 z-10 hidden -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md bg-slatepanel px-2 py-1 text-[11px] text-white shadow-lg group-hover:block">
                <span className="font-medium">{formatEuro(p.valore)}</span>
                <span className="ml-1.5 text-white/50">{p.estesa}</span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex gap-1">
        {punti.map((p) => (
          <span
            key={p.chiave}
            className="flex-1 text-center font-mono text-[10px] text-ink-faint"
          >
            {p.etichetta}
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * Barra impilata degli esiti commerciali (vinte / in attesa / perse),
 * con legenda e conteggi. Usata sia globalmente sia per singolo cliente.
 */
export function BarraEsito({
  vinte,
  attesa,
  perse,
}: {
  vinte: number;
  attesa: number;
  perse: number;
}) {
  const totale = vinte + attesa + perse;

  if (totale === 0) {
    return <p className="text-sm text-ink-faint">Nessuna commessa.</p>;
  }

  const segmenti = [
    { key: "vinte", n: vinte, colore: "bg-ok", label: "Vinte" },
    { key: "attesa", n: attesa, colore: "bg-warn", label: "In attesa" },
    { key: "perse", n: perse, colore: "bg-danger", label: "Perse" },
  ].filter((s) => s.n > 0);

  return (
    <div>
      <div className="flex h-3 overflow-hidden rounded-full bg-paper">
        {segmenti.map((s) => (
          <div
            key={s.key}
            className={s.colore}
            style={{ width: `${(s.n / totale) * 100}%` }}
            title={`${s.label}: ${s.n}`}
          />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs">
        <Legenda colore="bg-ok" label="Vinte" n={vinte} />
        <Legenda colore="bg-warn" label="In attesa" n={attesa} />
        <Legenda colore="bg-danger" label="Perse" n={perse} />
      </div>
    </div>
  );
}

/**
 * Barra di avanzamento di un progetto (Fase 7). La percentuale arriva già
 * derivata dalle milestone (src/lib/progetti.ts): qui si disegna soltanto.
 * `tono` distingue a colpo d'occhio ritardo/completato in lista.
 */
export function BarraAvanzamento({
  percentuale,
  tono = "brand",
  className = "",
}: {
  percentuale: number;
  tono?: "brand" | "ok" | "danger" | "neutro";
  className?: string;
}) {
  const pct = Math.min(100, Math.max(0, Math.round(percentuale)));
  const colore = {
    brand: "bg-brand",
    ok: "bg-ok",
    danger: "bg-danger",
    neutro: "bg-ink-faint/40",
  }[tono];

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <div
        className="h-2 min-w-16 flex-1 overflow-hidden rounded-full bg-paper"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={`h-full rounded-full ${colore} transition-[width]`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-9 shrink-0 text-right font-mono text-xs tabular-nums text-ink-soft">
        {pct}%
      </span>
    </div>
  );
}

function Legenda({
  colore,
  label,
  n,
}: {
  colore: string;
  label: string;
  n: number;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 text-ink-soft">
      <span className={`h-2.5 w-2.5 rounded-sm ${colore}`} />
      {label}
      <span className="font-mono tabular-nums font-medium text-ink">{n}</span>
    </span>
  );
}
