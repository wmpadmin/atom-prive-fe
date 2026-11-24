import type { ApiError } from "@atomprive/api-client";
import {
  getGetClientKycFileQueryKey,
  getReadKycDocumentUrl,
  useGetClientKycFile,
  type ClientKycFile,
  type HolderPapers,
  type KycRequirement,
  type PaperLine,
} from "@atomprive/api-client/backoffice";
import { Alert, Badge, Button, cn } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import { CircleCheck, CircleDashed, CircleX, Clock, Download, FileText, Plus, TriangleAlert, Upload } from "lucide-react";
import { useState } from "react";
import { useStaffUser } from "../../auth/session";
import { FileViewer } from "../../components/file-viewer";
import { saveApiFile } from "../../lib/download";
import { formatDate, formatRelative } from "../../lib/labels";
import { hasAnyAuthority } from "../../lib/permissions";
import { reviewStateLabels, reviewStateTones } from "../kyc/kyc-labels";
import { AddDocumentDialog, api } from "../prospects/prospect-documents";

const STANDS: Record<KycRequirement["stands"], { label: string; tone: "info" | "warning" | "success" | "danger" | "neutral" }> = {
  NOT_SENT: { label: "Still needed", tone: "neutral" },
  AWAITING_REVIEW: { label: "With Compliance", tone: "warning" },
  RE_UPLOAD_REQUESTED: { label: "Re-upload asked for", tone: "warning" },
  REJECTED: { label: "Rejected", tone: "danger" },
  APPROVED: { label: "Approved", tone: "success" },
  EXPIRED: { label: "Expired", tone: "danger" },
};

/**
 * A client's Documents tab (24 Nov 2026): every KYC paper on their file, one line each, with the file, its expiry and
 * where it stands. When a paper runs out the relationship manager, or Operations, uploads the current copy here; it
 * goes to Compliance, who approve or reject it from the KYC review queue's All clients tab.
 */
