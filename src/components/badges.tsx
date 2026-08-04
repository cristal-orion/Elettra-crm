import {
  etichettaStato,
  etichettaStatoOrdine,
  etichettaStatoMilestone,
  TIPOLOGIE,
} from "@/lib/enums";
import {
  ETICHETTE_AVANZAMENTO,
  type StatoAvanzamento,
} from "@/lib/progetti";

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

const tipologiaStyle: Record<string, string> = {
  P: "bg-warn-soft text-warn", // preventivo: ancora da confermare
  C: "bg-ok-soft text-ok", // consuntivo: acquisito
  T: "bg-brand-soft text-brand-deep", // tariffario
  GARA: "bg-lead-soft text-ink-soft", // gara d'appalto
};

export function TipologiaBadge({ tipologia }: { tipologia: string | null }) {
  if (!tipologia) return <span className="text-ink-faint">—</span>;
  return (
    <span
      className={`${pill} font-mono ${tipologiaStyle[tipologia] ?? "bg-lead-soft text-ink-soft"}`}
      title={TIPOLOGIE[tipologia as keyof typeof TIPOLOGIE] ?? tipologia}
    >
      {tipologia}
    </span>
  );
}

const statoMilestoneStyle: Record<string, string> = {
  DA_FARE: "bg-lead-soft text-ink-soft",
  IN_CORSO: "bg-brand-soft text-brand-deep",
  COMPLETATA: "bg-ok-soft text-ok",
};

export function MilestoneBadge({ stato }: { stato: string }) {
  return (
    <span
      className={`${pill} ${statoMilestoneStyle[stato] ?? "bg-lead-soft text-ink-soft"}`}
    >
      {etichettaStatoMilestone(stato)}
    </span>
  );
}

const avanzamentoStyle: Record<StatoAvanzamento, string> = {
  COMPLETATO: "bg-ok-soft text-ok",
  IN_RITARDO: "bg-danger-soft text-danger",
  IN_CORSO: "bg-brand-soft text-brand-deep",
  DA_PIANIFICARE: "bg-lead-soft text-ink-soft",
};

/** Stato sintetico del progetto di cantiere (vedi statoAvanzamento). */
export function AvanzamentoBadge({ stato }: { stato: StatoAvanzamento }) {
  return (
    <span className={`${pill} ${avanzamentoStyle[stato]}`}>
      {stato === "IN_RITARDO" && <span aria-hidden>⚠</span>}
      {stato === "COMPLETATO" && <span aria-hidden>✓</span>}
      {ETICHETTE_AVANZAMENTO[stato]}
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
