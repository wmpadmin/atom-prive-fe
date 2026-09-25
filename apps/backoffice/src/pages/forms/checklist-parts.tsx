import type { CaseFormRow } from "@atomprive/api-client/backoffice";
import { cn } from "@atomprive/ui";
import { Check, Minus, RotateCcw, TriangleAlert } from "lucide-react";
import { formatDate } from "../../lib/labels";
import { dueLabel } from "../onboarding/case-category";

/**
 * The parts a checklist line is drawn from, shared by the two screens that show one: an onboarding case, and a
 * client opened from the client list. A form reads the same in both places.
 */

export function Mark({ status }: { status: CaseFormRow["status"] }) {
  const shared = "mt-0.5 grid size-6 shrink-0 place-items-center rounded-full";
  if (status === "SUBMITTED") {
    return (
      <span aria-hidden="true" className={cn(shared, "bg-emerald-100 text-emerald-700")}>
        <Check className="size-3.5" strokeWidth={3} />
      </span>
    );
  }
  if (status === "REJECTED") {
    return (
      <span aria-hidden="true" className={cn(shared, "bg-red-100 text-red-700")}>
        <RotateCcw className="size-3.5" />
      </span>
    );
  }
  if (status === "WAITING_ON_CLIENT" || status === "AWAITING_COMPLIANCE") {
    return (
      <span aria-hidden="true" className={cn(shared, "bg-amber-100 text-amber-700")}>
        <TriangleAlert className="size-3.5" />
      </span>
    );
  }
  return (
    <span aria-hidden="true" className={cn(shared, "bg-slate-100 text-ink-muted")}>
      <Minus className="size-3.5" />
    </span>
  );
}

export function DueDate({ dueOn, due }: { dueOn: string | null; due: ReturnType<typeof dueLabel> }) {
  return (
    <>
      <span className="block font-semibold">{dueOn ? formatDate(dueOn) : "—"}</span>
      <span className={cn("block text-xs", due.tone === "late" ? "text-red-600" : due.tone === "warn" ? "text-amber-600" : "text-ink-muted")}>
        {due.text}
      </span>
    </>
  );
}
