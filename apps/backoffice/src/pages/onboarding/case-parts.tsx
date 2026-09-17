import { Badge, cn } from "@atomprive/ui";
import { caseStatusLabels, initialsOf, type CaseStatus } from "./case-labels";

/** The client's initials in a rounded square; people are shown in circles, clients in squares. */
export function ClientMark({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("grid size-9 shrink-0 place-items-center rounded-lg bg-primary-50 text-xs font-bold text-primary-700", className)}
    >
      {initialsOf(name) || "?"}
    </span>
  );
}

export function CaseStatusBadge({ status }: { status: CaseStatus }) {
  return <Badge tone={status === "COMPLETED" ? "success" : "warning"}>{caseStatusLabels[status]}</Badge>;
}

/** Steps done out of the total, as a number and a short bar. */
export function ProgressMeter({ done, total, className }: { done: number; total: number; className?: string }) {
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
      <span className="text-xs font-semibold text-ink-soft tabular-nums">
        {done}/{total}
      </span>
    </div>
  );
}