export function ClientDocumentsTab({ clientId }: { clientId: string }) {
  const user = useStaffUser();
  const queryClient = useQueryClient();
  const file = useGetClientKycFile<ClientKycFile, ApiError>(clientId);
  const mayUpload = hasAnyAuthority(user, "UPLOAD_CLIENT_DOCUMENTS:CHANGE", "UPLOAD_CLIENT_DOCUMENTS:OWN_CLIENTS",
    "UPLOAD_CLIENT_DOCUMENTS:ASSIGNED");
  const [uploading, setUploading] = useState<{ only?: PaperLine } | null>(null);
  const [viewing, setViewing] = useState<{ url: string; fileName: string } | null>(null);

  if (file.isError) return <Alert tone="danger">{file.error.message}</Alert>;
  if (!file.data) return <p className="text-sm text-ink-muted">Loading the documents…</p>;
  const data = file.data;
  const listed = new Set(data.checklist.map((one) => one.documentId).filter(Boolean));
  // Papers on file that are not the current copy of a checklist line: a new copy waiting on Compliance, an extra paper.
  const others = data.documents.filter((one) => !listed.has(one.id));
  const expired = data.checklist.filter((one) => one.stands === "EXPIRED");

  // The upload box takes the prospect's shape of a person and their papers; a client's checklist is put in it.
  const asLine = (one: KycRequirement): PaperLine => ({
    kind: one.kind ?? null, title: one.kindTitle, required: !one.exceptional, files: [], instructions: null, dueOn: null,
    requested: false, expiryRequired: false, multipleFiles: false, paperId: one.paperId, section: null, serial: null, uploads: true,
    serialLabel: null,
  } as PaperLine);
  const holder: HolderPapers = {
    customerId: data.customerId, name: data.clientName, primary: true, entity: data.clientType === "ENTITY",
    papers: data.checklist.map(asLine), missing: 0,
  } as HolderPapers;
  const done = () => {
    setUploading(null);
    void queryClient.invalidateQueries({ queryKey: getGetClientKycFileQueryKey(clientId) });
  };
  const view = (id: string, fileName: string) => setViewing({ url: api(getReadKycDocumentUrl(id)), fileName });

  return (
    <section className="space-y-4 rounded-2xl border border-line bg-white px-6 py-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">KYC documents</h2>
          <p className="mt-0.5 text-sm text-ink-muted">The papers on file. A new copy goes to Compliance to approve.</p>
        </div>
        {mayUpload && (
          <Button variant="secondary" onClick={() => setUploading({})}><Plus aria-hidden="true" />Add a document</Button>
        )}
      </div>

      {expired.map((one) => (
        <p key={one.paperId} className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
          <TriangleAlert aria-hidden="true" className="size-4 shrink-0" />
          {one.kindTitle} expired{one.expiresOn ? ` on ${formatDate(one.expiresOn)}` : ""}. Upload the current one.
        </p>
      ))}

      <ul className="divide-y divide-line">
        {data.checklist.map((one) => {
          const stands = STANDS[one.stands];
          const Icon = one.stands === "APPROVED" ? CircleCheck : one.stands === "NOT_SENT" ? CircleDashed
            : one.stands === "EXPIRED" || one.stands === "REJECTED" ? CircleX : Clock;
          const waiting = others.some((other) => other.kindTitle === one.kindTitle && other.reviewState === "AWAITING_REVIEW");
          return (
            <li key={one.paperId} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3.5">
              <Icon aria-hidden="true" className={cn("size-5 shrink-0", one.stands === "APPROVED" ? "text-emerald-600"
                : one.stands === "NOT_SENT" ? "text-slate-400" : one.stands === "EXPIRED" || one.stands === "REJECTED" ? "text-red-600" : "text-amber-600")} />
              <span className="w-64 text-base font-semibold">{one.kindTitle}</span>
              <span className="w-60 min-w-0">
                {one.documentId && one.fileName ? (
                  <button type="button" onClick={() => view(one.documentId as string, one.fileName as string)}
                    className="inline-flex max-w-full items-center gap-1.5 text-sm text-primary-700 hover:underline">
                    <FileText aria-hidden="true" className="size-4 shrink-0" /><span className="truncate">{one.fileName}</span>
                  </button>
                ) : <span className="text-sm text-ink-muted">No file</span>}
              </span>
              <span className={cn("w-44 text-sm", one.stands === "EXPIRED" ? "font-semibold text-red-700" : "text-ink-muted")}>
                {one.expiresOn ? `${one.stands === "EXPIRED" ? "Expired" : "Expires"} ${formatDate(one.expiresOn)}` : one.documentId ? "No expiry" : ""}
              </span>
              <Badge tone={stands.tone}>{stands.label}</Badge>
              <span className="ml-auto flex items-center gap-2">
                {one.documentId && one.fileName && (
                  <button type="button" aria-label={`Download ${one.fileName}`} title="Download"
                    onClick={() => void saveApiFile(api(getReadKycDocumentUrl(one.documentId as string)), one.fileName as string)}
                    className="rounded p-1.5 text-ink-muted hover:bg-canvas hover:text-ink">
                    <Download aria-hidden="true" className="size-4" />
                  </button>
                )}
                {mayUpload && !waiting && one.stands !== "AWAITING_REVIEW" && (
                  <Button size="sm" variant={one.stands === "EXPIRED" || one.stands === "REJECTED" || one.stands === "RE_UPLOAD_REQUESTED" ? "primary" : "secondary"}
                    onClick={() => setUploading({ only: asLine(one) })}>
                    <Upload aria-hidden="true" />{one.documentId ? "Re-upload" : "Upload"}
                  </Button>
                )}
              </span>
            </li>
          );
        })}
        {others.map((one) => (
          <li key={one.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3.5">
            {one.reviewState === "APPROVED" ? <CircleCheck aria-hidden="true" className="size-5 shrink-0 text-emerald-600" />
              : one.reviewState === "REJECTED" ? <CircleX aria-hidden="true" className="size-5 shrink-0 text-red-600" />
              : <Clock aria-hidden="true" className="size-5 shrink-0 text-amber-600" />}
            <span className="w-64 text-base font-semibold">{one.kindTitle}</span>
            <span className="w-60 min-w-0">
              <button type="button" onClick={() => view(one.id, one.fileName)}
                className="inline-flex max-w-full items-center gap-1.5 text-sm text-primary-700 hover:underline">
                <FileText aria-hidden="true" className="size-4 shrink-0" /><span className="truncate">{one.fileName}</span>
              </button>
            </span>
            <span className="w-44 text-sm text-ink-muted">{one.expiresOn ? `Expires ${formatDate(one.expiresOn)}` : "No expiry"}</span>
            <Badge tone={reviewStateTones[one.reviewState]}>
              {one.reviewState === "AWAITING_REVIEW" ? "With Compliance" : reviewStateLabels[one.reviewState]}
            </Badge>
            <span className="ml-auto text-xs text-ink-muted">
              Uploaded {formatRelative(one.uploadedAt)}{one.uploadedByName ? ` by ${one.uploadedByName}` : ""}
            </span>
          </li>
        ))}
        {data.checklist.length === 0 && others.length === 0 && (
          <li className="py-8 text-center text-sm text-ink-muted">No KYC paper is on this client&apos;s file yet.</li>
        )}
      </ul>
      <p className="text-xs text-ink-muted">Click a file name to view it here. Compliance approve or reject new copies from KYC review queue › All clients.</p>

      {uploading && (
        <AddDocumentDialog holder={holder} only={uploading.only} onClose={() => setUploading(null)} onDone={done} />
      )}
      {viewing && <FileViewer url={viewing.url} fileName={viewing.fileName} onClose={() => setViewing(null)} />}
    </section>
  );
}
