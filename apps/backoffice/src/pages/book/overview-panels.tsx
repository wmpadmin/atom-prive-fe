import { ApiError } from "@atomprive/api-client";
import {
  getListBenchmarkLevelsQueryKey,
  listBenchmarkLevels,
  useGetClientOverview,
  useListBenchmarks,
  type BenchmarkRow,
  type ClientOverview,
  type PanelConfig,
  type PositionRow,
} from "@atomprive/api-client/backoffice";
import { cn } from "@atomprive/ui";
import { keepPreviousData, useQueries } from "@tanstack/react-query";
import { Fragment, useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronRight } from "lucide-react";
import { formatDate } from "../../lib/labels";
import { axisMoney, money, short, signedPercent } from "./book-figures";
import { benchmarkLine, categories, figure, portfolioTree, positionsOf, rangeDates, series, type Sources, type TreeRow } from "./overview-data";
import { CategoryChart, TimeChart, type OtherLine } from "./overview-charts";
import { column as col, row as exportRow, useExportSheet, type Part } from "./overview-export";
import {
  ATTRIBUTES,
  COLUMNS,
  DEFAULT_COLUMNS,
  DEFAULT_GROUPINGS,
  GROUPINGS,
  DEFAULT_PORTFOLIO_ATTRIBUTES,
  FIGURES,
  NO_RETURN_BELOW_TOTAL,
  PORTFOLIO_ATTRIBUTES,
  PORTFOLIO_GROUPINGS,
  type PortfolioAttribute,
  type PortfolioGrouping,
  type Attribute,
  type ChartType,
  type Column,
  type Figure,
  type Grouping,
  type TimeRange,
} from "./overview-model";

/** What every panel needs beyond its own settings. */
export type PanelContext = {
  customerId: string;
  sources: Sources;
  classes: { code: string }[];
  /** The quick ranges on the performance panel set the page's dates; they live on the page. */
  range: string | null;
  onRange: (range: "3M" | "YTD" | "1Y" | "MAX") => void;
};

const percent = (value: number) => `${value.toFixed(2)}%`;

/** The figures across the top, in the order the PM has set them. */
export function FiguresPanel({ cfg, context }: { cfg: PanelConfig | null | undefined; context: PanelContext }) {
  const chosen = (cfg?.figures?.length ? cfg.figures : ["MARKET_VALUE", "ASSETS", "LIABILITIES", "TWR_YTD"]) as Figure[];
  const ccy = context.sources.overview.currency;
  useExportSheet(() => ({
    columns: [col("Figure"), col(`Value (${ccy})`, "MONEY"), col("Return %", "PERCENT")],
    rows: chosen.map((key) => {
      const value = figure(key, context.sources);
      const isReturn = key === "TWR_YTD" || key === "TWR_PERIOD";
      return exportRow([FIGURES[key](ccy), isReturn ? null : value, isReturn ? value : null]);
    }),
  }));
  return (
    <div className="grid h-full grid-cols-[repeat(auto-fit,minmax(8rem,1fr))] divide-x divide-line">
      {chosen.map((key) => {
        const value = figure(key, context.sources);
        const isReturn = key === "TWR_YTD" || key === "TWR_PERIOD";
        return (
          <div key={key} className="flex min-w-0 flex-col justify-center px-4 text-center">
            <p className="truncate text-xs font-semibold text-ink-muted" title={FIGURES[key](ccy)}>{FIGURES[key](ccy)}</p>
            <p className={cn("mt-1 text-2xl font-bold tabular-nums",
              isReturn && value !== null ? (value < 0 ? "text-danger" : "text-emerald-600") : "text-ink")}>
              {value === null ? "—" : isReturn ? signedPercent(value) : short(value)}
            </p>
          </div>
        );
      })}
    </div>
  );
}

