import { cn } from "@atomprive/ui";
import {
  ChartArea,
  ChartBar,
  ChartColumn,
  ChartColumnBig,
  ChartColumnIncreasing,
  ChartColumnStacked,
  ChartLine,
  ChartPie,
  ChartScatter,
  Check,
  ChevronDown,
  Funnel,
  Gauge,
  Grid3x3,
  Hash,
  Network,
  LayoutGrid,
  Radar,
  Table2,
  Waypoints,
  type LucideIcon,
} from "lucide-react";
import { createContext, use, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Chart, ink } from "../book/overview-charts";
import { INK } from "../portfolios/asset-classes";
import { CardSettingsContext, type Palette } from "./card-settings";
import type { ViewLayoutState } from "./custom-view";

/**
 * The kinds of chart a card can be switched to, from the firm's list. A card offers only the kinds its figures can be
 * drawn as — shares of a whole, figures across categories or months, points with two or three measures, or one figure
 * against its target — and keeps its own look as the first of them. Every other kind redraws the card's own figures;
 * nothing is computed here beyond adding a category's series up for a waterfall.
 */
export type ChartKind =
  | "line" | "area" | "stacked-area" | "bar" | "horizontal-bar" | "grouped-bar" | "stacked-bar" | "donut" | "table"
  | "heatmap" | "gauge" | "funnel" | "radar" | "waterfall" | "mindmap" | "scatter" | "bubble"
  /** A card's own tiles, such as the Collectibles categories: only ever a card's own look, drawn by the card. */
  | "tiles"
  /** One figure written large, for a card of the reader's own. */
  | "number";

export const KIND_LABEL: Record<ChartKind, string> = {
  line: "Line",
  area: "Area",
  "stacked-area": "Stacked area",
  bar: "Bar",
  "horizontal-bar": "Horizontal bar",
  "grouped-bar": "Grouped bar",
  "stacked-bar": "Stacked bar",
  donut: "Donut",
  table: "Table",
  heatmap: "Heatmap",
  gauge: "Gauge",
  funnel: "Funnel",
  radar: "Radar",
  waterfall: "Waterfall",
  mindmap: "Mind map",
  scatter: "Scatter",
  bubble: "Bubble",
  tiles: "Tiles",
  number: "Number",
};

export const KIND_ICON: Record<ChartKind, LucideIcon> = {
  line: ChartLine,
  area: ChartArea,
  "stacked-area": ChartArea,
  bar: ChartColumn,
  "horizontal-bar": ChartBar,
  "grouped-bar": ChartColumnBig,
  "stacked-bar": ChartColumnStacked,
  donut: ChartPie,
  table: Table2,
  heatmap: Grid3x3,
  gauge: Gauge,
  funnel: Funnel,
  radar: Radar,
  waterfall: ChartColumnIncreasing,
  mindmap: Network,
  scatter: ChartScatter,
  bubble: Waypoints,
  tiles: LayoutGrid,
  number: Hash,
};

/** A card's figures in the one shape every kind is drawn from. */
export type ChartData =
  /** Parts of a whole: asset classes, currencies, custodians. */
  | { shape: "shares"; items: { name: string; value: number; colour?: string }[] }
  /** One or more figures for each category or month, such as inflows and outflows by month. */
  | { shape: "series"; categories: string[]; series: { name: string; values: (number | null)[]; colour?: string }[] }
  /** Items each measured two or three ways, such as a company's valuation against its quality. */
  | { shape: "points"; xName: string; yName: string; sizeName?: string; items: { name: string; x: number; y: number; size?: number }[] }
  /**
   * One figure against its target, such as rules passing out of all rules. {@code bands} colour the dial from
   * {@code min} up, each to where it stops, for a gauge whose break points the reader set.
   */
  | { shape: "gauge"; name: string; value: number; max: number; min?: number; target?: number | null; bands?: { to: number; colour: string }[] };

