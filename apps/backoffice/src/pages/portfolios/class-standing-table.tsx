import type { ClassStanding } from "@atomprive/api-client/backoffice";
import { Badge } from "@atomprive/ui";
import { driftLabel, insideLabel, standingLabels, standingTones, type DriftStanding } from "./portfolio-labels";

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
  unwritten,
  inside,
  suggestions = true,
  onPick,
}: {
  classes: ClassStanding[];
  /**
   * Where to go to read a class line by line. Given, every row leads there: a class marked breached is the
   * one somebody wants to see the inside of, and the table said what was wrong without a way through to
   * what it was made of.
   */
  onPick?: (assetClass: string) => void;
  /**
   * Whether to say what would put each class back. An allocation written for one client is measured like
   * any other and acted on by nothing, so a suggestion beside it would be advice the platform will not take.
   */
  suggestions?: boolean;
  currency: string;
  underManagement: number;
  /**
   * What the client is said to have that nobody has written down yet. Buying and selling do not cancel out
   * while it is there — the buying includes putting it somewhere — and that is an answer, not a fault.
   */
  unwritten?: number;
  /**
   * The worst standing among the groups inside each class, by asset class. A class can sit well inside its
   * own band while its money is in the wrong groups, and this table is where somebody looks first.
   */
  inside?: Record<string, { standing: DriftStanding; count: number }>;
}) {
  if (classes.length === 0) return null;

  // Money only ever moves between classes, so the two columns of buying and selling cancel out. Each target
  // is rounded to the penny on its own, as the firm's sheet rounds it, which can leave a penny either way;
  // counted in whole pennies, because a sum of decimals is never quite the figure it prints as.
  const moving = classes.reduce((sum, row) => sum + row.suggestion, 0);
  const pennies = Math.round(moving * 100);
  const balances = Math.abs(pennies) <= 1;
  // Where money is still unplaced, the buying is larger than the selling by exactly that much: it has to be
  // put somewhere, and nothing is being sold to pay for it. Said as the explanation it is, rather than as
  // the warning it was, which marked every half-written portfolio as figures not to be trusted.
  const unplaced = Math.round((unwritten ?? 0) * 100);
  const explained = !balances && unplaced > 0 && Math.abs(pennies - unplaced) <= 1;

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
                Current
              </th>
              <th scope="col" className="px-4 py-3 text-right">
                Current value
              </th>
              <th scope="col" className="px-4 py-3 text-right">
                Gap
              </th>
              {suggestions && (
                <th scope="col" className="py-3 pl-4 text-right">
                  Suggestion
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {classes.map((row) => {
              const move = suggestion(row.suggestion);
              return (
                <tr
                  key={row.assetClass}
                  onClick={onPick ? () => onPick(row.assetClass) : undefined}
                  className={onPick ? "cursor-pointer hover:bg-slate-50/60" : undefined}
                >
                  <th scope="row" className="py-3 pr-4 text-left font-medium text-ink">
                    {/* Named by the API, which reads the firm's own list; the code is the fallback for one it has since taken off. */}
                    {/* The whole row leads to the breakdown, but a row is not something a keyboard can reach:
                        the name itself is the button, and the row is the larger target for a mouse. */}
                    {onPick ? (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onPick(row.assetClass);
                        }}
                        className="text-left font-medium text-primary-700 hover:underline"
                      >
                        {row.assetClassName || row.assetClass}
                      </button>
                    ) : (
                      (row.assetClassName || row.assetClass)
                    )}
                    {/* Each class is judged by its own tolerance, so the one that broke the model says so
                        here rather than leaving the reader to work it out from the figures. */}
                    {row.standing && row.standing !== "WITHIN_BAND" && (
                      <span
                        className="mt-1 block font-normal"
                        title={`${driftLabel(row.drift)} from target. Watched from ${row.band.watchAt}, at the edge from ${row.band.edgeAt}, breached from ${row.band.breachAt}.`}
                      >
                        <Badge tone={standingTones[row.standing]}>{standingLabels[row.standing]}</Badge>
                      </span>
                    )}
                    {/* And what is wrong inside it. A class on its target whose money sits in the wrong
                        groups looked perfectly sound here, and the only way to find out otherwise was to
                        open a class that gave no reason to be opened. */}
                    {inside?.[row.assetClass] && (
                      <span className="mt-1 block font-normal">
                        <Badge tone={standingTones[inside[row.assetClass].standing]}>
                          {insideLabel(inside[row.assetClass])}
                        </Badge>
                      </span>
                    )}
                  </th>
                  <td className={NUMBER}>{share(row.targetShare)}</td>
                  <td className={NUMBER}>{money(row.targetValue)}</td>
                  <td className={NUMBER}>{share(row.actualShare)}</td>
                  <td className={NUMBER}>{money(row.actualValue)}</td>
                  {/* How far the holding sits from its target, in percentage points: what "gap" means
                      beside a target and a current share. Signed, so over and under read apart at a
                      glance. The class the model asks none of has a gap like any other, where the old
                      share-of-target had no answer at all and showed a dash. */}
                  <td className={NUMBER} title={`${driftLabel(row.drift)} from target.`}>
                    {driftLabel(row.drift)}
                  </td>
                  {suggestions && (
                    <td className={`${NUMBER} pr-0 pl-4`}>
                      <span className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                        {move.word}
                      </span>{" "}
                      {move.figure}
                    </td>
                  )}
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
              {suggestions && <td className={`${NUMBER} pr-0 pl-4`}>{money(moving)}</td>}
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="mt-2 text-xs text-ink-muted">
        {!suggestions && (
          <>
            Figures in {currency}. This allocation was written for this client alone, so nothing acts on it:
            the drift is here to be read, and what to do about it is yours.
          </>
        )}
        {suggestions && <>
        Figures in {currency}. Buying and selling cancel out, because a rebalance only moves money between
        classes — it never adds or takes any away.{" "}
        {balances ? (
          "Each target is rounded to the penny on its own, so the two can differ by a penny."
        ) : explained ? (
          `Here the buying is ${money(moving)} more than the selling, which is what the client is said to `
          + "have that nobody has written down yet. It has to go somewhere, and nothing is sold to pay for it."
        ) : (
          <span className="font-medium text-danger-700">
            Here they do not cancel out, by {money(moving)}. That is more than rounding, so these figures need
            looking at before anything is traded on them.
          </span>
        )}
        </>}
      </p>
    </div>
  );
}
