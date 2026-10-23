import { ApiError } from "@atomprive/api-client";
import {
  getListPostOnboardingNoticesQueryKey,
  useListPostOnboardingNotices,
  useMarkPostOnboardingNoticeSent,
  type NoticeRow,
  type PostOnboardingQueue,
} from "@atomprive/api-client/backoffice";
import { Alert, Badge, Button, Dialog, Field, TextArea, cn } from "@atomprive/ui";
import { keepPreviousData, useQueryClient } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router";
import { useStaffUser } from "../../auth/session";
import { ColumnPicker } from "../../components/column-picker";
import { ViewTabs } from "../../components/view-tabs";
import { useColumnDrag } from "../../lib/column-drag";
import { formatDate } from "../../lib/labels";
import { PagedFooter, usePagedRows } from "../../lib/paged-rows";
import { hasAnyAuthority, ONBOARDS_CLIENTS_CHANGE } from "../../lib/permissions";
import { useTableView } from "../../lib/table-view";

/** One column of the queue: its heading, and what it draws on a row. */
type Column = {
  id: string;
  label: string;
  align: "left" | "right";
  nowrap?: boolean;
  tone?: string;
  cell: (notice: NoticeRow) => ReactNode;
};

/**
 * The columns a reader may move and take off, in the order the firm wrote them.
 *
 * <p>Built rather than written out, because two of these cells need what only the screen knows: which of
 * the two lists is being read, and whether this reader may say a pack has gone.
 *
 * <p>The client is not among them. A row with no name on it is a pair of dates nobody can act on.
 */
function movableFor({ sent, canSend, onSend }: {
  sent: boolean;
  canSend: boolean;
  onSend: (notice: NoticeRow) => void;
}): Column[] {
  return [
    {
      id: "approved",
      label: "Approved",
      align: "left",
      nowrap: true,
      tone: "text-ink-soft",
      cell: (notice) => formatDate(notice.approvedAt),
    },
    {
      id: "due",
      label: "Due",
      align: "left",
      nowrap: true,
      tone: "text-ink-soft",
      cell: (notice) => formatDate(notice.dueOn),
    },
    {
      id: "standing",
      label: "Status",
      align: "left",
      cell: (notice) => (sent ? (
        <div>
          <Badge tone={notice.sentAt && notice.sentAt.slice(0, 10) > notice.dueOn ? "warning" : "success"}>
            {notice.sentAt ? `Sent ${formatDate(notice.sentAt)}` : "Sent"}
          </Badge>
          <p className="mt-0.5 text-xs text-ink-muted">
            {notice.sentByName ? `by ${notice.sentByName}` : ""}
            {notice.note ? ` · ${notice.note}` : ""}
          </p>
        </div>
      ) : (
        <Standing notice={notice} />
      )),
    },
    {
      id: "action",
      label: "Action",
      align: "right",
      nowrap: true,
      cell: (notice) => (
        <>
          {notice.customerId && (
            <Link
              to={`/clients/${notice.customerId}/documents/NOTICE_OF_TREATMENT`}
              className="text-sm font-medium text-primary-700 hover:underline"
            >
              {sent ? "View the letter" : "Preview"}
            </Link>
          )}
          {!sent && canSend && (
            <Button variant="ghost" size="sm" className="ml-2" onClick={() => onSend(notice)}>
              <Check aria-hidden="true" />
              Mark as sent
            </Button>
          )}
        </>
      ),
    },
  ];
}

/**
 * What every signed-off client is owed. Compliance sign a client off; the firm then has seven days to
 * get the welcome email, the Notice of Treatment letter and the forms they signed to them.
 */