/** The kind a card is drawn as and the button that switches it, for a card that draws a chart. */
export function cardChart<Id extends string>(view: ViewLayoutState<Id>, id: Id) {
  const kinds = view.meta[id]?.charts ?? [];
  const saved = view.chart(id);
  // Read as the card draws, so Add card's preview can try a type before it is saved. React's dev tools also read the
  // card's props after drawing, when a context cannot be read; they get the saved type.
  const kind = (): ChartKind | null => {
    try {
      return use(CardSettingsContext)?.chart ?? saved;
    } catch {
      return saved;
    }
  };
  return {
    get kind() {
      return kind();
    },
    /** Whether the card is in its own look, drawn by the card itself. */
    get own() {
      const now = kind();
      return now == null || now === kinds[0];
    },
    /**
     * The switcher on the card itself: none since 13 Nov 2026 — a card's type is changed only in Customize view, so a
     * card's header carries no type button on any screen or dashboard.
     */
    picker: null as ReactNode,
  };
}

export type CardChart = ReturnType<typeof cardChart>;

/**
 * The card being drawn's chart type and switcher, handed down by the screen's grid, so a card built from shared
 * pieces (a dashboard's panel, ring or list of counts) picks them up without being handed them one by one.
 */
export const CardChartContext = createContext<CardChart | null>(null);

/** The chart type and switcher of the card being drawn; null for a card that draws no chart. */
export function useCardChart() {
  return use(CardChartContext);
}

/** The small button beside a card's title: the kind in use, and on a click the kinds this card can be drawn as. */
export function ChartPicker({ kinds, value, onChange }: { kinds: ChartKind[]; value: ChartKind; onChange: (kind: ChartKind) => void }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (event: MouseEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", key);
    };
  }, [open]);
  const Icon = KIND_ICON[value];
  return (
    <div ref={box} className="relative">
      <button type="button" onClick={() => setOpen((now) => !now)} aria-haspopup="menu" aria-expanded={open}
        aria-label={`Chart type: ${KIND_LABEL[value]}. Change it`}
        className={cn("flex items-center gap-1 rounded-lg border bg-white px-2 py-1 text-xs font-semibold whitespace-nowrap",
          open ? "border-primary-500 text-primary-700 ring-2 ring-primary-100" : "border-line text-ink-soft hover:text-ink")}>
        <Icon className="size-3.5" aria-hidden="true" />
        {KIND_LABEL[value]}
        <ChevronDown className={cn("size-3 text-ink-muted transition", open && "rotate-180")} aria-hidden="true" />
      </button>
      {open && (
        <div role="menu" aria-label="Show as" className="absolute top-full right-0 z-30 mt-1 w-52 rounded-xl border border-line bg-white p-1.5 shadow-xl">
          <p className="px-2 pt-1 pb-1 text-2xs font-bold tracking-wider text-ink-muted uppercase">Show as</p>
          {kinds.map((kind) => {
            const KindIcon = KIND_ICON[kind];
            const chosen = kind === value;
            return (
              <button key={kind} type="button" role="menuitemradio" aria-checked={chosen}
                onClick={() => {
                  onChange(kind);
                  setOpen(false);
                }}
                className={cn("flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm",
                  chosen ? "bg-primary-50 font-semibold text-primary-700" : "hover:bg-canvas")}>
                <KindIcon className={cn("size-4", chosen ? "text-primary-600" : "text-ink-muted")} aria-hidden="true" />
                {KIND_LABEL[kind]}
                {chosen && <Check className="ml-auto size-4 text-primary-600" aria-hidden="true" />}
              </button>
            );
          })}
          <p className="mt-1 border-t border-line px-2 pt-1.5 pb-0.5 text-3xs text-ink-muted">Saved to your account · every client</p>
        </div>
      )}
    </div>
  );
}

/**
 * A card's figures drawn as the kind picked. The table is the same figures as rows; every other kind is one ECharts
 * picture. A click on a slice, a bar or a category hands back its place in the figures.
 */
