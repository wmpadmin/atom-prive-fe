import type { LinePoint } from "@atomprive/api-client/backoffice";
import { BarChart, FunnelChart, GaugeChart, HeatmapChart, LineChart as LineSeries, PieChart, RadarChart, ScatterChart, TreeChart } from "echarts/charts";
import { DataZoomComponent, GridComponent, LegendComponent, RadarComponent, TooltipComponent, VisualMapComponent } from "echarts/components";
import * as echarts from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import { cn } from "@atomprive/ui";
import { useEffect, useMemo, useRef } from "react";
import { formatDate } from "../../lib/labels";
import { axisMoney } from "./book-figures";
import { INK, inkFor } from "../portfolios/asset-classes";
import type { Row } from "./overview-data";
import type { ChartType } from "./overview-model";

// The kinds a card can be switched to (layout/chart-kinds) need mind maps (trees), funnels, radars, heatmaps, gauges and scatters too.
echarts.use([LineSeries, BarChart, PieChart, TreeChart, FunnelChart, RadarChart, HeatmapChart, GaugeChart, ScatterChart,
  GridComponent, TooltipComponent, DataZoomComponent, LegendComponent, RadarComponent, VisualMapComponent, CanvasRenderer]);

/**
 * The platform's own colours, read off the theme rather than written in here, so a chart is drawn in the
 * same ink as the page around it — light or dark — and changes when the theme does.
 */
function token(name: string, fallback: string) {
  if (typeof document === "undefined") return fallback;
  return plain(getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback);
}

let pixel: CanvasRenderingContext2D | null | undefined;

/**
 * Any CSS colour as rgba(). The light theme's Tailwind colours are oklch(), which ECharts cannot read: it draws them
 * at rest but loses them when it lightens a bar under the pointer, so the bar vanished on hover. Painting one pixel
 * and reading it back turns whatever the browser understands into figures ECharts does.
 */
function plain(colour: string) {
  if (colour.startsWith("#") || colour.startsWith("rgb")) return colour;
  if (pixel === undefined) pixel = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
  if (!pixel) return colour;
  pixel.clearRect(0, 0, 1, 1);
  pixel.fillStyle = colour;
  pixel.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = pixel.getImageData(0, 0, 1, 1).data;
  return `rgba(${r}, ${g}, ${b}, ${Math.round((a / 255) * 100) / 100})`;
}

export function ink() {
  return {
    font: typeof document === "undefined" ? "sans-serif" : getComputedStyle(document.body).fontFamily,
    text: token("--color-ink", "#0f172a"),
    muted: token("--color-ink-muted", "#64748b"),
    line: token("--color-line", "#e3e9f1"),
    canvas: token("--color-canvas", "#edf2f8"),
    surface: token("--color-white", "#ffffff"),
    primary: token("--color-primary-600", "#1d6ee8"),
    primarySoft: token("--color-primary-100", "#d8e5fb"),
    danger: token("--color-red-500", "#ef4444"),
    neutral: token("--color-slate-300", "#cbd5e1"),
    owned: token("--color-access-view", "#f28a1c"),
  };
}
/** A circle, the handle the reference slider is dragged by. */
const HANDLE =
  "path://M514.048 128q79.872 0 149.504 30.208t121.856 82.432 82.432 122.368 30.208 150.016q0 78.848-30.208 148.48t-82.432 121.856-121.856 82.432-149.504 30.208-149.504-30.208-121.856-82.432-82.432-121.856-30.208-148.48q0-79.872 30.208-150.016t82.432-122.368 121.856-82.432 149.504-30.208z";

/**
 * Every chart's tooltip in the page's own panel colours — the panel, its border and the ink, so dark on the dark
 * theme and light on the light — rather than ECharts' own white box. A chart that styles its tooltip keeps its own.
 */
function themedTooltip(option: echarts.EChartsCoreOption): echarts.EChartsCoreOption {
  const tooltip = (option as { tooltip?: unknown }).tooltip;
  if (!tooltip || Array.isArray(tooltip) || typeof tooltip !== "object") return option;
  const c = ink();
  const own = tooltip as Record<string, unknown>;
  return {
    ...option,
    tooltip: {
      backgroundColor: c.surface,
      borderColor: c.line,
      extraCssText: "box-shadow: 0 4px 14px rgba(0, 0, 0, 0.25);",
      ...own,
      textStyle: { color: c.text, fontFamily: c.font, ...(own.textStyle as Record<string, unknown> | undefined) },
    },
  };
}