export function PostOnboardingPage() {
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState<NoticeRow | null>(null);
  const notices = useListPostOnboardingNotices<PostOnboardingQueue, ApiError>(
    { sent },
    { query: { placeholderData: keepPreviousData } },
  );
  const canSend = hasAnyAuthority(useStaffUser(), ...ONBOARDS_CLIENTS_CHANGE);
  // Read above the refusal below, because usePagedRows is a hook and a hook cannot be called on only some
  // of a component's renders. The server sends this queue whole, so the page is taken here.
  const rows = notices.data?.items ?? [];
  const paged = usePagedRows(rows);
  // Read above the refusal for the same reason: how this reader has arranged the queue is a thing about
  // them rather than about whether the fetch came back.
  const movable = movableFor({ sent, canSend, onSend: (notice) => setSending(notice) });
  const view = useTableView("post-onboarding-notices", movable.map((one) => one.id));
  const drag = useColumnDrag(view);
  const byId = new Map(movable.map((one) => [one.id, one]));
  const shownColumns = view.shown.map((id) => byId.get(id)).filter((one) => one !== undefined);

  if (notices.isError) {
    return <Alert tone="danger">{notices.error.message}</Alert>;
  }
  const overdue = notices.data?.overdue ?? 0;
  const sentThisMonth = notices.data?.sentThisMonth ?? 0;
  const lateThisMonth = notices.data?.lateThisMonth ?? 0;
  // What is still waiting to go, and when the earliest of it is due. The owed list is ordered by due date,
  // so the first row is the next one out.
  const owed = sent ? [] : rows;
  const owedNow = owed.length;
  const nextDue = owed[0]?.dueOn ?? null;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-[1.625rem] font-bold">Welcome &amp; risk-classification notice</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Once Compliance sign a client off, the firm has seven days to send them the welcome email, the Notice
          of Treatment letter, and the agreement and forms they signed.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <Tile label="Sent this month" value={sentThisMonth}>
          {sentThisMonth === 0
            ? "Nothing has gone out yet this month."
            : lateThisMonth === 0
              ? "All within the seven days."
              : `${lateThisMonth} went after the seven days were up.`}
        </Tile>
        <Tile label="Owed" value={owedNow}>
          {owedNow === 0 ? "Nothing is waiting to go." : `Next due ${nextDue ? formatDate(nextDue) : "—"}.`}
        </Tile>
        <Tile label="Overdue" value={overdue} tone={overdue > 0 ? "danger" : undefined}>
          {overdue === 0 ? "Nothing is past its seven days." : "The pack is owed from the day they were signed off."}
        </Tile>
      </div>

      <section className="rounded-2xl border border-line bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <h2 className="text-base font-bold">{sent ? "Sent" : "Notice queue"}</h2>
            <p className="mt-0.5 text-xs text-ink-muted">Due date = the day they were signed off, plus seven.</p>
          </div>
          {/* Which list, then how it is arranged: the two Owed and Sent buttons say what is in front of
              the reader, and the arrangement beside them says how they are reading it. */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-1">
              {([[false, "Owed"], [true, "Sent"]] as [boolean, string][]).map(([which, label]) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setSent(which)}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                    sent === which ? "bg-primary-100 text-ink" : "text-ink-muted hover:bg-canvas",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <ViewTabs
              views={view.views}
              current={view.current}
              edited={view.current === null ? view.arranged : view.changed}
              onPick={(name) => (name === null ? view.reset() : view.apply(name))}
              onSave={view.saveAs}
              onDelete={view.remove}
              firstLabel="Every notice"
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

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                <th scope="col" className="py-3 pr-4 pl-5">Client</th>
                {shownColumns.map((column, at) => (
                  <th
                    key={column.id}
                    scope="col"
                    {...drag.headingProps(column.id)}
                    className={cn(
                      "cursor-grab touch-none px-4 py-3 select-none",
                      column.align === "right" ? "text-right" : "text-left",
                      at === shownColumns.length - 1 && "pr-5",
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
              {!notices.data && (
                <tr>
                  <td colSpan={shownColumns.length + 1} className="px-5 py-8 text-center text-ink-muted">Loading…</td>
                </tr>
              )}
              {notices.data && rows.length === 0 && (
                <tr>
                  <td colSpan={shownColumns.length + 1} className="px-5 py-10 text-center text-ink-muted">
                    {sent
                      ? "No pack has gone out yet."
                      : "Nothing is owed. A client appears here the moment Compliance sign them off."}
                  </td>
                </tr>
              )}
              {paged.shown.map((notice) => (
                <tr key={notice.caseId} className={notice.overdue ? "bg-red-50/40" : undefined}>
                  <td className="py-3 pr-4 pl-5">
                    <Link to={`/onboarding/${notice.caseId}`} className="font-semibold hover:text-primary-600">
                      {notice.clientName}
                    </Link>
                    <p className="mt-0.5 text-xs text-ink-muted">
                      {notice.relationshipManager ?? "No relationship manager"}
                    </p>
                  </td>
                  {/* The cells in the order the headings are in, out of the one list that holds both. */}
                  {shownColumns.map((column, at) => (
                    <td
                      key={column.id}
                      className={cn(
                        "px-4 py-3",
                        column.align === "right" && "text-right",
                        column.nowrap && "whitespace-nowrap",
                        at === shownColumns.length - 1 && "pr-5",
                        column.tone,
                      )}
                    >
                      {column.cell(notice)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Outside the scrolling box, so the way through the queue does not slide sideways with the columns.
            The three counts above the table are the server's own figures for the whole queue and are
            unaffected by which page is being read. */}
        {rows.length > 0 && <PagedFooter paged={paged} noun={["notice", "notices"]} />}
      </section>

      <Dialog
        open={sending !== null}
        title="Has the pack gone to the client?"
        description={sending ? sending.clientName : null}
        onClose={() => setSending(null)}
      >
        {sending && (
          <SendForm notice={sending} onClose={() => setSending(null)} onSent={() => setSending(null)} />
        )}
      </Dialog>
    </div>
  );
}

/** How long is left, or how long it has been owed. */
function Standing({ notice }: { notice: NoticeRow }) {
  if (notice.overdue) {
    const over = Math.abs(notice.daysLeft);
    return <Badge tone="danger">{over === 1 ? "1 day over" : `${over} days over`}</Badge>;
  }
  if (notice.daysLeft === 0) return <Badge tone="warning">Due today</Badge>;
  return <Badge tone="neutral">{notice.daysLeft === 1 ? "1 day left" : `${notice.daysLeft} days left`}</Badge>;
}

/**
 * Saying the pack has gone. What went is the firm's own three things; this records that it did, and anything
 * worth saying about how.
 */
function SendForm({
  notice,
  onClose,
  onSent,
}: {
  notice: NoticeRow;
  onClose: () => void;
  onSent: () => void;
}) {
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");
  const mark = useMarkPostOnboardingNoticeSent<ApiError>({
    mutation: {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: getListPostOnboardingNoticesQueryKey() });
        onSent();
      },
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    mark.mutate({ caseId: notice.caseId, data: { note: note.trim() || null } });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {mark.error && <Alert tone="danger">{mark.error.message}</Alert>}

      <div className="rounded-xl border border-line bg-canvas px-4 py-3 text-sm">
        <p className="font-semibold text-ink">What the client is owed</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-ink-muted">
          <li>The welcome email</li>
          <li>
            {notice.customerId ? (
              <Link
                to={`/clients/${notice.customerId}/documents/NOTICE_OF_TREATMENT`}
                className="font-medium text-primary-700 hover:underline"
              >
                The Notice of Treatment letter
              </Link>
            ) : (
              "The Notice of Treatment letter"
            )}
            , saying how the firm classifies them
          </li>
          <li>
            {notice.customerId ? (
              <Link
                to={`/clients/${notice.customerId}`}
                state={{ tab: "documents" }}
                className="font-medium text-primary-700 hover:underline"
              >
                The agreement and every form they signed
              </Link>
            ) : (
              "The agreement and every form they signed"
            )}
          </li>
        </ul>
        <p className="mt-2 text-xs text-ink-muted">
          Owed by {formatDate(notice.dueOn)}, seven days after Compliance signed them off.
        </p>
      </div>

      <Field id="notice-note" label="Anything worth saying about it (optional)">
        <TextArea id="notice-note" rows={3} value={note} onChange={(event) => setNote(event.target.value)} />
      </Field>

      <div className="flex justify-end gap-3">
        <Button variant="ghost" onClick={onClose} disabled={mark.isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={mark.isPending}>
          {mark.isPending ? "Saving…" : "Yes, it has gone"}
        </Button>
      </div>
    </form>
  );
}

/** One of the counts above the queue: how many, and a line saying what that means. */
function Tile({
  label,
  value,
  tone,
  children,
}: {
  label: string;
  value: number;
  tone?: "danger";
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-line bg-white px-5 py-4">
      <p className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">{label}</p>
      <p className={cn("mt-1 text-3xl font-bold", tone === "danger" && value > 0 ? "text-red-600" : "text-ink")}>
        {value}
      </p>
      <p className="mt-0.5 text-xs text-ink-muted">{children}</p>
    </div>
  );
}
