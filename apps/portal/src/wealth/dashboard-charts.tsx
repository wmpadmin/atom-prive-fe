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

/**
 * What the portfolio was worth, day by day, this year: a line over a faint area, with the months along the
 * bottom and a crosshair that reads off the day under the pointer.
 */
export function ValueChart({ points, currency }: { points: LinePoint[]; currency: string }) {
  const [hover, setHover] = useState<number | null>(null);

  if (points.length < 2) {
    return (
      <p className="flex h-60 items-center justify-center text-sm text-ink-muted">
        Your portfolio's performance appears here once it has been valued this year.
      </p>
    );
  }

  const values = points.map((one) => one.value);
  const scale = ticks(Math.min(...values), Math.max(...values));
  const low = scale[0] ?? 0;
  const high = scale[scale.length - 1] ?? 1;
  const x = (index: number) => LEFT + (index / (points.length - 1)) * (WIDTH - LEFT - RIGHT);
  const y = (value: number) => TOP + (1 - (value - low) / (high - low || 1)) * (HEIGHT - TOP - BOTTOM);

  const line = points.map((one, index) => `${index === 0 ? "M" : "L"}${x(index).toFixed(1)},${y(one.value).toFixed(1)}`).join(" ");
  const area = `${line} L${x(points.length - 1).toFixed(1)},${HEIGHT - BOTTOM} L${LEFT},${HEIGHT - BOTTOM} Z`;

  // A label on the first day valued in each month.
  const months = points
    .map((one, index) => ({ index, month: monthOf(one.on) }))
    .filter((one, index, all) => index === 0 || all[index - 1]?.month !== one.month);

  const shown = hover === null ? null : points[hover];

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={`Portfolio value this year, from ${compact(values[0] ?? 0, currency)} to ${compact(values[values.length - 1] ?? 0, currency)}`}
        className="h-auto w-full touch-none"
        onPointerMove={(event) => {
          const box = event.currentTarget.getBoundingClientRect();
          const at = ((event.clientX - box.left) / box.width) * WIDTH;
          const index = Math.round(((at - LEFT) / (WIDTH - LEFT - RIGHT)) * (points.length - 1));
          setHover(Math.max(0, Math.min(points.length - 1, index)));
        }}
        onPointerLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="value-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--color-primary-600)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="var(--color-primary-600)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {scale.map((tick) => (
          <g key={tick}>
            <line x1={LEFT} x2={WIDTH - RIGHT} y1={y(tick)} y2={y(tick)} stroke="var(--color-line)" strokeWidth="1" />
            <text x={LEFT - 8} y={y(tick) + 4} textAnchor="end" fontSize="11" fill="var(--color-ink-muted)">
              {compact(tick)}
            </text>
          </g>
        ))}
        {months.map((one) => (
          <text key={one.index} x={x(one.index)} y={HEIGHT - 8} textAnchor="middle" fontSize="11" fill="var(--color-ink-muted)">
            {one.month}
          </text>
        ))}
        <path d={area} fill="url(#value-fill)" />
        <path d={line} fill="none" stroke="var(--color-primary-600)" strokeWidth="2" strokeLinejoin="round" />
        {shown && hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={TOP} y2={HEIGHT - BOTTOM} stroke="var(--color-ink-muted)" strokeDasharray="3 3" />
            <circle cx={x(hover)} cy={y(shown.value)} r="4.5" fill="var(--color-primary-600)" stroke="white" strokeWidth="2" />
          </g>
        )}
      </svg>
      {shown && hover !== null && (
        <div
          className="pointer-events-none absolute top-0 rounded-lg border border-line bg-white px-3 py-2 text-xs shadow-md"
          style={{
            left: `${(x(hover) / WIDTH) * 100}%`,
            transform: hover > points.length / 2 ? "translateX(calc(-100% - 10px))" : "translateX(10px)",
          }}
        >
          <p className="text-ink-muted">
            {new Date(shown.on).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
          </p>
          <p className="font-semibold text-ink tabular-nums">
            {new Intl.NumberFormat("en-GB", { style: "currency", currency, maximumFractionDigits: 0 }).format(shown.value)}
          </p>
        </div>
      )}
    </div>
  );
}

/** How what the client owns is spread: a ring, the total in its middle, and a legend naming every slice. */
export function AllocationRing({ slices, currency }: { slices: ValueSlice[]; currency: string }) {
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
                strokeWidth="12"
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-(starts[index] ?? 0)}
              >
                <title>{`${one.name}: ${one.share.toFixed(1)}%`}</title>
              </circle>
            );
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xs font-semibold text-ink-muted">{currency}</span>
          <span className="text-lg font-bold text-ink tabular-nums">{compact(total)}</span>
        </div>
      </div>
      <ul className="w-full min-w-0 space-y-2">
        {drawn.map((one, index) => (
          <li key={one.key} className="flex items-center gap-2 text-sm">
            <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ background: INK[index % INK.length] }} />
            <span className="min-w-0 flex-1 truncate text-ink-soft">{one.name}</span>
            <span className="font-semibold text-ink tabular-nums">{one.share.toFixed(0)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
