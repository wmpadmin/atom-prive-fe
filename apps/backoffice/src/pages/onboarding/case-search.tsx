import { ApiError } from "@atomprive/api-client";
import { useListOnboardingCases, useListRelationshipManagers, type CasePage, type StaffMember } from "@atomprive/api-client/backoffice";
import { Avatar } from "@atomprive/ui";
import { keepPreviousData } from "@tanstack/react-query";
import { Highlight, SuggestionSearch, type Suggestion } from "../../components/suggestion-search";
import { useSuggestionsBox } from "../../components/use-suggestions-box";
import { caseSubtitle, type CaseStatus } from "./case-labels";
import { ClientMark } from "./case-parts";

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
  const box = useSuggestionsBox(value);
  const { typed } = box;
  const cases = useListOnboardingCases<CasePage, ApiError>(
    { query: typed, status: status || undefined, page: 0, size: 5 },
    { query: { enabled: box.showing, placeholderData: keepPreviousData } },
  );
  const managers = useListRelationshipManagers<StaffMember[], ApiError>({ query: { enabled: box.showing, staleTime: 5 * 60_000 } });

  const words = typed.toLowerCase().split(/\s+/).filter(Boolean);
  const suggestions: Suggestion[] = [
    ...(cases.data?.items ?? []).map((item) => ({
      key: item.id,
      group: "Clients",
      onChoose: () => onOpenCase(item.id),
      content: (
        <>
          <ClientMark name={item.clientName} className="size-8" />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold text-ink">
              <Highlight text={item.clientName} query={typed} />
            </span>
            <span className="block truncate text-xs text-ink-muted">
              {caseSubtitle(item)}
              {item.relationshipManager && (
                <>
                  {" · "}
                  <Highlight text={item.relationshipManager.fullName} query={typed} />
                </>
              )}
            </span>
          </span>
          <span className="shrink-0 text-xs text-ink-muted">{item.currentStage}</span>
        </>
      ),
    })),
    ...(managers.data ?? [])
      .filter((person) => words.every((word) => person.fullName.toLowerCase().includes(word)))
      .slice(0, 3)
      .map((person) => ({
        key: `manager-${person.id}`,
        group: "Relationship managers",
        onChoose: () => onSearch(person.fullName),
        content: (
          <>
            <Avatar name={person.fullName} className="size-8 text-2xs" />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold text-ink">
                <Highlight text={person.fullName} query={typed} />
              </span>
              <span className="block text-xs text-ink-muted">Show their clients</span>
            </span>
          </>
        ),
      })),
  ];
  const total = cases.data?.totalItems ?? 0;

  return (
    <SuggestionSearch
      box={box}
      id="onboarding-search"
      label="Search by client or relationship manager"
      placeholder="Search client or manager"
      value={value}
      onChange={onChange}
      onSearch={onSearch}
      suggestions={suggestions}
      loading={cases.isFetching || managers.isPending}
      showAllLabel={total === 0 ? undefined : total === 1 ? "Show the 1 matching case" : `Show all ${total} matching cases`}
      noMatches={`No clients or relationship managers match “${typed}”.`}
      className="w-80 max-w-full"
    />
  );
}
