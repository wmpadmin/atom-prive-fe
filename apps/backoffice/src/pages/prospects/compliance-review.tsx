import {
  decideProspectCompliance,
  decideProspectDocument,
  getGetProspectDocumentsQueryKey,
  getGetProspectQueryKey,
  getGetProspectReviewHistoryQueryKey,
  getGetProspectWealthQueryKey,
  getListProspectsQueryKey,
  reopenProspectCompliance,
  type ApprovalDecisionRequestReason,
  type ApprovalDetail,
  type ReviewEvent,
} from "@atomprive/api-client/backoffice";
import { Alert, Button, Field, SelectInput, TextArea, cn } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import { Check, X } from "lucide-react";
import { useState } from "react";
import { toFormErrors } from "../../lib/api-errors";
import { formatDateTime } from "../../lib/labels";

/**
 * Compliance's part of a prospect (23 Nov 2026), on the prospect's own page rather than a list of their own: each
 * document the desk sent verified or rejected where it is listed, then the whole approved (on to the agreement), sent
 * back with documents asked for, or rejected; and the history of every send and decision.
 */

export const REJECTION_REASONS: Record<ApprovalDecisionRequestReason & string, string> = {
  NET_WORTH_MISMATCH: "Net worth does not match submitted documents",
  INCOME_NOT_EVIDENCED: "Income not evidenced",
  DOCUMENT_UNCLEAR_OR_EXPIRED: "Document unclear or expired",
  IDENTITY_OR_ADDRESS_NOT_VERIFIED: "Identity or address not verified",
  OTHER: "Other",
};

const EVENT: Record<ReviewEvent["kind"], { label: string; tone: string }> = {
  SENT: { label: "Sent to Compliance", tone: "bg-primary-50 text-primary-700" },
  RESENT: { label: "Sent again", tone: "bg-primary-50 text-primary-700" },
  REVIEW_STARTED: { label: "Review started", tone: "bg-amber-50 text-amber-800" },
  MORE_DOCUMENTS: { label: "Documents asked", tone: "bg-orange-50 text-orange-700" },
  REJECTED: { label: "Rejected", tone: "bg-red-50 text-red-700" },
  REOPENED: { label: "Reopened", tone: "bg-violet-50 text-violet-700" },
  APPROVED: { label: "Approved", tone: "bg-emerald-50 text-emerald-700" },
};

/** Everything a decision changes, read again: the documents, the wealth, the prospect, its history and the list. */
export function useAfterCompliance(prospectId: string) {
  const queryClient = useQueryClient();
  return (next?: ApprovalDetail) => {
    if (next) {
      queryClient.setQueryData(getGetProspectDocumentsQueryKey(prospectId), next.documents);
      queryClient.setQueryData(getGetProspectWealthQueryKey(prospectId), next.wealth);
      queryClient.setQueryData(getGetProspectReviewHistoryQueryKey(prospectId), next.history);
    } else {
      void queryClient.invalidateQueries({ queryKey: getGetProspectDocumentsQueryKey(prospectId) });
      void queryClient.invalidateQueries({ queryKey: getGetProspectWealthQueryKey(prospectId) });
      void queryClient.invalidateQueries({ queryKey: getGetProspectReviewHistoryQueryKey(prospectId) });
    }
    void queryClient.invalidateQueries({ queryKey: getGetProspectQueryKey(prospectId) });
    void queryClient.invalidateQueries({ queryKey: getListProspectsQueryKey().slice(0, 1) });
  };
}

