import { ApiError, http } from "@atomprive/api-client";
import {
  getCheckSecurityMasterUrl,
  getUploadSecurityMasterUrl,
  type SecurityMasterCheck,
  type SecurityMasterUpload,
} from "@atomprive/api-client/backoffice";
import { Alert, Button, cn, Dialog } from "@atomprive/ui";
import { FileSpreadsheet } from "lucide-react";
import { useRef, useState, type DragEvent } from "react";
import { formatDate, formatDateTime } from "../../lib/labels";

/** The most a day's file may be, as the server holds it. */
const MOST = 10 * 1024 * 1024;

/**
 * Uploads a day's security master. The file is checked the moment it is chosen: every problem is listed by row and
 * column and nothing is saved; a day already uploaded is said before it is replaced; a clean file is uploaded on a
 * click. Nothing is saved until that click.
 */
export function UploadSecurityMasterDialog({ onClose, onSaved }: {
  onClose: () => void;
  onSaved: (upload: SecurityMasterUpload) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [check, setCheck] = useState<SecurityMasterCheck | null>(null);
  const [busy, setBusy] = useState<"checking" | "uploading" | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const picker = useRef<HTMLInputElement>(null);

  async function choose(list: FileList | null | undefined) {
    const chosen = list?.[0];
    if (!chosen) return;
    setProblem(null);
    setCheck(null);
    if (chosen.size > MOST) {
      setFile(null);
      setProblem(`${chosen.name} is over 10 MB.`);
      return;
    }
    setFile(chosen);
    setBusy("checking");
    const form = new FormData();
    form.append("file", chosen);
    try {
      setCheck(await http<SecurityMasterCheck>(getCheckSecurityMasterUrl(), { method: "POST", body: form }));
    }
    catch (caught) {
      setProblem(caught instanceof ApiError ? caught.message : "The file could not be checked. Try again.");
    }
    finally {
      setBusy(null);
    }
  }

  async function upload() {
    if (!file || !check) return;
    setBusy("uploading");
    setProblem(null);
    const form = new FormData();
    form.append("file", file);
    try {
      onSaved(await http<SecurityMasterUpload>(getUploadSecurityMasterUrl({ replace: check.replaces != null }),
        { method: "POST", body: form }));
    }
    catch (caught) {
      setProblem(caught instanceof ApiError ? caught.message : "The file could not be uploaded. Try again.");
    }
    finally {
      setBusy(null);
    }
  }

  const refused = check != null && check.problemCount > 0;
  const ready = check != null && !refused;

  return (
    <Dialog open size="xl" title="Upload security master"
      description="The day's file in the client's template (sheet Holdings Data). One as-of date per file."
      onClose={onClose}>
      <div className="space-y-4">
        {problem && <Alert tone="danger">{problem}</Alert>}

        {file ? (
          <div className="flex items-center gap-3 rounded-xl border border-line px-3 py-2.5">
            <FileSpreadsheet aria-hidden="true" className="size-6 shrink-0 text-emerald-700" />
            <div className="min-w-0 flex-1 text-sm">
              <p className="truncate font-semibold">{file.name}</p>
              <p className="text-xs text-ink-muted">
                {busy === "checking" ? "Checking the file…"
                  : check ? [
                    check.asOf ? `As of ${formatDate(check.asOf)}` : null,
                    refused ? `${check.rowCount} ${check.rowCount === 1 ? "row" : "rows"} read`
                      : `${check.rowCount} ${check.rowCount === 1 ? "security" : "securities"}`,
                    check.examplesSkipped ? `${check.examplesSkipped} example ${check.examplesSkipped === 1 ? "row" : "rows"} skipped` : null,
                    refused ? null : "no problems found",
                  ].filter(Boolean).join(" · ")
                    : `${Math.max(1, Math.round(file.size / 1024))} KB`}
              </p>
            </div>
            <button type="button" onClick={() => picker.current?.click()} disabled={busy != null}
              className="text-sm font-semibold text-primary-600 hover:text-primary-700 disabled:opacity-50">
              Change
            </button>
          </div>
        ) : (
          <div
            onDragOver={(event: DragEvent<HTMLDivElement>) => { event.preventDefault(); setOver(true); }}
            onDragLeave={() => setOver(false)}
            onDrop={(event: DragEvent<HTMLDivElement>) => {
              event.preventDefault();
              setOver(false);
              void choose(event.dataTransfer.files);
            }}
            className={cn("rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors",
              over ? "border-primary-600 bg-primary-50" : "border-line bg-canvas")}
          >
            <p className="text-sm text-ink-soft">
              Drop the day's Excel file here, or{" "}
              <button type="button" onClick={() => picker.current?.click()}
                className="font-semibold text-primary-700 underline underline-offset-2">
                choose a file
              </button>
            </p>
            <p className="mt-1 text-xs text-ink-muted">The client's template, all four asset classes in one sheet. Up to 10 MB.</p>
          </div>
        )}
        <input ref={picker} type="file"
          accept=".xlsx,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="sr-only" aria-label="Security master file"
          onChange={(event) => { void choose(event.target.files); event.target.value = ""; }} />

        {check && refused && (
          <>
            <Alert tone="danger">
              <span className="block font-semibold">
                Not saved: {check.problemCount} {check.problemCount === 1 ? "problem" : "problems"} in the file
              </span>
              Fix {check.problemCount === 1 ? "it" : "them"} in the file and upload it again. Nothing from this file was saved.
            </Alert>
            <div className="max-h-72 overflow-auto rounded-xl border border-line">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-slate-50 text-xs tracking-wide text-ink-muted uppercase">
                  <tr>
                    <th scope="col" className="px-3 py-2 font-semibold">Row</th>
                    <th scope="col" className="px-3 py-2 font-semibold">Column</th>
                    <th scope="col" className="px-3 py-2 font-semibold">Problem</th>
                  </tr>
                </thead>
                <tbody>
                  {check.problems.map((one, index) => (
                    <tr key={index} className="border-t border-line align-top">
                      <td className="px-3 py-2 tabular-nums">{one.row ?? "—"}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{one.column ?? "—"}</td>
                      <td className="px-3 py-2">{one.problem}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {check.problemCount > check.problems.length && (
                <p className="border-t border-line px-3 py-2 text-xs text-ink-muted">
                  And {check.problemCount - check.problems.length} more; the first {check.problems.length} are listed.
                </p>
              )}
            </div>
          </>
        )}

        {check && ready && check.replaces && (
          <Alert tone="warning">
            <span className="block font-semibold">{formatDate(check.replaces.asOf)} is already uploaded</span>
            {check.replaces.fileName}, {formatDateTime(check.replaces.uploadedAt)} by {check.replaces.uploadedBy},{" "}
            {check.replaces.rowCount} securities. Uploading this file replaces that day; the earlier upload stays in the
            history, marked Replaced.
          </Alert>
        )}

        <div className="flex justify-end gap-3 pt-1">
          <Button variant="secondary" onClick={onClose} disabled={busy === "uploading"}>
            {refused ? "Close" : "Cancel"}
          </Button>
          {!refused && (
            <Button disabled={!ready || busy != null} onClick={() => void upload()}>
              {busy === "uploading" ? "Uploading…"
                : check?.replaces && check.asOf && ready ? `Replace ${formatDate(check.asOf)}` : "Upload"}
            </Button>
          )}
        </div>
      </div>
    </Dialog>
  );
}
