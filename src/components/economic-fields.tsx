"use client";
import SteppedNumberInput from "./stepped-number-input";
export { useFormReady as useEconomicFormReady } from "./form-ready";

export const economicInput = "min-h-11 min-w-0 w-full rounded-lg border border-line bg-panel px-3 py-2 text-sm outline-none focus:border-brand disabled:opacity-70";
export function EconomicNumber({ label, value, onChange, increment }: { label: string; value: string; onChange: (value: string) => void; increment?: number }) {
  return <label className="flex min-w-0 flex-col gap-1 text-xs text-ink-soft">{label}{increment === undefined
    ? <input type="number" min="0" step="0.0001" required value={value} onChange={(e) => onChange(e.target.value)} className={economicInput} />
    : <SteppedNumberInput required value={value} onValueChange={onChange} increment={increment} precision={4} className={economicInput} />}</label>;
}
