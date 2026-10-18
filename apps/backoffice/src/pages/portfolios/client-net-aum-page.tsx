import { ApiError } from "@atomprive/api-client";
import {
  useListClientAllocationChanges,
  useListClientLoans,
  useListNonFinancialAssets,
  useListClientHoldings,
  type AllocationChangeRow,
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
  // Whether a change to these figures is waiting on somebody. Every figure below is the one on file, and
  // on file is what it stays until the answer comes — so a reader who just typed a different one needs
  // telling that this page is not ignoring them.
  const asks = useListClientAllocationChanges<AllocationChangeRow[], ApiError>(customerId);
  const waiting = (asks.data ?? []).filter((one) => one.status === "PENDING");

  if (holdings.isError || owned.isError || owed.isError) {
    return <Alert tone="danger">{(holdings.error ?? owned.error ?? owed.error)?.message}</Alert>;
  }

  const currency = holdings.data?.currency ?? "";
  // What the six classes come to, which is what the first step wrote down.
  const allocation = holdings.data?.underManagement ?? 0;
  const cash = (holdings.data?.classes ?? []).find((one) => one.assetClass === CASH)?.valueAmount ?? 0;
  const nonFinancial = owned.data?.total ?? 0;
  // Negative, as they are kept, so everything below adds them. Every loan, because nobody is asked yet
  // what each is secured on: a mortgage on a flat does not belong in a Net AUM, but reading only the
  // portfolio's would quietly drop any loan written down before the question is put, and none of them
  // has been sorted. The split is there on the API for when it is.
  const loans = owed.data?.total ?? 0;

  const nav = allocation + nonFinancial;
  // Everything owned, less the part of it nobody manages — which is the allocation again, by construction.
  const investmentAum = nav - nonFinancial;
  const grossAum = investmentAum;
  const netCash = cash + loans;
  const netAum = grossAum + loans;
  // A share of nothing is not a number, so it is left unsaid rather than shown as nought.
  const leverage = investmentAum === 0 ? null : (netCash / investmentAum) * 100;

  return (
    <div className="flex flex-1 flex-col space-y-6">
      {waiting.map((one) => (
        <Alert key={one.id} tone="warning">
          {one.raisedByName} asked for these figures to change, and nobody has answered yet. What is
          below is what the client is on file as having, and it stays that way — along with every
          percentage the portfolio is read against — until whoever looks after them agrees.
        </Alert>
      ))}

      <section className="rounded-2xl border border-line bg-white">
        <header className="border-b border-ink/15 px-4 py-2">
          <h2 className="font-semibold text-ink">What it comes to</h2>
        </header>
        <Row label="Total allocation" working="the six classes, added up" value={allocation} lead currency={currency} />
        <Row label="Non Financial Asset" working="the list of what nobody manages" value={nonFinancial} lead currency={currency} />
        <Row label="Investment NAV ($)" working="allocation + non-financial" value={nav} currency={currency} />
        <Row label="less: Non Financial Asset" value={-nonFinancial} currency={currency} />
        <Row label="Investment AUM ($)" working="NAV − non-financial" value={investmentAum} currency={currency} />
        <Row label="Gross AUM ($)" working="= Investment AUM" value={grossAum} currency={currency} />
      </section>

      <section className="rounded-2xl border border-line bg-white">
        <header className="border-b border-ink/15 px-4 py-2">
          <h2 className="font-semibold text-ink">Cash and borrowing</h2>
        </header>
        <Row label="Cash" working="the Cash & cash equivalents class" value={cash} lead currency={currency} />
        <Row label="Loan" working="what is owed, added up" value={loans} lead currency={currency} />
        <Row label="Net cash / (loan)" working="cash + loan" value={netCash} currency={currency} />
        <Row label="Leverage (% of Investment AUM)" working="net cash ÷ Investment AUM" value={leverage} percent currency={currency} />
      </section>

      <section className="rounded-2xl border border-line bg-white">
        <header className="border-b border-ink/15 px-4 py-2">
          <h2 className="font-semibold text-ink">Net AUM</h2>
        </header>
        <Row label="Gross AUM ($)" value={grossAum} currency={currency} />
        <Row label="add: Loan" working="it is kept negative, so adding it takes it off" value={loans} currency={currency} />
        <Row label="Net AUM ($)" value={netAum} total currency={currency} />
        <p className="px-4 py-2 text-xs text-ink-muted">
          Every percentage this portfolio is read against is a share of this figure — which is what the
          plan on the next step asks of it.
        </p>
      </section>

      <div className="mt-auto flex flex-wrap items-center justify-end gap-x-3 gap-y-2 border-t border-line pt-4">
        <Button variant="secondary" size="lg" type="button" onClick={onBack}>
          Back
        </Button>
        <Button type="button" size="lg" onClick={onDone}>
          Next
        </Button>
      </div>
    </div>
  );
}
