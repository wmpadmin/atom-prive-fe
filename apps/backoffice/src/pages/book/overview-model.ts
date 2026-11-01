import type { PanelConfig, ViewCell, ViewDefinition, ViewSettings } from "@atomprive/api-client/backoffice";

/**
 * Everything a PM can put on a client's overview, and what each choice means.
 *
 * <p>Kept in one place because three things read it: the panels that draw, the window that edits a panel,
 * and the + Chart list. A choice offered in one and not understood by another is how a view saves a chart
 * that will not draw.
 *
 * <p>Where the firm's reference screens offer something we cannot yet fill — closed positions, gain/loss
 * by security, true performance attribution — it is listed with the reason rather than left out, so the PM
 * can see it is coming and is never shown a figure that is not ours.
 */

export type Kind = "figures" | "performance" | "chart" | "table" | "portfolioTable";

export type Figure =
  | "MARKET_VALUE"
  | "ASSETS"
  | "LIABILITIES"
  | "TWR_YTD"
  | "TWR_PERIOD"
  | "PORTFOLIO_VALUE"
  | "CASH"
  | "NET_CASH_FLOW";

/** Every figure a figures panel can show. Each is something we hold for every client. */
export const FIGURES: Record<Figure, (currency: string) => string> = {
  MARKET_VALUE: (ccy) => `Market value (${ccy})`,
  ASSETS: (ccy) => `Assets (${ccy})`,
  LIABILITIES: (ccy) => `Liabilities (${ccy})`,
  TWR_YTD: (ccy) => `TWR (${ccy}) (YTD)`,
  TWR_PERIOD: (ccy) => `TWR (${ccy}) (selected dates)`,
  PORTFOLIO_VALUE: (ccy) => `Portfolio value (${ccy})`,
  CASH: (ccy) => `Cash (${ccy})`,
  NET_CASH_FLOW: (ccy) => `Net cash flow (${ccy})`,
};

export type Attribute =
  | "MARKET_VALUE"
  | "MARKET_VALUE_WEIGHT"
  | "NET_GAIN_LOSS"
  | "TWR"
  | "TWR_DAILY"
  | "NET_WORTH"
  | "NET_CASH_FLOW"
  | "TOP_CASH_FLOWS"
  | "TOP_SECURITIES";

export type Grouping = "ASSET_CLASS" | "SUB_CLASS" | "SECTOR" | "COUNTRY" | "CREDIT_RATING";
export type TimeRange = "DEFAULT" | "3M" | "YTD" | "1Y" | "SINCE_INCEPTION";
export type ChartType = "PIE" | "COLUMN" | "BAR" | "LINE" | "LIST" | "TABLE";

/**
 * What a chart plots.
 *
 * @param shape "categories" for one bar or slice per group, "time" for a line or bars across days
 * @param groupings which groupings it can be broken down by; the rest are shown with the reason
 * @param ranged whether it reads a stretch of time. Holdings are as of today, so they are not.
 */
export const ATTRIBUTES: Record<
  Attribute,
  { label: string; shape: "categories" | "time"; groupings: Grouping[]; types: ChartType[]; ranged: boolean }
> = {
  MARKET_VALUE: {
    label: "Market value",
    shape: "categories",
    groupings: ["ASSET_CLASS", "SUB_CLASS", "SECTOR", "COUNTRY", "CREDIT_RATING"],
    types: ["PIE", "COLUMN", "BAR", "LIST", "TABLE"],
    ranged: false,
  },
  MARKET_VALUE_WEIGHT: {
    label: "Market value weight (%)",
    shape: "categories",
    groupings: ["ASSET_CLASS", "SUB_CLASS", "SECTOR", "COUNTRY", "CREDIT_RATING"],
    types: ["PIE", "COLUMN", "BAR", "LIST", "TABLE"],
    ranged: false,
  },
  NET_GAIN_LOSS: {
    label: "Net gain/loss",
    shape: "categories",
    groupings: ["ASSET_CLASS"],
    types: ["COLUMN", "BAR", "TABLE"],
    ranged: true,
  },
  TWR: { label: "TWR (cumulative)", shape: "time", groupings: [], types: ["LINE", "COLUMN"], ranged: true },
  TWR_DAILY: { label: "TWR by day", shape: "time", groupings: [], types: ["COLUMN", "LINE"], ranged: true },
  NET_WORTH: { label: "Net worth", shape: "time", groupings: [], types: ["LINE", "COLUMN"], ranged: true },
  NET_CASH_FLOW: { label: "Net cash flow (by month)", shape: "time", groupings: [], types: ["COLUMN", "LINE"], ranged: true },
  TOP_CASH_FLOWS: {
    label: "Largest cash flows",
    shape: "categories",
    groupings: [],
    types: ["BAR", "LIST", "TABLE"],
    ranged: true,
  },
  TOP_SECURITIES: {
    label: "Top 3 securities by value",
    shape: "categories",
    groupings: [],
    types: ["LIST", "BAR", "PIE", "TABLE"],
    ranged: false,
  },
};

