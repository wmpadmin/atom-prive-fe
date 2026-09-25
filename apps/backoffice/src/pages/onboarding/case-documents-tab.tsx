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
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { DueDate, Mark } from "../forms/checklist-parts";
import { formStatus, progressLine } from "../forms/form-labels";
import { categoryLabels, categoryOf, dueLabel } from "./case-category";
import { readyToSend } from "./ready-to-send";
import { SendToSignBar } from "./send-to-sign-bar";



/**
 * Whether the due date can still be changed. It is asked for when the form goes to the client, so only a form
 * already with them has one to change.
 */
function tracked(form: CaseFormRow) {
  return form.status === "WAITING_ON_CLIENT";
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
  // Which forms are chosen to go out together. One is a single form; several are one pack.
  const [chosen, setChosen] = useState<string[]>([]);

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
  const sendable = rows.filter(readyToSend);
  const picked = sendable.filter((form) => chosen.includes(form.kind));

  function choose(kind: string, wanted: boolean) {
    setChosen((held) => (wanted ? [...held, kind] : held.filter((one) => one !== kind)));
  }

  /**
   * What this row's Action does. The whole row does it too: a form in a list is opened by clicking the form,
   * not by finding the small word at the end of its line.
   */
  function actionOf(form: CaseFormRow): (() => void) | undefined {
    if (form.status === "SUBMITTED" || form.status === "AWAITING_COMPLIANCE" || !canChange) {
      // Nothing left to do to it here, or nothing this person may do: the row still opens what was filled in.
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
              {canChange && sendable.length > 0 && (
                <th scope="col" className="w-10 py-3 pr-0 pl-6">
                  <span className="sr-only">Choose to send</span>
                </th>
              )}
              <th scope="col" className="py-3 pr-4 pl-6">Forms</th>
              <th scope="col" className="px-4 py-3">Due date</th>
              <th scope="col" className="px-4 py-3">Status</th>
              <th scope="col" className="py-3 pr-6 pl-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {forms.isPending && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-ink-muted">Loading the checklist…</td>
              </tr>
            )}
            {!forms.isPending && rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-10 text-center text-ink-muted">
                  No form is in the {categoryLabels[category]} pack yet. Put one there from the Forms screen.
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
                  {canChange && sendable.length > 0 && (
                    <td className="py-3 pr-0 pl-6">
                      {readyToSend(form) && (
                        <input
                          type="checkbox"
                          aria-label={`Send ${form.title} to be signed`}
                          checked={chosen.includes(form.kind)}
                          // The row opens the form behind it; the tick only chooses it.
                          onClick={(event) => event.stopPropagation()}
                          onChange={(event) => choose(form.kind, event.target.checked)}
                          className="size-4 rounded border-line text-primary-600"
                        />
                      )}
                    </td>
                  )}
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

      {canChange && (
        <SendToSignBar
          caseId={caseId}
          chosen={picked}
          forms={rows}
          onSent={() => {
            setChosen([]);
            void refresh();
          }}
        />
      )}

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
