import { ApiError } from "@atomprive/api-client";
import {
  listProposals,
  useListProposals,
  type ListProposalsStatus,
  type ProposalPage,
  type ProposalRowStatus,
} from "@atomprive/api-client/backoffice";
import { Alert, Avatar, Badge, Button, DateInput, SelectInput } from "@atomprive/ui";
import { Pagination } from "@atomprive/ui";
import { keepPreviousData } from "@tanstack/react-query";

import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { useStaffUser } from "../../auth/session";
import { hasAnyAuthority, WRITES_PROPOSALS } from "../../lib/permissions";
import { formatDate } from "../../lib/labels";
import { DEFAULT_PAGE_SIZE, PAGE_SIZES } from "../../lib/page-sizes";
import { csvOf, download, EXPORT_LIMIT } from "./proposal-export";
import { SentProposalsHeader } from "./sent-proposals-header";
import { expiryLabel, formatValue, proposalStatusLabels, proposalStatusTones } from "./proposal-labels";

/** The tabs across the top; "Expiring soon" is a view of those with the client, not a status of its own. */
type Tab = "all" | "draft" | "manager" | "returned" | "client" | "expiringSoon" | "approved" | "rejected" | "expired";

const TABS: { id: Tab; label: string; status?: ListProposalsStatus; expiringSoon?: boolean }[] = [
  { id: "all", label: "All" },
  { id: "draft", label: "Drafts", status: "DRAFT" },
  { id: "manager", label: "With the manager", status: "PENDING_MANAGER_REVIEW" },
  // Its own tab, not a draft: somebody has to act on what the manager wrote on it.
  { id: "returned", label: "Sent back", status: "RETURNED" },
  { id: "client", label: "With the client", status: "PENDING_REVIEW" },
  { id: "expiringSoon", label: "Expiring soon", expiringSoon: true },
  { id: "approved", label: "Approved", status: "APPROVED" },
  { id: "rejected", label: "Rejected", status: "REJECTED" },
  { id: "expired", label: "Expired", status: "EXPIRED" },
];

/** As far back as the date pickers will go: older than the firm, so it never gets in the way. */
function yearsAgo(years: number) {
  const day = new Date();
  return new Date(day.getFullYear() - years, day.getMonth(), day.getDate());
}

