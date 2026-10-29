"use client";

import Link from "next/link";
import { useRef, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { registraSal, cambiaSospensione, apriProblema, modificaProblema, type OperativoResult } from "@/app/(app)/progetti/operativo-actions";
import { STATI_MILESTONE } from "@/lib/enums";
import { avanzamento } from "@/lib/progetti";
import { PRIORITA_PROBLEMA, STATI_PROBLEMA } from "@/lib/cantiere-schema";

export const operativoInput = "min-h-12 w-full min-w-0 rounded-lg border border-line bg-panel px-3 py-2 text-base text-ink outline-none focus:border-brand sm:text-sm";
const primary = "inline-flex min-h-12 items-center justify-center rounded-lg bg-brand px-5 py-3 text-sm font-semibold text-white hover:bg-brand-deep disabled:cursor-wait disabled:opacity-70";
const secondary = "inline-flex min-h-12 items-center justify-center rounded-lg border border-line bg-panel px-5 py-3 text-sm font-medium text-ink hover:bg-paper";
export function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="flex min-w-0 flex-col gap-2 text-sm font-medium">{label}{children}</label>; }

function useSave(action: (data: FormData) => Promise<OperativoResult>) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const errorRef = useRef<HTMLParagraphElement>(null);
  function save(event: FormEvent<HTMLFormElement>, payload: unknown) {
    event.preventDefault();
    if (pending) return;
    const form = new FormData(event.currentTarget); form.set("dati", JSON.stringify(payload));
    setError("");
    start(async () => {
      try {
        const result = await action(form);
        if (result.error) { setError(result.error); requestAnimationFrame(() => errorRef.current?.focus()); }
        else if (result.href) { router.push(result.href); router.refresh(); }
      } catch { setError("Connessione interrotta. I dati inseriti sono ancora qui: riprova il salvataggio."); }
    });
  }
  return { pending, save, feedback: error ? <p ref={errorRef} tabIndex={-1} role="alert" className="rounded-lg bg-danger-soft p-4 text-sm text-danger">{error}</p> : null };
}

function Attachments() {
  const [names, setNames] = useState<string[]>([]);
  return <div className="space-y-2"><Field label="Foto o documenti (facoltativi)"><input type="file" name="files" multiple accept="image/jpeg,image/png,image/webp,image/heic,application/pdf" aria-describedby="file-help" className={`${operativoInput} file:mr-3 file:rounded-md file:border-0 file:bg-brand-soft file:px-3 file:py-2 file:text-brand-deep`} onChange={(e) => setNames(Array.from(e.target.files ?? [], (f) => f.name))} /></Field><p id="file-help" className="text-xs text-ink-soft">Fino a 5 foto o PDF, massimo 20 MB complessivi. Verranno salvati insieme all’aggiornamento.</p>{names.length > 0 && <ul className="space-y-1 text-sm text-ink-soft">{names.map((name, i) => <li className="break-words" key={`${i}-${name}`}>{name}</li>)}</ul>}</div>;
}

