import type {
  BenchmarkLevelRow,
  CashflowList,
  ClientHoldings,
  ClientLoans,
  ClientNonFinancialAssets,
  ClientOverview,
  LinePoint,
  PositionRow,
  SubClassGroup,
  ViewSettings,
} from "@atomprive/api-client/backoffice";
import { isoDay } from "./book-figures";
import type { Attribute, Figure, Grouping, PortfolioGrouping, TimeRange } from "./overview-model";

/** One bar, slice or row of a chart that is broken down by something. */
export type Row = { key: string; label: string; value: number; detail?: string };

/** Everything a panel may be drawn from, already read for the page. */
export type Sources = {
  overview: ClientOverview;
  holdings: ClientHoldings | undefined;
  owned: ClientNonFinancialAssets | undefined;
  loans: ClientLoans | undefined;
  cashflows: CashflowList | undefined;
  settings: ViewSettings;
  from: string;
  to: string;
  /** The currency every figure is shown in, where it is not the portfolio's own; asked of every overview read. */
  shownIn?: string;
};

const OWNED = "OWNED_OUTRIGHT";

/** The lists a client's page reads beside the overview. */
export type Lists = Pick<Sources, "holdings" | "owned" | "loans" | "cashflows">;

/**
 * The rate the overview used for a day: the one for that day, or the latest before it, or — for a day before
 * the rates begin — the first.
 */
export function rateOn(rates: LinePoint[], day: string): number {
  let found = rates[0]?.value ?? 1;
  for (const one of rates) {
    if (one.on > day) break;
    found = one.value;
  }
  return found;
}

/**
 * The page's lists restated in the currency the overview is shown in, with exactly the rates the overview used:
 * what is held today at today's rate, each movement of cash at its own day's. Nothing is converted where the
 * overview is in the portfolio's own currency.
 */
export function restate(overview: ClientOverview, lists: Lists): Lists {
  const { rates, currency } = overview;
  if (rates.length === 0 || currency === overview.baseCurrency) return lists;
  const today = rates[rates.length - 1]!.value;
  const at = (amount: number, rate: number) => Math.round(amount * rate * 100) / 100;
  const now = (amount: number) => at(amount, today);
  const maybe = (amount: number | null) => (amount === null ? null : now(amount));
  const group = (one: SubClassGroup): SubClassGroup => ({
    ...one,
    valueAmount: now(one.valueAmount),
    targetValue: maybe(one.targetValue),
    suggestion: maybe(one.suggestion),
    positions: one.positions.map((line) => ({ ...line, valueAmount: now(line.valueAmount) })),
    inside: one.inside.map(group),
  });
  const { holdings, owned, loans, cashflows } = lists;
  const flows = cashflows?.items.map((one) => ({ ...one, currency, amount: at(one.amount, rateOn(rates, one.happenedOn)) }));
  return {
    holdings: holdings && {
      ...holdings,
      currency,
      underManagement: now(holdings.underManagement),
      unplaced: now(holdings.unplaced),
      classes: holdings.classes.map((one) => ({
        ...one,
        valueAmount: now(one.valueAmount),
        suggestion: maybe(one.suggestion),
        subClasses: one.subClasses.map(group),
      })),
    },
    owned: owned && {
      ...owned,
      currency,
      total: now(owned.total),
      items: owned.items.map((one) => ({ ...one, valueAmount: now(one.valueAmount) })),
    },
    loans: loans && {
      ...loans,
      currency,
      total: now(loans.total),
      againstThePortfolio: now(loans.againstThePortfolio),
      againstNonFinancial: now(loans.againstNonFinancial),
      loans: loans.loans.map((one) => ({ ...one, valueAmount: now(one.valueAmount) })),
    },
    cashflows: cashflows && flows && {
      ...cashflows,
      currency,
      items: flows,
      // Both as positive figures, as the list sends them.
      paidIn: flows.filter((one) => one.amount > 0).reduce((sum, one) => sum + one.amount, 0),
      takenOut: -flows.filter((one) => one.amount < 0).reduce((sum, one) => sum + one.amount, 0),
    },
  };
}

