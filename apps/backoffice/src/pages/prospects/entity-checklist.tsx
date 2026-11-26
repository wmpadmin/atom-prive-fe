import {
  getReadKycDocumentUrl,
  markProspectKycCheck,
  type DocumentsView,
  type HolderPapers,
  type KycCheck,
  type PaperLine,
} from "@atomprive/api-client/backoffice";
import { Button, SelectInput, cn } from "@atomprive/ui";
import { ChevronDown, CircleCheck, CircleDashed, CircleMinus, ClipboardList, Clock, Download, FileText, Landmark, RefreshCw, Send, ShieldCheck, Upload, type LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toFormErrors } from "../../lib/api-errors";
import { FileViewer } from "../../components/file-viewer";
import { saveApiFile } from "../../lib/download";
import { DecideDocument } from "./compliance-review";
import { AddDocumentDialog, FileStatus, api } from "./prospect-documents";

/**
 * The sections of the firm's entity sheet, in its order, each folded into one bar (24 Nov 2026). Since 24 Nov 2026 the
 * entity list is the WM_Entity Review sheet: its periodic review, its trust accounts, its system checks and the documents
 * that follow submission. On-boarding and Foundation stay for any row Compliance file under them in settings.
 */
const SECTIONS: { id: string; title: string; icon: LucideIcon }[] = [
  { id: "REVIEW", title: "Periodic review", icon: Landmark },
  { id: "ONBOARDING", title: "On-boarding", icon: Landmark },
  { id: "TRUST", title: "Trust account with individual name", icon: ShieldCheck },
  { id: "FOUNDATION", title: "Foundation Accounts", icon: FileText },
  { id: "SYSTEM", title: "System and records update confirmation", icon: RefreshCw },
  { id: "POST", title: "Documents post submission / on-boarding", icon: FileText },
  { id: "OTHER", title: "Asked for by Compliance", icon: ClipboardList },
];

const AVAILABILITY: { id: string; label: string }[] = [
  { id: "OK", label: "OK" },
  { id: "PENDING", label: "Pending" },
  { id: "NOT_APPLICABLE", label: "Not applicable" },
];

/**
 * An entity's KYC checklist (23 Nov 2026), row for row the firm's WM_Entity sheet: each document with what it must
 * cover, its availability and a remark, and its files: uploaded on the row, sent to Compliance from the row, approved or
 * rejected there by Compliance. The System rows are the firm's own checks: marked, not uploaded.
 */
