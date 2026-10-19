import { ApiError } from "@atomprive/api-client";
import {
  listProposals,
  useListProposals,
  useListProposalsAwaitingMySignOff,
  type ListProposalsStatus,
  type ProposalPage,
  type ProposalRowStatus,
} from "@atomprive/api-client/backoffice";
import { Alert, Avatar, Badge, Button, DateInput, FilterMenu, type FilterOption } from "@atomprive/ui";
import { Pagination } from "@atomprive/ui";
import { keepPreviousData } from "@tanstack/react-query";

import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { useStaffUser } from "../../auth/session";
import { APPROVES_PROPOSALS, hasAnyAuthority, readsEveryAdvisors, STARTS_PROPOSALS } from "../../lib/permissions";
import { formatDate } from "../../lib/labels";
import { DEFAULT_PAGE_SIZE, PAGE_SIZES } from "../../lib/page-sizes";
import { csvOf, download, EXPORT_LIMIT } from "./proposal-export";
import { ProposalsHeader } from "./proposals-header";
import { expiryLabel, formatValue, proposalStatusLabels, proposalStatusTones } from "./proposal-labels";

/**
 * What the list can be narrowed to. "Expiring soon" is a view of those with the client rather than a
 * status of its own, and "Waiting on me" is a different question again — not what state a proposal is in
 * but whose desk it is on, which is why it reads from the sign-off queue and not from the status filter.
 */
type Tab = "waitingOnMe" | "all" | "draft" | "manager" | "returned" | "client" | "expiringSoon"
  | "approved" | "rejected" | "expired";

/** The one that is answered rather than watched, so it is offered first and only to whoever answers. */
const WAITING_ON_ME: Tab = "waitingOnMe";