export function KindChart({ data, kind, format, height = 240, label, onPick }: {
  data: ChartData;
  kind: ChartKind;
  /** How a figure is written in labels, tooltips and the table. */
  format: (value: number) => string;
  height?: number;
  label: string;
  /** The item, category or point clicked, by its place in the figures. */
  onPick?: (index: number) => void;
}) {
  const palette = use(CardSettingsContext)?.palette ?? "theme";
  const option = useMemo(() => (kind === "table" || kind === "number" ? null : optionFor(data, kind, format, palette)), [data, kind, format, palette]);
  if (kind === "donut" && data.shape === "shares" && option) {
    return <DonutWithList data={data} option={option} format={format} palette={palette} label={label} onPick={onPick} />;
  }
  if (kind === "number" && data.shape === "gauge") {
    const band = data.bands?.find((one) => data.value <= one.to) ?? data.bands?.[data.bands.length - 1];
    return (
      <div className="flex min-h-32 flex-col justify-center py-4" role="img" aria-label={`${label}: ${format(data.value)}`}>
        <p className="text-4xl font-bold tabular-nums" style={band ? { color: band.colour } : undefined}>{format(data.value)}</p>
        <p className="mt-1 text-sm text-ink-muted">{data.name}{data.target != null && ` · target ${format(data.target)}`}</p>
      </div>
    );
  }
  if (kind === "table" || !option) return <FiguresTable data={data} format={format} palette={palette} onPick={onPick} />;
  const names = data.shape === "shares" || data.shape === "points" ? data.items.map((one) => one.name)
    : data.shape === "series" ? data.categories : [];
  return (
    <Chart option={option} height={height} label={label}
      onPick={onPick ? (name, index) => {
        const at = names.indexOf(name);
        // The mind map's centre is the whole, not one of its parts.
        if (kind === "mindmap" && at < 0) return;
        onPick(at >= 0 ? at : index);
      } : undefined} />
  );
}

/** Green, amber and red, for a reader who picked them over the app's own colours. */
export const TRAFFIC = ["#16a34a", "#f59e0b", "#dc2626"];

function colourOf(at: number, own?: string, palette: Palette = "theme") {
  if (palette === "traffic") return TRAFFIC[at % TRAFFIC.length]!;
  return own ?? INK[at % INK.length]!;
}

function base(format: (value: number) => string) {
  const c = ink();
  return {
    c,
    common: {
      textStyle: { fontFamily: c.font },
      tooltip: { valueFormatter: (value: number) => (value == null ? "—" : format(value)) },
    },
    axis: {
      axisLabel: { color: c.muted },
      axisLine: { lineStyle: { color: c.line } },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: c.line } },
    },
  };
}

