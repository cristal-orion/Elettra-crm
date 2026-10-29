import Link from "next/link";
import { formatDate } from "@/lib/format";
import { PRIORITA_PROBLEMA, STATI_PROBLEMA } from "@/lib/cantiere-schema";

export function ProblemaStato({ stato, priorita }: { stato: string; priorita?: string }) {
  return <span className="flex flex-wrap items-center gap-2 text-xs"><span className={`rounded-full px-2.5 py-1 font-medium ${stato === "RISOLTA" ? "bg-ok-soft text-ok" : "bg-brand-soft text-brand-deep"}`}>{STATI_PROBLEMA[stato as keyof typeof STATI_PROBLEMA] ?? stato}</span>{priorita && <span className={priorita === "URGENTE" || priorita === "ALTA" ? "font-semibold text-danger" : "text-ink-soft"}>{PRIORITA_PROBLEMA[priorita as keyof typeof PRIORITA_PROBLEMA] ?? priorita}</span>}</span>;
}

export default function ProblemiList({ problemi }: { problemi: { id: string; titolo: string; stato: string; priorita: string; scadenza: Date | null; commessa?: { numero: string; cliente: { ragioneSociale: string } } }[] }) {
  return problemi.length ? <ul className="divide-y divide-line">{problemi.map((p) => <li key={p.id}><Link href={`/problemi/${p.id}`} className="flex min-h-20 flex-wrap items-center justify-between gap-3 px-4 py-4 hover:bg-paper sm:px-6"><div className="min-w-0 flex-[1_1_15rem]"><p className="break-words text-sm font-semibold text-brand-deep">{p.titolo}</p><p className="mt-1 text-xs text-ink-soft">{p.commessa && `${p.commessa.numero} · ${p.commessa.cliente.ragioneSociale} · `}{p.scadenza ? `Scadenza ${formatDate(p.scadenza)}` : "Senza scadenza"}</p></div><ProblemaStato stato={p.stato} priorita={p.priorita} /></Link></li>)}</ul> : <p className="p-6 text-sm text-ink-soft">Nessun problema in questa vista.</p>;
}
