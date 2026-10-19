import { ApiError } from "@atomprive/api-client";
import {
  useAnswerTheRestore,
  useListRestores,
  type RestoreQueue,
  type RestoreRow,
} from "@atomprive/api-client/backoffice";
import { Alert, Avatar, Badge, Button, FilterMenu } from "@atomprive/ui";
import { AnswerDialog } from "./answer-dialog";
import { useState } from "react";
import { Link } from "react-router";
import { formatDateTime } from "../../lib/labels";

/**
 * What a reader can narrow the list to, in the order an ask passes through them.
 *
 * <p>Cancelled stands apart from the two answers rather than sitting with them: an ask the person who
 * raised it took back was never answered by anybody.
 */
const STATUS_TABS = [
  { id: "PENDING", label: "Waiting for approval" },
  { id: "APPROVED", label: "Approved" },
  { id: "REJECTED", label: "Rejected" },
  { id: "WITHDRAWN", label: "Cancelled" },
  { id: "all", label: "Everything" },
] as const;

type StatusTab = (typeof STATUS_TABS)[number]["id"];

/** Money, written the way every other portfolio screen writes it. */
function exactly(amount: number, currency: string) {
  return `${currency} ${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Answering an ask to put a client's figures back to a version they stood at.
 *
 * <p>Its own queue rather than a second kind of row on the money moves one. The two are answered by the
 * same people under the same rules, but they are not the same question: a move is read by its legs, and
 * this is read by the difference between what the client comes to now and what they came to then.
 */
export function RestoresToApprovePage() {
  const queue = useListRestores<RestoreQueue, ApiError>({ query: { refetchOnWindowFocus: true } });
  const [status, setStatus] = useState<StatusTab>("PENDING");
  /** The ask being answered and which way, because both answers are given in the same window now. */
  const [deciding, setDeciding] = useState<{ row: RestoreRow; approved: boolean } | null>(null);
  const [note, setNote] = useState("");
  const [refused, setRefused] = useState<Record<string, string>>({});
  const answer = useAnswerTheRestore<ApiError>({
    mutation: {
      onSuccess: () => {
        setDeciding(null);
        setNote("");
        void queue.refetch();
      },
      // Kept on the row rather than thrown away in a notice that fades: both refusals this can give change
      // what the reader does next.
      onError: (error, variables) => {
        setRefused((was) => ({ ...was, [variables.id]: error.message }));
        void queue.refetch();
      },
    },
  });

  if (queue.isError) {
    return <Alert tone="danger">{queue.error.message}</Alert>;
  }

  const waiting = queue.data?.waiting ?? [];
  const decided = queue.data?.decided ?? [];
  // One list to filter, because an ask is in exactly one state and the two the server sends are only where
  // it put them. Ordered waiting-first so "Everything" opens on what is still being asked.
  const shown = status === "all"
    ? [...waiting, ...decided]
    : [...waiting, ...decided].filter((row) => row.status === status);

  return (
    <div className="space-y-5">

      {/* Two fixed sections told the reader what the screen had decided to show them: everything waiting,
          and however much of the rest it felt like keeping. Asked instead, the question has one answer at a
          time — and a rejection from last week is reachable without a section being built for it. */}
      <div className="w-fit">
        <span className="block text-2xs font-semibold tracking-wider text-ink-muted uppercase">Show</span>
        <FilterMenu
          label="Asks"
          value={status}
          options={STATUS_TABS.map((one) => ({
            id: one.id,
            label: one.label,
            count: one.id === "all"
              ? waiting.length + decided.length
              : [...waiting, ...decided].filter((row) => row.status === one.id).length,
          }))}
          onChange={setStatus}
        />
      </div>

      <section className="overflow-hidden rounded-2xl border border-line bg-white">
        <h2 className="border-b border-line px-5 py-3 text-2xs font-semibold tracking-wider text-ink-muted uppercase">
          {STATUS_TABS.find((one) => one.id === status)?.label}
        </h2>
        {queue.isPending ? (
          <p className="px-5 py-8 text-sm text-ink-muted">Reading the asks…</p>
        ) : shown.length === 0 ? (
          <p className="px-5 py-8 text-sm text-ink-muted">
            {status === "PENDING" ? "Nothing is waiting on you." : "Nothing here."}
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {shown.map((row) => (
              <li key={row.id} className="px-5 py-4">
                {/* An ask still waiting is a question, and one already decided is a record of one. The same
                    row cannot be both, so each is drawn as what it is. */}
                {row.status === "PENDING" ? (
                  <>
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="flex min-w-0 items-start gap-3">
                        <Avatar name={row.clientName} />
                        <div className="min-w-0">
                          <Link
                            to={`/portfolio-clients/${row.customerId}?tab=daily&from=restores`}
                            className="font-semibold underline-offset-2 hover:underline"
                          >
                            {row.clientName}
                          </Link>
                          <p className="font-mono text-xs text-ink-muted">{row.clientCode}</p>
                          {/* The reason first, because it is the thing whoever asked was told they would be
                              judged on. The figures are below it and they can be read. */}
                          <p className="mt-1 text-sm">{row.why}</p>
                          <p className="mt-2 text-sm text-ink-muted">
                            Back to {row.restoreTo} · version {row.fromRevision} · {row.linesThen}{" "}
                            {row.linesThen === 1 ? "sub-asset" : "sub-assets"}
                          </p>
                          {/* What the yes would actually do, which a date on its own does not say. */}
                          <p className="mt-1 text-sm">
                            <span className="text-ink-muted">Worth now </span>
                            <span className="font-medium tabular-nums">{exactly(row.worthNow, row.currency)}</span>
                            <span className="text-ink-muted"> · worth then </span>
                            <span className="font-medium tabular-nums">{exactly(row.worthThen, row.currency)}</span>
                          </p>
                          <p className="mt-2 text-xs text-ink-muted">
                            Asked by {row.raisedByName} · {formatDateTime(row.raisedAt)}
                          </p>
                          {row.changedAt && (
                            <p className="mt-1 text-xs font-medium text-amber-700">
                              Changed since it was asked · {formatDateTime(row.changedAt)}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-2">
                        {row.changedAt && <Badge tone="warning">Changed</Badge>}
                        {row.nobodyCloserCanAnswer && <Badge tone="warning">Nobody else can answer this</Badge>}
                        {row.mayAnswer ? (
                          <>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => {
                                setDeciding({ row, approved: false });
                                setNote("");
                              }}
                            >
                              Reject
                            </Button>
                            <Button
                              size="sm"
                              disabled={answer.isPending}
                              onClick={() => {
                                setDeciding({ row, approved: true });
                                setNote("");
                              }}
                            >
                              Approve and put them back
                            </Button>
                          </>
                        ) : (
                          <p className="max-w-56 text-xs text-ink-muted">
                            You asked for this one, so somebody else answers it.
                          </p>
                        )}
                      </div>
                    </div>
                    {refused[row.id] && (
                      <div className="mt-3">
                        <Alert tone="danger">{refused[row.id]}</Alert>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{row.clientName}</p>
                      <p className="mt-0.5 text-xs text-ink-muted">
                        Back to {row.restoreTo} · version {row.fromRevision} · {row.statusSaid}
                        {row.decidedByName && ` by ${row.decidedByName}`}
                        {row.decidedAt && ` · ${formatDateTime(row.decidedAt)}`}
                      </p>
                      {row.decisionNote && <p className="mt-1 text-xs text-ink-muted">{row.decisionNote}</p>}
                    </div>
                    <Badge tone={row.status === "APPROVED" ? "success" : "neutral"}>{row.statusSaid}</Badge>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <AnswerDialog
        open={deciding !== null}
        approved={deciding?.approved ?? false}
        title={deciding
          ? `${deciding.approved ? "Approve" : "Reject"} the restore for ${deciding.row.clientName}?`
          : "Answer it"}
        consequence={deciding?.approved
          ? "Every figure this client holds is written again as it stood."
          : "Nothing changes."}
        shownTo={deciding?.row.raisedByName}
        note={note}
        onNote={setNote}
        busy={answer.isPending}
        error={answer.isError ? answer.error.message : null}
        onClose={() => setDeciding(null)}
        onConfirm={() => deciding && answer.mutate({
          id: deciding.row.id,
          data: { approved: deciding.approved, note: note.trim() === "" ? null : note.trim() },
        })}
        confirm={deciding?.approved ? "Approve and put them back" : "Reject"}
        confirming={deciding?.approved ? "Putting them back…" : "Rejecting…"}
      >
        {deciding && (
          <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm">
            <p>{deciding.row.why}</p>
            <p className="mt-2 text-xs text-ink-muted">
              Back to {deciding.row.restoreTo} · version {deciding.row.fromRevision} ·{" "}
              {exactly(deciding.row.worthThen, deciding.row.currency)} then against{" "}
              {exactly(deciding.row.worthNow, deciding.row.currency)} now
            </p>
          </div>
        )}
      </AnswerDialog>
    </div>
  );
}
