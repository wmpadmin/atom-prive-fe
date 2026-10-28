import { Badge, cn } from "@atomprive/ui";
import { caseStatusLabels, type CaseStatus } from "./case-labels";

export function CaseStatusBadge({ status }: { status: CaseStatus }) {
  return <Badge tone={status === "COMPLETED" ? "success" : "warning"}>{caseStatusLabels[status]}</Badge>;
}

/** Steps done out of the total, as a number and a short bar. */
export function ProgressMeter({ done, total, className, inWords = false }: {
  done: number;
  total: number;
  className?: string;
  /**
   * Whether to say what is being counted.
   *
   * <p>On a line of its own a bare "4/6" takes its meaning from whatever is written above it, and above
   * it on a client's file is the stage the case has reached — which is about forms. A client's pack runs
   * to eleven forms and this counts none of them, so it says what it does count. In a table column,
   * where the heading has already said, the figure stays short.
   */
  inWords?: boolean;
}) {
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div
        role="progressbar"
        aria-label="Steps complete"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        aria-valuetext={`${done} of ${total} steps`}
        className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100"
      >
        <div className={cn("h-full rounded-full", done >= total ? "bg-emerald-500" : "bg-primary-600")} style={{ width: `${percent}%` }} />
      </div>
      <span className="text-xs font-semibold whitespace-nowrap text-ink-soft">
        <span className="tabular-nums">{done}</span>
        {inWords ? " of " : "/"}
        <span className="tabular-nums">{total}</span>
        {inWords && " steps"}
      </span>
    </div>
  );
}
