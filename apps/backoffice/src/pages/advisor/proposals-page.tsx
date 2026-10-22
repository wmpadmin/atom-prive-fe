import { ApiError } from "@atomprive/api-client";
import {
  listProposals,
  useListProposals,
  useListProposalsAwaitingMyAnswer,
  type ListProposalsStatus,
  type ProposalPage,
  type ProposalRow,
  type ProposalRowStatus,
} from "@atomprive/api-client/backoffice";
import { Alert, Avatar, Badge, Button, type FilterOption } from "@atomprive/ui";
import { Pagination } from "@atomprive/ui";
import { keepPreviousData } from "@tanstack/react-query";

import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { useStaffUser } from "../../auth/session";
import { APPROVES_PROPOSALS, hasAnyAuthority, readsEveryAdvisors } from "../../lib/permissions";
import { formatDate } from "../../lib/labels";
import { DEFAULT_PAGE_SIZE, PAGE_SIZES } from "../../lib/page-sizes";
import { QueueBar } from "../portfolios/queue-bar";
import { QueueFilters } from "../portfolios/queue-filters";
import { csvOf, download, EXPORT_LIMIT } from "./proposal-export";
import { ProposalsHeader } from "./proposals-header";
import {
  answeredLabel,
  formatValue,
  proposalStatusLabels,
  proposalStatusTones,
  standingLabel,
} from "./proposal-labels";

/**
 * What the list can be narrowed to.
 *
 * <p>Four states and one question that is not a state: "Waiting on me" asks whose desk a proposal is on
 * rather than what state it is in, which is why it reads from its own queue and not from the status
 * filter. There were ten of these when a proposal travelled between three desks with a clock on the last
 * leg; six of them named steps that no longer happen.
 */
type Tab = "waitingOnMe" | "all" | "draft" | "pending" | "approved" | "rejected";

/** The one that is answered rather than watched, so it is offered first and only to whoever answers. */
const WAITING_ON_ME: Tab = "waitingOnMe";

const TABS: { id: Tab; label: string; status?: ListProposalsStatus }[] = [
  { id: "waitingOnMe", label: "Waiting on me" },
  { id: "all", label: "All" },
  { id: "draft", label: "Drafts", status: "DRAFT" },
  { id: "pending", label: "Waiting on the relationship manager", status: "PENDING" },
  { id: "approved", label: "Approved", status: "APPROVED" },
  { id: "rejected", label: "Rejected", status: "REJECTED" },
];

/**
 * Every proposal of one kind, with the same table and the same screen behind each row.
 *
 * <p>Two screens are this component. The proposals tab is the firm's own advice, where agreeing moves the
 * money. Trade logs is the bulk rebalances, where agreeing opens the client to the portfolio desk and the
 * money moves as they place it. They are different acts and they are answered differently, so they are
 * read apart — but a reader works them the same way, so the table, the filters and the row that opens are
 * the same table, filters and row.
 */
