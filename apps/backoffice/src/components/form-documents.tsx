import { httpFile } from "@atomprive/api-client";
import type { AttachedFile } from "@atomprive/api-client/backoffice";
import { Button, IconButton, cn } from "@atomprive/ui";
import { Download, FileText, Paperclip, X } from "lucide-react";
import { useId, useRef, useState } from "react";
import { formatFileSize } from "../lib/labels";

/** What a line of a form has been given, and how to give it more or take one back. */
export interface FormDocuments {
  files: AttachedFile[];
  attach: (field: string, file: File) => void;
  remove: (id: string) => void;
  busy: boolean;
  error?: string;
}

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
  const provided = documents.files.filter((file) => file.field === field);

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
                <span className="text-xs text-ink-muted">{formatFileSize(file.sizeBytes)}</span>
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
        <Button variant="secondary" size="sm" disabled={documents.busy} onClick={() => picker.current?.click()}>
          <Paperclip aria-hidden="true" />
          {documents.busy ? "Attaching…" : provided.length > 0 ? "Attach another" : label}
        </Button>
        <p className="text-xs text-ink-muted">PDF, JPEG or PNG, up to 10 MB.</p>
      </div>
      {(refused ?? documents.error) && <p className="text-xs text-red-600">{refused ?? documents.error}</p>}
    </div>
  );
}
