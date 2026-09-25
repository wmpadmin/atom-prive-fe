import { ApiError } from "@atomprive/api-client";
import {
  getGetClientKycFileQueryKey,
  getListKycDocumentsQueryKey,
  getReadKycDocumentUrl,
  useAskForReUpload,
  useDecideKycDocument,
  useGetClientKycFile,
  type ClientKycFile,
  type KycDecision,
} from "@atomprive/api-client/backoffice";
import { Alert, Avatar, Badge, Button, Field, TextArea, cn } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ExternalLink, Plus } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router";
import { openApiFile } from "../../lib/download";
import { formatDate, formatDateTime, formatRelative } from "../../lib/labels";
import { kycStatusLabels, kycStatusTones } from "../clients/client-labels";
import { useStaffUser } from "../../auth/session";
import { clientLine, fileMark, pageCount, reviewStateLabels, reviewStateTones } from "./kyc-labels";
import { UploadKycDialog } from "./upload-kyc-dialog";
import { hasAuthority } from "../../lib/permissions";

/** The longest a reason can be, as the API allows. */
const MOST_CHARACTERS = 500;

/**
 * One client's KYC pack and the decision on it. A paper is judged against the rest of what they have handed
 * over, so the whole file is here; the decision applies to the one document chosen, and the reason given is
 * shown to the client when it is turned down (#36).
 */