export const GROUPINGS: Record<Grouping, string> = {
  ASSET_CLASS: "Asset class",
  SUB_CLASS: "Sub-class",
  SECTOR: "Sector",
  COUNTRY: "Country",
  CREDIT_RATING: "Credit rating",
};

/** Why a grouping cannot be offered for gain/loss: value is kept over time by asset class only. */
export const NO_HISTORY_BELOW_CLASS = "Needs daily prices from the custodian feed";

export const TIME_RANGES: Record<TimeRange, string> = {
  DEFAULT: "Default (the page's dates)",
  "3M": "Last 3 months",
  YTD: "Year to date",
  "1Y": "Last year",
  SINCE_INCEPTION: "Since inception",
};

export const CHART_TYPES: Record<ChartType, string> = {
  PIE: "Pie",
  COLUMN: "Column",
  BAR: "Bar",
  LINE: "Line",
  LIST: "List",
  TABLE: "Table",
};

export type Column =
  | "NAME"
  | "IDENTIFIER"
  | "ASSET_CLASS"
  | "SUB_CLASS"
  | "SECTOR"
  | "COUNTRY"
  | "CREDIT_RATING"
  | "YIELD"
  | "DURATION"
  | "VALUE"
  | "WEIGHT";

/** The columns a holdings table can show, in the order they are offered. */
export const COLUMNS: Record<Column, string> = {
  NAME: "Name",
  IDENTIFIER: "Identifier",
  ASSET_CLASS: "Asset class",
  SUB_CLASS: "Sub-class",
  SECTOR: "Sector",
  COUNTRY: "Country",
  CREDIT_RATING: "Credit rating",
  YIELD: "Yield",
  DURATION: "Duration",
  VALUE: "Market value",
  WEIGHT: "Weight",
};

export const DEFAULT_COLUMNS: Column[] = ["NAME", "ASSET_CLASS", "SECTOR", "COUNTRY", "VALUE", "WEIGHT"];

/** One entry in the + Chart list: what it adds, or why it cannot be added yet. */
export type LibraryEntry = {
  label: string;
  icon: "bar" | "line" | "pie" | "number";
  kind: Kind;
  config?: Partial<PanelConfig>;
  /** Present where the entry is shown but cannot be added. */
  unavailable?: string;
};

export const LIBRARY: { group: string; entries: LibraryEntry[] }[] = [
  {
    group: "Performance",
    entries: [
      { label: "Net Gain/Loss by Asset Class", icon: "bar", kind: "chart", config: { attribute: "NET_GAIN_LOSS", grouping: "ASSET_CLASS", chartType: "COLUMN", timeRange: "DEFAULT" } },
      { label: "Performance Attribution", icon: "bar", kind: "chart", unavailable: "Needs daily prices and trades from the custodian feed" },
      { label: "Performance Since Inception", icon: "line", kind: "chart", config: { attribute: "TWR", chartType: "LINE", timeRange: "SINCE_INCEPTION" } },
      { label: "TWR by Day", icon: "line", kind: "chart", config: { attribute: "TWR_DAILY", chartType: "COLUMN", timeRange: "DEFAULT" } },
    ],
  },
  {
    group: "Holding",
    entries: [
      { label: "Market Value by Asset Class", icon: "pie", kind: "chart", config: { attribute: "MARKET_VALUE", grouping: "ASSET_CLASS", chartType: "PIE" } },
      { label: "Net Worth", icon: "line", kind: "chart", config: { attribute: "NET_WORTH", chartType: "LINE", timeRange: "DEFAULT" } },
      { label: "Net Worth Since Inception", icon: "line", kind: "chart", config: { attribute: "NET_WORTH", chartType: "LINE", timeRange: "SINCE_INCEPTION" } },
      { label: "Top 3 Securities by Value", icon: "bar", kind: "chart", config: { attribute: "TOP_SECURITIES", chartType: "LIST" } },
    ],
  },
  {
    group: "Cash Flow",
    entries: [
      { label: "Big Numbers", icon: "number", kind: "figures" },
      { label: "Net Cash Flow", icon: "bar", kind: "chart", config: { attribute: "NET_CASH_FLOW", chartType: "COLUMN", timeRange: "DEFAULT" } },
      { label: "Top Cash Flow Movers", icon: "bar", kind: "chart", config: { attribute: "TOP_CASH_FLOWS", chartType: "BAR", timeRange: "DEFAULT" } },
    ],
  },
];

