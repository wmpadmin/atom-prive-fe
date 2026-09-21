import type { StaffMember } from "@atomprive/api-client/backoffice";

/** A client's advisors, or "Default" when nobody looks after them yet. */
export function AdvisorChips({ advisors }: { advisors: StaffMember[] }) {
  if (advisors.length === 0) {
    return (
      <span title="No advisor yet" className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-ink-muted">
        Default
      </span>
    );
  }
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {advisors.map((advisor) => (
        <span key={advisor.id} className="inline-flex items-center rounded-full bg-primary-50 px-2.5 py-1 text-xs font-medium whitespace-nowrap text-primary-700">
          {advisor.fullName}
        </span>
      ))}
    </span>
  );
}
