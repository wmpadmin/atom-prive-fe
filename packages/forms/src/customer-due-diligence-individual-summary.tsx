import { Button } from "@atomprive/ui";
import { PencilLine } from "lucide-react";
import { SharedDueDiligenceSummary } from "./customer-due-diligence-summary";
import { customerLines, type DueDiligenceIndividual } from "./customer-due-diligence-individual";

/** Everything the individual's copy of the form asks for, as it was answered. */
export function DueDiligenceIndividualSummary({
  value,
  onEdit,
}: {
  value: DueDiligenceIndividual;
  onEdit?: (stepId: string) => void;
}) {
  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-2xl border border-line">
        <div className="flex items-center justify-between gap-3 border-b border-line bg-slate-50/70 px-5 py-3">
          <h3 className="text-sm font-bold text-ink">The customer</h3>
          {onEdit && (
            <Button variant="ghost" size="sm" onClick={() => onEdit("customer")}>
              <PencilLine aria-hidden="true" />
              Edit
            </Button>
          )}
        </div>
        <dl className="grid gap-4 px-5 py-4 sm:grid-cols-2">
          {customerLines.map((line) => (
            <div key={line.id} className="sm:col-span-2">
              <dt className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">{line.label}</dt>
              <dd className="mt-0.5 text-sm break-words text-ink">{value.customer[line.id].trim() || "—"}</dd>
            </div>
          ))}
        </dl>
      </section>
      <SharedDueDiligenceSummary value={value} onEdit={onEdit} />
    </div>
  );
}
