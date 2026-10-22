import { ApiError } from "@atomprive/api-client";
import { useGetModelRisk, type ModelRiskRow, type ModelRiskTable } from "@atomprive/api-client/backoffice";
import { Alert, cn } from "@atomprive/ui";
import { ListPageHeader } from "../../components/record-list";
import { formatDate } from "../../lib/labels";
import { PagedFooter, usePagedRows } from "../../lib/paged-rows";
import { underManagementLabel } from "./portfolio-labels";

/**
 * How risky each plan is.

 *
 * <p>The screen is two halves, and they are not equally well founded. Movement, the deepest drop and return
 * over risk need a price history; the platform holds the days somebody wrote the holdings down, not a daily
 * series, so each row says how many readings it had. Credit quality needs no history at all — it reads
 * straight off what the clients hold today.
 *
 * <p>Largest issuer and largest country were columns here and are not any more: the firm took them off.
 * Both are still worked out and served, so putting them back is a column, not a calculation.
 */
export function ModelRiskPage() {
  const table = useGetModelRisk<ModelRiskTable, ApiError>();
  // Read before the refusal below, because usePagedRows is a hook and a hook cannot be called on only some
  // of a component's renders. Both lines already carried their own optional chaining, so they are safe here.
  const rows = table.data?.items ?? [];
  const measured = rows.filter((row) => row.volatility !== null);
  const paged = usePagedRows(rows);

  if (table.isError) return <Alert tone="danger">{table.error.message}</Alert>;

  return (
    <div className="space-y-6">
      <ListPageHeader
        title="Model risk"
        lead={
          table.data
            ? `How much each plan moves about, the worst it has fallen, and where its money is concentrated. As at ${formatDate(table.data.asOf)}, in ${table.data.currency}.`
            : "How much each plan moves about, and where its money is concentrated."
        }
      />

      {/* The firm's own caveat on this screen, said where the figures are read rather than in a footnote. */}
      <Alert tone="info">
        Movement, worst fall, return per unit of risk and the figures at risk are worked out from the
        valuations on file — the days
        somebody wrote a portfolio down, not a daily series — so each row says how many readings it had. The
        last three columns need no history: they read off what the clients hold today.
      </Alert>

      {rows.length > 0 && measured.length === 0 && (
        <Alert tone="warning">
          No plan has enough written down to measure movement yet. It takes at least four valuations of the
          same portfolio: three returns is the least that has any spread to speak of.
        </Alert>
      )}

      {/* The scrolling is the table's own rather than the card's, so the footer below sits still while the
          nine columns slide under it. */}
      <section className="rounded-2xl border border-line bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                <th scope="col" className="py-3 pr-4 pl-5">Model</th>
                <th scope="col" className="px-4 py-3 text-right">Assets</th>
                <th scope="col" className="px-4 py-3 text-right">Volatility</th>
                <th scope="col" className="px-4 py-3 text-right">Worst fall</th>
                <th scope="col" className="px-4 py-3 text-right">Return per unit of risk</th>
                <th scope="col" className="px-4 py-3 text-right" title="The loss only one reading in twenty has been worse than.">
                  At risk 95%
                </th>
                <th scope="col" className="px-4 py-3 text-right" title="The loss only one reading in a hundred has been worse than.">
                  At risk 99%
                </th>
                <th scope="col" className="px-4 py-3 text-right" title="What has been lost on average on the readings past the 95% figure.">
                  Beyond it
                </th>
                <th scope="col" className="py-3 pr-5 pl-4">Credit quality</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {table.isPending && (
                <tr>
                  <td colSpan={9} className="px-5 py-10 text-center text-ink-muted">Working out the risk…</td>
                </tr>
              )}
              {table.data && rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-5 py-10 text-center text-ink-muted">
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
        {/* Not while the risk is still being worked out: a count under a table that says it is still
            counting answers a question nobody has asked yet. */}
        {!table.isPending && <PagedFooter paged={paged} noun={["model", "models"]} />}
      </section>
    </div>
  );
}

function Row({ row, currency }: { row: ModelRiskRow; currency: string }) {
  return (
    <tr className="hover:bg-slate-50/60">
      <td className="py-3 pr-4 pl-5">
        <span className="block font-semibold">{row.modelName}</span>
        <span className="block text-xs text-ink-muted">
          {row.clients} {row.clients === 1 ? "client" : "clients"}
          {row.observations > 0 && row.from && row.to
            ? ` · ${row.observations} readings, ${formatDate(row.from)} to ${formatDate(row.to)}`
            : " · nothing written down"}
        </span>
      </td>
      <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums">
        {row.assets > 0 ? underManagementLabel(row.assets, currency) : <span className="text-ink-muted">—</span>}
      </td>
      <Figure value={row.volatility} suffix="%" />
      {/* A fall is always negative, so it is drawn as the loss it was. */}
      <Figure value={row.worstFall} suffix="%" tone={row.worstFall !== null && row.worstFall < 0 ? "bad" : undefined} />
      <Figure value={row.returnPerUnitOfRisk} places={2} />
      {/* Losses, so they are drawn as losses. Absent where the history is too short to hold the tail. */}
      <Figure value={row.atRisk95} suffix="%" tone={row.atRisk95 !== null && row.atRisk95 < 0 ? "bad" : undefined} />
      <Figure value={row.atRisk99} suffix="%" tone={row.atRisk99 !== null && row.atRisk99 < 0 ? "bad" : undefined} />
      <Figure
        value={row.beyondRisk95}
        suffix="%"
        tone={row.beyondRisk95 !== null && row.beyondRisk95 < 0 ? "bad" : undefined}
      />
      <td className="py-3 pr-5 pl-4 whitespace-nowrap">
        {row.creditQuality === null ? (
          // Fixed income only. A plan that lends nothing has no grade, which is not the same as a bad one.
          <span className="text-ink-muted">Lends nothing</span>
        ) : (
          <span className="font-medium">{row.creditQuality} average</span>
        )}
      </td>
    </tr>
  );
}

/** A figure that is absent rather than estimated, because nobody has written down enough to work it out. */
function Figure({
  value,
  suffix = "",
  places = 1,
  tone,
}: {
  value: number | null;
  suffix?: string;
  places?: number;
  tone?: "bad";
}) {
  return (
    <td
      className={cn(
        "px-4 py-3 text-right whitespace-nowrap tabular-nums",
        value === null ? "text-ink-muted" : tone === "bad" ? "font-semibold text-rose-700" : "font-medium",
      )}
    >
      {value === null ? "—" : `${value < 0 ? "−" : ""}${Math.abs(value).toFixed(places)}${suffix}`}
    </td>
  );
}
