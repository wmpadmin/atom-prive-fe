import { ApiError } from "@atomprive/api-client";
import {
  useListMovePlanHistory,
  type MovePlanHistoryPage,
} from "@atomprive/api-client/backoffice";
import { Alert, DateInput, FilterMenu, Pagination } from "@atomprive/ui";
import { keepPreviousData } from "@tanstack/react-query";
import { useState } from "react";
import { DEFAULT_PAGE_SIZE, PAGE_SIZES } from "../../lib/page-sizes";
import { DealtWithPlan } from "./move-plan-rows";
import { PickAClient } from "./pick-a-client";
import { QueueBar } from "./queue-bar";

/** What a reader can narrow the record to: the three ways a plan ends, and all of them together. */
const STATUS_TABS = [
  { id: "APPROVED", label: "Approved" },
  { id: "REJECTED", label: "Rejected" },
  { id: "WITHDRAWN", label: "Cancelled" },
  { id: "all", label: "Everything" },
] as const;

type StatusTab = (typeof STATUS_TABS)[number]["id"];

/** As far back as the date pickers will go: older than the firm, so it never gets in the way. */
function yearsAgo(years: number) {
  const day = new Date();
  return new Date(day.getFullYear() - years, day.getMonth(), day.getDate());
}

/**
 * Every money move the firm has made for a client, and what became of each.
 *
 * <p>This was the tail of a queue — the Money moves screen, where whoever reads the whole book asked for a
 * client's money to be moved and that client's manager answered. That direction is a proposal now, so the
 * queue has nothing to hold; the record it kept underneath has more to hold than ever, because every way a
 * client's money moves ends up here: their own asking, and the moves a proposal made when somebody agreed
 * to it.
 *
 * <p>Read rather than worked. There are no buttons on these rows: everything on this screen has already
 * been answered, and the answering happens where the asking is.
 */
export function MoveHistoryPage() {
  const [status, setStatus] = useState<StatusTab>("all");
  const [client, setClient] = useState<{ customerId: string; name: string } | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);
  const narrowed = from !== "" || to !== "" || client !== null;

  /** Narrowing anything puts the reader back on the first page, or they land in the middle of a shorter list. */
  function narrow(change: () => void) {
    change();
    setPage(0);
  }

  const history = useListMovePlanHistory<MovePlanHistoryPage, ApiError>(
    {
      status: status === "all" ? undefined : status,
      customerId: client?.customerId,
      from: from ? new Date(from).toISOString() : undefined,
      // A date range people read as "up to and including", so the day asked for is counted in whole.
      to: to ? new Date(new Date(to).getTime() + 86_400_000).toISOString() : undefined,
      page,
      size: pageSize,
    },
    { query: { placeholderData: keepPreviousData } },
  );

  if (history.isError) {
    return <Alert tone="danger">{history.error.message}</Alert>;
  }

  const counts = history.data?.counts;
  const rows = history.data?.items ?? [];
  const total = history.data?.totalItems ?? 0;
  // How many there are, not how many arrived: the pills used to count the rows the server had sent, and
  // what it sent was a page.
  const howMany = (tab: StatusTab) =>
    tab === "all" ? counts?.all ?? 0
      : tab === "APPROVED" ? counts?.approved ?? 0
        : tab === "REJECTED" ? counts?.rejected ?? 0 : counts?.withdrawn ?? 0;

  return (
    <div className="space-y-5">
      <p className="-mt-2 text-sm text-ink-muted">
        Every move that has been made for a client, however it was asked for.
      </p>

      <section className="rounded-2xl border border-line bg-white">
        <QueueBar name="Money moved">
          {/* Whose, and when. The record runs on when each plan was ASKED, which is the date the row prints
              under the decision — a range read against the answer would put a plan asked yesterday and
              answered today on the wrong side of a boundary drawn at midnight. */}
          <label className="block">
            <span className="block text-2xs font-semibold tracking-wider text-ink-muted uppercase">Client</span>
            <PickAClient
              id="moved-client"
              label="Narrow to one client"
              picked={client}
              onPick={(who) => narrow(() => setClient(who))}
            />
          </label>
          <label className="block">
            <span className="block text-2xs font-semibold tracking-wider text-ink-muted uppercase">Asked from</span>
            <DateInput
              id="moved-from"
              name="from"
              value={from}
              clearable
              min={yearsAgo(20)}
              max={new Date()}
              onChange={(next) => narrow(() => setFrom(next ?? ""))}
            />
          </label>
          <label className="block">
            <span className="block text-2xs font-semibold tracking-wider text-ink-muted uppercase">Asked to</span>
            <DateInput
              id="moved-to"
              name="to"
              value={to}
              clearable
              min={yearsAgo(20)}
              max={new Date()}
              onChange={(next) => narrow(() => setTo(next ?? ""))}
            />
          </label>
          <FilterMenu
            label="Moves"
            value={status}
            options={STATUS_TABS.map((one) => ({ id: one.id, label: one.label, count: howMany(one.id) }))}
            onChange={(next) => narrow(() => setStatus(next as StatusTab))}
            align="right"
          />
        </QueueBar>

        {history.isPending ? (
          <p className="px-5 py-8 text-sm text-ink-muted">Reading what has been moved…</p>
        ) : rows.length === 0 ? (
          <p className="px-5 py-8 text-sm text-ink-muted">
            {/* A filter is the commonest reason a list is empty and the easiest to forget is on, so an
                empty list says which kind of empty it is. */}
            {narrowed ? "Nothing matches what you have narrowed this to." : "Nothing has been moved yet."}
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((row) => (
              <li key={row.id} className="px-5 py-4">
                <DealtWithPlan row={row} showClient />
              </li>
            ))}
          </ul>
        )}

        {total > 0 && (
          <div className="border-t border-line px-5 py-3">
            <Pagination
              page={page}
              pageSize={pageSize}
              totalItems={total}
              onPageChange={setPage}
              pageSizes={PAGE_SIZES}
              onPageSizeChange={(size) => narrow(() => setPageSize(size))}
              noun={["move", "moves"]}
            />
          </div>
        )}
      </section>
    </div>
  );
}
