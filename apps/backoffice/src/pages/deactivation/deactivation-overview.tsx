import { ApiError } from "@atomprive/api-client";
import {
  useApproveDeactivation,
  useRejectDeactivation,
  useWithdrawDeactivation,
  type RequestClearances,
} from "@atomprive/api-client/backoffice";
import { Alert, Button, Field, StatCard, TextArea } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import { CircleCheck, CircleDashed, Lock } from "lucide-react";
import { useState, type ReactNode } from "react";
import { formatDate, formatDateTime } from "../../lib/labels";
import { deadlineSaid } from "./clearance-labels";

/** The longest a note can be, as the API allows. */
const MOST = 2000;

/**
 * The deactivation at a glance, and — for the Admin — the place it is decided.
 *
 * <p>The decision sits under the facts it rests on rather than in a window over another screen, so the
 * Admin answers with the counts and the dates in front of them instead of remembered from a list.
 */
export function DeactivationOverview({
  customerId,
  clientName,
  standing,
  admin,
  owesAnswer,
  onAnswer,
}: {
  customerId: string;
  clientName: string;
  standing: RequestClearances;
  admin: boolean;
  /** Whether the reader holds a desk that has not gone ahead yet. */
  owesAnswer: boolean;
  onAnswer: () => void;
}) {
  const blocked = standing.roles.filter((one) => one.standing === "BLOCKED").length;
  const out = standing.asked - standing.cleared - blocked;
  const days = deadlineSaid(standing.daysLeft, standing.overdue);

  return (
    <div className="space-y-4">
      {standing.clear ? (
        <Alert tone="success">
          <span className="font-semibold">Every desk has gone ahead.</span> This client is ready for the
          Admin's final review.
        </Alert>
      ) : blocked > 0 ? (
        <Alert tone="danger">
          {blocked === 1 ? "One desk has" : `${blocked} desks have`} blocked this. It cannot go to the Admin
          until they go ahead.
        </Alert>
      ) : null}

      {owesAnswer && (
        <Alert tone="warning">
          <span className="flex flex-wrap items-center justify-between gap-3">
            <span>Your desk has not gone ahead on this client yet.</span>
            <Button size="sm" onClick={onAnswer}>
              Give your answer
            </Button>
          </span>
        </Alert>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard icon={<CircleCheck />} value={`${standing.cleared} / ${standing.asked}`} label="desks cleared" />
        <StatCard icon={<CircleDashed />} value={out} label="still out" />
        <StatCard icon={<Lock />} value={blocked} label="blocked" />
      </div>

      {/* Hairlines between the facts are the line colour showing through a one-pixel gap. */}
      <section className="overflow-hidden rounded-2xl border border-line bg-line">
        <dl className="grid gap-px sm:grid-cols-2">
          <Fact label="Reference" value={standing.reference} wide />
          <Fact label="Requested by" value={standing.askedByName ?? "—"} />
          <Fact label="Requested on" value={formatDateTime(standing.askedAt)} />
          <Fact
            label="Clearance deadline"
            value={
              standing.deadline ? (
                <>
                  {formatDate(standing.deadline)}
                  {days && (
                    <span className={standing.overdue ? "ml-2 text-danger" : "ml-2 text-ink-muted"}>· {days}</span>
                  )}
                </>
              ) : (
                "Not set yet"
              )
            }
          />
          <Fact
            label="All clearances completed on"
            value={standing.clearedAt ? formatDateTime(standing.clearedAt) : "Not yet"}
          />
          <Fact label="Reason" value={standing.reason ?? "None given"} wide />
          {standing.instructions && <Fact label="Operations' instructions" value={standing.instructions} wide />}
        </dl>
      </section>

      {/* Whoever raised it, or an Admin (24 Nov 2026): the server says who, so the card shows only where it works. */}
      {standing.mayWithdraw && <Withdraw customerId={customerId} />}

      {admin && (
        <Decision
          customerId={customerId}
          clientName={clientName}
          ready={standing.clear}
          permanent={standing.restoredBefore}
        />
      )}
    </div>
  );
}

/**
 * Taking the request back (24 Nov 2026), for whoever raised it or an Admin. The reason is required: the desks
 * asked stop their work on it and are told why, at the bell.
 */
function Withdraw({ customerId }: { customerId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  // Withdraw pressed with no reason: the box shows in red until one is typed.
  const [tried, setTried] = useState(false);
  const queryClient = useQueryClient();
  const withdraw = useWithdrawDeactivation<ApiError>({
    mutation: { onSuccess: () => void queryClient.invalidateQueries() },
  });
  const said = reason.trim();
  const noReason = tried && said.length === 0;
  const close = () => {
    setOpen(false);
    setReason("");
    setTried(false);
    withdraw.reset();
  };

  return (
    <section className="space-y-3 rounded-2xl border border-line bg-white px-6 py-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold">Withdraw this request</h2>
          <p className="mt-0.5 text-xs text-ink-muted">
            Closes the request. The desks asked and Operations are told, with your reason.
          </p>
        </div>
        {!open && (
          <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
            Withdraw request
          </Button>
        )}
      </div>
      {open && (
        <>
          {withdraw.error && <Alert tone="danger">{withdraw.error.message}</Alert>}
          <Field
            id="withdraw-reason"
            label="Why are you withdrawing it?"
            required
            error={noReason ? "Enter a reason to withdraw." : undefined}
          >
            <TextArea
              id="withdraw-reason"
              aria-invalid={noReason || undefined}
              rows={2}
              maxLength={MOST}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Client decided to stay after the review call"
            />
          </Field>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" disabled={withdraw.isPending} onClick={close}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={withdraw.isPending}
              onClick={() => {
                if (said.length === 0) {
                  setTried(true);
                  document.getElementById("withdraw-reason")?.focus();
                  return;
                }
                withdraw.mutate({ customerId, data: { reason: said } });
              }}
            >
              {withdraw.isPending ? "Withdrawing…" : "Withdraw request"}
            </Button>
          </div>
        </>
      )}
    </section>
  );
}

function Fact({ label, value, wide }: { label: string; value: ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? "bg-white px-6 py-4 sm:col-span-2" : "bg-white px-6 py-4"}>
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold text-ink">{value}</dd>
    </div>
  );
}

/**
 * The Admin's answer.
 *
 * <p>The note is optional to approve and required to reject, as on the requests screen: refusing is the
 * only thing the desks will be told. Approving asks once more, because the client leaves every list in
 * the firm the moment it lands.
 */
function Decision({
  customerId,
  clientName,
  ready,
  permanent,
}: {
  customerId: string;
  clientName: string;
  ready: boolean;
  /** Restored once before (24 Nov 2026): approving archives them for good, with no window to put them back. */
  permanent: boolean;
}) {
  const [note, setNote] = useState("");
  const [confirming, setConfirming] = useState(false);
  // Reject pressed with no note: the box shows in red until one is typed.
  const [tried, setTried] = useState(false);
  const queryClient = useQueryClient();
  const done = () => {
    setNote("");
    setTried(false);
    setConfirming(false);
    void queryClient.invalidateQueries();
  };
  const approve = useApproveDeactivation<ApiError>({ mutation: { onSuccess: done } });
  const reject = useRejectDeactivation<ApiError>({ mutation: { onSuccess: done } });
  const busy = approve.isPending || reject.isPending;
  const failed = approve.error ?? reject.error;
  const said = note.trim();
  const noReason = tried && said.length === 0;

  return (
    <section className="space-y-3 rounded-2xl border border-line bg-white px-6 py-5">
      <div>
        <h2 className="text-base font-bold">Final review</h2>
        <p className="mt-0.5 text-xs text-ink-muted">
          {ready
            ? permanent
              ? "Approving takes the client off every list at once. Nothing is deleted."
              : "Approving takes the client off every list at once. Nothing is deleted, and they can be put back for ninety days."
            : "Approval opens once every desk has gone ahead. You can turn the request down at any time."}
        </p>
      </div>
      {permanent && (
        <Alert tone="warning">
          This client was restored once before, so approving is permanent: they cannot be put back again.
        </Alert>
      )}
      {failed && <Alert tone="danger">{failed.message}</Alert>}
      <Field
        id="final-review-note"
        label="Admin notes"
        hint="Optional to approve. Required to reject — it is all the desks will be told."
        error={noReason ? "Enter a reason to reject." : undefined}
      >
        <TextArea
          id="final-review-note"
          aria-invalid={noReason || undefined}
          rows={3}
          maxLength={MOST}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Anything to add before approving or rejecting."
        />
      </Field>
      {confirming ? (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <span className="mr-auto text-sm font-semibold">Deactivate {clientName}?</span>
          <Button variant="secondary" disabled={busy} onClick={() => setConfirming(false)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            disabled={busy}
            onClick={() => approve.mutate({ customerId, data: { note: said || null } })}
          >
            {approve.isPending ? "Saving…" : "Yes, deactivate"}
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => {
              if (said.length === 0) {
                setTried(true);
                document.getElementById("final-review-note")?.focus();
                return;
              }
              reject.mutate({ customerId, data: { note: said } });
            }}
          >
            {reject.isPending ? "Saving…" : "Reject deactivation"}
          </Button>
          <Button disabled={busy || !ready} onClick={() => { setTried(false); setConfirming(true); }}>
            Approve deactivation
          </Button>
        </div>
      )}
    </section>
  );
}