/** A panel's own id within its view, so two charts of the same kind can be told apart. */
export function newPanelId() {
  return `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function config(over: Partial<PanelConfig> = {}): PanelConfig {
  return {
    title: null,
    attribute: null,
    grouping: null,
    timeRange: null,
    chartType: null,
    figures: null,
    columns: null,
    groupings: null,
    tableType: null,
    ...over,
  };
}

export const NO_SETTINGS: ViewSettings = {
  assetClasses: null,
  sectors: null,
  countries: null,
  hideEmptyRows: false,
  benchmarks: null,
};

/**
 * The platform's own Overview: the four figures and the line on the left, eight columns of twelve; three
 * smaller panels stacked on the right. In 36px rows with 16px between them.
 */
export const DEFAULT_VIEW: ViewDefinition = {
  cells: [
    { id: "figures", kind: "figures", x: 0, y: 0, w: 8, h: 2, config: config({ figures: ["MARKET_VALUE", "ASSETS", "LIABILITIES", "TWR_YTD"] }) },
    { id: "performance", kind: "performance", x: 0, y: 2, w: 8, h: 13, config: null },
    { id: "allocation", kind: "chart", x: 8, y: 0, w: 4, h: 4, config: config({ title: "Market value by asset class", attribute: "MARKET_VALUE", grouping: "ASSET_CLASS", chartType: "PIE" }) },
    { id: "gainLoss", kind: "chart", x: 8, y: 4, w: 4, h: 6, config: config({ title: "Net gain/loss by asset class", attribute: "NET_GAIN_LOSS", grouping: "ASSET_CLASS", chartType: "COLUMN", timeRange: "DEFAULT" }) },
    { id: "topHoldings", kind: "chart", x: 8, y: 10, w: 4, h: 5, config: config({ title: "Top 3 securities by value", attribute: "TOP_SECURITIES", chartType: "LIST" }) },
  ],
  settings: NO_SETTINGS,
};

/** The smallest each kind of panel may be made before what is in it stops being readable. */
export const LEAST: Record<Kind, { minW: number; minH: number }> = {
  figures: { minW: 3, minH: 2 },
  performance: { minW: 4, minH: 8 },
  chart: { minW: 3, minH: 4 },
  table: { minW: 4, minH: 4 },
  portfolioTable: { minW: 5, minH: 6 },
};

/** Where a newly added panel goes: across the full width, under everything already there. */
export function placeBelow(cells: ViewCell[], kind: Kind, cfg: PanelConfig | null): ViewCell {
  const bottom = cells.reduce((deepest, cell) => Math.max(deepest, cell.y + cell.h), 0);
  const size: Record<Kind, { w: number; h: number }> = {
    figures: { w: 8, h: 2 },
    performance: { w: 8, h: 13 },
    chart: { w: 4, h: 5 },
    table: { w: 12, h: 7 },
    portfolioTable: { w: 8, h: 14 },
  };
  return { id: newPanelId(), kind, x: 0, y: bottom, ...size[kind], config: cfg };
}

/** The title a chart shows when the PM has not named it. */
export function chartTitle(cfg: PanelConfig | null | undefined) {
  if (!cfg) return "Chart";
  if (cfg.title) return cfg.title;
  const attribute = ATTRIBUTES[cfg.attribute as Attribute];
  if (!attribute) return "Chart";
  const grouping = cfg.grouping ? ` by ${GROUPINGS[cfg.grouping as Grouping].toLowerCase()}` : "";
  return `${attribute.label}${grouping}`;
}

export type PortfolioGrouping = "ASSET_CLASS" | "SUB_CLASS" | "SECTOR" | "COUNTRY" | "SECURITY";

/** What a portfolio table can nest its rows by, outermost first. Security is always the innermost. */
export const PORTFOLIO_GROUPINGS: Record<PortfolioGrouping, string> = {
  ASSET_CLASS: "Asset class",
  SUB_CLASS: "Sub-class",
  SECTOR: "Sector",
  COUNTRY: "Country",
  SECURITY: "Security",
};

export type PortfolioAttribute =
  | "MARKET_VALUE"
  | "NET_GAIN_LOSS"
  | "TWR"
  | "WEIGHT"
  | "TWR_YTD"
  | "TWR_INCEPTION"
  | "ABSOLUTE_RETURN";

export const PORTFOLIO_ATTRIBUTES: Record<PortfolioAttribute, (currency: string) => string> = {
  MARKET_VALUE: (ccy) => `Market value (${ccy})`,
  NET_GAIN_LOSS: (ccy) => `Net gain/loss – change (${ccy})`,
  TWR: (ccy) => `TWR (${ccy})`,
  WEIGHT: (ccy) => `Market value weight % (${ccy})`,
  TWR_YTD: (ccy) => `TWR (${ccy}) (YTD)`,
  TWR_INCEPTION: (ccy) => `TWR (${ccy}) (since inception)`,
  ABSOLUTE_RETURN: (ccy) => `Absolute return % (${ccy})`,
};

export const DEFAULT_GROUPINGS: PortfolioGrouping[] = ["ASSET_CLASS", "SECURITY"];
export const DEFAULT_PORTFOLIO_ATTRIBUTES: PortfolioAttribute[] = ["MARKET_VALUE", "NET_GAIN_LOSS", "TWR", "WEIGHT"];

/** Why a row below the whole portfolio has no return or gain of its own yet. */
export const NO_RETURN_BELOW_TOTAL = "No daily history for this row yet";

/**
 * The platform's Overall Portfolio: the whole book as one table on the left, eight columns of twelve, with
 * how it is spread and what it has been worth on the right.
 */
export const OVERALL_VIEW: ViewDefinition = {
  cells: [
    {
      id: "book",
      kind: "portfolioTable",
      x: 0,
      y: 0,
      w: 8,
      h: 9,
      config: config({ groupings: DEFAULT_GROUPINGS, columns: DEFAULT_PORTFOLIO_ATTRIBUTES, tableType: "STANDARD" }),
    },
    { id: "allocation", kind: "chart", x: 8, y: 0, w: 4, h: 4, config: config({ title: "Market value by asset class", attribute: "MARKET_VALUE", grouping: "ASSET_CLASS", chartType: "PIE" }) },
    { id: "worth", kind: "chart", x: 8, y: 4, w: 4, h: 5, config: config({ title: "Net worth", attribute: "NET_WORTH", chartType: "LINE", timeRange: "DEFAULT" }) },
  ],
  settings: NO_SETTINGS,
};

/** The Performance tab's table, in the reference table's order: what it is worth, then how it has done. */
export const PERFORMANCE_COLUMNS: PortfolioAttribute[] = [
  "MARKET_VALUE",
  "WEIGHT",
  "NET_GAIN_LOSS",
  "TWR",
  "TWR_YTD",
  "TWR_INCEPTION",
  "ABSOLUTE_RETURN",
];

/**
 * The whole portfolio read for its returns, laid out as the reference Performance tab: the table with every
 * return beside it, the return line for the year so far, and the gain or loss of each asset class.
 */
export const PERFORMANCE_VIEW: ViewDefinition = {
  cells: [
    {
      id: "returns",
      kind: "portfolioTable",
      x: 0,
      y: 0,
      w: 8,
      h: 12,
      config: config({ groupings: DEFAULT_GROUPINGS, columns: PERFORMANCE_COLUMNS, tableType: "STANDARD" }),
    },
    { id: "twrByDay", kind: "chart", x: 8, y: 0, w: 4, h: 6, config: config({ title: "TWR by day", attribute: "TWR", chartType: "LINE", timeRange: "YTD" }) },
    { id: "gainByClass", kind: "chart", x: 8, y: 6, w: 4, h: 6, config: config({ title: "Net gain/loss by asset class", attribute: "NET_GAIN_LOSS", grouping: "ASSET_CLASS", chartType: "BAR", timeRange: "DEFAULT" }) },
  ],
  settings: NO_SETTINGS,
};
