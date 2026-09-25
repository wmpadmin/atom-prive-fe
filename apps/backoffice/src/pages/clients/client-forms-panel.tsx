import type { ApiError } from "@atomprive/api-client";
import {
  getListClientChecklistQueryKey,
  useChangeCaseForm,
  useListClientChecklist,
  useStartForm,
  type CaseFormRow,
  type ClientChecklist,
  type CustomerDetail,
} from "@atomprive/api-client/backoffice";
import { Alert, Badge, Button, DateInput, Dialog, Field, cn } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { useStaffUser } from "../../auth/session";
import { hasAnyAuthority, hasAuthority } from "../../lib/permissions";
import { DueDate, Mark } from "../forms/checklist-parts";
import { formStatus, progressLine } from "../forms/form-labels";
import { categoryLabels, dueLabel } from "../onboarding/case-category";

/**
 * Every form this client's kind of account needs, filled in from their file. The same checklist an onboarding
 * case shows, reached from the client instead: an entity gets the entity pack, a joint account the joint one.
 */
export function ClientFormsPanel({ client }: { client: CustomerDetail["client"] }) {
  const user = useStaffUser();
  const canFill = hasAuthority(user, "FILL_CLIENT_FORMS:CHANGE");
  // Compliance follow where the forms have got to without opening any of them: what they decide on is the
  // papers the client hands over, not the forms the firm fills in.
  const canOpen = hasAnyAuthority(user, "FILL_CLIENT_FORMS:VIEW", "ONBOARD_CLIENTS:VIEW",
    "ONBOARD_CLIENTS:OWN_CLIENTS", "VIEW_CUSTOMER_PROFILE:OWN_CLIENTS");
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const checklist = useListClientChecklist<ClientChecklist, ApiError>(client.id);
  const open = useStartForm<ApiError>();
  // When the signed copy is expected back. It is set per form, before the form goes out.
  const [dating, setDating] = useState<CaseFormRow | null>(null);
  const changeDue = useChangeCaseForm<ApiError>();
  const caseId = checklist.data?.caseId ?? null;

  const rows = checklist.data?.forms ?? [];
  const category = checklist.data?.category;
  const done = rows.filter((form) => form.status === "SUBMITTED").length;

  /** Opening a form for the first time creates it, filled in with what we already hold about the client. */
  function fill(form: CaseFormRow) {
    if (form.formId) {
      void navigate(`/clients/${client.id}/forms/${form.formId}`);
      return;
    }
    open.mutate(
      // Started from the client's own file rather than an onboarding case, and with no date set here.
      { data: { kind: form.kind, customerId: client.id, onboardingCaseId: null, dueOn: null } },
      {
        onSuccess: (started) => {
          void queryClient.invalidateQueries({ queryKey: getListClientChecklistQueryKey(client.id) });
          void navigate(`/clients/${client.id}/forms/${started.summary.id}`);
        },
      },
    );
  }

  /**
   * What this row's Action does. The whole row does it too: a form in a list is opened by clicking the form,
   * not by finding the small word at the end of its line.
   */
  function actionOf(form: CaseFormRow): (() => void) | undefined {
    if (!canOpen) return undefined;
    // The agreements and the disclosure are only signed, never filled in here: those open their wording.
    if (!form.readyToFill) return () => void navigate(`/clients/${client.id}/documents/${form.kind}`);
    if (form.status === "SUBMITTED" || form.status === "AWAITING_COMPLIANCE" || !canFill) {
      // Nothing left to do to it here, or nothing this person may do: the row still opens what was filled in.
      return form.formId
        ? () => void navigate(`/clients/${client.id}/forms/${form.formId}`)
        : () => void navigate(`/clients/${client.id}/documents/${form.kind}`);
    }
    return () => fill(form);
  }

  return (
    <section aria-labelledby="client-checklist-title" className="rounded-2xl border border-line bg-white">
      <div className="px-6 py-5">
        <h2 id="client-checklist-title" className="text-base font-bold">
          Client forms
        </h2>
        <p className="mt-0.5 text-xs text-ink-muted">
          {category ? `${categoryLabels[category]} pack · ` : ""}
          {rows.length === 0 ? "no forms in this pack yet" : `${done} of ${rows.length} complete`}
        </p>
      </div>

      {(checklist.isError || open.isError) && (
        <div className="px-6 pb-4">
          <Alert tone="danger">{(checklist.error ?? open.error)?.message}</Alert>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-y border-line text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
              <th scope="col" className="py-3 pr-4 pl-6">Forms</th>
              <th scope="col" className="px-4 py-3">Due date</th>
              <th scope="col" className="px-4 py-3">Status</th>
              <th scope="col" className="py-3 pr-6 pl-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {checklist.isPending && (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-ink-muted">Loading the checklist…</td>
              </tr>
            )}
            {!checklist.isPending && rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-10 text-center text-ink-muted">
                  No form is in this client's pack yet.
                </td>
              </tr>
            )}
            {rows.map((form) => {
              const due = dueLabel(form.dueOn, form.submittedAt);
              const waiting = form.status === "WAITING_ON_CLIENT" || form.status === "AWAITING_COMPLIANCE";
              const openRow = actionOf(form);
              return (
                <tr
                  key={form.kind}
                  onClick={openRow}
                  className={cn(waiting && "bg-amber-50/50", openRow && "cursor-pointer hover:bg-slate-50")}
                >
                  <td className="py-3 pr-4 pl-6">
                    <div className="flex items-start gap-3">
                      <Mark status={form.status} />
                      <div className="min-w-0">
                        {form.formId && canOpen ? (
                          <Link
                            to={`/clients/${client.id}/forms/${form.formId}`}
                            onClick={(event) => event.stopPropagation()}
                            className="font-semibold hover:text-primary-600"
                          >
                            {form.title}
                          </Link>
                        ) : (
                          <p className="font-semibold">{form.title}</p>
                        )}
                        <p className="text-xs text-ink-muted">{progressLine(form)}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {canFill && caseId && form.status !== "SUBMITTED" ? (
                      <button
                        type="button"
                        onClick={(event) => {
                          // The row opens the form behind it; the date is set here instead.
                          event.stopPropagation();
                          setDating(form);
                        }}
                        className="text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
                      >
                        <DueDate dueOn={form.dueOn} due={due} />
                      </button>
                    ) : (
                      <DueDate dueOn={form.dueOn} due={due} />
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={formStatus(form.status, form.dueOn).tone}>
                      {formStatus(form.status, form.dueOn).label}
                    </Badge>
                  </td>
                  <td className="py-3 pr-6 pl-4 text-right whitespace-nowrap">
                    {form.status === "SUBMITTED" ? (
                      // Signed and approved. There is nothing left to do, and nobody sets this by hand.
                      <span className="text-sm font-semibold text-emerald-700">Done</span>
                    ) : form.status === "AWAITING_COMPLIANCE" ? (
                      // It is Compliance's now, so Operations have nothing to do until it comes back.
                      <span className="text-sm font-semibold text-amber-700">With compliance</span>
                    ) : !openRow ? (
                      // Compliance see what the row offers without being able to take it: the action reads as
                      // the thing they may not do, rather than leaving the column blank.
                      <span className="text-sm font-semibold text-ink-muted">View</span>
                    ) : (
                      // The same thing the row itself does, said in a word, and the way a keyboard reaches it.
                      <button
                        type="button"
                        disabled={open.isPending}
                        onClick={(event) => {
                          // The row would do this as well; once is enough, and twice would start two forms.
                          event.stopPropagation();
                          openRow();
                        }}
                        className="text-sm font-semibold text-primary-600 hover:text-primary-700 disabled:text-ink-muted"
                      >
                        {canFill && form.readyToFill ? "Fill" : "View"}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <DueDateDialog
        form={dating}
        clientId={client.id}
        caseId={caseId}
        busy={changeDue.isPending}
        error={changeDue.error?.message}
        onClose={() => setDating(null)}
        onSet={(dueOn) =>
          dating &&
          caseId &&
          changeDue.mutate(
            {
              caseId,
              kind: dating.kind,
              data: { customerId: client.id, dueOn, waitingOnClient: null, signedCopyOnFile: null, answers: null },
            },
            {
              onSuccess: () => {
                setDating(null);
                void queryClient.invalidateQueries({ queryKey: getListClientChecklistQueryKey(client.id) });
              },
            },
          )
        }
      />
    </section>
  );
}

/** When this form's signed copy is expected back from the client. */
function DueDateDialog({
  form,
  caseId,
  busy,
  error,
  onClose,
  onSet,
}: {
  form: CaseFormRow | null;
  clientId: string;
  caseId: string | null;
  busy: boolean;
  error?: string;
  onClose: () => void;
  onSet: (dueOn: string | null) => void;
}) {
  const [dueOn, setDueOn] = useState<string | null>(null);
  const shown = dueOn ?? form?.dueOn ?? "";
  const today = new Date();
  const inTwoYears = new Date(today.getFullYear() + 2, today.getMonth(), today.getDate());
  return (
    <Dialog open={form !== null && caseId !== null} title={form ? form.title : "Due date"} onClose={onClose}>
      <div className="space-y-4">
        {error && <Alert tone="danger">{error}</Alert>}
        <Field id="checklist-due" label="Signed copy expected back by" hint="When you expect it back from the client.">
          <DateInput id="checklist-due" name="dueOn" value={shown} min={today} max={inTwoYears} clearable onChange={setDueOn} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => onSet(shown || null)} disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
