import type {
  FamilyMemberWealth,
  FamilyWealth,
  PortalFamilyWealth,
  HoldingGroup,
  LinePoint,
  PortalDashboard,
  PortalHoldings,
  PortfolioInsights,
  ValueSlice,
  Weight,
} from "@atomprive/api-client/portal";
import { rateFrom, shownCurrency } from "../lib/display";

/**
 * A screen's figures restated in the currency the client asked to see them in, at today's rate.
 *
 * <p>Money only, field by field. A return or a weight is the same whatever currency it is written in, and a
 * time-weighted return is worked out in the portfolio's own currency — so those are left exactly as the server
 * sent them, and {@link heldIn} keeps the portfolio's own currency for the labels that have to say so.
 *
 * <p>Every figure is restated at one rate, so nothing on a screen is priced against anything else differently.
 * It is today's rate for a line going back years too: that line is what the money is worth in the chosen
 * currency now, not what it was worth in it then, and the screen says so beside it.
 */
export type Shown<T> = T & { heldIn: string };

function by(currency: string) {
  const rate = rateFrom(currency) ?? 1;
  return {
    to: shownCurrency(currency),
    x: (amount: number) => amount * rate,
    maybe: (amount: number | null) => (amount === null ? null : amount * rate),
  };
}

const line = (points: LinePoint[], x: (n: number) => number) => points.map((one) => ({ ...one, value: x(one.value) }));
const slices = <S extends ValueSlice | Weight>(rows: S[], x: (n: number) => number) => rows.map((one) => ({ ...one, value: x(one.value) }));

export function shownDashboard(data: PortalDashboard): Shown<PortalDashboard> {
  const { to, x } = by(data.currency);
  return {
    ...data,
    heldIn: data.currency,
    currency: to,
    netWorth: x(data.netWorth),
    allocation: slices(data.allocation, x),
    valueThisYear: line(data.valueThisYear, x),
  };
}

export function shownInsights(data: PortfolioInsights): Shown<PortfolioInsights> {
  const { to, x, maybe } = by(data.currency);
  const groups = (rows: HoldingGroup[]) =>
    rows.map((group) => ({
      ...group,
      value: x(group.value),
      change: maybe(group.change),
      lines: group.lines.map((one) => ({ ...one, value: x(one.value), change: maybe(one.change) })),
    }));
  return {
    ...data,
    heldIn: data.currency,
    currency: to,
    marketValue: x(data.marketValue),
    assets: x(data.assets),
    liabilities: x(data.liabilities),
    // The performance line is a return, not money.
    valueLine: line(data.valueLine, x),
    byAssetClass: slices(data.byAssetClass, x),
    bySubClass: slices(data.bySubClass, x),
    byCountry: slices(data.byCountry, x),
    gainByAssetClass: data.gainByAssetClass.map((one) => ({ ...one, change: x(one.change) })),
    explained: data.explained && {
      ...data.explained,
      startingValue: x(data.explained.startingValue),
      endingValue: x(data.explained.endingValue),
      changed: x(data.explained.changed),
      funded: x(data.explained.funded),
      paidIn: x(data.explained.paidIn),
      paidOut: x(data.explained.paidOut),
      earned: x(data.explained.earned),
    },
    cashByMonth: data.cashByMonth.map((one) => ({ ...one, net: x(one.net) })),
    // A payment carries its own currency, and is restated from that one.
    topFlows: data.topFlows.map((one) => {
      const own = by(one.currency);
      return { ...one, amount: own.x(one.amount), currency: own.to };
    }),
    holdings: groups(data.holdings),
  };
}

export function shownHoldings(data: PortalHoldings): Shown<PortalHoldings> {
  const { to, x, maybe } = by(data.currency);
  return {
    ...data,
    heldIn: data.currency,
    currency: to,
    marketValue: x(data.marketValue),
    rows: data.rows.map((one) => ({ ...one, value: x(one.value), changeThisYear: maybe(one.changeThisYear) })),
  };
}

export function shownFamily(data: FamilyWealth): Shown<FamilyWealth> {
  const { to, x, maybe } = by(data.currency);
  const member = (one: FamilyMemberWealth): FamilyMemberWealth => ({
    ...one,
    managed: maybe(one.managed),
    owned: x(one.owned),
    loans: x(one.loans),
    netWorth: x(one.netWorth),
    byAssetClass: slices(one.byAssetClass, x),
    netWorthLine: line(one.netWorthLine, x),
    topHoldings: one.topHoldings.map((held) => ({ ...held, value: x(held.value) })),
  });
  return {
    ...data,
    heldIn: data.currency,
    currency: to,
    members: data.members.map(member),
    managed: x(data.managed),
    owned: x(data.owned),
    loans: x(data.loans),
    netWorth: x(data.netWorth),
    byAssetClass: slices(data.byAssetClass, x),
    netWorthLine: line(data.netWorthLine, x),
  };
}

/** The family screen's answer: the family's figures and its top holdings, restated alike. */
export function shownFamilyWealth(data: PortalFamilyWealth): PortalFamilyWealth & { wealth: Shown<FamilyWealth> } {
  const { x } = by(data.wealth.currency);
  return { ...data, wealth: shownFamily(data.wealth), topHoldings: data.topHoldings.map((one) => ({ ...one, value: x(one.value) })) };
}
