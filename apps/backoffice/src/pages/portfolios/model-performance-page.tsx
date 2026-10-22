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
  const measured = rows.filter((row) => row.sinceStart.percent !== null);
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
            ? `How the plans themselves are doing. Calendar year ${table.data.year}, in ${table.data.currency}, as at ${formatDate(table.data.asOf)}.`
            : "How the plans themselves are doing."
        }
      />

      {/* The firm's own note on this screen: a return has to be time-weighted or a deposit reads as skill. */}
      <Alert tone="info">
        Every return here is time-weighted — the period is split at each movement of money and the pieces
        linked — so money paid in or taken out is not counted as something the manager earned or lost. A figure
        is left blank where there is not enough written down to work one out.
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
            <colgroup>
              <col className="w-1/6" />
              <col className="w-1/6" />
              <col className="w-1/6" />
              <col className="w-1/6" />
              <col className="w-1/6" />
              <col className="w-1/6" />
            </colgroup>
            <thead>
              <tr className="border-b border-line text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                <th scope="col" className="py-3 pr-4 pl-5">Model</th>
                <th scope="col" className="px-4 py-3 text-right">Clients</th>
                <th scope="col" className="px-4 py-3 text-right">Assets</th>
                <th scope="col" className="px-4 py-3 text-right">This year</th>
                <th scope="col" className="px-4 py-3 text-right">Since start</th>
              {/* The day "since start" counts from. Two plans both reading "+69.3% since start" are not
                  the same answer when one was written a month ago and the other four years ago. */}
              <th scope="col" className="py-3 pr-5 pl-4 text-right whitespace-nowrap">Started</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {table.isPending && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-ink-muted">Working out the returns…</td>
                </tr>
              )}
              {table.data && rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-ink-muted">
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
      <Percent value={row.thisYear.percent} period={row.thisYear} />
      <Percent value={row.sinceStart.percent} period={row.sinceStart} />
      {/* The day the plan itself was written, which is what the figure beside it is now counted from.
          Always known — a plan that has never been given a client still has a day it was made, so this
          column answers on the rows where every other one reads "—". */}
      <td className="py-3 pr-5 pl-4 text-right whitespace-nowrap text-ink-soft">
        {formatDate(row.createdAt)}
      </td>
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
        <span className="mt-0.5 block text-xs font-normal text-ink-muted">over {span}</span>
      )}
    </td>
  );
}

/**
 * How long a figure was measured over, in the plainest unit that fits.
 *
 * <p>Counted between the first day written down and the last, which is the period the return actually
 * covers — not the calendar period its heading names. A plan measured over four days of figures and a
 * plan measured over a year both sit under "This year", and the percentage alone cannot tell them apart.
 */
function daysBetween(period?: PeriodReturn) {
  if (!period?.from || !period.to) {
    return null;
  }
  const days = Math.round(
    (new Date(period.to).getTime() - new Date(period.from).getTime()) / 86_400_000,
  );
  if (days < 1) {
    return "one day";
  }
  if (days < 14) {
    return `${days} days`;
  }
  if (days < 60) {
    return `${Math.round(days / 7)} weeks`;
  }
  if (days < 730) {
    return `${Math.round(days / 30)} months`;
  }
  return `${(days / 365).toFixed(1)} years`;
}

/** "+8.2%", "−1.1%", and a true zero as "0.0%". */
function percentLabel(percent: number) {
  const rounded = Math.abs(percent).toFixed(1);
  if (percent > 0) return `+${rounded}%`;
  if (percent < 0) return `−${rounded}%`;
  return "0.0%";
}
