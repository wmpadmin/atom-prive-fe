import { cn } from "@atomprive/ui";
import type { ReactNode } from "react";

/**
 * The pieces every Settings tab is built from.
 *
 * <p>One panel shape, one heading shape, one way of laying a pair of them side by side — so eight tabs
 * written at different times still read as one screen.
 */

export function Panel({
  icon,
  title,
  lead,
  children,
  className,
}: {
  icon?: ReactNode;
  title: string;
  lead?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    // A full-height column, so two panels side by side end level with each other however much each
    // holds. The content below the heading takes the slack, rather than the panel ending early and
    // leaving a step between it and the one beside it.
    <section className={cn("flex h-full flex-col rounded-2xl border border-line bg-white p-5", className)}>
      <div className="flex items-start gap-2.5">
        {icon && (
          <span
            aria-hidden="true"
            className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-primary-50 text-primary-700 [&_svg]:size-4"
          >
            {icon}
          </span>
        )}
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-ink">{title}</h2>
          {lead && <p className="mt-0.5 text-sm text-ink-muted">{lead}</p>}
        </div>
      </div>
      <div className="mt-4 flex-1">{children}</div>
    </section>
  );
}

/**
 * Two panels abreast where there is room, stacked where there is not — and the same height either way.
 *
 * <p>Stretched rather than top-aligned. Left to size themselves, a short panel beside a tall one ends
 * halfway up it and the pair reads as two unrelated things that happen to be adjacent; level, they read
 * as one row of a screen.
 */
export function Pair({ children }: { children: ReactNode }) {
  return <div className="grid items-stretch gap-6 lg:grid-cols-2">{children}</div>;
}

/**
 * A control that is drawn but does nothing yet, and says so.
 *
 * <p>Every one of these is a promise the platform cannot keep: there is no two-factor enrolment, no
 * recovery address, no notification choices for staff, no export of a reader's own data. They are drawn
 * because the firm asked for the screen as it was designed, and they are disabled and labelled because a
 * control that looks live and silently does nothing is the worse of the two failures — particularly in
 * front of a client.
 */
export function NotYet({ children }: { children?: ReactNode }) {
  return (
    <p className="mt-4 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
      <span aria-hidden="true" className="mt-1.5 size-1.5 shrink-0 rounded-full bg-amber-500" />
      <span>{children ?? "Not connected yet — the screen is here, what it would act on is not built."}</span>
    </p>
  );
}

/** A labelled control, laid out the way every other one on these tabs is. */
export function Setting({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-xs font-semibold text-ink-soft">
        {label}
      </label>
      {hint && <p className="mt-0.5 text-xs text-ink-muted">{hint}</p>}
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

/** Settings laid out two to a row, which is how most of these panels read best. */
export function Settings({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2">{children}</div>;
}

/** One row of a list of things that can each be switched on or off. */
export function SwitchRow({ title, lead, children }: { title: string; lead?: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line py-3 first:pt-0 last:border-0 last:pb-0">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-ink">{title}</p>
        {lead && <p className="mt-0.5 text-xs text-ink-muted">{lead}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-8">{children}</div>
    </div>
  );
}

/** The heading over a column of switches, so a reader knows which column is which. */
export function SwitchHeadings({ of }: { of: string[] }) {
  return (
    <div className="flex items-center justify-end gap-8 border-b border-line pb-2">
      {of.map((one) => (
        <span key={one} className="w-[3.75rem] text-center text-2xs font-semibold tracking-wider text-ink-muted uppercase">
          {one}
        </span>
      ))}
    </div>
  );
}
