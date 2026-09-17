"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import FormError from "@/components/form-error";
import SearchableSelect from "@/components/searchable-select";
import { STATI_ORDINE } from "@/lib/enums";
import { formatEuro } from "@/lib/format";
import type { OrdineState } from "./actions";

export type FornitoreOption = {
  id: string;
  ragioneSociale: string;
  codiceFornitore: string | null;
};

export type CommessaOption = {
  id: string;
  numero: string;
  descrizione: string | null;
  cliente: { ragioneSociale: string };
};

export type RigaValue = {
  id?: string;
  codiceProdotto: string;
  descrizione: string;
  unitaMisura: string;
  quantita: string;
  prezzoUnitario: string;
  sconto: string;
  aliquotaIva: string;
  dataConsegnaPrevista: string;
  quantitaRicevuta: string;
  ddtNumero: string;
  ddtData: string;
  fatturaNumero: string;
  fatturaData: string;
};

export type OrdineFormValues = {
  fornitoreId: string;
  commessaId: string;
  numero: string;
  data: string;
  stato: string;
  righe: RigaValue[];
};

const inputCls =
  "rounded-lg border border-line bg-panel px-3 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20";
const labelCls = "text-xs font-mono uppercase tracking-wider text-ink-faint";

function emptyRiga(): RigaValue {
  return {
    codiceProdotto: "",
    descrizione: "",
    unitaMisura: "",
    quantita: "",
    prezzoUnitario: "",
    sconto: "",
    aliquotaIva: "",
    dataConsegnaPrevista: "",
    quantitaRicevuta: "",
    ddtNumero: "",
    ddtData: "",
    fatturaNumero: "",
    fatturaData: "",
  };
}

function n(v: string): number {
  const x = parseFloat(v.replace(",", "."));
  return Number.isFinite(x) ? x : 0;
}

/** Imponibile riga = quantità × prezzo × (1 − sconto%). */
function imponibileRiga(r: RigaValue): number {
  return n(r.quantita) * n(r.prezzoUnitario) * (1 - n(r.sconto) / 100);
}