/** One ECharts canvas, sized by its box and redrawn whenever its option changes. */
/** @param height in pixels, or nothing to fill whatever panel the chart is in */
export function Chart({ option, height, label, onPick }: {
  option: echarts.EChartsCoreOption;
  height?: number;
  label: string;
  /** Called with the clicked slice, bar or point: its name and place in its series. */
  onPick?: (name: string, index: number) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const chart = useRef<echarts.ECharts | null>(null);
  const picked = useRef(onPick);
  picked.current = onPick;

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const drawn = echarts.init(el, undefined, { renderer: "canvas" });
    chart.current = drawn;
    drawn.on("click", (event) => picked.current?.(String(event.name), event.dataIndex));
    // A line hides its points, and a bar near zero is a sliver: a click anywhere over a category of the plot picks it.
    drawn.getZr().on("click", (event) => {
      if (event.target || !picked.current || !drawn.containPixel("grid", [event.offsetX, event.offsetY])) return;
      const at = drawn.convertFromPixel({ gridIndex: 0 }, [event.offsetX, event.offsetY]);
      const index = Array.isArray(at) ? Math.round(at[0]!) : null;
      const axis = (drawn.getOption() as { xAxis?: { type?: string; data?: unknown[] }[] }).xAxis?.[0];
      if (axis?.type !== "category" || typeof index !== "number" || !axis.data?.[index]) return;
      const name = axis.data[index];
      picked.current(String(typeof name === "object" && name && "value" in name ? (name as { value: unknown }).value : name), index);
    });
    const watching = new ResizeObserver(() => drawn.resize());
    watching.observe(el);
    return () => {
      watching.disconnect();
      drawn.dispose();
      chart.current = null;
    };
  }, []);

  useEffect(() => {
    chart.current?.setOption(themedTooltip(option), true);
  }, [option]);

  return <div ref={box} role="img" aria-label={label} style={height ? { height } : undefined}
    className={cn("w-full", !height && "h-full min-h-40", onPick && "cursor-pointer")} />;
}

/** A second line drawn beside the first, such as a benchmark. */
export type OtherLine = { name: string; points: LinePoint[] };

/**
 * Something over time — as a line with its last figure printed at its end, or as columns — with the slider
 * under it for narrowing the stretch in view. Benchmarks, where asked for, are drawn as further lines.
 */
export function TimeChart({
  points,
  label,
  axisTitle,
  format,
  columns,
  others = [],
  axisFormat = format,
}: {
  points: LinePoint[];
  /** What the line is, for a reader who cannot see it. */
  label: string;
  /** Printed above the axis, as TWR is on the reference screen. */
  axisTitle: string;
  format: (value: number) => string;
  /** Columns rather than a line, for figures that are each a day's or a month's own. */
  columns?: boolean;
  others?: OtherLine[];
  /** The value axis's labels, where they need finer steps than the figures the tooltip and the end show. */
  axisFormat?: (value: number) => string;
}) {
  // Built once per set of points rather than on every render: a fresh option is a fresh chart, and the
  // slider would spring back to the whole period whenever anything else on the page drew again.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- format follows axisTitle, which is listed
  const option = useMemo(() => timeOption(points, label, axisTitle, format, axisFormat, Boolean(columns), others), [points, axisTitle, columns, others]);
  if (points.length < (columns ? 1 : 2) || !option) {
    return (
      <div className="grid h-full place-items-center text-sm text-ink-muted">
        {columns ? "Nothing on file in these dates." : "Two days of valuations are needed to draw a line."}
      </div>
    );
  }
  const first = points[0]!;
  const last = points[points.length - 1]!;
  return (
    <Chart
      option={option}
      label={`${label}: ${format(first.value)} on ${formatDate(first.on)}, ${format(last.value)} on ${formatDate(last.on)}`}
    />
  );
}

/** The single-line chart the performance panel draws. */
export function LineChart(props: {
  points: LinePoint[];
  label: string;
  axisTitle: string;
  format: (value: number) => string;
  axisFormat?: (value: number) => string;
  others?: OtherLine[];
}) {
  return <TimeChart {...props} />;
}

