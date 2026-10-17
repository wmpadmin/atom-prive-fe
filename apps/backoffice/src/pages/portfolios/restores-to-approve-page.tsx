import { ApiError } from "@atomprive/api-client";
import {
  useAnswerTheRestore,
  useListRestores,
  type RestoreQueue,
  type RestoreRow,
} from "@atomprive/api-client/backoffice";
import { Alert, Avatar, Badge, Button, Dialog, Field, TextArea } from "@atomprive/ui";
import { useState } from "react";
import { Link } from "react-router";
import { ListPageHeader } from "../../components/record-list";
import { formatDateTime } from "../../lib/labels";

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
  const [rejecting, setRejecting] = useState<RestoreRow | null>(null);
  const [note, setNote] = useState("");
  const [refused, setRefused] = useState<Record<string, string>>({});
  const answer = useAnswerTheRestore<ApiError>({
    mutation: {
      onSuccess: () => {
        setRejecting(null);
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

  return (
    <div className="space-y-5">
      <ListPageHeader
        title="Restores to approve"
        lead={"Asks to put a client's figures back to a version they stood at. Nothing has changed: saying "
          + "yes is what writes them."}
      />

      <section className="overflow-hidden rounded-2xl border border-line bg-white">
        <h2 className="border-b border-line px-5 py-3 text-2xs font-semibold tracking-wider text-ink-muted uppercase">
          Waiting for approval
        </h2>
        {queue.isPending ? (
          <p className="px-5 py-8 text-sm text-ink-muted">Reading the asks…</p>
        ) : waiting.length === 0 ? (
          <p className="px-5 py-8 text-sm text-ink-muted">Nothing is waiting on you.</p>
        ) : (
          <ul className="divide-y divide-line">
            {waiting.map((row) => (
              <li key={row.id} className="px-5 py-4">
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
                            setRejecting(row);
                            setNote("");
                          }}
                        >
                          Reject
                        </Button>
                        <Button
                          size="sm"
                          disabled={answer.isPending}
                          onClick={() => answer.mutate({ id: row.id, data: { approved: true, note: null } })}
                        >
                          {answer.isPending ? "Putting them back…" : "Approve and put them back"}
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
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* A queue that empties itself the moment somebody answers gives them nothing back: the row they
          have just decided on simply disappears, and the only thing left is its absence. */}
      {decided.length > 0 && (
        <section className="overflow-hidden rounded-2xl border border-line bg-white">
          {/* Not "answered": an ask the person who raised it cancelled was never answered by anybody, and
              it sits in this list too. */}
          <h2 className="border-b border-line px-5 py-3 text-2xs font-semibold tracking-wider text-ink-muted uppercase">
            Recently decided
          </h2>
          <ul className="divide-y divide-line">
            {decided.map((row) => (
              <li key={row.id} className="flex flex-wrap items-start justify-between gap-4 px-5 py-3">
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
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* The note is collected against what it refuses, so somebody writing it can see what they are
          rejecting rather than remembering it. */}
      <Dialog
        open={rejecting !== null}
        title={rejecting ? `Reject the restore for ${rejecting.clientName}?` : "Reject it"}
        onClose={() => setRejecting(null)}
      >
        <div className="space-y-4">
          {rejecting && (
            <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm">
              <p>{rejecting.why}</p>
              <p className="mt-2 text-xs text-ink-muted">
                Back to {rejecting.restoreTo} · version {rejecting.fromRevision} ·{" "}
                {exactly(rejecting.worthThen, rejecting.currency)} then against{" "}
                {exactly(rejecting.worthNow, rejecting.currency)} now
              </p>
            </div>
          )}
          <p className="text-sm text-ink-muted">
            Nothing changes. What you write here is shown to {rejecting?.raisedByName}.
          </p>
          <Field id="reject-restore-note" label="Why not?" required>
            <TextArea
              id="reject-restore-note"
              rows={3}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setRejecting(null)}>
              Cancel
            </Button>
            <Button
              disabled={note.trim() === "" || answer.isPending}
              onClick={() =>
                rejecting && answer.mutate({ id: rejecting.id, data: { approved: false, note: note.trim() } })
              }
            >
              {answer.isPending ? "Rejecting…" : "Reject"}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
