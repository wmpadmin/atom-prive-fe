import { ApiError } from "@atomprive/api-client";
import { useGetManagementInformation, type ManagementFigures } from "@atomprive/api-client/backoffice";
import { Alert, cn } from "@atomprive/ui";
import { ListPageHeader } from "../../components/record-list";
import { formatDate } from "../../lib/labels";
import { underManagementLabel } from "./portfolio-labels";

/**
 * The firm's own figures, for the partners rather than for the working day: how much, which way it is
 * moving, and how busy. Read only — nothing on this screen changes a client.
 */
export function ManagementInformationPage() {
  const figures = useGetManagementInformation<ManagementFigures, ApiError>();

  if (figures.isError) return <Alert tone="danger">{figures.error.message}</Alert>;
  if (!figures.data) {
    return <p className="py-10 text-center text-sm text-ink-muted">Counting…</p>;
  }
  const { underModels, currency, clientsOnAModel, clientsAltogether, rebalancedThisMonth, quarter, byModel, asOf } =
    figures.data;
  const withoutAPlan = clientsAltogether - clientsOnAModel;

  return (
    <div className="space-y-6">
      <ListPageHeader
        title="MIS"
        lead={`The firm, not a client. How much, which way it is moving, and how busy. As at ${formatDate(asOf)}, in ${currency}.`}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile label="Under models" value={underManagementLabel(underModels, currency)} />
        <Tile
          label="Net in this quarter"
          value={signed(quarter.net, currency)}
          tone={quarter.net < 0 ? "bad" : quarter.net > 0 ? "good" : undefined}
        />
        <Tile label="Clients on a model" value={`${clientsOnAModel} / ${clientsAltogether}`} />
        <Tile label="Rebalances this month" value={String(rebalancedThisMonth)} />
      </div>

      {/* The deck calls this the number to watch, so it is said in words and not left to be subtracted. */}
      {withoutAPlan > 0 && (
        <Alert tone="warning">
          {withoutAPlan === 1 ? "One client sits" : `${withoutAPlan} clients sit`} on no model. Nothing can
          drift and nothing can breach for them, so they are invisible to every other screen here. That gap is
          a management question, not a technical one.
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:items-start">
        <section className="rounded-2xl border border-line bg-white">
          <div className="px-6 pt-5">
            <h2 className="text-base font-bold">Assets by model</h2>
            <p className="mt-0.5 text-xs text-ink-muted">Biggest first. Only the plans somebody is actually on.</p>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-y border-line text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                  <th scope="col" className="py-2.5 pr-4 pl-6">Model</th>
                  <th scope="col" className="px-4 py-2.5 text-right">Clients</th>
                  <th scope="col" className="px-4 py-2.5 text-right">Value</th>
                  <th scope="col" className="py-2.5 pr-6 pl-4 text-right">Share</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {byModel.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-10 text-center text-ink-muted">
                      No client is on a model yet.
                    </td>
                  </tr>
                )}
                {byModel.map((row) => (
                  <tr key={row.modelPortfolioId}>
                    <th scope="row" className="py-3 pr-4 pl-6 text-left font-semibold">
                      {row.modelName}
                      {/* The share drawn under the name, so the shape of the book reads without arithmetic. */}
                      <span aria-hidden="true" className="mt-1.5 block h-1 w-40 max-w-full rounded-full bg-slate-100">
                        <span
                          className="block h-full rounded-full bg-primary-600"
                          style={{ width: `${Math.min(row.share, 100)}%` }}
                        />
                      </span>
                    </th>
                    <td className="px-4 py-3 text-right align-top tabular-nums text-ink-soft">{row.clients}</td>
                    <td className="px-4 py-3 text-right align-top whitespace-nowrap tabular-nums">
                      {underManagementLabel(row.assets, currency)}
                    </td>
                    <td className="py-3 pr-6 pl-4 text-right align-top font-semibold tabular-nums">
                      {row.share.toFixed(0)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl border border-line bg-white p-6">
          <h2 className="text-base font-bold">Money moved</h2>
          <p className="mt-0.5 text-xs text-ink-muted">
            This quarter: {formatDate(quarter.from)} to {formatDate(quarter.to)}.
          </p>
          <dl className="mt-4 divide-y divide-line">
            <Moved label="Paid in" value={quarter.paidIn} currency={currency} sign="+" tone="good" />
            <Moved label="Taken out" value={quarter.takenOut} currency={currency} sign="−" tone="bad" />
            <Moved label="Net" value={Math.abs(quarter.net)} currency={currency} sign={quarter.net < 0 ? "−" : "+"} strong />
          </dl>
          {/* Nothing records what a rebalance actually traded, so the figure is not invented. */}
          <p className="mt-4 border-t border-line pt-3 text-xs text-ink-muted">
            What rebalances traded is not here: the platform records the day a portfolio was put back to its
            model, not the trades it took to do it.
          </p>
        </section>
      </div>
    </div>
  );
}

function Tile({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  return (
    <div className="rounded-2xl border border-line bg-white px-5 py-4">
      <p className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">{label}</p>
      <p
        className={cn(
          "mt-1 text-2xl font-bold tabular-nums",
          tone === "bad" ? "text-rose-700" : tone === "good" ? "text-emerald-700" : "text-ink",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function Moved({
  label,
  value,
  currency,
  sign,
  tone,
  strong = false,
}: {
  label: string;
  value: number;
  currency: string;
  sign: string;
  tone?: "good" | "bad";
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <dt className={cn("text-sm", strong ? "font-semibold text-ink" : "text-ink-soft")}>{label}</dt>
      <dd
        className={cn(
          "tabular-nums",
          strong ? "text-lg font-bold" : "text-sm font-medium",
          tone === "bad" ? "text-rose-700" : tone === "good" ? "text-emerald-700" : "text-ink",
        )}
      >
        {sign}
        {underManagementLabel(value, currency)}
      </dd>
    </div>
  );
}

/** A net figure carries its direction: money leaving the firm is not the same news as money arriving. */
function signed(net: number, currency: string) {
  return `${net < 0 ? "−" : "+"}${underManagementLabel(Math.abs(net), currency)}`;
}