/** The page's dates, or the stretch a chart has been set to read instead. */
export function rangeDates(range: TimeRange | null | undefined, from: string, to: string, firstValuedOn: string | null) {
  const end = new Date(to);
  if (!range || range === "DEFAULT") return { from, to };
  if (range === "SINCE_INCEPTION") return { from: firstValuedOn ?? "2000-01-01", to };
  if (range === "YTD") return { from: isoDay(new Date(end.getFullYear(), 0, 1)), to };
  const start = new Date(end);
  if (range === "3M") start.setMonth(start.getMonth() - 3);
  if (range === "1Y") start.setFullYear(start.getFullYear() - 1);
  return { from: isoDay(start), to };
}

/** Every line held, from inside every class and sub-class, however deep the plan nests them. */
export function positionsOf(holdings: ClientHoldings | undefined): PositionRow[] {
  const found: PositionRow[] = [];
  const walk = (group: SubClassGroup) => {
    found.push(...group.positions);
    group.inside.forEach(walk);
  };
  holdings?.classes.forEach((one) => one.subClasses.forEach(walk));
  return found;
}

function narrowed(settings: ViewSettings) {
  const classes = settings.assetClasses?.length ? new Set(settings.assetClasses) : null;
  const sectors = settings.sectors?.length ? new Set(settings.sectors) : null;
  const countries = settings.countries?.length ? new Set(settings.countries) : null;
  return {
    any: Boolean(classes || sectors || countries),
    byLine: Boolean(sectors || countries),
    keepsClass: (code: string) => !classes || classes.has(code),
    keeps: (line: PositionRow) =>
      (!classes || classes.has(line.assetClass)) &&
      (!sectors || sectors.has(line.sector ?? "")) &&
      (!countries || countries.has(line.countryCode ?? "")),
  };
}

function keyOf(line: PositionRow, grouping: Grouping): [string, string] {
  switch (grouping) {
    case "ASSET_CLASS":
      return [line.assetClass, line.assetClassName];
    case "SUB_CLASS":
      return [line.subClass ?? "—", line.subClass ?? "No sub-class"];
    case "SECTOR":
      return [line.sector ?? "—", line.sector ?? "No sector stated"];
    case "COUNTRY":
      return [line.countryCode ?? "—", line.countryCode ?? "No country stated"];
    case "CREDIT_RATING":
      return [line.creditRating ?? "—", line.creditRating ?? "Not rated"];
  }
}

/**
 * What the client holds today, broken down.
 *
 * <p>By asset class it reads the class totals, which include classes the firm holds as one figure rather
 * than line by line. Any other breakdown reads the lines, and whatever a class holds that is not written
 * down line by line is shown as "Not broken down" rather than quietly left out — the slices still add up to
 * what the client holds.
 */
function held(grouping: Grouping, sources: Sources): Row[] {
  const filter = narrowed(sources.settings);
  const lines = positionsOf(sources.holdings).filter(filter.keeps);
  const totals = new Map<string, Row>();
  const add = (key: string, label: string, value: number) => {
    const was = totals.get(key);
    totals.set(key, { key, label, value: (was?.value ?? 0) + value });
  };

  if (grouping === "ASSET_CLASS" && !filter.byLine) {
    sources.holdings?.classes.filter((one) => filter.keepsClass(one.assetClass)).forEach((one) => add(one.assetClass, one.assetClassName, one.valueAmount));
  } else {
    lines.forEach((line) => {
      const [key, label] = keyOf(line, grouping);
      add(key, label, line.valueAmount);
    });
    if (!filter.byLine) {
      sources.holdings?.classes
        .filter((one) => filter.keepsClass(one.assetClass))
        .forEach((one) => {
          const inLines = lines.filter((line) => line.assetClass === one.assetClass).reduce((sum, line) => sum + line.valueAmount, 0);
          const rest = one.valueAmount - inLines;
          if (Math.abs(rest) > 0.005) add("—rest", "Not broken down", rest);
        });
    }
  }
  // What is owned outright is not in any class of the plan; it belongs only in an unfiltered breakdown.
  if (!filter.any && (sources.owned?.total ?? 0) !== 0) add(OWNED, "Owned outright", sources.owned?.total ?? 0);
  return [...totals.values()];
}

