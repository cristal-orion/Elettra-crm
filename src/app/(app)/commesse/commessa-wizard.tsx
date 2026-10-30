"use client";

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import SearchableSelect from "@/components/searchable-select";
import SteppedNumberInput from "@/components/stepped-number-input";
import { useFormReady } from "@/components/form-ready";
import { METODI_RICEZIONE, TIPOLOGIE } from "@/lib/enums";
import { MATCH_REASONS, type AnagraficaMatches } from "@/lib/anagrafica-match";
import { fieldStep, wizardErrors, wizardSteps, type WizardValues } from "@/lib/commessa-wizard-schema";
import { saveCommessaDraft, confirmCommessaDraft, wizardCustomerContext } from "./wizard-actions";
import type { ClienteOption, PmOption } from "./commessa-form";

type Customer = ClienteOption & { isCliente: boolean; partitaIva: string | null; email: string | null; telefono: string | null; indirizzo: string | null; localita: string | null };
type Worker = { id: string; nome: string; cognome: string; squadre: { nome: string }[] };
type TextField = { [K in keyof WizardValues]: WizardValues[K] extends string ? K : never }[keyof WizardValues];
type Last = NonNullable<Awaited<ReturnType<typeof wizardCustomerContext>>["last"]>;
const inputCls = "min-h-11 w-full min-w-0 rounded-lg border border-line bg-panel px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";
const buttonCls = "min-h-11 rounded-lg border border-line px-4 py-2 text-sm font-medium disabled:opacity-50";

