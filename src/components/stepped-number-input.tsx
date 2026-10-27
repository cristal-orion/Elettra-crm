"use client";

import type { ComponentProps } from "react";

type Props = Omit<ComponentProps<"input">, "type" | "value" | "onChange" | "step" | "min" | "max"> & {
  value: string;
  onValueChange: (value: string) => void;
  increment: number;
  precision: number;
  max?: number;
};

// Le frecce native e la tastiera usano un passo pratico, senza imporre
// quel passo agli importi/alle quantità inseriti manualmente.
export default function SteppedNumberInput({ value, onValueChange, increment, precision, max, ...props }: Props) {
  function adjust(direction: 1 | -1) {
    if (value === "" && direction < 0) return;
    if (value !== "" && !new RegExp(`^\\d+(?:\\.\\d{1,${precision}})?$`).test(value)) return;
    const factor = 10 ** precision;
    const previous = Math.round(Number(value) * factor);
    if (!Number.isSafeInteger(previous) || (max !== undefined && Number(value) > max)) return;
    const next = Math.min(max === undefined ? Number.MAX_SAFE_INTEGER : Math.round(max * factor), Math.max(0, previous + direction * Math.round(increment * factor)));
    onValueChange((next / factor).toFixed(precision));
  }

  return <input
    {...props}
    type="number"
    inputMode="decimal"
    min="0"
    max={max}
    step={1 / 10 ** precision}
    value={value}
    onChange={(e) => {
      // Gli spinner nativi emettono un Event, mentre digitazione, incolla
      // e dettatura emettono InputEvent: solo i primi applicano il passo.
      if (e.nativeEvent.type === "input" && !("inputType" in e.nativeEvent)) {
        adjust(Number(e.target.value) > Number(value) ? 1 : -1);
      } else {
        onValueChange(e.target.value);
      }
    }}
    onKeyDown={(e) => {
      props.onKeyDown?.(e);
      if (!e.defaultPrevented && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
        e.preventDefault();
        adjust(e.key === "ArrowUp" ? 1 : -1);
      }
    }}
  />;
}
