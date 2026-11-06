import { ApiError, http } from "@atomprive/api-client";
import { getUploadStatementsUrl, type BankFeed, type SyncRunRow } from "@atomprive/api-client/backoffice";
import { Alert, Button, cn, Dialog } from "@atomprive/ui";
import { FileText } from "lucide-react";
import { useRef, useState, type DragEvent } from "react";
import { Link } from "react-router";

/** The most one statement may be, as the server holds it. */
const MOST = 10 * 1024 * 1024;

/**
 * A bank's statement files, uploaded by hand (P5): the way in for a bank whose connection is not ready, and the
 * fallback when it is down. The files go through what a collected file goes through — the bank's format mapping,
 * the line-by-line check, stored once — and the result is said at once, the way the Ingestion log would say it.
 */
export function UploadStatementDialog({ feed, onClose, onTaken }: {
  feed: BankFeed;
  onClose: () => void;
  onTaken: () => void;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [over, setOver] = useState(false);
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [run, setRun] = useState<SyncRunRow | null>(null);
  const picker = useRef<HTMLInputElement>(null);

  function add(list: FileList | null | undefined) {
    if (!list) return;
    setProblem(null);
    const chosen = [...files];
    for (const file of Array.from(list)) {
      if (file.size > MOST) {
        setProblem(`${file.name} is over 10 MB. Split it, or ask the bank for a shorter period.`);
        continue;
      }
      if (!chosen.some((one) => one.name === file.name && one.size === file.size)) chosen.push(file);
    }
    setFiles(chosen);
  }

  async function send() {
    setSending(true);
    setProblem(null);
    const form = new FormData();
    for (const file of files) form.append("files", file);
    try {
      setRun(await http<SyncRunRow>(getUploadStatementsUrl(feed.id), { method: "POST", body: form }));
      onTaken();
    }
    catch (caught) {
      setProblem(caught instanceof ApiError ? caught.message : "The files could not be uploaded. Try again.");
    }
    finally {
      setSending(false);
    }
  }

  if (run) {
    const taken = run.outcome === "SUCCEEDED";
    return (
      <Dialog open title={taken ? "Statement taken" : "Nothing was stored"} onClose={onClose}>
        <div className="space-y-4">
          {taken ? (
            <Alert tone="success">
              <span className="font-semibold tabular-nums">
                {run.fetched} line{run.fetched === 1 ? "" : "s"} read · {run.inserted} stored · {run.skipped} already held
                · {run.validationErrors} refused
              </span>
            </Alert>
          ) : (
            <Alert tone="danger">{run.errorDetail}</Alert>
          )}
          <p className="text-sm text-ink-soft">
            {taken
              ? run.validationErrors > 0
                ? `The ${run.validationErrors} refused line${run.validationErrors === 1 ? " is" : "s are"} on Sync errors with the reasons.`
                : "Every line was taken. The run is in the Ingestion log."
              : "The run is in the Ingestion log. Put right what it says, then upload again."}
          </p>
          <div className="flex justify-end gap-3">
            {taken && run.validationErrors > 0 && (
              <Link to="/sync-errors" className="inline-flex h-10 items-center rounded-xl border border-line bg-white px-4 text-sm font-semibold shadow-xs hover:bg-slate-50">
                See refused lines
              </Link>
            )}
            {!taken && run.errorDetail?.includes("mapping") && (
              <Link to={`/config?tab=mapping&bank=${feed.id}`} className="inline-flex h-10 items-center rounded-xl border border-line bg-white px-4 text-sm font-semibold shadow-xs hover:bg-slate-50">
                Open format mapping
              </Link>
            )}
            <Button onClick={onClose}>{taken ? "Done" : "Close"}</Button>
          </div>
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog
      open
      title={`Upload a statement from ${feed.name}`}
      description={`The files are read through ${feed.name}'s format mapping, checked line by line, and stored once. The run appears in the Ingestion log.`}
      onClose={onClose}
    >
      <div className="space-y-4">
        {problem && <Alert tone="danger">{problem}</Alert>}
        <div
          onDragOver={(event: DragEvent<HTMLDivElement>) => {
            event.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(event: DragEvent<HTMLDivElement>) => {
            event.preventDefault();
            setOver(false);
            add(event.dataTransfer.files);
          }}
          className={cn(
            "rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors",
            over ? "border-primary-600 bg-primary-50" : "border-line bg-canvas",
          )}
        >
          <p className="text-sm text-ink-soft">
            Drop CSV or text files here, or{" "}
            <button
              type="button"
              onClick={() => picker.current?.click()}
              className="font-semibold text-primary-700 underline underline-offset-2 focus-visible:ring-2 focus-visible:ring-line focus-visible:outline-none"
            >
              choose files
            </button>
          </p>
          <p className="mt-1 text-xs text-ink-muted">Up to 10 MB each. A line already stored is not stored again.</p>
          <input
            ref={picker}
            id="statement-files"
            type="file"
            multiple
            accept=".csv,.txt,.tsv,.json,text/csv,text/plain,application/json"
            className="sr-only"
            onChange={(event) => {
              add(event.target.files);
              event.target.value = "";
            }}
          />
        </div>
        {files.length > 0 && (
          <ul className="space-y-2">
            {files.map((file) => (
              <li key={file.name + file.size} className="flex items-center justify-between gap-3 rounded-xl border border-line px-3 py-2.5">
                <span className="flex min-w-0 items-center gap-2 text-sm">
                  <FileText aria-hidden="true" className="size-4 shrink-0 text-ink-muted" />
                  <span className="truncate font-semibold">{file.name}</span>
                  <span className="shrink-0 text-xs text-ink-muted">· {Math.max(1, Math.round(file.size / 1024))} KB</span>
                </span>
                <button
                  type="button"
                  onClick={() => setFiles(files.filter((one) => one !== file))}
                  className="text-xs font-semibold text-ink-muted hover:text-ink"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex justify-end gap-3 pt-1">
          <Button variant="secondary" onClick={onClose} disabled={sending}>
            Cancel
          </Button>
          <Button disabled={files.length === 0 || sending} onClick={() => void send()}>
            {sending ? "Taking…" : `Upload and take ${files.length || ""} file${files.length === 1 ? "" : "s"}`.replace("  ", " ")}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