function timeOption(points: LinePoint[], label: string, axisTitle: string, format: (value: number) => string,
  axisFormat: (value: number) => string, columns: boolean, others: OtherLine[]) {
  if (points.length < (columns ? 1 : 2)) return null;
  const last = points[points.length - 1]!;
  const c = ink();
  const axisText = { color: c.muted, fontSize: 11, fontFamily: c.font };
  const gridLine = { lineStyle: { color: c.line, type: "dashed" as const, width: 1 } };
  const option: echarts.EChartsCoreOption = {
    animation: false,
    textStyle: { fontFamily: c.font, fontSize: 12 },
    legend: others.length
      ? { top: 0, right: 0, itemWidth: 14, itemHeight: 3, textStyle: { color: c.muted, fontFamily: c.font, fontSize: 11 } }
      : { show: false },
    // Wider on the right than the reference grid, whose end label sits in the space its time axis leaves
    // after the last day; ours ends on the last day, so the label needs the room here.
    grid: { left: 20, right: 52, top: others.length ? 40 : 28, bottom: 34, containLabel: true },
    tooltip: {
      trigger: "axis",
      confine: true,
      backgroundColor: c.surface,
      borderColor: c.line,
      borderWidth: 1,
      borderRadius: 8,
      textStyle: { color: c.text, fontSize: 13, fontFamily: c.font },
      axisPointer: { type: columns ? "shadow" : "line", lineStyle: { color: c.muted, type: "dashed" } },
      formatter: (params: { seriesName: string; value: [string, number] }[]) => {
        const day = params[0]?.value?.[0];
        if (!day) return "";
        const lines = params.map((one) => `${params.length > 1 ? `${one.seriesName}: ` : ""}<b>${format(one.value[1])}</b>`);
        return `${formatDate(day)}<br/>${lines.join("<br/>")}`;
      },
    },
    xAxis: {
      type: "time",
      boundaryGap: columns ? ["2%", "2%"] : false,
      splitNumber: 4,
      axisLabel: { ...axisText, showMinLabel: false, showMaxLabel: false, hideOverlap: true, rich: { primary: { fontWeight: "bold", fontSize: 12, color: c.text } } },
      axisLine: { lineStyle: { color: c.line, width: 2 } },
      axisTick: { show: false },
      splitLine: { show: false },
    },
    yAxis: {
      type: "value",
      name: axisTitle,
      nameLocation: "end",
      nameGap: 12,
      nameTextStyle: { color: c.muted, fontSize: 11, fontWeight: "bold", align: "right", fontFamily: c.font },
      splitNumber: 4,
      // A worth is read for how it moved, so its axis sits close to the line rather than starting at nought,
      // which flattened a 2% move into a ruler. A return keeps nought on the axis: whether it is above or
      // below nought is the point of it, and so do columns, whose height is their size.
      scale: !columns && axisTitle !== "TWR" && axisTitle !== "%",
      axisLabel: { ...axisText, formatter: (value: number) => axisFormat(value) },
      splitLine: gridLine,
    },
    dataZoom: [
      {
        type: "slider",
        bottom: 2,
        height: 16,
        backgroundColor: c.canvas,
        borderColor: c.canvas,
        borderRadius: 6,
        brushSelect: false,
        fillerColor: hexAlpha(c.primary, 0.12),
        dataBackground: { areaStyle: { color: c.primary, opacity: 0.12 }, lineStyle: { opacity: 0, width: 0.5 } },
        selectedDataBackground: { areaStyle: { color: c.primary, opacity: 0.35 }, lineStyle: { opacity: 0, width: 0.5 } },
        handleIcon: HANDLE,
        handleSize: "100%",
        handleStyle: { color: c.surface, borderColor: c.line, shadowBlur: 2, shadowColor: "rgba(15, 23, 42, 0.2)", shadowOffsetY: 1 },
        moveHandleSize: 7,
        moveHandleStyle: { color: c.line, opacity: 0.9 },
        emphasis: { handleStyle: { borderColor: c.primary }, moveHandleStyle: { color: c.primary } },
        textStyle: { color: c.muted, fontFamily: c.font },
        labelFormatter: (value: number) => formatDate(new Date(value).toISOString().slice(0, 10)),
        filterMode: "filter",
        start: 0,
        end: 100,
      },
    ],
    series: [
      columns
        ? {
            name: label,
            type: "bar",
            barMaxWidth: 18,
            data: points.map((one) => ({
              value: [one.on, one.value],
              itemStyle: { color: one.value < 0 ? c.danger : c.primary, borderRadius: 2 },
            })),
          }
        : {
            name: label,
            type: "line",
            // Straight from close to close, as the reference chart draws it: a smoothed curve bulges between
            // closes, and a bulge reads as a rise or a fall that never happened.
            symbol: "rect",
            symbolSize: 2,
            showSymbol: false,
            sampling: "none",
            color: c.primary,
            lineStyle: { width: 2 },
            areaStyle: {
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: hexAlpha(c.primary, 0.04) },
                { offset: 1, color: hexAlpha(c.primary, 0.16) },
              ]),
            },
            endLabel: { show: true, color: c.muted, fontFamily: c.font, distance: 8, formatter: () => format(last.value) },
            data: points.map((one) => [one.on, one.value]),
          },
      ...others.map((other, index) => ({
        name: other.name,
        type: "line",
        showSymbol: false,
        color: INK[(index + 2) % INK.length],
        lineStyle: { width: 1.5, type: "dashed" as const },
        data: other.points.map((one) => [one.on, one.value]),
      })),
    ],
  };
  return option;
}

