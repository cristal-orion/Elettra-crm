"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { TITOLI } from "@/lib/enums";
import type { AnagraficaState } from "./actions";

export type ReferenteValue = {
  id?: string;
  titolo: string;
  nome: string;
  cognome: string;
  ruoloAzienda: string;
  email: string;
  telefono: string;
  principale: boolean;
};

export type AnagraficaFormValues = {
  ragioneSociale: string;
  isCliente: boolean;
  isFornitore: boolean;
  partitaIva: string;
  codiceFiscale: string;
  codiceSDI: string;
  indirizzo: string;
  cap: string;
  localita: string;
  provincia: string;
  telefono: string;
  fax: string;
  email: string;
  web: string;
  modalitaPagamento: string;
  prodottiTrattati: string;
  note: string;
  referenti: ReferenteValue[];
};

const inputCls =
  "rounded-lg border border-line bg-panel px-3 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20";
const labelCls = "text-xs font-mono uppercase tracking-wider text-ink-faint";

function emptyReferente(): ReferenteValue {
  return {
    titolo: "NESSUNO",
    nome: "",
    cognome: "",
    ruoloAzienda: "",
    email: "",
    telefono: "",
    principale: false,
  };
}

export default function AnagraficaForm({
  action,
  initial,
  submitLabel = "Salva",
  cancelHref = "/anagrafiche",
}: {
  action: (state: AnagraficaState, formData: FormData) => Promise<AnagraficaState>;
  initial?: Partial<AnagraficaFormValues>;
  submitLabel?: string;
  cancelHref?: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [referenti, setReferenti] = useState<ReferenteValue[]>(
    initial?.referenti?.length ? initial.referenti : [],
  );

  const v = (k: keyof AnagraficaFormValues) =>
    (initial?.[k] as string | undefined) ?? "";

  function updateRef(i: number, patch: Partial<ReferenteValue>) {
    setReferenti((prev) =>
      prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)),
    );
  }
  function removeRef(i: number) {
    setReferenti((prev) => prev.filter((_, idx) => idx !== i));
  }

  return (
    <form action={formAction} className="flex flex-col gap-7">
      {/* referenti serializzati */}
      <input type="hidden" name="referenti" value={JSON.stringify(referenti)} />

      {/* Tipo */}
      <fieldset className="rounded-xl border border-line bg-panel p-5">
        <legend className="px-1 text-sm font-semibold">Tipo anagrafica</legend>
        <div className="mt-2 flex flex-wrap gap-6">
          <label className="flex items-center gap-2.5 text-sm">
            <input
              type="checkbox"
              name="isCliente"
              defaultChecked={initial?.isCliente ?? false}
              className="h-4 w-4 accent-[color:var(--color-brand)]"
            />
            Cliente <span className="font-mono text-xs text-ink-faint">(C)</span>
          </label>
          <label className="flex items-center gap-2.5 text-sm">
            <input
              type="checkbox"
              name="isFornitore"
              defaultChecked={initial?.isFornitore ?? false}
              className="h-4 w-4 accent-[color:var(--color-brand)]"
            />
            Fornitore{" "}
            <span className="font-mono text-xs text-ink-faint">(F)</span>
          </label>
        </div>
        <p className="mt-2 text-xs text-ink-soft">
          Il codice (C####/F####) viene assegnato automaticamente al salvataggio.
        </p>
      </fieldset>

      {/* Dati principali */}
      <fieldset className="rounded-xl border border-line bg-panel p-5">
        <legend className="px-1 text-sm font-semibold">Dati principali</legend>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 sm:col-span-2">
            <span className={labelCls}>Ragione sociale *</span>
            <input
              name="ragioneSociale"
              required
              defaultValue={v("ragioneSociale")}
              className={inputCls}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Partita IVA</span>
            <input name="partitaIva" defaultValue={v("partitaIva")} className={inputCls} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Codice fiscale</span>
            <input
              name="codiceFiscale"
              defaultValue={v("codiceFiscale")}
              className={inputCls}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Codice SDI / Univoco</span>
            <input name="codiceSDI" defaultValue={v("codiceSDI")} className={inputCls} />
          </label>
        </div>
      </fieldset>

      {/* Indirizzo */}
      <fieldset className="rounded-xl border border-line bg-panel p-5">
        <legend className="px-1 text-sm font-semibold">Indirizzo</legend>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 sm:col-span-2">
            <span className={labelCls}>Indirizzo</span>
            <input name="indirizzo" defaultValue={v("indirizzo")} className={inputCls} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>CAP</span>
            <input name="cap" defaultValue={v("cap")} className={inputCls} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Località</span>
            <input name="localita" defaultValue={v("localita")} className={inputCls} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Provincia</span>
            <input
              name="provincia"
              maxLength={2}
              defaultValue={v("provincia")}
              className={`${inputCls} uppercase`}
            />
          </label>
        </div>
      </fieldset>

      {/* Contatti */}
      <fieldset className="rounded-xl border border-line bg-panel p-5">
        <legend className="px-1 text-sm font-semibold">Contatti</legend>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Telefono</span>
            <input name="telefono" defaultValue={v("telefono")} className={inputCls} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Fax</span>
            <input name="fax" defaultValue={v("fax")} className={inputCls} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Email</span>
            <input name="email" type="email" defaultValue={v("email")} className={inputCls} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Web</span>
            <input name="web" defaultValue={v("web")} className={inputCls} />
          </label>
        </div>
      </fieldset>

      {/* Amministrazione */}
      <fieldset className="rounded-xl border border-line bg-panel p-5">
        <legend className="px-1 text-sm font-semibold">Amministrazione</legend>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Modalità di pagamento</span>
            <input
              name="modalitaPagamento"
              defaultValue={v("modalitaPagamento")}
              placeholder="es. RI.BA. 60 GG DF FM"
              className={inputCls}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Prodotti trattati</span>
            <input
              name="prodottiTrattati"
              defaultValue={v("prodottiTrattati")}
              placeholder="es. Materiale elettrico"
              className={inputCls}
            />
          </label>
          <label className="flex flex-col gap-1.5 sm:col-span-2">
            <span className={labelCls}>Note</span>
            <textarea
              name="note"
              defaultValue={v("note")}
              rows={2}
              className={inputCls}
            />
          </label>
        </div>
      </fieldset>

      {/* Referenti */}
      <fieldset className="rounded-xl border border-line bg-panel p-5">
        <div className="flex items-center justify-between px-1">
          <legend className="text-sm font-semibold">Referenti</legend>
          <button
            type="button"
            onClick={() =>
              setReferenti((prev) => [...prev, emptyReferente()])
            }
            className="rounded-lg border border-brand/40 px-3 py-1.5 text-xs font-medium text-brand-deep transition hover:bg-brand-soft"
          >
            + Aggiungi referente
          </button>
        </div>

        {referenti.length === 0 && (
          <p className="mt-3 text-sm text-ink-faint">
            Nessun referente. Aggiungine uno con titolo normalizzato.
          </p>
        )}

        <div className="mt-3 flex flex-col gap-4">
          {referenti.map((r, i) => (
            <div
              key={i}
              className="rounded-lg border border-line bg-paper/60 p-4"
            >
              <div className="grid gap-3 sm:grid-cols-12">
                <label className="flex flex-col gap-1.5 sm:col-span-3">
                  <span className={labelCls}>Titolo</span>
                  <select
                    value={r.titolo}
                    onChange={(e) => updateRef(i, { titolo: e.target.value })}
                    className={inputCls}
                  >
                    {Object.entries(TITOLI).map(([key, label]) => (
                      <option key={key} value={key}>
                        {key === "NESSUNO" ? "—" : label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1.5 sm:col-span-4">
                  <span className={labelCls}>Nome *</span>
                  <input
                    value={r.nome}
                    onChange={(e) => updateRef(i, { nome: e.target.value })}
                    className={inputCls}
                  />
                </label>
                <label className="flex flex-col gap-1.5 sm:col-span-5">
                  <span className={labelCls}>Cognome *</span>
                  <input
                    value={r.cognome}
                    onChange={(e) => updateRef(i, { cognome: e.target.value })}
                    className={inputCls}
                  />
                </label>
                <label className="flex flex-col gap-1.5 sm:col-span-4">
                  <span className={labelCls}>Ruolo in azienda</span>
                  <input
                    value={r.ruoloAzienda}
                    onChange={(e) =>
                      updateRef(i, { ruoloAzienda: e.target.value })
                    }
                    className={inputCls}
                  />
                </label>
                <label className="flex flex-col gap-1.5 sm:col-span-4">
                  <span className={labelCls}>Email</span>
                  <input
                    value={r.email}
                    onChange={(e) => updateRef(i, { email: e.target.value })}
                    className={inputCls}
                  />
                </label>
                <label className="flex flex-col gap-1.5 sm:col-span-4">
                  <span className={labelCls}>Telefono</span>
                  <input
                    value={r.telefono}
                    onChange={(e) => updateRef(i, { telefono: e.target.value })}
                    className={inputCls}
                  />
                </label>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <label className="flex items-center gap-2 text-xs text-ink-soft">
                  <input
                    type="checkbox"
                    checked={r.principale}
                    onChange={(e) =>
                      updateRef(i, { principale: e.target.checked })
                    }
                    className="h-3.5 w-3.5 accent-[color:var(--color-brand)]"
                  />
                  Referente principale
                </label>
                <button
                  type="button"
                  onClick={() => removeRef(i)}
                  className="text-xs text-danger hover:underline"
                >
                  Rimuovi
                </button>
              </div>
            </div>
          ))}
        </div>
      </fieldset>

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
