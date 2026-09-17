"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";

export type SelectOption = {
  value: string;
  label: string;
  /** Ulteriori termini ricercabili, oltre all'etichetta visibile. */
  keywords?: string;
  disabled?: boolean;
};

type Props = {
  id?: string;
  name: string;
  label: string;
  options: SelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  className?: string;
};

function normalize(text: string) {
  return text.normalize("NFD").replace(/\p{M}/gu, "")
    .toLocaleLowerCase("it").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

/** Select per elenchi dinamici: ricerca nel popup, valore nativo nel FormData. */
export default function SearchableSelect({
  id: providedId,
  name,
  label,
  options,
  placeholder = "— Seleziona —",
  searchPlaceholder = "Cerca…",
  value,
  defaultValue = "",
  onValueChange,
  required = false,
  disabled = false,
  className = "rounded-lg border border-line bg-panel px-3 py-2 text-sm",
}: Props) {
  const generatedId = useId();
  const id = providedId ?? `select-${generatedId}`;
  const dialogId = `${id}-dialog`;
  const listId = `${id}-list`;
  const errorId = `${id}-error`;
  const [internalValue, setInternalValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const [invalid, setInvalid] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const selectRef = useRef<HTMLSelectElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const controlled = value !== undefined;
  const selectedValue = controlled ? value : internalValue;
  const selected = options.find((option) => option.value === selectedValue);
  const formValue = selected?.value ?? "";
  const expanded = open && !disabled;

  const indexedOptions = useMemo(() => options.map((option) => ({
    ...option,
    searchText: normalize(`${option.label} ${option.keywords ?? ""}`),
  })), [options]);
  const matches = useMemo(() => {
    const terms = normalize(query).split(/\s+/).filter(Boolean);
    return indexedOptions.filter((option) => terms.every((term) => option.searchText.includes(term)));
  }, [indexedOptions, query]);
  const visibleOptions: SelectOption[] = query.trim()
    ? matches
    : [{ value: "", label: placeholder, disabled: required }, ...matches];
  const activeIndex = visibleOptions[cursor] && !visibleOptions[cursor].disabled
    ? cursor
    : visibleOptions.findIndex((option) => !option.disabled);
  const activeId = activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined;

  function close(restoreFocus = false) {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus({ preventScroll: true });
  }

  function show(initialQuery = "", last = false) {
    if (disabled) return;
    setQuery(initialQuery);
    const index = options.findIndex((option) => option.value === formValue);
    setCursor(initialQuery ? 0 : index >= 0 ? index + 1 : last ? options.length : 0);
    setOpen(true);
  }

  function choose(option: SelectOption) {
    if (option.disabled) return;
    if (!controlled) setInternalValue(option.value);
    onValueChange?.(option.value);
    setInvalid(false);
    close(true);
  }

  // I reset dei form (anche quelli di React Server Actions) ripristinano i
  // selettori non controllati, come avverrebbe con un select nativo.
  useEffect(() => {
    const form = selectRef.current?.form;
    function reset() {
      if (!controlled) setInternalValue(defaultValue);
      setOpen(false);
      setInvalid(false);
    }
    form?.addEventListener("reset", reset);
    return () => form?.removeEventListener("reset", reset);
  }, [controlled, defaultValue]);

  useLayoutEffect(() => {
    if (!expanded) return;
    function position() {
      const trigger = triggerRef.current;
      const popup = popupRef.current;
      if (!trigger || !popup) return;
      const rect = trigger.getBoundingClientRect();
      const viewport = window.visualViewport;
      const viewportTop = viewport?.offsetTop ?? 0;
      const viewportLeft = viewport?.offsetLeft ?? 0;
      const viewportHeight = viewport?.height ?? window.innerHeight;
      const viewportWidth = viewport?.width ?? window.innerWidth;
      const viewportBottom = viewportTop + viewportHeight;
      const anchorTop = Math.max(viewportTop + 8, Math.min(rect.top, viewportBottom - 8));
      const anchorBottom = Math.max(viewportTop + 8, Math.min(rect.bottom, viewportBottom - 8));
      const below = viewportBottom - anchorBottom - 12;
      const above = anchorTop - viewportTop - 12;
      const upwards = below < 240 && above > below;
      const width = Math.min(Math.max(rect.width, 280), viewportWidth - 16);
      popup.style.width = `${width}px`;
      popup.style.left = `${Math.max(viewportLeft + 8, Math.min(rect.left, viewportLeft + viewportWidth - width - 8))}px`;
      popup.style.maxHeight = `${Math.max(100, Math.min(380, upwards ? above : below))}px`;
      popup.style.top = upwards ? "auto" : `${anchorBottom + 6}px`;
      popup.style.bottom = upwards ? `${window.innerHeight - anchorTop + 6}px` : "auto";
    }
    position();
    searchRef.current?.focus({ preventScroll: true });
    window.addEventListener("resize", position);
    window.addEventListener("scroll", position, true);
    window.visualViewport?.addEventListener("resize", position);
    window.visualViewport?.addEventListener("scroll", position);
    return () => {
      window.removeEventListener("resize", position);
      window.removeEventListener("scroll", position, true);
      window.visualViewport?.removeEventListener("resize", position);
      window.visualViewport?.removeEventListener("scroll", position);
    };
  }, [expanded]);

  useEffect(() => {
    if (!expanded) return;
    function dismiss(event: PointerEvent | FocusEvent) {
      const target = event.target as Node;
      if (!popupRef.current?.contains(target) && !triggerRef.current?.contains(target)) setOpen(false);
    }
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("focusin", dismiss);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("focusin", dismiss);
    };
  }, [expanded]);

  useLayoutEffect(() => {
    const list = listRef.current;
    const option = activeId ? document.getElementById(activeId) : null;
    if (!expanded || !list || !option) return;
    // Scorre solo l'elenco, senza spostare la pagina o il form sottostante.
    const top = list.scrollTop + option.getBoundingClientRect().top - list.getBoundingClientRect().top;
    if (top < list.scrollTop) list.scrollTop = top;
    else if (top + option.offsetHeight > list.scrollTop + list.clientHeight) {
      list.scrollTop = top + option.offsetHeight - list.clientHeight;
    }
  }, [expanded, activeId, query]);

  function navigate(event: KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "Escape") {
      event.preventDefault(); event.stopPropagation(); close(true);
    } else if (event.key === "Tab") {
      // Riporta il punto di tabulazione al campo originale, non al portal.
      close(true);
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (activeIndex >= 0) choose(visibleOptions[activeIndex]);
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      for (let step = 1; step <= visibleOptions.length; step++) {
        const next = (activeIndex + direction * step + visibleOptions.length) % visibleOptions.length;
        if (!visibleOptions[next].disabled) { setCursor(next); break; }
      }
    }
  }

  return (
    <div className="relative min-w-0">
      <select
        ref={selectRef}
        name={name}
        value={formValue}
        required={required}
        disabled={disabled}
        tabIndex={-1}
        aria-hidden="true"
        className="sr-only"
        onChange={(event) => {
          const option = options.find((o) => o.value === event.target.value);
          if (option) choose(option);
        }}
        onFocus={() => triggerRef.current?.focus()}
        onInvalid={(event) => {
          event.preventDefault();
          setInvalid(true);
          const firstInvalid = selectRef.current?.form?.querySelector("input:invalid, select:invalid, textarea:invalid");
          if (firstInvalid === selectRef.current) {
            triggerRef.current?.scrollIntoView({ block: "center" });
            show();
          }
        }}
      >
        <option value="">{placeholder}</option>
        {selected && <option value={selected.value}>{selected.label}</option>}
      </select>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        role="combobox"
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={expanded}
        aria-controls={expanded ? dialogId : undefined}
        aria-required={required}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? errorId : undefined}
        disabled={disabled}
        title={selected?.label}
        onClick={() => expanded ? close(true) : show()}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault(); show("", event.key === "ArrowUp");
          } else if (event.key.length === 1 && event.key !== " " && !event.ctrlKey && !event.altKey && !event.metaKey) {
            event.preventDefault(); show(event.key);
          }
        }}
        className={`${className} flex min-h-11 w-full min-w-0 items-center justify-between gap-2 text-left disabled:cursor-not-allowed disabled:opacity-50 ${invalid ? "border-danger" : ""}`}
      >
        <span className="truncate">{selected?.label ?? placeholder}</span>
        <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-ink-soft" aria-hidden="true"><path d="m5 7.5 5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>
      </button>
      {invalid && <p id={errorId} className="mt-1 text-xs text-danger">Seleziona {label.toLocaleLowerCase("it")}.</p>}

      {expanded && createPortal(
        <div
          ref={popupRef}
          id={dialogId}
          role="dialog"
          aria-label={`Seleziona ${label.toLocaleLowerCase("it")}`}
          onKeyDown={(event) => {
            if (event.key === "Escape") { event.preventDefault(); close(true); }
          }}
          className="fixed z-[100] flex flex-col overflow-hidden rounded-xl border border-line bg-panel shadow-lg"
        >
          <div className="flex shrink-0 items-center gap-2 border-b border-line p-2">
            <svg viewBox="0 0 20 20" className="ml-2 h-4 w-4 shrink-0 text-ink-faint" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="m13 13 4 4" stroke="currentColor" strokeWidth="1.5" /></svg>
            <input
              ref={searchRef}
              type="text"
              role="combobox"
              aria-label={`Cerca ${label.toLocaleLowerCase("it")}`}
              aria-autocomplete="list"
              aria-expanded="true"
              aria-controls={listId}
              aria-activedescendant={activeId}
              value={query}
              onChange={(event) => { setQuery(event.target.value); setCursor(0); }}
              onKeyDown={navigate}
              placeholder={searchPlaceholder}
              autoComplete="off"
              spellCheck={false}
              className="min-h-11 min-w-0 flex-1 rounded-md bg-panel px-2 text-base text-ink outline-none sm:text-sm"
            />
            <button type="button" aria-label="Chiudi elenco" onClick={() => close(true)} className="min-h-11 min-w-11 rounded-md text-ink-soft hover:bg-paper">×</button>
          </div>
          <ul ref={listRef} id={listId} role="listbox" aria-label={label} className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain p-1">
            {visibleOptions.map((option, index) => (
              <li
                key={option.value}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={option.value === formValue}
                aria-disabled={option.disabled || undefined}
                onPointerMove={() => { if (!option.disabled) setCursor(index); }}
                onPointerDown={(event) => event.preventDefault()}
                onClick={() => choose(option)}
                className={`flex min-h-11 cursor-pointer items-start gap-2 rounded-md px-3 py-2.5 text-sm ${option.disabled ? "cursor-default text-ink-faint" : index === activeIndex ? "bg-brand-soft text-brand-deep" : "text-ink hover:bg-paper"}`}
              >
                <span className="min-w-0 flex-1 break-words [overflow-wrap:anywhere]">{option.label}</span>
                {option.value === formValue && <span aria-hidden="true" className="shrink-0 text-brand">✓</span>}
              </li>
            ))}
          </ul>
          {matches.length === 0 && <p className="px-4 py-5 text-sm text-ink-soft">Nessun risultato. Prova con un altro nome o codice.</p>}
          <div className="flex shrink-0 items-center justify-between gap-2 border-t border-line px-3 py-2 text-xs text-ink-faint">
            <span role="status" aria-live="polite">{matches.length} di {options.length} risultati</span>
            {!required && formValue && <button type="button" onClick={() => choose({ value: "", label: placeholder })} className="min-h-9 text-brand-deep underline">Rimuovi selezione</button>}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
