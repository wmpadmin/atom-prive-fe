import type { LinePoint, ValueSlice } from "@atomprive/api-client/portal";
import { useState } from "react";
import { INK, compact, monthOf } from "./figures";

const WIDTH = 640;
const HEIGHT = 240;
const LEFT = 48;
const RIGHT = 12;
const TOP = 12;
const BOTTOM = 28;

/** A scale whose ticks land on round numbers, four or five of them, covering every value drawn. */
function ticks(low: number, high: number) {
  const span = high - low || Math.abs(high) || 1;
  const rough = span / 4;
  const power = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((one) => one * power).find((one) => one >= rough) ?? rough;
  const from = Math.floor(low / step) * step;
  const to = Math.ceil(high / step) * step;
  const all: number[] = [];
  for (let at = from; at <= to + step / 2; at += step) {
    all.push(at);
  }
  return all;
}

/** One line on a chart: what it is called, the colour it is drawn in, and its points. */
export type Series = { name: string; colour: string; points: LinePoint[]; area?: boolean };

const time = (day: string) => new Date(day).getTime();

/**
 * Lines over time on one scale: the months (or years, over a long span) along the bottom, round ticks up the
 * side, and a crosshair that reads every line off the day under the pointer. Placed by date rather than by
 * position, so a benchmark quoted on different days from the portfolio still lines up with it.
 */