export function EntityChecklist({ prospectId, holder, checks, editable, mayDecide, sending, onSend, onChanged }: {
  prospectId: string;
  holder: HolderPapers;
  checks: KycCheck[];
  editable: boolean;
  mayDecide: boolean;
  sending: string | null;
  onSend: (documentId: string) => void;
  onChanged: (next?: DocumentsView) => void;
}) {
  const [uploading, setUploading] = useState<PaperLine | null>(null);
  const byPaper = new Map(checks.map((one) => [one.paperId, one]));
  const [open, setOpen] = useState<Record<string, boolean>>({});
  // One document open at a time (24 Nov 2026), anywhere in the list.
  const [openItem, setOpenItem] = useState<string | null>(null);
  const sections = SECTIONS.map((section) => ({
    ...section,
    rows: holder.papers
      .filter((paper) => (paper.section ?? "OTHER") === section.id)
      .sort((x, y) => (x.serial ?? 999) - (y.serial ?? 999)),
  })).filter((section) => section.rows.length > 0);
  return (
    <div className="mt-3 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-ink-muted">
          Every row needs an approved file before Compliance can approve (System rows: marked OK). Rows marked{" "}
          <span className="text-red-600">*</span> are needed before it can be sent.
        </p>
        <span className="rounded-full bg-primary-50 px-3 py-1 text-sm font-semibold text-primary-700">Total sections: {sections.length}</span>
      </div>
      {sections.map((section) => {
        const Icon = section.icon;
        const shown = Boolean(open[section.id]);
        const said = section.rows.map((paper) => (paper.paperId ? byPaper.get(paper.paperId)?.availability : undefined));
        const marked = said.filter(Boolean).length;
        const done = said.every((one) => one === "OK" || one === "NOT_APPLICABLE");
        const status = marked === 0 ? "NOT_STARTED" : done ? "COMPLETE" : "PENDING";
        return (
          <section key={section.id} className="rounded-xl border border-line bg-white">
            <button type="button" aria-expanded={shown} aria-controls={`kyc-${section.id}`}
              onClick={() => setOpen((was) => ({ ...was, [section.id]: !shown }))}
              className="flex w-full items-center gap-3 rounded-xl px-4 py-3.5 text-left hover:bg-canvas">
              <Icon aria-hidden="true" className="size-5 shrink-0 text-primary-600" />
              <span className="text-base font-semibold">{section.title}</span>
              <span className="rounded-full bg-primary-50 px-2.5 py-0.5 text-xs font-semibold text-primary-700">
                {section.rows.length} {section.rows.length === 1 ? "item" : "items"}
              </span>
              <span className="ml-auto"><SectionStatus status={status} /></span>
              <ChevronDown aria-hidden="true" className={cn("size-5 shrink-0 text-ink-muted transition-transform", shown && "rotate-180")} />
            </button>
            {shown && (
              <ul id={`kyc-${section.id}`} className="divide-y divide-line border-t border-line px-4">
                {section.rows.map((paper, i) => {
                  const key = paper.paperId ?? paper.title;
                  return (
                    <Item key={key} prospectId={prospectId} paper={paper} index={i + 1}
                      check={paper.paperId ? byPaper.get(paper.paperId) : undefined} editable={editable}
                      mayDecide={mayDecide} sending={sending} onSend={onSend} onChanged={onChanged}
                      onUpload={() => setUploading(paper)} withFiles={section.id !== "SYSTEM"}
                      opened={openItem === key} onToggle={() => setOpenItem((was) => (was === key ? null : key))} />
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
      {uploading && (
        <AddDocumentDialog holder={holder} only={uploading} onClose={() => setUploading(null)}
          onDone={() => { setUploading(null); onChanged(); }} />
      )}
    </div>
  );
}

/** A section's state, read from its rows' availability (24 Nov 2026): none marked, some open, or every row OK or not applicable. */
function SectionStatus({ status }: { status: "NOT_STARTED" | "PENDING" | "COMPLETE" }) {
  if (status === "COMPLETE") {
    return <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700"><CircleCheck aria-hidden="true" className="size-5 fill-emerald-600 text-white" />Complete</span>;
  }
  if (status === "PENDING") {
    return <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-sm font-semibold text-amber-700"><Clock aria-hidden="true" className="size-5 fill-amber-500 text-white" />Pending</span>;
  }
  return <span className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted"><CircleMinus aria-hidden="true" className="size-5" />Not started</span>;
}

/**
 * One document as a line of the checklist (24 Nov 2026): its state at a glance, opened in place to show what it must
 * cover, its availability and remark, and its files with Upload and Send to Compliance.
 */
function Item({ prospectId, paper, index, check, editable, mayDecide, sending, onSend, onChanged, onUpload, withFiles, opened, onToggle }: {
  prospectId: string;
  paper: PaperLine;
  index: number;
  check?: KycCheck;
  editable: boolean;
  mayDecide: boolean;
  sending: string | null;
  onSend: (documentId: string) => void;
  onChanged: (next?: DocumentsView) => void;
  onUpload: () => void;
  withFiles: boolean;
  opened: boolean;
  onToggle: () => void;
}) {
  const [remark, setRemark] = useState(check?.remark ?? "");
  const [problem, setProblem] = useState<string>();
  const [viewing, setViewing] = useState<{ url: string; fileName: string } | null>(null);
  useEffect(() => setRemark(check?.remark ?? ""), [check?.remark]);
  const held = paper.files.some((file) => file.reviewState !== "REJECTED");
  const mayAddMore = paper.multipleFiles || !held;
  const mayUpload = editable && withFiles && paper.uploads && mayAddMore;
  const unsent = paper.files.filter((file) => editable && !file.sentAt && file.reviewState === "AWAITING_REVIEW");
  const latest = paper.files[paper.files.length - 1];
  const availability = check?.availability ?? null;
  const done = availability === "NOT_APPLICABLE" || paper.files.some((file) => file.reviewState === "APPROVED")
    || (!withFiles && availability === "OK");
  const started = paper.files.length > 0 || availability != null;
  async function mark(next: string | null, nextRemark: string) {
    if (!paper.paperId) return;
    setProblem(undefined);
    try {
      onChanged(await markProspectKycCheck(prospectId, paper.paperId, { availability: next, remark: nextRemark.trim() || null }));
    } catch (caught) {
      const said = toFormErrors(caught);
      setProblem(said.form ?? Object.values(said.fields).join(" "));
    }
  }
  const StateIcon = done ? CircleCheck : started ? Clock : CircleDashed;
  return (
    <li className={cn(opened && "-mx-4 my-2 rounded-xl border border-primary-100 bg-primary-50/30 px-4")}>
      {/* The whole line opens the document (24 Nov 2026); its own buttons, such as Upload, do their own thing. */}
      <div className="flex cursor-pointer items-center gap-3 py-3.5"
        onClick={(event) => { if (!(event.target as HTMLElement).closest("[data-own-click]")) onToggle(); }}>
        <button type="button" aria-expanded={opened} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <StateIcon aria-hidden="true" className={cn("size-5 shrink-0", done ? "text-emerald-600" : started ? "text-amber-600" : "text-slate-400")} />
          <span className="w-7 shrink-0 text-sm text-ink-muted tabular-nums">{paper.serialLabel ?? paper.serial ?? index}</span>
          <span className="min-w-0 text-base font-semibold">
            {paper.title}{paper.required && <span className="text-red-600"> *</span>}
          </span>
        </button>
        {/* Asked once the client is onboarded, not of a prospect (26 Nov 2026): listed, not counted by Approve everything.
            Read off the line until the API client is next generated. */}
        {(paper as { afterOnboarding?: boolean }).afterOnboarding && (
          <span className="shrink-0 rounded-full bg-primary-50 px-2 py-0.5 text-2xs font-bold text-primary-700">
            After onboarding · not needed now
          </span>
        )}
        {withFiles && (
          <span className="shrink-0 text-sm text-ink-muted">
            {paper.files.length === 0 ? "No file" : paper.files.length === 1 ? "1 file" : `${paper.files.length} files`}
          </span>
        )}
        {latest && <FileStatus file={latest} />}
        {availability && (
          <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-2xs font-semibold text-ink-soft">
            {AVAILABILITY.find((one) => one.id === availability)?.label}
          </span>
        )}
        {!opened && paper.files.length === 0 && mayUpload && (
          <span data-own-click><Button size="sm" variant="secondary" onClick={onUpload}><Upload aria-hidden="true" />Upload</Button></span>
        )}
        <button type="button" aria-label={opened ? `Close ${paper.title}` : `Open ${paper.title}`}
          className="shrink-0 rounded p-1 text-ink-muted hover:bg-canvas">
          <ChevronDown aria-hidden="true" className={cn("size-5 transition-transform", opened && "rotate-180")} />
        </button>
      </div>
      {opened && (
        <div className="space-y-4 pb-4 pl-[3.75rem]">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
            <div>
              <p className="mb-1.5 text-xs font-semibold tracking-wider text-ink-muted uppercase">What it must cover</p>
              {paper.instructions
                ? <p className="text-sm leading-6 whitespace-pre-line text-ink-soft">{paper.instructions}</p>
                : <p className="text-sm text-ink-muted">Nothing more said.</p>}
              {paper.requested && paper.dueOn && <p className="mt-1 text-xs text-orange-700">Asked for by Compliance · due {paper.dueOn}</p>}
            </div>
            <div className="space-y-3">
              <div>
                <label htmlFor={`kyc-availability-${key(paper)}`} className="mb-1.5 block text-xs font-semibold tracking-wider text-ink-muted uppercase">Availability</label>
                {editable && paper.paperId ? (
                  <SelectInput id={`kyc-availability-${key(paper)}`} value={availability ?? ""}
                    onChange={(event) => void mark(event.target.value || null, remark)} className="h-10 text-sm">
                    <option value="">Not said</option>
                    {AVAILABILITY.map((one) => <option key={one.id} value={one.id}>{one.label}</option>)}
                  </SelectInput>
                ) : (
                  <p className="text-sm">{AVAILABILITY.find((one) => one.id === availability)?.label ?? "Not said"}</p>
                )}
              </div>
              <div>
                <label htmlFor={`kyc-remark-${key(paper)}`} className="mb-1.5 block text-xs font-semibold tracking-wider text-ink-muted uppercase">Remarks</label>
                {editable && paper.paperId ? (
                  <textarea id={`kyc-remark-${key(paper)}`} rows={2} maxLength={1000} value={remark}
                    onChange={(event) => setRemark(event.target.value)}
                    onBlur={() => { if ((check?.remark ?? "") !== remark.trim()) void mark(availability, remark); }}
                    className="block w-full rounded-lg border border-line bg-white px-3 py-2 text-sm leading-6 outline-none focus:ring-2 focus:ring-primary-600" />
                ) : (
                  <p className="text-sm whitespace-pre-line text-ink-soft">{check?.remark || "None"}</p>
                )}
              </div>
              {problem && <p className="text-xs text-red-700">{problem}</p>}
            </div>
          </div>
          {withFiles && (
            <div>
              <p className="mb-1.5 text-xs font-semibold tracking-wider text-ink-muted uppercase">Files</p>
              {paper.files.length === 0 && <p className="text-sm text-ink-muted">No file uploaded yet.</p>}
              <div className="space-y-2">
                {paper.files.map((file) => (
                  <div key={file.id} className="rounded-lg border border-line bg-white px-3 py-2.5">
                    <div className="flex flex-wrap items-center gap-3 text-sm">
                      <button type="button" onClick={() => setViewing({ url: api(getReadKycDocumentUrl(file.id)), fileName: file.fileName })}
                        className="inline-flex min-w-0 items-center gap-1.5 text-primary-700 hover:underline">
                        <FileText aria-hidden="true" className="size-4 shrink-0" /><span className="truncate">{file.fileName}</span>
                      </button>
                      <FileStatus file={file} />
                      {file.expiresOn && <span className="text-xs text-ink-muted">Expires {file.expiresOn}</span>}
                      <span className="ml-auto flex items-center gap-2">
                        {unsent.length > 1 && unsent.includes(file) && (
                          <Button size="sm" disabled={sending === file.id} onClick={() => onSend(file.id)}>
                            <Send aria-hidden="true" />{sending === file.id ? "Sending…" : "Send"}
                          </Button>
                        )}
                        {mayDecide && file.sentAt && file.reviewState === "AWAITING_REVIEW" && (
                          <DecideDocument prospectId={prospectId} documentId={file.id} fileName={file.fileName} />
                        )}
                        <button type="button" aria-label={`Download ${file.fileName}`} title="Download"
                          onClick={() => void saveApiFile(api(getReadKycDocumentUrl(file.id)), file.fileName)}
                          className="rounded p-1 text-ink-muted hover:bg-canvas hover:text-ink">
                          <Download aria-hidden="true" className="size-4" />
                        </button>
                      </span>
                    </div>
                    {file.reviewState === "REJECTED" && file.decisionReason && (
                      <p className="mt-1 text-xs text-red-700">{file.decisionReason}: upload a new one</p>
                    )}
                  </div>
                ))}
              </div>
              {(mayUpload || unsent.length === 1) && (
                <div className="mt-3 flex flex-wrap justify-end gap-2">
                  {mayUpload && (
                    <Button variant="secondary" onClick={onUpload}>
                      <Upload aria-hidden="true" />{paper.files.length ? "Upload another" : "Upload"}
                    </Button>
                  )}
                  {unsent.length === 1 && (
                    <Button disabled={sending === unsent[0].id} onClick={() => onSend(unsent[0].id)}>
                      <Send aria-hidden="true" />{sending === unsent[0].id ? "Sending…" : "Send to Compliance"}
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
      {viewing && <FileViewer url={viewing.url} fileName={viewing.fileName} onClose={() => setViewing(null)} />}
    </li>
  );
}

const key = (paper: PaperLine) => (paper.paperId ?? paper.title).replace(/[^a-zA-Z0-9-]/g, "-");
