"use client";
import { useActionState, useState } from "react";
import { useFormReady } from "@/components/form-ready";
import FormError from "@/components/form-error";
import { CATEGORIE_FASE, TIPI_INTERAZIONE, type FaseValues } from "@/lib/commerciale-schema";
import { METODI_RICEZIONE } from "@/lib/enums";
import { changePhase, addInteraction, convertOpportunity, savePhase } from "./actions";
import { commercialInput as cls } from "./opportunity-form";

type Person = { id: string; nome: string; cognome: string };
const button = "min-h-11 rounded-lg bg-elettra px-4 py-2 text-sm font-semibold text-white disabled:opacity-60";
export function PhaseForm({ id, versione, faseId, fasi }: { id: string; versione: number; faseId: string; fasi: FaseValues[] }) {
  const [state, action, pending] = useActionState(changePhase.bind(null, id, versione), undefined);
  const [fase, setFase] = useState(faseId);
  return <form action={action} className="space-y-3" aria-label="Cambia fase"><fieldset disabled={pending} className="space-y-3">
    <label className="flex flex-col gap-1 text-sm">Fase<select aria-label="Fase" name="faseId" value={fase} onChange={(e) => setFase(e.target.value)} className={cls}>{fasi.filter((f) => f.attiva && f.categoria !== "VINTA").map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}</select></label>
    {fasi.find((f) => f.id === fase)?.categoria === "PERSA" && <label className="flex flex-col gap-1 text-sm">Motivo della perdita *<textarea name="motivo" required maxLength={2000} className={cls} /></label>}
    <button className={button}>{pending ? "Aggiornamento…" : "Aggiorna fase"}</button>
  </fieldset><FormError error={state?.error} />{state?.ok && <p role="status" className="text-sm text-brand-deep">{state.ok}</p>}</form>;
}

export function InteractionForm({ id, versione, richiestaId, today, users, owner }: { id: string; versione: number; richiestaId: string; today: string; users: Person[]; owner: string }) {
  const [state, action, pending] = useActionState(addInteraction.bind(null, id), undefined), ready = useFormReady();
  const [v, set] = useState({ versione, richiestaId, tipo: "CHIAMATA", data: today, testo: "", esito: "", rispostaCliente: false });
  const [follow, setFollow] = useState(false), [task, setTask] = useState({ titolo: "", scadenza: today, userId: owner });
  return <form action={action} aria-label="Registra interazione" className="space-y-4"><input type="hidden" name="dati" value={JSON.stringify({ ...v, attivita: follow ? task : null })} />
    <fieldset disabled={!ready || pending} className="grid min-w-0 gap-3 sm:grid-cols-2">
      <label className="flex flex-col gap-1 text-sm">Tipo di contatto<select value={v.tipo} onChange={(e) => set({ ...v, tipo: e.target.value })} className={cls}>{Object.entries(TIPI_INTERAZIONE).map(([k, label]) => <option key={k} value={k}>{label}</option>)}</select></label>
      <label className="flex flex-col gap-1 text-sm">Data contatto *<input type="date" required max={today} value={v.data} onChange={(e) => set({ ...v, data: e.target.value })} className={cls} /></label>
      <label className="flex flex-col gap-1 text-sm sm:col-span-2">Contenuto *<textarea required maxLength={6000} rows={3} value={v.testo} onChange={(e) => set({ ...v, testo: e.target.value })} className={cls} /></label>
      <label className="flex flex-col gap-1 text-sm sm:col-span-2">Esito<input maxLength={2000} value={v.esito} onChange={(e) => set({ ...v, esito: e.target.value })} className={cls} /></label>
      <label className="flex min-h-11 items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={v.rispostaCliente} onChange={(e) => set({ ...v, rispostaCliente: e.target.checked })} />Risposta ricevuta dal cliente</label>
      <label className="flex min-h-11 items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} />Pianifica il prossimo contatto</label>
      {follow && <><label className="flex flex-col gap-1 text-sm sm:col-span-2">Prossimo passo *<input required maxLength={300} value={task.titolo} onChange={(e) => setTask({ ...task, titolo: e.target.value })} className={cls} /></label>
        <label className="flex flex-col gap-1 text-sm">Scadenza *<input type="date" required value={task.scadenza} onChange={(e) => setTask({ ...task, scadenza: e.target.value })} className={cls} /></label>
        <label className="flex flex-col gap-1 text-sm">Assegnato a<select required value={task.userId} onChange={(e) => setTask({ ...task, userId: e.target.value })} className={cls}><option value="">Seleziona</option>{users.map((u) => <option key={u.id} value={u.id}>{u.nome} {u.cognome}</option>)}</select></label></>}
    </fieldset><FormError error={state?.error} /><button disabled={!ready || pending} className={button}>{pending ? "Salvataggio…" : "Registra contatto"}</button>
  </form>;
}

