import { ApiError } from "@atomprive/api-client";
import {
  useApproveDeactivation,
  useRejectDeactivation,
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

      {admin && <Decision customerId={customerId} clientName={clientName} ready={standing.clear} />}
    </div>
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
function Decision({ customerId, clientName, ready }: { customerId: string; clientName: string; ready: boolean }) {
  const [note, setNote] = useState("");
  const [confirming, setConfirming] = useState(false);
  const queryClient = useQueryClient();
  const done = () => {
    setNote("");
    setConfirming(false);
    void queryClient.invalidateQueries();
  };
  const approve = useApproveDeactivation<ApiError>({ mutation: { onSuccess: done } });
  const reject = useRejectDeactivation<ApiError>({ mutation: { onSuccess: done } });
  const busy = approve.isPending || reject.isPending;
  const failed = approve.error ?? reject.error;
  const said = note.trim();

  return (
    <section className="space-y-3 rounded-2xl border border-line bg-white px-6 py-5">
      <div>
        <h2 className="text-base font-bold">Final review</h2>
        <p className="mt-0.5 text-xs text-ink-muted">
          {ready
            ? "Approving takes the client off every list at once. Nothing is deleted, and they can be put back for ninety days."
            : "Approval opens once every desk has gone ahead. You can turn the request down at any time."}
        </p>
      </div>
      {failed && <Alert tone="danger">{failed.message}</Alert>}
      <Field
        id="final-review-note"
        label="Admin notes"
        hint="Optional to approve. Required to reject — it is all the desks will be told."
      >
        <TextArea
          id="final-review-note"
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
            disabled={busy || said.length === 0}
            onClick={() => reject.mutate({ customerId, data: { note: said } })}
          >
            {reject.isPending ? "Saving…" : "Reject deactivation"}
          </Button>
          <Button disabled={busy || !ready} onClick={() => setConfirming(true)}>
            Approve deactivation
          </Button>
        </div>
      )}
    </section>
  );
}