/** Verify or reject one document the desk sent, where it is listed. */
export function DecideDocument({ prospectId, documentId, fileName }: { prospectId: string; documentId: string; fileName: string }) {
  const after = useAfterCompliance(prospectId);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [problem, setProblem] = useState<string>();
  const [busy, setBusy] = useState(false);
  async function decide(verified: boolean) {
    setProblem(undefined);
    setBusy(true);
    try {
      after(await decideProspectDocument(prospectId, documentId, { verified, reason: verified ? null : reason.trim() || null }));
      setRejecting(false);
    } catch (caught) {
      const said = toFormErrors(caught);
      setProblem(said.fields.reason ?? said.form ?? "That didn't go through.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {!rejecting && (
        <>
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => void decide(true)}><Check aria-hidden="true" />Approve</Button>
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => setRejecting(true)}><X aria-hidden="true" />Reject</Button>
        </>
      )}
      {rejecting && (
        <span className="flex w-full flex-wrap items-center gap-2">
          <input aria-label={`Why ${fileName} is rejected`} value={reason} onChange={(event) => setReason(event.target.value)}
            placeholder="Why, for example a blurred scan" className="h-8 min-w-48 flex-1 rounded-lg border border-line bg-white px-2 text-xs" />
          <Button size="sm" disabled={busy} onClick={() => void decide(false)}>Reject</Button>
          <Button size="sm" variant="ghost" onClick={() => setRejecting(false)}>Cancel</Button>
        </span>
      )}
      {problem && <span className="w-full text-xs text-red-700">{problem}</span>}
    </span>
  );
}

type Ask = { customerId: string; paperName: string; instructions: string; dueOn: string };

