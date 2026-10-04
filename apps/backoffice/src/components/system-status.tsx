import { ApiError } from "@atomprive/api-client";
import { useGetSystemStatus, type SystemStatus as Status } from "@atomprive/api-client/backoffice";
import { cn } from "@atomprive/ui";

/**
 * Whether the platform is well, at the foot of the sidebar.
 *
 * <p>Each check is named rather than rolled into one light. The API only answers the checks this person may
 * see, so naming them is what keeps "all systems operational" from being a promise about things nobody looked
 * at — a reader who only gets the database check can see that is all it says.
 */
export function SystemStatusPanel() {
  const status = useGetSystemStatus<Status, ApiError>({
    // It is a panel somebody glances at, not a monitor. Often enough to notice, rarely enough to be quiet.
    query: { refetchInterval: 60_000, staleTime: 30_000 },
  });

  // Nothing is claimed until something has been read. A green light drawn before the first answer would be
  // saying the platform is well on no evidence at all.
  if (status.isPending) {
    return <Panel tone="unknown" title="Checking…" />;
  }
  if (status.isError) {
    return <Panel tone="bad" title="Can't reach the platform" says="This panel asked and got no answer." />;
  }

  const { allWell, checks, apiLatencyMillis } = status.data;
  const unwell = checks.filter((check) => !check.well).length;

  return (
    <Panel
      tone={allWell ? "good" : "bad"}
      // Counted rather than named: the sidebar is narrow, and a list of names would be cut off halfway
      // through exactly when it matters. The checks below name them, each against its own dot.
      title={
        allWell
          ? "All systems operational"
          : unwell === 1
            ? "1 check needs attention"
            : `${unwell} checks need attention`
      }
    >
      <ul className="mt-2 space-y-1">
        {checks.map((check) => (
          <li key={check.name} className="flex items-baseline gap-2 text-xs">
            <span
              aria-hidden="true"
              className={cn("size-1.5 shrink-0 translate-y-px rounded-full", check.well ? "bg-emerald-500" : "bg-red-500")}
            />
            <span className="text-ink-soft">{check.name}</span>
            {/* Wrapped, not cut: what is wrong with a feed is the point of the line. */}
            {check.says && <span className="min-w-0 flex-1 text-ink-muted">{check.says}</span>}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-3xs text-ink-muted">Answered in {apiLatencyMillis}ms</p>
    </Panel>
  );
}

function Panel({
  tone,
  title,
  says,
  children,
}: {
  tone: "good" | "bad" | "unknown";
  title: string;
  says?: string;
  children?: React.ReactNode;
}) {
  const dot = tone === "good" ? "bg-emerald-500" : tone === "bad" ? "bg-red-500" : "bg-slate-300";
  return (
    <section
      aria-label="Platform status"
      aria-live="polite"
      className="rounded-xl border border-line bg-white/70 px-3 py-2.5"
    >
      <p className="flex items-center gap-2 text-xs font-semibold text-ink">
        <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-full", dot)} />
        <span className="min-w-0 truncate">{title}</span>
      </p>
      {says && <p className="mt-1 text-xs text-ink-muted">{says}</p>}
      {children}
    </section>
  );
}
