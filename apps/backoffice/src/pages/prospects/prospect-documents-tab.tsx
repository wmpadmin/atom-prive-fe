import { ApiError } from "@atomprive/api-client";
import {
  convertProspect,
  getGetProspectQueryKey,
  getListProspectsQueryKey,
  useGetProspectDocuments,
  useGetProspectReviewHistory,
  type DocumentsView,
  type ProspectDetail,
  type ReviewEvent,
} from "@atomprive/api-client/backoffice";
import { Alert, Button } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useStaffUser } from "../../auth/session";
import { toFormErrors } from "../../lib/api-errors";
import { hasAuthority } from "../../lib/permissions";
import { ComplianceDecision, ReopenCompliance, ReviewHistory } from "./compliance-review";
import { ProspectDocuments } from "./prospect-documents";

/**
 * The Documents tab of a prospect (23 Nov 2026): open from the day they are added. The desk uploads and sends to
 * Compliance; Compliance approve or reject each document here, then decide on the whole; the history of both is below.
 */
export function ProspectDocumentsTab({ detail }: { detail: ProspectDetail }) {
  const user = useStaffUser();
  const mayDecide = hasAuthority(user, "APPROVE_ONBOARDING:CHANGE");
  const row = detail.prospect;
  // Add a document pressed before the documents were set up: the box opens once they are (23 Nov 2026).
  const [startAdding, setStartAdding] = useState(false);
  if (!detail.onboardingCaseId) {
    // The document list shows straight away (24 Nov 2026), an entity's and a person's alike: no Add a document press
    // first. A person's joint holders can still be named afterwards, on the Account holders tab, and get their own list.
    if (detail.mayConvert) return <OpenStraightAway detail={detail} />;
    return <NotStarted detail={detail} onStarted={() => setStartAdding(true)} />;
  }
  return <Started prospectId={row.id} mayChange={detail.mayChange} mayDecide={mayDecide} startAdding={startAdding} />;
}

/** Sets an entity's documents up as soon as the tab opens, so the list of documents to upload shows at once. */
function OpenStraightAway({ detail }: { detail: ProspectDetail }) {
  const queryClient = useQueryClient();
  const asked = useRef(false);
  const [problem, setProblem] = useState<string>();
  useEffect(() => {
    if (asked.current) return;
    asked.current = true;
    void (async () => {
      try {
        await convertProspect(detail.prospect.id);
        await queryClient.invalidateQueries({ queryKey: getGetProspectQueryKey(detail.prospect.id) });
        void queryClient.invalidateQueries({ queryKey: getListProspectsQueryKey().slice(0, 1) });
      } catch (caught) {
        setProblem(toFormErrors(caught).form ?? "The documents couldn't be opened.");
      }
    })();
  }, [detail.prospect.id, queryClient]);
  if (problem) return <Alert tone="danger">{problem}</Alert>;
  return <p className="text-sm text-ink-muted">Loading the documents…</p>;
}

/** Nothing uploaded yet: Add a document sets the documents up for every holder named on the prospect, then opens the box. */
function NotStarted({ detail, onStarted }: { detail: ProspectDetail; onStarted: () => void }) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string>();
  async function start() {
    setBusy(true);
    setProblem(undefined);
    try {
      await convertProspect(detail.prospect.id);
      onStarted();
      await queryClient.invalidateQueries({ queryKey: getGetProspectQueryKey(detail.prospect.id) });
      void queryClient.invalidateQueries({ queryKey: getListProspectsQueryKey().slice(0, 1) });
    } catch (caught) {
      setProblem(toFormErrors(caught).form ?? "The documents couldn't be opened.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="space-y-3 rounded-2xl border border-dashed border-line bg-white px-5 py-8 text-center">
      <p className="text-sm text-ink-muted">No documents yet.</p>
      {problem && <Alert tone="danger">{problem}</Alert>}
      {detail.mayConvert ? (
        <Button disabled={busy} onClick={() => void start()}><Plus aria-hidden="true" />{busy ? "Opening…" : "Add a document"}</Button>
      ) : (
        <p className="text-xs text-ink-muted">The relationship manager or Operations upload them.</p>
      )}
    </section>
  );
}

function Started({ prospectId, mayChange, mayDecide, startAdding }: { prospectId: string; mayChange: boolean; mayDecide: boolean; startAdding: boolean }) {
  const documents = useGetProspectDocuments<DocumentsView, ApiError>(prospectId);
  const history = useGetProspectReviewHistory<ReviewEvent[], ApiError>(prospectId);
  const stage = documents.data?.stage;
  const holders = (documents.data?.holders ?? []).map((one) => ({ id: one.customerId, name: one.name }));
  return (
    <div className="space-y-4">
      <ProspectDocuments prospectId={prospectId} mayChange={mayChange} mayDecide={mayDecide} startAdding={startAdding} />
      {mayDecide && (stage === "WITH_COMPLIANCE" || stage === "COMPLIANCE_REVIEW") && (
        <ComplianceDecision prospectId={prospectId} holders={holders} documentsAt={documents.dataUpdatedAt} />
      )}
      {mayDecide && stage === "REJECTED" && <ReopenCompliance prospectId={prospectId} />}
      {stage === "AGREEMENT_PENDING" && (
        <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm text-emerald-800">
          Compliance approved every document and the wealth accumulation. Next: the agreement, signed by the client and the Admin.
        </p>
      )}
      <ReviewHistory events={history.data ?? []} />
    </div>
  );
}
