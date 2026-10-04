import { ApiError, httpFile } from "@atomprive/api-client";
import {
  useAttachToProposal,
  useRemoveProposalAttachment,
  type AttachmentView,
} from "@atomprive/api-client/backoffice";
import { Alert, Button, IconButton } from "@atomprive/ui";
import { Download, FileText, Paperclip, X } from "lucide-react";
import { useId, useRef, useState } from "react";
import { formatDateTime, formatFileSize } from "../../lib/labels";

/** The types the API takes: something a manager can open without leaving the browser. */
const TAKES = "application/pdf,image/jpeg,image/png";

const MOST_BYTES = 10 * 1024 * 1024;

/**
 * The file that goes with a proposal (A3.5 #1). One per proposal: a manager signing one off should not have to
 * work out which of two files the advisor meant.
 *
 * <p>It is attached to a saved draft rather than typed alongside one, because the file is stored against the
 * proposal's own id. A proposal being written for the first time says so instead of offering a control that
 * would have nothing to attach to.
 */
export function ProposalAttachment({
  proposalId,
  attachment,
  editable,
  onChanged,
}: {
  /** Null while the proposal is still being written for the first time. */
  proposalId: string | null;
  attachment: AttachmentView | null;
  /** True when this person may change it: their own draft, not yet sent. */
  editable: boolean;
  /** Re-reads the proposal, so the page shows what is on it now. */
  onChanged: () => void;
}) {
  const inputId = useId();
  const picker = useRef<HTMLInputElement>(null);
  const [refused, setRefused] = useState<string>();
  const [opening, setOpening] = useState(false);

  const attach = useAttachToProposal<ApiError>({
    mutation: {
      onSuccess: () => {
        setRefused(undefined);
        onChanged();
      },
      onError: (error) => setRefused(error.message),
    },
  });
  const remove = useRemoveProposalAttachment<ApiError>({
    mutation: {
      onSuccess: () => {
        setRefused(undefined);
        onChanged();
      },
      onError: (error) => setRefused(error.message),
    },
  });

  const busy = attach.isPending || remove.isPending;

  function chosen(file: File | undefined) {
    if (!file || !proposalId) return;
    // Refused here as well as by the API, so somebody on a slow line isn't made to upload it to be told.
    if (file.size > MOST_BYTES) {
      setRefused("That file is over 10 MB. Attach a smaller one.");
      if (picker.current) picker.current.value = "";
      return;
    }
    setRefused(undefined);
    attach.mutate({ id: proposalId, data: { file } });
    if (picker.current) picker.current.value = "";
  }

  /** Fetches it with the session's token, since the browser cannot put one on a plain link. */
  async function open() {
    if (!proposalId || !attachment) return;
    setOpening(true);
    try {
      const blob = await httpFile(`/api/backoffice/proposals/${proposalId}/attachment`);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = attachment.fileName;
      link.click();
      URL.revokeObjectURL(url);
    } catch (caught) {
      setRefused(caught instanceof ApiError ? caught.message : "That file couldn't be opened. Try again.");
    } finally {
      setOpening(false);
    }
  }

  return (
    <section>
      <h2 className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">Attachment</h2>

      {proposalId === null ? (
        <p className="mt-2 text-xs text-ink-muted">
          Save the draft first, then a factsheet or term sheet can be attached to it.
        </p>
      ) : (
        <>
          {attachment ? (
            <div className="mt-2 flex items-center gap-3 rounded-lg border border-line bg-white px-3 py-2">
              <FileText className="size-4 shrink-0 text-ink-muted" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-ink">{attachment.fileName}</span>
                <span className="block text-xs text-ink-muted">
                  {formatFileSize(attachment.sizeBytes)} · {attachment.uploadedBy},{" "}
                  {formatDateTime(attachment.uploadedAt)}
                </span>
              </div>
              <Button type="button" variant="secondary" size="sm" disabled={opening} onClick={() => void open()}>
                <Download aria-hidden="true" />
                {opening ? "Opening…" : "Open"}
              </Button>
              {editable && (
                <IconButton
                  type="button"
                  label={`Take ${attachment.fileName} off this proposal`}
                  disabled={busy}
                  onClick={() => remove.mutate({ id: proposalId })}
                >
                  <X aria-hidden="true" />
                </IconButton>
              )}
            </div>
          ) : (
            <p className="mt-2 text-xs text-ink-muted">
              {editable ? "Nothing is attached yet." : "Nothing was attached."}
            </p>
          )}

          {editable && (
            <>
              <input
                ref={picker}
                id={inputId}
                type="file"
                accept={TAKES}
                className="sr-only"
                onChange={(event) => chosen(event.target.files?.[0])}
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="mt-2"
                disabled={busy}
                onClick={() => picker.current?.click()}
              >
                <Paperclip aria-hidden="true" />
                {attach.isPending ? "Attaching…" : attachment ? "Replace it" : "Attach a file"}
              </Button>
              <p className="mt-1 text-xs text-ink-muted">
                One file, up to 10 MB: a PDF, a JPEG or a PNG. Attaching another replaces it. It can't be
                changed once the proposal has gone.
              </p>
            </>
          )}

          {refused && (
            <div className="mt-2">
              <Alert tone="danger">{refused}</Alert>
            </div>
          )}
        </>
      )}
    </section>
  );
}
