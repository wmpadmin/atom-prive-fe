/**
 * The pieces every client screen is built out of.
 *
 * <p>Here rather than per page because six screens that each hand-rolled a table would be six tables, and
 * a client moving between them would read six products. The figures across the top, the heading row, the
 * pill that says what state a thing is in: all one shape, defined once.
 *
 * <p>No data in any of it. These know how a row is drawn and nothing about what a row means, which is what
 * keeps the rule about who may see what on the server where it belongs.
 */
import type { ReactNode } from "react";

/** One of the coloured figures across the top of a screen. */
export function Tile({
  tint,
  label,
  value,
  children,
}: {
  tint: string;
  label: string;
  value: string;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4">
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className={`grid size-10 shrink-0 place-items-center rounded-xl ${tint}`}>
          <span className="size-4 rounded-sm bg-current opacity-70" />
        </span>
        <div className="min-w-0">
          <p className="text-sm text-slate-500">{label}</p>
          <p className="truncate text-xl font-bold text-slate-900 tabular-nums">{value}</p>
        </div>
      </div>
      {children && <p className="mt-2 text-xs text-slate-400">{children}</p>}
    </div>
  );
}

/**
 * The strip of tabs along the top of a white card.
 *
 * <p>Takes the tabs as pairs rather than children, because a tab strip whose buttons are written out by
 * hand on each screen is a tab strip where one screen's selected tab is a shade off another's.
 */
export function Tabs<T extends string>({
  label,
  tabs,
  chosen,
  onChoose,
}: {
  label: string;
  tabs: readonly (readonly [T, string])[];
  chosen: T;
  onChoose: (which: T) => void;
}) {
  return (
    <div role="tablist" aria-label={label} className="flex flex-wrap gap-1">
      {tabs.map(([which, said]) => (
        <button
          key={which}
          type="button"
          role="tab"
          aria-selected={chosen === which}
          onClick={() => onChoose(which)}
          className={
            chosen === which
              ? "-mb-[13px] border-b-2 border-blue-600 px-3 py-2 text-sm font-semibold text-blue-700"
              : "-mb-[13px] border-b-2 border-transparent px-3 py-2 text-sm font-semibold text-slate-500 hover:text-slate-900"
          }
        >
          {said}
        </button>
      ))}
    </div>
  );
}

/** A white card with a tab strip and whatever controls belong beside it. */
export function Card({ bar, children }: { bar?: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white">
      {bar && (
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 px-5 py-3">{bar}</div>
      )}
      {children}
    </div>
  );
}

/** A table's heading row, from the headings. A right-aligned column is written as `["Balance", "right"]`. */
export function Headings({ of }: { of: readonly (string | readonly [string, "right" | "left"])[] }) {
  return (
    <thead>
      <tr className="border-y border-slate-200 bg-slate-50 text-2xs font-semibold tracking-wider text-slate-500 uppercase">
        {of.map((heading) => {
          const [said, side] = typeof heading === "string" ? [heading, "left" as const] : heading;
          return (
            <th key={said} className={`px-4 py-2.5 ${side === "right" ? "text-right" : "text-left"}`}>
              {said}
            </th>
          );
        })}
      </tr>
    </thead>
  );
}

/** The table itself, wide enough for its columns and scrolling rather than squeezing them. */
export function Table({ minWidth = "52rem", children }: { minWidth?: string; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full" style={{ minWidth }}>
        {children}
      </table>
    </div>
  );
}

export function Row({ children, faded }: { children: ReactNode; faded?: boolean }) {
  return (
    <tr
      className={`border-b border-slate-100 last:border-0 ${faded ? "bg-slate-50/60" : "hover:bg-slate-50/60"}`}
    >
      {children}
    </tr>
  );
}

/** Nothing to show, said in the table's own space rather than by the table disappearing. */
export function Nothing({ children }: { children: ReactNode }) {
  return (
    <p className="m-5 rounded-xl border border-dashed border-slate-300 px-5 py-8 text-center text-sm text-slate-500">
      {children}
    </p>
  );
}

const PILLS = {
  waiting: "bg-amber-100 text-amber-800",
  good: "bg-emerald-100 text-emerald-800",
  bad: "bg-red-100 text-red-800",
  quiet: "bg-slate-200 text-slate-600",
  cool: "bg-blue-100 text-blue-800",
} as const;

/** What state a thing is in, in the one shape every screen uses for it. */
export function Pill({ tone, children }: { tone: keyof typeof PILLS; children: ReactNode }) {
  return (
    <span
      className={`inline-flex rounded-lg px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${PILLS[tone]}`}
    >
      {children}
    </span>
  );
}

/** One card down the right-hand rail. */
export function Aside({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-5 py-5">
      <h2 className="text-sm font-bold text-slate-900">{title}</h2>
      <div className="mt-1.5 space-y-2.5 text-xs leading-snug text-slate-500">{children}</div>
    </div>
  );
}

/** A line of the rail with a tick against it. */
export function Tick({ children }: { children: ReactNode }) {
  return (
    <li className="flex gap-2.5 text-xs leading-snug text-slate-600">
      <span
        aria-hidden="true"
        className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-emerald-500 text-[9px] font-bold text-white"
      >
        ✓
      </span>
      <span>{children}</span>
    </li>
  );
}

/** A screen's own heading, with whatever button belongs opposite it. */
export function Heading({
  title,
  blurb,
  children,
}: {
  title: string;
  blurb: string;
  children?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        <p className="mt-1 text-sm text-slate-500">{blurb}</p>
      </div>
      {children}
    </header>
  );
}

/** A labelled control in a filter bar. */
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="text-2xs font-semibold tracking-wider text-slate-500 uppercase">
      {label}
      <span className="mt-1 block font-normal normal-case tracking-normal">{children}</span>
    </label>
  );
}

export const CONTROL =
  "rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 focus:border-blue-500 focus:outline-none";
