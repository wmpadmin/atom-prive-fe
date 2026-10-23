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
import { useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router";
import { ColumnPicker } from "../../components/column-picker";
import { ViewTabs } from "../../components/view-tabs";
import { useColumnDrag } from "../../lib/column-drag";
import { PagedFooter, usePagedRows } from "../../lib/paged-rows";
import { useTableView } from "../../lib/table-view";
import { DueDate, Mark } from "../forms/checklist-parts";
import { formStatus, progressLine, stillBeingFilledIn } from "../forms/form-labels";
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

/** One column of the checklist: its heading, and what it draws on a row. */
type Column = {
  id: string;
  label: string;
  align: "left" | "right";
  nowrap?: boolean;
  cell: (form: CaseFormRow) => ReactNode;
};

/**
 * The columns a reader may move and take off, in the order the firm wrote them.
 *
 * <p>Built rather than written out, because two of these cells need what only the screen knows: whether
 * this reader may change anything, and what the row's own action does.
 *
 * <p>Two columns are not here. The form is the row — a line with no form on it names nothing — and the
 * tick that chooses one to send has no heading, so there is nothing to drag and nothing to find in a list.
 */
function movableFor({ canChange, busy, onDue, actionFor }: {
  canChange: boolean;
  /** A form is being started, so the word at the end of the row cannot be pressed a second time. */
  busy: boolean;
  onDue: (form: CaseFormRow) => void;
  actionFor: (form: CaseFormRow) => (() => void) | undefined;
}): Column[] {
  return [
    {
      id: "due",
      label: "Due date",
      align: "left",
      nowrap: true,
      cell: (form) => {
        const due = dueLabel(form.dueOn, form.submittedAt);
        return canChange && tracked(form) ? (
          <button
            type="button"
            onClick={(event) => {
              // The date on a row is changed here rather than opening the form behind it.
              event.stopPropagation();
              onDue(form);
            }}
            className="text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
          >
            <DueDate dueOn={form.dueOn} due={due} />
          </button>
        ) : (
          <DueDate dueOn={form.dueOn} due={due} />
        );
      },
    },
    {
      id: "status",
      label: "Status",
      align: "left",
      cell: (form) => (
        <Badge tone={formStatus(form.status, form.dueOn).tone}>{formStatus(form.status, form.dueOn).label}</Badge>
      ),
    },
    {
      id: "action",
      label: "Action",
      align: "right",
      nowrap: true,
      cell: (form) => {
        if (form.status === "SUBMITTED") {
          // The client has signed it. There is nothing left to do, and nobody sets this by hand.
          return <span className="text-sm font-semibold text-emerald-700">Done</span>;
        }
        const openRow = actionFor(form);
        if (!canChange || !openRow) return null;
        return (
          // The same thing the row itself does, said in a word, and the way a keyboard reaches it.
          <button
            type="button"
            disabled={busy}
            onClick={(event) => {
              // The row would do this as well; once is enough, and twice would start two forms.
              event.stopPropagation();
              openRow();
            }}
            className="text-sm font-semibold text-primary-600 hover:text-primary-700 disabled:text-ink-muted"
          >
            {form.status === "WAITING_ON_CLIENT" ? (form.readyToFill ? "View" : "Pending") : "Fill"}
          </button>
        );
      },
    },
  ];
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

  // Read above the return below, because usePagedRows is a hook and a hook cannot be called on only some of
  // a component's renders — and this one returns early for a case with no client to hold forms.
  const rows = forms.data ?? [];
  const paged = usePagedRows(rows);
  // Read above it for the same reason: how this reader has arranged the checklist is a thing about them
  // rather than about whether this case has a client yet.
  const movable = movableFor({
    canChange,
    busy: open.isPending,
    onDue: (form) => setChanging(form),
    actionFor: actionOf,
  });
  const view = useTableView("case-forms", movable.map((one) => one.id));
  const drag = useColumnDrag(view);
  const byId = new Map(movable.map((one) => [one.id, one]));
  const shownColumns = view.shown.map((id) => byId.get(id)).filter((one) => one !== undefined);

  if (!detail.summary.submitted || !client) {
    return (
      <Alert tone="info">
        The client's forms appear here once the application has been submitted and the client exists.
      </Alert>
    );
  }

  // Counted over the whole pack and not the page: how far the checklist has got is the same answer
  // whichever page of it is open, and so is which forms are waiting to be sent.
  const done = rows.filter((form) => form.status === "SUBMITTED").length;
  const sendable = rows.filter(readyToSend);
  const picked = sendable.filter((form) => chosen.includes(form.kind));
  // Whether the tick is there at all, said once: the head, the rows and the lines that run the width of
  // the table all have to agree about it.
  const choosing = canChange && sendable.length > 0;

  function choose(kind: string, wanted: boolean) {
    setChosen((held) => (wanted ? [...held, kind] : held.filter((one) => one !== kind)));
  }

  /**
   * What this row's Action does. The whole row does it too: a form in a list is opened by clicking the form,
   * not by finding the small word at the end of its line.
   */
  function actionOf(form: CaseFormRow): (() => void) | undefined {
    if (!stillBeingFilledIn(form.status) || !canChange) {
      // Nothing left to do to it here, or nothing this person may do: the row still opens what was filled in.
      return form.formId ? () => void navigate(`/onboarding/${caseId}/forms/${form.formId}`) : undefined;
    }
    if (!form.readyToFill) return () => void navigate(`/onboarding/${caseId}/documents/${form.kind}`);
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
      <div className="flex flex-wrap items-start justify-between gap-3 px-6 py-5">
        <div>
          <h2 id="checklist-title" className="text-base font-bold">
            Onboarding checklist
          </h2>
          <p className="mt-0.5 text-xs text-ink-muted">
            Operations owns every step below except KYC sign-off · {categoryLabels[category]} pack ·{" "}
            {rows.length === 0 ? "no forms in this pack yet" : `${done} of ${rows.length} complete`}
          </p>
        </div>
        {/* Beside the name of the pack rather than over the table, so it reads as something about this
            checklist and not as one more thing in the table's furniture. */}
        <div className="flex flex-wrap items-center gap-2">
          <ViewTabs
            views={view.views}
            current={view.current}
            edited={view.current === null ? view.arranged : view.changed}
            onPick={(name) => (name === null ? view.reset() : view.apply(name))}
            onSave={view.saveAs}
            onDelete={view.remove}
            firstLabel="Every form"
          />
          <ColumnPicker
            columns={movable.map((one) => ({ id: one.id, label: one.label }))}
            shown={new Set(view.shown)}
            order={view.order}
            arranged={view.arranged}
            onChange={(next) => {
              for (const one of movable) {
                if (next.has(one.id) === view.hidden.includes(one.id)) view.toggle(one.id);
              }
            }}
            onMove={view.move}
            onReset={view.reset}
          />
        </div>
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
              {choosing && (
                <th scope="col" className="w-10 py-3 pr-0 pl-6">
                  <span className="sr-only">Choose to send</span>
                </th>
              )}
              <th scope="col" className="py-3 pr-4 pl-6">Forms</th>
              {shownColumns.map((column, at) => (
                <th
                  key={column.id}
                  scope="col"
                  {...drag.headingProps(column.id)}
                  className={cn(
                    "cursor-grab touch-none px-4 py-3 select-none",
                    column.align === "right" ? "text-right" : "text-left",
                    at === shownColumns.length - 1 && "pr-6",
                    drag.dragging === column.id && "cursor-grabbing opacity-40",
                    drag.over === column.id && "bg-primary-50",
                  )}
                  title={`Drag to move ${column.label}`}
                >
                  {column.label}
                  <span className="sr-only">
                    , column {at + 1} of {shownColumns.length}. Use the Columns button to move or hide it.
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {forms.isPending && (
              <tr>
                <td colSpan={shownColumns.length + (choosing ? 2 : 1)} className="px-6 py-8 text-center text-ink-muted">Loading the checklist…</td>
              </tr>
            )}
            {!forms.isPending && rows.length === 0 && (
              <tr>
                <td colSpan={shownColumns.length + (choosing ? 2 : 1)} className="px-6 py-10 text-center text-ink-muted">
                  No form is in the {categoryLabels[category]} pack yet. Put one there from the Forms screen.
                </td>
              </tr>
            )}
            {paged.shown.map((form) => {
              const waiting = form.status === "WAITING_ON_CLIENT";
              const openRow = actionOf(form);
              return (
                <tr
                  key={form.kind}
                  onClick={openRow}
                  className={cn(waiting && "bg-amber-50/50", openRow && "cursor-pointer hover:bg-slate-50")}
                >
                  {choosing && (
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
                  {/* The cells in the order the headings are in, out of the one list that holds both. */}
                  {shownColumns.map((column, at) => (
                    <td
                      key={column.id}
                      className={cn(
                        "px-4 py-3",
                        column.align === "right" && "text-right",
                        column.nowrap && "whitespace-nowrap",
                        at === shownColumns.length - 1 && "pr-6",
                      )}
                    >
                      {column.cell(form)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {/* Outside the scrolling box, so the way through the pack does not slide sideways with the columns.
          Above the send bar, which still counts every form chosen across the whole pack rather than the
          ones on this page. */}
      {rows.length > 0 && <PagedFooter paged={paged} noun={["form", "forms"]} />}

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