function optionFor(data: ChartData, kind: ChartKind, format: (value: number) => string, palette: Palette): Record<string, unknown> | null {
  const { c: theme, common, axis } = base(format);
  // Green, amber and red draw gains green and losses red wherever a chart tells the two apart.
  const c = palette === "traffic" ? { ...theme, primary: TRAFFIC[0]!, danger: TRAFFIC[2]! } : theme;
  const valueAxis = { type: "value", ...axis, axisLabel: { color: c.muted, formatter: (value: number) => format(value) } };
  const legend = { top: 0, textStyle: { color: c.muted, fontSize: 11 } };

  if (data.shape === "shares") {
    const items = data.items.map((one, at) => ({ name: one.name, value: one.value, itemStyle: { color: colourOf(at, one.colour, palette) } }));
    switch (kind) {
      case "donut": {
        // The ring alone, the whole in its middle; the parts are listed beside it by the card (DonutWithList).
        const total = data.items.reduce((sum, one) => sum + one.value, 0);
        return { ...common, tooltip: { ...common.tooltip, trigger: "item" },
          series: [
            { type: "pie", radius: ["62%", "92%"], center: ["50%", "50%"], label: { show: false }, itemStyle: { borderColor: c.surface, borderWidth: 2 }, data: items },
            { type: "pie", radius: ["0%", "0%"], center: ["50%", "50%"], silent: true, tooltip: { show: false }, data: [{ name: "", value: 1 }],
              label: { show: true, position: "center", formatter: `{v|${format(total)}}\n{l|Total}`,
                rich: { v: { fontSize: 16, fontWeight: "bold", color: c.text, lineHeight: 22 }, l: { fontSize: 11, color: c.muted } } } },
          ] };
      }
      case "mindmap": {
        // The whole in the middle, a branch to each part: its name and amount at the branch's end.
        const total = data.items.reduce((sum, one) => sum + one.value, 0);
        const named = ({ name, value }: { name: string; value: number }) => `{b|${name}}\n${format(value)}`;
        return { ...common, tooltip: { ...common.tooltip, trigger: "item", formatter: ({ name, value }: { name: string; value: number }) => `${name}: ${format(value)}` },
          series: [{ type: "tree", orient: "LR", left: "14%", right: "34%", top: "4%", bottom: "4%", roam: false, expandAndCollapse: false,
            initialTreeDepth: -1, symbol: "circle", symbolSize: 11, lineStyle: { color: c.line, width: 1.5, curveness: 0.5 },
            label: { position: "left", align: "right", verticalAlign: "middle", color: c.text, fontSize: 12, lineHeight: 16, formatter: named,
              rich: { b: { fontWeight: "bold", color: c.text, fontSize: 12 } } },
            leaves: { label: { position: "right", align: "left", verticalAlign: "middle" } },
            data: [{ name: "Total", value: total, symbolSize: 15, itemStyle: { color: c.primary }, children: items }] }] };
      }
      case "funnel":
        return { ...common, tooltip: { ...common.tooltip, trigger: "item" },
          series: [{ type: "funnel", sort: "none", gap: 2, left: "10%", width: "80%", label: { color: c.text, formatter: "{b}" }, data: items }] };
      case "bar":
        return { ...common, tooltip: { ...common.tooltip, trigger: "axis" }, grid: { left: 8, right: 8, top: 12, bottom: 8, containLabel: true },
          xAxis: { type: "category", data: items.map((one) => one.name), ...axis, axisLabel: { color: c.muted, interval: 0, hideOverlap: true } },
          yAxis: valueAxis, series: [{ type: "bar", barMaxWidth: 36, data: items }] };
      case "horizontal-bar":
        return { ...common, tooltip: { ...common.tooltip, trigger: "axis" }, grid: { left: 8, right: 16, top: 8, bottom: 8, containLabel: true },
          yAxis: { type: "category", inverse: true, data: items.map((one) => one.name), ...axis },
          xAxis: valueAxis, series: [{ type: "bar", barMaxWidth: 18, data: items }] };
      default:
        return null;
    }
  }

  if (data.shape === "series") {
    const many = data.series.length > 1;
    const coloured = data.series.map((one, at) => ({ ...one, colour: colourOf(at, one.colour, palette) }));
    const grid = { left: 8, right: 12, top: many ? 28 : 12, bottom: 8, containLabel: true };
    const category = { type: "category", data: data.categories, ...axis, splitLine: { show: false } };
    const lines = (area: boolean, stack: boolean) => coloured.map((one) => ({
      type: "line", name: one.name, data: one.values, showSymbol: false, connectNulls: true, stack: stack ? "all" : undefined,
      lineStyle: { color: one.colour, width: 1.5 }, itemStyle: { color: one.colour },
      areaStyle: area ? { color: one.colour, opacity: stack ? 0.55 : 0.18 } : undefined,
    }));
    // A lone series of gains and losses shows its losses in red.
    const bars = (stack: boolean) => coloured.map((one) => ({
      type: "bar", name: one.name, data: one.values, stack: stack ? "all" : undefined, barMaxWidth: 32,
      itemStyle: { color: many ? one.colour : ({ value }: { value: number }) => (value < 0 ? c.danger : one.colour) },
    }));
    switch (kind) {
      case "line":
      case "area":
      case "stacked-area":
        return { ...common, tooltip: { ...common.tooltip, trigger: "axis" }, legend: many ? legend : undefined, grid,
          xAxis: { ...category, boundaryGap: false }, yAxis: valueAxis, series: lines(kind !== "line", kind === "stacked-area") };
      case "bar":
      case "grouped-bar":
      case "stacked-bar":
        return { ...common, tooltip: { ...common.tooltip, trigger: "axis" }, legend: many ? legend : undefined, grid,
          xAxis: category, yAxis: valueAxis, series: bars(kind === "stacked-bar") };
      case "horizontal-bar":
        return { ...common, tooltip: { ...common.tooltip, trigger: "axis" }, legend: many ? legend : undefined, grid: { ...grid, right: 16 },
          yAxis: { ...category, inverse: true }, xAxis: valueAxis, series: bars(false) };
      case "waterfall": {
        // Each category's series added up, walked from zero; the last bar is where the walk ends.
        const steps = data.categories.map((name, at) => ({ name, value: coloured.reduce((sum, one) => sum + (one.values[at] ?? 0), 0) }));
        let running = 0;
        const under: number[] = [];
        const bar: { value: number; itemStyle: { color: string } }[] = [];
        for (const step of steps) {
          const next = running + step.value;
          under.push(Math.min(running, next));
          bar.push({ value: Math.abs(step.value), itemStyle: { color: step.value >= 0 ? c.primary : c.danger } });
          running = next;
        }
        under.push(Math.min(0, running));
        bar.push({ value: Math.abs(running), itemStyle: { color: c.text } });
        return { ...common, tooltip: { trigger: "axis", axisPointer: { type: "shadow" },
            formatter: (points: { dataIndex: number }[]) => {
              const at = points[0]?.dataIndex ?? 0;
              return at < steps.length ? `${steps[at]!.name}: ${format(steps[at]!.value)}` : `Total: ${format(running)}`;
            } },
          grid, xAxis: { ...category, data: [...data.categories, "Total"] }, yAxis: valueAxis,
          series: [
            { type: "bar", stack: "walk", data: under, itemStyle: { color: "transparent" }, emphasis: { disabled: true }, silent: true },
            { type: "bar", stack: "walk", data: bar, barMaxWidth: 32 },
          ] };
      }
      case "radar": {
        const all = coloured.flatMap((one) => one.values).filter((value): value is number => value != null);
        const low = Math.min(0, ...all);
        const high = Math.max(...all, 0) * 1.1 || 1;
        return { ...common, tooltip: { trigger: "item" }, legend: many ? legend : undefined,
          radar: { radius: "62%", center: ["50%", many ? "56%" : "52%"], indicator: data.categories.map((name) => ({ name, min: low, max: high })),
            axisName: { color: c.muted, fontSize: 11 }, splitLine: { lineStyle: { color: c.line } }, axisLine: { lineStyle: { color: c.line } }, splitArea: { show: false } },
          series: [{ type: "radar", data: coloured.map((one) => ({ name: one.name, value: one.values.map((value) => value ?? 0),
            lineStyle: { color: one.colour }, itemStyle: { color: one.colour }, areaStyle: { color: one.colour, opacity: 0.12 } })) }] };
      }
      case "heatmap": {
        const cells = coloured.flatMap((one, row) => one.values.map((value, column) => ({ name: data.categories[column], value: [column, row, value ?? "-"] })));
        const all = coloured.flatMap((one) => one.values).filter((value): value is number => value != null);
        const widest = Math.max(0.01, ...all.map(Math.abs));
        const signedValues = all.some((value) => value < 0);
        return { ...common, tooltip: { trigger: "item", formatter: ({ value }: { value: [number, number, number] }) =>
            `${coloured[value[1]]?.name} · ${data.categories[value[0]]}: ${typeof value[2] === "number" ? format(value[2]) : "—"}` },
          grid: { left: 8, right: 8, top: 8, bottom: 40, containLabel: true },
          xAxis: { ...category, splitArea: { show: false } }, yAxis: { type: "category", data: coloured.map((one) => one.name), ...axis, splitLine: { show: false } },
          visualMap: { min: signedValues ? -widest : 0, max: widest, calculable: false, orient: "horizontal", left: "center", bottom: 0, itemHeight: 120, itemWidth: 10,
            text: [format(widest), format(signedValues ? -widest : 0)], textStyle: { color: c.muted, fontSize: 10 },
            inRange: { color: signedValues ? [c.danger, c.surface, c.primary] : [c.surface, c.primary] } },
          series: [{ type: "heatmap", data: cells, label: { show: data.categories.length * coloured.length <= 60, fontSize: 10, color: c.text,
            formatter: ({ value }: { value: [number, number, number] }) => (typeof value[2] === "number" ? format(value[2]) : "") },
            itemStyle: { borderColor: c.surface, borderWidth: 2 } }] };
      }
      default:
        return null;
    }
  }

  if (data.shape === "points") {
    const sizes = data.items.map((one) => one.size ?? 0);
    const largest = Math.max(1, ...sizes.map(Math.abs));
    return { ...common,
      tooltip: { trigger: "item", formatter: ({ dataIndex }: { dataIndex: number }) => {
        const one = data.items[dataIndex]!;
        return `<b>${one.name}</b><br/>${data.xName}: ${one.x.toFixed(2)}<br/>${data.yName}: ${one.y.toFixed(2)}${one.size != null && data.sizeName ? `<br/>${data.sizeName}: ${format(one.size)}` : ""}`;
      } },
      grid: { left: 8, right: 16, top: 16, bottom: 24, containLabel: true },
      xAxis: { type: "value", name: data.xName, nameLocation: "middle", nameGap: 24, nameTextStyle: { color: c.muted, fontSize: 11 }, scale: true, ...axis },
      yAxis: { type: "value", name: data.yName, nameTextStyle: { color: c.muted, fontSize: 11 }, scale: true, ...axis },
      series: [{ type: "scatter", data: data.items.map((one, at) => ({ name: one.name, value: [one.x, one.y],
        symbolSize: kind === "bubble" ? 8 + (Math.abs(sizes[at] ?? 0) / largest) * 34 : 10, itemStyle: { color: c.primary, opacity: kind === "bubble" ? 0.6 : 0.85 } })) }] };
  }

  // One figure against its target.
  if (kind === "gauge") {
    const low = data.min ?? 0;
    const span = data.max - low || 1;
    // With break points the dial is coloured band by band and a needle points at the figure; without, it fills.
    const banded = data.bands?.length
      ? data.bands.map((one) => [Math.min(1, Math.max(0, (one.to - low) / span)), one.colour] as [number, string])
      : null;
    return { ...common,
      series: [{ type: "gauge", min: low, max: data.max, startAngle: 210, endAngle: -30, radius: "92%", center: ["50%", "58%"],
        progress: { show: !banded, width: 14, itemStyle: { color: c.primary } },
        axisLine: { lineStyle: { width: 14, color: banded ?? [[1, c.line]] } },
        axisTick: { show: false }, splitLine: { show: false }, axisLabel: { show: false },
        pointer: banded ? { show: true, length: "62%", width: 4, itemStyle: { color: c.text } } : { show: false },
        anchor: { show: false }, title: { offsetCenter: [0, "38%"], color: c.muted, fontSize: 12 },
        detail: { valueAnimation: true, offsetCenter: [0, "0%"], fontSize: 26, fontWeight: 700, color: c.text, formatter: (value: number) => format(value) },
        data: [{ value: data.value, name: data.target != null ? `${data.name} · target ${format(data.target)}` : data.name }] }] };
  }
  if (kind === "bar") {
    const items = [{ name: data.name, value: data.value }, ...(data.target != null ? [{ name: "Target", value: data.target }] : []), { name: "Most", value: data.max }];
    return { ...common, tooltip: { ...common.tooltip, trigger: "axis" }, grid: { left: 8, right: 8, top: 12, bottom: 8, containLabel: true },
      xAxis: { type: "category", data: items.map((one) => one.name), ...axis }, yAxis: valueAxis,
      series: [{ type: "bar", barMaxWidth: 40, data: items.map((one, at) => ({ value: one.value, itemStyle: { color: at === 0 ? c.primary : c.neutral } })) }] };
  }
  return null;
}

