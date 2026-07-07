import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/dal";
import { puoGestireAnagrafiche, etichettaTitolo } from "@/lib/enums";
import { formatEuro, formatDate, toNumber } from "@/lib/format";
import {
  CodiceBadge,
  StatoBadge,
  StatoOrdineBadge,
  TipologiaBadge,
} from "@/components/badges";

export default async function AnagraficaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const anagrafica = await prisma.anagrafica.findUnique({
    where: { id },
    include: {
      referenti: { orderBy: [{ principale: "desc" }, { cognome: "asc" }] },
      commesse: { orderBy: { createdAt: "desc" }, include: { pm: true } },
      ordiniFornitore: {
        orderBy: { data: "desc" },
        include: {
          commessa: { select: { id: true, numero: true } },
          righe: { select: { imponibile: true } },
        },
      },
    },
  });

  if (!anagrafica) notFound();

  const user = await getCurrentUser();
  const puoModificare = user ? puoGestireAnagrafiche(user.ruolo) : false;

  return (
    <div className="flex flex-col gap-7">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/anagrafiche"
            className="font-mono text-xs uppercase tracking-wider text-ink-faint hover:text-brand-deep"
          >
            ← Anagrafiche
          </Link>
          <h1 className="mt-2 text-2xl font-bold tracking-tight">
            {anagrafica.ragioneSociale}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <CodiceBadge
              codiceCliente={anagrafica.codiceCliente}
              codiceFornitore={anagrafica.codiceFornitore}
            />
            {anagrafica.isCliente && (
              <span className="rounded-full bg-lead-soft px-2.5 py-0.5 text-[11px] text-ink-soft">
                Cliente
              </span>
            )}
            {anagrafica.isFornitore && (
              <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-[11px] text-brand-deep">
                Fornitore
              </span>
            )}
          </div>
        </div>
        {puoModificare && (
          <Link
            href={`/anagrafiche/${anagrafica.id}/modifica`}
            className="rounded-lg border border-line bg-panel px-4 py-2.5 text-sm font-medium text-ink transition hover:border-brand/40"
          >
            Modifica
          </Link>
        )}
      </header>

      <div className="grid gap-5 md:grid-cols-2">
        <Card title="Dati fiscali">
          <Row label="Partita IVA" value={anagrafica.partitaIva} mono />
          <Row label="Codice fiscale" value={anagrafica.codiceFiscale} mono />
          <Row label="Codice SDI / Univoco" value={anagrafica.codiceSDI} mono />
        </Card>
        <Card title="Indirizzo">
          <Row label="Indirizzo" value={anagrafica.indirizzo} />
          <Row
            label="Città"
            value={
              anagrafica.localita
                ? `${anagrafica.cap ? `${anagrafica.cap} ` : ""}${anagrafica.localita}${anagrafica.provincia ? ` (${anagrafica.provincia})` : ""}`
                : null
            }
          />
        </Card>
        <Card title="Contatti">
          <Row label="Telefono" value={anagrafica.telefono} />
          <Row label="Fax" value={anagrafica.fax} />
          <Row label="Email" value={anagrafica.email} />
          <Row label="Web" value={anagrafica.web} />
        </Card>
        <Card title="Amministrazione">
          <Row label="Pagamento" value={anagrafica.modalitaPagamento} />
          <Row label="Prodotti trattati" value={anagrafica.prodottiTrattati} />
          <Row label="Note" value={anagrafica.note} />
        </Card>
      </div>

      {/* Referenti */}
      <section className="rounded-xl border border-line bg-panel p-6">
        <h2 className="text-sm font-semibold">Referenti</h2>
        {anagrafica.referenti.length === 0 ? (
          <p className="mt-3 text-sm text-ink-faint">
            Nessun referente registrato.
          </p>
        ) : (
          <ul className="mt-4 flex flex-col divide-y divide-line">
            {anagrafica.referenti.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0"
              >
                <div>
                  <p className="font-medium">
                    {`${etichettaTitolo(r.titolo)} ${r.nome} ${r.cognome}`.trim()}
                    {r.principale && (
                      <span className="ml-2 rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-medium text-brand-deep">
                        principale
                      </span>
                    )}
                  </p>
                  {r.ruoloAzienda && (
                    <p className="text-xs text-ink-soft">{r.ruoloAzienda}</p>
                  )}
                </div>
                <div className="text-right text-sm text-ink-soft">
                  {r.email && <p>{r.email}</p>}
                  {r.telefono && <p className="font-mono text-xs">{r.telefono}</p>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Commesse */}
      <section className="rounded-xl border border-line bg-panel">
        <div className="border-b border-line px-6 py-4">
          <h2 className="text-sm font-semibold">
            Commesse{" "}
            <span className="font-normal text-ink-faint">
              ({anagrafica.commesse.length})
            </span>
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left font-mono text-[11px] uppercase tracking-wider text-ink-faint">
                <th className="px-6 py-3 font-medium">Numero</th>
                <th className="px-4 py-3 font-medium">Descrizione</th>
                <th className="px-4 py-3 font-medium">Stato</th>
                <th className="px-4 py-3 font-medium">Tip.</th>
                <th className="px-6 py-3 text-right font-medium">Offerta</th>
              </tr>
            </thead>
            <tbody>
              {anagrafica.commesse.map((c) => (
                <tr key={c.id} className="border-t border-line">
                  <td className="px-6 py-3 font-mono tabular-nums">{c.numero}</td>
                  <td className="max-w-xs truncate px-4 py-3">
                    {c.descrizione ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <StatoBadge stato={c.stato} />
                  </td>
                  <td className="px-4 py-3">
                    <TipologiaBadge tipologia={c.tipologia} />
                  </td>
                  <td className="px-6 py-3 text-right tabular-nums">
                    {c.importoOfferta ? formatEuro(c.importoOfferta) : "—"}
                  </td>
                </tr>
              ))}
              {anagrafica.commesse.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-6 text-center text-ink-faint">
                    Nessuna commessa per questa anagrafica.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Ordini a fornitore (solo se fornitore) */}
      {anagrafica.isFornitore && (
        <section className="rounded-xl border border-line bg-panel">
          <div className="border-b border-line px-6 py-4">
            <h2 className="text-sm font-semibold">
              Ordini a fornitore{" "}
              <span className="font-normal text-ink-faint">
                ({anagrafica.ordiniFornitore.length})
              </span>
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left font-mono text-[11px] uppercase tracking-wider text-ink-faint">
                  <th className="px-6 py-3 font-medium">Numero</th>
                  <th className="px-4 py-3 font-medium">Commessa</th>
                  <th className="px-4 py-3 font-medium">Data</th>
                  <th className="px-4 py-3 font-medium">Stato</th>
                  <th className="px-6 py-3 text-right font-medium">Imponibile</th>
                </tr>
              </thead>
              <tbody>
                {anagrafica.ordiniFornitore.map((o) => (
                  <tr key={o.id} className="border-t border-line hover:bg-paper/50">
                    <td className="px-6 py-3">
                      <Link
                        href={`/ordini/${o.id}`}
                        className="font-mono tabular-nums font-medium hover:text-brand-deep"
                      >
                        {o.numero ?? "—"}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-mono tabular-nums text-ink-soft">
                      {o.commessa ? o.commessa.numero : "—"}
                    </td>
                    <td className="px-4 py-3 text-ink-soft">
                      {formatDate(o.data)}
                    </td>
                    <td className="px-4 py-3">
                      <StatoOrdineBadge stato={o.stato} />
                    </td>
                    <td className="px-6 py-3 text-right tabular-nums">
                      {formatEuro(
                        o.righe.reduce(
                          (acc, r) => acc + toNumber(r.imponibile),
                          0,
                        ),
                      )}
                    </td>
                  </tr>
                ))}
                {anagrafica.ordiniFornitore.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-6 text-center text-ink-faint">
                      Nessun ordine registrato per questo fornitore.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-line bg-panel p-5">
      <h2 className="text-sm font-semibold">{title}</h2>
      <dl className="mt-3 flex flex-col gap-2">{children}</dl>
    </div>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string | null;
  mono?: boolean;
}) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-sm text-ink-faint">{label}</dt>
      <dd
        className={`text-right text-sm ${mono ? "font-mono" : ""} ${value ? "text-ink" : "text-ink-faint"}`}
      >
        {value || "—"}
      </dd>
    </div>
  );
}
