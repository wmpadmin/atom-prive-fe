import { ApiError } from "@atomprive/api-client";
import {
  getListCaseFormsQueryKey,
  useChangeCaseForm,
  useListCaseForms,
  useStartForm,
  type CaseDetail,
  type CaseFormRow,
} from "@atomprive/api-client/backoffice";
import { Alert, Badge, Button, cn, DateInput, Dialog, Field } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Minus, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { formatDate } from "../../lib/labels";
import { formStatus } from "../forms/form-labels";
import { categoryLabels, categoryOf, dueLabel } from "./case-category";



/**
 * Whether the due date can still be changed. It is asked for when the form goes to the client, so only a form
 * already with them has one to change.
 */
function tracked(form: CaseFormRow) {
  return form.status === "WAITING_ON_CLIENT";
}

/** The line under a form's name, saying where it has got to. */
function progressLine(form: CaseFormRow) {
  if (form.status === "SUBMITTED") {
    return `Completed · Submitted ${form.submittedAt ? formatDate(form.submittedAt) : ""}`.trim();
  }
  if (form.status === "NOT_STARTED") {
    return "Pending completion · Not started";
  }
  const requested = form.requestedOn ? ` · Requested ${formatDate(form.requestedOn)}` : "";
  return form.status === "WAITING_ON_CLIENT" ? `Awaiting client signature${requested}` : `Pending completion${requested}`;
}

function today() {
  return new Date();
}

function yearsFromToday(years: number) {
  const now = new Date();
  return new Date(now.getFullYear() + years, now.getMonth(), now.getDate());
}

