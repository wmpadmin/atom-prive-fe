import { ApiError } from "@atomprive/api-client";
import {
  useListCustomers,
  useSearchEverything,
  type CustomerPage,
  type GlobalSearchResult,
} from "@atomprive/api-client/backoffice";
import { Avatar } from "@atomprive/ui";
import { keepPreviousData } from "@tanstack/react-query";
import { Briefcase, ChevronDown, ChevronRight, FileText, Layers, PanelsTopLeft, PieChart, UserRound, Users, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { useStaffUser } from "../auth/session";
import { clientFileHref, clientListHref, hasAnyAuthority, READS_CLIENT_PORTFOLIOS } from "../lib/permissions";
import { Highlight, SuggestionSearch, type Suggestion } from "./suggestion-search";
import { useSuggestionsBox } from "./use-suggestions-box";

/** A screen the person's own menu can open, for the search to find by name. */
export type SearchableScreen = { to: string; label: string; icon: LucideIcon; under: string | null };

const money = (value: number, currency: string) =>
  `${currency} ${value.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

/**
 * The search in the top bar, across the back office for every role (25 Nov 2026): the screens on your menu, your
 * clients, the holdings in their portfolios and banks' files (an ISIN finds every one of your clients holding it),
 * prospects, model portfolios, proposals and, for the Admin, staff. Each group is only what your own screens show
 * you, and the server holds it to that: a portfolio manager finds nothing only the Admin may read.
 *
 * <p>The groups come folded (25 Nov 2026, the user's choice): each shows how many it found, and opens under itself
 * when clicked, so a short word does not fill the screen with every line it touches.
 */
export function TopSearch({ screens }: { screens: SearchableScreen[] }) {
  const navigate = useNavigate();
  const user = useStaffUser();
  const [typedValue, setTypedValue] = useState("");
  const box = useSuggestionsBox(typedValue);
  const { typed } = box;
  const searching = box.showing && typed.trim().length >= 2;

  const customers = useListCustomers<CustomerPage, ApiError>(
    { query: typed, page: 0, size: 6 },
    { query: { enabled: box.showing, placeholderData: keepPreviousData } },
  );
  const everything = useSearchEverything<GlobalSearchResult, ApiError>(
    { q: typed },
    { query: { enabled: searching, placeholderData: keepPreviousData } },
  );
  const found = searching ? everything.data : undefined;
  // Which groups are open, for the words they were opened on: new words find every group folded again.
  const [opened, setOpened] = useState<{ words: string; groups: ReadonlySet<string> }>({ words: "", groups: new Set() });
  const openGroups: ReadonlySet<string> = opened.words === typed ? opened.groups : new Set();
  const toggle = (group: string) => setOpened((was) => {
    const next = new Set(was.words === typed ? was.groups : []);
    if (next.has(group)) next.delete(group);
    else next.add(group);
    return { words: typed, groups: next };
  });

  function go(to: string) {
    setTypedValue("");
    void navigate(to);
  }
  // A holding opens the client's Consolidated Holdings for whoever reads portfolios, else the client's own file.
  const holdingsOf = (customerId: string) =>
    hasAnyAuthority(user, ...READS_CLIENT_PORTFOLIOS) ? `/client-workspace/${customerId}/holdings` : clientFileHref(user, customerId);

  const words = typed.toLowerCase().split(/\s+/).filter(Boolean);
  const screenHits = typed.trim().length < 2 ? [] : screens
    .filter((one) => words.every((word) => `${one.label} ${one.under ?? ""}`.toLowerCase().includes(word)))
    .slice(0, 5);

  const line = (key: string, group: string, Icon: LucideIcon, title: string, detail: string | null, tag: string | null, to: string): Suggestion => ({
    key,
    group,
    onChoose: () => go(to),
    content: (
      <>
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-canvas text-ink-soft"><Icon aria-hidden="true" className="size-4" /></span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold text-ink"><Highlight text={title} query={typed} /></span>
          {detail && <span className="block truncate text-xs text-ink-muted"><Highlight text={detail} query={typed} /></span>}
        </span>
        {tag && <span className="font-mono text-xs whitespace-nowrap text-ink-muted">{tag}</span>}
      </>
    ),
  });

  const groups: { id: string; label: string; Icon: LucideIcon; items: Suggestion[] }[] = [
    { id: "screens", label: "Screens", Icon: PanelsTopLeft,
      items: screenHits.map((one) => line(`screen:${one.to}`, "Screens", one.icon, one.label, one.under, null, one.to)) },
    { id: "clients", label: "Clients", Icon: Users, items: (customers.data?.items ?? []).map((customer): Suggestion => ({
      key: `client:${customer.id}`,
      group: "",
      onChoose: () => go(clientFileHref(user, customer.id)),
      content: (
        <>
          <Avatar name={customer.fullName} photo={customer.photo} className="size-8 text-2xs" />
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
    })) },
    // Each line a client of yours holds: the holding, then whose it is and what it is worth there.
    { id: "holdings", label: "Holdings", Icon: Layers, items: (found?.holdings ?? []).map((one, at) => line(`holding:${at}`, "Holdings", Layers,
      one.identifier ? `${one.name} · ${one.identifier}` : one.name,
      [one.clientName, one.assetClass, one.units != null ? `${Number(one.units).toLocaleString("en-US")} units` : null,
        one.source === "BANK_FILE" ? "bank file" : "portfolio"].filter(Boolean).join(" · "),
      money(one.value, one.currency), holdingsOf(one.customerId))) },
    { id: "prospects", label: "Prospects", Icon: UserRound, items: (found?.prospects ?? []).map((one) => line(`prospect:${one.id}`, "Prospects", UserRound, one.name,
      [one.email, one.clientType === "ENTITY" ? "Entity" : "Individual"].filter(Boolean).join(" · "), one.reference, `/prospective-clients/${one.id}`)) },
    { id: "models", label: "Model portfolios", Icon: PieChart, items: (found?.models ?? []).map((one) => line(`model:${one.id}`, "Model portfolios", PieChart, one.name,
      one.riskProfile || null, null, `/model-portfolios/${one.id}`)) },
    { id: "proposals", label: "Proposals", Icon: FileText, items: (found?.proposals ?? []).map((one) => line(`proposal:${one.id}`, "Proposals", FileText, one.title,
      `${one.clientName} · ${one.status.toLowerCase().replaceAll("_", " ")}`, one.reference, `/proposals/${one.id}`)) },
    { id: "staff", label: "Staff", Icon: Briefcase, items: (found?.staff ?? []).map((one) => line(`staff:${one.id}`, "Staff", Briefcase, one.name, one.email, null, `/users/${one.id}`)) },
  ];

  // One row a group, with how many it found; its items under it once it is opened.
  const suggestions: Suggestion[] = groups.filter((one) => one.items.length > 0).flatMap((one) => {
    const open = openGroups.has(one.id);
    const Chevron = open ? ChevronDown : ChevronRight;
    const head: Suggestion = {
      key: `group:${one.id}`,
      group: "",
      keepOpen: true,
      onChoose: () => toggle(one.id),
      content: (
        <>
          <Chevron aria-hidden="true" className="size-4 shrink-0 text-ink-muted" />
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary-50 text-primary-700"><one.Icon aria-hidden="true" className="size-4" /></span>
          <span className="flex-1 font-semibold text-ink" aria-expanded={open}>{one.label}</span>
          <span className="rounded-full bg-canvas px-2 py-0.5 text-xs font-semibold text-ink-soft">{one.items.length}</span>
        </>
      ),
    };
    return open ? [head, ...one.items.map((item) => ({ ...item, group: "", content: <span className="flex min-w-0 flex-1 items-center gap-3 pl-7">{item.content}</span> }))] : [head];
  });

  return (
    <SuggestionSearch
      box={box}
      id="top-search"
      label="Search screens, clients, holdings, ISINs, prospects, models and proposals"
      placeholder="Search everything"
      value={typedValue}
      onChange={setTypedValue}
      // Enter with nothing picked goes to the client list, carrying what was typed, rather than guessing.
      onSearch={(value) => {
        setTypedValue("");
        // Through the shared helper, because only the advisor was special-cased here: a portfolio
        // manager was sent to /clients, which is closed to them, and the guard bounced them home with
        // what they had just typed thrown away. The search looked as though it had simply done nothing.
        void navigate(clientListHref(user, value));
      }}
      suggestions={suggestions}
      loading={customers.isFetching || everything.isFetching}
      showAllLabel={
        (customers.data?.totalItems ?? 0) === 0
          ? undefined
          : `Show all ${customers.data?.totalItems} clients in the client list`
      }
      noMatches={`Nothing matches “${typed}”.`}
      className="w-96 max-w-full"
    />
  );
}
