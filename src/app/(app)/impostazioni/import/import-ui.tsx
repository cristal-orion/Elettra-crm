"use client";

import { useActionState, useRef, useState } from "react";
import type { EsitoImport } from "@/lib/import-excel";
import type { ImportState } from "./actions";

type Azione = (
  state: ImportState,
  formData: FormData,
) => Promise<ImportState>;

/**
 * Zona di rilascio per un singolo file. Il drag & drop scrive nell'input
 * nativo tramite DataTransfer, così il file viaggia con il form senza stato
 * parallelo da tenere allineato.
 */
function ZonaFile({
  nome,
  etichetta,
  descrizione,
}: {
  nome: string;
  etichetta: string;
  descrizione: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [sopra, setSopra] = useState(false);

  function accetta(lista: FileList | null) {
    const f = lista?.[0];
    if (!f) return;
    const dt = new DataTransfer();
    dt.items.add(f);
    if (inputRef.current) inputRef.current.files = dt.files;
    setFile(f);
  }

  const kb = file ? Math.round(file.size / 1024).toLocaleString("it-IT") : null;

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setSopra(true);
      }}
      onDragLeave={() => setSopra(false)}
      onDrop={(e) => {
        e.preventDefault();
        setSopra(false);
        accetta(e.dataTransfer.files);
      }}
      onClick={() => inputRef.current?.click()}
      className={`flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border-2 border-dashed px-5 py-8 text-center transition ${
        sopra
          ? "border-brand bg-brand-soft/40"
          : file
            ? "border-ok/50 bg-ok-soft/30"
            : "border-line bg-paper/40 hover:border-brand/50"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        name={nome}
        accept=".xls,.xlsx"
        required
        onChange={(e) => accetta(e.target.files)}
        className="hidden"
      />
      <span className="font-mono text-[11px] uppercase tracking-wider text-ink-faint">
        {etichetta}
      </span>
      {file ? (
        <>
          <span className="text-sm font-medium text-ok">{file.name}</span>
          <span className="text-xs text-ink-faint">{kb} KB · pronto</span>
        </>
      ) : (
        <>
          <span className="text-sm font-medium">Trascina qui il file</span>
          <span className="text-xs text-ink-soft">{descrizione}</span>
        </>
      )}
    </div>
  );
}

function Numero({ label, valore }: { label: string; valore: number | string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-sm text-ink-faint">{label}</dt>
      <dd className="text-right text-sm font-medium tabular-nums">{valore}</dd>
    </div>
  );
}

const eur = (n: number) =>
  n.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function Riepilogo({ esito }: { esito: EsitoImport }) {
  const a = esito.anagrafiche;
  const c = esito.commesse;

  return (
    <div className="flex flex-col gap-5">
      <div
        className={`rounded-xl border px-5 py-4 ${
          esito.prova
            ? "border-brand/40 bg-brand-soft/40"
            : "border-ok/40 bg-ok-soft/40"
        }`}
      >
        <p className="text-sm font-semibold">
          {esito.prova
            ? "Anteprima — nessun dato è stato scritto"
            : "Import completato"}
        </p>
        <p className="mt-0.5 text-sm text-ink-soft">
          Lette {esito.righeLette.anagrafiche.toLocaleString("it-IT")} righe
          anagrafiche e {esito.righeLette.offerte.toLocaleString("it-IT")} righe
          offerte.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="rounded-xl border border-line bg-panel p-5">
          <h3 className="text-sm font-semibold">Anagrafiche</h3>
          <dl className="mt-3 flex flex-col gap-2">
            <Numero label="Aziende" valore={a.aziende.toLocaleString("it-IT")} />
            <Numero label="Di cui clienti" valore={a.clienti.toLocaleString("it-IT")} />
            <Numero label="Di cui fornitori" valore={a.fornitori.toLocaleString("it-IT")} />
            <Numero label="Sia cliente sia fornitore" valore={a.entrambi.toLocaleString("it-IT")} />
            <Numero label="Referenti" valore={a.referenti} />
            <Numero label="Destinazioni" valore={a.destinazioni.toLocaleString("it-IT")} />
          </dl>
        </div>

        <div className="rounded-xl border border-line bg-panel p-5">
          <h3 className="text-sm font-semibold">Commesse</h3>
          <dl className="mt-3 flex flex-col gap-2">
            <Numero label="Importate" valore={c.importate.toLocaleString("it-IT")} />
            <Numero label="Di cui interne" valore={c.interne} />
            <Numero label="Numeri pre-allocati saltati" valore={c.preallocate} />
            <Numero label="Nuovi referenti" valore={c.referentiNuovi} />
          </dl>
          <div className="mt-3 flex flex-wrap gap-1.5 border-t border-line pt-3">
            {Object.entries(c.perStato).map(([k, n]) => (
              <span
                key={k}
                className="rounded-md bg-lead-soft px-2 py-0.5 font-mono text-[10px] text-ink-soft"
              >
                {k} {n}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-line bg-panel p-5">
        <h3 className="text-sm font-semibold">Somme di controllo</h3>
        <p className="mt-1 text-xs text-ink-soft">
          Confrontale con i totali scritti in testa al foglio offerte: se
          coincidono, non si è perso nulla per strada.
        </p>
        <dl className="mt-3 flex flex-col gap-2">
          <Numero label="Totale importi offerta" valore={`€ ${eur(esito.totali.offerte)}`} />
          <Numero label="Totale importi ordine" valore={`€ ${eur(esito.totali.ordini)}`} />
        </dl>
      </div>

      {esito.pmCreati.length > 0 && (
        <div className="rounded-xl border border-line bg-panel p-5">
          <h3 className="text-sm font-semibold">
            Project manager {esito.prova ? "da creare" : "creati"} disattivati (
            {esito.pmCreati.length})
          </h3>
          <p className="mt-1 text-xs text-ink-soft">
            Compaiono nelle commesse storiche ma non erano fra gli utenti. Sono
            creati <strong>senza password utilizzabile e disattivati</strong>: per
            farli accedere serve attivarli da Utenti.
          </p>
          <ul className="mt-3 flex flex-col gap-1">
            {esito.pmCreati.map((p) => (
              <li key={p} className="font-mono text-xs text-ink-soft">
                {p}
              </li>
            ))}
          </ul>
        </div>
      )}

      {esito.avvisi.length > 0 && (
        <div className="rounded-xl border border-warn/40 bg-warn-soft/50 px-5 py-4">
          <p className="text-sm font-semibold text-warn">Avvisi</p>
          <ul className="mt-1.5 flex list-disc flex-col gap-1 pl-4">
            {esito.avvisi.map((a) => (
              <li key={a} className="text-sm text-ink-soft">
                {a}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function ImportForm({ action }: { action: Azione }) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [pulisci, setPulisci] = useState(true);

  return (
    <div className="flex flex-col gap-6">
      <form
        action={formAction}
        onSubmit={(e) => {
          const modalita = (
            (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null
          )?.value;
          if (modalita !== "scrivi") return;
          const messaggio = pulisci
            ? "L'import sostituirà TUTTE le anagrafiche e le commesse esistenti (documenti, ordini, milestone e squadre compresi).\n\nProcedere?"
            : "L'import aggiornerà anagrafiche e commesse esistenti.\n\nProcedere?";
          if (!confirm(messaggio)) e.preventDefault();
        }}
        className="flex flex-col gap-5"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <ZonaFile
            nome="anagrafiche"
            etichetta="1 · Elenco anagrafiche"
            descrizione="Fornitori, clienti e destinazioni (.xls)"
          />
          <ZonaFile
            nome="offerte"
            etichetta="2 · Elenco offerte"
            descrizione="Commesse dell'anno (.xls)"
          />
        </div>

        <label className="flex items-start gap-2.5 rounded-lg border border-line bg-paper/40 px-4 py-3">
          <input
            type="checkbox"
            name="pulisci"
            checked={pulisci}
            onChange={(e) => setPulisci(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-line accent-brand"
          />
          <span className="text-sm">
            Sostituisci i dati esistenti
            <span className="mt-0.5 block text-xs text-ink-soft">
              Svuota anagrafiche e commesse prima di importare — insieme a
              documenti, ordini, milestone e squadre collegati. Utenti, operai e
              catalogo materiali restano. Senza la spunta i dati vengono
              aggiornati e affiancati.
            </span>
          </span>
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            name="modalita"
            value="prova"
            disabled={pending}
            className="rounded-lg border border-line bg-panel px-4 py-2.5 text-sm font-medium transition hover:border-brand/40 disabled:opacity-60"
          >
            {pending ? "Elaborazione…" : "Analizza senza scrivere"}
          </button>
          <button
            type="submit"
            name="modalita"
            value="scrivi"
            disabled={pending}
            className="rounded-lg bg-elettra px-4 py-2.5 text-sm font-semibold text-white transition disabled:opacity-60"
          >
            {pending ? "Import in corso…" : "Importa nel database"}
          </button>
          <span className="text-xs text-ink-faint">
            Può richiedere fino a un minuto: non chiudere la pagina.
          </span>
        </div>

        {state?.errore && (
          <p role="alert" className="text-sm font-medium text-danger">
            {state.errore}
          </p>
        )}
      </form>

      {state?.esito && <Riepilogo esito={state.esito} />}
    </div>
  );
}