export function categories(attribute: Attribute, grouping: Grouping | null, sources: Sources, ranged: ClientOverview): Row[] {
  const filter = narrowed(sources.settings);
  let rows: Row[];
  switch (attribute) {
    case "MARKET_VALUE":
      rows = held(grouping ?? "ASSET_CLASS", sources);
      break;
    case "MARKET_VALUE_WEIGHT": {
      const values = held(grouping ?? "ASSET_CLASS", sources);
      const total = values.reduce((sum, one) => sum + one.value, 0) || 1;
      rows = values.map((one) => ({ ...one, value: (one.value / total) * 100 }));
      break;
    }
    case "NET_GAIN_LOSS":
      rows = ranged.changeByAssetClass
        .filter((one) => filter.keepsClass(one.assetClass))
        .map((one) => ({ key: one.assetClass, label: one.name, value: one.change }));
      break;
    case "TOP_SECURITIES": {
      const lines = positionsOf(sources.holdings)
        .filter(filter.keeps)
        .map((line) => ({ key: line.id, label: line.name, value: line.valueAmount, detail: line.assetClassName }));
      const outright = filter.any
        ? []
        : (sources.owned?.items ?? []).map((one) => ({ key: one.id, label: one.item, value: one.valueAmount, detail: "Owned outright" }));
      rows = [...lines, ...outright].sort((a, b) => b.value - a.value).slice(0, 3);
      break;
    }
    case "TOP_CASH_FLOWS":
      rows = (sources.cashflows?.items ?? [])
        .filter((one) => one.happenedOn >= rangeOf(ranged, sources).from && one.happenedOn <= rangeOf(ranged, sources).to)
        .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
        .slice(0, 5)
        .map((one) => ({ key: one.id, label: one.note || (one.amount >= 0 ? "Paid in" : "Taken out"), value: one.amount, detail: one.happenedOn }));
      break;
    default:
      rows = [];
  }
  if (sources.settings.hideEmptyRows) rows = rows.filter((one) => Math.abs(one.value) > 0.005);
  return attribute === "TOP_SECURITIES" || attribute === "TOP_CASH_FLOWS" ? rows : rows.sort((a, b) => b.value - a.value);
}

function rangeOf(ranged: ClientOverview, sources: Sources) {
  return { from: ranged.from ?? sources.from, to: ranged.to ?? sources.to };
}

/** What is owned outright and owed, today: carried back unchanged, as nothing records them on past days. */
function outside(overview: ClientOverview) {
  return (overview.byAssetClass.find((one) => one.key === OWNED)?.value ?? 0) + overview.liabilities;
}

export function series(attribute: Attribute, ranged: ClientOverview, sources: Sources): LinePoint[] {
  switch (attribute) {
    case "TWR":
      return ranged.performance;
    case "TWR_DAILY":
      // Each day's own return, unwound from the running one: (1 + to today) / (1 + to yesterday) − 1.
      return ranged.performance.slice(1).map((one, index) => {
        const before = ranged.performance[index]!.value;
        return { on: one.on, value: ((1 + one.value / 100) / (1 + before / 100) - 1) * 100 };
      });
    case "NET_WORTH": {
      const add = outside(ranged);
      return ranged.portfolioValue.map((one) => ({ on: one.on, value: one.value + add }));
    }
    case "NET_CASH_FLOW": {
      const { from, to } = rangeOf(ranged, sources);
      const months = new Map<string, number>();
      (sources.cashflows?.items ?? [])
        .filter((one) => one.happenedOn >= from && one.happenedOn <= to)
        .forEach((one) => {
          const month = `${one.happenedOn.slice(0, 7)}-01`;
          months.set(month, (months.get(month) ?? 0) + one.amount);
        });
      return [...months.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([on, value]) => ({ on, value }));
    }
    default:
      return [];
  }
}