/** The colour a row of a broken-down chart wears: an asset class its own, anything else by position. */
function colourFor(row: Row, index: number, classes: { code: string }[], c: ReturnType<typeof ink>) {
  // Others and what is not broken down are the neutral; what is owned outright wears a colour of its own, so
  // it is never confused with Others when both are on one ring.
  if (row.key === "OTHERS" || row.key.startsWith("—")) return c.neutral;
  if (row.key === "OWNED_OUTRIGHT") return c.owned;
  if (classes.some((one) => one.code === row.key)) return inkFor(row.key, classes);
  return INK[index % INK.length]!;
}

/**
 * Something broken down — by asset class, sector, country — drawn as the chart type the PM chose.
 *
 * <p>Every type carries the figures in words as well as in shape: the pie's legend, the list's amounts, the
 * bars' tooltips. A slice is never told apart by colour alone.
 */
export function CategoryChart({ rows, type, format, axisFormat = format, classes, label, ring }: {
  rows: Row[];
  type: ChartType;
  format: (value: number) => string;
  /** The value axis's labels on columns and bars, short where the figures beside them are written in full. */
  axisFormat?: (value: number) => string;
  classes: { code: string }[];
  label: string;
  /** For a pie drawn larger: the total written in the ring, and each slice's amount beside its share. */
  ring?: { size: number; centre: string; amount: (value: number) => string };
}) {
  const c = ink();
  if (rows.length === 0) {
    return <p className="grid h-full place-items-center py-6 text-center text-sm text-ink-muted">Nothing to show for these choices.</p>;
  }
  if (type === "PIE") return <Pie rows={rows} format={format} classes={classes} label={label} ring={ring} />;
  if (type === "LIST") {
    const largest = Math.max(...rows.map((one) => Math.abs(one.value)), 1);
    return (
      <ol className="flex h-full flex-col gap-4 overflow-y-auto">
        {rows.map((one, index) => (
          <li key={one.key} className="grid grid-cols-[1.25rem_1fr_auto] items-center gap-x-2 gap-y-1.5 text-sm">
            <span className="row-span-2 self-center text-ink-muted tabular-nums">{index + 1}</span>
            <span className="min-w-0 truncate font-medium text-ink" title={one.detail ? `${one.label} · ${one.detail}` : one.label}>{one.label}</span>
            <span className={cn("font-semibold tabular-nums", one.value < 0 ? "text-danger" : "text-ink")}>{format(one.value)}</span>
            <span aria-hidden="true" className="col-span-2 col-start-2 h-1 rounded-full bg-canvas">
              <span className={cn("block h-full rounded-full", one.value < 0 ? "bg-red-500" : "bg-primary-600")}
                style={{ width: `${(Math.abs(one.value) / largest) * 100}%` }} />
            </span>
          </li>
        ))}
      </ol>
    );
  }
  if (type === "TABLE") {
    return (
      <div className="h-full overflow-auto">
        <table className="min-w-full text-sm">
          <caption className="sr-only">{label}</caption>
          <tbody>
            {rows.map((one) => (
              <tr key={one.key} className="border-b border-line last:border-b-0">
                <th scope="row" className="py-2 pr-3 text-left font-medium">
                  {one.label}
                  {one.detail && <span className="block text-xs font-normal text-ink-muted">{one.detail}</span>}
                </th>
                <td className={cn("py-2 text-right font-semibold tabular-nums", one.value < 0 ? "text-danger" : "text-ink")}>{format(one.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  const across = type === "BAR";
  const axisText = { color: c.muted, fontSize: 11, fontFamily: c.font };
  const names = rows.map((one) => one.label);
  const option: echarts.EChartsCoreOption = {
    animation: false,
    grid: { left: "3%", right: "6%", top: 16, bottom: 0, containLabel: true },
    tooltip: {
      trigger: "item",
      backgroundColor: c.surface,
      borderColor: c.line,
      textStyle: { color: c.text, fontSize: 13, fontFamily: c.font },
      formatter: (item: { name: string; value: number }) => `${item.name}<br/><b>${format(item.value)}</b>`,
    },
    [across ? "yAxis" : "xAxis"]: {
      type: "category",
      data: names,
      inverse: across,
      axisLabel: across
        ? { ...axisText, width: 110, overflow: "truncate" }
        : { ...axisText, rotate: 45, interval: 0, width: 56, overflow: "break" },
      axisLine: { show: true, lineStyle: { color: c.line, width: 1 } },
      axisTick: { show: false },
    },
    [across ? "xAxis" : "yAxis"]: {
      type: "value",
      splitNumber: 4,
      axisLabel: { ...axisText, formatter: (value: number) => axisFormat(value) },
      splitLine: { lineStyle: { color: c.line, type: "dashed" as const, width: 1 } },
    },
    series: [
      {
        type: "bar",
        barMaxWidth: across ? 14 : "15%",
        // Rises in the platform's blue, falls in its red, so which way it went is said by colour as well as
        // by which side of nought the bar is on.
        data: rows.map((one) => ({ value: one.value, itemStyle: { color: one.value < 0 ? c.danger : c.primary, borderRadius: 2 } })),
      },
    ],
  };
  return <Chart option={option} label={`${label}: ${rows.map((one) => `${one.label} ${format(one.value)}`).join(", ")}`} />;
}

/** The three largest and everything else as Others, as a ring with its legend beside it. */
function Pie({ rows, format, classes, label, ring }: {
  rows: Row[];
  format: (value: number) => string;
  classes: { code: string }[];
  label: string;
  ring?: { size: number; centre: string; amount: (value: number) => string };
}) {
  const c = ink();
  const sorted = rows.filter((one) => one.value > 0);
  const shown: Row[] =
    sorted.length <= 4
      ? sorted
      : [...sorted.slice(0, 3), { key: "OTHERS", label: "Others", value: sorted.slice(3).reduce((sum, one) => sum + one.value, 0) }];
  const total = shown.reduce((sum, one) => sum + one.value, 0) || 1;
  const colours = shown.map((one, index) => colourFor(one, index, classes, c));
  const option: echarts.EChartsCoreOption = {
    animation: false,
    tooltip: {
      trigger: "item",
      confine: true,
      backgroundColor: c.surface,
      borderColor: c.line,
      borderRadius: 8,
      textStyle: { color: c.text, fontSize: 13, fontFamily: c.font },
      formatter: (item: { marker: string; name: string; value: number; percent: number }) =>
        `${item.marker}${item.name}&nbsp;&nbsp;<b>${item.percent.toFixed(2)}%</b><br/><span style="color:${c.muted}">${format(item.value)}</span>`,
    },
    series: [
      {
        type: "pie",
        radius: ring ? ["62%", "92%"] : ["50%", "86%"],
        center: ["50%", "50%"],
        label: { show: false },
        labelLine: { show: false },
        emphasis: { scale: true, scaleSize: 5 },
        itemStyle: { borderWidth: 2, borderColor: c.surface, borderJoin: "round" },
        data: shown.map((one, index) => ({ name: one.label, value: one.value, itemStyle: { color: colours[index] } })),
      },
    ],
  };
  return (
    // Under the title rather than centred in the panel, with the legend spread down the side of the ring and
    // each share beside its name, as the reference panel lays it out.
    <div className={cn("flex gap-6", ring ? "flex-col items-center @md:flex-row" : "items-start")}>
      {ring ? (
        <div className="relative shrink-0" style={{ width: ring.size }}>
          <Chart option={option} height={ring.size} label={`${label}: ${shown.map((one) => `${one.label} ${((one.value / total) * 100).toFixed(2)}%`).join(", ")}`} />
          <p className="pointer-events-none absolute inset-0 grid place-content-center text-center text-sm leading-tight font-bold text-ink">
            {ring.centre.split(" ").map((part) => <span key={part}>{part}</span>)}
          </p>
        </div>
      ) : (
        <div className="w-[38%] max-w-[128px] shrink-0">
          <Chart option={option} height={128} label={`${label}: ${shown.map((one) => `${one.label} ${((one.value / total) * 100).toFixed(2)}%`).join(", ")}`} />
        </div>
      )}
      <ul className={cn("flex min-w-0 flex-1 flex-col justify-around text-sm", ring ? "w-full divide-y divide-line @md:h-[var(--ring)]" : "h-[128px] max-w-72")}
        style={ring ? ({ "--ring": `${ring.size}px` } as React.CSSProperties) : undefined}>
        {shown.map((one, index) => (
          <li key={one.key} className="flex items-center gap-2">
            <span aria-hidden="true" className="size-3 shrink-0 rounded-sm" style={{ backgroundColor: colours[index] }} />
            <span className={cn("min-w-0 flex-1 text-ink-soft", ring && "truncate py-1.5")} title={one.label}>{one.label}</span>
            <span className="font-semibold text-ink tabular-nums" title={format(one.value)}>
              {((one.value / total) * 100).toFixed(2)}%
            </span>
            {ring && <span className="w-24 shrink-0 text-right whitespace-nowrap text-ink-soft tabular-nums">{ring.amount(one.value)}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** One bar of a waterfall: a total standing on the floor, or a step from the running total. */
export type Step = { label: string; value: number | null; total?: boolean };

/**
 * How a value got from one figure to another, as the reference Explainer draws it: the first and last totals
 * stand on the floor and each step between them floats from where the one before it ended, all in one ink and
 * on an axis from nought. A step's figure is read by pointing at it; one we cannot say yet is not drawn.
 */
export function WaterfallChart({ steps, format, label }: { steps: Step[]; format: (value: number) => string; label: string }) {
  const option = useMemo(() => {
    const c = ink();
    // Each step starts where the one before it ended; a total starts afresh from the floor.
    const bars = steps.reduce<{ base: number; size: number; to: number }[]>((drawn, step) => {
      const from = drawn.length ? drawn[drawn.length - 1]!.to : 0;
      if (step.total) {
        const at = step.value ?? 0;
        return [...drawn, { base: 0, size: at, to: at }];
      }
      const to = from + (step.value ?? 0);
      return [...drawn, { base: Math.min(from, to), size: Math.abs(step.value ?? 0), to }];
    }, []);
    const axisText = { color: c.muted, fontSize: 11, fontFamily: c.font };
    const option: echarts.EChartsCoreOption = {
      animation: false,
      grid: { left: 8, right: 8, top: 16, bottom: 0, containLabel: true },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        backgroundColor: c.surface,
        borderColor: c.line,
        textStyle: { color: c.text, fontSize: 13, fontFamily: c.font },
        formatter: (params: { dataIndex: number }[]) => {
          const step = steps[params[0]?.dataIndex ?? 0]!;
          const said = step.value === null ? "Not on file yet" : `${!step.total && step.value > 0 ? "+" : ""}${format(step.value)}`;
          return `${step.label}<br/><b>${said}</b>`;
        },
      },
      xAxis: {
        type: "category",
        data: steps.map((step) => step.label),
        axisLabel: { ...axisText, interval: 0, width: 110, overflow: "break" },
        axisLine: { lineStyle: { color: c.line, width: 1 } },
        axisTick: { show: false },
      },
      yAxis: {
        type: "value",
        min: 0,
        splitNumber: 4,
        axisLabel: { ...axisText, formatter: (value: number) => axisMoney(value) },
        splitLine: { lineStyle: { color: c.line, type: "dashed" as const, width: 1 } },
      },
      series: [
        { type: "bar", stack: "fall", silent: true, itemStyle: { color: "transparent" }, data: bars.map((bar) => bar.base) },
        {
          type: "bar",
          stack: "fall",
          barMaxWidth: 28,
          itemStyle: { color: c.primary, borderRadius: [3, 3, 0, 0] },
          data: bars.map((bar) => bar.size),
        },
      ],
    };
    return option;
  }, [steps, format]);
  return <Chart option={option} label={`${label}: ${steps.map((step) => `${step.label} ${step.value === null ? "not on file" : format(step.value)}`).join(", ")}`} />;
}

/** A theme colour with some transparency, for fills drawn over the page. */
function hexAlpha(colour: string, alpha: number) {
  const hex = colour.replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(hex)) return colour;
  const [r, g, b] = [0, 2, 4].map((at) => parseInt(hex.slice(at, at + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
