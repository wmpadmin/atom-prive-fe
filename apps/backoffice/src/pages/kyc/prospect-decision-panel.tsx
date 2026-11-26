import type { ApiError } from "@atomprive/api-client";
import {
  getListProspectsForReviewQueryKey,
  useGetProspectDocuments,
  useGetProspectWealth,
  type DocumentsView,
  type ProspectReviewRow,
  type WealthView,
} from "@atomprive/api-client/backoffice";
import { Badge } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useEffect } from "react";
import { ComplianceDecision } from "../prospects/compliance-review";
import { WealthTables } from "../prospects/prospect-wealth";
import { reviewStateLabels, reviewStateTones } from "./kyc-labels";

const state = (value: string) => value as keyof typeof reviewStateTones;

/**
 * Compliance's final decision on a prospective client (24 Nov 2026), opened from the KYC review queue: the papers each
 * holder owes and where they stand, the wealth accumulation to check (read only), then Approve everything, ask for
 * documents, or reject. Compliance do not see the prospect's Documents, Wealth or Agreement tabs, so this is where the
 * whole is decided.
 */
export function ProspectDecisionPanel({ row, onClose }: { row: ProspectReviewRow; onClose: () => void }) {
  const queryClient = useQueryClient();
  const documents = useGetProspectDocuments<DocumentsView, ApiError>(row.prospectId);
  const wealth = useGetProspectWealth<WealthView, ApiError>(row.prospectId);
  const holders = (documents.data?.holders ?? []).map((one) => ({ id: one.customerId, name: one.name }));

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const decided = () => {
    void queryClient.invalidateQueries({ queryKey: getListProspectsForReviewQueryKey() });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} aria-hidden="true" />
      <section role="dialog" aria-modal="true" aria-label={`Final decision on ${row.fullName}`}
        className="absolute inset-y-0 right-0 flex w-full max-w-5xl flex-col bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-3 border-b border-line px-6 pt-5 pb-4">
          <div className="min-w-0">
            <p className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">Final decision</p>
            <h2 className="mt-1 truncate text-xl font-bold">{row.fullName}</h2>
            <p className="text-xs text-ink-muted">{row.reference}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-1.5 text-ink-muted hover:bg-canvas hover:text-ink" aria-label="Close">
            <X className="size-5" aria-hidden="true" />
          </button>
        </header>
        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <section aria-labelledby="decision-papers">
            <h3 id="decision-papers" className="text-base font-bold">Papers</h3>
            {documents.isError && <p className="mt-1 text-sm text-red-700">The papers couldn't be loaded.</p>}
            {!documents.data && !documents.isError && <p className="mt-1 text-sm text-ink-muted">Loading the papers…</p>}
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              {(documents.data?.holders ?? []).map((holder) => (
                <div key={holder.customerId} className="rounded-xl border border-line px-4 py-3">
                  <p className="text-sm font-semibold">{holder.name}
                    <span className="font-normal text-ink-muted"> · {holder.primary ? "primary holder" : "joint holder"}</span></p>
                  <ul className="mt-2 space-y-1.5 text-sm">
                    {holder.papers.filter((paper) => paper.required || paper.files.some((file) => file.sentAt)).map((paper) => {
                      const latest = paper.files.at(-1);
                      return (
                        <li key={paper.title} className="flex items-start justify-between gap-2">
                          <span className="min-w-0">{paper.title}{paper.required && <span className="text-red-700"> *</span>}</span>
                          {latest ? (
                            <Badge tone={reviewStateTones[state(latest.reviewState)] ?? "info"}>
                              {reviewStateLabels[state(latest.reviewState)] ?? latest.reviewState}
                            </Badge>
                          ) : <span className="shrink-0 text-xs text-ink-muted">No file</span>}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          {wealth.isError && <p className="text-sm text-red-700">The wealth accumulation couldn't be loaded.</p>}
          {!wealth.data && !wealth.isError && <p className="text-sm text-ink-muted">Loading the wealth accumulation…</p>}
          {wealth.data && <WealthTables prospectId={row.prospectId} prospectName={row.fullName} view={wealth.data} editable={false} />}

          {documents.data && <ComplianceDecision prospectId={row.prospectId} holders={holders} documentsAt={documents.dataUpdatedAt}
            onDecided={decided} />}
        </div>
      </section>
    </div>
  );
}
