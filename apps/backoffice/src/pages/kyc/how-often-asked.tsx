import { ApiError, http } from "@atomprive/api-client";
import type { ChecklistForA, ChecklistPaperSettings, ChecklistView } from "@atomprive/api-client/backoffice";
import { Alert, SelectInput, TextInput, cn } from "@atomprive/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useStaffUser } from "../../auth/session";
import { formatDate } from "../../lib/labels";
import { hasAuthority } from "../../lib/permissions";

type ClientType = ChecklistForA["clientType"];

/** How often a paper is asked for again (26 Nov 2026), as the server keeps it. */
type Frequency = "ONCE_BEFORE_ONBOARDING" | "ONCE_AFTER_ONBOARDING" | "MONTHLY" | "QUARTERLY" | "HALF_YEARLY" | "YEARLY";

/** One choice and where it stands: clients with an approved copy, and the first of them to need a fresh one. */
type Choice = { frequency: Frequency; clientsWithACopy: number; nextDue: string | null };

/** Every paper's two choices, by paper; read with a hand-written call until the API client is next generated. */
type FrequenciesView = { papers: Record<string, Partial<Record<ClientType, Choice>>> };

const FREQUENCIES = "/api/backoffice/kyc/frequencies";

const FREQUENCY_LABEL: Record<Frequency, string> = {
  ONCE_BEFORE_ONBOARDING: "Once, before onboarding",
  ONCE_AFTER_ONBOARDING: "Once, after onboarding",
  MONTHLY: "Every month",
  QUARTERLY: "Every quarter",
  HALF_YEARLY: "Twice a year",
  YEARLY: "Once a year",
};

const KIND: Record<ClientType, { column: string }> = {
  INDIVIDUAL: { column: "An individual" },
  ENTITY: { column: "A company or trust" },
};

const BOTH: ClientType[] = ["INDIVIDUAL", "ENTITY"];

const CATEGORY: Record<ChecklistPaperSettings["category"], string> = {
  IDENTITY: "Identity",
  ADDRESS: "Address proof",
  INCOME: "Income",
  SOURCE_OF_FUNDS: "Source of funds",
  ENTITY: "Company",
  OTHER: "Other",
};

/** The choices that ask for a fresh copy again and again, rather than once. */
const REPEATS: Frequency[] = ["MONTHLY", "QUARTERLY", "HALF_YEARLY", "YEARLY"];

/**
 * How often each paper is asked for again (26 Nov 2026), the second tab of What KYC asks for: for every paper, one
 * choice for an individual and one for a company or trust — once before onboarding, once after onboarding, every month,
 * every quarter, twice a year or once a year — counted from each client's last approved copy. Every paper has both, whether or not that kind's
 * checklist asks for it yet; the choice applies once it does. Saved the moment it is picked.
 */
