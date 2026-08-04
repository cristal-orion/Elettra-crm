import Link from "next/link";
import { requireUser } from "@/lib/dal";
import { NuovaSegnalazioneForm } from "../segnalazioni-ui";
import { createSegnalazione } from "../actions";

export const metadata = { title: "Nuova segnalazione — CRM Elettra" };

export default async function NuovaSegnalazionePage({
  searchParams,
}: {
  searchParams: Promise<{ pagina?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;

  // Solo percorsi interni: il valore arriva dalla query string, quindi non deve
  // poter diventare un link verso l'esterno.
  const grezza = (sp.pagina ?? "").trim();
  const pagina =
    grezza.startsWith("/") && !grezza.startsWith("//") ? grezza.slice(0, 200) : null;

  return (
    <div className="flex flex-col gap-6">
      <header>
        <Link
          href="/segnalazioni"
          className="font-mono text-xs uppercase tracking-wider text-ink-faint hover:text-brand-deep"
        >
          ← Segnalazioni
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          Nuova segnalazione
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-soft">
          Verrà firmata a tuo nome ({user.nome} {user.cognome}). Nessun problema è
          troppo piccolo: anche un&apos;etichetta poco chiara è utile da sapere.
        </p>
      </header>

      <section className="rounded-xl border border-line bg-panel p-6">
        <NuovaSegnalazioneForm action={createSegnalazione} pagina={pagina} />
      </section>
    </div>
  );
}