export function SalForm({ commessaId, richiestaId, versione, oggi, milestone }: { commessaId: string; richiestaId: string; versione: number; oggi: string; milestone: { id: string; titolo: string; stato: string; versione: string; durataGiorni: number | null }[] }) {
  const [states, setStates] = useState(Object.fromEntries(milestone.map((m) => [m.id, m.stato])));
  const { pending, save, feedback } = useSave(registraSal.bind(null, commessaId));
  const complete = Object.values(states).filter((s) => s === "COMPLETATA").length;
  const percent = avanzamento(milestone.map((m) => ({ ...m, stato: states[m.id] }))).percentuale;
  const previous = avanzamento(milestone).percentuale;
  const total = avanzamento(milestone).giorniPrevisti;
  return <form className="space-y-6" onSubmit={(event) => { const f = new FormData(event.currentTarget); save(event, { richiestaId, versione, data: f.get("data"), nota: f.get("nota"), milestone: milestone.map((m) => ({ id: m.id, stato: states[m.id], versione: m.versione })) }); }}>
    <fieldset disabled={pending} className="space-y-6">
      <div className="rounded-lg bg-brand-soft p-4"><p className="text-sm text-brand-deep">Avanzamento dopo il salvataggio</p><div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-brand-deep"><p className="text-3xl font-semibold tabular-nums">{percent === null ? "—" : `${percent}%`}</p><p className="text-sm">{complete} di {milestone.length} milestone completate</p></div><p className="mt-2 text-xs text-ink-soft">Attualmente {previous}%. Peso proporzionale ai giorni lavorativi previsti. Solo le fasi completate contribuiscono al SAL; il tempo trascorso non aumenta la percentuale.</p></div>
      <div className="space-y-4">{milestone.map((m) => <div key={m.id} className="space-y-1"><Field label={m.titolo}><select aria-label={`Stato ${m.titolo}`} value={states[m.id]} onChange={(e) => setStates({ ...states, [m.id]: e.target.value })} className={operativoInput}>{Object.entries(STATI_MILESTONE).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field><p className="text-xs text-ink-soft">{m.durataGiorni} giorni previsti · peso {((m.durataGiorni ?? 0) / total * 100).toLocaleString("it-IT", { maximumFractionDigits: 1 })}%</p></div>)}</div>
      <Field label="Data dell’aggiornamento"><input name="data" type="date" required defaultValue={oggi} max={oggi} className={operativoInput} /></Field>
      <Field label="Nota di cantiere"><textarea name="nota" maxLength={5000} rows={3} placeholder="Lavoro eseguito, verifiche o elementi da riprendere…" className={operativoInput} /></Field>
      <Attachments />
    </fieldset>
    {feedback}
    <div className="flex flex-wrap gap-3 border-t border-line pt-4"><button className={primary} disabled={pending || percent === null}>{pending ? "Salvataggio di SAL e allegati…" : "Salva aggiornamento SAL"}</button><Link className={secondary} href={`/progetti/${commessaId}?tab=avanzamento`}>Annulla</Link></div>
  </form>;
}

export function SospensioneForm({ commessaId, versione, richiestaId, sospeso }: { commessaId: string; versione: number; richiestaId: string; sospeso: boolean }) {
  const { save, pending, feedback } = useSave(cambiaSospensione.bind(null, commessaId));
  return <details className="rounded-lg border border-line bg-panel p-4"><summary className="min-h-11 cursor-pointer py-2 text-sm font-medium">{sospeso ? "Riprendi i lavori" : "Sospendi il cantiere"}</summary><form className="mt-3 space-y-4" onSubmit={(e) => save(e, { richiestaId, versione, sospeso: !sospeso, motivo: new FormData(e.currentTarget).get("motivo") })}><Field label={sospeso ? "Nota sulla ripresa (facoltativa)" : "Motivo della sospensione"}><textarea name="motivo" rows={2} required={!sospeso} minLength={sospeso ? undefined : 3} maxLength={5000} className={operativoInput} /></Field>{feedback}<button disabled={pending} className={secondary}>{pending ? "Salvataggio…" : sospeso ? "Conferma ripresa lavori" : "Conferma sospensione"}</button></form></details>;
}

export function ProblemaForm({ commessaId, richiestaId, utenti, initial }: { commessaId: string; richiestaId: string; utenti: { id: string; label: string }[]; initial?: { id: string; titolo: string; versione: number; stato: string; priorita: string; assegnatarioId: string | null; scadenza: string } }) {
  const { save, pending, feedback } = useSave(initial ? modificaProblema.bind(null, commessaId, initial.id) : apriProblema.bind(null, commessaId));
  const [createTask, setCreateTask] = useState(false);
  return <form className="space-y-5" onSubmit={(event) => {
    const f = new FormData(event.currentTarget);
    const base = { richiestaId, priorita: f.get("priorita"), assegnatarioId: f.get("assegnatarioId") || null, scadenza: f.get("scadenza") || null };
    save(event, initial ? { ...base, versione: initial.versione, stato: f.get("stato"), commento: f.get("commento") } : { ...base, titolo: f.get("titolo"), descrizione: f.get("descrizione"), creaAttivita: createTask });
  }}>
    <fieldset disabled={pending} className="space-y-5">
      {!initial && <><Field label="Titolo del problema"><input name="titolo" required minLength={3} maxLength={180} className={operativoInput} placeholder="Es. Materiale mancante per il quadro" /></Field><Field label="Cosa è successo?"><textarea name="descrizione" required minLength={3} maxLength={5000} rows={4} className={operativoInput} /></Field></>}
      {initial && <Field label="Stato"><select name="stato" aria-label="Stato" defaultValue={initial.stato} className={operativoInput}>{Object.entries(STATI_PROBLEMA).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>}
      <div className="grid gap-5 sm:grid-cols-2"><Field label="Priorità"><select name="priorita" aria-label="Priorità" defaultValue={initial?.priorita ?? "MEDIA"} className={operativoInput}>{Object.entries(PRIORITA_PROBLEMA).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field><Field label="Scadenza"><input name="scadenza" type="date" required={createTask} defaultValue={initial?.scadenza ?? ""} className={operativoInput} /></Field></div>
      <Field label="Assegna a"><select name="assegnatarioId" aria-label="Assegna a" required={createTask} defaultValue={initial?.assegnatarioId ?? ""} className={operativoInput}><option value="">Da assegnare</option>{utenti.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}</select></Field>
      <p className="text-xs text-ink-soft">Il responsabile riceve una notifica e può accedere a questo cantiere per gestire il problema.</p>
      {!initial && <label className="flex min-h-12 items-center gap-3 text-sm"><input type="checkbox" checked={createTask} onChange={(e) => setCreateTask(e.target.checked)} className="h-5 w-5 shrink-0 accent-brand" />Aggiungi anche un’attività nell’agenda del responsabile</label>}
      {initial && <Field label="Commento o nota di risoluzione"><textarea name="commento" rows={3} maxLength={5000} className={operativoInput} /></Field>}
      <Attachments />
    </fieldset>
    {feedback}
    <div className="flex flex-wrap gap-3 border-t border-line pt-4"><button className={primary} disabled={pending}>{pending ? "Salvataggio…" : initial ? "Salva aggiornamento" : "Apri problema"}</button><Link className={secondary} href={`/progetti/${commessaId}?tab=problemi`}>Torna al cantiere</Link></div>
  </form>;
}
