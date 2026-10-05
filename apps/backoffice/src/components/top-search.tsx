import { ApiError } from "@atomprive/api-client";
import { useListCustomers, type CustomerPage } from "@atomprive/api-client/backoffice";
import { Avatar } from "@atomprive/ui";
import { keepPreviousData } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router";
import { useStaffUser } from "../auth/session";
import { clientFileHref } from "../lib/permissions";
import { Highlight, SuggestionSearch, type Suggestion } from "./suggestion-search";
import { useSuggestionsBox } from "./use-suggestions-box";

/**
 * The search in the top bar. It looks for clients and opens the one you pick, from wherever you are.
 *
 * <p>Clients and nothing else, on purpose: every back-office role may see the client list, so this box finds
 * something for whoever is signed in. Searching proposals or models from here would come back empty for the
 * teams that cannot read them, which is worse than not offering it.
 */
export function TopSearch() {
  const navigate = useNavigate();
  const user = useStaffUser();
  const [typedValue, setTypedValue] = useState("");
  const box = useSuggestionsBox(typedValue);
  const { typed } = box;

  const customers = useListCustomers<CustomerPage, ApiError>(
    { query: typed, page: 0, size: 6 },
    { query: { enabled: box.showing, placeholderData: keepPreviousData } },
  );

  function open(clientId: string) {
    setTypedValue("");
    // By the route this person may open: an advisor's clients are under My clients, and the directory of
    // every client is not theirs to see.
    void navigate(clientFileHref(user, clientId));
  }

  const suggestions: Suggestion[] = (customers.data?.items ?? []).map((customer) => ({
    key: customer.id,
    group: "Clients",
    onChoose: () => open(customer.id),
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
        <span className="font-mono text-xs text-ink-muted">{customer.code}</span>
      </>
    ),
  }));

  return (
    <SuggestionSearch
      box={box}
      id="top-search"
      label="Search clients by name, email or code"
      placeholder="Search clients"
      value={typedValue}
      onChange={setTypedValue}
      // Enter with nothing picked goes to the list, carrying what was typed, rather than guessing a client.
      onSearch={(value) => {
        setTypedValue("");
        void navigate(
          user.activeRole === "ADVISOR"
            ? `/my-clients?q=${encodeURIComponent(value)}`
            : `/clients?q=${encodeURIComponent(value)}`,
        );
      }}
      suggestions={suggestions}
      loading={customers.isFetching}
      showAllLabel={
        (customers.data?.totalItems ?? 0) === 0
          ? undefined
          : `Show all ${customers.data?.totalItems} in the client list`
      }
      noMatches={`No clients match “${typed}”.`}
      className="w-72 max-w-full"
    />
  );
}
