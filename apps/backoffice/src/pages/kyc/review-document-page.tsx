import { ApiError } from "@atomprive/api-client";
import {
  getGetClientKycFileQueryKey,
  getListKycDocumentsQueryKey,
  getReadKycDocumentUrl,
  useAskForReUpload,
  useDecideKycDocument,
  useGetClientKycFile,
  type ClientKycFile,
} from "@atomprive/api-client/backoffice";
import { Alert, Badge, Button, Field, TextArea, cn } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ExternalLink } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { useStaffUser } from "../../auth/session";
import { openApiFile } from "../../lib/download";
import { formatDate, formatDateTime, formatRelative } from "../../lib/labels";
import { hasAuthority } from "../../lib/permissions";
import { DocumentReader } from "./document-reader";
import { fileMark, pageCount, reviewStateLabels, reviewStateTones } from "./kyc-labels";

const MOST_CHARACTERS = 500;

/**
 * One of a client's papers, read and decided on, with the room to do both.
 *
 * <p>Its own screen rather than a panel opened inside the client's file: a document is read, and reading a
 * twenty-eight page one in a pane inside a row inside a card is reading it through a letterbox. Here it has the
 * width of the screen, and the decision sits beside it rather than below it, so that what is being decided and
 * what it is being decided on are in view at the same time.
 */
