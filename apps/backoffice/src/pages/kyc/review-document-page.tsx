import { ApiError } from "@atomprive/api-client";
import {
  getGetClientKycFileQueryKey,
  getListKycDocumentsQueryKey,
  getReadKycDocumentUrl,
  useAskForReUpload,
  useDecideKycDocument,
  useSetKycDocumentExpiry,
  type KycDocumentRow,
  useGetClientKycFile,
  type ClientKycFile,
} from "@atomprive/api-client/backoffice";
import { Alert, Badge, Button, DateInput, Field, TextArea, cn } from "@atomprive/ui";
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
import { DecidedBy } from "./kyc-who";

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
  // Deciding on a paper is Compliance's. A relationship manager opens the same file to put papers on it, and sees
  // what has been decided, but is not offered the decision.
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
                {paper.uploadedByName ? ` by ${paper.uploadedByName}` : ""}
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

        {/* Both panels in one column of the grid. Left as two children they were two grid cells, and the
            second landed under the document rather than beside it — out of sight past twenty-eight pages
            of PDF. The column sticks as a whole, so it stays put while the paper is read. */}
        <div className="space-y-5 lg:sticky lg:top-5">
          {decides && paper.reviewState === "AWAITING_REVIEW" ? (
          <section className="space-y-4 rounded-2xl border border-line bg-white px-5 py-5">
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
          <section className="rounded-2xl border border-line bg-white px-5 py-5">
            <h2 className="text-base font-bold">{reviewStateLabels[paper.reviewState]}</h2>
            <p className="mt-1 space-y-0.5 text-xs text-ink-muted">
              <DecidedBy by={paper.decidedByName} at={paper.decidedAt} reason={paper.decisionReason}>
                {decides
                  ? "This one has been decided on already, so there is nothing to record against it."
                  : "Deciding on a client's papers is Compliance's."}
              </DecidedBy>
            </p>
          </section>
          )}

          {/* Offered whatever has been decided. A date is a fact about the paper rather than a judgement
              on it, and the paper that most needs one is usually the one already approved: an undated
              passport counts for ever and the reminders that chase a lapsing paper never run for it.
              Under the decision rather than inside it, so recording a date is never mistaken for
              deciding again. */}
          {decides && <WhenItRunsOut paper={paper} onSaved={() => void queryClient.invalidateQueries()} />}
        </div>
      </div>
    </div>
  );
}

function yearsFromToday(years: number) {
  const now = new Date();
  return new Date(now.getFullYear() + years, now.getMonth(), now.getDate());
}

/** Setting, changing or taking off the day a paper runs out. */
function WhenItRunsOut({ paper, onSaved }: { paper: KycDocumentRow; onSaved: () => void }) {
  /**
   * Whether the box is open.
   *
   * <p>A paper that already carries a date is answered, and an answered question asked again every time
   * somebody opens the paper reads as work still to do. So the date is stated, and changing it is asked
   * for. A paper with no date has nothing to state, and the box is what there is to do about it.
   */
  const [changing, setChanging] = useState(false);
  const [day, setDay] = useState(paper.expiresOn ?? "");
  const date = useSetKycDocumentExpiry<ApiError>({
    mutation: {
      onSuccess: () => {
        setChanging(false);
        onSaved();
      },
    },
  });
  const changed = (day || null) !== (paper.expiresOn ?? null);
  const today = new Date().toISOString().slice(0, 10);

  if (paper.expiresOn && !changing) {
    const gone = paper.expiresOn <= today;
    return (
      <section className="rounded-2xl border border-line bg-white px-5 py-5">
        <h2 className="text-base font-bold">When it runs out</h2>
        <p className="mt-1 text-sm">
          <span className={cn("font-semibold", gone && "text-amber-700")}>
            {formatDate(paper.expiresOn)}
          </span>
          <span className="text-ink-muted">
            {gone
              ? " · that day has passed, so this paper no longer counts towards the checklist"
              : " · chased 30, 14 and 7 days before"}
          </span>
        </p>
        <button
          type="button"
          onClick={() => {
            setDay(paper.expiresOn ?? "");
            setChanging(true);
          }}
          className="mt-3 text-xs font-semibold text-primary-700 hover:underline"
        >
          Change the date
        </button>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-line bg-white px-5 py-5">
      <h2 className="text-base font-bold">When it runs out</h2>
      <p className="mt-0.5 text-xs text-ink-muted">
        A dated paper is chased 30, 14 and 7 days before it lapses, and stops counting towards the client's
        checklist once it has. One with no date counts for ever.
      </p>
      {date.isError && <div className="mt-3"><Alert tone="danger">{date.error.message}</Alert></div>}
      <div className="mt-3 space-y-2">
        <Field id="paper-expires" label="Expires" hint="Leave blank where the document doesn't run out.">
          {/* Reaching back as well as forward, unlike the upload box: the paper that most needs a date
              put on it is one that ran out while nobody had recorded when it would. */}
          <DateInput
            id="paper-expires"
            name="expiresOn"
            value={day}
            clearable
            min={yearsFromToday(-30)}
            max={yearsFromToday(20)}
            onChange={setDay}
          />
        </Field>
        <Button
          className="w-full"
          disabled={date.isPending || !changed}
          onClick={() => date.mutate({ documentId: paper.id, data: { expiresOn: day === "" ? null : day } })}
        >
          {date.isPending ? "Saving…" : paper.expiresOn && day === "" ? "Take the date off" : "Save the date"}
        </Button>
        {/* Only where there was a date to go back to. Nothing is lost by closing a box that never held one. */}
        {changing && (
          <Button
            className="w-full"
            variant="secondary"
            disabled={date.isPending}
            onClick={() => {
              setDay(paper.expiresOn ?? "");
              setChanging(false);
            }}
          >
            Cancel
          </Button>
        )}
        {/* Said plainly, because it is the one thing here that changes what the firm may act on. */}
        {changed && day !== "" && day < today && (
          <p className="text-2xs text-amber-700">
            That day has passed, so this paper stops counting as soon as you save it.
          </p>
        )}
      </div>
    </section>
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
