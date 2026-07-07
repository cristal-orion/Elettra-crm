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
];

export default function Nav() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <nav className="flex flex-col gap-1">
      {items.map((item) => {
        const active = isActive(item.href);
        const base =
          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition";

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
            className={`${base} ${
              active
                ? "bg-brand-light/15 font-medium text-white"
                : "text-white/60 hover:bg-white/5 hover:text-white"
            }`}
          >
            <span className={active ? "text-brand-light" : ""}>{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
