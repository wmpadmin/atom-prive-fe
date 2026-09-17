import { ApiError } from "@atomprive/api-client";
import {
  useListOnboardingCases,
  useListRelationshipManagers,
  type CasePage,
  type CaseSummary,
  type StaffMember,
} from "@atomprive/api-client/backoffice";
import { Avatar, cn, TextInput } from "@atomprive/ui";
import { keepPreviousData } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { useState, type KeyboardEvent, type ReactNode } from "react";
import { useDebouncedValue } from "../../lib/use-debounced-value";
import { caseSubtitle, type CaseStatus } from "./case-labels";
import { ClientMark } from "./case-parts";

const LISTBOX_ID = "onboarding-search-suggestions";
const MAX_CASES = 5;
const MAX_MANAGERS = 3;

type Suggestion = { kind: "case"; item: CaseSummary } | { kind: "manager"; person: StaffMember } | { kind: "all" };

interface CaseSearchProps {
  value: string;
  /** The status filter in use, so suggestions agree with the table. */
  status: CaseStatus | "";
  onChange: (value: string) => void;
  /** Filters the table straight away, as Enter does. */
  onSearch: (value: string) => void;
  onOpenCase: (id: string) => void;
}

/** The search box above the case list, suggesting clients and relationship managers as you type. */
export function CaseSearch({ value, status, onChange, onSearch, onOpenCase }: CaseSearchProps) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const typed = useDebouncedValue(value.trim(), 150);
  const words = typed.toLowerCase().split(/\s+/).filter(Boolean);
  const showing = open && typed !== "";

  const cases = useListOnboardingCases<CasePage, ApiError>(
    { query: typed, status: status || undefined, page: 0, size: MAX_CASES },
    { query: { enabled: showing, placeholderData: keepPreviousData } },
  );
  const managers = useListRelationshipManagers<StaffMember[], ApiError>({ query: { enabled: showing, staleTime: 5 * 60_000 } });

  const matchingManagers = (managers.data ?? [])
    .filter((person) => words.every((word) => person.fullName.toLowerCase().includes(word)))
    .slice(0, MAX_MANAGERS);
  const suggestions: Suggestion[] = [
    ...(cases.data?.items ?? []).map((item): Suggestion => ({ kind: "case", item })),
    ...matchingManagers.map((person): Suggestion => ({ kind: "manager", person })),
  ];
  if (suggestions.length > 0) suggestions.push({ kind: "all" });
  const total = cases.data?.totalItems ?? 0;

  function choose(suggestion: Suggestion) {
    setOpen(false);
    setActive(-1);
    if (suggestion.kind === "case") onOpenCase(suggestion.item.id);
    else if (suggestion.kind === "manager") onSearch(suggestion.person.fullName);
    else onSearch(value);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!showing) {
        setOpen(value.trim() !== "");
        return;
      }
      const count = suggestions.length;
      if (count === 0) return;
      setActive((current) => (event.key === "ArrowDown" ? (current + 1) % count : current <= 0 ? count - 1 : current - 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const suggestion = showing ? suggestions[active] : undefined;
      if (suggestion) {
        choose(suggestion);
      } else {
        setOpen(false);
        onSearch(value);
      }
    } else if (event.key === "Escape" && showing) {
      // Closes the suggestions first; a second Escape clears the box.
      event.preventDefault();
      setOpen(false);
    }
  }

  const optionId = (index: number) => `${LISTBOX_ID}-${index}`;
  const firstManager = suggestions.findIndex((suggestion) => suggestion.kind === "manager");

  return (
    <div className="relative">
      <label htmlFor="onboarding-search" className="sr-only">
        Search by client or relationship manager
      </label>
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
      <TextInput
        id="onboarding-search"
        type="search"
        role="combobox"
        aria-expanded={showing}
        aria-controls={LISTBOX_ID}
        aria-autocomplete="list"
        aria-activedescendant={showing && active >= 0 ? optionId(active) : undefined}
        placeholder="Search client or manager"
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          setActive(-1);
          setOpen(event.target.value.trim() !== "");
        }}
        onFocus={() => setOpen(value.trim() !== "")}
        onBlur={() => setOpen(false)}
        onKeyDown={handleKeyDown}
        autoComplete="off"
        className="w-80 max-w-full pl-9"
      />

      {showing && (
        <div
          // Keeps the focus in the search box while a suggestion is clicked.
          onMouseDown={(event) => event.preventDefault()}
          className="absolute top-full left-0 z-20 mt-1.5 w-[max(100%,26rem)] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-line bg-white shadow-lg"
        >
          {suggestions.length === 0 && (
            <p role="status" className="px-4 py-3 text-sm text-ink-muted">
              {cases.isFetching || managers.isPending ? "Searching…" : `No clients or relationship managers match “${typed}”.`}
            </p>
          )}
          <ul id={LISTBOX_ID} role="listbox" aria-label="Suggestions" className={cn(suggestions.length > 0 && "py-1.5")}>
            {suggestions.map((suggestion, index) => (
              <SuggestionRow
                key={suggestion.kind === "case" ? suggestion.item.id : suggestion.kind === "manager" ? `m-${suggestion.person.id}` : "all"}
                id={optionId(index)}
                active={index === active}
                heading={index === 0 && suggestion.kind === "case" ? "Clients" : index === firstManager ? "Relationship managers" : undefined}
                onPoint={() => setActive(index)}
                onChoose={() => choose(suggestion)}
                divided={suggestion.kind === "all"}
              >
                {suggestion.kind === "case" && (
                  <>
                    <ClientMark name={suggestion.item.clientName} className="size-8" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-ink">{highlight(suggestion.item.clientName, words)}</span>
                      <span className="block truncate text-xs text-ink-muted">
                        {caseSubtitle(suggestion.item)}
                        {suggestion.item.relationshipManager && <> · {highlight(suggestion.item.relationshipManager.fullName, words)}</>}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-ink-muted">{suggestion.item.currentStage}</span>
                  </>
                )}
                {suggestion.kind === "manager" && (
                  <>
                    <Avatar name={suggestion.person.fullName} className="size-8 text-2xs" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-ink">{highlight(suggestion.person.fullName, words)}</span>
                      <span className="block text-xs text-ink-muted">Show their clients</span>
                    </span>
                  </>
                )}
                {suggestion.kind === "all" && (
                  <>
                    <Search aria-hidden="true" className="size-4 text-primary-600" />
                    <span className="flex-1 font-semibold text-primary-700">
                      {total === 1 ? "Show the 1 matching case" : `Show all ${total} matching cases`}
                    </span>
                    <kbd className="rounded-md border border-line bg-slate-50 px-1.5 py-0.5 font-sans text-2xs text-ink-muted">Enter</kbd>
                  </>
                )}
              </SuggestionRow>
            ))}
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

/** The text with the searched-for words in bold. */
function highlight(text: string, words: string[]): ReactNode {
  if (words.length === 0) return text;
  const pattern = new RegExp(`(${words.map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
  return text.split(pattern).map((part, index) =>
    index % 2 === 1 ? (
      <mark key={index} className="bg-transparent font-bold text-primary-700">
        {part}
      </mark>
    ) : (
      part
    ),
  );
}
