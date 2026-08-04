import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/dal";
import {
  puoGestireSegnalazioni,
  etichettaTipoSegnalazione,
} from "@/lib/enums";
import { formatBytes, formatDate } from "@/lib/format";
import {
  PrioritaBadge,
  StatoSegnalazioneBadge,
} from "@/components/badges";
import {
  AggiungiAllegatiForm,
  BottoneConferma,
  CambiaStatoForm,
  EliminaAllegatoBottone,
  ModificaSegnalazioneForm,
} from "../segnalazioni-ui";
import {
  aggiungiAllegati,
  cambiaStato,
  eliminaAllegato,
  eliminaSegnalazione,
  updateSegnalazione,
} from "../actions";

export default async function SegnalazioneDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const s = await prisma.segnalazione.findUnique({
    where: { id },
    include: {
      autore: { select: { nome: true, cognome: true, email: true, ruolo: true } },
      allegati: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!s) notFound();

  const user = await requireUser();
  const puoGestire = puoGestireSegnalazioni(user.ruolo);
  // L'autore può correggere quel che ha scritto finché la nota non è chiusa.
  const puoModificare = puoGestire || (s.autoreId === user.id && s.stato !== "CONCLUSA");

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Link
            href="/segnalazioni"
            className="font-mono text-xs uppercase tracking-wider text-ink-faint hover:text-brand-deep"
          >
            ← Segnalazioni
          </Link>
          <h1 className="mt-2 text-2xl font-bold tracking-tight">{s.titolo}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2.5">
            <StatoSegnalazioneBadge stato={s.stato} />
            <PrioritaBadge priorita={s.priorita} />
            <span className="text-xs text-ink-soft">
              {etichettaTipoSegnalazione(s.tipo)}
            </span>
          </div>
        </div>
        {puoModificare && (
          <BottoneConferma
            action={eliminaSegnalazione.bind(null, s.id)}
            etichetta="Elimina"
            conferma={`Eliminare la segnalazione «${s.titolo}» e le sue schermate?`}
            variante="danger"
          />
        )}
      </header>

      <div className="grid gap-5 md:grid-cols-3">
        <div className="rounded-xl border border-line bg-panel p-5 md:col-span-2">
          <h2 className="text-sm font-semibold">Cosa è stato segnalato</h2>
          <p className="mt-3 whitespace-pre-wrap text-sm text-ink-soft">
            {s.descrizione}
          </p>
        </div>

        <div className="rounded-xl border border-line bg-panel p-5">
          <h2 className="text-sm font-semibold">Dettagli</h2>
          <dl className="mt-3 flex flex-col gap-2">
            <Riga label="Aperta da" valore={`${s.autore.nome} ${s.autore.cognome}`} />
            <Riga label="Il" valore={formatDate(s.createdAt)} />
            {s.pagina && <Riga label="Schermata" valore={s.pagina} mono link />}
            {s.conclusaIl && (
              <Riga label="Conclusa il" valore={formatDate(s.conclusaIl)} />
            )}
          </dl>
        </div>
      </div>

      {s.stato === "CONCLUSA" && s.risoluzione && (
        <section className="rounded-xl border border-ok/40 bg-ok-soft/40 px-5 py-4">
          <h2 className="text-sm font-semibold text-ok">Come è stata risolta</h2>
          <p className="mt-1.5 whitespace-pre-wrap text-sm text-ink-soft">
            {s.risoluzione}
          </p>
        </section>
      )}

      {/* Schermate */}
      <section className="rounded-xl border border-line bg-panel p-6">
        <h2 className="text-sm font-semibold">
          Schermate{" "}
          <span className="font-normal text-ink-faint">({s.allegati.length})</span>
        </h2>

        {s.allegati.length === 0 ? (
          <p className="mt-3 text-sm text-ink-faint">Nessuna schermata allegata.</p>
        ) : (
          <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {s.allegati.map((a) => (
              <li
                key={a.id}
                className="group relative overflow-hidden rounded-lg border border-line bg-paper"
              >
                <a
                  href={`/segnalazioni/allegato/${a.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Apri a dimensione piena"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/segnalazioni/allegato/${a.id}`}
                    alt={a.nomeFile}
                    className="h-40 w-full bg-white object-contain"
                  />
                </a>
                <div className="flex items-center justify-between gap-2 border-t border-line px-3 py-2">
                  <span className="min-w-0 flex-1 truncate text-xs" title={a.nomeFile}>
                    {a.nomeFile}
                  </span>
                  <span className="shrink-0 font-mono text-[10px] text-ink-faint">
                    {formatBytes(a.dimensione)}
                  </span>
                </div>
                {puoModificare && (
                  <div className="absolute right-2 top-2 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
                    <EliminaAllegatoBottone
                      action={eliminaAllegato.bind(null, a.id)}
                      nome={a.nomeFile}
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        {puoModificare && s.allegati.length < 6 && (
          <div className="mt-5 border-t border-line pt-5">
            <AggiungiAllegatiForm action={aggiungiAllegati.bind(null, s.id)} />
          </div>
        )}
      </section>

      {/* Presa in carico */}
      {puoGestire && (
        <section className="rounded-xl border border-line bg-panel p-6">
          <h2 className="text-sm font-semibold">Presa in carico</h2>
          <p className="mt-1 text-xs text-ink-soft">
            Segna <span className="font-medium">In lavorazione</span> mentre la
            sistemi, <span className="font-medium">Conclusa</span> quando è fatta:
            resta nello storico e chi ha segnalato vede cosa è cambiato.
          </p>
          <div className="mt-4">
            <CambiaStatoForm
              action={cambiaStato.bind(null, s.id)}
              stato={s.stato}
              risoluzione={s.risoluzione}
            />
          </div>
        </section>
      )}

      {puoModificare && (
        <section className="rounded-xl border border-line bg-panel p-6">
          <details>
            <summary className="cursor-pointer text-sm font-semibold">
              Correggi il testo della segnalazione
            </summary>
            <ModificaSegnalazioneForm
              action={updateSegnalazione.bind(null, s.id)}
              titolo={s.titolo}
              descrizione={s.descrizione}
              tipo={s.tipo}
              priorita={s.priorita}
            />
          </details>
        </section>
      )}
    </div>
  );
}

function Riga({
  label,
  valore,
  mono,
  link,
}: {
  label: string;
  valore: string;
  mono?: boolean;
  link?: boolean;
}) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="shrink-0 text-sm text-ink-faint">{label}</dt>
      <dd className={`min-w-0 truncate text-right text-sm ${mono ? "font-mono text-xs" : ""}`}>
        {link ? (
          <Link href={valore} className="hover:text-brand-deep">
            {valore}
          </Link>
        ) : (
          valore
        )}
      </dd>
    </div>
  );
}
