import { ApiError } from "@atomprive/api-client";
import { useListCaseForms, type CaseFormRow, type CaseSummary } from "@atomprive/api-client/backoffice";
import { Alert, Badge, Button } from "@atomprive/ui";
import { Check, X } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { formatRelative } from "../../lib/labels";
import { categoryOf } from "../onboarding/case-category";
import { formStatus, progressLine } from "../forms/form-labels";
import { FormDecisionDialog, type FormToDecide } from "./form-decision";

/**
 * The forms Operations have submitted for this client, with Compliance's decision on each. A form sent for
 * review is read here and then approved — which sends it to the client to sign — or sent back; the rest are
 * shown so the whole pack is in front of you when the client's KYC is signed off.
 */
export function CaseFormsForCompliance({ summary }: { summary: CaseSummary }) {
  const forms = useListCaseForms<CaseFormRow[], ApiError>(summary.id, { category: categoryOf(summary) });
  const [deciding, setDeciding] = useState<FormToDecide | null>(null);
  // Only what has actually come to Compliance: a form waiting on a decision, or one already decided on.
  // A form Operations are still filling in is theirs, and is not listed here at all.
  const rows = (forms.data ?? []).filter(
    (form) => form.status === "AWAITING_COMPLIANCE" || form.compliance !== null,
  );
  const waiting = rows.filter((form) => form.status === "AWAITING_COMPLIANCE").length;

  function decide(form: CaseFormRow, approved: boolean) {
    if (!form.formId) return;
    setDeciding({
      formId: form.formId,
      title: form.title,
      clientName: summary.clientName,
      approved,
      caseId: summary.id,
    });
  }

  return (
    <section aria-labelledby="case-forms-title" className="rounded-2xl border border-line bg-white">
      <div className="px-6 pt-6">
        <h2 id="case-forms-title" className="text-base font-bold">
          Forms sent for review
        </h2>
        <p className="mt-0.5 text-xs text-ink-muted">
          {waiting === 0
            ? "What Operations have sent for review, and what became of each one."
            : `${waiting} form${waiting === 1 ? "" : "s"} waiting on your decision. Read one, then approve it or send it back.`}
        </p>
      </div>

      {forms.isError && (
        <div className="px-6 pt-4">
          <Alert tone="danger">{forms.error.message}</Alert>
        </div>
      )}

      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-y border-line text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
              <th scope="col" className="py-3 pr-4 pl-6">Form</th>
              <th scope="col" className="px-4 py-3">Status</th>
              <th scope="col" className="px-4 py-3">Completed</th>
              <th scope="col" className="py-3 pr-6 pl-4 text-right">Decision</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {forms.isPending && (
              <tr>
                <td colSpan={4} className="px-6 py-10 text-center text-ink-muted">Loading the pack…</td>
              </tr>
            )}
            {forms.data && rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-10 text-center text-ink-muted">
                  Operations have not sent any of this client's forms for review yet.
                </td>
              </tr>
            )}
            {rows.map((form) => {
              const waitingOnYou = form.status === "AWAITING_COMPLIANCE";
              return (
                <tr key={form.kind} className={waitingOnYou ? "bg-amber-50/50" : undefined}>
                  <td className="py-3 pr-4 pl-6">
                    {/* Read it before deciding on it: it opens filled in, as the client signed it. */}
                    {form.formId && waitingOnYou ? (
                      <Link to={`/kyc/forms/${form.formId}`} className="font-semibold hover:text-primary-600">
                        {form.title}
                      </Link>
                    ) : (
                      <p className="font-semibold">{form.title}</p>
                    )}
                    <p className="text-xs text-ink-muted">{progressLine(form)}</p>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={formStatus(form.status, form.dueOn).tone}>
                      {formStatus(form.status, form.dueOn).label}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-ink-soft">
                    {waitingOnYou || form.status === "SUBMITTED" ? formatRelative(form.submittedAt, "—") : "—"}
                  </td>
                  <td className="py-3 pr-6 pl-4">
                    {waitingOnYou ? (
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => decide(form, false)}>
                          <X aria-hidden="true" />
                          Send back
                        </Button>
                        <Button size="sm" onClick={() => decide(form, true)}>
                          <Check aria-hidden="true" />
                          Approve
                        </Button>
                      </div>
                    ) : (
                      // Nothing to decide until the client has signed it and the signed copy is on file.
                      <p className="text-right text-xs text-ink-muted">
                        {form.compliance
                          ? `${form.compliance.approved ? "Approved" : "Sent back"} by ${form.compliance.decidedBy}`
                          : "—"}
                      </p>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <FormDecisionDialog
        deciding={deciding}
        onClose={() => setDeciding(null)}
        onDecided={() => setDeciding(null)}
      />
    </section>
  );
}
