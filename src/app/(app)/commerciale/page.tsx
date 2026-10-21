import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/dal";
import { isSuperAdmin, puoGestireCommesse } from "@/lib/enums";
import { formatDate, formatEuro } from "@/lib/format";
import { commercialeList, SITUAZIONI_COMMERCIALI, type CommercialeParams } from "@/lib/commerciale-list";
import { listHref } from "@/lib/list-state";
import ListFilters from "@/components/list-filters";
import ListPagination from "@/components/list-pagination";
import { commercialOptions } from "./data";
import { PhaseForm } from "./workflow-forms";

export const metadata = { title: "Commerciale — CRM Elettra" };
export default async function CommercialePage({ searchParams }: { searchParams: Promise<CommercialeParams> }) {
  const user = await requireUser();
  const [result, options] = await Promise.all([commercialeList(prisma, user, await searchParams), commercialOptions()]);
  const { filters: f, totals: t, rows, phases, pagination } = result;
  const href = (changes: Record<string, string>) => listHref("/commerciale", new URLSearchParams(f).toString(), changes);
  const closed = t.vinte + t.perse;
  const card = (row: typeof rows[number]) => <article key={row.id} className="min-w-0 space-y-2 rounded-lg border border-line bg-panel p-4">
    <Link href={`/commerciale/${row.id}`} className="block break-words font-semibold text-brand-deep hover:underline">{row.titolo}</Link>
    <p className="break-words text-sm">{row.anagrafica.ragioneSociale}</p>
    <p className="text-xs text-ink-soft">{row.responsabile ? `${row.responsabile.nome} ${row.responsabile.cognome}` : "Responsabile da assegnare"}</p>
    <p className="text-sm">{row.valorePrevisto === null ? "Valore da stimare" : formatEuro(Number(row.valorePrevisto))}</p>
    <p className="text-xs text-ink-faint">Creata il {formatDate(row.createdAt)}</p>
    {row.attivita[0] && <Link href={`/attivita/${row.attivita[0].id}`} className="block break-words text-xs text-brand-deep underline">{formatDate(row.attivita[0].scadenza)} · {row.attivita[0].titolo}</Link>}
    {row.commessa && <Link href={`/commesse/${row.commessa.id}`} className="inline-flex min-h-11 items-center text-xs text-brand-deep underline">Commessa {row.commessa.numero} →</Link>}
    {puoGestireCommesse(user.ruolo) && !row.commessa && <details><summary className="min-h-11 cursor-pointer py-3 text-xs text-brand-deep">Sposta fase</summary><PhaseForm key={row.versione} id={row.id} versione={row.versione} faseId={row.faseId} fasi={options.fasi} /><Link href={`/commerciale/${row.id}`} className="inline-flex min-h-11 items-center text-xs text-brand-deep underline">Conferma incarico dalla scheda →</Link></details>}
  </article>;
  return <div className="min-w-0 space-y-6">
    <header className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-bold">Commerciale</h1><p className="text-sm text-ink-soft">Dal primo contatto alla conferma dell’incarico</p></div><div className="flex flex-wrap gap-2">{isSuperAdmin(user.ruolo) && <Link href="/commerciale/fasi" className="min-h-11 rounded-lg border border-line px-4 py-3 text-sm">Configura fasi</Link>}{puoGestireCommesse(user.ruolo) && <Link href="/commerciale/nuova" className="min-h-11 rounded-lg bg-elettra px-4 py-3 text-sm font-semibold text-white">Nuova trattativa</Link>}</div></header>
    <ListFilters q={f.q} placeholder="Titolo, cliente, referente, offerta…" total={t.total} similar={result.similar} filters={[
      { name: "fase", label: "Fase", value: f.fase, options: [{ value: "", label: "Tutte le fasi" }, ...options.fasi.map((v) => ({ value: v.id, label: v.nome }))] },
      { name: "situazione", label: "Situazione", value: f.situazione, defaultValue: "tutte", options: Object.entries(SITUAZIONI_COMMERCIALI).map(([value, label]) => ({ value, label })) },
      { name: "cliente", label: "Cliente", value: f.cliente, options: [{ value: "", label: "Tutti i clienti" }, ...options.anagrafiche.map((a) => ({ value: a.id, label: a.ragioneSociale }))] },
      { name: "responsabile", label: "Responsabile", value: f.responsabile, options: [{ value: "", label: "Tutti i responsabili" }, { value: "nessuno", label: "Da assegnare" }, ...options.responsabili.map((u) => ({ value: u.id, label: `${u.nome} ${u.cognome}` }))] },
      { name: "periodo", label: "Creazione", value: f.periodo, options: [{ value: "", label: "Qualsiasi periodo" }, { value: "30", label: "Ultimi 30 giorni" }, { value: "90", label: "Ultimi 90 giorni" }, { value: "anno", label: "Quest'anno" }] },
      { name: "ordine", label: "Ordina", value: f.ordine, defaultValue: "recenti", options: [{ value: "recenti", label: "Più recenti" }, { value: "titolo", label: "Titolo" }, { value: "valore", label: "Valore decrescente" }, { value: "contatto", label: "Prossimo contatto" }] },
    ]} />
    <section aria-label="Indicatori commerciali" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[
      ["Trattative aperte", t.aperte], ["Valore pipeline", formatEuro(Number(t.pipeline))], ["Vinte / perse", `${t.vinte} / ${t.perse}`], ["Conversione sulle chiuse", closed ? `${Math.round(t.vinte / closed * 100)}%` : "—"],
    ].map(([label, value]) => <div key={label} className="rounded-xl border border-line bg-panel p-4"><p className="text-xs text-ink-soft">{label}</p><p className="mt-1 text-xl font-semibold">{value}</p></div>)}</section>
    <p className="text-xs text-ink-soft">Indicatori su tutte le trattative dei filtri correnti. Pipeline = somma dei valori previsti delle aperte; {t.senzaValore} senza stima. Conversione = vinte / (vinte + perse). Il periodo filtra la data di creazione. Lo storico delle vecchie commesse resta nella sezione Commesse.</p>
    <div className="flex flex-wrap gap-2 text-sm"><Link href={href({ situazione: "richiamare" })} className="min-h-11 rounded-lg border border-line px-3 py-3">Da ricontattare: {t.richiamare}</Link><Link href={href({ situazione: "senzaRisposta" })} className="min-h-11 rounded-lg border border-line px-3 py-3">Offerte senza risposta: {t.senzaRisposta}</Link><Link href={href({ situazione: "ferme" })} className="min-h-11 rounded-lg border border-line px-3 py-3">Trattative ferme: {t.ferme}</Link></div>
    <nav aria-label="Vista commerciale" className="flex gap-2">{["kanban", "elenco"].map((vista) => <Link key={vista} href={href({ vista })} aria-current={f.vista === vista ? "page" : undefined} className={`min-h-11 rounded-lg px-4 py-3 text-sm ${f.vista === vista ? "bg-brand-soft font-semibold text-brand-deep" : "border border-line"}`}>{vista === "kanban" ? "Kanban" : "Elenco"}</Link>)}</nav>
    {f.vista === "kanban" ? <><p className="text-xs text-ink-soft">Fino a 10 schede per fase, nell’ordine scelto. Apri una scheda per avanzare la trattativa o confermare l’incarico.</p><div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-4">{options.fasi.filter((fase) => (!f.fase || f.fase === fase.id) && (fase.attiva || phases.some((p) => p.faseId === fase.id))).map((fase) => {
      const total = phases.find((p) => p.faseId === fase.id)?.total ?? 0;
      return <section key={fase.id} className="min-w-0 space-y-3 rounded-xl bg-paper/70 p-3" aria-label={fase.nome}><h2 className="flex justify-between gap-2 font-semibold">{fase.nome}<span className="text-ink-faint">{total}</span></h2>{rows.filter((r) => r.faseId === fase.id).map(card)}{!total && <p className="py-4 text-sm text-ink-faint">Nessuna trattativa</p>}{total > 10 && <Link href={href({ fase: fase.id, vista: "elenco" })} className="inline-flex min-h-11 items-center text-sm text-brand-deep underline">Mostra tutte ({total}) →</Link>}</section>;
    })}</div></> : <><div className="overflow-x-auto rounded-xl border border-line bg-panel"><table className="w-full text-left text-sm"><thead className="bg-paper text-xs text-ink-soft"><tr>{["Trattativa / cliente", "Fase", "Responsabile", "Valore previsto", "Creazione", "Prossimo passo"].map((label) => <th key={label} scope="col" className="whitespace-nowrap p-3">{label}</th>)}</tr></thead><tbody>{rows.map((r) => <tr key={r.id} className="border-t border-line"><td className="min-w-52 p-3"><Link href={`/commerciale/${r.id}`} className="inline-flex min-h-11 items-center font-semibold text-brand-deep underline">{r.titolo}</Link><p>{r.anagrafica.ragioneSociale}</p></td><td className="p-3">{r.fase.nome}</td><td className="p-3">{r.responsabile ? `${r.responsabile.nome} ${r.responsabile.cognome}` : "Da assegnare"}</td><td className="whitespace-nowrap p-3">{r.valorePrevisto === null ? "Da stimare" : formatEuro(Number(r.valorePrevisto))}</td><td className="whitespace-nowrap p-3">{formatDate(r.createdAt)}</td><td className="min-w-44 p-3">{r.attivita[0] ? <Link href={`/attivita/${r.attivita[0].id}`} className="inline-flex min-h-11 items-center text-brand-deep underline">{formatDate(r.attivita[0].scadenza)} · {r.attivita[0].titolo}</Link> : "Non pianificato"}</td></tr>)}</tbody></table></div>{!t.total && <p className="py-8 text-center text-ink-soft">Nessuna trattativa trovata.</p>}<ListPagination path="/commerciale" params={f} page={pagination.page} pages={pagination.pages} /></>}
  </div>;
}
