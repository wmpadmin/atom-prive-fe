import type { ClassStanding } from "@atomprive/api-client/backoffice";
import { TriangleAlert } from "lucide-react";
import { Badge } from "@atomprive/ui";
import { driftLabel, standingLabels, standingTones } from "./portfolio-labels";

/** Money the way the firm's review writes it: grouped thousands, always two decimal places. */
function money(amount: number) {
  return amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * How much of what the model asks for is actually there — the column the firm's sheet calls "% allocated".
 *
 * <p>A third filled and two and a half times over are both plain in it at a glance, which neither of the
 * two money columns beside it says on its own. A class the model asks nothing of has no proportion of
 * nothing to show.
 */
function filled(targetValue: number, actualValue: number) {
  return targetValue === 0 ? "—" : `${((actualValue / targetValue) * 100).toFixed(2)}%`;
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
  suggestions = true,
  onPick,
}: {
  classes: ClassStanding[];
  /**
   * Where to go to read a class line by line. Given, every row leads there: a class marked as deviating is the
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
              {/* The firm's own sheet is where this table is read against, line for line — so these are
                  its columns, in its words and its order, and nothing besides. How far a class has
                  wandered in points is not one of them; it is said by the badge under the class's name,
                  which is what the bands are set in points for. */}
              <th scope="col" className="py-3 pr-4">
                Asset allocation
              </th>
              <th scope="col" className="px-4 py-3 text-right">
                Target allocation %
              </th>
              <th scope="col" className="px-4 py-3 text-right">
                Target allocation
              </th>
              <th scope="col" className="px-4 py-3 text-right">
                Actual allocation %
              </th>
              <th scope="col" className="px-4 py-3 text-right">
                Actual allocation
              </th>
              <th scope="col" className="px-4 py-3 text-right">
                % allocated
              </th>
              {/* Its own column rather than a second line under the class's name. Said there, it sat
                  beneath the class's own verdict and read as more of the same sentence — and on a class
                  carrying both, the name cell said "Deviation" and "Deviation inside" one under the other. */}
              <th scope="col" className="px-4 py-3 text-center">
                <abbr title="Sub-asset status" className="no-underline">SA status</abbr>
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
                        title={`${driftLabel(row.drift)} from target. Allowed \u00b1${row.band.breachAt} either way.`}
                      >
                        <Badge tone={standingTones[row.standing]}>{standingLabels[row.standing]}</Badge>
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
                  <td
                    className={NUMBER}
                    title={`What is held, as a proportion of what the model asks for. ${driftLabel(row.drift)} from target.`}
                  >
                    {filled(row.targetValue, row.actualValue)}
                  </td>
                  {/* A separate question from the class's own verdict. A class can sit exactly on its
                      target while every penny of it is in one of the two lines the plan splits it
                      between — which the verdict beside it cannot say, because by its own measure there
                      is nothing to say. */}
                  <td className="px-4 py-3 text-center">
                    {row.subAssetBreached ? (
                      <span
                        className="inline-flex items-center justify-center text-red-600"
                        title="Something inside this class has broken its band. Open the class to see which."
                      >
                        <TriangleAlert aria-hidden="true" className="size-4" />
                        <span className="sr-only">A sub-asset inside this class has broken its band</span>
                      </span>
                    ) : (
                      /* A dash is not an answer on its own, and this one was hidden from a screen reader
                         besides, so that reader was told nothing at all. It is the commonest cell in the
                         column and it means something worth saying: a class can be well over its own
                         target while every line inside it sits where the plan asks, which is the case
                         this column exists to tell apart from the other one. */
                      <span
                        className="text-ink-muted"
                        title="Nothing inside this class has broken its band."
                      >
                        <span aria-hidden="true">—</span>
                        <span className="sr-only">Nothing inside this class has broken its band</span>
                      </span>
                    )}
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
              <td className={NUMBER}>
                {filled(classes.reduce((sum, row) => sum + row.targetValue, 0), underManagement)}
              </td>
              <td className="px-4 py-3" />
              {suggestions && <td className={`${NUMBER} pr-0 pl-4`}>{money(moving)}</td>}
            </tr>
          </tfoot>
        </table>
      </div>
      {/* Outside the scrolling box, so the way through the list does not slide sideways with the columns.
          The whole-portfolio row above it still sums every class, not the page, so the totals and the
          cancelling-out below are the same figures whichever page is open. */}
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
        {/* There used to be a third reading here: the buying could exceed the selling by exactly what the
            client was said to have that nobody had written down, which was an answer rather than a fault.
            Nobody tells the firm a total any more, so what is written down is the whole of it and the two
            columns have nothing left to differ by but rounding. */}
        {balances ? (
          "Each target is rounded to the penny on its own, so the two can differ by a penny."
        ) : (
          <span className="font-medium text-red-700">
            Here they do not cancel out, by {money(moving)}. That is more than rounding, so these figures need
            looking at before anything is traded on them.
          </span>
        )}
        </>}
      </p>
    </div>
  );
}