/** Compliance's decision on the whole: approve (on to the agreement), ask for documents and send it back, or reject. */
export function ComplianceDecision({ prospectId, holders }: { prospectId: string; holders: { id: string; name: string }[] }) {
  const after = useAfterCompliance(prospectId);
  const [reason, setReason] = useState<ApprovalDecisionRequestReason & string>("DOCUMENT_UNCLEAR_OR_EXPIRED");
  const [note, setNote] = useState("");
  const [asks, setAsks] = useState<Ask[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  async function decide(outcome: "APPROVE" | "REQUEST_DOCUMENTS" | "REJECT") {
    setBusy(true);
    setErrors({});
    try {
      after(await decideProspectCompliance(prospectId, {
        outcome, reason: outcome === "APPROVE" ? null : reason, note: note.trim() || null,
        documents: outcome === "REQUEST_DOCUMENTS" ? asks.map((one) => ({
          customerId: one.customerId, paperName: one.paperName, instructions: one.instructions || null, dueOn: one.dueOn || null,
        })) : null,
      }));
    } catch (caught) {
      const said = toFormErrors(caught);
      setErrors({ ...said.fields, ...(said.form ? { form: said.form } : {}) });
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="rounded-2xl border border-primary-200 bg-primary-50/30 px-5 py-4" aria-labelledby="decision-title">
      <h3 id="decision-title" className="text-base font-bold">Compliance decision</h3>
      <p className="text-xs text-ink-muted">
        Approve once every required document is approved and the wealth table is checked: they go on to the agreement. Or ask for
        documents to send it back, or reject it.
      </p>
      {errors.form && <div className="mt-2"><Alert tone="danger">{errors.form}</Alert></div>}
      <div className="mt-3 grid gap-3 sm:grid-cols-[18rem_1fr]">
        <Field id="decision-reason" label="Reason, to send back or reject" error={errors.reason}>
          <SelectInput id="decision-reason" value={reason} onChange={(event) => setReason(event.target.value as typeof reason)}>
            {Object.entries(REJECTION_REASONS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </SelectInput>
        </Field>
        <Field id="decision-note" label="Comment (needed to send back or reject)" error={errors.note}>
          <TextArea id="decision-note" rows={2} maxLength={1000} value={note} onChange={(event) => setNote(event.target.value)}
            placeholder="The plot sale has no deed; the declared net worth is not supported." />
        </Field>
      </div>
      <div className="mt-3 space-y-2">
        <p className="text-sm font-semibold">Documents to ask for</p>
        {asks.map((one, i) => (
          <div key={i} className="grid gap-2 sm:grid-cols-[10rem_1fr_1fr_9rem_auto]">
            <select aria-label="Whose document" value={one.customerId} onChange={(event) => setAsks(asks.map((a, j) => j === i ? { ...a, customerId: event.target.value } : a))}
              className="h-9 rounded-lg border border-line bg-white px-2 text-sm">
              {holders.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
            </select>
            <input aria-label="Document" value={one.paperName} placeholder="Bank statement"
              onChange={(event) => setAsks(asks.map((a, j) => j === i ? { ...a, paperName: event.target.value } : a))}
              className="h-9 rounded-lg border border-line bg-white px-2 text-sm" />
            <input aria-label="Instructions" value={one.instructions} placeholder="Last six months"
              onChange={(event) => setAsks(asks.map((a, j) => j === i ? { ...a, instructions: event.target.value } : a))}
              className="h-9 rounded-lg border border-line bg-white px-2 text-sm" />
            <input aria-label="Due date" type="date" value={one.dueOn}
              onChange={(event) => setAsks(asks.map((a, j) => j === i ? { ...a, dueOn: event.target.value } : a))}
              className="h-9 rounded-lg border border-line bg-white px-2 text-sm" />
            <Button size="sm" variant="ghost" onClick={() => setAsks(asks.filter((_, j) => j !== i))}>Remove</Button>
            {Object.entries(errors).filter(([key]) => key.startsWith(`documents[${i}]`)).map(([key, said]) => (
              <p key={key} className="text-xs text-red-700 sm:col-span-5">{said}</p>
            ))}
          </div>
        ))}
        <Button size="sm" variant="secondary" onClick={() => setAsks([...asks, { customerId: holders[0]?.id ?? "", paperName: "", instructions: "", dueOn: "" }])}>
          Add a document to ask for
        </Button>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button id="decision-approve" disabled={busy} onClick={() => void decide("APPROVE")}><Check aria-hidden="true" />Approve everything</Button>
        <Button id="decision-more" variant="secondary" disabled={busy} onClick={() => void decide("REQUEST_DOCUMENTS")}>Ask for documents · send back</Button>
        <Button id="decision-reject" variant="ghost" disabled={busy} onClick={() => void decide("REJECT")}><X aria-hidden="true" />Reject</Button>
      </div>
    </section>
  );
}

/** A rejected profile taken up again: back to the desk to put right. */
export function ReopenCompliance({ prospectId }: { prospectId: string }) {
  const after = useAfterCompliance(prospectId);
  const [note, setNote] = useState("");
  const [problem, setProblem] = useState<string>();
  async function reopen() {
    setProblem(undefined);
    try {
      after(await reopenProspectCompliance(prospectId, { note: note.trim() || null }));
    } catch (caught) {
      setProblem(toFormErrors(caught).form ?? "That couldn't be reopened.");
    }
  }
  return (
    <section className="rounded-2xl border border-line bg-white px-5 py-4">
      <h3 className="text-base font-bold">Rejected by Compliance</h3>
      <p className="text-xs text-ink-muted">It stays a prospect. Reopen it to send it back to the desk to put right.</p>
      {problem && <div className="mt-2"><Alert tone="danger">{problem}</Alert></div>}
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <input aria-label="Why it is reopened" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Why (optional)"
          className="h-9 min-w-64 flex-1 rounded-lg border border-line bg-white px-2 text-sm" />
        <Button variant="secondary" onClick={() => void reopen()}>Reopen</Button>
      </div>
    </section>
  );
}

/** Every send and decision, oldest first. */
export function ReviewHistory({ events }: { events: ReviewEvent[] }) {
  if (events.length === 0) return null;
  return (
    <section className="rounded-2xl border border-line bg-white px-5 py-4" aria-labelledby="review-history">
      <h3 id="review-history" className="text-base font-bold">History with Compliance</h3>
      <ol className="mt-2 space-y-2 text-sm">
        {events.map((one, i) => (
          <li key={i} className="flex flex-wrap items-baseline gap-2">
            <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", EVENT[one.kind].tone)}>{EVENT[one.kind].label}</span>
            <span className="text-xs text-ink-muted">{formatDateTime(one.at)} · {one.by}</span>
            {one.reason && <span className="font-medium">{REJECTION_REASONS[one.reason]}</span>}
            {one.note && <span className="text-ink-soft">{one.kind === "REJECTED" ? `"${one.note}"` : one.note}</span>}
          </li>
        ))}
      </ol>
    </section>
  );
}
