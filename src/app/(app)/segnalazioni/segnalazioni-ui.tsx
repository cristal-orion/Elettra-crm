"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  PRIORITA_SEGNALAZIONE,
  STATI_SEGNALAZIONE,
  TIPI_SEGNALAZIONE,
} from "@/lib/enums";
import type { SegnalazioneState } from "./actions";

type Azione = (
  state: SegnalazioneState,
  formData: FormData,
) => Promise<SegnalazioneState>;

const inputCls =
  "rounded-lg border border-line bg-panel px-3 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20";
const labelCls = "font-mono text-[11px] uppercase tracking-wider text-ink-faint";

function Campo({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className={labelCls}>{label}</span>
      {children}
      {hint && <span className="text-xs text-ink-faint">{hint}</span>}
    </label>
  );
}

function Esito({ state }: { state: SegnalazioneState }) {
  if (state?.error) {
    return (
      <span role="alert" className="text-xs font-medium text-danger">
        {state.error}
      </span>
    );
  }
  if (state?.ok) {
    return <span className="text-xs font-medium text-ok">{state.ok}</span>;
  }
  return null;
}

/* ------------------------------- immagini -------------------------------- */

/**
 * Selettore di immagini con tre modi di aggiungerle: pulsante, trascinamento e
 * **incolla dagli appunti**. Il terzo è quello che conta: uno screenshot preso
 * con Stamp si incolla con Ctrl+V senza passare da un file salvato.
 *
 * I file scelti vengono riversati nell'input nativo tramite DataTransfer, così
 * viaggiano col form senza uno stato parallelo da tenere allineato.
 */
