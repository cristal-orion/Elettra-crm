export function romeDay(now = new Date()) {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
/** Uno slot per data locale: anche al ritorno dell'ora solare si esegue una volta. */
export function dueSlot(schedule: { hour: number; minute: number; weekdaysOnly: boolean }, now: Date): string | null {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Rome", hour: "2-digit", minute: "2-digit", weekday: "short", hourCycle: "h23" }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  if (schedule.weekdaysOnly && ["Sat", "Sun"].includes(value("weekday"))) return null;
  if (Number(value("hour")) * 60 + Number(value("minute")) < schedule.hour * 60 + schedule.minute) return null;
  return romeDay(now);
}
