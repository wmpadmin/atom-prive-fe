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
import { useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router";
import { useStaffUser } from "../../auth/session";
import { ColumnPicker } from "../../components/column-picker";
import { ViewTabs } from "../../components/view-tabs";
import { useColumnDrag } from "../../lib/column-drag";
import { useTableView } from "../../lib/table-view";
import { FILLS_CLIENT_FORMS, READS_CLIENT_FORMS, hasAnyAuthority } from "../../lib/permissions";
import { DueDate, Mark } from "../forms/checklist-parts";
import { formStatus, progressLine, stillBeingFilledIn } from "../forms/form-labels";
import { categoryLabels, dueLabel } from "../onboarding/case-category";

/** One column of the checklist: its heading, and what it draws on a row. */
type Column = {
  id: string;
  label: string;
  nowrap?: boolean;
  cell: (form: CaseFormRow) => ReactNode;
};

/**
 * The columns a reader may move and take off, in the order the firm wrote them.
 *
 * <p>Built here rather than written out at the top of the file, because the due date is not only read: on a
 * form still being filled in it is the way in to setting one, and the window that sets it belongs to the
 * panel.
 *
 * <p>Two columns are not among them. The form is the row — a line with no form on it names nothing — and the
 * word at the end is how the form is opened, not a fact about it somebody would take off.
 */
function movableFor({ canFill, caseId, onDate }: {
  canFill: boolean;
  /** The onboarding case the pack hangs off. Without one there is nothing to write a due date against. */
  caseId: string | null;
  onDate: (form: CaseFormRow) => void;
}): Column[] {
  return [
    {
      id: "due",
      label: "Due date",
      nowrap: true,
      cell: (form) => {
        const due = dueLabel(form.dueOn, form.submittedAt);
        return canFill && caseId && form.status !== "SUBMITTED" ? (
          <button
            type="button"
            onClick={(event) => {
              // The row opens the form behind it; the date is set here instead.
              event.stopPropagation();
              onDate(form);
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
      cell: (form) => (
        <Badge tone={formStatus(form.status, form.dueOn).tone}>
          {formStatus(form.status, form.dueOn).label}
        </Badge>
      ),
    },
  ];
}

/**
 * Every form this client's kind of account needs, filled in from their file. The same checklist an onboarding
 * case shows, reached from the client instead: an entity gets the entity pack, a joint account the joint one.
 */
export function ClientFormsPanel({ client }: { client: CustomerDetail["client"] }) {
  const user = useStaffUser();
  // Operations and Admin type on any client's form; an advisor types on their own clients'. The API scopes
  // an advisor to their own, so this only has to decide whether to offer it at all.
  const canFill = hasAnyAuthority(user, ...FILLS_CLIENT_FORMS);
  // Exactly what the screens behind these rows are guarded by, and nothing wider: a row this list invites
  // somebody to click who may not open what is behind it is a dead click.
  const canOpen = hasAnyAuthority(user, ...READS_CLIENT_FORMS);
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

  const movable = movableFor({ canFill, caseId, onDate: setDating });
  const view = useTableView("client-forms", movable.map((one) => one.id));
  const drag = useColumnDrag(view);
  const byId = new Map(movable.map((one) => [one.id, one]));
  const shownColumns = view.shown.map((id) => byId.get(id)).filter((one) => one !== undefined);

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
    if (!stillBeingFilledIn(form.status) || !canFill) {
      // Nothing left to do to it here, or nothing this person may do: the row still opens what was filled in.
      return form.formId
        ? () => void navigate(`/clients/${client.id}/forms/${form.formId}`)
        : () => void navigate(`/clients/${client.id}/documents/${form.kind}`);
    }
    return () => fill(form);
  }

  return (
    <section aria-labelledby="client-checklist-title" className="rounded-2xl border border-line bg-white">
      <div className="flex flex-wrap items-start justify-between gap-3 px-6 py-5">
        <div>
          <h2 id="client-checklist-title" className="text-base font-bold">
            Client forms
          </h2>
          <p className="mt-0.5 text-xs text-ink-muted">
            {category ? `${categoryLabels[category]} pack · ` : ""}
            {rows.length === 0 ? "no forms in this pack yet" : `${done} of ${rows.length} complete`}
          </p>
        </div>
        {/* Only once there is a pack to read. Over an empty checklist these offer to arrange columns of
            nothing, beside a line that has just said there is nothing in it. */}
        {rows.length > 0 && (
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
        )}
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
              {shownColumns.map((column, at) => (
                <th
                  key={column.id}
                  scope="col"
                  {...drag.headingProps(column.id)}
                  className={cn(
                    "cursor-grab touch-none px-4 py-3 select-none",
                    column.nowrap && "whitespace-nowrap",
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
              <th scope="col" className="py-3 pr-6 pl-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {checklist.isPending && (
              <tr>
                <td colSpan={shownColumns.length + 2} className="px-6 py-8 text-center text-ink-muted">
                  Loading the checklist…
                </td>
              </tr>
            )}
            {!checklist.isPending && rows.length === 0 && (
              <tr>
                <td colSpan={shownColumns.length + 2} className="px-6 py-10 text-center text-ink-muted">
                  No form is in this client's pack yet.
                </td>
              </tr>
            )}
            {rows.map((form) => {
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
                  {/* The cells in the order the headings are in, out of the one list that holds both. */}
                  {shownColumns.map((column) => (
                    <td key={column.id} className={cn("px-4 py-3", column.nowrap && "whitespace-nowrap")}>
                      {column.cell(form)}
                    </td>
                  ))}
                  <td className="py-3 pr-6 pl-4 text-right whitespace-nowrap">
                    {form.status === "SUBMITTED" ? (
                      // Signed and approved. There is nothing left to do, and nobody sets this by hand.
                      <span className="text-sm font-semibold text-emerald-700">Done</span>
                    ) : !openRow ? (
                      // Whoever may follow the pack without opening it — an advisor, Compliance — sees what
                      // the row holds without being offered it, rather than a blank at the end of the line.
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
                        {canFill && form.readyToFill && stillBeingFilledIn(form.status) ? "Fill" : "View"}
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