export function HowOftenAsked({ view }: { view: ChecklistView }) {
  const user = useStaffUser();
  const mayChange = hasAuthority(user, "APPROVE_ONBOARDING:CHANGE");
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const frequencies = useQuery<FrequenciesView, ApiError>({
    queryKey: [FREQUENCIES],
    queryFn: () => http<FrequenciesView>(FREQUENCIES),
  });
  const change = useMutation<FrequenciesView, ApiError, { clientType: ClientType; paperId: string; frequency: Frequency }>({
    mutationFn: ({ clientType, paperId, frequency }) =>
      http<FrequenciesView>(`${FREQUENCIES}/${clientType}/${paperId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ frequency }),
      }),
    onSuccess: (next) => queryClient.setQueryData([FREQUENCIES], next),
  });

  if (frequencies.isPending) {
    return <p className="text-sm text-ink-muted">Reading how often each paper is asked for…</p>;
  }
  if (frequencies.isError) {
    return <Alert tone="danger">{frequencies.error.message}</Alert>;
  }

  const choiceOf = (paperId: string, clientType: ClientType): Choice =>
    frequencies.data.papers[paperId]?.[clientType] ?? { frequency: "ONCE_BEFORE_ONBOARDING", clientsWithACopy: 0, nextDue: null };
  const onList = (clientType: ClientType, paperId: string) =>
    view.lists.find((list) => list.clientType === clientType)?.papers.some((paper) => paper.id === paperId) ?? false;
  const settingsOf = (clientType: ClientType, paperId: string) =>
    view.lists.find((list) => list.clientType === clientType)?.settings[paperId];
  const live = view.papers.filter((paper) => !paper.retired);
  const words = search.trim().toLowerCase();
  const shown = live.filter((paper) => !words || paper.name.toLowerCase().includes(words));

  return (
    <section className="rounded-2xl border border-line bg-white" aria-labelledby="how-often-title">
      {/* The heading and a search (26 Nov 2026): the explaining text and the All / Asked again / Once only filter taken
          off at the firm's ask. */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5">
        <h2 id="how-often-title" className="text-base font-bold">How often each paper is asked for again</h2>
        <TextInput aria-label="Search a paper" placeholder="Search a paper" value={search}
          onChange={(event) => setSearch(event.target.value)} className="w-full sm:w-96" />
      </div>

      {change.error && <div className="px-5 pt-3"><Alert tone="danger">{change.error.message}</Alert></div>}

      <div className="mt-4 grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)] gap-x-5 px-5 pb-2 text-2xs font-semibold tracking-wider text-ink-muted uppercase">
        <span>Paper</span>
        {BOTH.map((clientType) => <span key={clientType}>{KIND[clientType].column}</span>)}
      </div>
      <ul>
        {shown.map((paper) => {
          const settings = BOTH.map((clientType) => settingsOf(clientType, paper.id)).find(Boolean);
          return (
            <li key={paper.id} className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)] items-start gap-x-5 border-t border-line px-5 py-3">
              <span className="min-w-0 pt-1.5">
                <span className="block truncate text-sm font-semibold">{paper.name}</span>
                <span className="block truncate text-xs text-ink-muted">
                  {settings
                    ? [settings.mandatory ? "Mandatory" : "Optional", CATEGORY[settings.category],
                        settings.expiryRequired ? "expiry required" : null].filter(Boolean).join(" · ")
                    : null}
                </span>
              </span>
              {BOTH.map((clientType) => {
                const choice = choiceOf(paper.id, clientType);
                const repeated = REPEATS.includes(choice.frequency);
                const saving = change.isPending && change.variables?.paperId === paper.id && change.variables.clientType === clientType;
                return (
                  <span key={clientType} className="min-w-0">
                    <SelectInput
                      aria-label={`How often ${paper.name} is asked of ${KIND[clientType].column.toLowerCase()}`}
                      value={saving ? change.variables!.frequency : choice.frequency}
                      disabled={!mayChange || change.isPending}
                      onChange={(event) => change.mutate({ clientType, paperId: paper.id, frequency: event.target.value as Frequency })}
                      className={cn("w-full max-w-72", choice.frequency !== "ONCE_BEFORE_ONBOARDING" && "border-primary-100 bg-primary-50 font-semibold text-primary-700")}
                    >
                      {(Object.keys(FREQUENCY_LABEL) as Frequency[]).map((one) => (
                        <option key={one} value={one}>{FREQUENCY_LABEL[one]}</option>
                      ))}
                    </SelectInput>
                    <span className="mt-1 block text-xs text-ink-muted">
                      {/* Nothing under a paper this kind of client isn't asked for (26 Nov 2026): the checklist tab says
                          who is asked for what. */}
                      {saving
                        ? "Saving…"
                        : !onList(clientType, paper.id)
                          ? null
                          : choice.frequency === "ONCE_AFTER_ONBOARDING"
                            ? "Not asked while a prospect · the RM is asked once the client is onboarded"
                            : repeated
                            ? choice.clientsWithACopy > 0 && choice.nextDue
                              ? `${choice.clientsWithACopy} client${choice.clientsWithACopy === 1 ? "" : "s"} with a copy · next due from ${formatDate(choice.nextDue)}`
                              : "No client has an approved copy yet"
                            : null}
                    </span>
                  </span>
                );
              })}
            </li>
          );
        })}
        {shown.length === 0 && <li className="border-t border-line px-5 py-6 text-sm text-ink-muted">No paper matches.</li>}
      </ul>
      <div className="flex flex-wrap justify-between gap-2 border-t border-line px-5 py-3 text-xs text-ink-muted">
        <span>Saved as soon as it is chosen, and kept in the audit log. A change counts from each client's last approved copy.</span>
        <span>Showing {shown.length} of {live.length}</span>
      </div>
    </section>
  );
}
