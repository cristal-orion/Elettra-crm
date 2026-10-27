"use client";

import { useId } from "react";
import SteppedNumberInput from "@/components/stepped-number-input";

export default function MoneyField({ label, value, onChange, required, className }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  className: string;
}) {
  const id = useId();

  return (
    <div className="flex min-w-0 flex-col gap-1 text-sm">
      <label htmlFor={id}>{label}{required && " *"}</label>
      <SteppedNumberInput
        id={id}
        max={999999999999.99}
        increment={10}
        precision={2}
        required={required}
        value={value}
        onValueChange={onChange}
        className={className}
      />
    </div>
  );
}