function SelettoreImmagini({ nome = "immagini" }: { nome?: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [sopra, setSopra] = useState(false);
  const [avviso, setAvviso] = useState<string | null>(null);

  const MAX = 6;

  function applica(nuovi: File[]) {
    const immagini = nuovi.filter((f) => f.type.startsWith("image/"));
    if (immagini.length !== nuovi.length) {
      setAvviso("Sono ammesse solo immagini.");
    }
    const insieme = [...files, ...immagini].slice(0, MAX);
    if (files.length + immagini.length > MAX) {
      setAvviso(`Massimo ${MAX} immagini.`);
    }
    const dt = new DataTransfer();
    for (const f of insieme) dt.items.add(f);
    if (inputRef.current) inputRef.current.files = dt.files;
    setFiles(insieme);
  }

  function rimuovi(i: number) {
    const insieme = files.filter((_, idx) => idx !== i);
    const dt = new DataTransfer();
    for (const f of insieme) dt.items.add(f);
    if (inputRef.current) inputRef.current.files = dt.files;
    setFiles(insieme);
    setAvviso(null);
  }

  // L'incolla si ascolta sul documento: chi segnala non deve prima cliccare
  // nel punto giusto, gli basta premere Ctrl+V sulla pagina.
  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const immagini = Array.from(e.clipboardData?.files ?? []).filter((f) =>
        f.type.startsWith("image/"),
      );
      if (immagini.length === 0) return;
      e.preventDefault();
      applica(
        immagini.map(
          (f, i) =>
            new File([f], f.name || `schermata-${Date.now()}-${i}.png`, {
              type: f.type,
            }),
        ),
      );
    }
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
    // `applica` legge `files`: la dipendenza tiene la closure aggiornata.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files]);

  return (
    <div className="flex flex-col gap-2">
      <span className={labelCls}>Schermate</span>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setSopra(true);
        }}
        onDragLeave={() => setSopra(false)}
        onDrop={(e) => {
          e.preventDefault();
          setSopra(false);
          applica(Array.from(e.dataTransfer.files));
        }}
        onClick={() => inputRef.current?.click()}
        className={`cursor-pointer rounded-xl border-2 border-dashed px-5 py-6 text-center transition ${
          sopra ? "border-brand bg-brand-soft/40" : "border-line bg-paper/40 hover:border-brand/50"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          name={nome}
          accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
          multiple
          onChange={(e) => applica(Array.from(e.target.files ?? []))}
          className="hidden"
        />
        <p className="text-sm font-medium">
          Incolla con <span className="font-mono text-xs">Ctrl+V</span>, trascina
          qui, o clicca per scegliere
        </p>
        <p className="mt-0.5 text-xs text-ink-soft">
          Fai lo screenshot e incollalo: non serve salvarlo prima. Max {MAX}{" "}
          immagini da 8 MB.
        </p>
      </div>

      {avviso && (
        <span role="alert" className="text-xs font-medium text-warn">
          {avviso}
        </span>
      )}

      {files.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {files.map((f, i) => (
            <li
              key={`${f.name}-${i}`}
              className="flex items-center gap-2 rounded-lg border border-line bg-panel px-2.5 py-1.5"
            >
              <span className="max-w-40 truncate text-xs">{f.name}</span>
              <span className="font-mono text-[10px] text-ink-faint">
                {Math.round(f.size / 1024)} KB
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  rimuovi(i);
                }}
                aria-label={`Rimuovi ${f.name}`}
                className="rounded p-0.5 text-ink-faint transition hover:bg-danger-soft hover:text-danger"
              >
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" aria-hidden>
                  <path
                    fill="currentColor"
                    d="M18.3 5.7 12 12l6.3 6.3-1.4 1.4L10.6 13.4 4.3 19.7 2.9 18.3 9.2 12 2.9 5.7 4.3 4.3l6.3 6.3 6.3-6.3z"
                  />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ------------------------------- creazione -------------------------------- */

export function NuovaSegnalazioneForm({
  action,
  pagina,
}: {
  action: Azione;
  pagina: string | null;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {pagina && <input type="hidden" name="pagina" value={pagina} />}

      <Campo label="Titolo" hint="Una riga che riassuma il punto.">
        <input
          name="titolo"
          required
          maxLength={160}
          placeholder="es. Il filtro per stato non tiene la scelta"
          className={inputCls}
        />
      </Campo>

      <Campo
        label="Cosa succede e cosa vorresti"
        hint="Più sei concreto, più è veloce sistemarlo: cosa hai fatto, cosa ti aspettavi, cosa è successo."
      >
        <textarea
          name="descrizione"
          required
          rows={7}
          placeholder={
            "Sono in Commesse, scelgo lo stato 'Persa' e premo Filtra.\nMi aspettavo di vedere solo le perse.\nInvece la tendina torna su 'Tutti gli stati'."
          }
          className={inputCls}
        />
      </Campo>

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo label="Tipo">
          <select name="tipo" defaultValue="PROBLEMA" className={inputCls}>
            {Object.entries(TIPI_SEGNALAZIONE).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </Campo>
        <Campo label="Priorità">
          <select name="priorita" defaultValue="MEDIA" className={inputCls}>
            {Object.entries(PRIORITA_SEGNALAZIONE).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </Campo>
      </div>

      <SelettoreImmagini />

      {pagina && (
        <p className="text-xs text-ink-soft">
          Schermata di provenienza:{" "}
          <span className="font-mono text-ink-faint">{pagina}</span>
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-elettra px-4 py-2.5 text-sm font-semibold text-white transition disabled:opacity-60"
        >
          {pending ? "Invio…" : "Invia segnalazione"}
        </button>
        <Esito state={state} />
      </div>
    </form>
  );
}

/* -------------------------------- dettaglio ------------------------------- */

export function AggiungiAllegatiForm({ action }: { action: Azione }) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-3">
      <SelettoreImmagini />
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg border border-brand/40 px-3 py-1.5 text-xs font-medium text-brand-deep transition hover:bg-brand-soft disabled:opacity-60"
        >
          {pending ? "Caricamento…" : "Aggiungi schermate"}
        </button>
        <Esito state={state} />
      </div>
    </form>
  );
}

export function CambiaStatoForm({
  action,
  stato,
  risoluzione,
}: {
  action: Azione;
  stato: string;
  risoluzione: string | null;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [scelto, setScelto] = useState(stato);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <Campo label="Stato">
          <select
            name="stato"
            value={scelto}
            onChange={(e) => setScelto(e.target.value)}
            className={inputCls}
          >
            {Object.entries(STATI_SEGNALAZIONE).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </Campo>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-elettra px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-60"
        >
          {pending ? "Salvataggio…" : "Aggiorna"}
        </button>
      </div>

      {scelto === "CONCLUSA" && (
        <Campo
          label="Come è stata risolta"
          hint="Facoltativo, ma resta nello storico e spiega a chi ha segnalato cosa è cambiato."
        >
          <textarea
            name="risoluzione"
            rows={3}
            defaultValue={risoluzione ?? ""}
            placeholder="es. Il filtro ora conserva la scelta: mancava defaultValue sulla select."
            className={inputCls}
          />
        </Campo>
      )}

      <Esito state={state} />
    </form>
  );
}

export function ModificaSegnalazioneForm({
  action,
  titolo,
  descrizione,
  tipo,
  priorita,
}: {
  action: Azione;
  titolo: string;
  descrizione: string;
  tipo: string;
  priorita: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-4 pt-3">
      <Campo label="Titolo">
        <input name="titolo" required defaultValue={titolo} className={inputCls} />
      </Campo>
      <Campo label="Descrizione">
        <textarea
          name="descrizione"
          required
          rows={6}
          defaultValue={descrizione}
          className={inputCls}
        />
      </Campo>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo label="Tipo">
          <select name="tipo" defaultValue={tipo} className={inputCls}>
            {Object.entries(TIPI_SEGNALAZIONE).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </Campo>
        <Campo label="Priorità">
          <select name="priorita" defaultValue={priorita} className={inputCls}>
            {Object.entries(PRIORITA_SEGNALAZIONE).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </Campo>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg border border-brand/40 px-3 py-1.5 text-xs font-medium text-brand-deep transition hover:bg-brand-soft disabled:opacity-60"
        >
          {pending ? "Salvataggio…" : "Salva modifiche"}
        </button>
        <Esito state={state} />
      </div>
    </form>
  );
}

/** Bottone che invia un'action senza payload, con conferma. */
export function BottoneConferma({
  action,
  etichetta,
  conferma,
  variante = "neutro",
}: {
  action: (formData: FormData) => void | Promise<void>;
  etichetta: string;
  conferma: string;
  variante?: "neutro" | "danger";
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(conferma)) e.preventDefault();
      }}
    >
      <button
        type="submit"
        className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
          variante === "danger"
            ? "border-danger/30 text-danger hover:bg-danger-soft"
            : "border-line text-ink-soft hover:border-brand/40"
        }`}
      >
        {etichetta}
      </button>
    </form>
  );
}

export function EliminaAllegatoBottone({
  action,
  nome,
}: {
  action: (formData: FormData) => void | Promise<void>;
  nome: string;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(`Eliminare l'immagine «${nome}»?`)) e.preventDefault();
      }}
    >
      <button
        type="submit"
        title="Elimina immagine"
        aria-label={`Elimina ${nome}`}
        className="rounded-md bg-slatepanel/80 p-1.5 text-white/80 transition hover:bg-danger hover:text-white"
      >
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" aria-hidden>
          <path
            fill="currentColor"
            d="M9 3h6l1 2h4v2H4V5h4l1-2Zm-3 6h12l-1 12H7L6 9Z"
          />
        </svg>
      </button>
    </form>
  );
}
