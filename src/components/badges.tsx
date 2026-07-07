import { etichettaStato, etichettaStatoOrdine, TIPOLOGIE } from "@/lib/enums";

const statoStyle: Record<string, string> = {
  LEAD: "bg-lead-soft text-ink-soft",
  PREVENTIVO: "bg-warn-soft text-warn",
  INVIATA: "bg-warn-soft text-warn",
  IN_FOLLOWUP: "bg-warn-soft text-warn",
  ORDINE_CONFERMATO: "bg-ok-soft text-ok",
  IN_ESECUZIONE: "bg-ok-soft text-ok",
  CONSUNTIVO: "bg-ok-soft text-ok",
  FATTURATA: "bg-ok-soft text-ok",
  PERSA: "bg-danger-soft text-danger",
};

const pill =
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium whitespace-nowrap";

export function StatoBadge({ stato }: { stato: string }) {
  return (
    <span className={`${pill} ${statoStyle[stato] ?? "bg-lead-soft text-ink-soft"}`}>
      {etichettaStato(stato)}
    </span>
  );
}

const statoOrdineStyle: Record<string, string> = {
  ORDINATO: "bg-warn-soft text-warn",
  ENTRATA: "bg-brand-soft text-brand-deep",
  RICEVUTO: "bg-ok-soft text-ok",
};

export function StatoOrdineBadge({ stato }: { stato: string }) {
  return (
    <span
      className={`${pill} ${statoOrdineStyle[stato] ?? "bg-lead-soft text-ink-soft"}`}
    >
      {etichettaStatoOrdine(stato)}
    </span>
  );
}

export function TipologiaBadge({ tipologia }: { tipologia: string | null }) {
  if (!tipologia) return <span className="text-ink-faint">—</span>;
  const isP = tipologia === "P";
  return (
    <span
      className={`${pill} font-mono ${isP ? "bg-warn-soft text-warn" : "bg-ok-soft text-ok"}`}
      title={TIPOLOGIE[tipologia as keyof typeof TIPOLOGIE] ?? tipologia}
    >
      {tipologia}
    </span>
  );
}

/** Chip codice anagrafica: cliente (slate) e/o fornitore (rame). */
export function CodiceBadge({
  codiceCliente,
  codiceFornitore,
}: {
  codiceCliente?: string | null;
  codiceFornitore?: string | null;
}) {
  return (
    <span className="inline-flex gap-1.5">
      {codiceCliente && (
        <span className="rounded-md bg-lead-soft px-2 py-0.5 font-mono text-[11px] text-ink-soft">
          {codiceCliente}
        </span>
      )}
      {codiceFornitore && (
        <span className="rounded-md bg-brand-soft px-2 py-0.5 font-mono text-[11px] text-brand-deep">
          {codiceFornitore}
        </span>
      )}
      {!codiceCliente && !codiceFornitore && (
        <span className="text-ink-faint">—</span>
      )}
    </span>
  );
}
