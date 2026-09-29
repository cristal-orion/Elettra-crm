"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { completaGuida } from "@/app/(app)/guida-actions";

const EVENTO_APRI = "elettra:apri-guida";

type Passo = {
  titolo: string;
  testo: string;
  punti?: string[];
  href?: string;
  /** Se presente, il passo è mostrato solo a questi ruoli. */
  ruoli?: string[];
};

const PASSI: Passo[] = [
  {
    titolo: "Benvenuto nel CRM Elettra",
    testo:
      "In pochi passaggi ti mostriamo dove trovare le cose e come lavorare. Puoi saltare la guida quando vuoi e riaprirla in qualsiasi momento dal pulsante «Guida» nel menu.",
  },
  {
    titolo: "Il menu a sinistra",
    testo:
      "Tutte le sezioni sono nel menu (su telefono è la barra scorrevole in alto). La voce evidenziata indica dove ti trovi. La Dashboard è la pagina iniziale: riassume la situazione di commesse e attività.",
    href: "/",
  },
  {
    titolo: "Anagrafiche: clienti e fornitori",
    testo:
      "Ogni azienda ha una sola scheda, anche se è sia cliente sia fornitore: la stessa anagrafica può avere un codice cliente e un codice fornitore.",
    punti: [
      "Cerca per ragione sociale o codice.",
      "Dalla scheda cliente vedi referenti, commesse recenti ed economics.",
    ],
    href: "/anagrafiche",
  },
  {
    titolo: "Commesse",
    testo:
      "La commessa è il cuore del lavoro: collega cliente, project manager, stato di avanzamento e documenti.",
    punti: [
      "Apri una commessa per vedere dettagli e allegare documenti (offerte, disegni, foto, DDT, fatture).",
      "Usa i filtri per trovare le commesse per stato o cliente.",
    ],
    href: "/commesse",
  },
  {
    titolo: "Progetti e cantiere",
    testo:
      "Qui pianifichi le milestone di ogni commessa e assegni la squadra di cantiere, così tutti sanno chi fa cosa e quando.",
    href: "/progetti",
    ruoli: ["SUPER_ADMIN", "BACKOFFICE", "PROJECT_MANAGER", "UFFICIO_TECNICO"],
  },
  {
    titolo: "Ordini e Materiali",
    testo:
      "In Materiali trovi il catalogo con i prezzi dei fornitori; in Ordini gestisci gli ordini d'acquisto legati alle commesse.",
    href: "/ordini",
  },
  {
    titolo: "Attività e Notifiche",
    testo:
      "In Attività trovi le cose da fare e puoi assegnarle. Quando c'è qualcosa di nuovo da vedere, compare una barra in alto che porta alle Notifiche.",
    href: "/attivita",
  },
  {
    titolo: "L'Assistente AI",
    testo:
      "Puoi fare domande sui dati del CRM in linguaggio naturale, ad esempio «quali commesse sono in ritardo?». Controlla sempre le risposte importanti sui dati originali.",
    href: "/assistente",
  },
  {
    titolo: "Qualcosa non va? Segnalalo",
    testo:
      "Siamo in fase di prova e il tuo parere conta. Il pulsante «Segnala» in basso a destra è sempre disponibile: descrivi il problema o l'idea, e la schermata da cui scrivi viene registrata in automatico.",
    href: "/segnalazioni",
  },
  {
    titolo: "Utenti e Impostazioni",
    testo:
      "Come Super Admin crei gli utenti, assegni i ruoli e configuri l'assistente AI. Le segnalazioni ricevute si gestiscono dalla sezione Segnalazioni.",
    href: "/utenti",
    ruoli: ["SUPER_ADMIN"],
  },
  {
    titolo: "Sei pronto!",
    testo:
      "Per rivedere questa guida clicca su «Guida» nel menu. Buon lavoro!",
  },
];

/** Pulsante che riapre la guida (la finestra vive una sola volta nel layout). */
export function GuidaButton({ className }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(EVENTO_APRI))}
      className={className}
    >
      Guida
    </button>
  );
}

/**
 * Guida all'uso in finestre successive. Si apre da sola al primo accesso
 * (`aperturaAutomatica`) e poi solo su richiesta. Usa <dialog> nativo: focus
 * intrappolato, Esc e sfondo oscurato senza librerie.
 */
export default function Guida({
  ruolo,
  aperturaAutomatica,
}: {
  ruolo: string;
  aperturaAutomatica: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [indice, setIndice] = useState(0);
  const [, startTransition] = useTransition();
  const segnata = useRef(!aperturaAutomatica);

  const passi = PASSI.filter((p) => !p.ruoli || p.ruoli.includes(ruolo));
  const passo = passi[Math.min(indice, passi.length - 1)];
  const ultimo = indice >= passi.length - 1;

  const apri = useCallback(() => {
    setIndice(0);
    if (ref.current && !ref.current.open) ref.current.showModal();
  }, []);

  useEffect(() => {
    if (aperturaAutomatica) ref.current?.showModal();
    window.addEventListener(EVENTO_APRI, apri);
    return () => window.removeEventListener(EVENTO_APRI, apri);
  }, [aperturaAutomatica, apri]);

  // Qualunque chiusura (Fine, Salta, Esc, link) conta come «guida vista».
  function alChiudi() {
    if (segnata.current) return;
    segnata.current = true;
    startTransition(() => {
      void completaGuida();
    });
  }

  function chiudi() {
    ref.current?.close();
  }

  return (
    <dialog
      ref={ref}
      onClose={alChiudi}
      aria-labelledby="guida-titolo"
      className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-2xl border border-line bg-panel p-0 text-ink shadow-2xl backdrop:bg-slatepanel/60 print:hidden"
    >
      <div className="p-6 sm:p-8">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-brand">
          Guida · {indice + 1} di {passi.length}
        </p>
        <h2 id="guida-titolo" className="mt-2 text-xl font-semibold">
          {passo.titolo}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-ink-soft">{passo.testo}</p>
        {passo.punti && (
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-ink-soft">
            {passo.punti.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        )}
        {passo.href && (
          <Link
            href={passo.href}
            onClick={chiudi}
            className="mt-4 inline-block text-sm font-medium text-brand hover:text-brand-deep hover:underline"
          >
            Vai alla sezione →
          </Link>
        )}

        <div className="mt-6 flex justify-center gap-1.5" aria-hidden>
          {passi.map((p, i) => (
            <span
              key={p.titolo}
              className={`h-1.5 rounded-full transition-all ${
                i === indice ? "w-5 bg-brand" : "w-1.5 bg-line"
              }`}
            />
          ))}
        </div>

        <div className="mt-6 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={chiudi}
            className="min-h-11 rounded-lg px-3 text-sm text-ink-faint hover:text-ink"
          >
            {ultimo ? "Chiudi" : "Salta la guida"}
          </button>
          <div className="flex gap-2">
            {indice > 0 && (
              <button
                type="button"
                onClick={() => setIndice((i) => i - 1)}
                className="min-h-11 rounded-lg border border-line px-4 text-sm font-medium hover:bg-paper"
              >
                Indietro
              </button>
            )}
            <button
              type="button"
              autoFocus
              onClick={() => (ultimo ? chiudi() : setIndice((i) => i + 1))}
              className="min-h-11 rounded-lg bg-brand px-5 text-sm font-medium text-white hover:bg-brand-deep"
            >
              {ultimo ? "Inizia" : "Avanti"}
            </button>
          </div>
        </div>
      </div>
    </dialog>
  );
}
