import { formatEuro } from "@/lib/format";
import type { EconomicsCliente } from "@/lib/economics";

export default function ClienteEconomics({
  economics: e,
  commesse,
}: {
  economics: EconomicsCliente;
  commesse: number;
}) {
  const negativo = e.margine !== null && Number(e.margine) < 0;

  return (
    <section aria-labelledby="economics-title" className="rounded-xl border border-line bg-panel p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="economics-title" className="text-base font-semibold">Economics</h2>
        <span className="text-xs text-ink-soft">Tutto lo storico · valori degli ordini</span>
      </div>
      <p className="mt-1 text-sm text-ink-soft">
        Quanto genera questo cliente e quanto spendiamo per le sue commesse.
      </p>

      <dl className="mt-5 grid gap-5 border-y border-line py-5 lg:grid-cols-3">
        <div>
          <dt className="text-sm text-ink-soft">Entrate · ordini acquisiti</dt>
          <dd className="mt-1 break-words text-2xl font-semibold tabular-nums tracking-tight text-brand-deep">
            {formatEuro(e.entrate)}
          </dd>
          <dd className="mt-1 text-xs text-ink-soft">
            {e.commesseAcquisite} commesse acquisite
            {e.importiMancanti > 0 && " · totale parziale"}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-ink-soft">Uscite · acquisti collegati</dt>
          <dd className="mt-1 break-words text-2xl font-semibold tabular-nums tracking-tight">
            {formatEuro(e.uscite)}
          </dd>
          <dd className="mt-1 text-xs text-ink-soft">
            {e.ordiniAcquisto} ordini a fornitore · imponibile
          </dd>
        </div>
        <div>
          <dt className="text-sm text-ink-soft">Margine sugli acquisti</dt>
          <dd className={`mt-1 break-words text-2xl font-semibold tabular-nums tracking-tight ${negativo ? "text-danger" : "text-brand-deep"}`}>
            {e.margine === null ? "Da completare" : formatEuro(e.margine)}
          </dd>
          <dd className="mt-1 text-xs text-ink-soft">
            {e.marginePercentuale !== null
              ? `${e.marginePercentuale.toLocaleString("it-IT")}% degli ordini acquisiti`
              : "Ordini acquisiti meno acquisti collegati"}
          </dd>
        </div>
      </dl>

      {commesse === 0 && (
        <p className="mt-4 text-sm text-ink-soft">
          Nessuna commessa collegata. I valori si aggiorneranno con i primi ordini e acquisti di questo cliente.
        </p>
      )}
      {e.importiMancanti > 0 && (
        <p className="mt-4 rounded-lg bg-warn-soft px-4 py-3 text-sm text-ink">
          Importo ordine mancante su {e.importiMancanti} commesse acquisite.
          Completa gli importi nelle commesse per calcolare il margine complessivo.
        </p>
      )}
      <p className="mt-4 text-xs leading-relaxed text-ink-soft">
        Gli importi rappresentano ordini e acquisti registrati, non incassi e pagamenti.
        Le uscite includono anche acquisti su commesse aperte o perse.
        Il margine esclude manodopera, spese generali e imposte; gli acquisti non registrati non sono conteggiati.
      </p>
      {commesse > 0 && (
        <a href="#commesse-cliente" className="mt-3 inline-block text-sm font-medium text-brand-deep underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand">
          Dettaglio economico per commessa ↓
        </a>
      )}
    </section>
  );
}
