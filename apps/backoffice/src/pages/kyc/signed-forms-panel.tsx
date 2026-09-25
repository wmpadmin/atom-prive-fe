import { ApiError } from "@atomprive/api-client";
import {
  getListCaseFormsQueryKey,
  getListClientChecklistQueryKey,
  getListFormsAwaitingComplianceQueryKey,
  useDecideOnForm,
  useListFormsAwaitingCompliance,
  type ComplianceQueue,
  type FormRow,
} from "@atomprive/api-client/backoffice";
import { Alert, Avatar, Button, Dialog, Field, TextArea, describedBy } from "@atomprive/ui";
import { keepPreviousData, useQueryClient } from "@tanstack/react-query";
import { Check, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { formatRelative } from "../../lib/labels";
import { noErrors, toFormErrors, type FormErrors } from "../../lib/api-errors";

/**
 * The signed forms waiting on Compliance. Operations fill a form in and send it to the client; the client
 * signs it; the signed copy goes on file and the form lands here. Approving it is what finishes it —
 * sending it back returns it to Operations with what has to be put right.
 */
export function SignedFormsAwaitingCompliance() {
  const queue = useListFormsAwaitingCompliance<ComplianceQueue, ApiError>(
    { size: 50 },
    { query: { placeholderData: keepPreviousData } },
  );
  const [deciding, setDeciding] = useState<{ form: FormRow; approved: boolean } | null>(null);
  const rows = queue.data?.items ?? [];

  return (
    <section className="rounded-2xl border border-line bg-white">
      <div className="px-5 pt-5">
        <h2 className="text-base font-bold">Signed forms awaiting compliance</h2>
        <p className="mt-0.5 text-xs text-ink-muted">
          The client has signed and Operations have put the signed copy on file. Read it, then approve it or
          send it back saying what is wrong.
        </p>
      </div>

      {queue.isError && (
        <div className="px-5 pt-4">
          <Alert tone="danger">{queue.error.message}</Alert>
        </div>
      )}

      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
              <th scope="col" className="py-3 pr-4 pl-5">Client</th>
              <th scope="col" className="px-4 py-3">Form</th>
              <th scope="col" className="px-4 py-3">Reference</th>
              <th scope="col" className="px-4 py-3">Waiting since</th>
              <th scope="col" className="py-3 pr-5 pl-4 text-right">Decision</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {queue.isPending && (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-ink-muted">Loading the queue…</td>
              </tr>
            )}
            {queue.data && rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-ink-muted">
                  No signed form is waiting. They arrive as Operations put each signed copy on file.
                </td>
              </tr>
            )}
            {rows.map((form) => (
              <tr key={form.id} className="hover:bg-slate-50/60">
                <td className="py-3 pr-4 pl-5">
                  <div className="flex items-center gap-3">
                    <Avatar name={form.clientName} />
                    <div className="min-w-0">
                      <span className="block truncate font-semibold">{form.clientName}</span>
                      <span className="block truncate font-mono text-xs text-ink-muted">{form.clientCode}</span>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  {/* Read it before deciding on it: the form opens filled in, as the client signed it. */}
                  <Link to={`/kyc/forms/${form.id}`} className="font-semibold hover:text-primary-600">
                    {form.formTitle}
                  </Link>
                </td>
                <td className="px-4 py-3 font-mono text-xs whitespace-nowrap text-ink-soft">{form.reference}</td>
                <td className="px-4 py-3 whitespace-nowrap text-ink-soft">{formatRelative(form.updatedAt)}</td>
                <td className="py-3 pr-5 pl-4">
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setDeciding({ form, approved: false })}>
                      <X aria-hidden="true" />
                      Send back
                    </Button>
                    <Button size="sm" onClick={() => setDeciding({ form, approved: true })}>
                      <Check aria-hidden="true" />
                      Approve
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog
        open={deciding !== null}
        title={deciding?.approved ? "Approve this form" : "Send this form back to Operations"}
        description={deciding ? `${deciding.form.formTitle} · ${deciding.form.clientName}` : null}
        onClose={() => setDeciding(null)}
      >
        {deciding && (
          <DecisionForm
            form={deciding.form}
            approved={deciding.approved}
            onCancel={() => setDeciding(null)}
            onDecided={() => setDeciding(null)}
          />
        )}
      </Dialog>
    </section>
  );
}

/**
 * Approving a form, or sending it back with what is wrong with it. Shown from the queue and from the form
 * itself, so the decision is taken in the same words wherever it is read.
 */
export function DecisionForm({
  form,
  approved,
  onCancel,
  onDecided,
}: {
  form: FormRow;
  approved: boolean;
  onCancel: () => void;
  onDecided: () => void;
}) {
  const queryClient = useQueryClient();
  const [comment, setComment] = useState("");
  const [errors, setErrors] = useState<FormErrors>(noErrors);
  const decide = useDecideOnForm<ApiError>({
    mutation: {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: getListFormsAwaitingComplianceQueryKey() });
        void queryClient.invalidateQueries({ queryKey: getListClientChecklistQueryKey(form.customerId) });
        if (form.onboardingCaseId) {
          void queryClient.invalidateQueries({ queryKey: getListCaseFormsQueryKey(form.onboardingCaseId) });
        }
        onDecided();
      },
      onError: (error) => setErrors(toFormErrors(error)),
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors(noErrors);
    decide.mutate({ id: form.id, data: { approved, comment: comment.trim() || null } });
  }

  const error = errors.fields.comment;
  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {errors.form && <Alert tone="danger">{errors.form}</Alert>}

      <p className="text-sm leading-relaxed text-ink">
        {approved
          ? "Approving it finishes the form. It stays on the client's file as the record of what they signed."
          : "The form goes back to Operations to be put right and signed again. What you write is what they see."}
      </p>

      <Field
        id="compliance-comment"
        label={approved ? "Anything to note (optional)" : "What is wrong with it"}
        required={!approved}
        error={error}
      >
        <TextArea
          {...describedBy("compliance-comment", error)}
          rows={4}
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          required={!approved}
        />
      </Field>

      <div className="flex justify-end gap-3">
        <Button variant="ghost" onClick={onCancel} disabled={decide.isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={decide.isPending || (!approved && comment.trim() === "")}>
          {decide.isPending ? "Saving…" : approved ? "Approve" : "Send back"}
        </Button>
      </div>
    </form>
  );
}