/** Every proposal this advisor has sent (#87). */
export function ProposalsPage() {
  const navigate = useNavigate();
  // Whoever oversees the firm's advice reads every proposal without writing any, so the screen is the same
  // list with nothing on it to write with.
  const writes = hasAnyAuthority(useStaffUser(), ...WRITES_PROPOSALS);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);
  // Seeded from the address, so searching from an open proposal lands here already filtered.
  const [params] = useSearchParams();
  const fromAddress = params.get("q") ?? "";
  // And the tab, so a count somewhere else can link to the proposals it counted rather than to all of them.
  // A tab nobody has heard of is the whole list, which is what somebody arriving at this screen expects.
  const named = params.get("tab");
  const [tab, setTab] = useState<Tab>(() =>
    TABS.some((one) => one.id === named) ? (named as Tab) : "all",
  );
  const [typed, setTyped] = useState(fromAddress);
  const [search, setSearch] = useState(fromAddress);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [newestFirst, setNewestFirst] = useState(true);
  const chosen = TABS.find((one) => one.id === tab) ?? TABS[0]!;
  const filtered = search !== "" || from !== "" || to !== "";

  // Searching as it is typed, but a beat behind, so a request doesn't go out per keystroke.
  useEffect(() => {
    const waiting = setTimeout(() => {
      setSearch(typed.trim());
      setPage(0);
    }, 300);
    return () => clearTimeout(waiting);
  }, [typed]);

  function changeTab(next: Tab) {
    setTab(next);
    setPage(0);
  }

  function clearFilters() {
    setTyped("");
    setSearch("");
    setFrom("");
    setTo("");
    setPage(0);
  }

  const asked = {
    status: chosen.status,
    expiringSoon: chosen.expiringSoon,
    query: search || undefined,
    from: from ? new Date(from).toISOString() : undefined,
    // A date range people read as "up to and including", so the day asked for is counted in whole.
    to: to ? new Date(new Date(to).getTime() + 86_400_000).toISOString() : undefined,
    newestFirst,
  };
  const proposals = useListProposals<ProposalPage, ApiError>(
    { ...asked, page, size: pageSize },
    { query: { placeholderData: keepPreviousData } },
  );

  const [exporting, setExporting] = useState(false);
  /**
   * Everything the filters select, not only the page being looked at — a list exported a page at a time is
   * the kind of thing somebody takes to a meeting without noticing what is missing.
   */
  async function exportFiltered() {
    setExporting(true);
    try {
      const all = await listProposals({ ...asked, page: 0, size: EXPORT_LIMIT });
      download(csvOf(all.items), `proposals-${new Date().toISOString().slice(0, 10)}.csv`);
    } finally {
      setExporting(false);
    }
  }

  if (proposals.isError) {
    return <Alert tone="danger">{proposals.error.message}</Alert>;
  }
  const counts = proposals.data?.counts;
  const countFor: Record<Tab, number | undefined> = {
    all: counts?.all,
    draft: counts?.draft,
    manager: counts?.awaitingManager,
    returned: counts?.returned,
    client: counts?.awaitingClient,
    expiringSoon: counts?.expiringSoon,
    approved: counts?.approved,
    rejected: counts?.rejected,
    expired: counts?.expired,
  };
  const total = proposals.data?.totalItems ?? 0;

  return (
    <div className="space-y-6">
      <SentProposalsHeader
        writes={writes}
        search={typed}
        onSearch={setTyped}
        onExport={() => void exportFiltered()}
        exporting={exporting}
        canExport={total > 0}
      />

      <div role="tablist" aria-label="Proposals" className="flex flex-wrap gap-2">
        {TABS.map((one) => (
          <button
            key={one.id}
            type="button"
            role="tab"
            aria-selected={tab === one.id}
            onClick={() => changeTab(one.id)}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 ${
              tab === one.id ? "border-primary-600 bg-primary-600 text-on-accent" : "border-line bg-white text-ink-soft hover:text-ink"
            }`}
          >
            {one.label}
            {countFor[one.id] !== undefined && <span className="ml-2 tabular-nums opacity-80">{countFor[one.id]}</span>}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label>
          <span className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">Sent from</span>
          <DateInput
            id="sent-from"
            name="from"
            value={from}
            clearable
            min={yearsAgo(20)}
            max={new Date()}
            onChange={(next) => {
              setFrom(next ?? "");
              setPage(0);
            }}
          />
        </label>
        <label>
          <span className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">Sent to</span>
          <DateInput
            id="sent-to"
            name="to"
            value={to}
            clearable
            min={yearsAgo(20)}
            max={new Date()}
            onChange={(next) => {
              setTo(next ?? "");
              setPage(0);
            }}
          />
        </label>
        <label>
          <span className="sr-only">Order</span>
          <SelectInput
            value={newestFirst ? "newest" : "oldest"}
            className="w-auto"
            onChange={(event) => {
              setNewestFirst(event.target.value === "newest");
              setPage(0);
            }}
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </SelectInput>
        </label>
        {filtered && (
          <Button variant="secondary" onClick={clearFilters}>
            Clear
          </Button>
        )}
      </div>

      <section className="rounded-2xl border border-line bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                <th scope="col" className="py-3 pr-4 pl-5">Proposal</th>
                <th scope="col" className="px-4 py-3">Client</th>
                <th scope="col" className="px-4 py-3">Sent</th>
                <th scope="col" className="px-4 py-3">Value</th>
                <th scope="col" className="px-4 py-3">Expiry</th>
                <th scope="col" className="py-3 pr-5 pl-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {!proposals.data && (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-ink-muted">Loading proposals…</td>
                </tr>
              )}
              {proposals.data?.items.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-ink-muted">
                    {filtered
                      ? "No proposal matches what you searched for."
                      : tab === "all"
                        ? writes
                          ? "You haven't written a proposal yet."
                          : "No proposal has been written yet."
                        : "Nothing in this tab."}
                  </td>
                </tr>
              )}
              {(proposals.data?.items ?? []).map((proposal) => (
                // The row opens the proposal, the same as its name does.
                <tr
                  key={proposal.id}
                  onClick={() => void navigate(`/proposals/${proposal.id}`)}
                  className="cursor-pointer hover:bg-slate-50/60"
                >
                  <td className="py-3 pr-4 pl-5">
                    <Link to={`/proposals/${proposal.id}`} onClick={(event) => event.stopPropagation()} className="font-semibold hover:text-primary-600">
                      {proposal.title}
                    </Link>
                    <span className="block text-xs text-ink-muted">
                      {proposal.reference}
                      {proposal.summary && ` · ${proposal.summary}`}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={proposal.customerName} />
                      <div>
                        <span className="block">{proposal.customerName}</span>
                        <span className="block font-mono text-xs text-ink-muted">{proposal.customerCode}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-ink-soft">
                    {proposal.sentAt ? formatDate(proposal.sentAt) : "—"}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap tabular-nums">
                    {formatValue(proposal.valueAmount, proposal.valueCurrency)}
                  </td>
                  <td className={`px-4 py-3 whitespace-nowrap ${proposal.expiringSoon ? "font-semibold text-amber-700" : "text-ink-soft"}`}>
                    {expiryLabel(proposal.expiresAt, proposal.status as ProposalRowStatus, proposal.decidedAt)}
                  </td>
                  <td className="py-3 pr-5 pl-4">
                    <Badge tone={proposalStatusTones[proposal.status as ProposalRowStatus]}>
                      {proposalStatusLabels[proposal.status as ProposalRowStatus]}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {total > 0 && (
          <div className="border-t border-line px-5 py-3">
            <Pagination
              page={page}
              pageSize={pageSize}
              totalItems={total}
              onPageChange={setPage}
              pageSizes={PAGE_SIZES}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(0);
              }}
              noun={["proposal", "proposals"]}
            />
          </div>
        )}
      </section>
    </div>
  );
}
