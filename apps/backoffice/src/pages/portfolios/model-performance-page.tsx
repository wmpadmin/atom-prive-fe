import { ApiError } from "@atomprive/api-client";
import {
  useGetModelPerformance,
  type ModelPerformanceRow,
  type ModelPerformanceTable,
  type PeriodReturn,
} from "@atomprive/api-client/backoffice";
import { Alert, cn } from "@atomprive/ui";
import { ListPageHeader } from "../../components/record-list";
import { formatDate } from "../../lib/labels";
import { PagedFooter, usePagedRows } from "../../lib/paged-rows";
import { underManagementLabel } from "./portfolio-labels";

/**
 * How each plan itself is doing — not how any one client on it is doing. A client on Growth may do better or
 * worse than Growth: they joined at a different time and drifted differently, and a plan's figure deliberately
 * averages that out. A client's own performance belongs on the client's own screen.
 */
export function ModelPerformancePage() {
  const table = useGetModelPerformance<ModelPerformanceTable, ApiError>();
  // Read before the refusal below, because usePagedRows is a hook and a hook cannot be called on only some
  // of a component's renders. Both lines already carried their own optional chaining, so they are safe here.
  const rows = table.data?.items ?? [];
  const measured = rows.filter((row) => row.thisYear.percent !== null);
  const paged = usePagedRows(rows);

  if (table.isError) {
    return <Alert tone="danger">{table.error.message}</Alert>;
  }

  return (
    <div className="space-y-6">
      <ListPageHeader
        title="Model performance"
        lead={
          table.data
            ? `Whether today's money is where each plan says it should be, and what it would take to put it there. In ${table.data.currency}, as at ${formatDate(table.data.asOf)}. The return is for the calendar year ${table.data.year}.`
            : "Whether today's money is where each plan says it should be."
        }
      />

      {/* The firm's own note on this screen: a return has to be time-weighted or a deposit reads as skill. */}
      <Alert tone="info">
        The first columns read today's book: what is on each plan now, how much of it has wandered past
        what the plan allows, and what putting it back would take. They do not wait on anybody writing a
        valuation down. The return does — it is time-weighted, so money paid in or taken out is not counted
        as something the manager earned or lost, and it says the days it actually covers.
      </Alert>

      {rows.length > 0 && measured.length === 0 && (
        <Alert tone="warning">
          No plan has a return yet. A return needs a portfolio written down on at least two days: the first
          writing-down is a photograph, not a period.
        </Alert>
      )}

      {/* The scrolling is the table's own rather than the card's, so the footer below sits still while the
          columns slide under it. */}
      <section className="rounded-2xl border border-line bg-white">
        <div className="overflow-x-auto">
          {/* Laid out to a fixed grid rather than to whatever the longest cell happens to be. Left to
              size itself, the column of dates pushed to the far right of the table and left a hand's
              width of nothing between it and the figure it belongs beside. Six columns, one width. */}
          <table className="w-full table-fixed text-sm">
            {/* Weighted to what each column holds rather than split six equal ways: a count of clients
                is one character and a plan's name is not, and six equal sixths set every figure adrift in
                the middle of a column of its own. */}
            <colgroup>
              <col className="w-[20%]" />
              <col className="w-[8%]" />
              <col className="w-[14%]" />
              <col className="w-[12%]" />
              <col className="w-[16%]" />
              <col className="w-[16%]" />
              <col className="w-[14%]" />
            </colgroup>
            <thead>
              <tr className="border-b border-line text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                <th scope="col" className="py-3 pr-4 pl-5">Model</th>
                <th scope="col" className="px-4 py-3 text-right">Clients</th>
                <th scope="col" className="px-4 py-3 text-right">On this plan</th>
                {/* What the plan looks like today, which is the question a desk asks of it daily. These
                    answer on today's money; the return at the end answers about a book that has changed
                    every day since. */}
                <th scope="col" className="px-4 py-3 text-right whitespace-nowrap">Outside band</th>
                <th scope="col" className="px-4 py-3 text-right whitespace-nowrap">To put right</th>
                <th scope="col" className="px-4 py-3 whitespace-nowrap">Worst gap</th>
                <th scope="col" className="py-3 pr-5 pl-4 text-right">This year</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {table.isPending && (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-ink-muted">Working out the returns…</td>
                </tr>
              )}
              {table.data && rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-ink-muted">
                    There are no model portfolios yet.
                  </td>
                </tr>
              )}
              {paged.shown.map((row) => (
                <Row key={row.id} row={row} currency={table.data!.currency} />
              ))}
            </tbody>
          </table>
        </div>
        {/* Not while the returns are still being worked out: a count under a table that says it is still
            counting answers a question nobody has asked yet. */}
        {!table.isPending && <PagedFooter paged={paged} noun={["model", "models"]} />}
      </section>
    </div>
  );
}

