"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { segnaGuidaVista } from "@/app/(app)/guida-actions";
import {
  giaVisto,
  parseVisti,
  tourPerPercorso,
  type PassoGuida,
  type TourGuida,
} from "@/lib/guida";

const EVENTO_APRI = "elettra:apri-guida";
const MARGINE = 16;
const DISTANZA = 12;
const LARGHEZZA = 340;

type Posizione = {
  top: number;
  left: number;
  larghezza: number;
  /** Rettangolo dell'elemento evidenziato; assente per i passi centrati. */
  target?: { top: number; left: number; width: number; height: number };
};

/** Primo elemento visibile che corrisponde al passo (il menu esiste in due versioni). */
function trovaElemento(passo: PassoGuida): HTMLElement | null {
  if (!passo.sel) return null;
  let trovati: HTMLElement[];
  try {
    trovati = Array.from(document.querySelectorAll<HTMLElement>(passo.sel));
  } catch {
    return null;
  }
  return (
    trovati.find(
      (el) =>
        el.getClientRects().length > 0 &&
        (!passo.conTesto || el.textContent?.includes(passo.conTesto)),
    ) ?? null
  );
}

function calcola(passo: PassoGuida, altezzaPopover: number): Posizione {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const larghezza = Math.min(LARGHEZZA, vw - MARGINE * 2);
  const el = trovaElemento(passo);
  if (!el) {
    return {
      top: Math.max(MARGINE, (vh - altezzaPopover) / 2),
      left: (vw - larghezza) / 2,
      larghezza,
    };
  }
  const r = el.getBoundingClientRect();
  const target = { top: r.top - 4, left: r.left - 4, width: r.width + 8, height: r.height + 8 };
  const clampX = (x: number) => Math.min(Math.max(MARGINE, x), vw - larghezza - MARGINE);
  const clampY = (y: number) => Math.min(Math.max(MARGINE, y), vh - altezzaPopover - MARGINE);

  // Elemento stretto con spazio a destra (voci del menu): accanto.
  if (r.width < 320 && r.right + DISTANZA + larghezza + MARGINE <= vw) {
    return { top: clampY(r.top + r.height / 2 - altezzaPopover / 2), left: r.right + DISTANZA + 4, larghezza, target };
  }
  if (r.bottom + DISTANZA + altezzaPopover + MARGINE <= vh) {
    return { top: r.bottom + DISTANZA + 4, left: clampX(r.left), larghezza, target };
  }
  if (r.top - DISTANZA - altezzaPopover - MARGINE >= 0) {
    return { top: r.top - DISTANZA - altezzaPopover - 4, left: clampX(r.left), larghezza, target };
  }
  // Elemento più grande dello schermo: il popover resta in basso.
  return { top: vh - altezzaPopover - MARGINE, left: clampX(r.left), larghezza, target };
}

/** Attende che almeno un elemento del tour sia presente (pagine con caricamento). */
async function attendiPagina(tour: TourGuida, annullato: () => boolean) {
  for (let i = 0; i < 20 && !annullato(); i++) {
    if (tour.passi.some((p) => p.sel && trovaElemento(p))) return;
    await new Promise((r) => setTimeout(r, 150));
  }
}

/** Pulsante che rilancia la guida della pagina corrente. */
export function GuidaButton({ className }: { className?: string }) {
  return (
    <button
      type="button"
      data-guida-apri
      onClick={() => window.dispatchEvent(new Event(EVENTO_APRI))}
      className={className}
    >
      Guida
    </button>
  );
}

/**
 * Guida contestuale: popover accanto agli elementi della pagina, mostrati la
 * prima volta che l'utente apre ciascuna sezione. Non blocca la pagina: chi
 * vuole esplorare per conto suo può farlo, e cambiando pagina la guida si
 * chiude (e parte quella della nuova, se non l'ha ancora vista).
 */
