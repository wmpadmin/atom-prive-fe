import { httpFile } from "@atomprive/api-client";
import type { AttachedFile, PaperOnFile } from "@atomprive/api-client/backoffice";
import { Badge, Button, Dialog, IconButton, cn } from "@atomprive/ui";
import { Download, FileText, FolderOpen, Paperclip, X } from "lucide-react";
import { useId, useRef, useState } from "react";
import { formatDate, formatFileSize } from "../lib/labels";

/** What a line of a form has been given, and how to give it more or take one back. */
export interface FormDocuments {
  files: AttachedFile[];
  attach: (field: string, file: File) => void;
  /** Answers the line with a paper the firm already holds, rather than a second copy of it. */
  attachFromFile: (field: string, paperId: string) => void;
  /** Everything on the client's file, for choosing from. */
  onFile: PaperOnFile[];
  remove: (id: string) => void;
  busy: boolean;
  error?: string;
}

/**
 * Where a paper has got to with Compliance, in the words the KYC screens use.
 *
 * <p>A paper that was refused or has run out is offered like the rest and says which it is. A form
 * sometimes wants exactly the paper that was refused, and hiding it would only have somebody upload a
 * second copy of what the firm already has.
 */
const STANDINGS: Record<string, { said: string; tone: "success" | "neutral" | "warning" | "danger" }> = {
  AWAITING_REVIEW: { said: "Waiting on Compliance", tone: "neutral" },
  RE_UPLOAD_REQUESTED: { said: "A better copy was asked for", tone: "warning" },
  REJECTED: { said: "Refused by Compliance", tone: "danger" },
  APPROVED: { said: "Approved", tone: "success" },
  EXPIRED: { said: "Expired", tone: "danger" },
};

/** The types the API takes: a scan of the document, or a photograph of it. */
const TAKES = "application/pdf,image/jpeg,image/png";

const MOST_BYTES = 10 * 1024 * 1024;

/** Fetches the document with the session's token and hands it to the browser to save. */
async function save(file: AttachedFile, formId: string) {
  const blob = await httpFile(`/api/backoffice/forms/${formId}/attachments/${file.id}`);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.fileName;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * The documents provided for one line of a form. A line that asks the client to provide something — a certified
 * true copy of a government issued document, say — is answered by the document, so this is where it goes.
 */
export function Documents({
  formId,
  field,
  documents,
  label,
}: {
  formId: string;
  /** The line they were provided for, such as "residence.certifiedCopy". */
  field: string;
  documents: FormDocuments;
  label: string;
}) {
  const inputId = useId();
  const picker = useRef<HTMLInputElement>(null);
  const [refused, setRefused] = useState<string>();
  const [choosing, setChoosing] = useState(false);
  const provided = documents.files.filter((file) => file.field === field);
  // A paper already answering this very line is not offered again; one answering another line still is,
  // because the same passport can be what two lines ask for.
  const alreadyHere = new Set(provided.map((file) => file.fileName));
  const onFile = documents.onFile.filter((paper) => !paper.alreadyOn.includes(field));

  function chosen(file: File | undefined) {
    if (!file) return;
    if (file.size > MOST_BYTES) {
      setRefused("That file is over 10 MB. Attach a smaller one.");
      return;
    }
    setRefused(undefined);
    documents.attach(field, file);
    if (picker.current) picker.current.value = "";
  }

  return (
    <div className="space-y-2">
      {provided.length > 0 && (
        <ul className="space-y-2">
          {provided.map((file) => (
            <li key={file.id} className="flex items-center gap-3 rounded-lg border border-line bg-white px-3 py-2">
              <FileText aria-hidden="true" className="size-4 shrink-0 text-ink-muted" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-ink">{file.fileName}</span>
                <span className="text-xs text-ink-muted">
                  {formatFileSize(file.sizeBytes)}
                  {file.fromTheFile ? " · from the client's file" : ""}
                </span>
              </span>
              <IconButton label={`Save ${file.fileName}`} onClick={() => void save(file, formId)}>
                <Download />
              </IconButton>
              <IconButton
                label={`Take ${file.fileName} off this form`}
                tone="danger"
                disabled={documents.busy}
                onClick={() => documents.remove(file.id)}
              >
                <X />
              </IconButton>
            </li>
          ))}
        </ul>
      )}

      <input
        ref={picker}
        id={inputId}
        type="file"
        accept={TAKES}
        className="sr-only"
        onChange={(event) => chosen(event.target.files?.[0])}
      />
      <div className={cn("flex flex-wrap items-center gap-3")}>
        {/* Offered first: the firm already holds most of what these lines ask for, and uploading a second
            copy of a passport is how two copies of it end up disagreeing. */}
        {onFile.length > 0 && (
          <Button variant="secondary" size="sm" disabled={documents.busy} onClick={() => setChoosing(true)}>
            <FolderOpen aria-hidden="true" />
            Use one already on file
          </Button>
        )}
        <Button variant="secondary" size="sm" disabled={documents.busy} onClick={() => picker.current?.click()}>
          <Paperclip aria-hidden="true" />
          {documents.busy ? "Attaching…" : provided.length > 0 ? "Upload another" : label}
        </Button>
        <p className="text-xs text-ink-muted">PDF, JPEG or PNG, up to 10 MB.</p>
      </div>
      {(refused ?? documents.error) && <p className="text-xs text-red-600">{refused ?? documents.error}</p>}

      <Dialog open={choosing} title="Papers already on this client's file" onClose={() => setChoosing(false)}>
        <div className="space-y-3">
          <p className="text-sm text-ink-muted">
            Choosing one attaches it to this line. It is not copied — replace the paper on the client's file
            and this form shows the new one.
          </p>
          <ul className="space-y-2">
            {onFile.map((paper) => {
              const standing = STANDINGS[paper.standing];
              return (
                <li
                  key={paper.id}
                  className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-white px-3 py-2"
                >
                  <FileText aria-hidden="true" className="size-4 shrink-0 text-ink-muted" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-ink">
                      {paper.kindLabel}
                      {paper.reference ? ` · ${paper.reference}` : ""}
                    </span>
                    <span className="block truncate text-xs text-ink-muted">
                      {paper.fileName} · {formatFileSize(paper.sizeBytes)}
                      {paper.expiresOn ? ` · ${paper.expired ? "ran out" : "runs out"} ${formatDate(paper.expiresOn)}` : ""}
                      {alreadyHere.has(paper.fileName) ? " · already on this line" : ""}
                    </span>
                  </span>
                  {standing && <Badge tone={standing.tone}>{standing.said}</Badge>}
                  <Button
                    size="sm"
                    disabled={documents.busy}
                    onClick={() => {
                      documents.attachFromFile(field, paper.id);
                      setChoosing(false);
                    }}
                  >
                    Use this
                  </Button>
                </li>
              );
            })}
          </ul>
          {documents.error && <p className="text-xs text-red-600">{documents.error}</p>}
        </div>
      </Dialog>
    </div>
  );
}