export function ReviewDocumentPage() {
  const { customerId = "", documentId = "" } = useParams();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const me = useStaffUser();
  // Deciding on a paper is Compliance's. An advisor opens the same file to put papers on it, and sees what has
  // been decided, but is not offered the decision.
  const decides = hasAuthority(me, "APPROVE_ONBOARDING:CHANGE");

  const file = useGetClientKycFile<ClientKycFile, ApiError>(customerId, {
    query: { enabled: Boolean(customerId) },
  });
  const decide = useDecideKycDocument<ApiError>();
  const askAgain = useAskForReUpload<ApiError>();
  /** Picked first, then recorded — so nothing is decided by a single stray click. */
  const [choice, setChoice] = useState<"APPROVE" | "REJECT">();
  const [reason, setReason] = useState("");
  const [problem, setProblem] = useState<string>();
  const busy = decide.isPending || askAgain.isPending;

  const paper = file.data?.documents.find((one) => one.id === documentId);
  const backTo = `/kyc/${customerId}${search.get("from") ? `?from=${search.get("from")}` : ""}`;

  function done() {
    void queryClient.invalidateQueries({ queryKey: getGetClientKycFileQueryKey(customerId) });
    void queryClient.invalidateQueries({ queryKey: getListKycDocumentsQueryKey() });
    // Back to the client's pack, which is where the next paper is.
    void navigate(backTo, { state: { decided: true } });
  }

  function askForAnother() {
    setProblem(undefined);
    askAgain.mutate({ documentId, data: { reason } }, { onSuccess: done, onError: (caught) => setProblem(caught.message) });
  }

  function record() {
    if (!choice) return;
    setProblem(undefined);
    decide.mutate(
      { documentId, data: { approved: choice === "APPROVE", reason } },
      { onSuccess: done, onError: (caught) => setProblem(caught.message) },
    );
  }

  if (!file.data || !paper) {
    return (
      <div className="space-y-4">
        <Back to={backTo} />
        {file.isError ? (
          <Alert tone="danger">{file.error.message}</Alert>
        ) : file.data ? (
          <Alert tone="danger">That document isn't on this client's file.</Alert>
        ) : (
          <p className="text-sm text-ink-muted">Loading the document…</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <header className="space-y-3">
        <Back to={backTo} label={`Back to ${file.data.clientName}`} />
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-12 shrink-0 place-items-center rounded-md border border-line bg-white text-2xs font-bold text-ink-soft">
              {fileMark(paper.contentType)}
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-xl leading-tight font-bold">{paper.fileName}</h1>
              <p className="mt-0.5 text-sm text-ink-muted">
                {paper.kindTitle}
                {paper.reference ? ` · ${paper.reference}` : ""} · {pageCount(paper.pages)} · put on file{" "}
                {formatRelative(paper.uploadedAt)}
                {paper.expiresOn ? ` · runs out ${formatDate(paper.expiresOn)}` : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge tone={reviewStateTones[paper.reviewState]}>{reviewStateLabels[paper.reviewState]}</Badge>
            {/* Served through the API so that every look is recorded against the client. */}
            <button
              type="button"
              onClick={() => void openApiFile(`/api${getReadKycDocumentUrl(paper.id).replace("/api", "")}`, paper.fileName)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary-700 hover:underline"
            >
              Open in a tab
              <ExternalLink aria-hidden="true" className="size-3.5" />
            </button>
          </div>
        </div>
      </header>

      {problem && <Alert tone="danger">{problem}</Alert>}

      {/* The document takes the width; the decision keeps to the side and stays put while it is read. */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <DocumentReader key={paper.id} documentId={paper.id} contentType={paper.contentType} />

        {decides && paper.reviewState === "AWAITING_REVIEW" ? (
          <section className="space-y-4 rounded-2xl border border-line bg-white px-5 py-5 lg:sticky lg:top-5">
            <div>
              <h2 className="text-base font-bold">KYC decision</h2>
              <p className="mt-0.5 text-xs text-ink-muted">A typed reason is required either way.</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                aria-pressed={choice === "APPROVE"}
                onClick={() => setChoice("APPROVE")}
                className={cn(
                  "rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors",
                  choice === "APPROVE"
                    ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                    : "border-line bg-white text-ink-soft hover:border-emerald-200",
                )}
              >
                Approve
              </button>
              <button
                type="button"
                aria-pressed={choice === "REJECT"}
                onClick={() => setChoice("REJECT")}
                className={cn(
                  "rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors",
                  choice === "REJECT"
                    ? "border-red-500 bg-red-50 text-red-700"
                    : "border-line bg-white text-ink-soft hover:border-red-200",
                )}
              >
                Reject
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
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-2xs text-ink-muted">Shown to the client if it is turned down.</p>
              <p className="text-2xs text-ink-muted tabular-nums">
                {reason.length} / {MOST_CHARACTERS}
              </p>
            </div>

            <div className="space-y-2 border-t border-line pt-4">
              <Button className="w-full" disabled={busy || !choice || reason.trim().length === 0} onClick={record}>
                {decide.isPending ? "Recording…" : "Record decision"}
              </Button>
              {/* Not a rejection: asking for a better copy of the same paper leaves the client pending. */}
              <Button
                className="w-full"
                variant="secondary"
                disabled={busy || reason.trim().length === 0}
                onClick={askForAnother}
              >
                {askAgain.isPending ? "Asking…" : "Request re-upload"}
              </Button>
              <p className="pt-1 text-2xs text-ink-muted">
                Signing as {me.fullName}, Compliance · {formatDateTime(new Date().toISOString())}
              </p>
            </div>
          </section>
        ) : (
          <section className="rounded-2xl border border-line bg-white px-5 py-5 lg:sticky lg:top-5">
            <h2 className="text-base font-bold">{reviewStateLabels[paper.reviewState]}</h2>
            <p className="mt-1 text-xs text-ink-muted">
              {paper.decisionReason
                ? `${paper.decidedByName}: ${paper.decisionReason}`
                : decides
                  ? "This one has been decided on already, so there is nothing to record against it."
                  : "Deciding on a client's papers is Compliance's."}
            </p>
          </section>
        )}
      </div>
    </div>
  );
}

function Back({ to, label = "Back" }: { to: string; label?: string }) {
  return (
    <Link to={to} className="inline-flex items-center gap-1 text-sm font-medium text-ink-muted hover:text-primary-700">
      <ChevronLeft aria-hidden="true" className="size-4" />
      {label}
    </Link>
  );
}