/** Every form this client's category needs, as the onboarding checklist. */
export function CaseDocumentsTab({ detail, canChange }: { detail: CaseDetail; canChange: boolean }) {
  const caseId = detail.summary.id;
  const category = categoryOf(detail.summary);
  const client = detail.clients[0];
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [changing, setChanging] = useState<CaseFormRow | null>(null);

  const forms = useListCaseForms<CaseFormRow[], ApiError>(caseId, { category }, { query: { enabled: Boolean(client) } });
  const open = useStartForm<ApiError>();
  const refresh = () => queryClient.invalidateQueries({ queryKey: getListCaseFormsQueryKey(caseId) });

  if (!detail.summary.submitted || !client) {
    return (
      <Alert tone="info">
        The client's forms appear here once the application has been submitted and the client exists.
      </Alert>
    );
  }

  const rows = forms.data ?? [];
  const done = rows.filter((form) => form.status === "SUBMITTED").length;

  /**
   * What this row's Action does. The whole row does it too: a form in a list is opened by clicking the form,
   * not by finding the small word at the end of its line.
   */
  function actionOf(form: CaseFormRow): (() => void) | undefined {
    if (form.status === "SUBMITTED" || !canChange) {
      // Nothing left to do to it, or nothing this person may do: the row still opens what was filled in.
      return form.formId ? () => void navigate(`/onboarding/${caseId}/forms/${form.formId}`) : undefined;
    }
    if (!form.readyToFill) return () => void navigate(`/onboarding/${caseId}/documents/${form.kind}`);
    if (form.status === "WAITING_ON_CLIENT") return () => void navigate(`/onboarding/${caseId}/forms/${form.formId}`);
    return () => fill(form);
  }

  /** Opening a form for the first time creates it, filled in with what we already hold. */
  function fill(form: CaseFormRow) {
    if (form.formId) {
      void navigate(`/onboarding/${caseId}/forms/${form.formId}`);
      return;
    }
    open.mutate(
      { data: { kind: form.kind, customerId: client.id, onboardingCaseId: caseId, dueOn: form.dueOn } },
      { onSuccess: (started) => void navigate(`/onboarding/${caseId}/forms/${started.summary.id}`) },
    );
  }

  return (
    <section aria-labelledby="checklist-title" className="rounded-2xl border border-line bg-white">
      <div className="px-6 py-5">
        <h2 id="checklist-title" className="text-base font-bold">
          Onboarding checklist
        </h2>
        <p className="mt-0.5 text-xs text-ink-muted">
          Operations owns every step below except KYC sign-off · {categoryLabels[category]} pack ·{" "}
          {rows.length === 0 ? "no forms in this pack yet" : `${done} of ${rows.length} complete`}
        </p>
      </div>

      {(forms.isError || open.isError) && (
        <div className="px-6 pb-4">
          <Alert tone="danger">{(forms.error ?? open.error)?.message}</Alert>
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
            {forms.isPending && (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-ink-muted">Loading the checklist…</td>
              </tr>
            )}
            {!forms.isPending && rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-10 text-center text-ink-muted">
                  No form is in the {categoryLabels[category]} pack yet. Put one there from the Forms screen.
                </td>
              </tr>
            )}
            {rows.map((form) => {
              const due = dueLabel(form.dueOn, form.submittedAt);
              const waiting = form.status === "WAITING_ON_CLIENT";
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
                        {form.formId ? (
                          <Link
                            to={`/onboarding/${caseId}/forms/${form.formId}`}
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
                    {canChange && tracked(form) ? (
                      <button
                        type="button"
                        onClick={(event) => {
                          // The date on a row is changed here rather than opening the form behind it.
                          event.stopPropagation();
                          setChanging(form);
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
                    <Badge tone={formStatus(form.status, form.dueOn).tone}>{formStatus(form.status, form.dueOn).label}</Badge>
                  </td>
                  <td className="py-3 pr-6 pl-4 text-right whitespace-nowrap">
                    {form.status === "SUBMITTED" ? (
                      // The client has signed it. There is nothing left to do, and nobody sets this by hand.
                      <span className="text-sm font-semibold text-emerald-700">Done</span>
                    ) : !canChange || !openRow ? null : (
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
                        {waiting ? (form.readyToFill ? "View" : "Pending") : "Fill"}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <FormProgressDialog
        form={changing}
        caseId={caseId}
        clientId={client.id}
        onClose={() => setChanging(null)}
        onChanged={() => {
          setChanging(null);
          void refresh();
        }}
      />
    </section>
  );
}

function Mark({ status }: { status: CaseFormRow["status"] }) {
  const shared = "mt-0.5 grid size-6 shrink-0 place-items-center rounded-full";
  if (status === "SUBMITTED") {
    return (
      <span aria-hidden="true" className={cn(shared, "bg-emerald-100 text-emerald-700")}>
        <Check className="size-3.5" strokeWidth={3} />
      </span>
    );
  }
  if (status === "WAITING_ON_CLIENT") {
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

function DueDate({ dueOn, due }: { dueOn: string | null; due: ReturnType<typeof dueLabel> }) {
  return (
    <>
      <span className="block font-semibold">{dueOn ? formatDate(dueOn) : "—"}</span>
      <span className={cn("block text-xs", due.tone === "late" ? "text-red-600" : due.tone === "warn" ? "text-amber-600" : "text-ink-muted")}>
        {due.text}
      </span>
    </>
  );
}

interface FormProgressDialogProps {
  form: CaseFormRow | null;
  caseId: string;
  clientId: string;
  onClose: () => void;
  onChanged: () => void;
}

/** When the client's signed copy is expected back. Opens the form the first time a date is set. */
function FormProgressDialog({ form, caseId, clientId, onClose, onChanged }: FormProgressDialogProps) {
  const [dueOn, setDueOn] = useState<string | null>(null);
  const change = useChangeCaseForm<ApiError>();
  const shownDue = dueOn ?? form?.dueOn ?? "";

  function close() {
    setDueOn(null);
    change.reset();
    onClose();
  }

  return (
    <Dialog open={form !== null} title={form ? form.title : "Form"} onClose={close}>
      <div className="space-y-4">
        {change.isError && <Alert tone="danger">{change.error.message}</Alert>}
        <Field id="progress-due" label="Due date" hint="When you expect it back from the client.">
          <DateInput id="progress-due" name="dueOn" value={shownDue} min={today()} max={yearsFromToday(2)} onChange={setDueOn} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={close} disabled={change.isPending}>
            Cancel
          </Button>
          <Button
            disabled={!form || change.isPending}
            onClick={() =>
              form &&
              change.mutate(
                {
                  caseId,
                  kind: form.kind,
                  data: {
                    customerId: clientId,
                    dueOn: shownDue || null,
                    waitingOnClient: null,
                    signedCopyOnFile: null,
                    answers: null,
                  },
                },
                { onSuccess: () => { close(); onChanged(); } },
              )
            }
          >
            {change.isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
