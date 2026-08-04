"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Pulsante sempre presente per aprire una segnalazione durante la fase di prova.
 *
 * Porta con sé la schermata di provenienza: chi corregge sa subito dove
 * guardare, e chi segnala non deve spiegare dove si trovava. Si nasconde dentro
 * la sezione Segnalazioni, dove sarebbe rumore.
 */
export default function SegnalaButton() {
  const pathname = usePathname();
  if (pathname.startsWith("/segnalazioni")) return null;

  return (
    <Link
      href={`/segnalazioni/nuova?pagina=${encodeURIComponent(pathname)}`}
      title="Segnala un problema o un miglioramento su questa schermata"
      className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-slatepanel px-4 py-2.5 text-sm font-medium text-white shadow-lg transition hover:bg-elettra focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand print:hidden"
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" aria-hidden>
        <path
          fill="currentColor"
          d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 4.5a1.3 1.3 0 1 1 0 2.6 1.3 1.3 0 0 1 0-2.6ZM13.2 17h-2.4v-6.4h2.4V17Z"
        />
      </svg>
      Segnala
    </Link>
  );
}