export default function Guida({ ruolo, viste }: { ruolo: string; viste: string }) {
  const pathname = usePathname();
  const visteRef = useRef<string[]>(parseVisti(viste));
  const [sessione, setSessione] = useState<{
    tour: TourGuida;
    passi: PassoGuida[];
    percorso: string;
  } | null>(null);
  // Copia della sessione per leggerla fuori dal render (chiusura, cambio pagina).
  const sessioneRef = useRef<typeof sessione>(null);
  const [indice, setIndice] = useState(0);
  const [pos, setPos] = useState<Posizione | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const avantiRef = useRef<HTMLButtonElement>(null);

  const attiva = sessione?.percorso === pathname ? sessione : null;
  const passi = attiva?.passi;
  const passo = passi?.[indice];
  const ultimo = passi ? indice >= passi.length - 1 : false;

  const imposta = useCallback((nuova: typeof sessione) => {
    sessioneRef.current = nuova;
    setSessione(nuova);
  }, []);

  const segna = useCallback((chiave: string) => {
    if (!visteRef.current.includes(chiave)) visteRef.current.push(chiave);
    void segnaGuidaVista(chiave);
  }, []);

  const avvia = useCallback(
    (tour: TourGuida) => {
      const utili = tour.passi.filter((p) => !p.sel || trovaElemento(p));
      if (utili.length === 0) return;
      setIndice(0);
      imposta({ tour, passi: utili, percorso: pathname });
    },
    [pathname, imposta],
  );

  const chiudi = useCallback(
    (tutte = false) => {
      const corrente = sessioneRef.current;
      if (corrente) segna(tutte ? "*" : corrente.tour.chiave);
      imposta(null);
      setPos(null);
    },
    [segna, imposta],
  );

  // Cambio pagina: il tour aperto si chiude (contato come visto) e parte
  // quello della nuova pagina, se l'utente non l'ha già visto.
  useEffect(() => {
    const tour = tourPerPercorso(pathname, ruolo);
    let annullato = false;
    if (tour && !giaVisto(visteRef.current, tour.chiave)) {
      void attendiPagina(tour, () => annullato).then(() => {
        if (!annullato) avvia(tour);
      });
    }
    return () => {
      annullato = true;
      const corrente = sessioneRef.current;
      if (corrente) segna(corrente.tour.chiave);
      imposta(null);
    };
  }, [pathname, ruolo, avvia, segna, imposta]);

  // Pulsante «Guida»: rilancia il tour della pagina (anche se già visto).
  useEffect(() => {
    function alClick() {
      const tour = tourPerPercorso(pathname, ruolo);
      if (tour) avvia(tour);
    }
    window.addEventListener(EVENTO_APRI, alClick);
    return () => window.removeEventListener(EVENTO_APRI, alClick);
  }, [pathname, ruolo, avvia]);

  // Posizionamento: a ogni passo, resize e scroll.
  useEffect(() => {
    if (!passo) return;
    let frame = 0;
    const aggiorna = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        setPos(calcola(passo, boxRef.current?.offsetHeight ?? 220));
      });
    };
    const el = trovaElemento(passo);
    if (el) {
      const r = el.getBoundingClientRect();
      if (r.top < 80 || r.bottom > window.innerHeight - 80) {
        el.scrollIntoView({ block: "center", behavior: "smooth" });
      }
    }
    aggiorna();
    window.addEventListener("resize", aggiorna);
    window.addEventListener("scroll", aggiorna, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", aggiorna);
      window.removeEventListener("scroll", aggiorna, true);
    };
  }, [passo]);

  useEffect(() => {
    if (passo) avantiRef.current?.focus({ preventScroll: true });
  }, [passo]);

  useEffect(() => {
    if (!attiva) return;
    const alTasto = (e: KeyboardEvent) => {
      if (e.key === "Escape") chiudi();
    };
    window.addEventListener("keydown", alTasto);
    return () => window.removeEventListener("keydown", alTasto);
  }, [attiva, chiudi]);

  if (!attiva || !passo || !passi) return null;
  const centrato = !passo.sel || !pos?.target;

  return (
    <div className="print:hidden">
      {centrato ? (
        <div className="pointer-events-none fixed inset-0 z-[60] bg-slatepanel/50" aria-hidden />
      ) : (
        <div
          aria-hidden
          className="pointer-events-none fixed z-[60] rounded-lg ring-2 ring-brand-light transition-all duration-200"
          style={{
            top: pos!.target!.top,
            left: pos!.target!.left,
            width: pos!.target!.width,
            height: pos!.target!.height,
            boxShadow: "0 0 0 9999px rgba(21, 36, 58, 0.45)",
          }}
        />
      )}
      <div
        ref={boxRef}
        role="dialog"
        aria-label={`Guida: ${passo.titolo}`}
        className="fixed z-[61] rounded-xl border border-line bg-panel p-5 text-ink shadow-2xl"
        style={{
          top: pos?.top ?? 0,
          left: pos?.left ?? 0,
          width: pos?.larghezza ?? LARGHEZZA,
          visibility: pos ? "visible" : "hidden",
        }}
      >
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-brand">
          Guida · {indice + 1} di {passi.length}
        </p>
        <h2 className="mt-1.5 text-base font-semibold">{passo.titolo}</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">{passo.testo}</p>
        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => chiudi()}
            className="min-h-11 rounded-lg px-2 text-sm text-ink-faint hover:text-ink"
          >
            {ultimo ? "Chiudi" : "Salta"}
          </button>
          <div className="flex gap-2">
            {indice > 0 && (
              <button
                type="button"
                onClick={() => setIndice((i) => i - 1)}
                className="min-h-11 rounded-lg border border-line px-3 text-sm font-medium hover:bg-paper"
              >
                Indietro
              </button>
            )}
            <button
              ref={avantiRef}
              type="button"
              onClick={() => (ultimo ? chiudi() : setIndice((i) => i + 1))}
              className="min-h-11 rounded-lg bg-brand px-4 text-sm font-medium text-white hover:bg-brand-deep"
            >
              {ultimo ? "Ho capito" : "Avanti"}
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={() => chiudi(true)}
          className="mt-1 w-full text-center text-xs text-ink-faint hover:text-ink hover:underline"
        >
          Non mostrare più le guide
        </button>
      </div>
    </div>
  );
}
