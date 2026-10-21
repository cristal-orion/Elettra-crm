import Link from "next/link";
import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/dal";
import { puoGestireCommesse, puoGestireDocumenti, TIPOLOGIE } from "@/lib/enums";
import { giornoAttivita } from "@/lib/attivita";
import { formatDate, formatEuro } from "@/lib/format";
import { DetailNavigation } from "@/components/navigation-context";
import CommessaDocumenti from "@/components/commessa-documenti";
import CommercialHistory from "@/components/commercial-history";
import { commercialOptions } from "../data";
import { PhaseForm, InteractionForm, ConversionForm } from "../workflow-forms";

export default async function OpportunityPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ pagina?: string; esito?: string }> }) {
  const user = await requireUser(), { id } = await params, sp = await searchParams;
  const canManage = puoGestireCommesse(user.ruolo);
  const row = await prisma.opportunita.findUnique({ where: { id }, include: { anagrafica: true, referente: true, responsabile: true, fase: true, commessa: { select: { id: true, numero: true } }, documenti: { orderBy: { createdAt: "desc" } }, attivita: { where: { stato: "DA_FARE", ...(canManage ? {} : { userId: user.id }) }, orderBy: { scadenza: { sort: "asc", nulls: "last" } }, take: 6, include: { user: { select: { nome: true, cognome: true } } } } } });
  if (!row) notFound();
  const options = canManage ? await commercialOptions() : null;
  const today = giornoAttivita().toISOString().slice(0, 10), closed = ["VINTA", "PERSA"].includes(row.fase.categoria);
  return <div className="min-w-0 space-y-6"><header><DetailNavigation listPath="/commerciale" listLabel="Commerciale" currentLabel={row.titolo} /><div className="mt-2 flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h1 className="break-words text-2xl font-bold">{row.titolo}</h1><p className="mt-1 text-sm text-ink-soft">{row.fase.nome} · Versione {row.versione}</p></div>{canManage && !closed && <Link href={`/commerciale/${id}/modifica`} className="min-h-11 rounded-lg border border-line px-4 py-3 text-sm">Modifica trattativa</Link>}</div></header>
    {sp.esito && <p role="status" className="rounded-lg bg-brand-soft p-3 text-sm text-brand-deep">{sp.esito === "interazione" ? "Contatto registrato." : "Trattativa salvata."}</p>}
    {row.commessa && <Link href={`/commesse/${row.commessa.id}`} className="block min-h-11 rounded-lg bg-brand-soft p-4 font-semibold text-brand-deep">Incarico confermato · Apri commessa {row.commessa.numero} →</Link>}
    {row.motivazionePersa && <p className="rounded-lg border border-line p-4 text-sm">Motivo della perdita: {row.motivazionePersa}</p>}
    <section aria-label="Dati della trattativa" className="grid min-w-0 gap-4 rounded-xl border border-line bg-panel p-4 sm:grid-cols-2 sm:p-6">
      <div><h2 className="text-xs text-ink-soft">Cliente</h2><Link href={`/anagrafiche/${row.anagraficaId}`} className="inline-flex min-h-11 items-center break-words text-brand-deep underline">{row.anagrafica.ragioneSociale}</Link>{row.anagrafica.isProspect && <p className="text-xs text-ink-soft">Potenziale cliente</p>}</div>
      <div><h2 className="text-xs text-ink-soft">Responsabile</h2><p>{row.responsabile ? `${row.responsabile.nome} ${row.responsabile.cognome}` : "Da assegnare"}</p></div>
      <div className="min-w-0"><h2 className="text-xs text-ink-soft">Referente e contatti</h2><p>{row.referente ? `${row.referente.nome} ${row.referente.cognome}` : "Nessun referente"}</p><p className="break-words text-sm text-ink-soft">{row.referente?.email || row.anagrafica.email || ""} · {row.referente?.telefono || row.anagrafica.telefono || ""}</p></div>
      <div><h2 className="text-xs text-ink-soft">Tipologia / origine</h2><p>{TIPOLOGIE[row.tipologia as keyof typeof TIPOLOGIE]} · {row.origine || "Non indicata"}</p></div>
      <div><h2 className="text-xs text-ink-soft">Valore previsto</h2><p>{row.valorePrevisto === null ? "Da stimare" : formatEuro(Number(row.valorePrevisto))}</p></div>
      <div><h2 className="text-xs text-ink-soft">Offerta</h2><p className="break-words">{row.riferimentoOfferta || "Nessuna offerta"} · {row.importoOfferta === null ? "—" : formatEuro(Number(row.importoOfferta))}</p><p className="text-sm text-ink-soft">Invio: {formatDate(row.dataInvioOfferta)} · Ultima risposta: {formatDate(row.ultimaRispostaIl)}</p></div>
      {row.descrizione && <p className="whitespace-pre-wrap break-words text-sm sm:col-span-2">{row.descrizione}</p>}
    </section>
    <section aria-label="Prossimi contatti" className="rounded-xl border border-line bg-panel p-4 sm:p-6"><h2 className="font-semibold">Prossimi contatti</h2><p className="text-xs text-ink-soft">{canManage ? "Attività del team" : "Le tue attività"}, presenti anche nell’agenda e nei promemoria.</p><ul className="mt-3 divide-y divide-line">{row.attivita.map((a) => <li key={a.id} className="py-2"><Link href={`/attivita/${a.id}`} className="inline-flex min-h-11 items-center text-sm text-brand-deep underline">{a.titolo}</Link><p className="text-xs text-ink-soft">{formatDate(a.scadenza)} · {a.user.nome} {a.user.cognome}</p></li>)}</ul>{!row.attivita.length && <p className="py-3 text-sm text-ink-soft">Nessun prossimo contatto pianificato.</p>}<div className="flex flex-wrap gap-3"><Link href={`/attivita/nuova?opportunitaId=${id}`} className="inline-flex min-h-11 items-center text-sm text-brand-deep underline">Pianifica attività</Link><Link href={`/attivita?opportunitaId=${id}&vista=${canManage ? "team" : "mie"}`} className="inline-flex min-h-11 items-center text-sm text-brand-deep underline">Tutte le attività collegate →</Link></div></section>
    {options && <div className="grid min-w-0 items-start gap-6 lg:grid-cols-2"><section className="min-w-0 space-y-4 rounded-xl border border-line bg-panel p-4 sm:p-6"><h2 className="font-semibold">Registra un contatto</h2><InteractionForm key={row.versione} id={id} versione={row.versione} richiestaId={randomUUID()} today={today} users={options.users} owner={options.users.some((u) => u.id === row.responsabileId) ? row.responsabileId! : user.id} /></section>{!row.commessa && <div className="min-w-0 space-y-6"><section className="space-y-4 rounded-xl border border-line bg-panel p-4 sm:p-6"><h2 className="font-semibold">{closed ? "Riapri trattativa" : "Avanza trattativa"}</h2><PhaseForm key={row.versione} id={id} versione={row.versione} faseId={row.faseId} fasi={options.fasi} /></section>{!closed && <section className="min-w-0 space-y-4 rounded-xl border border-line bg-panel p-4 sm:p-6"><h2 className="font-semibold">Conferma incarico</h2><ConversionForm key={row.versione} id={id} versione={row.versione} today={today} importo={row.importoOfferta?.toFixed(2) ?? ""} consuntivo={row.tipologia === "C"} pm={options.pm} /></section>}</div>}</div>}
    <CommessaDocumenti commerciale id={id} numero={`commerciale-${id}`} documenti={row.documenti} puoGestire={puoGestireDocumenti(user.ruolo)} />
    <CommercialHistory id={id} path={`/commerciale/${id}`} pagina={sp.pagina} />
  </div>;
}
