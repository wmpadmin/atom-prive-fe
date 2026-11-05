import { ApiError } from "@atomprive/api-client";
import {
  useApproveDeactivation,
  useListDeactivations,
  useRejectDeactivation,
  type DeactivationQueue,
  type DeactivationRow,
} from "@atomprive/api-client/backoffice";
import { Alert, Badge, Button, Dialog, Field, TextArea } from "@atomprive/ui";
import { keepPreviousData, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router";
import { formatDate, formatDateTime } from "../../lib/labels";

const toneOf: Record<DeactivationRow["status"], "warning" | "danger" | "neutral" | "success"> = {
  ASKED: "warning",
  APPROVED: "danger",
  REJECTED: "neutral",
  WITHDRAWN: "neutral",
};

/** The longest a note can be, as the API allows. */
const MOST = 2000;

/**
 * Clients the desks have asked the firm to stop acting for.
 *
 * <p>The Admin's alone, and the client is untouched until they answer: a request sitting here changes
 * nothing, which is why the desks can raise one without the client noticing.
 *
 * <p>Two answers, not one. Approving archives the client out of everybody else's sight; turning it down
 * leaves them exactly as they were and owes the desk a reason, because a desk told no by a screen that
 * says nothing has been told nothing.
 */
export function DeactivationRequestsPage() {
  const [decided, setDecided] = useState(false);
  const [answering, setAnswering] = useState<{ row: DeactivationRow; agreeing: boolean } | null>(null);
  const queue = useListDeactivations<DeactivationQueue, ApiError>(
    { decided },
    { query: { placeholderData: keepPreviousData } },
  );
  const rows = queue.data?.items ?? [];

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-[1.625rem] font-bold">Deactivation requests</h1>
        <p className="mt-1 max-w-[84ch] text-sm text-ink-muted">
          Clients a relationship manager or Operations has asked the firm to stop acting for. Nothing happens
          to the client until you answer.
        </p>
      </header>

      {queue.isError && <Alert tone="danger">{queue.error.message}</Alert>}

      {/* Waiting first, because this screen exists to be emptied. */}
      <div role="tablist" aria-label="Which requests" className="flex gap-1 border-b border-line">
        {[
          { id: false, label: `Waiting on you${queue.data ? ` · ${queue.data.awaiting}` : ""}` },
          { id: true, label: "Answered" },
        ].map((one) => (
          <button
            key={String(one.id)}
            type="button"
            role="tab"
            aria-selected={decided === one.id}
            onClick={() => setDecided(one.id)}
            className={
              decided === one.id
                ? "-mb-px border-b-2 border-primary-600 px-3 py-2 text-sm font-semibold text-primary-700"
                : "-mb-px border-b-2 border-transparent px-3 py-2 text-sm font-semibold text-ink-muted hover:text-ink"
            }
          >
            {one.label}
          </button>
        ))}
      </div>

      {queue.isPending && <p className="text-sm text-ink-muted">Reading the requests…</p>}

      {queue.data && (
        <div className="overflow-x-auto rounded-2xl border border-line bg-white">
          <table className="w-full">
            <thead>
              <tr className="border-b border-line bg-slate-50 text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                <th className="px-4 py-2.5 text-left">Client</th>
                <th className="px-4 py-2.5 text-left">Asked by</th>
                <th className="px-4 py-2.5 text-left">Why</th>
                <th className="px-4 py-2.5 text-left">Standing</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {/* The headings stay when there is nothing to put under them. A table that vanishes
                  leaves a sentence floating on an empty screen, and the reader cannot tell an empty
                  queue from a screen that failed to draw. */}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm text-ink-muted">
                    {decided ? "Nothing has been answered yet." : "Nobody has asked for a client to be deactivated."}
                  </td>
                </tr>
              )}
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-line align-top last:border-0">
                  <td className="px-4 py-3">
                    {/* Still everybody's client while the request waits, so their file is still a click away. */}
                    <Link
                      to={`/clients/${row.customerId}`}
                      className="text-sm font-bold text-ink hover:text-primary-700 hover:underline"
                    >
                      {row.clientName}
                    </Link>
                    <span className="block text-xs text-ink-muted">{row.clientCode}</span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {row.askedByName ?? "—"}
                    <span className="block text-xs text-ink-muted">
                      {formatDate(row.askedAt.slice(0, 10))}
                    </span>
                  </td>
                  <td className="max-w-[46ch] px-4 py-3">
                    <p className="text-sm text-ink-soft italic">{row.reason ?? "No reason given."}</p>
                    {row.decisionNote && (
                      <p className="mt-1 text-xs text-ink-muted">
                        You said: {row.decisionNote}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={toneOf[row.status]}>{row.statusSaid}</Badge>
                    {row.decidedAt && (
                      <span className="mt-1 block text-xs text-ink-muted">
                        {row.decidedByName} · {formatDateTime(row.decidedAt)}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {row.status === "ASKED" && (
                      <span className="inline-flex gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setAnswering({ row, agreeing: false })}
                        >
                          Turn down
                        </Button>
                        <Button variant="danger" size="sm" onClick={() => setAnswering({ row, agreeing: true })}>
                          Deactivate
                        </Button>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Answer answering={answering} onClose={() => setAnswering(null)} />
    </div>
  );
}

/**
 * The one window both answers are given in.
 *
 * <p>The note is optional on an approval and required on a refusal. Agreeing with a desk needs no
 * explaining — their own reason is already on the record and is what was agreed to. Refusing them does:
 * it is the only thing the desk will be told, and the only thing the next reader of this client's file
 * will find when they wonder why the client is still here.
 */
function Answer({
  answering,
  onClose,
}: {
  answering: { row: DeactivationRow; agreeing: boolean } | null;
  onClose: () => void;
}) {
  const [note, setNote] = useState("");
  const queryClient = useQueryClient();
  const done = () => {
    setNote("");
    void queryClient.invalidateQueries();
    onClose();
  };
  const approve = useApproveDeactivation<ApiError>({ mutation: { onSuccess: done } });
  const reject = useRejectDeactivation<ApiError>({ mutation: { onSuccess: done } });
  const busy = approve.isPending || reject.isPending;
  const failed = approve.error ?? reject.error;
  const agreeing = answering?.agreeing === true;
  const said = note.trim();

  return (
    <Dialog
      open={answering !== null}
      title={
        answering
          ? agreeing
            ? `Deactivate ${answering.row.clientName}?`
            : `Turn down the request for ${answering.row.clientName}?`
          : ""
      }
      description={
        agreeing
          ? "They leave every list and every queue in the firm at once. Only you will be able to see them, in Archived clients. Nothing of theirs is deleted, and you can put them back for ninety days."
          : "The client carries on exactly as they are, and whoever asked is told why."
      }
      onClose={() => {
        setNote("");
        approve.reset();
        reject.reset();
        onClose();
      }}
    >
      <div className="space-y-3">
        {failed && <Alert tone="danger">{failed.message}</Alert>}
        <Field
          id="deactivation-note"
          label={agreeing ? "Anything to add" : "Why"}
          required={!agreeing}
          hint={
            agreeing
              ? "Optional. The desk's own reason is already on the record."
              : "Required. This is all the desk will be told."
          }
        >
          <TextArea
            id="deactivation-note"
            rows={3}
            maxLength={MOST}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder={
              agreeing
                ? "Settled and closed on the custodian's side too."
                : "Three months of silence is not a closure — chase them again first."
            }
          />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant={agreeing ? "danger" : "primary"}
            disabled={busy || !answering || (!agreeing && said.length === 0)}
            onClick={() => {
              if (!answering) return;
              const customerId = answering.row.customerId;
              if (agreeing) {
                approve.mutate({ customerId, data: { note: said || null } });
                return;
              }
              reject.mutate({ customerId, data: { note: said } });
            }}
          >
            {busy ? "Saving…" : agreeing ? "Deactivate the client" : "Turn it down"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
