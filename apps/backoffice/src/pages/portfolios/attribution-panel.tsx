import { ApiError } from "@atomprive/api-client";
import { useGetClientAttribution, type Attribution } from "@atomprive/api-client/backoffice";
import { Alert, cn } from "@atomprive/ui";
import { formatDate } from "../../lib/labels";

/** Money as a statement writes it: grouped thousands, two decimal places. */
function money(amount: number, currency: string) {
  return `${currency} ${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** A gain or a loss, written with the sign it has. */
function signed(amount: number, currency: string) {
  return `${amount < 0 ? "−" : "+"}${money(Math.abs(amount), currency)}`;
}

/**
 * Where a portfolio's change in value came from, class by class.
 *
 * <p>What each class holds adds up to what the portfolio holds, so what each class gained adds up to what
 * the portfolio gained. That is why this ties exactly, and it is also the limit of what it can claim:
 * nothing records the trades, so money moved between classes cannot be told apart from what the market did.
 */
export function AttributionPanel({ customerId }: { customerId: string }) {
  const split = useGetClientAttribution<Attribution, ApiError>(customerId);

  if (split.isError) {
    // A portfolio with nothing written down has no change to account for, which is not an error worth raising.
    return split.error.status === 404 ? null : <Alert tone="danger">{split.error.message}</Alert>;
  }
  const found = split.data;
  if (!found) return null;
  const classes = found.classes;

  return (
    <section className="rounded-2xl border border-line bg-white px-6 py-5">
      <h2 className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">Where the change came from</h2>
      {classes.length === 0 ? (
        <p className="mt-2 text-sm text-ink-muted">
          Only {found.observations === 1 ? "one day is" : "no days are"} written down. One day is a snapshot,
          not a change — save the holdings again on another day and this fills in.
        </p>
      ) : (
        <>
          <p className="mt-1 max-w-prose text-xs text-ink-muted">
            {formatDate(found.from!)} to {formatDate(found.to!)}. What each class holds adds up to what the
            portfolio holds, so what each class gained adds up to what the portfolio gained.
          </p>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-y border-line text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                  <th scope="col" className="py-2 pr-4">Asset class</th>
                  <th scope="col" className="px-4 py-2 text-right">Was</th>
                  <th scope="col" className="px-4 py-2 text-right">Now</th>
                  <th scope="col" className="px-4 py-2 text-right">Gained</th>
                  <th scope="col" className="py-2 pl-4 text-right">Share of the change</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {classes.map((one) => (
                  <tr key={one.assetClass}>
                    <th scope="row" className="py-2 pr-4 text-left font-medium text-ink">
                      {one.name}
                      <span className="block text-xs font-normal text-ink-muted tabular-nums">
                        {one.openingWeight.toFixed(1)}% → {one.closingWeight.toFixed(1)}%
                      </span>
                    </th>
                    <td className="px-4 py-2 text-right tabular-nums">{money(one.opening, found.currency)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{money(one.closing, found.currency)}</td>
                    <td
                      className={cn(
                        "px-4 py-2 text-right font-medium tabular-nums",
                        one.change > 0 ? "text-emerald-700" : one.change < 0 ? "text-red-600" : "text-ink",
                      )}
                    >
                      {signed(one.change, found.currency)}
                    </td>
                    {/* A class can account for more than the whole change, where another gave some back. */}
                    <td className="py-2 pl-4 text-right tabular-nums text-ink-soft">
                      {one.shareOfChange === null ? "—" : `${one.shareOfChange.toFixed(1)}%`}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-line font-medium">
                  <th scope="row" className="py-2 pr-4 text-left">Whole portfolio</th>
                  <td className="px-4 py-2 text-right tabular-nums">{money(found.opening, found.currency)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{money(found.closing, found.currency)}</td>
                  <td
                    className={cn(
                      "px-4 py-2 text-right tabular-nums",
                      found.change > 0 ? "text-emerald-700" : found.change < 0 ? "text-red-600" : "text-ink",
                    )}
                  >
                    {signed(found.change, found.currency)}
                  </td>
                  <td className="py-2 pl-4 text-right tabular-nums">
                    {found.changeShare === null ? "—" : `${found.changeShare.toFixed(1)}%`}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* What is not performance has to be said, or a deposit reads as a good month. */}
          {(found.paidIn > 0 || found.takenOut > 0) && (
            <p className="mt-3 text-xs text-ink-muted">
              {found.paidIn > 0 && <>{money(found.paidIn, found.currency)} was paid in over this period. </>}
              {found.takenOut > 0 && <>{money(found.takenOut, found.currency)} was taken out. </>}
              Neither is performance — a change the size of a deposit is a deposit.
            </p>
          )}
          {found.rebalancedWithin && (
            <p className="mt-2 text-xs text-amber-700">
              <span className="font-semibold">This portfolio was put back to its model in this period.</span>{" "}
              Nothing records the trades, so a class's gain here mixes what the market did to it with money
              deliberately moved into or out of it. The whole-portfolio figure is unaffected.
            </p>
          )}
        </>
      )}
    </section>
  );
}
