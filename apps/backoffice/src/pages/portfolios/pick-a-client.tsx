import { ApiError } from "@atomprive/api-client";
import { useListCustomers, type CustomerPage } from "@atomprive/api-client/backoffice";
import { Avatar, Button, cn } from "@atomprive/ui";
import { keepPreviousData } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useState } from "react";
import { Highlight, SuggestionSearch, type Suggestion } from "../../components/suggestion-search";
import { useSuggestionsBox } from "../../components/use-suggestions-box";

/**
 * One client, for a filter bar that narrows a list to them.
 *
 * <p>Not the search above All clients, which narrows a table by whatever was typed. This picks a client
 * and hands back their id, because a history is narrowed by WHO it is about and a name typed into a box is
 * not a who — two clients called Sharma are one search and two people.
 *
 * <p>A chosen client is said as a name rather than left as an id in the address: a filter whose state is
 * invisible is a filter somebody forgets is on, and then reads an empty list as an empty history.
 */
export function PickAClient({ id, label, picked, onPick, className }: {
  id: string;
  /** What the box is for, read out where the little caption above it is not read. */
  label: string;
  /** Who is chosen, or null for everybody. The name is kept so the chip can say it. */
  picked: { customerId: string; name: string } | null;
  onPick: (who: { customerId: string; name: string } | null) => void;
  className?: string;
}) {
  // The box debounces whatever is held here; the text itself is this component's, so that choosing
  // somebody can empty it.
  const [text, setText] = useState("");
  const box = useSuggestionsBox(text);
  const { typed } = box;
  const customers = useListCustomers<CustomerPage, ApiError>(
    { query: typed, page: 0, size: 6 },
    { query: { enabled: box.showing && typed.trim() !== "", placeholderData: keepPreviousData } },
  );

  if (picked !== null) {
    return (
      <span className={cn("flex items-end gap-1.5", className)}>
        <span className="inline-flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm">
          <Avatar name={picked.name} className="size-5 text-[0.5rem]" />
          <span className="max-w-40 truncate font-medium text-ink">{picked.name}</span>
        </span>
        <Button variant="secondary" size="sm" onClick={() => onPick(null)}>
          <X aria-hidden="true" className="size-3.5" />
          <span className="sr-only">Stop narrowing to {picked.name}</span>
          Every client
        </Button>
      </span>
    );
  }

  const suggestions: Suggestion[] = (customers.data?.items ?? []).map((customer) => ({
    key: customer.id,
    group: "Clients",
    onChoose: () => {
      onPick({ customerId: customer.id, name: customer.fullName });
      setText("");
    },
    content: (
      <>
        <Avatar name={customer.fullName} className="size-8 text-2xs" />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold text-ink">
            <Highlight text={customer.fullName} query={typed} />
          </span>
          <span className="block truncate text-xs text-ink-muted">
            {customer.email ? <Highlight text={customer.email} query={typed} /> : "Entity, no email"}
          </span>
        </span>
      </>
    ),
  }));

  return (
    <SuggestionSearch
      box={box}
      id={id}
      label={label}
      placeholder="Any client"
      value={text}
      onChange={setText}
      // Enter on a name nobody picked narrows nothing: there is no "search" here, only a choice. Said by
      // doing nothing rather than by filtering to the letters somebody typed, which would be a different
      // list from the one the suggestions were promising.
      onSearch={() => box.setOpen(false)}
      suggestions={suggestions}
      loading={customers.isFetching}
      noMatches={`No clients match “${typed}”.`}
      className={cn("w-56 max-w-full", className)}
    />
  );
}
