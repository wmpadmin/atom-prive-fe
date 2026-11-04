import { ApiError, http } from "@atomprive/api-client";
import type { TicketDetail } from "@atomprive/api-client/portal";
import { Alert, Button, Dialog } from "@atomprive/ui";
import { Paperclip, Send } from "lucide-react";
import { useState } from "react";
import { CATEGORY_LABELS } from "./ticket-fields";

/**
 * Raising a ticket for a technical problem: what it is about, what happened, and any screenshots. The page they
 * were on and the browser they use go with it unasked, because that is the first thing support would ask.
 */
export function RaiseTicketDialog({
  url,
  pageUrl,
  onClose,
  onRaised,
  askCategory = false,
}: {
  /** Where the ticket is posted: the portal's or the back office's own address for it. */
  url: string;
  /** The page the problem was on, as far as the screen knows it. */
  pageUrl: string;
  onClose: () => void;
  onRaised: (raised: TicketDetail) => void;
  /** Whether to ask what the ticket is about. The back office asks; a ticket raised without it is "Other". */
  askCategory?: boolean;
}) {
  const [category, setCategory] = useState("OTHER");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [page, setPage] = useState(pageUrl);
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState<string>();
  const field = "w-full rounded-xl border border-line bg-white px-3 text-sm focus-visible:border-primary-600 focus-visible:outline-2 focus-visible:outline-primary-600";
  const label = "mb-1.5 block text-2xs font-semibold tracking-wider text-ink-muted uppercase";

  const send = async () => {
    setSending(true);
    setProblem(undefined);
    const form = new FormData();
    form.append("subject", subject.trim());
    form.append("description", description.trim());
    if (page.trim()) form.append("pageUrl", page.trim());
    form.append("userAgent", navigator.userAgent.slice(0, 500));
    if (askCategory) form.append("category", category);
    for (const file of files) form.append("files", file);
    try {
      onRaised(await http<TicketDetail>(url, { method: "POST", body: form }));
    } catch (caught) {
      setProblem(caught instanceof ApiError ? caught.message : "The ticket could not be sent. Try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open onClose={onClose} title="Raise a ticket" description="Tell us about a technical problem. Our IT team will reply here and by email.">
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
      >
        <div>
          <label htmlFor="ticket-subject" className={label}>Subject</label>
          <input id="ticket-subject" name="ticket-subject" required maxLength={200} value={subject} onChange={(event) => setSubject(event.target.value)} className={`h-10 ${field}`} />
        </div>
        {askCategory && (
          <div>
            <label htmlFor="ticket-category" className={label}>What it is about</label>
            <select id="ticket-category" name="ticket-category" value={category} onChange={(event) => setCategory(event.target.value)}
              className={`h-10 ${field}`}>
              {Object.entries(CATEGORY_LABELS).map(([value, name]) => <option key={value} value={value}>{name}</option>)}
            </select>
          </div>
        )}
        <div>
          <label htmlFor="ticket-description" className={label}>What happened</label>
          <textarea
            id="ticket-description"
            name="ticket-description"
            required
            rows={5}
            maxLength={10000}
            placeholder="What you were doing, what you expected, and what happened instead."
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className={`py-2 ${field}`}
          />
        </div>
        <div>
          <label htmlFor="ticket-page" className={label}>Page (optional)</label>
          <input id="ticket-page" name="ticket-page" maxLength={1000} value={page} onChange={(event) => setPage(event.target.value)} className={`h-10 ${field}`} />
          <p className="mt-1 text-xs text-ink-muted">The page you were on. Your browser's details are sent with the ticket.</p>
        </div>
        <label className="inline-flex cursor-pointer items-center gap-1.5 text-sm font-semibold text-primary-700 hover:underline">
          <Paperclip aria-hidden="true" className="size-4" />
          {files.length > 0 ? `${files.length} ${files.length === 1 ? "file" : "files"} attached` : "Attach screenshots or files"}
          <input id="ticket-files" type="file" multiple className="sr-only" onChange={(event) => setFiles([...(event.target.files ?? [])])} />
        </label>
        {problem && <Alert tone="danger">{problem}</Alert>}
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={sending}>
            Cancel
          </Button>
          <Button type="submit" disabled={!subject.trim() || !description.trim() || sending}>
            <Send aria-hidden="true" />
            {sending ? "Sending…" : "Raise ticket"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