export function ConversionForm({ id, versione, today, importo, consuntivo, pm }: { id: string; versione: number; today: string; importo: string; consuntivo: boolean; pm: Person[] }) {
  const [state, action, pending] = useActionState(convertOpportunity.bind(null, id), undefined), ready = useFormReady();
  const [v, set] = useState({ versione, dataOrdine: today, importoOrdine: importo, metodoRicezioneOrdine: "EMAIL", riferimentoConferma: "", pmId: "", conferma: false });
  return <form action={action} aria-label="Conferma incarico" className="space-y-4"><input type="hidden" name="dati" value={JSON.stringify(v)} />
    <p className="text-sm text-ink-soft">La conferma crea una commessa collegata e trasferisce i collegamenti di documenti e attività. Il potenziale cliente diventa cliente mantenendo la sua anagrafica.</p>
    {importo && <p className="text-xs text-ink-soft">Importo suggerito dall’offerta: verifica e correggi il valore effettivamente confermato.</p>}
    <fieldset disabled={!ready || pending} className="grid min-w-0 gap-3 sm:grid-cols-2">
      <label className="flex flex-col gap-1 text-sm">Data conferma *<input type="date" required max={today} value={v.dataOrdine} onChange={(e) => set({ ...v, dataOrdine: e.target.value })} className={cls} /></label>
      <label className="flex flex-col gap-1 text-sm">Importo confermato (€){!consuntivo && " *"}<input type="number" min="0" step="0.01" required={!consuntivo} value={v.importoOrdine} onChange={(e) => set({ ...v, importoOrdine: e.target.value })} className={cls} /></label>
      {consuntivo && <p className="text-xs text-ink-soft sm:col-span-2">Per il consuntivo puoi lasciare l’importo vuoto: sarà determinato dalle ore e dai materiali effettivi.</p>}
      <label className="flex flex-col gap-1 text-sm">Ricevuta tramite<select value={v.metodoRicezioneOrdine} onChange={(e) => set({ ...v, metodoRicezioneOrdine: e.target.value })} className={cls}>{Object.entries(METODI_RICEZIONE).map(([k, label]) => <option key={k} value={k}>{label}</option>)}</select></label>
      <label className="flex flex-col gap-1 text-sm">Riferimento conferma *<input required maxLength={200} placeholder="Email, ordine cliente, accordo del…" value={v.riferimentoConferma} onChange={(e) => set({ ...v, riferimentoConferma: e.target.value })} className={cls} /></label>
      <label className="flex flex-col gap-1 text-sm sm:col-span-2">Project Manager<select value={v.pmId} onChange={(e) => set({ ...v, pmId: e.target.value })} className={cls}><option value="">Da assegnare</option>{pm.map((u) => <option key={u.id} value={u.id}>{u.nome} {u.cognome}</option>)}</select></label>
      <label className="flex min-h-11 items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" required checked={v.conferma} onChange={(e) => set({ ...v, conferma: e.target.checked })} />Il cliente ha confermato l’incarico con questi dati</label>
    </fieldset><FormError error={state?.error} /><button disabled={!ready || pending} className={button}>{pending ? "Creazione…" : "Conferma incarico e crea commessa"}</button>
  </form>;
}

export function PhaseConfigForm({ initial }: { initial: FaseValues }) {
  const [state, action, pending] = useActionState(savePhase.bind(null, initial.id), undefined), ready = useFormReady();
  const [v, set] = useState(initial);
  const data = { versione: v.versione, nome: v.nome, categoria: v.categoria, ordine: v.ordine, attiva: v.attiva };
  return <form action={action} className="space-y-3 rounded-xl border border-line bg-panel p-4"><input type="hidden" name="dati" value={JSON.stringify(data)} />
    <fieldset disabled={!ready || pending} className="grid min-w-0 items-end gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <label className="flex flex-col gap-1 text-sm">Nome fase<input required maxLength={60} value={v.nome} onChange={(e) => set({ ...v, nome: e.target.value })} className={cls} /></label>
      <label className="flex flex-col gap-1 text-sm">Categoria<select disabled={initial.versione > 0} value={v.categoria} onChange={(e) => set({ ...v, categoria: e.target.value })} className={cls}>{Object.entries(CATEGORIE_FASE).filter(([k]) => initial.versione || !["VINTA", "PERSA"].includes(k)).map(([k, label]) => <option key={k} value={k}>{label}</option>)}</select></label>
      <label className="flex flex-col gap-1 text-sm">Ordine<input type="number" required min={0} max={1000} value={v.ordine} onChange={(e) => set({ ...v, ordine: Number(e.target.value) })} className={cls} /></label>
      <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={v.attiva} onChange={(e) => set({ ...v, attiva: e.target.checked })} />Attiva</label>
      <button className={button}>{initial.versione ? "Salva fase" : "Aggiungi fase"}</button>
    </fieldset><FormError error={state?.error} />
  </form>;
}
