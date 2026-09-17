import { UserX } from "lucide-react";

/**
 * Customer deactivation and data deletion approvals (#20). Requests come from client accounts, which the customer
 * module will add; until then there is nothing to approve.
 */
export function OffboardingTab() {
  return (
    <section aria-labelledby="offboarding-title" className="rounded-2xl border border-line bg-white p-5">
      <h2 id="offboarding-title" className="text-base font-bold">
        Customer deactivation &amp; data deletion
      </h2>
      <p className="mt-0.5 text-xs text-ink-muted">
        Review and approve off-boarding requests. Deletion runs only after the grace period ends; the reason and approver
        are kept permanently in the audit log.
      </p>
      <div className="mt-5 grid place-items-center rounded-xl border border-dashed border-line px-6 py-14 text-center">
        <span className="grid size-11 place-items-center rounded-xl bg-primary-50 text-primary-600">
          <UserX className="size-5" aria-hidden="true" />
        </span>
        <p className="mt-3 font-semibold">No off-boarding requests</p>
        <p className="mt-1 max-w-md text-sm text-ink-muted">
          When a client asks to close their account or have their data deleted, the request appears here for approval.
        </p>
      </div>
    </section>
  );
}
