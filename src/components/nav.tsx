"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  soon?: boolean;
};

const iconClass = "h-[18px] w-[18px] shrink-0";

const items: NavItem[] = [
  {
    href: "/",
    label: "Dashboard",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className={iconClass}>
        <path
          d="M4 13h6V4H4v9Zm0 7h6v-5H4v5Zm10 0h6v-9h-6v9Zm0-16v5h6V4h-6Z"
          fill="currentColor"
        />
      </svg>
    ),
  },
  {
    href: "/anagrafiche",
    label: "Anagrafiche",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className={iconClass}>
        <path
          d="M16 11a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm-8 1a3 3 0 1 0-3-3 3 3 0 0 0 3 3Zm0 2c-2.7 0-5 1.3-5 3.5V20h6v-2.5A4.6 4.6 0 0 1 10 15a7 7 0 0 0-2-1Zm8 0c-3 0-6 1.5-6 4v1h12v-1c0-2.5-3-4-6-4Z"
          fill="currentColor"
        />
      </svg>
    ),
  },
  {
    href: "/commesse",
    label: "Commesse",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className={iconClass}>
        <path
          d="M10 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-8l-2-2Z"
          fill="currentColor"
        />
      </svg>
    ),
  },
  {
    href: "/progetti",
    label: "Progetti",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className={iconClass}>
        <path
          d="M3 5h10v3H3V5Zm4 5.5h11v3H7v-3ZM11 16h10v3H11v-3Z"
          fill="currentColor"
        />
      </svg>
    ),
  },
  {
    href: "/ordini",
    label: "Ordini",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className={iconClass}>
        <path
          d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5v-9Zm9 1.6 6.3-3.15L12 2.7 5.7 5.95 12 9.1Zm0 2L4.5 7.3v8.35L12 19.3v-8.2Z"
          fill="currentColor"
        />
      </svg>
    ),
  },
  {
    href: "/materiali",
    label: "Materiali",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className={iconClass}>
        <path
          d="M11.6 3H5a2 2 0 0 0-2 2v6.6a2 2 0 0 0 .6 1.4l7.4 7.4a2 2 0 0 0 2.8 0l6.6-6.6a2 2 0 0 0 0-2.8L13 3.6A2 2 0 0 0 11.6 3ZM7.5 9A1.5 1.5 0 1 1 9 7.5 1.5 1.5 0 0 1 7.5 9Z"
          fill="currentColor"
        />
      </svg>
    ),
  },
  {
    href: "/statistiche",
    label: "Statistiche",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className={iconClass}>
        <path
          d="M4 20V4H2v18h20v-2H4Zm3-3h2v-6H7v6Zm4 0h2V7h-2v10Zm4 0h2v-4h-2v4Zm4 0h2V9h-2v8Z"
          fill="currentColor"
        />
      </svg>
    ),
  },
  {
    href: "/segnalazioni",
    label: "Segnalazioni",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className={iconClass}>
        <path
          d="M4 4h16a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H9l-5 4V5a1 1 0 0 1 1-1Zm7 3v6h2V7h-2Zm0 7v2h2v-2h-2Z"
          fill="currentColor"
        />
      </svg>
    ),
  },
  {
    href: "/assistente",
    label: "Assistente",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className={iconClass}>
        <path
          d="M12 2a7 7 0 0 0-7 7c0 2 .9 3.4 2 4.6.7.8 1 1.3 1 2.4v1a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-1c0-1.1.3-1.6 1-2.4 1.1-1.2 2-2.6 2-4.6a7 7 0 0 0-7-7Zm-3 19a1 1 0 0 1 1-1h4a1 1 0 0 1 0 2h-4a1 1 0 0 1-1-1Z"
          fill="currentColor"
        />
      </svg>
    ),
  },
  { href: "/attivita", label: "Attività", icon: <span className={iconClass} aria-hidden>✓</span> },
  { href: "/notifiche", label: "Notifiche", icon: <span className={iconClass} aria-hidden>◉</span> },
];

// Voci riservate al Super Admin (gestione utenti/ruoli, impostazioni).
const adminItems: NavItem[] = [
  {
    href: "/utenti",
    label: "Utenti",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className={iconClass}>
        <path
          d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 2c-3.3 0-8 1.7-8 5v1h16v-1c0-3.3-4.7-5-8-5Zm7.5-6.5-1.4 1.4 1.6 1.6-1.6 1.6 1.4 1.4L21 11.5l-1.5-1.5Z"
          fill="currentColor"
        />
      </svg>
    ),
  },
  {
    href: "/impostazioni",
    label: "Impostazioni",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className={iconClass}>
        <path
          d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm8.4 4c0-.5 0-1-.1-1.4l1.7-1.3-1.7-3-2 .8a6.6 6.6 0 0 0-2.4-1.4L13.5 2h-3l-.4 2.3a6.6 6.6 0 0 0-2.4 1.4l-2-.8-1.7 3 1.7 1.3a6.9 6.9 0 0 0 0 2.8l-1.7 1.3 1.7 3 2-.8c.7.6 1.5 1 2.4 1.4l.4 2.3h3l.4-2.3c.9-.4 1.7-.8 2.4-1.4l2 .8 1.7-3-1.7-1.3c.1-.4.1-.9.1-1.4Z"
          fill="currentColor"
        />
      </svg>
    ),
  },
];

export default function Nav({
  canManageUsers = false,
  mobile = false,
}: {
  canManageUsers?: boolean;
  mobile?: boolean;
}) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const voci = canManageUsers ? [...items, ...adminItems] : items;

  return (
    <nav aria-label={mobile ? "Navigazione mobile" : "Navigazione principale"} className={mobile ? "flex gap-1 overflow-x-auto border-b border-line bg-panel px-3 py-2" : "flex flex-col gap-1"}>
      {voci.map((item) => {
        const active = isActive(item.href);
        const base =
          "flex min-h-11 shrink-0 items-center gap-3 whitespace-nowrap rounded-lg px-3 py-2 text-sm transition";

        if (item.soon) {
          return (
            <span
              key={item.href}
              className={`${base} cursor-default text-white/35`}
              title="In arrivo nella prossima fase"
            >
              {item.icon}
              <span className="flex-1">{item.label}</span>
              <span className="rounded-full bg-white/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-white/50">
                presto
              </span>
            </span>
          );
        }

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`${base} ${
              mobile ? active ? "bg-brand-soft font-semibold text-brand-deep" : "text-ink-soft hover:bg-paper" : active
                ? "bg-brand-light/15 font-medium text-white"
                : "text-white/60 hover:bg-white/5 hover:text-white"
            }`}
          >
            {!mobile && <span aria-hidden className={active ? "text-brand-light" : ""}>{item.icon}</span>}
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