function Row({ row, currency }: { row: ModelPerformanceRow; currency: string }) {
  return (
    <tr className="hover:bg-slate-50/60">
      <td className="py-3 pr-4 pl-5">
        <span className="block font-semibold">{row.modelName}</span>
      </td>
      <td className="px-4 py-3 text-right tabular-nums text-ink-soft">{row.clients}</td>
      <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums">
        {row.assets > 0 ? underManagementLabel(row.assets, currency) : <span className="text-ink-muted">—</span>}
      </td>
      {/* How much of this plan's book is past what the plan allows, counted out of the clients on it —
          "2 of 3" is a different fact from "2", and the plan with one client is not in more trouble than
          the plan with twenty. */}
      <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums">
        {row.clients === 0 ? (
          <span className="text-ink-muted">—</span>
        ) : row.today.outsideBand === 0 ? (
          <span className="font-semibold text-emerald-700">All within band</span>
        ) : (
          <span className="font-semibold text-rose-700">{row.today.outsideBand} of {row.clients}</span>
        )}
      </td>
      {/* What putting the whole book back would take. Said as two figures because they are two different
          acts: selling raises the money and buying spends it, and a net figure would hide both. */}
      <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums">
        {row.today.toBuy === 0 && row.today.toSell === 0 ? (
          <span className="text-ink-muted">Nothing to do</span>
        ) : (
          <>
            <span className="block">Buy {underManagementLabel(row.today.toBuy, currency)}</span>
            <span className="block text-xs text-ink-muted">
              Sell {underManagementLabel(row.today.toSell, currency)}
            </span>
          </>
        )}
      </td>
      {/* The class the book is furthest from, and by how much. The furthest any one client is, not the
          sum across them: a class three clients are each slightly off is not the problem one client badly
          out is, and the second is what somebody opens the plan to deal with. */}
      <td className="px-4 py-3 text-ink-soft">
        {row.today.worstClass === null ? (
          <span className="text-ink-muted">—</span>
        ) : (
          <>
            <span className="block truncate">{row.today.worstClass}</span>
            <span className="block text-xs tabular-nums text-ink-muted">
              {row.today.worstGap === null ? "" : `${Math.abs(row.today.worstGap).toFixed(1)}% out`}
            </span>
          </>
        )}
      </td>
      <Percent value={row.thisYear.percent} period={row.thisYear} last />
    </tr>
  );
}

/** A return. Absent rather than estimated, so a blank is an answer: nobody has written down enough yet. */
function Percent({
  value,
  period,
  muted = false,
  last = false,
}: {
  value: number | null;
  period?: PeriodReturn;
  muted?: boolean;
  last?: boolean;
}) {
  const span = daysBetween(period);
  return (
    <td
      className={cn(
        "px-4 py-3 text-right whitespace-nowrap tabular-nums",
        last && "pr-5",
        muted && "text-ink-soft",
        !muted && value !== null && (value < 0 ? "font-semibold text-rose-700" : "font-semibold text-emerald-700"),
      )}
      // A period measured in one piece has had any movement inside it treated as happening at the end, so the
      // screen admits how coarse the answer is rather than printing two decimals as though they were earned.
      title={
        period?.from && period.to
          ? `${formatDate(period.from)} to ${formatDate(period.to)}, in ${period.split} ${period.split === 1 ? "piece" : "pieces"}`
          : undefined
      }
    >
      {value === null ? <span className="text-ink-muted">—</span> : percentLabel(value)}
      {/* What the figure actually covers, said under the figure rather than in a column of its own: the
          two percentages are measured over different periods, and one column could only describe one of
          them. Without it, four days of a portfolio being written down properly read as a year's
          performance — "+4155.4%" under a heading that says "This year". */}
      {value !== null && span !== null && (
        <span className="mt-0.5 block text-xs font-normal text-ink-muted">{span}</span>
      )}
    </td>
  );
}

/**
 * The days a figure actually covers, said as the two days themselves.
 *
 * <p>It was a count — "over 5 days" — and a count is read as the age of the thing beside it. A plan
 * written on the 16th, read on the 22nd, whose last figure is the 21st, is six days old and measured over
 * five, and nobody should have to work that out. The two days say it outright.
 *
 * <p>The first day is the first one written down inside the period, not the day the period opens: a plan
 * written in March whose first portfolio was written down in June is measured from June, because a return
 * needs a figure to start at.
 */
function daysBetween(period?: PeriodReturn) {
  if (!period?.from || !period.to) {
    return null;
  }
  const from = new Date(period.from);
  const to = new Date(period.to);
  const day = (when: Date) => when.getDate();
  const month = (when: Date) => when.toLocaleDateString("en-GB", { month: "short" });
  const year = (when: Date) => when.getFullYear();
  if (year(from) !== year(to)) {
    return `${day(from)} ${month(from)} ${year(from)} – ${day(to)} ${month(to)} ${year(to)}`;
  }
  // Within one month the month is said once: "16–21 Oct" rather than "16 Oct – 21 Oct".
  return month(from) === month(to)
    ? `${day(from)}–${day(to)} ${month(to)}`
    : `${day(from)} ${month(from)} – ${day(to)} ${month(to)}`;
}

/**
 * "+8.2%", "−1.1%", and anything that comes out as nought as "0.0%".
 *
 * <p>The sign is decided by what is drawn, not by what was worked out. A plan up a fiftieth of a percent
 * read "+0.0%" beside a plan that had not moved at all reading "0.0%" — two figures the reader cannot
 * tell apart, written differently, which reads as one of them being wrong.
 */
function percentLabel(percent: number) {
  const rounded = Math.abs(percent).toFixed(1);
  if (rounded === "0.0") return "0.0%";
  return percent > 0 ? `+${rounded}%` : `−${rounded}%`;
}
