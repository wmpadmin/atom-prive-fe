import { ApiError } from "@atomprive/api-client";
import {
  getGetProspectDocumentsQueryKey,
  sendProspectToCompliance,
  uploadKycDocument,
  useGetProspectDocuments,
  type DocumentsView,
  type HolderPapers,
  type PaperLine,
  type UploadKycDocumentKind,
} from "@atomprive/api-client/backoffice";
import { Alert, Button, Dialog, Field, SelectInput, TextInput, cn } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toFormErrors } from "../../lib/api-errors";
import { FileViewer } from "../../components/file-viewer";
import { useAfterCompliance } from "./compliance-review";
import { EntityChecklist } from "./entity-checklist";

export const api = (url: string) => `/api${url.replace("/api", "")}`;

/**
 * A prospect's documents (23 Nov 2026), from the day they are added: each person's KYC and income papers uploaded by the
 * desk, then sent to Compliance with Send to Compliance, and approved or rejected one by one by Compliance right here.
 * Each file says where it stands: not sent yet, with Compliance, approved, or rejected and why. Documents are added one at a time
 * with Add a document.
 */
export function ProspectDocuments({ prospectId, mayChange, mayDecide, startAdding = false }: {
  prospectId: string;
  mayChange: boolean;
  mayDecide: boolean;
  /** Opens Add a document straight away: the first one was asked for before the documents were set up. */
  startAdding?: boolean;
}) {
  const documents = useGetProspectDocuments<DocumentsView, ApiError>(prospectId);
  const queryClient = useQueryClient();
  const after = useAfterCompliance(prospectId);
  const [holderAt, setHolderAt] = useState(0);
  const [adding, setAdding] = useState(startAdding);
  const [sending, setSending] = useState<string | null>(null);
  const [viewing, setViewing] = useState<{ url: string; fileName: string } | null>(null);
  const [problem, setProblem] = useState<string>();
  const view = documents.data;
  if (documents.isError) return <p className="text-sm text-red-700">The documents couldn't be loaded.</p>;
  if (!view) return <p className="text-sm text-ink-muted">Loading the documents…</p>;
  const refresh = (next?: DocumentsView) => {
    if (next) queryClient.setQueryData(getGetProspectDocumentsQueryKey(prospectId), next);
    else void queryClient.invalidateQueries({ queryKey: getGetProspectDocumentsQueryKey(prospectId) });
  };
  const holder = view.holders[Math.min(holderAt, view.holders.length - 1)];
  // Open until Compliance approve everything, or reject it (23 Nov 2026).
  const closed = view.stage === "AGREEMENT_PENDING" || view.stage === "REJECTED" || view.stage === "ONBOARDED";
  const editable = mayChange && !closed;
  // Each document goes to Compliance on its own, from its row (23 Nov 2026).
  async function send(documentId: string) {
    setProblem(undefined);
    setSending(documentId);
    try {
      after(await sendProspectToCompliance(prospectId, { documentId }));
    } catch (caught) {
      setProblem(toFormErrors(caught).form ?? "That couldn't be sent.");
    } finally {
      setSending(null);
    }
  }

  return (
    <div className="space-y-4">
      {holder && (
        <section className="rounded-2xl border border-line bg-white px-5 py-4" aria-labelledby="kyc-papers-title">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <h3 id="kyc-papers-title" className="text-base font-bold">
                Documents · {holder.name}
                {!holder.entity && view.holders.length > 1 && (
                  <span className="ml-1 text-xs font-normal text-ink-muted">{holder.primary ? "primary holder" : "joint holder"}</span>
                )}
              </h3>
              {view.holders.length > 1 && (
                <div role="tablist" aria-label="Whose documents" className="flex flex-wrap gap-1">
                  {view.holders.map((one, i) => (
                    <button key={one.customerId} type="button" role="tab" aria-selected={one === holder} onClick={() => setHolderAt(i)}
                      className={cn("rounded-full border px-2.5 py-0.5 text-xs font-medium",
                        one === holder ? "border-primary-600 bg-primary-50 text-primary-700" : "border-line text-ink-soft hover:border-primary-200")}>
                      {one.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          {/* A person's documents in the same design as an entity's (24 Nov 2026): the firm's sheet row by row, by
              section, each row with its availability, remark and files, uploaded and decided on the row. */}
          <EntityChecklist prospectId={prospectId} holder={holder} checks={view.checks} editable={editable}
            mayDecide={mayDecide && !closed} sending={sending} onSend={(id) => void send(id)} onChanged={refresh} />
        </section>
      )}
      {adding && editable && holder && (
        <AddDocumentDialog holder={holder} onClose={() => setAdding(false)} onDone={() => { setAdding(false); refresh(); }} />
      )}

      {problem && <Alert tone="danger">{problem}</Alert>}
      {viewing && <FileViewer url={viewing.url} fileName={viewing.fileName} onClose={() => setViewing(null)} />}
    </div>
  );
}

/** Where one file stands with Compliance (23 Nov 2026). */
export function FileStatus({ file }: { file: PaperLine["files"][number] }) {
  const state = file.reviewState === "APPROVED" ? { label: "Approved", tone: "bg-emerald-50 text-emerald-700" }
    : file.reviewState === "REJECTED" ? { label: "Rejected", tone: "bg-red-50 text-red-700" }
    : file.sentAt ? { label: "With Compliance", tone: "bg-amber-50 text-amber-800" }
    : { label: "Not sent yet", tone: "bg-slate-100 text-ink-soft" };
  return <span className={cn("rounded-full px-2 py-0.5 text-2xs font-semibold", state.tone)}>{state.label}</span>;
}

/**
 * Add a document (23 Nov 2026): choose which one from the holder's list, add the file, then its expiry date. A document
 * that takes one copy and already has one is left out of the list; a rejected copy does not count, so it can be added again.
 */
export function AddDocumentDialog({ holder, only, onClose, onDone }: {
  holder: HolderPapers;
  /** Uploading onto one row of the checklist (23 Nov 2026): no choosing, the row is the document. */
  only?: PaperLine;
  onClose: () => void;
  onDone: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const input = useRef<HTMLInputElement>(null);
  const choices = only ? [only]
    : holder.papers.filter((paper) => paper.multipleFiles || !paper.files.some((file) => file.reviewState !== "REJECTED"));
  const [title, setTitle] = useState(only?.title ?? "");
  const [files, setFiles] = useState<File[]>([]);
  const [expiresOn, setExpiresOn] = useState("");
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const paper = choices.find((one) => one.title === title);
  const take = (list: FileList | null) => {
    const chosen = Array.from(list ?? []);
    setFiles(paper?.multipleFiles ? chosen : chosen.slice(0, 1));
    setErrors(({ file: _gone, ...rest }) => rest);
  };
  async function save() {
    const missing: Record<string, string> = {};
    if (!paper) missing.title = "Choose which document.";
    if (files.length === 0) missing.file = "Choose a file to upload.";
    if (paper?.expiryRequired && !expiresOn) missing.expiresOn = "This document needs its expiry date.";
    if (!paper || Object.keys(missing).length > 0) {
      setErrors(missing);
      return;
    }
    setBusy(true);
    setErrors({});
    try {
      // A document the firm named goes up as OTHER under its own name, which files it under that document.
      for (const file of files) {
        await uploadKycDocument(holder.customerId, {
          ...(paper.kind ? { kind: paper.kind as UploadKycDocumentKind } : { kind: "OTHER" as const, otherName: paper.title }),
          expiresOn: expiresOn || undefined,
        }, { file });
      }
      onDone();
    } catch (caught) {
      const said = toFormErrors(caught);
      setErrors({ ...said.fields, ...(said.form ? { form: said.form } : {}) });
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog open onClose={onClose} title={only ? `Upload: ${only.title}` : "Add a document"} description={`For ${holder.name}. PDF, JPEG or PNG, up to 10 MB.`}>
      <div className="space-y-4">
        {errors.form && <Alert tone="danger">{errors.form}</Alert>}
        {!only && (
        <Field id="paper-title" label="Which document" required error={errors.title}>
          <SelectInput id="paper-title" value={title} onChange={(event) => { setTitle(event.target.value); setErrors(({ title: _gone, ...rest }) => rest); }}>
            <option value="">Choose…</option>
            {choices.map((one) => <option key={one.title} value={one.title}>{one.title}{one.required ? " *" : ""}</option>)}
          </SelectInput>
        </Field>
        )}
        <div
          onDragOver={(event) => { event.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={(event) => { event.preventDefault(); setOver(false); take(event.dataTransfer.files); }}
          className={cn("rounded-xl border-2 border-dashed px-4 py-6 text-center text-sm",
            over ? "border-primary-600 bg-primary-50" : errors.file ? "border-red-300" : "border-line")}>
          <input ref={input} id="paper-file" type="file" multiple={paper?.multipleFiles} accept="application/pdf,image/jpeg,image/png"
            className="sr-only" onChange={(event) => take(event.target.files)} />
          <p className="text-ink-soft">
            Drop the file here, or{" "}
            <button type="button" className="font-semibold text-primary-700 hover:underline" onClick={() => input.current?.click()}>choose</button>
          </p>
          {files.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-xs">
              {files.map((file) => <li key={file.name} className="truncate">{file.name}</li>)}
            </ul>
          )}
          {errors.file && <p className="mt-2 text-xs text-red-700">{errors.file}</p>}
        </div>
        <Field id="paper-expiry" label="Expiry date" required={paper?.expiryRequired} error={errors.expiresOn}>
          <TextInput id="paper-expiry" type="date" min={today} value={expiresOn} onChange={(event) => setExpiresOn(event.target.value)} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button disabled={busy} onClick={() => void save()}>{busy ? "Uploading…" : "Upload"}</Button>
        </div>
      </div>
    </Dialog>
  );
}