/** The same figures as rows: what a person reads exact numbers from, or copies. */
/**
 * A donut as the screens draw their own: the ring on the left with the whole in its middle, and beside it every part
 * on a line of its own — its colour, name, share and amount — filling the card's width, however wide it is.
 */
function DonutWithList({ data, option, format, palette, label, onPick }: {
  data: Extract<ChartData, { shape: "shares" }>;
  option: Record<string, unknown>;
  format: (value: number) => string;
  palette: Palette;
  label: string;
  onPick?: (index: number) => void;
}) {
  const total = data.items.reduce((sum, one) => sum + one.value, 0);
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3 py-1">
      <div className="w-40 shrink-0">
        <Chart option={option} height={160} label={label} onPick={onPick ? (_, index) => onPick(index) : undefined} />
      </div>
      <ul className="min-w-52 flex-1 divide-y divide-line text-sm">
        {data.items.map((one, at) => {
          const row = (
            <>
              <span className="size-2.5 shrink-0 rounded-full" style={{ background: colourOf(at, one.colour, palette) }} aria-hidden="true" />
              <span className="min-w-0 flex-1">{one.name}</span>
              {total > 0 && <span className="text-xs text-ink-muted tabular-nums">{((one.value / total) * 100).toFixed(1)}%</span>}
              <b className="w-20 text-right tabular-nums">{format(one.value)}</b>
            </>
          );
          return (
            <li key={one.name}>
              {onPick ? <button type="button" onClick={() => onPick(at)} className="flex w-full items-center gap-2.5 py-1.5 text-left hover:text-primary-700">{row}</button>
                : <div className="flex items-center gap-2.5 py-1.5">{row}</div>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function FiguresTable({ data, format, palette, onPick }: {
  data: ChartData;
  format: (value: number) => string;
  palette: Palette;
  onPick?: (index: number) => void;
}) {
  const row = (at: number, cells: ReactNode) => (
    <tr key={at} className={cn(onPick && "cursor-pointer hover:bg-canvas")} onClick={onPick ? () => onPick(at) : undefined}>{cells}</tr>
  );
  const head = (names: string[]) => (
    <thead>
      <tr className="border-b border-line text-left text-2xs font-semibold tracking-wider whitespace-nowrap text-ink-muted uppercase">
        {names.map((name, at) => <th key={name + at} scope="col" className={cn("py-1.5", at === 0 ? "pr-2" : "px-2 text-right")}>{name}</th>)}
      </tr>
    </thead>
  );
  let body: ReactNode;
  let header: ReactNode;
  if (data.shape === "shares") {
    const total = data.items.reduce((sum, one) => sum + one.value, 0);
    header = head(["Name", "Value", "Share"]);
    body = data.items.map((one, at) => row(at, (
      <>
        <td className="py-1.5 pr-2">
          <span className="flex items-center gap-2"><span className="size-2.5 rounded-xs" style={{ background: colourOf(at, one.colour, palette) }} aria-hidden="true" />{one.name}</span>
        </td>
        <td className="px-2 py-1.5 text-right font-semibold">{format(one.value)}</td>
        <td className="px-2 py-1.5 text-right text-ink-muted">{total ? `${((one.value / total) * 100).toFixed(1)}%` : "—"}</td>
      </>
    )));
  } else if (data.shape === "series") {
    header = head(["", ...data.series.map((one) => one.name)]);
    body = data.categories.map((name, at) => row(at, (
      <>
        <td className="py-1.5 pr-2 font-medium">{name}</td>
        {data.series.map((one) => (
          <td key={one.name} className="px-2 py-1.5 text-right">{one.values[at] == null ? "—" : format(one.values[at]!)}</td>
        ))}
      </>
    )));
  } else if (data.shape === "points") {
    header = head(["Name", data.xName, data.yName, ...(data.sizeName ? [data.sizeName] : [])]);
    body = data.items.map((one, at) => row(at, (
      <>
        <td className="py-1.5 pr-2 font-medium">{one.name}</td>
        <td className="px-2 py-1.5 text-right">{one.x.toFixed(2)}</td>
        <td className="px-2 py-1.5 text-right">{one.y.toFixed(2)}</td>
        {data.sizeName && <td className="px-2 py-1.5 text-right">{one.size == null ? "—" : format(one.size)}</td>}
      </>
    )));
  } else {
    header = head(["", "Value"]);
    body = [
      row(0, <><td className="py-1.5 pr-2 font-medium">{data.name}</td><td className="px-2 py-1.5 text-right font-semibold">{format(data.value)}</td></>),
      ...(data.target != null ? [row(1, <><td className="py-1.5 pr-2 font-medium">Target</td><td className="px-2 py-1.5 text-right">{format(data.target)}</td></>)] : []),
    ];
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm tabular-nums">
        {header}
        <tbody className="divide-y divide-line">{body}</tbody>
      </table>
    </div>
  );
}
