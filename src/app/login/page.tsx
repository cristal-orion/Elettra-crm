import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import LoginForm from "./login-form";

export const metadata: Metadata = {
  title: "Accedi — CRM Elettra",
};

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/");

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      {/* Pannello identità (navy brand Elettra) */}
      <section className="relative hidden overflow-hidden bg-slatepanel px-12 py-14 text-white lg:flex lg:flex-col lg:justify-between">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.5]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)",
            backgroundSize: "26px 26px",
          }}
        />
        <div className="relative">
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-brand-light">
            Elettra S.r.l.
          </p>
          <p className="mt-2 font-mono text-xs uppercase tracking-[0.16em] text-white/40">
            CRM · Cruscotto di controllo
          </p>
        </div>
        <div className="relative">
          <h1 className="max-w-[16ch] text-4xl font-extrabold leading-[1.05] tracking-tight">
            Dal foglio Excel al{" "}
            <span className="text-brand-light">cruscotto di controllo</span>
          </h1>
          <p className="mt-4 max-w-[42ch] text-white/60">
            Anagrafiche, commesse e acquisti in un unico posto. Accessibile
            dall&apos;ufficio e dal cantiere.
          </p>
        </div>
        <p className="relative font-mono text-[11px] uppercase tracking-[0.14em] text-white/30">
          Accesso riservato
        </p>
      </section>

      {/* Form di accesso */}
      <section className="flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <p className="font-mono text-xs uppercase tracking-[0.16em] text-brand-deep lg:hidden">
              Elettra S.r.l. · CRM
            </p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight">
              Accedi al gestionale
            </h2>
            <p className="mt-1 text-sm text-ink-soft">
              Inserisci le tue credenziali per continuare.
            </p>
          </div>
          <LoginForm />
        </div>
      </section>
    </main>
  );
}
