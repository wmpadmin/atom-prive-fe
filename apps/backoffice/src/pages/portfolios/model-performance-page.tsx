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
import { underManagementLabel } from "./portfolio-labels";

/**
 * How each plan itself is doing — not how any one client on it is doing. A client on Growth may do better or
 * worse than Growth: they joined at a different time and drifted differently, and a plan's figure deliberately
 * averages that out. A client's own performance belongs on the client's own screen.
 */
export function ModelPerformancePage() {
  const table = useGetModelPerformance<ModelPerformanceTable, ApiError>();

  if (table.isError) {
    return <Alert tone="danger">{table.error.message}</Alert>;
  }
  const rows = table.data?.items ?? [];
  const measured = rows.filter((row) => row.sinceStart.percent !== null);
  const withoutBenchmark = rows.filter((row) => row.benchmarkName === null);

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

      {withoutBenchmark.length > 0 && measured.length > 0 && (
        <Alert tone="warning">
          {withoutBenchmark.length === 1
            ? `${withoutBenchmark[0]!.modelName} is measured against no index, so there is nothing to compare it with.`
            : `${withoutBenchmark.length} plans are measured against no index, so there is nothing to compare them with.`}{" "}
          Name a benchmark on the model and its levels, and the comparison columns fill in.
        </Alert>
      )}

      <section className="overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
              <th scope="col" className="py-3 pr-4 pl-5">Model</th>
              <th scope="col" className="px-4 py-3 text-right">Clients</th>
              <th scope="col" className="px-4 py-3 text-right">Assets</th>
              <th scope="col" className="px-4 py-3 text-right">This year</th>
              <th scope="col" className="px-4 py-3 text-right">Benchmark</th>
              <th scope="col" className="px-4 py-3 text-right">Difference</th>
              <th scope="col" className="px-4 py-3 text-right">3 years p.a.</th>
              <th scope="col" className="py-3 pr-5 pl-4 text-right">Since start</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {table.isPending && (
              <tr>
                <td colSpan={8} className="px-5 py-10 text-center text-ink-muted">Working out the returns…</td>
              </tr>
            )}
            {table.data && rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-5 py-10 text-center text-ink-muted">
                  There are no model portfolios yet.
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <Row key={row.id} row={row} currency={table.data!.currency} />
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Row({ row, currency }: { row: ModelPerformanceRow; currency: string }) {
  return (
    <tr className="hover:bg-slate-50/60">
      <td className="py-3 pr-4 pl-5">
        <span className="block font-semibold">{row.modelName}</span>
        {/* Named with its currency, or the comparison means nothing: a plan kept in dollars has not beaten an
            index quoted in rupees just because the number is bigger. */}
        <span className="block text-xs text-ink-muted">
          {row.benchmarkName ? `vs ${row.benchmarkName} · ${row.benchmarkCurrency}` : "No benchmark named"}
        </span>
      </td>
      <td className="px-4 py-3 text-right tabular-nums text-ink-soft">{row.clients}</td>
      <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums">
        {row.assets > 0 ? underManagementLabel(row.assets, currency) : <span className="text-ink-muted">—</span>}
      </td>
      <Percent value={row.thisYear.percent} period={row.thisYear} />
      <Percent value={row.thisYear.benchmark} muted />
      <Difference value={row.thisYear.difference} />
      <Percent value={row.threeYears.percent} period={row.threeYears} />
      <Percent value={row.sinceStart.percent} period={row.sinceStart} last />
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
    </td>
  );
}

/** The number that earns its place: the plan against its index, in percentage points. */
function Difference({ value }: { value: number | null }) {
  return (
    <td
      className={cn(
        "px-4 py-3 text-right font-semibold whitespace-nowrap tabular-nums",
        value === null ? "text-ink-muted" : value < 0 ? "text-rose-700" : "text-emerald-700",
      )}
    >
      {value === null ? "—" : `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(value).toFixed(1)}`}
    </td>
  );
}

/** "+8.2%", "−1.1%", and a true zero as "0.0%". */
function percentLabel(percent: number) {
  const rounded = Math.abs(percent).toFixed(1);
  if (percent > 0) return `+${rounded}%`;
  if (percent < 0) return `−${rounded}%`;
  return "0.0%";
}
