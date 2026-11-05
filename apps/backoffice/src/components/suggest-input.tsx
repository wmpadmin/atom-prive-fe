import { cn, TextInput } from "@atomprive/ui";
import { useId, useState, type KeyboardEvent } from "react";

/** One thing offered: what goes in the box, and what else to show beside it, such as the area a postal code covers. */
export interface Offered {
  value: string;
  detail?: string;
}

/** How many are listed at once: enough to pick from, few enough to read; typing narrows the rest. */
const SHOWN = 50;

/**
 * A text box that offers what it knows as you type — the states of a country, the towns of a state — in a list
 * under it, while still taking anything typed: a town too small to be listed is written in by hand.
 *
 * <p>Arrow keys move through the list, Enter takes the one marked, Escape closes it.
 */
export function SuggestInput({ id, value, onChange, onBlur, offered, placeholder, disabled, required, ...aria }: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  offered: Offered[];
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [at, setAt] = useState(-1);
  // Narrowed only by what is typed now: a box opened with something already in it offers everything, so what
  // was there can be changed by picking.
  const [narrowing, setNarrowing] = useState(false);
  const typed = narrowing ? value.trim().toLowerCase() : "";
  const exact = offered.some((one) => one.value.toLowerCase() === typed);
  const matching = (typed && !exact
    ? offered.filter((one) => one.value.toLowerCase().includes(typed) || one.detail?.toLowerCase().includes(typed))
    : offered).slice(0, SHOWN);
  const showing = open && !disabled && matching.length > 0;

  const take = (one: Offered) => {
    onChange(one.value);
    setOpen(false);
    setAt(-1);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setAt((was) => Math.min(was + 1, matching.length - 1));
    }
    else if (event.key === "ArrowUp") {
      event.preventDefault();
      setAt((was) => Math.max(was - 1, 0));
    }
    else if (event.key === "Enter" && showing && at >= 0) {
      event.preventDefault();
      take(matching[at]);
    }
    else if (event.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className="relative">
      <TextInput
        id={id}
        role="combobox"
        aria-expanded={showing}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showing && at >= 0 ? `${listId}-${at}` : undefined}
        autoComplete="off"
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        onChange={(event) => {
          onChange(event.target.value);
          setOpen(true);
          setNarrowing(true);
          setAt(-1);
        }}
        onFocus={() => {
          setOpen(true);
          setNarrowing(false);
        }}
        onClick={() => setOpen(true)}
        onBlur={() => {
          // Closed after a moment, so a press on a row lands before the list goes.
          window.setTimeout(() => setOpen(false), 150);
          onBlur?.();
        }}
        onKeyDown={onKeyDown}
        {...aria}
      />
      {showing && (
        <ul
          id={listId}
          role="listbox"
          className="absolute top-full right-0 left-0 z-30 mt-1 max-h-64 overflow-auto rounded-lg border border-line bg-white py-1 shadow-lg"
        >
          {matching.map((one, index) => (
            <li
              key={`${one.value}-${index}`}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === at}
              onMouseDown={(event) => {
                event.preventDefault();
                take(one);
              }}
              className={cn("flex cursor-pointer items-baseline justify-between gap-3 px-3 py-2 text-sm",
                index === at ? "bg-primary-50 text-primary-700" : "hover:bg-slate-50")}
            >
              <span>{one.value}</span>
              {one.detail && <span className="truncate text-xs text-ink-muted">{one.detail}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
