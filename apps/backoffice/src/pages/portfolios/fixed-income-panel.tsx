import { ApiError } from "@atomprive/api-client";
import { useGetClientFixedIncome, type FixedIncome } from "@atomprive/api-client/backoffice";
import { Alert, cn } from "@atomprive/ui";

function money(amount: number, currency: string) {
  return `${currency} ${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * One weighted figure, with how much of the book it was read over.
 *
 * <p>The coverage is not decoration. A yield read over a third of the bonds is a different claim from one
 * read over all of them, and a figure shown without it invites the reader to assume the second.
 */
function Weighted({
  label,
  value,
  suffix,
  known,
  nothing,
}: {
  label: string;
  value: number | null;
  suffix: string;
  known: number;
  nothing: string;
}) {
  return (
    <div className="rounded-xl border border-line px-4 py-3">
      <p className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">{label}</p>
      {value === null ? (
        <p className="mt-1 text-sm text-ink-muted">{nothing}</p>
      ) : (
        <>
          <p className="mt-0.5 text-xl font-bold tabular-nums text-ink">
            {value.toFixed(2)}
            <span className="ml-0.5 text-sm font-semibold text-ink-soft">{suffix}</span>
          </p>
          <p className={cn("mt-0.5 text-xs", known >= 100 ? "text-ink-muted" : "text-amber-700")}>
            {known >= 100 ? "Across the whole book." : `Across ${known.toFixed(1)}% of the book.`}
          </p>
        </>
      )}
    </div>
  );
}

/**
 * What a client's fixed income does: what it yields, how far it moves when rates move, and what it lends to.
 *
 * <p>Nothing is shown for a portfolio holding no debt — an empty panel on every equity client is noise.
 */
export function FixedIncomePanel({ customerId }: { customerId: string }) {
  const book = useGetClientFixedIncome<FixedIncome, ApiError>(customerId);

  if (book.isError) {
    return book.error.status === 404 ? null : <Alert tone="danger">{book.error.message}</Alert>;
  }
  const found = book.data;
  if (!found || found.held <= 0) return null;

  return (
    <section className="rounded-2xl border border-line bg-white px-6 py-5">
      <h2 className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">What the bonds do</h2>
      <p className="mt-1 max-w-prose text-xs text-ink-muted">
        {money(found.held, found.currency)} of fixed income. Both figures are weighted by what each bond is
        worth, and read only off the bonds that carry them — a bond nobody has looked up is left out rather
        than counted as nothing.
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Weighted
          label="Weighted average yield"
          value={found.weightedYield}
          suffix="%"
          known={found.yieldKnown}
          nothing="No bond carries a yield yet."
        />
        <Weighted
          label="Weighted average duration"
          value={found.weightedDuration}
          suffix=" yrs"
          known={found.durationKnown}
          nothing="No bond carries a duration yet."
        />
      </div>

      {found.credit.length > 0 && (
        <>
          <h3 className="mt-5 text-2xs font-semibold tracking-wider text-ink-muted uppercase">
            What it lends to
          </h3>
          <div className="mt-2 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-y border-line text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                  <th scope="col" className="py-2 pr-4">Rating</th>
                  <th scope="col" className="px-4 py-2 text-right">Value</th>
                  <th scope="col" className="py-2 pl-4 text-right">Share of the book</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {found.credit.map((band) => (
                  <tr key={band.rating}>
                    <th scope="row" className="py-2 pr-4 text-left font-medium text-ink">{band.rating}</th>
                    <td className="px-4 py-2 text-right tabular-nums">{money(band.value, found.currency)}</td>
                    <td className="py-2 pl-4 text-right tabular-nums">{band.share.toFixed(2)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {found.rated < 100 && (
            <p className="mt-2 text-xs text-amber-700">
              {(100 - found.rated).toFixed(1)}% of the book carries no rating at all, so it appears in none of
              these bands.
            </p>
          )}
        </>
      )}
    </section>
  );
}
