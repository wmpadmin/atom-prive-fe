import type {
  ClientHoldings,
  ClientLoans,
  ClientNonFinancialAssets,
} from "@atomprive/api-client/backoffice";

/** The class the firm keeps cash under. Cash is one of the six, so it is already inside the allocation. */
const CASH = "CASH";

/**
 * Every figure between what a client's classes come to and their Net AUM.
 *
 * <p>Worked out in one place because it is read in two: the calculator the firm fills a client in with,
 * and the panel on the client's own screen. Two copies of one sum is how two screens come to disagree
 * about the same client, and the one thing nobody could then tell is which of them was right.
 *
 * <p>Nothing here is typed. Every line is the one above it plus or minus the one beside it, which is why
 * the working is shown rather than only its answer: a reader who disagrees with the Net AUM can see which
 * line they disagree with.
 */
export type NetAumWorking = {
  /** What the six classes come to, which is the figure the client's screen calls under management. */
  allocation: number;
  /** What the client owns that nobody manages. */
  nonFinancial: number;
  /** Negative, as loans are kept, so everything below adds them rather than subtracting. */
  loans: number;
  /** What sits in the Cash class, which is already part of the allocation. */
  cash: number;
  /** Everything owned, managed or not. */
  nav: number;
  /** The NAV less the part nobody manages — the allocation again, by construction. */
  investmentAum: number;
  grossAum: number;
  netCash: number;
  netAum: number;
  /** A share of nothing is not a number, so it is left unsaid rather than shown as nought. */
  leverage: number | null;
};

/**
 * The working, from the three lists the firm keeps.
 *
 * <p>Every loan is counted, because nobody is asked yet what each is secured on: a mortgage on a flat
 * does not belong in a Net AUM, but reading only the portfolio's would quietly drop any loan written down
 * before the question is put, and none of them has been sorted. The split is there on the API for when
 * it is.
 *
 * <p>What a client owns outright reaches the NAV and goes no further: it is added and taken off again a
 * line later. That is not a redundancy to tidy away — the two lines are what tell a reader that the flat
 * they can see on the page is not inside the figure every percentage is read against.
 */
export function workOutNetAum(
  holdings: ClientHoldings | undefined,
  owned: ClientNonFinancialAssets | undefined,
  owed: ClientLoans | undefined,
): NetAumWorking {
  const allocation = holdings?.underManagement ?? 0;
  const cash = (holdings?.classes ?? []).find((one) => one.assetClass === CASH)?.valueAmount ?? 0;
  const nonFinancial = owned?.total ?? 0;
  const loans = owed?.total ?? 0;

  const nav = allocation + nonFinancial;
  const investmentAum = nav - nonFinancial;
  const grossAum = investmentAum;
  const netCash = cash + loans;
  const netAum = grossAum + loans;

  return {
    allocation,
    nonFinancial,
    loans,
    cash,
    nav,
    investmentAum,
    grossAum,
    netCash,
    netAum,
    leverage: investmentAum === 0 ? null : (netCash / investmentAum) * 100,
  };
}

/**
 * Whether this client has anything that makes a Net AUM worth setting out.
 *
 * <p>A client who owes nothing and owns nothing outside their portfolio has a Net AUM equal to what the
 * top of their screen already says, to the penny. Shown anyway it would restate one figure under a
 * second name, and a reader seeing the same number twice looks for the difference between them.
 */
export function worthWorkingOut(
  owned: ClientNonFinancialAssets | undefined,
  owed: ClientLoans | undefined,
) {
  return (owned?.items?.length ?? 0) > 0 || (owed?.loans?.length ?? 0) > 0;
}