const TABS: { id: Tab; label: string; status?: ListProposalsStatus; expiringSoon?: boolean }[] = [
  { id: "waitingOnMe", label: "Waiting on me" },
  { id: "all", label: "All" },
  { id: "draft", label: "Drafts", status: "DRAFT" },
  { id: "manager", label: "Waiting for manager approval", status: "PENDING_MANAGER_REVIEW" },
  // Its own tab, not a draft: somebody has to act on what the manager wrote on it.
  { id: "returned", label: "Sent back", status: "RETURNED" },
  { id: "client", label: "Waiting for client approval", status: "PENDING_REVIEW" },
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
  const user = useStaffUser();
  const writes = hasAnyAuthority(user, ...STARTS_PROPOSALS);
  // Whoever gives a sign-off gets the one view that is theirs to act on. To everybody else it is not a
  // filter that comes back empty — it is not offered at all, because an empty queue of other people's
  // work reads as a queue you are failing to clear.
  const signsOff = hasAnyAuthority(user, ...APPROVES_PROPOSALS);
  // Whose list this is, which is a different question from whether you may write one. A portfolio manager
  // reads every advisor's, so the author is worth a column of its own and an empty list is not "you
  // haven't written one yet" — it is the firm that has written none.
  const everyAdvisors = readsEveryAdvisors(user);
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
  // Whose desk it is on is a different question from what state it is in, so it is a different endpoint:
  // the sign-off queue already knows which proposals may be answered by whoever is reading, and works
  // that out from the client's advisors rather than from a status anybody could filter to.
  // Held to whoever gives a sign-off, because the address can be typed and the old queue's link still
  // redirects here. Without this, somebody who answers nothing would ask for a queue the server will not
  // give them and sit on "Loading proposals…" for ever.
  const onMe = tab === WAITING_ON_ME && signsOff;
  const mineToAnswer = useListProposalsAwaitingMySignOff<ProposalPage, ApiError>(
    { page, size: pageSize },
    // Asked for even when the list is showing something else, because the count beside it is the whole
    // point: somebody reading their drafts should be able to see that three proposals are waiting on
    // them without first going and looking.
    { query: { placeholderData: keepPreviousData, enabled: signsOff } },
  );
  const listed = useListProposals<ProposalPage, ApiError>(
    { ...asked, page, size: pageSize },
    { query: { placeholderData: keepPreviousData, enabled: !onMe } },
  );
  const proposals = onMe ? mineToAnswer : listed;

  const [exporting, setExporting] = useState(false);
  /** What the last export left behind, and the list it was taken from. */
  const [lastExport, setLastExport] = useState<{ carried: number; of: number; under: string } | null>(null);
  const showing = JSON.stringify(asked);
  // The note belongs to the export it describes. It tells somebody to narrow the list, so the moment they
  // do it is about a file nobody has asked for yet — read against the list on screen rather than cleared
  // by hand, so no filter can be changed by a path that forgets to.
  const cappedAt = (lastExport !== null && lastExport.under === showing) ? lastExport : null;
  /**
   * Everything the filters select, not only the page being looked at — a list exported a page at a time is
   * the kind of thing somebody takes to a meeting without noticing what is missing.
   */
  async function exportFiltered() {
    setExporting(true);
    try {
      const all = await listProposals({ ...asked, page: 0, size: EXPORT_LIMIT });
      download(csvOf(all.items, everyAdvisors), `proposals-${new Date().toISOString().slice(0, 10)}.csv`);
      // Said from what came back rather than from what the screen thinks it asked for, so the figures
      // are the file's own.
      setLastExport(all.totalItems > all.items.length
        ? { carried: all.items.length, of: all.totalItems, under: showing }
        : null);
    } finally {
      setExporting(false);
    }
  }

  if (proposals.isError) {
    return <Alert tone="danger">{proposals.error.message}</Alert>;
  }
  const counts = proposals.data?.counts;
  const countFor: Record<Tab, number | undefined> = {
    // Counted by the queue it comes from, not by a status, so it is filled in beside the others below.
    waitingOnMe: undefined,
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
  const rows = proposals.data?.items ?? [];
  // Counted over this page rather than the whole queue: the API gives no firm-wide figure, and claiming
  // one from a single page would understate it on every page but the last.
  const overdue = onMe ? rows.filter((row) => row.signOffOverdue).length : 0;
  const yoursHere = onMe ? rows.filter((row) => row.advisorId === user.id).length : 0;
  /**
   * What the filter offers. The sign-off queue is left off for anybody who gives no sign-off, and its
   * count comes from the queue itself rather than from the status counts — "waiting for a manager" is
   * every advisor's, and "waiting on me" is the part of it this person may answer.
   */
  // Whose work it is matters on any list holding more than one person's, and the sign-off queue is other
  // people's work by definition — an advisor who answers for their own clients still reads proposals
  // somebody else wrote.
  const showAdvisor = everyAdvisors || onMe;
  const shown: FilterOption<Tab>[] = TABS
    .filter((one) => one.id !== WAITING_ON_ME || signsOff)
    .map((one) => ({
      id: one.id,
      label: one.label,
      count: one.id === WAITING_ON_ME
        ? (signsOff ? mineToAnswer.data?.totalItems : undefined)
        : countFor[one.id],
    }));

  return (
    <div className="space-y-6">
      <ProposalsHeader
        writes={writes}
        search={typed}
        onSearch={setTyped}
        onExport={() => void exportFiltered()}
        exporting={exporting}
        canExport={total > 0}
        cappedAt={cappedAt}
      />

      {onMe && overdue > 0 && (
        <Alert tone="warning">
          {overdue === 1 ? "One proposal on this page has" : `${overdue} proposals on this page have`} been
          waiting more than two days. Whoever can approve {overdue === 1 ? "it" : "them"} has been told once.
        </Alert>
      )}
      {onMe && yoursHere > 0 && (
        <Alert tone="info">
          {yoursHere === 1 ? "One of these is yours" : `${yoursHere} of these are yours`}, so somebody else
          approves {yoursHere === 1 ? "it" : "them"}. You can read {yoursHere === 1 ? "it" : "them"}, but not
          approve your own work.
        </Alert>
      )}

      {/* One width for every control on the row. A dropdown that shrinks to whatever is chosen makes the
          row jump about as the filter changes, and sets four boxes of four different sizes beside each
          other when it is still. */}
      <div className="flex flex-wrap items-end gap-3 [&>*]:w-44">
        <div>
          <span className="block text-2xs font-semibold tracking-wider text-ink-muted uppercase">Show</span>
          <FilterMenu label="Proposals" value={tab} options={shown} onChange={changeTab} />
        </div>
        {/* The dates narrow what is listed; they say nothing about a queue of what is waiting on you, and
            the sign-off queue is not asked for them. */}
        {!onMe && (
          <>
            <label className="block">
          <span className="block text-2xs font-semibold tracking-wider text-ink-muted uppercase">Sent from</span>
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
        <label className="block">
          <span className="block text-2xs font-semibold tracking-wider text-ink-muted uppercase">Sent to</span>
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
        <div>
          <span className="block text-2xs font-semibold tracking-wider text-ink-muted uppercase">Order</span>
          <FilterMenu
            label="Order"
            value={newestFirst ? "newest" : "oldest"}
            options={[{ id: "newest", label: "Newest first" }, { id: "oldest", label: "Oldest first" }]}
            onChange={(next) => {
              setNewestFirst(next === "newest");
              setPage(0);
            }}
          />
        </div>
          </>
        )}
        {filtered && !onMe && (
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
                {/* Only where the list holds more than one advisor's work. On a list that is all your
                    own, a column repeating your name down every row says nothing. */}
                {showAdvisor && <th scope="col" className="px-4 py-3">Advisor</th>}
                <th scope="col" className="px-4 py-3">{onMe ? "Waiting since" : "Sent"}</th>
                <th scope="col" className="px-4 py-3">Value</th>
                <th scope="col" className="px-4 py-3">Expiry</th>
                <th scope="col" className="py-3 pr-5 pl-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {!proposals.data && (
                <tr>
                  <td colSpan={showAdvisor ? 7 : 6} className="px-5 py-8 text-center text-ink-muted">
                    Loading proposals…
                  </td>
                </tr>
              )}
              {proposals.data?.items.length === 0 && (
                <tr>
                  <td colSpan={showAdvisor ? 7 : 6} className="px-5 py-10 text-center text-ink-muted">
                    {onMe
                      ? "Nothing is waiting on you."
                      : filtered
                        ? "No proposal matches what you searched for."
                        : tab === "all"
                          ? everyAdvisors
                            ? "No proposal has been written yet."
                            : "You haven't written a proposal yet."
                          : "Nothing in this tab."}
                  </td>
                </tr>
              )}
              {rows.map((proposal) => (
                // The row opens the proposal, the same as its name does. Opened from the sign-off queue it
                // says so, which is how the proposal knows to offer the way back to it.
                <tr
                  key={proposal.id}
                  onClick={() => void navigate(`/proposals/${proposal.id}${onMe ? "?from=review" : ""}`)}
                  className="cursor-pointer hover:bg-slate-50/60"
                >
                  <td className="py-3 pr-4 pl-5">
                    <Link to={`/proposals/${proposal.id}${onMe ? "?from=review" : ""}`} onClick={(event) => event.stopPropagation()} className="font-semibold hover:text-primary-600">
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
                  {showAdvisor && (
                    <td className="px-4 py-3 text-ink-soft">
                      {proposal.advisorName}
                      {/* Said on the row rather than left out of the queue: a queue that quietly dropped
                          your own work would have you hunting for a proposal that never arrived. */}
                      {onMe && proposal.advisorId === user.id && <Badge tone="neutral">Yours</Badge>}
                    </td>
                  )}
                  <td className="px-4 py-3 whitespace-nowrap text-ink-soft">
                    {onMe
                      // When it was sent for a sign-off. The draft may have been started long before, and
                      // it has no sent date at all until somebody passes it.
                      ? (proposal.submittedAt ? formatDate(proposal.submittedAt) : "—")
                      : (proposal.sentAt ? formatDate(proposal.sentAt) : "—")}
                    {onMe && proposal.signOffOverdue && <Badge tone="warning">Waiting too long</Badge>}
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
