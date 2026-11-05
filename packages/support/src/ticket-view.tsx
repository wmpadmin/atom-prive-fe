import { ApiError, httpFile } from "@atomprive/api-client";
import type { TicketDetail, TicketFile } from "@atomprive/api-client/portal";
import { Alert, Button } from "@atomprive/ui";
import { Globe, Monitor, Paperclip, Send } from "lucide-react";
import { useState, type ReactNode } from "react";
import { TicketStatus } from "./ticket-status";

/**
 * One ticket: what was reported, where and on what, then everything said on it in order with the files that came
 * with each message, and a box to reply in. Support writes as the firm's support, never by name.
 */

function when(at: string) {
  return new Date(at).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function size(bytes: number) {
  return bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function Files({ files, fileUrl }: { files: TicketFile[]; fileUrl: (fileId: string) => string }) {
  const [problem, setProblem] = useState<string>();
  if (files.length === 0) return null;
  const open = async (file: TicketFile) => {
    setProblem(undefined);
    try {
      const blob = await httpFile(fileUrl(file.id));
      const href = URL.createObjectURL(blob);
      window.open(href, "_blank", "noopener");
      setTimeout(() => URL.revokeObjectURL(href), 60_000);
    } catch (caught) {
      setProblem(caught instanceof ApiError ? caught.message : "The file could not be opened.");
    }
  };
  return (
    <div className="mt-2 space-y-1">
      <ul className="flex flex-wrap gap-2">
        {files.map((file) => (
          <li key={file.id}>
            <button
              type="button"
              onClick={() => void open(file)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-2.5 py-1 text-xs font-semibold text-ink-soft hover:bg-sidebar"
            >
              <Paperclip aria-hidden="true" className="size-3.5" />
              {file.fileName}
              <span className="font-normal text-ink-muted">{size(file.sizeBytes)}</span>
            </button>
          </li>
        ))}
      </ul>
      {problem && <p className="text-xs text-access-none-ink">{problem}</p>}
    </div>
  );
}

export function TicketView({
  detail,
  side,
  fileUrl,
  onReply,
  canReply,
  actions,
}: {
  detail: TicketDetail;
  side: "raiser" | "support";
  fileUrl: (fileId: string) => string;
  /** Sends a reply; rejects with the reason it could not be sent. */
  onReply: (body: string, files: File[]) => Promise<unknown>;
  canReply: boolean;
  /** Close, reopen or set status, as the reader may. */
  actions?: ReactNode;
}) {
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState<string>();
  const { ticket } = detail;
  const reportFiles = detail.files.filter((one) => one.messageId === null);

  const send = async () => {
    setSending(true);
    setProblem(undefined);
    try {
      await onReply(body.trim(), files);
      setBody("");
      setFiles([]);
    } catch (caught) {
      setProblem(caught instanceof ApiError ? caught.message : "Your reply could not be sent. Try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-line bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-ink-muted">
              {ticket.reference} · raised {when(ticket.createdAt)}
              {side === "support" && ` by ${ticket.raisedByName} (${ticket.raisedByType === "CLIENT" ? "client" : "staff"})`}
            </p>
            <h1 className="mt-1 text-[1.625rem] font-bold text-balance text-ink">{ticket.subject}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <TicketStatus status={ticket.status} side={side} />
            {actions}
          </div>
        </div>
        <p className="mt-4 text-sm whitespace-pre-wrap text-ink">{detail.description}</p>
        <Files files={reportFiles} fileUrl={fileUrl} />
        {(detail.pageUrl || detail.userAgent || (side === "support" && detail.raisedByEmail)) && (
          <dl className="mt-4 grid gap-2 rounded-xl bg-sidebar p-3 text-xs text-ink-soft sm:grid-cols-2">
            {detail.pageUrl && (
              <div className="flex min-w-0 items-start gap-1.5">
                <Globe aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-ink-muted" />
                <dt className="sr-only">Page</dt>
                <dd className="break-all">{detail.pageUrl}</dd>
              </div>
            )}
            {detail.userAgent && (
              <div className="flex min-w-0 items-start gap-1.5">
                <Monitor aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-ink-muted" />
                <dt className="sr-only">Browser</dt>
                <dd className="break-all">{detail.userAgent}</dd>
              </div>
            )}
            {side === "support" && detail.raisedByEmail && (
              <div className="sm:col-span-2">
                <dt className="sr-only">Email</dt>
                <dd>{detail.raisedByEmail}</dd>
              </div>
            )}
          </dl>
        )}
      </section>

      <section aria-label="Conversation" className="space-y-3">
        {detail.messages.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line bg-white px-6 py-8 text-center text-sm text-ink-muted">
            {side === "raiser" ? "Support hasn't replied yet. You'll get an email when they do." : "No replies yet."}
          </p>
        ) : (
          detail.messages.map((one) => {
            const mine = side === "support" ? one.fromSupport : !one.fromSupport;
            return (
              <article key={one.id} className={`rounded-2xl border p-5 ${mine ? "ml-8 border-primary-200 bg-primary-50/40" : "mr-8 border-line bg-white"}`}>
                <p className="flex flex-wrap items-baseline justify-between gap-2 text-xs text-ink-muted">
                  <span className="font-semibold text-ink">{mine ? "You" : one.authorName}</span>
                  <span>{when(one.at)}</span>
                </p>
                <p className="mt-2 text-sm whitespace-pre-wrap text-ink">{one.body}</p>
                <Files files={detail.files.filter((file) => file.messageId === one.id)} fileUrl={fileUrl} />
              </article>
            );
          })
        )}
      </section>

      {canReply && (
        <section className="rounded-2xl border border-line bg-white p-5">
          <label htmlFor="ticket-reply" className="mb-1.5 block text-2xs font-semibold tracking-wider text-ink-muted uppercase">
            Reply
          </label>
          <textarea
            id="ticket-reply"
            name="ticket-reply"
            rows={4}
            maxLength={10000}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm focus-visible:border-primary-600 focus-visible:outline-2 focus-visible:outline-primary-600"
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <label className="inline-flex cursor-pointer items-center gap-1.5 text-sm font-semibold text-primary-700 hover:underline">
              <Paperclip aria-hidden="true" className="size-4" />
              {files.length > 0 ? `${files.length} ${files.length === 1 ? "file" : "files"} attached` : "Attach files"}
              <input id="ticket-reply-files" type="file" multiple className="sr-only" onChange={(event) => setFiles([...(event.target.files ?? [])])} />
            </label>
            <Button disabled={!body.trim() || sending} onClick={() => void send()}>
              <Send aria-hidden="true" />
              {sending ? "Sending…" : "Send reply"}
            </Button>
          </div>
          {problem && (
            <div className="mt-3">
              <Alert tone="danger">{problem}</Alert>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