export default function CommessaWizard({ id, initial, initialVersion, initialStep, clienti, pms, operai, manageCustomers, documenti, children }: {
  id: string; initial: WizardValues; initialVersion: number; initialStep: number;
  clienti: Customer[]; pms: PmOption[]; operai: Worker[]; manageCustomers: boolean;
  documenti: { id: string; nomeFile: string }[]; children: ReactNode;
}) {
  const router = useRouter();
  const [draftId] = useState(id);
  const ready = useFormReady();
  const [v, setValues] = useState(initial);
  const [version, setVersion] = useState(initialVersion);
  const [step, setStep] = useState(initialStep);
  const [furthestStep, setFurthestStep] = useState(initialStep);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const documentVersion = documenti.map((d) => d.id).sort().join(",");
  const [confirmedDocuments, setConfirmedDocuments] = useState<string | null>(null);
  const confirmed = confirmedDocuments === documentVersion;
  const setConfirmed = (value: boolean) => setConfirmedDocuments(value ? documentVersion : null);
  const [similar, setSimilar] = useState<AnagraficaMatches | null>(null);
  const [last, setLast] = useState<Last | null>(null);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const suggested = v.suggerimentiConfermati;
  const [saved, setSaved] = useState(JSON.stringify(initial));
  const dirty = JSON.stringify(v) !== saved;
  const heading = useRef<HTMLHeadingElement>(null);
  const currentCustomer = !v.nuovoCliente ? clienti.find((c) => c.id === v.clienteId) : null;
  const currentPm = pms.find((p) => p.id === v.pmId);
  const unavailableWorkers = v.operai.filter((id) => !operai.some((o) => o.id === id));
  const needsOffer = v.tipologia === "P" || v.tipologia === "GARA";
  const run = (work: () => Promise<void>) => startTransition(async () => {
    try { await work(); }
    catch { setError("Connessione interrotta o operazione non completata. I campi sono rimasti nel modulo: riprova il salvataggio prima di uscire."); }
  });

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const update = <K extends keyof WizardValues>(key: K, value: WizardValues[K]) => {
    setValues((old) => ({ ...old, [key]: value, suggerimentiConfermati: old.suggerimentiConfermati.filter((k) => k !== key) }));
    setConfirmed(false); setMessage("");
    setErrors((old) => ({ ...old, [key]: "" }));
  };
  const changeCustomer = (clienteId: string, nuovoCliente = false) => {
    setValues((old) => ({ ...old, clienteId, nuovoCliente, referenteId: "", similaritaConfermata: false, fonteStorico: "", suggerimentiConfermati: [] }));
    setConfirmed(false); setLast(null); setSimilar(null); setHistoryLoaded(false); setMessage("Cliente cambiato: verifica i dati lavoro già inseriti, che non sono stati sovrascritti.");
    if (clienteId && !clienti.some((c) => c.id === clienteId)) router.refresh();
  };
  const errorFor = (key: string) => errors[key] ? <span id={`error-${key}`} className="text-xs text-danger">{errors[key]}</span> : null;
  const field = (key: TextField, label: string, type = "text") => <label className="flex min-w-0 flex-col gap-1.5" key={key}>
    <span className="text-sm text-ink-soft">{label}{suggested.some((k) => k === key) && <span className="ml-2 text-xs text-brand-deep">Suggerito · confermato</span>}</span>
    <input type={type} name={key} value={String(v[key])} aria-invalid={Boolean(errors[key])} aria-describedby={errors[key] ? `error-${key}` : undefined}
      className={inputCls} maxLength={300} onChange={(e) => {
        update(key, e.target.value);
        if (["ragioneSociale", "partitaIva", "codiceFiscale", "email", "telefono"].includes(key)) { setSimilar(null); setValues((old) => ({ ...old, similaritaConfermata: false })); }
      }} />{errorFor(key)}
  </label>;
  const money = (key: "importoOfferta" | "importoOrdine", label: string) => <label className="flex min-w-0 flex-col gap-1.5">
    <span className="text-sm text-ink-soft">{label}{needsOffer ? " *" : " (facoltativo)"}</span>
    <SteppedNumberInput name={key} value={v[key]} increment={10} precision={2} max={1e12} className={inputCls}
      aria-invalid={Boolean(errors[key])} aria-describedby={errors[key] ? `error-${key}` : undefined} onValueChange={(value) => update(key, value)} />{errorFor(key)}
  </label>;

  async function save(nextStep = step) {
    setError(""); setMessage("");
    const result = await saveCommessaDraft({ id: draftId, versione: version, passo: nextStep, dati: v });
    if (result.href) { router.push(result.href); return null; }
    if (result.error || result.versione === undefined) { setError(result.error ?? "Salvataggio non riuscito."); return null; }
    setVersion(result.versione); setSaved(JSON.stringify(v));
    if (new URL(window.location.href).searchParams.get("bozza") !== draftId) router.replace(`/commesse/nuova?bozza=${draftId}`, { scroll: false });
    setMessage("Bozza salvata. Puoi riprenderla da Le mie bozze.");
    return result.versione;
  }
  function go(next: number) {
    run(async () => {
      if (next > step) {
        const invalid = Object.fromEntries(Object.entries(wizardErrors(v)).filter(([key]) => (fieldStep[key as keyof WizardValues] ?? 0) < next));
        setErrors(invalid);
        if (Object.keys(invalid).length) { setError("Controlla i campi segnalati prima di proseguire."); return; }
        if (step === 0 && v.nuovoCliente) {
          const context = await wizardCustomerContext(v);
          if (context.error) { setError(context.error); return; }
          if (context.similar) {
            setSimilar(context.similar);
            if (context.similar.candidati.length && !v.similaritaConfermata) { setError("Verifica le anagrafiche simili prima di proseguire."); return; }
          }
        }
      }
      if (await save(next) === null) return;
      setStep(next); setError(""); setConfirmed(false);
      setFurthestStep((old) => Math.max(old, next));
      requestAnimationFrame(() => heading.current?.focus());
    });
  }
  function loadContext() {
    run(async () => {
      setError("");
      const result = await wizardCustomerContext(v);
      if (result.error) setError(result.error);
      if (result.similar) setSimilar(result.similar);
      if ("last" in result) { setLast(result.last ?? null); setHistoryLoaded(true); }
    });
  }
  function confirm() {
    run(async () => {
      const invalid = wizardErrors(v); setErrors(invalid);
      const first = Object.keys(invalid)[0];
      if (first) { setStep(fieldStep[first as keyof WizardValues] ?? 0); setError("Completa i campi segnalati."); return; }
      if (!confirmed) { setError("Conferma l’incarico nel riepilogo."); return; }
      const latestVersion = await save(4);
      if (latestVersion === null) return;
      const result = await confirmCommessaDraft({ id: draftId, versione: latestVersion, conferma: confirmed, documenti: documenti.map((d) => d.id) });
      if (result.error) setError(result.error);
      if (result.fieldErrors) {
        setErrors(result.fieldErrors);
        setStep(result.fieldErrors.documenti ? 3 : fieldStep[Object.keys(result.fieldErrors)[0] as keyof WizardValues] ?? 0);
        setConfirmed(false);
        router.refresh();
      }
      if (result.href) router.push(result.href);
    });
  }
  const suggestion = (key: "tipologia" | "pmId" | "indirizzoCantiere" | "referenteCommerciale", label: string, value: string | null, shown?: string) => value && !v[key] && <li key={key} className="flex flex-wrap items-center justify-between gap-2">
    <span className="min-w-0 break-words">{label}: {shown ?? value} <span className="text-xs text-ink-faint">· suggerito</span></span>
    <button type="button" className={buttonCls} onClick={() => {
      update(key, value);
      setValues((old) => ({ ...old, fonteStorico: last?.numero ?? "", suggerimentiConfermati: [...old.suggerimentiConfermati.filter((k) => k !== key), key] }));
    }}>Usa {label.toLowerCase()}</button>
  </li>;
  return <div className="flex min-w-0 flex-col gap-5">
    <nav aria-label="Passi creazione commessa"><ol className="grid gap-2 sm:grid-cols-5">{wizardSteps.map((label, i) => <li key={label}><button type="button" className={`${buttonCls} w-full text-left ${step === i ? "border-brand bg-brand-soft text-brand-deep" : "bg-panel text-ink-soft"}`} disabled={!ready || pending || i > Math.max(furthestStep, step + 1)} aria-current={step === i ? "step" : undefined} onClick={() => go(i)}>{i + 1}. {label}</button></li>)}</ol></nav>
    <p role="status" className="text-xs text-ink-soft">{pending ? "Operazione in corso…" : message || (dirty ? "Modifiche non salvate. Salva la bozza prima di uscire." : version ? "Bozza recuperata dal tuo archivio personale." : "Nessuna commessa creata: prepara una bozza.")}</p>
    <fieldset disabled={!ready || pending} className="min-w-0 rounded-xl border border-line bg-panel p-4 sm:p-6">
      <legend className="sr-only">Creazione guidata commessa</legend>
      <h2 ref={heading} tabIndex={-1} className="mb-5 text-lg font-semibold outline-none">Passo {step + 1} — {wizardSteps[step]}</h2>
      {step === 0 && <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2"><button type="button" aria-pressed={!v.nuovoCliente} className={buttonCls} onClick={() => changeCustomer("")}>Cliente esistente</button>{manageCustomers && <button type="button" aria-pressed={v.nuovoCliente} className={buttonCls} onClick={() => changeCustomer("", true)}>Nuovo cliente</button>}</div>
        {v.nuovoCliente ? <>
          <p className="text-sm text-ink-soft">Dati vuoti: inserisci solo quelli forniti. Il cliente sarà creato insieme alla commessa, dopo il riepilogo.</p>
          <div className="grid gap-4 sm:grid-cols-2">{field("ragioneSociale", "Ragione sociale *")}{field("partitaIva", "Partita IVA")}{field("codiceFiscale", "Codice fiscale")}{field("email", "Email", "email")}{field("telefono", "Telefono")}{field("indirizzo", "Indirizzo sede")}{field("localita", "Località")}</div>
          <button type="button" className={`${buttonCls} self-start`} onClick={loadContext}>Verifica anagrafiche simili</button>
          {similar && <div className="rounded-lg border border-line p-4"><p className="text-sm font-medium">{similar.candidati.length ? "Possibili anagrafiche già presenti" : "Nessuna anagrafica simile trovata."}</p><ul>{similar.candidati.map((c) => <li key={c.id} className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm"><span>{c.ragioneSociale} · {c.motivi.map((m) => MATCH_REASONS[m]).join(", ")}</span><button type="button" className={buttonCls} onClick={() => changeCustomer(c.id)}>Usa anagrafica esistente</button></li>)}</ul>{similar.altri && <p className="mt-2 text-xs">Altri risultati presenti: consulta l’anagrafica prima di creare.</p>}{similar.candidati.length > 0 && <label className="mt-4 flex items-start gap-2 text-sm"><input type="checkbox" checked={v.similaritaConfermata} onChange={(e) => update("similaritaConfermata", e.target.checked)} />Ho verificato: è un soggetto diverso. Confermo la nuova anagrafica.</label>}</div>}
        </> : <>
          <label htmlFor="wizard-cliente" className="text-sm text-ink-soft">Cliente *</label>
          <SearchableSelect id="wizard-cliente" name="clienteId" label="Cliente" value={v.clienteId} onValueChange={(value) => changeCustomer(value)} searchPlaceholder="Nome, codice, P. IVA, email o telefono…" placeholder="— Cerca un’anagrafica —" className={inputCls}
            options={clienti.map((c) => ({ value: c.id, label: `${c.codiceCliente ? `${c.codiceCliente} · ` : ""}${c.ragioneSociale}${c.isCliente ? "" : " · Da abilitare come cliente"}`, keywords: [c.partitaIva, c.email, c.telefono].filter(Boolean).join(" ") }))} />{errorFor("clienteId")}
          {currentCustomer && <div className="rounded-lg bg-paper/60 p-4 text-sm"><p>{[currentCustomer.indirizzo, currentCustomer.localita].filter(Boolean).join(" · ") || "Indirizzo sede non registrato"}</p><p>{[currentCustomer.email, currentCustomer.telefono].filter(Boolean).join(" · ") || "Contatti non registrati"}</p>{!currentCustomer.isCliente && <p className="mt-2 font-medium">Alla conferma sarà aggiunto il ruolo Cliente alla stessa anagrafica, senza duplicarla.</p>}</div>}
          <label htmlFor="wizard-referente" className="text-sm text-ink-soft">Referente cliente</label>
          <SearchableSelect id="wizard-referente" name="referenteId" label="Referente cliente" value={v.referenteId} onValueChange={(value) => update("referenteId", value)} className={inputCls}
            options={(currentCustomer?.referenti ?? []).map((r) => ({ value: r.id, label: `${r.nome} ${r.cognome}` }))} placeholder="— Nessuno —" searchPlaceholder="Cerca referente…" />
          {errorFor("referenteId")}
          <button type="button" disabled={!v.clienteId} onClick={loadContext} className={`${buttonCls} self-start`}>Usa dati ultima commessa</button>
          {historyLoaded && <p className="text-sm text-ink-soft">{last ? `Proposte dalla commessa ${last.numero}: conferma i singoli valori qui sotto. Nessun prezzo o risorsa sarà copiato.` : "Nessuna commessa precedente disponibile."}</p>}
        </>}
      </div>}
      {last && step < 4 && <aside aria-label="Suggerimenti dallo storico" className="my-4 rounded-lg border border-brand/30 bg-brand-soft/30 p-4 text-sm"><p className="font-medium">Suggerimenti dalla <Link href={`/commesse/${last.id}`} target="_blank" className="underline">commessa {last.numero}</Link> · solo campi vuoti</p><ul className="mt-3 flex flex-col gap-2">
        {suggestion("tipologia", "Tipologia", last.tipologia, last.tipologia ? TIPOLOGIE[last.tipologia as keyof typeof TIPOLOGIE] : undefined)}
        {suggestion("pmId", "PM", pms.some((p) => p.id === last.pmId) ? last.pmId : null, pms.filter((p) => p.id === last.pmId).map((p) => `${p.nome} ${p.cognome}`).join(""))}
        {suggestion("indirizzoCantiere", "Indirizzo cantiere", last.indirizzoCantiere)}
        {suggestion("referenteCommerciale", "Referente commerciale", last.referenteCommerciale)}
      </ul><p className="mt-2 text-xs text-ink-soft">Se tutti i campi sono già compilati, non verrà sovrascritto nulla.</p></aside>}
      {step === 1 && <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex min-w-0 flex-col gap-1.5 sm:col-span-2"><span className="text-sm text-ink-soft">Descrizione lavoro *</span><textarea name="descrizione" value={v.descrizione} onChange={(e) => update("descrizione", e.target.value)} rows={3} maxLength={10000} className={inputCls} aria-invalid={Boolean(errors.descrizione)} aria-describedby="error-descrizione" />{errorFor("descrizione")}</label>
        <label className="flex min-w-0 flex-col gap-1.5"><span className="text-sm text-ink-soft">Tipologia *{suggested.includes("tipologia") && " · Suggerita, confermata"}</span><select name="tipologia" value={v.tipologia} onChange={(e) => update("tipologia", e.target.value)} className={inputCls} aria-invalid={Boolean(errors.tipologia)} aria-describedby="error-tipologia"><option value="">— Seleziona —</option>{Object.entries(TIPOLOGIE).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>{errorFor("tipologia")}</label>
        {field("indirizzoCantiere", "Indirizzo cantiere")}
        <p className="text-sm text-ink-soft sm:col-span-2">Offerta e ordine restano distinti. Consuntivo e Tariffario possono non avere un’offerta o un importo finale: il rendiconto si compilerà nella commessa.</p>
        {money("importoOfferta", "Importo offerta (€)")}{money("importoOrdine", "Importo ordine confermato (€)")}{field("dataInvio", `Data invio offerta${needsOffer ? " *" : ""}`, "date")}
      </div>}
      {step === 2 && <div className="grid gap-4 sm:grid-cols-2">
        {field("dataRichiesta", "Data richiesta *", "date")}{field("dataOrdine", "Data conferma incarico *", "date")}
        <label className="flex min-w-0 flex-col gap-1.5"><span className="text-sm text-ink-soft">Ricezione conferma *</span><select name="metodoRicezioneOrdine" value={v.metodoRicezioneOrdine} onChange={(e) => update("metodoRicezioneOrdine", e.target.value)} className={inputCls} aria-invalid={Boolean(errors.metodoRicezioneOrdine)} aria-describedby="error-metodoRicezioneOrdine"><option value="">— Seleziona —</option>{Object.entries(METODI_RICEZIONE).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>{errorFor("metodoRicezioneOrdine")}</label>
        {field("oda", "Riferimento conferma *")}
        <div className="flex min-w-0 flex-col gap-1.5"><label htmlFor="wizard-pm" className="text-sm text-ink-soft">Project Manager{suggested.includes("pmId") && " · Suggerito, confermato"}</label><SearchableSelect id="wizard-pm" name="pmId" label="Project Manager" value={v.pmId} onValueChange={(value) => update("pmId", value)} className={inputCls} options={pms.map((p) => ({ value: p.id, label: `${p.nome} ${p.cognome}` }))} placeholder="— Non assegnato —" searchPlaceholder="Cerca PM…" />{errorFor("pmId")}</div>
        {field("referenteCommerciale", "Referente commerciale")}{field("dataInizioLavori", "Inizio lavori", "date")}{field("scadenzaLavori", "Scadenza lavori", "date")}
        <label className="flex min-w-0 flex-col gap-1.5 sm:col-span-2"><span className="text-sm text-ink-soft">Note cantiere</span><textarea name="noteCantiere" value={v.noteCantiere} onChange={(e) => update("noteCantiere", e.target.value)} rows={3} maxLength={10000} className={inputCls} /></label>
      </div>}
      {step === 3 && <div className="flex flex-col gap-4"><p className="text-sm text-ink-soft">Selezione facoltativa delle risorse per l’intervallo inizio–scadenza lavori. Gli impegni contemporanei sono consentiti e segnalati nella commessa dopo la conferma. Finché è una bozza non vengono create assegnazioni.</p>
        {errorFor("operai")}
        {unavailableWorkers.length > 0 && <div className="rounded-lg border border-warn/40 p-3 text-sm"><p>Alcune risorse selezionate non sono più disponibili. Rimuovile per proseguire.</p><ul>{unavailableWorkers.map((id) => <li key={id} className="mt-2"><button type="button" className={buttonCls} onClick={() => update("operai", v.operai.filter((value) => value !== id))}>Rimuovi risorsa non disponibile · {id}</button></li>)}</ul></div>}
        <ul className="max-h-80 overflow-auto rounded-lg border border-line p-3">{operai.map((o) => <li key={o.id}><label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={v.operai.includes(o.id)} onChange={(e) => update("operai", e.target.checked ? [...v.operai, o.id] : v.operai.filter((x) => x !== o.id))} />{o.nome} {o.cognome}{o.squadre.length ? ` · ${o.squadre.map((s) => s.nome).join(", ")}` : ""}</label></li>)}{!operai.length && <li className="text-sm text-ink-faint">Nessuna risorsa attiva. Potrai assegnarla dal progetto.</li>}</ul>
        <p className="text-sm text-ink-soft">Gli allegati si gestiscono nel riquadro sotto, dopo il salvataggio della bozza.</p>
        {errorFor("documenti")}
      </div>}
      {step === 4 && <div className="flex flex-col gap-5">
        {v.suggerimentiConfermati.length > 0 && <p className="text-xs text-brand-deep">Valori suggeriti e confermati dalla commessa {v.fonteStorico}: {v.suggerimentiConfermati.map((key) => ({ pmId: "PM", tipologia: "tipologia", indirizzoCantiere: "indirizzo cantiere", referenteCommerciale: "referente commerciale" })[key]).join(", ")}. Modificabili tornando ai passi precedenti.</p>}
        <dl className="grid gap-4 text-sm sm:grid-cols-2">{[
          ["Cliente", v.nuovoCliente ? `${v.ragioneSociale} · nuova anagrafica` : currentCustomer?.ragioneSociale ?? "Non disponibile"],
          ["Referente", currentCustomer?.referenti.filter((r) => r.id === v.referenteId).map((r) => `${r.nome} ${r.cognome}`).join("")],
          ["Lavoro", v.descrizione], ["Tipologia", TIPOLOGIE[v.tipologia as keyof typeof TIPOLOGIE]],
          ["Indirizzo cantiere", v.indirizzoCantiere], ["PM", currentPm ? `${currentPm.nome} ${currentPm.cognome}` : "Non assegnato"],
          ["Offerta (€)", v.importoOfferta || "Non definita"], ["Ordine confermato (€)", v.importoOrdine || "Non definito"],
          ["Invio offerta", v.dataInvio], ["Richiesta", v.dataRichiesta],
          ["Conferma incarico", `${v.dataOrdine} · ${METODI_RICEZIONE[v.metodoRicezioneOrdine as keyof typeof METODI_RICEZIONE] ?? ""} · ${v.oda}`],
          ["Referente commerciale", v.referenteCommerciale], ["Inizio–scadenza lavori", `${v.dataInizioLavori || "—"} → ${v.scadenzaLavori || "—"}`], ["Note cantiere", v.noteCantiere],
          ["Risorse", [...operai.filter((o) => v.operai.includes(o.id)).map((o) => `${o.nome} ${o.cognome}`), ...unavailableWorkers.map(() => "Risorsa non più disponibile: torna al passo Risorse/allegati")].join(", ") || "Nessuna"],
          ["Documenti", documenti.map((d) => d.nomeFile).join(", ") || "Nessuno"],
          ...(v.nuovoCliente ? [["Dati nuovo cliente", [v.partitaIva, v.codiceFiscale, v.email, v.telefono, v.indirizzo, v.localita].filter(Boolean).join(" · ") || "Nessun dato aggiuntivo"]] : []),
        ].map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-ink-faint">{label}</dt><dd className="mt-1 whitespace-pre-line break-words font-medium">{value || "—"}</dd></div>)}</dl>
        <div className="rounded-lg border border-brand/30 bg-brand-soft/30 p-4 text-sm"><p>La conferma crea una commessa in stato <strong>Ordine confermato</strong>, collega documenti e risorse, registra autore e dati economici iniziali.{v.nuovoCliente ? " Crea anche il nuovo cliente." : currentCustomer && !currentCustomer.isCliente ? " Attribuisce il ruolo Cliente all’anagrafica selezionata." : ""} Nessuna stima verrà trattata come importo approvato.</p><label className="mt-4 flex items-start gap-3"><input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} /><span>Confermo l’incarico ricevuto dal cliente e i dati del riepilogo.</span></label></div>
        <button type="button" onClick={confirm} className="min-h-11 self-start rounded-lg bg-elettra px-5 py-3 text-sm font-semibold text-white">Conferma incarico e crea commessa</button>
      </div>}
    </fieldset>
    {step === 3 && (children || <p className="text-sm text-ink-soft">Salva la bozza per caricare i documenti.</p>)}
    {error && <p role="alert" className="rounded-lg border border-danger/30 bg-danger-soft p-4 text-sm text-danger">{error}</p>}
    <div className="flex flex-wrap gap-3"><button type="button" className={buttonCls} disabled={!ready || pending || step === 0} onClick={() => go(step - 1)}>← Passo precedente</button><button type="button" className={buttonCls} disabled={!ready || pending} onClick={() => run(async () => { await save(); })}>Salva bozza</button>{step < 4 && <button type="button" className={`${buttonCls} bg-elettra text-white`} disabled={!ready || pending} onClick={() => go(step + 1)}>Passo successivo →</button>}<Link href="/commesse/bozze" onClick={(e) => { if (dirty && !window.confirm("Ci sono modifiche non salvate. Uscire senza salvarle?")) e.preventDefault(); }} className={`${buttonCls} text-ink-soft`}>Esci dalle modifiche</Link></div>
  </div>;
}