export default function OrdineForm({
  action,
  fornitori,
  commesse,
  initial,
  submitLabel = "Salva",
  cancelHref = "/ordini",
}: {
  action: (state: OrdineState, formData: FormData) => Promise<OrdineState>;
  fornitori: FornitoreOption[];
  commesse: CommessaOption[];
  initial?: Partial<OrdineFormValues>;
  submitLabel?: string;
  cancelHref?: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [commessaId, setCommessaId] = useState(initial?.commessaId ?? "");
  const [righe, setRighe] = useState<RigaValue[]>(
    initial?.righe?.length ? initial.righe : [emptyRiga()],
  );

  const v = (k: keyof OrdineFormValues) =>
    (initial?.[k] as string | undefined) ?? "";

  function updateRiga(i: number, patch: Partial<RigaValue>) {
    setRighe((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function removeRiga(i: number) {
    setRighe((prev) => prev.filter((_, idx) => idx !== i));
  }

  const totali = useMemo(() => {
    let imponibile = 0;
    let iva = 0;
    for (const r of righe) {
      const imp = imponibileRiga(r);
      imponibile += imp;
      iva += imp * (n(r.aliquotaIva) / 100);
    }
    return { imponibile, iva, totale: imponibile + iva };
  }, [righe]);

  return (
    <form action={formAction} className="flex flex-col gap-7">
      {/* righe serializzate */}
      <input type="hidden" name="righe" value={JSON.stringify(righe)} />

      {/* Testata */}
      <fieldset className="rounded-xl border border-line bg-panel p-5">
        <legend className="px-1 text-sm font-semibold">Testata ordine</legend>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-1.5 sm:col-span-2">
            <label htmlFor="ordine-fornitore" className={labelCls}>Fornitore *</label>
            <SearchableSelect
              id="ordine-fornitore"
              name="fornitoreId"
              label="Fornitore"
              required
              defaultValue={v("fornitoreId")}
              placeholder="— Seleziona fornitore —"
              searchPlaceholder="Cerca per nome o codice fornitore…"
              options={fornitori.map((f) => ({
                value: f.id,
                label: `${f.codiceFornitore ? `${f.codiceFornitore} · ` : ""}${f.ragioneSociale}`,
              }))}
              className={inputCls}
            />
          </div>
          <div className="flex min-w-0 flex-col gap-1.5 sm:col-span-2">
            <label htmlFor="ordine-commessa" className={labelCls}>Commessa collegata</label>
            <SearchableSelect
              id="ordine-commessa"
              name="commessaId"
              label="Commessa collegata"
              value={commessaId}
              onValueChange={setCommessaId}
              placeholder="— Nessuna commessa —"
              searchPlaceholder="Cerca per numero, cliente o descrizione…"
              options={commesse.map((c) => ({
                value: c.id,
                label: `${c.numero} — ${c.cliente.ragioneSociale}${c.descrizione ? ` · ${c.descrizione}` : ""}`,
              }))}
              className={inputCls}
            />
            {commessaId && <span className="text-xs leading-relaxed text-warn">Collegando l’acquisto, una commessa di tipo Preventivo passa a Consuntivo (P→C). Tariffario e Gara mantengono la propria tipologia. Lo stato commerciale non cambia.</span>}
          </div>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Numero ordine</span>
            <input
              name="numero"
              defaultValue={v("numero")}
              placeholder="es. ODA-2026-014"
              className={inputCls}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Data ordine</span>
            <input
              type="date"
              name="data"
              defaultValue={v("data")}
              className={inputCls}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Stato</span>
            <select name="stato" defaultValue={v("stato") || "ORDINATO"} className={inputCls}>
              {Object.entries(STATI_ORDINE).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </fieldset>

      {/* Righe */}
      <fieldset className="rounded-xl border border-line bg-panel p-5">
        <div className="flex items-center justify-between px-1">
          <legend className="text-sm font-semibold">Righe ordine</legend>
          <button
            type="button"
            onClick={() => setRighe((prev) => [...prev, emptyRiga()])}
            className="rounded-lg border border-brand/40 px-3 py-1.5 text-xs font-medium text-brand-deep transition hover:bg-brand-soft"
          >
            + Aggiungi riga
          </button>
        </div>

        {righe.length === 0 && (
          <p className="mt-3 text-sm text-ink-faint">
            Nessuna riga. Aggiungine almeno una con descrizione.
          </p>
        )}

        <div className="mt-3 flex flex-col gap-4">
          {righe.map((r, i) => {
            const imp = imponibileRiga(r);
            return (
              <div
                key={i}
                className="rounded-lg border border-line bg-paper/60 p-4"
              >
                {/* Prodotto */}
                <div className="grid gap-3 sm:grid-cols-12">
                  <label className="flex flex-col gap-1.5 sm:col-span-3">
                    <span className={labelCls}>Codice</span>
                    <input
                      value={r.codiceProdotto}
                      onChange={(e) =>
                        updateRiga(i, { codiceProdotto: e.target.value })
                      }
                      className={inputCls}
                    />
                  </label>
                  <label className="flex flex-col gap-1.5 sm:col-span-7">
                    <span className={labelCls}>Descrizione *</span>
                    <input
                      value={r.descrizione}
                      required
                      name={`righe.${i}.descrizione`}
                      onChange={(e) =>
                        updateRiga(i, { descrizione: e.target.value })
                      }
                      className={inputCls}
                    />
                  </label>
                  <label className="flex flex-col gap-1.5 sm:col-span-2">
                    <span className={labelCls}>U.M.</span>
                    <input
                      value={r.unitaMisura}
                      onChange={(e) =>
                        updateRiga(i, { unitaMisura: e.target.value })
                      }
                      placeholder="pz, m, kg…"
                      className={inputCls}
                    />
                  </label>
                </div>

                {/* Prezzi */}
                <div className="mt-3 grid gap-3 sm:grid-cols-12">
                  <label className="flex flex-col gap-1.5 sm:col-span-2">
                    <span className={labelCls}>Quantità</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={r.quantita}
                      onChange={(e) =>
                        updateRiga(i, { quantita: e.target.value })
                      }
                      className={`${inputCls} tabular-nums`}
                    />
                  </label>
                  <label className="flex flex-col gap-1.5 sm:col-span-3">
                    <span className={labelCls}>Prezzo unit. (€)</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={r.prezzoUnitario}
                      onChange={(e) =>
                        updateRiga(i, { prezzoUnitario: e.target.value })
                      }
                      className={`${inputCls} tabular-nums`}
                    />
                  </label>
                  <label className="flex flex-col gap-1.5 sm:col-span-2">
                    <span className={labelCls}>Sconto %</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={r.sconto}
                      onChange={(e) => updateRiga(i, { sconto: e.target.value })}
                      className={`${inputCls} tabular-nums`}
                    />
                  </label>
                  <label className="flex flex-col gap-1.5 sm:col-span-2">
                    <span className={labelCls}>IVA %</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={r.aliquotaIva}
                      onChange={(e) =>
                        updateRiga(i, { aliquotaIva: e.target.value })
                      }
                      className={`${inputCls} tabular-nums`}
                    />
                  </label>
                  <div className="flex flex-col gap-1.5 sm:col-span-3">
                    <span className={labelCls}>Imponibile</span>
                    <span className="rounded-lg bg-brand-soft px-3 py-2 text-right font-mono text-sm tabular-nums text-brand-deep">
                      {formatEuro(imp)}
                    </span>
                  </div>
                </div>

                {/* Entrata merce */}
                <details className="mt-3 rounded-lg border border-line bg-panel">
                  <summary className="cursor-pointer select-none px-3 py-2 text-xs font-medium text-ink-soft">
                    Entrata merce (consegna, DDT, fattura)
                  </summary>
                  <div className="grid gap-3 border-t border-line p-3 sm:grid-cols-12">
                    <label className="flex flex-col gap-1.5 sm:col-span-4">
                      <span className={labelCls}>Consegna prevista</span>
                      <input
                        type="date"
                        value={r.dataConsegnaPrevista}
                        onChange={(e) =>
                          updateRiga(i, {
                            dataConsegnaPrevista: e.target.value,
                          })
                        }
                        className={inputCls}
                      />
                    </label>
                    <label className="flex flex-col gap-1.5 sm:col-span-4">
                      <span className={labelCls}>Qtà ricevuta</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={r.quantitaRicevuta}
                        onChange={(e) =>
                          updateRiga(i, { quantitaRicevuta: e.target.value })
                        }
                        className={`${inputCls} tabular-nums`}
                      />
                    </label>
                    <label className="flex flex-col gap-1.5 sm:col-span-4">
                      <span className={labelCls}>N. DDT</span>
                      <input
                        value={r.ddtNumero}
                        onChange={(e) =>
                          updateRiga(i, { ddtNumero: e.target.value })
                        }
                        className={inputCls}
                      />
                    </label>
                    <label className="flex flex-col gap-1.5 sm:col-span-4">
                      <span className={labelCls}>Data DDT</span>
                      <input
                        type="date"
                        value={r.ddtData}
                        onChange={(e) =>
                          updateRiga(i, { ddtData: e.target.value })
                        }
                        className={inputCls}
                      />
                    </label>
                    <label className="flex flex-col gap-1.5 sm:col-span-4">
                      <span className={labelCls}>N. fattura</span>
                      <input
                        value={r.fatturaNumero}
                        onChange={(e) =>
                          updateRiga(i, { fatturaNumero: e.target.value })
                        }
                        className={inputCls}
                      />
                    </label>
                    <label className="flex flex-col gap-1.5 sm:col-span-4">
                      <span className={labelCls}>Data fattura</span>
                      <input
                        type="date"
                        value={r.fatturaData}
                        onChange={(e) =>
                          updateRiga(i, { fatturaData: e.target.value })
                        }
                        className={inputCls}
                      />
                    </label>
                  </div>
                </details>

                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={() => removeRiga(i)}
                    className="text-xs text-danger hover:underline"
                  >
                    Rimuovi riga
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Totali */}
        {righe.length > 0 && (
          <div className="mt-4 flex flex-col items-end gap-1 border-t border-line pt-4 text-sm">
            <div className="flex w-full max-w-xs justify-between text-ink-soft">
              <span>Imponibile</span>
              <span className="font-mono tabular-nums">
                {formatEuro(totali.imponibile)}
              </span>
            </div>
            <div className="flex w-full max-w-xs justify-between text-ink-soft">
              <span>IVA</span>
              <span className="font-mono tabular-nums">
                {formatEuro(totali.iva)}
              </span>
            </div>
            <div className="flex w-full max-w-xs justify-between font-semibold">
              <span>Totale</span>
              <span className="font-mono tabular-nums">
                {formatEuro(totali.totale)}
              </span>
            </div>
          </div>
        )}
      </fieldset>

      <FormError error={state?.error} />

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
