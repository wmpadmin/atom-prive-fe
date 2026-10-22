import { ApiError } from "@atomprive/api-client";
import {
  useListClientHoldings,
  useListClientLoans,
  useListNonFinancialAssets,
  type ClientHoldings,
  type ClientLoans,
  type ClientNonFinancialAssets,
} from "@atomprive/api-client/backoffice";
import { Alert, cn } from "@atomprive/ui";
import { workOutNetAum, worthWorkingOut } from "./net-aum";

/** A figure owed or taken off is written in brackets, which is how the firm's own sheets write one. */
function money(figure: number, currency: string) {
  const said = Math.abs(figure).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return figure < 0 ? `(${currency} ${said})` : `${currency} ${said}`;
}

/** One line of the working: what it is, how it was arrived at, and the figure. */
function Line({
  label,
  working,
  value,
  currency,
  total = false,
}: {
  label: string;
  working?: string;
  value: number;
  currency: string;
  /** The figure the whole panel is for, which is the one a reader should find without looking. */
  total?: boolean;
}) {
  return (
    <tr className={cn("border-t border-line", total && "bg-slate-50/60")}>
      <th scope="row" className={cn("py-2.5 pr-3 pl-4 text-left", total ? "font-bold text-ink" : "font-medium text-ink")}>
        {label}
      </th>
      <td className="px-3 py-2.5 text-xs text-ink-muted">{working}</td>
      <td className={cn("py-2.5 pr-4 pl-3 text-right tabular-nums", total ? "font-bold text-ink" : "text-ink-soft")}>
        {money(value, currency)}
      </td>
    </tr>
  );
}

/**
 * How a client's Net AUM is arrived at, for a client who has something to arrive at it from.
 *
 * <p>The top of this screen says what is under management: the six classes added up. Net AUM is a
 * different question — what is left of it once what the client owes is taken off — and the two figures
 * sit on one screen, so the screen has to say which is which and what stands between them. A reader who
 * finds two totals and no arithmetic is a reader who has to guess which one to quote.
 *
 * <p>Drawn only where the two differ. A client who owes nothing and owns nothing outside their portfolio
 * has a Net AUM equal to the figure at the top, to the penny, and restating it under a second name
 * teaches nobody anything while inviting them to look for a difference that is not there.
 *
 * <p>Nothing here is typed and nothing here is written. Every figure is read off what the firm already
 * holds — the classes, the loans, the things nobody manages — and the Net AUM the firm keeps comes from
 * its own daily file rather than from this page or any other.
 */
export function NetAumPanel({ customerId }: { customerId: string }) {
  const holdings = useListClientHoldings<ClientHoldings, ApiError>(customerId);
  const owned = useListNonFinancialAssets<ClientNonFinancialAssets, ApiError>(customerId);
  const owed = useListClientLoans<ClientLoans, ApiError>(customerId);

  // A client with none of these lists is a client this panel has nothing to say about, which is not an
  // error on any of the three.
  const missing = [holdings.error, owned.error, owed.error].find((one) => one && one.status !== 404);
  if (missing) {
    return <Alert tone="danger">{missing.message}</Alert>;
  }
  if (!worthWorkingOut(owned.data, owed.data)) {
    return null;
  }

  const { allocation, nonFinancial, loans, cash, nav, investmentAum, netCash, netAum, leverage }
    = workOutNetAum(holdings.data, owned.data, owed.data);
  const currency = holdings.data?.currency ?? "USD";

  return (
    <section className="rounded-2xl border border-line bg-white px-6 py-5">
      <h2 className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">
        How the Net AUM is reached
      </h2>
      <p className="mt-1 max-w-prose text-xs text-ink-muted">
        {money(allocation, currency)} is under management — the six classes added up, which is the figure
        at the top of this screen and the one every percentage on it is a share of. Net AUM is that less
        what the client owes, and it is {money(netAum, currency)}. Nothing below is typed: each line is
        the one above it plus or minus the one beside it.
      </p>

      <div className="mt-3 overflow-x-auto rounded-xl border border-line">
        <table className="min-w-full text-sm">
          <caption className="sr-only">
            The working from what is under management to the Net AUM. Figures in {currency}.
          </caption>
          <thead>
            <tr className="text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
              <th scope="col" className="py-2 pr-3 pl-4">Line</th>
              <th scope="col" className="px-3 py-2">How it is reached</th>
              <th scope="col" className="py-2 pr-4 pl-3 text-right">Figure</th>
            </tr>
          </thead>
          <tbody>
            <Line label="Under management" working="the six classes, added up" value={allocation} currency={currency} />
            {/* Added and taken off again a line later, which is the point rather than a redundancy: the
                two lines are what tell a reader that the flat they can see here is not inside the figure
                the portfolio is measured against. */}
            <Line label="What they own outright" working="the list of what nobody manages" value={nonFinancial} currency={currency} />
            <Line label="Investment NAV" working="under management + what they own" value={nav} currency={currency} />
            <Line label="less: what they own outright" working="it is owned, not managed" value={-nonFinancial} currency={currency} />
            <Line label="Investment AUM" working="NAV − what they own" value={investmentAum} currency={currency} />
            <Line label="Cash" working="the Cash & cash equivalents class" value={cash} currency={currency} />
            <Line label="What they owe" working="every loan, added up" value={loans} currency={currency} />
            <Line label="Net cash / (loan)" working="cash + what they owe" value={netCash} currency={currency} />
            <Line label="Net AUM" working="Investment AUM + what they owe" value={netAum} currency={currency} total />
          </tbody>
        </table>
      </div>

      {leverage !== null && (
        <p className="mt-2 text-xs text-ink-muted">
          Leverage is {leverage.toFixed(2)}% of Investment AUM — net cash against what is managed.
        </p>
      )}
    </section>
  );
}
