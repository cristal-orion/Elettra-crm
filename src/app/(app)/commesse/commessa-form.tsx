"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import {
  STATI_COMMESSA,
  TIPOLOGIE,
  METODI_RICEZIONE,
  etichettaTitolo,
} from "@/lib/enums";
import type { CommessaState } from "./actions";

export type ClienteOption = {
  id: string;
  ragioneSociale: string;
  codiceCliente: string | null;
  referenti: {
    id: string;
    titolo: string;
    nome: string;
    cognome: string;
  }[];
};

export type PmOption = { id: string; nome: string; cognome: string };

export type CommessaFormValues = {
  clienteId: string;
  referenteId: string;
  pmId: string;
  referenteCommerciale: string;
  stato: string;
  tipologia: string;
  descrizione: string;
  dataRichiesta: string;
  dataInvio: string;
  importoOfferta: string;
  importoOrdine: string;
  dataOrdine: string;
  metodoRicezioneOrdine: string;
  motivazionePersa: string;
};

const inputCls =
  "rounded-lg border border-line bg-panel px-3 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20";
const labelCls = "text-xs font-mono uppercase tracking-wider text-ink-faint";

export default function CommessaForm({
  action,
  clienti,
  pms,
  initial,
  submitLabel = "Salva",
  cancelHref = "/commesse",
}: {
  action: (state: CommessaState, formData: FormData) => Promise<CommessaState>;
  clienti: ClienteOption[];
  pms: PmOption[];
  initial?: Partial<CommessaFormValues>;
  submitLabel?: string;
  cancelHref?: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);

  const [clienteId, setClienteId] = useState(initial?.clienteId ?? "");
  const [referenteId, setReferenteId] = useState(initial?.referenteId ?? "");
  const [stato, setStato] = useState(initial?.stato ?? "LEAD");

  const v = (k: keyof CommessaFormValues) =>
    (initial?.[k] as string | undefined) ?? "";

  const referentiCliente = useMemo(
    () => clienti.find((c) => c.id === clienteId)?.referenti ?? [],
    [clienti, clienteId],
  );

  return (
    <form action={formAction} className="flex flex-col gap-7">
      {/* Cliente e assegnazione */}
      <fieldset className="rounded-xl border border-line bg-panel p-5">
        <legend className="px-1 text-sm font-semibold">
          Cliente e assegnazione
        </legend>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 sm:col-span-2">
            <span className={labelCls}>Cliente *</span>
            <select
              name="clienteId"
              required
              value={clienteId}
              onChange={(e) => {
                setClienteId(e.target.value);
                setReferenteId("");
              }}
              className={inputCls}
            >
              <option value="">— Seleziona cliente —</option>
              {clienti.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.codiceCliente ? `${c.codiceCliente} · ` : ""}
                  {c.ragioneSociale}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Referente cliente</span>
            <select
              name="referenteId"
              value={referenteId}
              onChange={(e) => setReferenteId(e.target.value)}
              disabled={referentiCliente.length === 0}
              className={`${inputCls} disabled:opacity-50`}
            >
              <option value="">
                {referentiCliente.length === 0
                  ? "Nessun referente disponibile"
                  : "— Nessuno —"}
              </option>
              {referentiCliente.map((r) => (
                <option key={r.id} value={r.id}>
                  {`${etichettaTitolo(r.titolo)} ${r.nome} ${r.cognome}`.trim()}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Project Manager</span>
            <select name="pmId" defaultValue={v("pmId")} className={inputCls}>
              <option value="">— Non assegnato —</option>
              {pms.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome} {p.cognome}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Referente commerciale</span>
            <input
              name="referenteCommerciale"
              defaultValue={v("referenteCommerciale")}
              placeholder="es. FG"
              className={inputCls}
            />
          </label>
        </div>
      </fieldset>

      {/* Dettagli offerta */}
      <fieldset className="rounded-xl border border-line bg-panel p-5">
        <legend className="px-1 text-sm font-semibold">Dettagli offerta</legend>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 sm:col-span-2">
            <span className={labelCls}>Descrizione</span>
            <textarea
              name="descrizione"
              defaultValue={v("descrizione")}
              rows={2}
              placeholder="es. Lavori elettrici febbraio 2026"
              className={inputCls}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Stato</span>
            <select
              name="stato"
              value={stato}
              onChange={(e) => setStato(e.target.value)}
              className={inputCls}
            >
              {Object.entries(STATI_COMMESSA).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Tipologia</span>
            <select
              name="tipologia"
              defaultValue={v("tipologia")}
              className={inputCls}
            >
              <option value="">— Non definita —</option>
              {Object.entries(TIPOLOGIE).map(([key, label]) => (
                <option key={key} value={key}>
                  {key} · {label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Data richiesta</span>
            <input
              type="date"
              name="dataRichiesta"
              defaultValue={v("dataRichiesta")}
              className={inputCls}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Data invio offerta</span>
            <input
              type="date"
              name="dataInvio"
              defaultValue={v("dataInvio")}
              className={inputCls}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Importo offerta (€)</span>
            <input
              type="number"
              step="0.01"
              min="0"
              name="importoOfferta"
              defaultValue={v("importoOfferta")}
              className={`${inputCls} tabular-nums`}
            />
          </label>
        </div>
      </fieldset>

      {/* Ordine */}
      <fieldset className="rounded-xl border border-line bg-panel p-5">
        <legend className="px-1 text-sm font-semibold">Ordine</legend>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Importo ordine (€)</span>
            <input
              type="number"
              step="0.01"
              min="0"
              name="importoOrdine"
              defaultValue={v("importoOrdine")}
              className={`${inputCls} tabular-nums`}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Data ordine</span>
            <input
              type="date"
              name="dataOrdine"
              defaultValue={v("dataOrdine")}
              className={inputCls}
            />
          </label>
          <label className="flex flex-col gap-1.5 sm:col-span-2">
            <span className={labelCls}>Metodo ricezione ordine</span>
            <select
              name="metodoRicezioneOrdine"
              defaultValue={v("metodoRicezioneOrdine")}
              className={inputCls}
            >
              <option value="">— Non specificato —</option>
              {Object.entries(METODI_RICEZIONE).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </fieldset>

      {/* Motivazione persa (solo se stato = Persa) */}
      {stato === "PERSA" && (
        <fieldset className="rounded-xl border border-danger/30 bg-danger-soft/40 p-5">
          <legend className="px-1 text-sm font-semibold text-danger">
            Offerta persa
          </legend>
          <label className="mt-3 flex flex-col gap-1.5">
            <span className={labelCls}>Motivazione</span>
            <textarea
              name="motivazionePersa"
              defaultValue={v("motivazionePersa")}
              rows={2}
              placeholder="es. Prezzo fuori mercato, tempi non compatibili…"
              className={inputCls}
            />
          </label>
        </fieldset>
      )}

      {state?.error && (
        <p
          role="alert"
          className="rounded-lg bg-danger-soft px-4 py-3 text-sm text-danger"
        >
          {state.error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-elettra px-5 py-2.5 text-sm font-semibold text-white transition disabled:opacity-60"
        >
          {pending ? "Salvataggio…" : submitLabel}
        </button>
        <Link
          href={cancelHref}
          className="rounded-lg border border-line px-5 py-2.5 text-sm text-ink-soft transition hover:bg-panel"
        >
          Annulla
        </Link>
      </div>
    </form>
  );
}