export function ProposalsPage({ fromRebalance }: { fromRebalance?: boolean }) {
  const navigate = useNavigate();
  const user = useStaffUser();
  // Whoever answers gets the one view that is theirs to act on. To everybody else it is not a filter that
  // comes back empty — it is not offered at all, because an empty queue of other people's work reads as a
  // queue you are failing to clear.
  const answers = hasAnyAuthority(user, ...APPROVES_PROPOSALS);
  // Whose list this is, which is a different question from whether you may write one. A relationship
  // manager reads what was written for their clients and writes none, so the author is worth a column of
  // its own and an empty list is not "you haven't written one yet".
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

  const asked = {
    status: chosen.status,
    query: search || undefined,
    from: from ? new Date(from).toISOString() : undefined,
    // A date range people read as "up to and including", so the day asked for is counted in whole.
    to: to ? new Date(new Date(to).getTime() + 86_400_000).toISOString() : undefined,
    newestFirst,
    // Which kind this screen is. Left off nowhere: both screens name it, so neither can quietly show the
    // other's rows.
    fromRebalance,
  };
  // Whose desk it is on is a different question from what state it is in, so it is a different endpoint:
  // the queue already knows which proposals may be answered by whoever is reading, and works that out
  // from the client's advisors rather than from a status anybody could filter to.
  // Held to whoever answers, because the address can be typed. Without this, somebody who answers nothing
  // would ask for a queue the server will not give them and sit on "Loading proposals…" for ever.
  const onMe = tab === WAITING_ON_ME && answers;
  // Which screen this row was opened from, so the menu keeps its highlight on it and the way back leads
  // there. A proposal has three doors into it now and the address is the only thing that knows which.
  const openedFrom = onMe ? "?from=review" : fromRebalance ? "?from=trade-logs" : "";
  const mineToAnswer = useListProposalsAwaitingMyAnswer<ProposalPage, ApiError>(
    { page, size: pageSize, fromRebalance },
    // Asked for even when the list is showing something else, because the count beside it is the whole
    // point: somebody reading their drafts should be able to see that three proposals are waiting on
    // them without first going and looking.
    { query: { placeholderData: keepPreviousData, enabled: answers } },
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
    pending: counts?.pending,
    approved: counts?.approved,
    rejected: counts?.rejected,
  };
  const total = proposals.data?.totalItems ?? 0;
  const rows = proposals.data?.items ?? [];
  // Counted over this page rather than the whole queue: the API gives no firm-wide figure, and claiming
  // one from a single page would understate it on every page but the last.
  const yoursHere = onMe ? rows.filter((row) => row.advisorId === user.id).length : 0;
  /**
   * What the filter offers. The queue is left off for anybody who answers nothing, and its count comes
   * from the queue itself rather than from the status counts — "waiting on the relationship manager" is
   * every client's, and "waiting on me" is the part of it this person may answer.
   */
  // Whose work it is matters on any list holding more than one person's, and the queue is other people's
  // work by definition — a relationship manager answering for their own clients is always reading
  // something somebody else wrote.
  const showAdvisor = everyAdvisors || onMe;

  /**
   * What this reader's part in a row is: a button, or the reason there is none.
   *
   * <p>Whether they may answer it is the server's own answer, asked the way the answering itself asks it:
   * this screen can see a permission, but not who looks after the client, which is what the rule turns on.
   * Worked out here it offered a button to whoever wrote the proposal — the one person who may never
   * answer it — and none to the client's second relationship manager, who may.
   */
  function theirPart(row: ProposalRow) {
    if (row.mayAnswer) {
      return { review: true, said: null };
    }
    // Who answered it: on a client with two relationship managers, the one who comes second finds the
    // buttons gone and is owed the name of whoever was there first. The date is not repeated — the
    // column beside this one carries it — and a proposal answered before the firm recorded the name
    // says nothing here rather than "by their relationship manager", which is a column's width of
    // words for no fact at all.
    if (row.status === "APPROVED" || row.status === "REJECTED") {
      return {
        review: false,
        said: row.answeredByName
          ? answeredLabel(row.status, row.answeredByName, null, row.fromRebalance) : null,
      };
    }
    if (row.status !== "PENDING" || !answers) {
      return { review: false, said: null };
    }
    return {
      review: false,
      said: row.advisorId === user.id ? "You wrote this one" : "Waiting on their relationship manager",
    };
  }
  const shown: FilterOption<Tab>[] = TABS
    .filter((one) => one.id !== WAITING_ON_ME || answers)
    .map((one) => ({
      id: one.id,
      label: one.label,
      count: one.id === WAITING_ON_ME
        ? (answers ? mineToAnswer.data?.totalItems : undefined)
        : countFor[one.id],
    }));

  return (
    <div className="space-y-6">
      <ProposalsHeader
        onExport={() => void exportFiltered()}
        exporting={exporting}
        canExport={total > 0}
        cappedAt={cappedAt}
      />

      {onMe && yoursHere > 0 && (
        <Alert tone="info">
          {yoursHere === 1 ? "One of these is yours" : `${yoursHere} of these are yours`}, so somebody else
          answers {yoursHere === 1 ? "it" : "them"}. You can read {yoursHere === 1 ? "it" : "them"}, but not
          answer your own.
        </Alert>
      )}

      {/* Above the card, beside the search, where every other queue on the approvals screens puts them.
          Inside the card's heading row these four pushed the card's own name to the far left of four tall
          controls and read as part of the table below. */}
      <QueueFilters
        search={typed}
        onSearch={setTyped}
        searchPlaceholder="Search by proposal, reference or client"
        show={{ value: tab, options: shown, onChange: changeTab }}
        dated={onMe
          ? undefined
          : {
              verb: "Sent",
              from,
              to,
              onFrom: (day) => { setFrom(day); setPage(0); },
              onTo: (day) => { setTo(day); setPage(0); },
            }}
        newestFirst={newestFirst}
        // The queue of what is waiting on you comes from its own endpoint, which is not asked which end to
        // read from, so it is not offered a control that would do nothing.
        onNewestFirst={onMe ? undefined : (next) => { setNewestFirst(next); setPage(0); }}
      />

      <section className="rounded-2xl border border-line bg-white">
        <QueueBar name={fromRebalance ? "Bulk rebalancing" : "Proposals"} />
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              {/* The widths are set here rather than left to the longest cell. A proposal's title is the
                  only thing on the row that is as long as somebody chose to make it, so without them one
                  long title took the width from every other column and a client's name broke across two
                  lines beside it. Named in parts of the table, so the row still fits whatever the window
                  is; everything that is a date, a figure or a word stays on one line. */}
              <tr className="border-b border-line text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                <th scope="col" className="w-[16%] py-3 pr-4 pl-5">Client</th>
                <th scope="col" className="w-[30%] px-4 py-3">Proposal</th>
                {/* Only where the list holds more than one advisor's work. On a list that is all your
                    own, a column repeating your name down every row says nothing. */}
                {showAdvisor && <th scope="col" className="w-[12%] px-4 py-3">Advisor</th>}
                <th scope="col" className="px-4 py-3 whitespace-nowrap">Sent</th>
                <th scope="col" className="px-4 py-3 whitespace-nowrap">Value</th>
                <th scope="col" className="px-4 py-3 whitespace-nowrap">Standing</th>
                <th scope="col" className="px-4 py-3 whitespace-nowrap">Status</th>
                <th scope="col" className="py-3 pr-5 pl-4 text-right"><span className="sr-only">Answer</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {!proposals.data && (
                <tr>
                  <td colSpan={showAdvisor ? 8 : 7} className="px-5 py-8 text-center text-ink-muted">
                    Loading proposals…
                  </td>
                </tr>
              )}
              {proposals.data?.items.length === 0 && (
                <tr>
                  <td colSpan={showAdvisor ? 8 : 7} className="px-5 py-10 text-center text-ink-muted">
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
                // The row opens the proposal, the same as its name does. Opened from the queue it says so,
                // which is how the proposal knows to offer the way back to it.
                <tr
                  key={proposal.id}
                  onClick={() => void navigate(`/proposals/${proposal.id}${openedFrom}`)}
                  className="cursor-pointer hover:bg-slate-50/60"
                >
                  <td className="py-3 pr-4 pl-5">
                    <div className="flex items-center gap-3">
                      <Avatar name={proposal.customerName} />
                      {/* A name is read as one thing, so it is kept on one line and cut where it will not
                          fit — broken across two it reads as two people. */}
                      <div className="min-w-0">
                        <span className="block truncate">{proposal.customerName}</span>
                        <span className="block font-mono text-xs text-ink-muted">{proposal.customerCode}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Link to={`/proposals/${proposal.id}${openedFrom}`} onClick={(event) => event.stopPropagation()} className="font-semibold hover:text-primary-600">
                      {proposal.title}
                    </Link>
                    {/* The reference and nothing else. The summary sat here too and said the title again
                        in other words — "Out of Yield Enhancement Strategies, into 3 lines" under "Move
                        USD 2,895 out of Yield Enhancement Strategies" — which took a second line of every
                        row to repeat what the first had said. It is on the proposal itself, where the
                        legs it describes are. The reference stays: it is what somebody searches by, and
                        the row says it nowhere else. */}
                    <span className="block text-xs text-ink-muted">{proposal.reference}</span>
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
                    {proposal.sentAt ? formatDate(proposal.sentAt) : "—"}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap tabular-nums">
                    {formatValue(proposal.valueAmount, proposal.valueCurrency)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-ink-soft">
                    {standingLabel(proposal.status as ProposalRowStatus, proposal.sentAt, proposal.decidedAt,
                      proposal.fromRebalance, proposal.openForPlacing)}
                  </td>
                  {/* Who answered it sits under the answer, where it belongs. It used to sit in the last
                      column — the one the Review button is in — so on an answered row it was a sentence
                      floating at the far right of the table under no heading at all, a hand's width from
                      the badge it was about. */}
                  <td className="px-4 py-3">
                    <Badge tone={proposalStatusTones[proposal.status as ProposalRowStatus]}>
                      {proposalStatusLabels[proposal.status as ProposalRowStatus]}
                    </Badge>
                    {(() => {
                      const part = theirPart(proposal);
                      return !part.review && part.said
                        ? <span className="mt-1 block text-xs text-ink-muted">{part.said}</span>
                        : null;
                    })()}
                  </td>
                  {/* The way in to answering it, and the only one: a proposal is answered on its own page,
                      where the legs, the reason and the client's position against their plan are. Saying
                      yes here moves the money, and a queue that took that answer off a row would be taking
                      it without any of that in front of the person giving it.

                      Said as a button because a row that is waiting on somebody should tell them what to
                      do about it. The row and its name open the same screen; a reader who never discovers
                      that a row is clickable was being shown a queue with nothing to press. */}
                  <td className="py-3 pr-5 pl-4 text-right">
                    {(() => {
                      const part = theirPart(proposal);
                      return part.review
                        ? (
                            <Button
                              size="sm"
                              onClick={(event) => {
                                event.stopPropagation();
                                void navigate(`/proposals/${proposal.id}${openedFrom}`);
                              }}
                            >
                              Review
                            </Button>
                          )
                        : null;
                    })()}
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
