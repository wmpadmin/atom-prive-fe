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
import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { useStaffUser } from "../../auth/session";
import { formatDate, formatDateTime } from "../../lib/labels";
import { hasAnyAuthority, ONBOARDS_CLIENTS_CHANGE } from "../../lib/permissions";

/**
 * What every signed-off client is owed (#N). Compliance sign a client off; the firm then has seven days to
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

  if (notices.isError) {
    return <Alert tone="danger">{notices.error.message}</Alert>;
  }
  const rows = notices.data?.items ?? [];
  const overdue = notices.data?.overdue ?? 0;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-[1.625rem] font-bold">Post onboarding notice</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Once Compliance sign a client off, the firm has seven days to send them the welcome email, the Notice
          of Treatment letter, and the agreement and forms they signed.
        </p>
      </header>

      {overdue > 0 && !sent && (
        <Alert tone="danger">
          <span className="font-semibold">
            {overdue === 1 ? "One client is" : `${overdue} clients are`} past their seven days.
          </span>{" "}
          The pack is owed from the day Compliance signed them off.
        </Alert>
      )}

      <section className="rounded-2xl border border-line bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
          <h2 className="text-base font-bold">{sent ? "Sent" : "Owed to the client"}</h2>
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
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                <th scope="col" className="py-3 pr-4 pl-5">Client</th>
                <th scope="col" className="px-4 py-3">Signed off</th>
                <th scope="col" className="px-4 py-3">{sent ? "Sent" : "Owed by"}</th>
                <th scope="col" className="px-4 py-3">{sent ? "Sent by" : "Standing"}</th>
                <th scope="col" className="py-3 pr-5 pl-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {!notices.data && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-ink-muted">Loading…</td>
                </tr>
              )}
              {notices.data && rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-ink-muted">
                    {sent
                      ? "No pack has gone out yet."
                      : "Nothing is owed. A client appears here the moment Compliance sign them off."}
                  </td>
                </tr>
              )}
              {rows.map((notice) => (
                <tr key={notice.caseId} className={notice.overdue ? "bg-red-50/40" : undefined}>
                  <td className="py-3 pr-4 pl-5">
                    <Link to={`/onboarding/${notice.caseId}`} className="font-semibold hover:text-primary-600">
                      {notice.clientName}
                    </Link>
                    {notice.note ? (
                      <p className="mt-0.5 truncate text-sm text-ink-muted">{notice.note}</p>
                    ) : (
                      notice.customerId && (
                        <Link
                          to={`/clients/${notice.customerId}/documents/NOTICE_OF_TREATMENT`}
                          className="mt-0.5 block text-sm font-medium text-primary-700 hover:underline"
                        >
                          Open the Notice of Treatment
                        </Link>
                      )
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-ink-soft">{formatDate(notice.approvedAt)}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-ink-soft">
                    {sent ? (notice.sentAt ? formatDateTime(notice.sentAt) : "—") : formatDate(notice.dueOn)}
                  </td>
                  <td className="px-4 py-3">
                    {sent ? (
                      <span className="text-ink-soft">{notice.sentByName ?? "—"}</span>
                    ) : (
                      <Standing notice={notice} />
                    )}
                  </td>
                  <td className="py-3 pr-5 pl-4 text-right">
                    {!sent && canSend && (
                      <Button variant="ghost" size="sm" onClick={() => setSending(notice)}>
                        <Check aria-hidden="true" />
                        Mark as sent
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
