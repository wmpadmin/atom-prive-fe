import { ApiError } from "@atomprive/api-client";
import {
  useListClientLoans,
  useListNonFinancialAssets,
  useListClientHoldings,
  type ClientHoldings,
  type ClientLoans,
  type ClientNonFinancialAssets,
} from "@atomprive/api-client/backoffice";
import { Alert, Button, cn } from "@atomprive/ui";
import type { StepProps } from "./portfolio-setup-dialog";

/** The class the firm keeps cash under. Cash is one of the six, so it is already inside the allocation. */
const CASH = "CASH";

/**
 * What the three lists come to, worked through to the Net AUM.
 *
 * <p>Nothing here is typed: every figure is the one above it plus or minus the one beside it, which is why
 * the arithmetic is shown rather than only its answer. A reader who disagrees with the Net AUM can see
 * which line they disagree with.
 *
 * <p>A loan is held as a negative figure, so every line that allows for one adds it. There is no subtraction
 * anywhere below for that reason, and the two places a figure is taken off — the non-financial assets, out
 * of the NAV — say so on the row.
 */
function money(figure: number) {
  const said = Math.abs(figure).toLocaleString(undefined, { maximumFractionDigits: 2 });
  // In brackets, which is how a figure that is owed or taken off is written.
  return figure < 0 ? `(${said})` : said;
}

/**
 * One line of the working: what it is, how it was arrived at where it was arrived at rather than written
 * down, and the figure.
 */
function Row({
  label, working, value, currency, percent, lead, total,
}: {
  label: string;
  working?: string;
  value: number | null;
  currency: string;
  percent?: boolean;
  /** A figure somebody wrote down, which the ones under it are worked out from. */
  lead?: boolean;
  total?: boolean;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-[1fr_auto] items-baseline gap-x-6 px-4 py-1.5",
        total ? "border-t-2 border-ink/30" : "border-b border-ink/15",
      )}
    >
      <span className={cn("text-sm", total || lead ? "font-semibold text-ink" : "text-ink-soft")}>
        {label}
        {working && <span className="ml-2 text-xs font-normal text-ink-muted">{working}</span>}
      </span>
      <span
        className={cn(
          "tabular-nums",
          total ? "text-base font-bold text-ink" : "text-sm text-ink",
          value !== null && value < 0 && "text-red-700",
        )}
      >
        {value === null ? "—" : percent ? `${value.toFixed(2)}%` : `${money(value)} ${currency}`}
      </span>
    </div>
  );
}

export function NetAumStep({ customerId, onDone, onBack }: StepProps) {
  const holdings = useListClientHoldings<ClientHoldings, ApiError>(customerId);
  const owned = useListNonFinancialAssets<ClientNonFinancialAssets, ApiError>(customerId);
  const owed = useListClientLoans<ClientLoans, ApiError>(customerId);

  if (holdings.isError || owned.isError || owed.isError) {
    return <Alert tone="danger">{(holdings.error ?? owned.error ?? owed.error)?.message}</Alert>;
  }

  const currency = holdings.data?.currency ?? "";
  // What the six classes come to, which is what the first step wrote down.
  const allocation = holdings.data?.underManagement ?? 0;
  const cash = (holdings.data?.classes ?? []).find((one) => one.assetClass === CASH)?.valueAmount ?? 0;
  const nonFinancial = owned.data?.total ?? 0;
  // Negative, as they are kept, so everything below adds them. Only the part secured on the portfolio
  // belongs in a Net AUM: a mortgage on a flat is money the portfolio never received and cannot be sold
  // to repay, so allowing for it would make the portfolio smaller than it is.
  const loans = owed.data?.againstThePortfolio ?? 0;
  const againstWhatTheyOwn = owed.data?.againstNonFinancial ?? 0;

  // What they own, less what is borrowed against it — the flat net of its mortgage.
  const nonFinancialNet = nonFinancial + againstWhatTheyOwn;
  const nav = allocation + nonFinancialNet;
  // Everything owned, less the part of it nobody manages — which is the allocation again, by construction.
  const investmentAum = nav - nonFinancialNet;
  const grossAum = investmentAum;
  const netCash = cash + loans;
  const netAum = grossAum + loans;
  // A share of nothing is not a number, so it is left unsaid rather than shown as nought.
  const leverage = investmentAum === 0 ? null : (netCash / investmentAum) * 100;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-line bg-white">
        <header className="border-b border-ink/15 px-4 py-2">
          <h2 className="font-semibold text-ink">What it comes to</h2>
        </header>
        <Row label="Total allocation" working="the six classes, added up" value={allocation} lead currency={currency} />
        <Row label="Non Financial Asset" working="the list of what nobody manages" value={nonFinancial} lead currency={currency} />
        {againstWhatTheyOwn !== 0 && (
          <Row
            label="less: borrowed against what they own"
            working="a mortgage belongs against the flat, not the portfolio"
            value={againstWhatTheyOwn}
            currency={currency}
          />
        )}
        <Row label="Investment NAV ($)" working="allocation + non-financial" value={nav} currency={currency} />
        <Row label="less: Non Financial Asset" value={-nonFinancialNet} currency={currency} />
        <Row label="Investment AUM ($)" working="NAV − non-financial" value={investmentAum} currency={currency} />
        <Row label="Gross AUM ($)" working="= Investment AUM" value={grossAum} currency={currency} />
      </section>

      <section className="rounded-2xl border border-line bg-white">
        <header className="border-b border-ink/15 px-4 py-2">
          <h2 className="font-semibold text-ink">Cash and borrowing</h2>
        </header>
        <Row label="Cash" working="the Cash & cash equivalents class" value={cash} lead currency={currency} />
        <Row label="Loan" working="what is owed against the portfolio" value={loans} lead currency={currency} />
        <Row label="Net cash / (loan)" working="cash + loan" value={netCash} currency={currency} />
        <Row label="Leverage (% of Investment AUM)" working="net cash ÷ Investment AUM" value={leverage} percent currency={currency} />
      </section>

      <section className="rounded-2xl border border-line bg-white">
        <header className="border-b border-ink/15 px-4 py-2">
          <h2 className="font-semibold text-ink">Net AUM</h2>
        </header>
        <Row label="Gross AUM ($)" value={grossAum} currency={currency} />
        <Row label="add: Loan" working="the part secured on the portfolio, kept negative" value={loans} currency={currency} />
        <Row label="Net AUM ($)" value={netAum} total currency={currency} />
        <p className="px-4 py-2 text-xs text-ink-muted">
          Every percentage this portfolio is read against is a share of this figure.
        </p>
      </section>

      <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2 border-t border-line pt-4">
        <Button variant="secondary" size="lg" type="button" onClick={onBack}>
          Back
        </Button>
        <Button type="button" size="lg" onClick={onDone}>
          Done
        </Button>
      </div>
    </div>
  );
}