/** One figure for a figures panel, or nothing where there is not enough on file to say it. */
export function figure(key: Figure, sources: Sources): number | null {
  const { overview } = sources;
  switch (key) {
    case "MARKET_VALUE":
      return overview.marketValue;
    case "ASSETS":
      return overview.assets;
    case "LIABILITIES":
      return overview.liabilities;
    case "TWR_YTD":
      return overview.twrYearToDate;
    case "TWR_PERIOD":
      return overview.performance.length > 1 ? overview.performance[overview.performance.length - 1]!.value : null;
    case "PORTFOLIO_VALUE":
      return sources.holdings?.underManagement ?? null;
    case "CASH":
      return sources.holdings?.classes.find((one) => one.assetClass === "CASH")?.valueAmount ?? 0;
    case "NET_CASH_FLOW":
      return (sources.cashflows?.items ?? [])
        .filter((one) => one.happenedOn >= sources.from && one.happenedOn <= sources.to)
        .reduce((sum, one) => sum + one.amount, 0);
  }
}

/**
 * A benchmark's return over the same stretch as the client's, from the level standing on its first day.
 * Nothing where no level stands on or before that day — a line starting late would compare unlike with unlike.
 */
export function benchmarkLine(levels: BenchmarkLevelRow[], from: string, to: string): LinePoint[] {
  const base = [...levels].filter((one) => one.onDate <= from).pop() ?? levels.find((one) => one.onDate >= from);
  if (!base || base.level === 0) return [];
  return levels
    .filter((one) => one.onDate >= base.onDate && one.onDate <= to)
    .map((one) => ({ on: one.onDate, value: (one.level / base.level - 1) * 100 }));
}

/** One row of a portfolio table: a group, or a single holding at the bottom of one. */
export type TreeRow = {
  key: string;
  label: string;
  detail?: string;
  value: number;
  /** Change in value over the dates, where it is known at this level; nothing where it is not. */
  gain: number | null;
  /** The same as a percentage of where it opened. */
  twr: number | null;
  /** Where it opened, so a group of rows can say its percentage from theirs. */
  opening: number | null;
  children: TreeRow[];
};

type Leaf = {
  key: string;
  label: string;
  detail?: string;
  value: number;
  assetClass: string;
  assetClassName: string;
  subClass: string | null;
  sector: string | null;
  country: string | null;
};

const LOANS = "LOANS";

/**
 * Everything the client owns and owes, one leaf per holding, so that the table's total is their market
 * value: what is held line by line, what a class holds only as one figure, what is owned outright, and loans.
 */
function leaves(sources: Sources): Leaf[] {
  const filter = narrowed(sources.settings);
  const lines = positionsOf(sources.holdings).filter(filter.keeps);
  const found: Leaf[] = lines.map((line) => ({
    key: line.id,
    label: line.name,
    detail: line.identifier ?? undefined,
    value: line.valueAmount,
    assetClass: line.assetClass,
    assetClassName: line.assetClassName,
    subClass: line.subClass,
    sector: line.sector,
    country: line.countryCode,
  }));
  if (!filter.byLine) {
    sources.holdings?.classes
      .filter((one) => filter.keepsClass(one.assetClass))
      .forEach((one) => {
        const inLines = lines.filter((line) => line.assetClass === one.assetClass).reduce((sum, line) => sum + line.valueAmount, 0);
        const rest = one.valueAmount - inLines;
        if (Math.abs(rest) > 0.005) {
          found.push({ key: `rest-${one.assetClass}`, label: "Not broken down", value: rest, assetClass: one.assetClass,
            assetClassName: one.assetClassName, subClass: null, sector: null, country: null });
        }
      });
  }
  // What is owned outright and what is owed belong only to an unfiltered table, as on the overview.
  if (!filter.any) {
    (sources.owned?.items ?? []).forEach((one) => found.push({ key: one.id, label: one.item, detail: one.description ?? undefined,
      value: one.valueAmount, assetClass: OWNED, assetClassName: "Owned outright", subClass: null, sector: null, country: null }));
    (sources.loans?.loans ?? []).forEach((one) => found.push({ key: one.id, label: one.description, value: one.valueAmount,
      assetClass: LOANS, assetClassName: "Loans", subClass: null, sector: null, country: null }));
  }
  return sources.settings.hideEmptyRows ? found.filter((one) => Math.abs(one.value) > 0.005) : found;
}