export function LineChart({
  series,
  format,
  tick,
  label,
  empty,
}: {
  series: Series[];
  /** A value as the tooltip writes it. */
  format: (value: number) => string;
  /** A value as the axis writes it. */
  tick: (value: number) => string;
  label: string;
  empty: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const drawn = series.filter((one) => one.points.length > 0);
  const main = drawn[0];

  if (!main || main.points.length < 2) {
    return <p className="flex h-60 items-center justify-center px-6 text-center text-sm text-ink-muted">{empty}</p>;
  }

  const all = drawn.flatMap((one) => one.points);
  const values = all.map((one) => one.value);
  const scale = ticks(Math.min(...values), Math.max(...values));
  const low = scale[0] ?? 0;
  const high = scale[scale.length - 1] ?? 1;
  const first = Math.min(...all.map((one) => time(one.on)));
  const last = Math.max(...all.map((one) => time(one.on)));
  const x = (day: string) => LEFT + ((time(day) - first) / (last - first || 1)) * (WIDTH - LEFT - RIGHT);
  const y = (value: number) => TOP + (1 - (value - low) / (high - low || 1)) * (HEIGHT - TOP - BOTTOM);
  const path = (points: LinePoint[]) =>
    points.map((one, index) => `${index === 0 ? "M" : "L"}${x(one.on).toFixed(1)},${y(one.value).toFixed(1)}`).join(" ");

  // A label where each month (or, past two years, each year) begins.
  const long = last - first > 730 * 86_400_000;
  const stepOf = (day: string) =>
    long ? String(new Date(day).getFullYear()) : `${new Date(day).getFullYear()}-${new Date(day).getMonth()}`;
  const starts = main.points.filter((one, index, points) => index === 0 || stepOf(points[index - 1]!.on) !== stepOf(one.on));
  // A label too close to the one before is dropped, so a line opening late in a month does not print that month
  // on top of the next one. The later label is the one kept: it marks a whole month.
  const marks = starts.filter((one, index) => {
    const next = starts[index + 1];
    return !next || x(next.on) - x(one.on) >= 40;
  });

  /** The point of a line nearest a day, for the tooltip. */
  const near = (points: LinePoint[], at: number) =>
    points.reduce((best, one) => (Math.abs(time(one.on) - at) < Math.abs(time(best.on) - at) ? one : best), points[0]!);
  const shown = hover === null ? null : main.points[hover];

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={label}
        className="h-auto w-full touch-none"
        onPointerMove={(event) => {
          const box = event.currentTarget.getBoundingClientRect();
          const at = first + ((((event.clientX - box.left) / box.width) * WIDTH - LEFT) / (WIDTH - LEFT - RIGHT)) * (last - first);
          const closest = near(main.points, at);
          setHover(main.points.indexOf(closest));
        }}
        onPointerLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="line-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--color-primary-600)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="var(--color-primary-600)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {scale.map((value) => (
          <g key={value}>
            <line x1={LEFT} x2={WIDTH - RIGHT} y1={y(value)} y2={y(value)} stroke="var(--color-line)" strokeWidth="1" />
            <text x={LEFT - 8} y={y(value) + 4} textAnchor="end" fontSize="11" fill="var(--color-ink-muted)">
              {tick(value)}
            </text>
          </g>
        ))}
        {marks.map((one) => (
          <text key={one.on} x={x(one.on)} y={HEIGHT - 8} textAnchor="middle" fontSize="11" fill="var(--color-ink-muted)">
            {long ? new Date(one.on).getFullYear() : monthOf(one.on)}
          </text>
        ))}
        {drawn.map((one) =>
          one.area ? (
            <path
              key={`${one.name}-area`}
              d={`${path(one.points)} L${x(one.points[one.points.length - 1]!.on).toFixed(1)},${HEIGHT - BOTTOM} L${x(one.points[0]!.on).toFixed(1)},${HEIGHT - BOTTOM} Z`}
              fill="url(#line-fill)"
            />
          ) : null,
        )}
        {drawn.map((one) => (
          <path key={one.name} d={path(one.points)} fill="none" stroke={one.colour} strokeWidth="2" strokeLinejoin="round" />
        ))}
        {shown && (
          <g>
            <line x1={x(shown.on)} x2={x(shown.on)} y1={TOP} y2={HEIGHT - BOTTOM} stroke="var(--color-ink-muted)" strokeDasharray="3 3" />
            {drawn.map((one) => {
              const point = near(one.points, time(shown.on));
              return <circle key={one.name} cx={x(point.on)} cy={y(point.value)} r="4.5" fill={one.colour} stroke="white" strokeWidth="2" />;
            })}
          </g>
        )}
      </svg>
      {shown && hover !== null && (
        <div
          className="pointer-events-none absolute top-0 min-w-36 rounded-lg border border-line bg-white px-3 py-2 text-xs shadow-md"
          style={{
            left: `${(x(shown.on) / WIDTH) * 100}%`,
            transform: hover > main.points.length / 2 ? "translateX(calc(-100% - 10px))" : "translateX(10px)",
          }}
        >
          <p className="text-ink-muted">
            {new Date(shown.on).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
          </p>
          {drawn.map((one) => (
            <p key={one.name} className="flex items-center gap-1.5 font-semibold text-ink tabular-nums">
              {drawn.length > 1 && <span aria-hidden="true" className="size-2 rounded-full" style={{ background: one.colour }} />}
              {drawn.length > 1 && <span className="font-medium text-ink-muted">{one.name}</span>}
              <span className="ml-auto">{format(near(one.points, time(shown.on)).value)}</span>
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

/** What the portfolio was worth, day by day: one line over a faint area. */
export function ValueChart({ points, currency, empty }: { points: LinePoint[]; currency: string; empty?: string }) {
  const values = points.map((one) => one.value);
  return (
    <LineChart
      series={[{ name: "Portfolio value", colour: "var(--color-primary-600)", points, area: true }]}
      format={(value) => new Intl.NumberFormat("en-GB", { style: "currency", currency, maximumFractionDigits: 0 }).format(value)}
      tick={(value) => compact(value)}
      label={`Portfolio value, from ${compact(values[0] ?? 0, currency)} to ${compact(values[values.length - 1] ?? 0, currency)}`}
      empty={empty ?? "Your portfolio's performance appears here once it has been valued this year."}
    />
  );
}

/** How what the client owns is spread: a ring, the total in its middle, and a legend naming every slice. */
export function AllocationRing({
  slices,
  currency,
  picked,
  onPick,
  legend = true,
}: {
  slices: ValueSlice[];
  currency: string;
  /** The slice chosen, drawn full while the rest fade. */
  picked?: string | null;
  /** Makes each slice clickable; the legend beside it carries the same choice for the keyboard. */
  onPick?: (key: string) => void;
  legend?: boolean;
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  const drawn = slices.filter((one) => one.value > 0);
  const total = drawn.reduce((sum, one) => sum + one.value, 0);

  if (drawn.length === 0 || total <= 0) {
    return <p className="flex h-48 items-center justify-center text-sm text-ink-muted">Nothing to show yet.</p>;
  }

  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  // A small gap of the card's own white between slices, so neighbouring colours never run into each other.
  const gap = drawn.length > 1 ? 1.5 : 0;
  // Where each slice starts round the ring: everything before it, added up.
  const starts = drawn.map((_, index) =>
    drawn.slice(0, index).reduce((sum, one) => sum + (one.value / total) * circumference, 0),
  );

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row lg:flex-col xl:flex-row">
      <div className="relative size-40 shrink-0">
        <svg viewBox="0 0 100 100" role="img" aria-label="Asset allocation" className="size-full -rotate-90">
          {drawn.map((one, index) => {
            const length = (one.value / total) * circumference;
            const dash = Math.max(length - gap, 0.5);
            return (
              <circle
                key={one.key}
                cx="50"
                cy="50"
                r={radius}
                fill="none"
                stroke={INK[index % INK.length]}
                strokeWidth={picked === one.key ? 15 : 12}
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-(starts[index] ?? 0)}
                opacity={picked && picked !== one.key ? 0.3 : 1}
                onClick={onPick ? () => onPick(one.key) : undefined}
                onPointerEnter={() => setHovered(one.key)}
                onPointerLeave={() => setHovered(null)}
                className={onPick ? "cursor-pointer transition-opacity" : undefined}
              >
              </circle>
            );
          })}
        </svg>
        {hovered && (() => {
          const at = drawn.findIndex((one) => one.key === hovered);
          const one = drawn[at];
          return one ? (
            <div className="pointer-events-none absolute -top-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-lg border border-line bg-white px-3 py-2 text-xs whitespace-nowrap shadow-md">
              <span aria-hidden="true" className="size-2.5 rounded-full" style={{ background: INK[at % INK.length] }} />
              <span className="text-ink-soft">{one.name}</span>
              <span className="font-semibold text-ink tabular-nums">{one.share.toFixed(2)}%</span>
            </div>
          ) : null;
        })()}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xs font-semibold text-ink-muted">{currency}</span>
          <span className="text-lg font-bold text-ink tabular-nums">{compact(total)}</span>
        </div>
      </div>
      {legend && <ul className="w-full min-w-0 space-y-2">
        {drawn.map((one, index) => (
          <li key={one.key} className="flex items-center gap-2 text-sm">
            <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ background: INK[index % INK.length] }} />
            <span className="min-w-0 flex-1 truncate text-ink-soft">{one.name}</span>
            <span className="font-semibold text-ink tabular-nums">{one.share.toFixed(0)}%</span>
          </li>
        ))}
      </ul>}
    </div>
  );
}

/** One bar: what it is called, how big, and a colour where it should not be the default. */
export type Bar = { label: string; value: number | null; colour?: string };

/**
 * Bars from a nought line, up for gains and down for losses, on round ticks. A bar with no value is left as a gap
 * with a dash beneath it, so a figure not yet sent never reads as nought.
 */
export function BarChart({
  bars,
  format,
  tick,
  label,
  empty,
  waterfall,
}: {
  bars: Bar[];
  format: (value: number) => string;
  tick: (value: number) => string;
  label: string;
  empty: string;
  /** Each bar starts where the one before ended, as an explainer reads; bars marked total stand from nought. */
  waterfall?: { totals: number[] };
}) {
  const [hover, setHover] = useState<number | null>(null);
  if (bars.length === 0 || bars.every((one) => one.value === null)) {
    return <p className="flex h-52 items-center justify-center px-6 text-center text-sm text-ink-muted">{empty}</p>;
  }

  // Where each bar starts and ends: from nought, or, in a waterfall, from where the running total stands.
  const spans = bars.reduce<{ low: number; high: number; total: number }[]>((all, one, index) => {
    const value = one.value ?? 0;
    const before = all[all.length - 1]?.total ?? 0;
    if (!waterfall || waterfall.totals.includes(index)) {
      all.push({ low: Math.min(0, value), high: Math.max(0, value), total: value });
    } else {
      const after = before + value;
      all.push({ low: Math.min(before, after), high: Math.max(before, after), total: after });
    }
    return all;
  }, []);
  const scale = ticks(Math.min(0, ...spans.map((one) => one.low)), Math.max(0, ...spans.map((one) => one.high)));
  const low = scale[0] ?? 0;
  const high = scale[scale.length - 1] ?? 1;
  const tilted = bars.length > 6;
  const bottom = tilted ? 64 : BOTTOM;
  const y = (value: number) => TOP + (1 - (value - low) / (high - low || 1)) * (HEIGHT - TOP - bottom);
  const band = (WIDTH - LEFT - RIGHT) / bars.length;
  const width = Math.min(32, band * 0.55);

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={label} className="h-auto w-full" onPointerLeave={() => setHover(null)}>
        {scale.map((value) => (
          <g key={value}>
            <line
              x1={LEFT}
              x2={WIDTH - RIGHT}
              y1={y(value)}
              y2={y(value)}
              stroke={value === 0 ? "var(--color-ink-muted)" : "var(--color-line)"}
              strokeWidth="1"
              strokeDasharray={value === 0 ? undefined : "3 3"}
            />
            <text x={LEFT - 8} y={y(value) + 4} textAnchor="end" fontSize="11" fill="var(--color-ink-muted)">
              {tick(value)}
            </text>
          </g>
        ))}
        {bars.map((one, index) => {
          const centre = LEFT + band * index + band / 2;
          const span = spans[index]!;
          const value = one.value ?? 0;
          const colour = one.colour ?? (value < 0 ? "#f97316" : "var(--color-brand-900)");
          return (
            <g key={`${one.label}-${index}`} onPointerEnter={() => setHover(index)}>
              <rect x={centre - band / 2} y={TOP} width={band} height={HEIGHT - TOP - bottom} fill="transparent" />
              {one.value !== null && (
                <rect
                  x={centre - width / 2}
                  y={y(span.high)}
                  width={width}
                  height={Math.max(1, y(span.low) - y(span.high))}
                  rx="2"
                  fill={colour}
                  opacity={hover === null || hover === index ? 1 : 0.55}
                />
              )}
              <text
                x={centre}
                y={HEIGHT - bottom + 16}
                textAnchor={tilted ? "end" : "middle"}
                fontSize="11"
                fill="var(--color-ink-muted)"
                transform={tilted ? `rotate(-35 ${centre} ${HEIGHT - bottom + 16})` : undefined}
              >
                {one.label.length > 18 ? `${one.label.slice(0, 17)}…` : one.label}
              </text>
            </g>
          );
        })}
      </svg>
      {hover !== null && bars[hover] && (
        <div
          className="pointer-events-none absolute top-0 rounded-lg border border-line bg-white px-3 py-2 text-xs shadow-md"
          style={{
            left: `${((LEFT + band * hover + band / 2) / WIDTH) * 100}%`,
            transform: hover > bars.length / 2 ? "translateX(calc(-100% - 10px))" : "translateX(10px)",
          }}
        >
          <p className="text-ink-muted">{bars[hover].label}</p>
          <p className="font-semibold text-ink tabular-nums">{bars[hover].value === null ? "Not sent yet" : format(bars[hover].value)}</p>
        </div>
      )}
    </div>
  );
}
