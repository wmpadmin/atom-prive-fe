import { ApiError } from "@atomprive/api-client";
import { useListCustomers, type CustomerPage, type ListCustomersParams } from "@atomprive/api-client/backoffice";
import { Avatar, Badge } from "@atomprive/ui";
import { keepPreviousData } from "@tanstack/react-query";
import { Highlight, SuggestionSearch, type Suggestion } from "../../components/suggestion-search";
import { useSuggestionsBox } from "../../components/use-suggestions-box";
import { kycStatusLabels, kycStatusTones } from "./client-labels";

interface ClientSearchProps {
  value: string;
  /** The other filters in use, so suggestions agree with the table. */
  filters: Omit<ListCustomersParams, "query" | "page" | "size">;
  onChange: (value: string) => void;
  /** Filters the table straight away, as Enter does. */
  onSearch: (value: string) => void;
}

/** The search box above All clients, suggesting clients by name or email as you type. */
export function ClientSearch({ value, filters, onChange, onSearch }: ClientSearchProps) {
  const box = useSuggestionsBox(value);
  const { typed } = box;
  const customers = useListCustomers<CustomerPage, ApiError>(
    { ...filters, query: typed, page: 0, size: 6 },
    { query: { enabled: box.showing, placeholderData: keepPreviousData } },
  );

  const suggestions: Suggestion[] = (customers.data?.items ?? []).map((customer) => ({
    key: customer.id,
    group: "Clients",
    // Until clients have their own page, picking someone narrows the list to them.
    onChoose: () => onSearch(customer.email ?? customer.fullName),
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
        <Badge tone={kycStatusTones[customer.kycStatus]}>{kycStatusLabels[customer.kycStatus]}</Badge>
      </>
    ),
  }));
  const total = customers.data?.totalItems ?? 0;

  return (
    <SuggestionSearch
      box={box}
      id="client-search"
      label="Search clients by name or email"
      placeholder="Search name, email or code"
      value={value}
      onChange={onChange}
      onSearch={onSearch}
      suggestions={suggestions}
      loading={customers.isFetching}
      showAllLabel={total === 0 ? undefined : total === 1 ? "Show the 1 matching client" : `Show all ${total} matching clients`}
      noMatches={`No clients match “${typed}”.`}
      className="w-72 max-w-full"
    />
  );
}