function groupOf(leaf: Leaf, grouping: PortfolioGrouping): [string, string] {
  switch (grouping) {
    case "ASSET_CLASS":
      return [leaf.assetClass, leaf.assetClassName];
    case "SUB_CLASS":
      return [leaf.subClass ?? "—", leaf.subClass ?? "No sub-class"];
    case "SECTOR":
      return [leaf.sector ?? "—", leaf.sector ?? "No sector stated"];
    case "COUNTRY":
      return [leaf.country ?? "—", leaf.country ?? "No country stated"];
    case "SECURITY":
      return [leaf.key, leaf.label];
  }
}

/**
 * The portfolio as nested rows, outermost grouping first, in alphabetical order at each level.
 *
 * <p>A holding's gain and return are read off its own daily closes. An asset class's are the class's own,
 * which also covers what it holds only as one figure. Any other group — a sector, a country — adds up the
 * holdings in it, and says nothing where none of them has a history yet. What is owned outright and what is
 * owed have no daily history, and say nothing.
 */
export function portfolioTree(groupings: PortfolioGrouping[], sources: Sources, ranged: ClientOverview): TreeRow[] {
  const classes = new Map(ranged.changeByAssetClass.map((one) => [one.assetClass, one]));
  const held = new Map(ranged.positionChanges.map((one) => [one.positionId, one]));
  const sum = (rows: TreeRow[]) => {
    const known = rows.filter((row) => row.gain !== null && row.opening !== null);
    if (known.length === 0) return { gain: null, twr: null, opening: null };
    const gain = known.reduce((total, row) => total + row.gain!, 0);
    const opening = known.reduce((total, row) => total + row.opening!, 0);
    return { gain, opening, twr: opening > 0 ? (gain / opening) * 100 : null };
  };
  const build = (items: Leaf[], level: number): TreeRow[] => {
    const grouping = groupings[level];
    if (!grouping || grouping === "SECURITY") {
      return items
        .map((leaf) => {
          const its = held.get(leaf.key);
          return {
            key: leaf.key,
            label: leaf.label,
            detail: leaf.detail,
            value: leaf.value,
            gain: its ? its.change : null,
            twr: its?.percent ?? null,
            opening: its ? its.opening : null,
            children: [],
          };
        })
        .sort((a, b) => a.label.localeCompare(b.label));
    }
    const groups = new Map<string, { label: string; items: Leaf[] }>();
    items.forEach((leaf) => {
      const [key, label] = groupOf(leaf, grouping);
      const was = groups.get(key) ?? { label, items: [] };
      was.items.push(leaf);
      groups.set(key, was);
    });
    return [...groups.entries()]
      .map(([key, group]) => {
        const children = build(group.items, level + 1);
        const own = grouping === "ASSET_CLASS" ? classes.get(key) : undefined;
        const added = sum(children);
        return {
          key: `${level}-${key}`,
          label: group.label,
          value: group.items.reduce((total, leaf) => total + leaf.value, 0),
          gain: own ? own.change : added.gain,
          twr: own ? (own.percent ?? null) : added.twr,
          // A class's opening is not sent; its change and percentage give it, where the percentage is not nought.
          opening: own ? (own.percent ? (own.change / own.percent) * 100 : null) : added.opening,
          children,
        };
      })
      .sort((a, b) => a.label.localeCompare(b.label));
  };
  return build(leaves(sources), 0);
}
