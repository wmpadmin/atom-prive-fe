import { cn, TextInput } from "@atomprive/ui";
import { Search } from "lucide-react";
import type { KeyboardEvent, ReactNode } from "react";
import type { SuggestionsBox } from "./use-suggestions-box";

export interface Suggestion {
  key: string;
  /** The heading shown above the first suggestion of each group, such as "Clients". */
  group: string;
  content: ReactNode;
  onChoose: () => void;
}

interface SuggestionSearchProps {
  box: SuggestionsBox;
  id: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  /** Filters by the text straight away: Enter with no suggestion picked, or the last row. */
  onSearch: (value: string) => void;
  suggestions: Suggestion[];
  loading: boolean;
  /** The last row, such as "Show all 12 matching cases"; left out when there's nothing more to show. */
  showAllLabel?: string;
  /** Shown when nothing matches, such as "No customers match “ama”." */
  noMatches: string;
  className?: string;
}

/**
 * A search box that suggests matches as you type, in a list under it. Arrow keys move through the suggestions,
 * Enter picks one (or searches for what's typed), and Escape closes the list.
 */
export function SuggestionSearch({ box, id, label, placeholder, value, onChange, onSearch, suggestions, loading, showAllLabel, noMatches, className }: SuggestionSearchProps) {
  const listboxId = `${id}-suggestions`;
  const rows = suggestions.length > 0 && showAllLabel ? [...suggestions, { key: "all", group: "", content: null, onChoose: () => onSearch(value) }] : suggestions;

  function choose(index: number) {
    box.setOpen(false);
    box.setActive(-1);
    rows[index]?.onChoose();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!box.showing) {
        box.setOpen(value.trim() !== "");
        return;
      }
      if (rows.length === 0) return;
      box.setActive((current) => (event.key === "ArrowDown" ? (current + 1) % rows.length : current <= 0 ? rows.length - 1 : current - 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (box.showing && rows[box.active]) {
        choose(box.active);
      } else {
        box.setOpen(false);
        onSearch(value);
      }
    } else if (event.key === "Escape" && box.showing) {
      // Closes the suggestions first; a second Escape clears the box.
      event.preventDefault();
      box.setOpen(false);
    }
  }

  const optionId = (index: number) => `${listboxId}-${index}`;

  return (
    <div className={cn("relative", className)}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
      <TextInput
        id={id}
        type="search"
        role="combobox"
        aria-expanded={box.showing}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={box.showing && box.active >= 0 ? optionId(box.active) : undefined}
        placeholder={placeholder}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          box.setActive(-1);
          box.setOpen(event.target.value.trim() !== "");
        }}
        onFocus={() => box.setOpen(value.trim() !== "")}
        onBlur={() => box.setOpen(false)}
        onKeyDown={handleKeyDown}
        autoComplete="off"
        className="w-full pl-9"
      />

      {box.showing && (
        <div
          // Keeps the focus in the search box while a suggestion is clicked.
          onMouseDown={(event) => event.preventDefault()}
          className="absolute top-full left-0 z-20 mt-1.5 w-[max(100%,26rem)] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-line bg-white shadow-lg"
        >
          {rows.length === 0 && (
            <p role="status" className="px-4 py-3 text-sm text-ink-muted">
              {loading ? "Searching…" : noMatches}
            </p>
          )}
          <ul id={listboxId} role="listbox" aria-label="Suggestions" className={cn(rows.length > 0 && "py-1.5")}>
            {rows.map((row, index) => {
              const isLast = row.key === "all";
              const heading = !isLast && (index === 0 || rows[index - 1]?.group !== row.group) ? row.group : undefined;
              return (
                <SuggestionRow
                  key={row.key}
                  id={optionId(index)}
                  active={index === box.active}
                  heading={heading}
                  divided={isLast}
                  onPoint={() => box.setActive(index)}
                  onChoose={() => choose(index)}
                >
                  {isLast ? (
                    <>
                      <Search aria-hidden="true" className="size-4 text-primary-600" />
                      <span className="flex-1 font-semibold text-primary-700">{showAllLabel}</span>
                      <kbd className="rounded-md border border-line bg-slate-50 px-1.5 py-0.5 font-sans text-2xs text-ink-muted">Enter</kbd>
                    </>
                  ) : (
                    row.content
                  )}
                </SuggestionRow>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

interface SuggestionRowProps {
  id: string;
  active: boolean;
  heading?: string;
  divided?: boolean;
  onPoint: () => void;
  onChoose: () => void;
  children: ReactNode;
}

function SuggestionRow({ id, active, heading, divided, onPoint, onChoose, children }: SuggestionRowProps) {
  return (
    <>
      {heading && (
        <li role="presentation" className="px-4 pt-2 pb-1 text-2xs font-semibold tracking-wider text-ink-muted uppercase">
          {heading}
        </li>
      )}
      {divided && <li role="presentation" className="my-1.5 border-t border-line" />}
      <li
        id={id}
        role="option"
        aria-selected={active}
        onMouseMove={onPoint}
        onClick={onChoose}
        className={cn("mx-1.5 flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-sm", active && "bg-primary-50")}
      >
        {children}
      </li>
    </>
  );
}

/** The text with the words searched for in bold. */
export function Highlight({ text, query }: { text: string; query: string }) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return <>{text}</>;
  const pattern = new RegExp(`(${words.map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
  return (
    <>
      {text.split(pattern).map((part, index) =>
        index % 2 === 1 ? (
          <mark key={index} className="bg-transparent font-bold text-primary-700">
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </>
  );
}
