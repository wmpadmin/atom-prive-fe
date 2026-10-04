import type { ClassStanding } from "@atomprive/api-client/backoffice";
import { Badge } from "@atomprive/ui";
import { driftLabel, standingLabels, standingTones } from "./portfolio-labels";

/** Money the way the firm's review writes it: grouped thousands, always two decimal places. */
function money(amount: number) {
  return amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** A share of the portfolio, to the hundredth of a point, as the sheet shows it. */
function share(percentage: number) {
  return `${percentage.toFixed(2)}%`;
}

/** What to do about a class: a figure to buy, or one to sell, never a bare minus sign. */
function suggestion(amount: number) {
  if (amount > 0) return { word: "Buy", figure: money(amount) };
  if (amount < 0) return { word: "Sell", figure: money(-amount) };
  return { word: "Hold", figure: money(0) };
}

const NUMBER = "px-4 py-3 text-right tabular-nums";

/**
 * A client's portfolio set against its model, one row per asset class, laid out as the firm's own portfolio
 * review lays it out: what the model asks for, what is held, how far each class has been filled, and what
 * would have to move to close the gap.
 */
export function ClassStandingTable({
  classes,
  currency,
  underManagement,
}: {
  classes: ClassStanding[];
  currency: string;
  underManagement: number;
}) {
  if (classes.length === 0) return null;

  // Money only ever moves between classes, so the two columns of buying and selling cancel out. Each target
  // is rounded to the penny on its own, as the firm's sheet rounds it, which can leave a penny either way;
  // counted in whole pennies, because a sum of decimals is never quite the figure it prints as.
  const moving = classes.reduce((sum, row) => sum + row.suggestion, 0);
  const pennies = Math.round(moving * 100);
  const balances = Math.abs(pennies) <= 1;

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <caption className="sr-only">
            Each asset class, what the model asks for, what is held, and what would have to move.
          </caption>
          <thead>
            <tr className="border-y border-line text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
              <th scope="col" className="py-3 pr-4">
                Asset class
              </th>
              <th scope="col" className="px-4 py-3 text-right">
                Target
              </th>
              <th scope="col" className="px-4 py-3 text-right">
                Target value
              </th>
              <th scope="col" className="px-4 py-3 text-right">
                Held
              </th>
              <th scope="col" className="px-4 py-3 text-right">
                Held value
              </th>
              <th scope="col" className="px-4 py-3 text-right">
                Filled
              </th>
              <th scope="col" className="py-3 pl-4 text-right">
                Suggestion
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {classes.map((row) => {
              const move = suggestion(row.suggestion);
              return (
                <tr key={row.assetClass}>
                  <th scope="row" className="py-3 pr-4 text-left font-medium text-ink">
                    {/* Named by the API, which reads the firm's own list; the code is the fallback for one it has since taken off. */}
                    {row.assetClassName || row.assetClass}
                    {/* Each class is judged by its own tolerance, so the one that broke the model says so
                        here rather than leaving the reader to work it out from the figures. */}
                    {row.standing !== "WITHIN_BAND" && (
                      <span
                        className="mt-1 block font-normal"
                        title={`${driftLabel(row.drift)} from target. Watched from ${row.band.watchAt}, at the edge from ${row.band.edgeAt}, breached from ${row.band.breachAt}.`}
                      >
                        <Badge tone={standingTones[row.standing]}>{standingLabels[row.standing]}</Badge>
                      </span>
                    )}
                  </th>
                  <td className={NUMBER}>{share(row.targetShare)}</td>
                  <td className={NUMBER}>{money(row.targetValue)}</td>
                  <td className={NUMBER}>{share(row.actualShare)}</td>
                  <td className={NUMBER}>{money(row.actualValue)}</td>
                  {/* A share of nothing has no answer: the model asks for none of this class. */}
                  <td className={NUMBER}>
                    {row.filled === null ? (
                      <span className="text-ink-muted" title="The model asks for none of this class.">
                        —
                      </span>
                    ) : (
                      share(row.filled)
                    )}
                  </td>
                  <td className={`${NUMBER} pr-0 pl-4`}>
                    <span className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                      {move.word}
                    </span>{" "}
                    {move.figure}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-line font-medium">
              <th scope="row" className="py-3 pr-4 text-left">
                Whole portfolio
              </th>
              <td className={NUMBER}>{share(classes.reduce((sum, row) => sum + row.targetShare, 0))}</td>
              <td className={NUMBER}>{money(classes.reduce((sum, row) => sum + row.targetValue, 0))}</td>
              <td className={NUMBER}>{share(classes.reduce((sum, row) => sum + row.actualShare, 0))}</td>
              <td className={NUMBER}>{money(underManagement)}</td>
              <td className={NUMBER} />
              <td className={`${NUMBER} pr-0 pl-4`}>{money(moving)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="mt-2 text-xs text-ink-muted">
        Figures in {currency}. Buying and selling cancel out, because a rebalance only moves money between
        classes — it never adds or takes any away.{" "}
        {balances ? (
          "Each target is rounded to the penny on its own, so the two can differ by a penny."
        ) : (
          <span className="font-medium text-danger-700">
            Here they do not cancel out, by {money(moving)}. That is more than rounding, so these figures need
            looking at before anything is traded on them.
          </span>
        )}
      </p>
    </div>
  );
}
