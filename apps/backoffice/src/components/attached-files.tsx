import type { AttachedFile } from "@atomprive/api-client/backoffice";
import { useState } from "react";
import { formatFileSize } from "../lib/labels";
import { openApiFile } from "../lib/download";

const NOTHING = "Nothing attached";

/**
 * The documents provided for one line of a form, as the form reads back. Whoever is reading it — Compliance
 * deciding on the form, or Operations checking what went in — opens the paper itself from here rather than
 * being told only its name.
 */
export function AttachedFiles({
  formId,
  files,
  nothing = NOTHING,
}: {
  formId: string;
  /** What was attached for this line; empty where nothing was. */
  files: AttachedFile[];
  /** What to say where nothing was attached. */
  nothing?: string;
}) {
  const [failed, setFailed] = useState<string>();

  if (files.length === 0) {
    return <span className="text-ink-muted">{nothing}</span>;
  }
  return (
    <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {files.map((file) => (
        <button
          key={file.id}
          type="button"
          onClick={() => {
            setFailed(undefined);
            // The API is behind the session's token, so the file is fetched rather than linked to.
            openApiFile(`/api/backoffice/forms/${formId}/attachments/${file.id}`, file.fileName).catch(() =>
              setFailed("That file couldn't be opened."),
            );
          }}
          className="text-left font-medium text-primary-700 hover:underline"
        >
          {file.fileName}
          <span className="ml-1 font-normal text-ink-muted">({formatFileSize(file.sizeBytes)})</span>
        </button>
      ))}
      {failed && <span className="text-xs text-red-600">{failed}</span>}
    </span>
  );
}
