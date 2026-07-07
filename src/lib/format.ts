import type { Prisma } from "@/generated/prisma";

type Decimalish = Prisma.Decimal | number | string | null | undefined;

/** Converte un Decimal Prisma (o affini) in number in modo sicuro. */
export function toNumber(value: Decimalish): number {
  if (value === null || value === undefined) return 0;
  const n = Number(value.toString());
  return Number.isFinite(n) ? n : 0;
}

const euro = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 2,
});

export function formatEuro(value: Decimalish): string {
  return euro.format(toNumber(value));
}

const dateFmt = new Intl.DateTimeFormat("it-IT", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : dateFmt.format(d);
}
