"use client";

import { useId, useRef } from "react";

const MAX_CENTS = 99_999_999_999_999;
const buttonClass = "min-h-11 shrink-0 rounded-lg border border-line bg-panel px-2 text-sm font-medium text-brand-deep hover:bg-brand-soft disabled:opacity-60";

export default function MoneyField({ label, value, onChange, required, className }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  className: string;
}) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  function adjust(direction: 1 | -1) {
    const input = inputRef.current;
    if (!input || input.validity.badInput || (value !== "" && !input.validity.valid)) return;
    if (value === "" && direction < 0) return;
    // Il passo dei comandi è distinto dalla precisione ammessa nel campo.
    const cents = Math.round(Number(value) * 100);
    const next = Math.min(MAX_CENTS, Math.max(0, cents + direction * 1000));
    onChange((next / 100).toFixed(2));
  }

  return (
    <div className="flex min-w-0 flex-col gap-1 text-sm">
      <label htmlFor={id}>{label}{required && " *"}</label>
      <div className="flex min-w-0 gap-1">
        <input
          ref={inputRef}
          id={id}
          type="number"
          inputMode="decimal"
          min="0"
          max="999999999999.99"
          step="0.01"
          required={required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowUp" || e.key === "ArrowDown") {
              e.preventDefault();
              adjust(e.key === "ArrowUp" ? 1 : -1);
            }
          }}
          className={`${className} flex-1 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
        />
        <button type="button" aria-label={`Diminuisci di 10 euro — ${label}`} aria-controls={id} onClick={() => adjust(-1)} className={buttonClass}>−10 €</button>
        <button type="button" aria-label={`Aumenta di 10 euro — ${label}`} aria-controls={id} onClick={() => adjust(1)} className={buttonClass}>+10 €</button>
      </div>
    </div>
  );
}
