import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/dal";
import { puoGestireCommesse } from "@/lib/enums";
import CommessaForm from "../commessa-form";
import { createCommessa } from "../actions";
import { getCommessaFormOptions } from "../data";

export const metadata = { title: "Nuova commessa — CRM Elettra" };

export default async function NuovaCommessaPage() {
  const user = await getCurrentUser();
  if (!user || !puoGestireCommesse(user.ruolo)) redirect("/commesse");

  const { clienti, pms } = await getCommessaFormOptions();
  const oggi = new Date().toISOString().slice(0, 10);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <Link
          href="/commesse"
          className="font-mono text-xs uppercase tracking-wider text-ink-faint hover:text-brand-deep"
        >
          ← Commesse
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          Nuova commessa
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          Il numero (AANNNN) viene assegnato automaticamente al salvataggio.
        </p>
      </header>
      <CommessaForm
        action={createCommessa}
        clienti={clienti}
        pms={pms}
        initial={{ stato: "LEAD", dataRichiesta: oggi }}
        submitLabel="Crea commessa"
      />
    </div>
  );
}