export function ClientKycPage() {
  const { customerId = "" } = useParams();
  const queryClient = useQueryClient();
  const file = useGetClientKycFile<ClientKycFile, ApiError>(customerId, {
    query: { enabled: Boolean(customerId) },
  });
  const decide = useDecideKycDocument<ApiError>();
  const askAgain = useAskForReUpload<ApiError>();
  const me = useStaffUser();
  /** Picked first, then recorded — so nothing is decided by a single stray click. */
  const [choice, setChoice] = useState<"APPROVE" | "REJECT">();
  const busy = decide.isPending || askAgain.isPending;
  // Deciding on a paper is Compliance's. An advisor opens the same file to put papers on it, and sees what
  // has been decided, but is not offered the decision.
  const decides = hasAuthority(useStaffUser(), "APPROVE_ONBOARDING:CHANGE");
  const [chosenId, setChosenId] = useState<string>();
  const [reason, setReason] = useState("");
  const [problem, setProblem] = useState<string>();
  const [decided, setDecided] = useState<KycDecision>();
  const [adding, setAdding] = useState(false);

  const documents = file.data?.documents ?? [];
  const waiting = documents.filter((one) => one.reviewState === "AWAITING_REVIEW");
  const chosen = documents.find((one) => one.id === chosenId) ?? waiting[0];

  function kept(result: KycDecision) {
    setDecided(result);
    setReason("");
    setChoice(undefined);
    setChosenId(undefined);
    void queryClient.invalidateQueries({ queryKey: getGetClientKycFileQueryKey(customerId) });
    void queryClient.invalidateQueries({ queryKey: getListKycDocumentsQueryKey() });
  }

  /** Asks the client for a better copy of the same paper. They stay pending while the firm waits for it. */
  function askForAnother() {
    if (!chosen) return;
    setProblem(undefined);
    askAgain.mutate(
      { documentId: chosen.id, data: { reason } },
      { onSuccess: kept, onError: (caught) => setProblem(caught.message) },
    );
  }

  function record() {
    if (!chosen || !choice) return;
    setProblem(undefined);
    decide.mutate(
      { documentId: chosen.id, data: { approved: choice === "APPROVE", reason } },
      { onSuccess: kept, onError: (caught) => setProblem(caught.message) },
    );
  }

  if (!file.data) {
    return (
      <div className="space-y-4">
        <BackLink />
        {file.isError ? <Alert tone="danger">{file.error.message}</Alert> : <p className="text-sm text-ink-muted">Loading the client's pack…</p>}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <BackLink />

      <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-white px-6 py-5">
        <div className="flex items-center gap-3">
          <Avatar name={file.data.clientName} />
          <div>
            <h1 className="text-[1.625rem] font-bold">{file.data.clientName}</h1>
            <p className="mt-0.5 text-xs text-ink-muted">
              {clientLine(file.data.clientType, file.data.clientCode)}
              {file.data.advisorName ? ` · advisor ${file.data.advisorName}` : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">KYC</p>
            <Badge tone={kycStatusTones[file.data.kycStatus]}>{kycStatusLabels[file.data.kycStatus]}</Badge>
          </div>
          <Button onClick={() => setAdding(true)}>
            <Plus aria-hidden="true" />
            Add a document
          </Button>
        </div>
      </header>

      <UploadKycDialog
        customerId={customerId}
        clientName={file.data.clientName}
        open={adding}
        onClose={() => setAdding(false)}
      />

      {decided && (
        <Alert tone={decided.document.reviewState === "APPROVED" ? "success" : "warning"}>
          {decided.document.fileName} was {reviewStateLabels[decided.document.reviewState].toLowerCase()}.{" "}
          {file.data.clientName}'s KYC now stands at {kycStatusLabels[decided.clientKycStatus].toLowerCase()}.
        </Alert>
      )}
      {problem && <Alert tone="danger">{problem}</Alert>}

      <section className="rounded-2xl border border-line bg-white">
        <div className="px-6 pt-5">
          <h2 className="text-base font-bold">Documents on file</h2>
          <p className="mt-0.5 text-xs text-ink-muted">
            Choose a document to decide on · {waiting.length} awaiting review
          </p>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                <th scope="col" className="py-3 pr-4 pl-6">Document</th>
                <th scope="col" className="px-4 py-3">Uploaded</th>
                <th scope="col" className="px-4 py-3">Status</th>
                <th scope="col" className="px-4 py-3">Expires</th>
                <th scope="col" className="py-3 pr-6 pl-4">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {documents.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-ink-muted">
                    Nothing on file for this client yet.
                  </td>
                </tr>
              )}
              {documents.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => row.reviewState === "AWAITING_REVIEW" && setChosenId(row.id)}
                  className={cn(
                    row.reviewState === "AWAITING_REVIEW" && "cursor-pointer hover:bg-slate-50/60",
                    chosen?.id === row.id && "bg-primary-50/60",
                  )}
                >
                  <td className="py-3 pr-4 pl-6">
                    <div className="flex items-center gap-3">
                      <span className="grid h-8 w-10 shrink-0 place-items-center rounded-md border border-line bg-slate-50 text-2xs font-bold text-ink-soft">
                        {fileMark(row.contentType)}
                      </span>
                      <div className="min-w-0">
                        <span className="block truncate font-semibold">{row.fileName}</span>
                        <span className="block truncate text-xs text-ink-muted">
                          {row.kindTitle}
                          {row.reference ? ` · ${row.reference}` : ""} · {pageCount(row.pages)}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-ink-soft">{formatRelative(row.uploadedAt)}</td>
                  <td className="px-4 py-3">
                    <Badge tone={reviewStateTones[row.reviewState]}>{reviewStateLabels[row.reviewState]}</Badge>
                    {row.decisionReason && (
                      <p className="mt-1 max-w-sm text-2xs leading-relaxed text-ink-muted">
                        {row.decidedByName}: {row.decisionReason}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-ink-soft">
                    {row.expiresOn ? formatDate(row.expiresOn) : "—"}
                  </td>
                  <td className="py-3 pr-6 pl-4">
                    {/* Served through the API so that every look is recorded against the client. */}
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        void openApiFile(`/api${getReadKycDocumentUrl(row.id).replace("/api", "")}`, row.fileName);
                      }}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-primary-700 hover:underline"
                    >
                      View file
                      <ExternalLink aria-hidden="true" className="size-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {decides && chosen && (
        <section className="space-y-4 rounded-2xl border border-line bg-white px-6 py-5">
          <div>
            <h2 className="text-base font-bold">KYC decision</h2>
            <p className="mt-0.5 text-xs text-ink-muted">
              Applies to <strong className="text-ink">{chosen.fileName}</strong> · a typed reason is required
              either way
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              aria-pressed={choice === "APPROVE"}
              onClick={() => setChoice("APPROVE")}
              className={cn(
                "rounded-xl border px-5 py-2.5 text-sm font-semibold transition-colors",
                choice === "APPROVE"
                  ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                  : "border-line bg-white text-ink-soft hover:border-emerald-200",
              )}
            >
              Approve KYC
            </button>
            <button
              type="button"
              aria-pressed={choice === "REJECT"}
              onClick={() => setChoice("REJECT")}
              className={cn(
                "rounded-xl border px-5 py-2.5 text-sm font-semibold transition-colors",
                choice === "REJECT"
                  ? "border-red-500 bg-red-50 text-red-700"
                  : "border-line bg-white text-ink-soft hover:border-red-200",
              )}
            >
              Reject KYC
            </button>
          </div>

          <Field id="reason" label="Decision reason — required" required>
            <TextArea
              id="reason"
              rows={5}
              maxLength={MOST_CHARACTERS}
              value={reason}
              disabled={busy}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Say what you checked, or what needs sending instead."
            />
          </Field>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-2xs text-ink-muted">
              Shown to the client if the document is turned down, and kept on the case file either way.
            </p>
            <p className="text-2xs text-ink-muted tabular-nums">
              {reason.length} / {MOST_CHARACTERS}
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
            <p className="text-2xs text-ink-muted">
              Signing as {me.fullName}, Compliance · {formatDateTime(new Date().toISOString())}
            </p>
            <div className="flex flex-wrap gap-3">
              {/* Not a rejection: asking for a better copy of the same paper leaves the client pending. */}
              <Button
                variant="secondary"
                disabled={busy || reason.trim().length === 0}
                onClick={askForAnother}
              >
                {askAgain.isPending ? "Asking…" : "Request re-upload"}
              </Button>
              <Button disabled={busy || !choice || reason.trim().length === 0} onClick={record}>
                {decide.isPending ? "Recording…" : "Record decision"}
              </Button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

/** Back where they came from: Compliance from the review queue, an advisor from their own clients. */
function BackLink() {
  const decides = hasAuthority(useStaffUser(), "APPROVE_ONBOARDING:VIEW");
  return (
    <Link
      to={decides ? "/kyc" : "/client-documents"}
      className="inline-flex items-center gap-1 text-sm font-medium text-ink-muted hover:text-primary-700"
    >
      <ChevronLeft aria-hidden="true" className="size-4" />
      {decides ? "KYC document review" : "Client documents"}
    </Link>
  );
}
