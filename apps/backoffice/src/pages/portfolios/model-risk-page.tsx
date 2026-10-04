import { ApiError } from "@atomprive/api-client";
import { useGetModelRisk, type ModelRiskRow, type ModelRiskTable } from "@atomprive/api-client/backoffice";
import { Alert, cn } from "@atomprive/ui";
import { ListPageHeader } from "../../components/record-list";
import { formatDate } from "../../lib/labels";
import { underManagementLabel } from "./portfolio-labels";

/**
 * How risky each plan is.
 *
 * <p>The screen is two halves, and they are not equally well founded. Movement, the deepest drop and return
 * over risk need a price history; the platform holds the days somebody wrote the holdings down, not a daily
 * series, so each row says how many readings it had. Concentration and credit quality need no history at
 * all — they read straight off what the clients hold today.
 */
export function ModelRiskPage() {
  const table = useGetModelRisk<ModelRiskTable, ApiError>();

  if (table.isError) return <Alert tone="danger">{table.error.message}</Alert>;
  const rows = table.data?.items ?? [];
  const measured = rows.filter((row) => row.volatility !== null);

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
        Movement, worst fall and return per unit of risk are worked out from the valuations on file — the days
        somebody wrote a portfolio down, not a daily series — so each row says how many readings it had. The
        last three columns need no history: they read off what the clients hold today.
      </Alert>

      {rows.length > 0 && measured.length === 0 && (
        <Alert tone="warning">
          No plan has enough written down to measure movement yet. It takes at least four valuations of the
          same portfolio: three returns is the least that has any spread to speak of.
        </Alert>
      )}

      <section className="overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
              <th scope="col" className="py-3 pr-4 pl-5">Model</th>
              <th scope="col" className="px-4 py-3 text-right">Assets</th>
              <th scope="col" className="px-4 py-3 text-right">Volatility</th>
              <th scope="col" className="px-4 py-3 text-right">Worst fall</th>
              <th scope="col" className="px-4 py-3 text-right">Return per unit of risk</th>
              <th scope="col" className="px-4 py-3">Largest issuer</th>
              <th scope="col" className="px-4 py-3">Largest country</th>
              <th scope="col" className="py-3 pr-5 pl-4">Credit quality</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {table.isPending && (
              <tr>
                <td colSpan={8} className="px-5 py-10 text-center text-ink-muted">Working out the risk…</td>
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

function Row({ row, currency }: { row: ModelRiskRow; currency: string }) {
  // A concentration read off a tenth of the money is not a concentration. The share that names an issuer at
  // all is said beside it rather than left for the reader to assume it was everything.
  const thin = row.largestIssuer !== null && row.placedByIssuer < 100;
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
      <td className="px-4 py-3">
        {row.largestIssuer === null ? (
          <span className="text-ink-muted">—</span>
        ) : (
          <>
            <span className="block truncate font-medium">{row.largestIssuer}</span>
            <span className="block text-xs text-ink-muted tabular-nums">
              {row.largestIssuerShare?.toFixed(1)}%
              {thin && ` of the ${row.placedByIssuer.toFixed(0)}% that names one`}
            </span>
          </>
        )}
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        {row.largestCountry === null ? (
          <span className="text-ink-muted">—</span>
        ) : (
          <span className="tabular-nums">
            {row.largestCountry} {row.largestCountryShare?.toFixed(0)}%
          </span>
        )}
      </td>
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