/** The benchmarks the view asks for, each as its return over the same dates as the client's. */
function useBenchmarkLines(ids: string[] | null | undefined, from: string, to: string): OtherLine[] {
  const listed = useListBenchmarks<BenchmarkRow[], ApiError>({ query: { enabled: Boolean(ids?.length), staleTime: 300_000 } });
  const wanted = ids ?? [];
  const levels = useQueries({
    queries: wanted.map((id) => ({
      queryKey: getListBenchmarkLevelsQueryKey(id),
      queryFn: () => listBenchmarkLevels(id),
      staleTime: 300_000,
    })),
  });
  return useMemo(
    () =>
      wanted
        .map((id, index) => ({
          name: listed.data?.find((one) => one.id === id)?.name ?? "Benchmark",
          points: benchmarkLine(levels[index]?.data ?? [], from, to),
        }))
        .filter((one) => one.points.length > 1),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the levels' data is what changes
    [listed.data, from, to, ...levels.map((one) => one.data)],
  );
}

/** The performance panel: the return since the page's start, or net worth, with the quick ranges. */
export function PerformancePanel({ context }: { context: PanelContext }) {
  const [line, setLine] = useState<"performance" | "worth">("performance");
  const { overview, settings } = context.sources;
  const benchmarks = useBenchmarkLines(settings.benchmarks?.map(String), overview.from ?? context.sources.from, overview.to ?? context.sources.to);
  const worth = useMemo(() => series("NET_WORTH", overview, context.sources), [overview, context.sources]);
  useExportSheet(() => (line === "performance"
    ? timeSheet(overview.performance, col("TWR %", "PERCENT"), benchmarks)
    : timeSheet(worth, col(`Net worth (${overview.currency})`, "MONEY"), [])));
  return (
    <div className="flex h-full flex-col pt-1">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 pr-10">
        <div role="tablist" aria-label="Line" className="flex rounded-lg bg-canvas p-1">
          {([
            ["performance", "Performance since inception"],
            ["worth", "Net worth since inception"],
          ] as const).map(([id, said]) => (
            <button key={id} type="button" role="tab" aria-selected={line === id} onClick={() => setLine(id)}
              className={cn("rounded-md px-3 py-1.5 text-sm font-semibold whitespace-nowrap",
                line === id ? "bg-white text-ink shadow-sm" : "text-ink-muted hover:text-ink")}>
              {said}
            </button>
          ))}
        </div>
        <div className="flex rounded-lg bg-canvas p-1" aria-label="Quick range" role="group">
          {(["3M", "YTD", "1Y", "MAX"] as const).map((one) => (
            <button key={one} type="button" aria-pressed={context.range === one} onClick={() => context.onRange(one)}
              className={cn("rounded-md px-3 py-1 text-xs font-semibold",
                context.range === one ? "bg-white text-ink shadow-sm" : "text-ink-muted hover:text-ink")}>
              {one}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-3 min-h-0 flex-1">
        {line === "performance" ? (
          <TimeChart key={`twr-${overview.from}-${overview.to}`} points={overview.performance} label="Time-weighted return"
            axisTitle="TWR" format={percent} others={benchmarks} />
        ) : (
          <TimeChart key={`worth-${overview.from}-${overview.to}`} points={worth} label="Net worth"
            axisTitle={overview.currency} format={short} axisFormat={axisMoney} />
        )}
      </div>
    </div>
  );
}

/**
 * Any chart the PM has set up. A chart set to read its own stretch of time reads it; everything else reads
 * the page's dates, or — for holdings — today.
 */
export function ChartPanel({ cfg, context }: { cfg: PanelConfig; context: PanelContext }) {
  const attribute = cfg.attribute as Attribute;
  const about = ATTRIBUTES[attribute];
  const { sources } = context;
  const range = (cfg.timeRange ?? "DEFAULT") as TimeRange;
  const dates = rangeDates(range, sources.from, sources.to, sources.overview.firstValuedOn);
  const own = about?.ranged && range !== "DEFAULT";
  const ranged = useGetClientOverview<ClientOverview, ApiError>(context.customerId, { ...dates, currency: sources.shownIn }, {
    query: { enabled: Boolean(own), placeholderData: keepPreviousData },
  });
  const read = own ? ranged.data : sources.overview;
  const benchmarks = useBenchmarkLines(attribute === "TWR" ? sources.settings.benchmarks?.map(String) : null,
    read?.from ?? dates.from, read?.to ?? dates.to);
  const isPercent = attribute === "MARKET_VALUE_WEIGHT" || attribute === "TWR" || attribute === "TWR_DAILY";
  useExportSheet(() => {
    if (!about || !read) return null;
    const value = isPercent ? col(`${about.label} %`, "PERCENT") : col(`${about.label} (${read.currency})`, "MONEY");
    if (about.shape === "time") return timeSheet(series(attribute, read, sources), value, benchmarks);
    const rows = categories(attribute, (cfg.grouping ?? null) as Grouping | null, sources, read);
    const detailed = rows.some((one) => one.detail);
    return {
      columns: [col(cfg.grouping ? GROUPINGS[cfg.grouping as Grouping] : "Name"), value, ...(detailed ? [col("Detail")] : [])],
      rows: rows.map((one) => exportRow([one.label, one.value, ...(detailed ? [one.detail ?? ""] : [])])),
    };
  });
  if (!about) return <p className="text-sm text-ink-muted">This chart no longer exists.</p>;
  if (!read) return <p className="grid h-full place-items-center text-sm text-ink-muted">Reading…</p>;

  const type = (cfg.chartType ?? about.types[0]) as ChartType;
  const format = isPercent ? percent : axisMoney;
  if (about.shape === "time") {
    return (
      <TimeChart key={`${attribute}-${read.from}-${read.to}-${type}`} points={series(attribute, read, sources)} label={about.label}
        axisTitle={isPercent ? "%" : read.currency} format={format} columns={type === "COLUMN"} others={benchmarks} />
    );
  }
  return (
    <CategoryChart rows={categories(attribute, (cfg.grouping ?? null) as Grouping | null, sources, read)} type={type}
      format={isPercent ? percent : money} axisFormat={format} classes={context.classes} label={about.label} />
  );
}

/** Every line the client holds, with the columns the PM has chosen. */
export function HoldingsTablePanel({ cfg, context }: { cfg: PanelConfig | null | undefined; context: PanelContext }) {
  const columns = (cfg?.columns?.length ? cfg.columns : DEFAULT_COLUMNS) as Column[];
  const { settings } = context.sources;
  const total = context.sources.holdings?.underManagement || 1;
  const lines = positionsOf(context.sources.holdings)
    .filter((line) => !settings.assetClasses?.length || settings.assetClasses.includes(line.assetClass))
    .filter((line) => !settings.sectors?.length || settings.sectors.includes(line.sector ?? ""))
    .filter((line) => !settings.countries?.length || settings.countries.includes(line.countryCode ?? ""))
    .filter((line) => !settings.hideEmptyRows || Math.abs(line.valueAmount) > 0.005)
    .sort((a, b) => b.valueAmount - a.valueAmount);
  const cell = (line: PositionRow, column: Column) => {
    switch (column) {
      case "NAME": return line.name;
      case "IDENTIFIER": return line.identifier ?? "—";
      case "ASSET_CLASS": return line.assetClassName;
      case "SUB_CLASS": return line.subClass ?? "—";
      case "SECTOR": return line.sector ?? "—";
      case "COUNTRY": return line.countryCode ?? "—";
      case "CREDIT_RATING": return line.creditRating ?? "—";
      case "YIELD": return line.yieldPercent === null ? "—" : percent(line.yieldPercent);
      case "DURATION": return line.durationYears === null ? "—" : `${line.durationYears.toFixed(1)} yrs`;
      case "VALUE": return short(line.valueAmount);
      case "WEIGHT": return percent((line.valueAmount / total) * 100);
    }
  };
  const numeric = (column: Column) => ["YIELD", "DURATION", "VALUE", "WEIGHT"].includes(column);
  const ccy = context.sources.overview.currency;
  useExportSheet(() => ({
    columns: columns.map((column) =>
      column === "VALUE" ? col(`${COLUMNS.VALUE} (${ccy})`, "MONEY")
        : column === "WEIGHT" || column === "YIELD" ? col(`${COLUMNS[column]} %`, "PERCENT")
          : column === "DURATION" ? col(`${COLUMNS.DURATION} (years)`, "NUMBER")
            : col(COLUMNS[column])),
    rows: lines.map((one) => exportRow(columns.map((column) =>
      column === "VALUE" ? one.valueAmount
        : column === "WEIGHT" ? (one.valueAmount / total) * 100
          : column === "YIELD" ? one.yieldPercent
            : column === "DURATION" ? one.durationYears
              : cell(one, column)))),
  }));
  return (
    <div className="h-full overflow-auto">
      <table className="min-w-full text-sm">
        <caption className="sr-only">What the client holds, line by line.</caption>
        <thead className="sticky top-0 bg-canvas">
          <tr className="text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
            {columns.map((column) => (
              <th key={column} scope="col" className={cn("px-3 py-2 whitespace-nowrap", numeric(column) && "text-right")}>{COLUMNS[column]}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lines.length === 0 ? (
            <tr><td colSpan={columns.length} className="px-3 py-8 text-center text-ink-muted">Nothing held matches this view.</td></tr>
          ) : (
            lines.map((line) => (
              <tr key={line.id} className="border-b border-line last:border-b-0">
                {columns.map((column) => (
                  <td key={column} className={cn("px-3 py-2", numeric(column) ? "text-right tabular-nums" : "text-ink-soft", column === "NAME" && "font-medium text-ink")}>
                    {cell(line, column)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

/**
 * The whole portfolio as one table, nested by what the PM has chosen, with a total that is the client's
 * market value and the view's benchmarks beneath it.
 *
 * <p>A figure that cannot be said at a level — a return for one holding, before the custodian feed sends
 * daily prices — is shown as a dash with the reason, never worked out from something it is not.
 */
export function PortfolioTablePanel({ cfg, context }: { cfg: PanelConfig | null | undefined; context: PanelContext }) {
  const groupings = (cfg?.groupings?.length ? cfg.groupings : DEFAULT_GROUPINGS) as PortfolioGrouping[];
  const columns = (cfg?.columns?.length ? cfg.columns : DEFAULT_PORTFOLIO_ATTRIBUTES) as PortfolioAttribute[];
  const { sources } = context;
  const { overview } = sources;
  const [open, setOpen] = useState<Set<string>>(new Set());
  // Sorted by a column at every level of the table at once, as the reference table sorts; A to Z by name
  // until a heading is pressed.
  const [sort, setSort] = useState<{ by: "NAME" | PortfolioAttribute; down: boolean } | null>(null);
  const tree = useMemo(() => portfolioTree(groupings, sources, overview), [groupings, sources, overview]);
  const total = tree.reduce((sum, one) => sum + one.value, 0);
  // The year so far and the whole life of the portfolio are read as the page's own dates are, each over its
  // own stretch, and only when the table shows them.
  const to = overview.to ?? sources.to;
  const yearDates = rangeDates("YTD", sources.from, to, overview.firstValuedOn ?? null);
  const lifeDates = rangeDates("SINCE_INCEPTION", sources.from, to, overview.firstValuedOn ?? null);
  const year = useGetClientOverview<ClientOverview, ApiError>(context.customerId, { ...yearDates, currency: sources.shownIn }, {
    query: { enabled: columns.includes("TWR_YTD"), placeholderData: keepPreviousData },
  });
  const life = useGetClientOverview<ClientOverview, ApiError>(context.customerId, { ...lifeDates, currency: sources.shownIn }, {
    query: { enabled: columns.includes("TWR_INCEPTION"), placeholderData: keepPreviousData },
  });
  const yearReturns = useMemo(() => returnsOver(groupings, sources, year.data), [groupings, sources, year.data]);
  const lifeReturns = useMemo(() => returnsOver(groupings, sources, life.data), [groupings, sources, life.data]);
  const rows = useMemo(() => {
    if (!sort) return tree;
    const key = (row: TreeRow): number | string | null =>
      sort.by === "NAME" ? row.label.toLowerCase()
        : sort.by === "NET_GAIN_LOSS" ? row.gain
          : sort.by === "TWR" ? row.twr
            : sort.by === "TWR_YTD" ? (yearReturns?.get(row.key) ?? null)
              : sort.by === "TWR_INCEPTION" ? (lifeReturns?.get(row.key) ?? null)
                : sort.by === "ABSOLUTE_RETURN" ? absolute(row.gain, row.opening)
                  : row.value;
    const order = (list: TreeRow[]): TreeRow[] =>
      [...list]
        .sort((a, b) => {
          const x = key(a);
          const y = key(b);
          // A figure we do not hold sorts last whichever way, rather than as nought among the figures.
          if (x === null || y === null) return x === y ? 0 : x === null ? 1 : -1;
          const compared = x < y ? -1 : x > y ? 1 : 0;
          return sort.down ? -compared : compared;
        })
        .map((row) => ({ ...row, children: order(row.children) }));
    return order(tree);
  }, [tree, sort, yearReturns, lifeReturns]);
  const press = (by: "NAME" | PortfolioAttribute) =>
    setSort((was) => (was?.by !== by ? { by, down: by !== "NAME" } : was.down === (by !== "NAME") ? { by, down: !was.down } : null));
  const arrow = (by: "NAME" | PortfolioAttribute) =>
    sort?.by === by ? (sort.down ? <ArrowDown aria-hidden="true" className="size-3" /> : <ArrowUp aria-hidden="true" className="size-3" />)
      : <ArrowUpDown aria-hidden="true" className="size-3 opacity-40" />;
  const said = (by: "NAME" | PortfolioAttribute) =>
    sort?.by === by ? (sort.down ? "descending" : "ascending") : "none";
  const byClass = groupings[0] === "ASSET_CLASS";
  const totalRow: TreeRow = {
    key: TOTAL,
    label: "Total",
    value: total,
    gain: byClass ? tree.reduce((sum, one) => sum + (one.gain ?? 0), 0) : null,
    twr: lastOf(overview),
    opening: byClass ? tree.reduce((sum, one) => sum + (one.opening ?? 0), 0) : null,
    children: [],
  };
  const benchmarkIds = sources.settings.benchmarks?.map(String);
  const benchmarks = useBenchmarkLines(benchmarkIds, overview.from ?? sources.from, to);
  const yearBenchmarks = useBenchmarkLines(columns.includes("TWR_YTD") ? benchmarkIds : null, yearDates.from, yearDates.to);
  const ccy = overview.currency;

  const cell = (column: PortfolioAttribute, row: TreeRow, strong?: boolean) => {
    const ret = (value: number | null | undefined) =>
      value === null || value === undefined ? <Unknown /> : <Num value={value} format={percent} signed strong={strong} />;
    switch (column) {
      case "MARKET_VALUE":
        return <Num value={row.value} format={money} strong={strong} />;
      case "NET_GAIN_LOSS":
        return row.gain === null ? <Unknown /> : <Num value={row.gain} format={money} signed strong={strong} />;
      case "TWR":
        return ret(row.twr);
      case "WEIGHT":
        return <Num value={total === 0 ? 0 : (row.value / total) * 100} format={percent} strong={strong} />;
      case "TWR_YTD":
        return yearReturns ? ret(yearReturns.get(row.key)) : <Reading />;
      case "TWR_INCEPTION":
        return lifeReturns ? ret(lifeReturns.get(row.key)) : <Reading />;
      case "ABSOLUTE_RETURN":
        return ret(absolute(row.gain, row.opening));
    }
  };
  const benchmarkCell = (column: PortfolioAttribute, name: string) => {
    const line = column === "TWR" ? benchmarks.find((one) => one.name === name)
      : column === "TWR_YTD" ? yearBenchmarks.find((one) => one.name === name)
        : undefined;
    return line ? <Num value={line.points[line.points.length - 1]!.value} format={percent} signed /> : null;
  };

  // What each cell holds as a figure, for the export: the same figures the cells draw.
  const figureOf = (column: PortfolioAttribute, row: TreeRow): number | null | undefined => {
    switch (column) {
      case "MARKET_VALUE": return row.value;
      case "NET_GAIN_LOSS": return row.gain;
      case "TWR": return row.twr;
      case "WEIGHT": return total === 0 ? 0 : (row.value / total) * 100;
      case "TWR_YTD": return yearReturns?.get(row.key);
      case "TWR_INCEPTION": return lifeReturns?.get(row.key);
      case "ABSOLUTE_RETURN": return absolute(row.gain, row.opening);
    }
  };
  useExportSheet(() => {
    const out: ReturnType<typeof exportRow>[] = [];
    // Every row, opened on screen or not, in the order the table is sorted.
    const walk = (list: TreeRow[], depth: number) => list.forEach((one) => {
      out.push(exportRow([one.detail ? `${one.label} (${one.detail})` : one.label, ...columns.map((column) => figureOf(column, one))],
        depth, depth === 0));
      walk(one.children, depth + 1);
    });
    walk(rows, 0);
    out.push(exportRow(["Total", ...columns.map((column) => figureOf(column, totalRow))], 0, true));
    benchmarks.forEach((one) => {
      const year = yearBenchmarks.find((other) => other.name === one.name);
      out.push(exportRow([one.name, ...columns.map((column) =>
        column === "TWR" ? one.points[one.points.length - 1]!.value
          : column === "TWR_YTD" && year ? year.points[year.points.length - 1]!.value
            : null)]));
    });
    return {
      columns: [
        col(groupings.map((one) => PORTFOLIO_GROUPINGS[one]).join(" › ")),
        ...columns.map((column) => {
          const money = column === "MARKET_VALUE" || column === "NET_GAIN_LOSS";
          const said = PORTFOLIO_ATTRIBUTES[column](ccy);
          return col(money || said.includes("%") ? said : `${said} %`, money ? "MONEY" : "PERCENT");
        }),
      ],
      rows: out,
    };
  });

  const draw = (row: TreeRow, depth: number): ReactNode => {
    const expandable = row.children.length > 0;
    const shown = open.has(row.key);
    return (
      <Fragment key={row.key}>
        <tr className={cn("border-b border-line", depth === 0 ? "font-semibold" : "text-ink-soft")}>
          <th scope="row" className="sticky left-0 z-[1] min-w-48 bg-white py-2 pr-3 text-left font-[inherit]" style={{ paddingLeft: `${0.5 + depth * 1.25}rem` }}>
            <span className="flex items-start gap-1">
              {expandable ? (
                <button type="button" aria-expanded={shown} aria-label={`${shown ? "Close" : "Open"} ${row.label}`}
                  onClick={() => setOpen((was) => { const next = new Set(was); if (shown) next.delete(row.key); else next.add(row.key); return next; })}
                  className="mt-0.5 rounded text-ink-muted outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-primary-600">
                  <ChevronRight aria-hidden="true" className={cn("size-4 transition-transform", shown && "rotate-90")} />
                </button>
              ) : (
                <span className="w-4 shrink-0" />
              )}
              <span className="min-w-0">
                {row.label}
                {row.detail && <span className="block text-xs font-normal text-ink-muted">{row.detail}</span>}
              </span>
            </span>
          </th>
          {columns.map((column) => (
            <td key={column} className="px-3 py-2 text-right whitespace-nowrap">{cell(column, row)}</td>
          ))}
        </tr>
        {shown && row.children.map((child) => draw(child, depth + 1))}
      </Fragment>
    );
  };

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="min-w-full text-sm">
          <caption className="sr-only">The whole portfolio, by {groupings.map((one) => one.toLowerCase().replace("_", " ")).join(" then ")}.</caption>
          <thead className="sticky top-0 z-[1] bg-canvas">
            <tr className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">
              <th scope="col" aria-sort={said("NAME")} className="sticky left-0 z-[2] bg-canvas px-3 py-2 text-left">
                <button type="button" onClick={() => press("NAME")} className="inline-flex items-center gap-1 uppercase hover:text-ink">
                  {groupings.map((one) => one.replace("_", " ").toLowerCase()).join(" › ")} {arrow("NAME")}
                </button>
              </th>
              {columns.map((column) => (
                <th key={column} scope="col" aria-sort={said(column)} className="min-w-32 px-3 py-2 text-right">
                  <button type="button" onClick={() => press(column)}
                    className="inline-flex items-center justify-end gap-1 text-right uppercase hover:text-ink">
                    {PORTFOLIO_ATTRIBUTES[column](ccy)} {arrow(column)}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={columns.length + 1} className="px-3 py-8 text-center text-ink-muted">Nothing held matches this view.</td></tr>
            ) : (
              rows.map((row) => draw(row, 0))
            )}
          </tbody>
          {/* The total stays in sight however far the rows are scrolled, as on the reference table. */}
          <tfoot className="sticky bottom-0 z-[1] bg-white">
            <tr className="border-t-2 border-line font-bold">
              <th scope="row" className="sticky left-0 z-[1] bg-white py-2 pr-3 pl-7 text-left">Total</th>
              {columns.map((column) => (
                <td key={column} className="px-3 py-2 text-right whitespace-nowrap">{cell(column, totalRow, true)}</td>
              ))}
            </tr>
            {benchmarks.map((one) => (
              <tr key={one.name} className="text-ink-muted">
                <th scope="row" className="sticky left-0 z-[1] bg-white py-1.5 pr-3 pl-7 text-left font-normal italic">{one.name}</th>
                {columns.map((column) => (
                  <td key={column} className="px-3 py-1.5 text-right whitespace-nowrap">{benchmarkCell(column, one.name)}</td>
                ))}
              </tr>
            ))}
          </tfoot>
        </table>
      </div>
      <p className="mt-2 shrink-0 text-xs text-ink-muted">
        Data as of {formatDate(to)}. A holding&apos;s return is its change in value; money moved into or out of it counts as
        change until trades come from the custodian feed, so below the total its TWR and absolute return read the same. The
        total&apos;s TWR leaves out money paid in or taken out; its absolute return does not. Owned assets and loans have no
        daily history.
      </p>
    </div>
  );
}

const TOTAL = "__total__";

/** The last figure of a portfolio's return line: its whole return over the stretch it was read for. */
function lastOf(ranged: ClientOverview) {
  return ranged.performance.length > 1 ? ranged.performance[ranged.performance.length - 1]!.value : null;
}

/** Each row's return over another stretch, by the row's key, the total's under TOTAL. */
function returnsOver(groupings: PortfolioGrouping[], sources: Sources, ranged: ClientOverview | undefined) {
  if (!ranged) return null;
  const found = new Map<string, number | null>();
  const walk = (rows: TreeRow[]) => rows.forEach((row) => {
    found.set(row.key, row.twr);
    walk(row.children);
  });
  walk(portfolioTree(groupings, sources, ranged));
  found.set(TOTAL, lastOf(ranged));
  return found;
}

/** The change as a share of where it started, whatever money came or went on the way. */
function absolute(gain: number | null, opening: number | null) {
  return gain === null || !opening ? null : (gain / opening) * 100;
}

function Reading() {
  return <span className="text-ink-muted/70">…</span>;
}

function Num({ value, format, signed, strong }: { value: number; format: (value: number) => string; signed?: boolean; strong?: boolean }) {
  return (
    <span className={cn("tabular-nums", value < 0 ? "text-danger" : signed && value > 0 ? "text-emerald-700" : strong ? "text-ink" : undefined)}>
      {format(value)}
    </span>
  );
}

function Unknown() {
  return <span className="text-ink-muted/70" title={NO_RETURN_BELOW_TOTAL}>—</span>;
}

/** A line over time as a sheet: a row a day, with any benchmark beside it on the days it has a figure. */
function timeSheet(points: { on: string; value: number }[], value: ReturnType<typeof col>, others: OtherLine[]): Part {
  const beside = others.map((other) => new Map(other.points.map((one) => [one.on, one.value])));
  return {
    columns: [col("Date"), value, ...others.map((other) => col(`${other.name} %`, "PERCENT"))],
    rows: points.map((one) => exportRow([one.on, one.value, ...beside.map((byDay) => byDay.get(one.on) ?? null)])),
  };
}
