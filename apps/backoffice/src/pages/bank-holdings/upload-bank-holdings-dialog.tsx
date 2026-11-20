import { ApiError, http } from "@atomprive/api-client";
import { getUploadBankHoldingsUrl, useGetBankHoldingsClients, type BankHoldingsBank, type BankHoldingsClients } from "@atomprive/api-client/backoffice";
import { Alert, Button, cn, Dialog } from "@atomprive/ui";
import { FileText } from "lucide-react";
import { useRef, useState, type DragEvent } from "react";

/** The most one bank's file may be, as the server holds it. */
const MOST = 20 * 1024 * 1024;

/**
 * One or more banks' holdings Excel files. Each bank is named by its file ("Holdings - UBS Bank.xlsx" is UBS Bank),
 * and a file from a bank already on the list takes the older file's place.
 */
export function UploadBankHoldingsDialog({ onClose, onTaken }: { onClose: () => void; onTaken: () => void }) {
  const [files, setFiles] = useState<File[]>([]);
  const [over, setOver] = useState(false);
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [taken, setTaken] = useState<BankHoldingsBank[] | null>(null);
  const [tried, setTried] = useState(false);
  const clients = useGetBankHoldingsClients<BankHoldingsClients, ApiError>();
  const [clientId, setClientId] = useState("");
  const picker = useRef<HTMLInputElement>(null);
  const noFile = tried && files.length === 0;

  function add(list: FileList | null | undefined) {
    if (!list) return;
    setProblem(null);
    const chosen = [...files];
    for (const file of Array.from(list)) {
      if (file.size > MOST) {
        setProblem(`${file.name} is over 20 MB.`);
        continue;
      }
      if (!chosen.some((one) => one.name === file.name && one.size === file.size)) chosen.push(file);
    }
    setFiles(chosen);
  }

  async function send() {
    if (files.length === 0) {
      setTried(true);
      document.getElementById("bank-holdings-choose")?.focus();
      return;
    }
    setSending(true);
    setProblem(null);
    const form = new FormData();
    for (const file of files) form.append("files", file);
    if (clientId) form.append("clientId", clientId);
    try {
      setTaken(await http<BankHoldingsBank[]>(getUploadBankHoldingsUrl(), { method: "POST", body: form }));
      onTaken();
    }
    catch (caught) {
      setProblem(caught instanceof ApiError ? caught.message : "The files could not be uploaded. Try again.");
    }
    finally {
      setSending(false);
    }
  }

  if (taken) {
    return (
      <Dialog open title={taken.length === 1 ? "File uploaded" : `${taken.length} files uploaded`} onClose={onClose}>
        <div className="space-y-4">
          <ul className="space-y-2">
            {taken.map((one) => (
              <li key={one.id} className="flex items-center justify-between gap-3 rounded-xl border border-line px-3 py-2.5 text-sm">
                <span className="font-semibold">{one.bankName}{one.clientName ? ` · ${one.clientName}` : ""}</span>
                <span className="text-ink-muted tabular-nums">{one.lines} holdings read</span>
              </li>
            ))}
          </ul>
          <div className="flex justify-end">
            <Button onClick={onClose}>Done</Button>
          </div>
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog open title="Upload bank data"
      description="Each bank's holdings Excel. The bank is taken from the file name, and a newer file replaces that bank's older one."
      onClose={onClose}>
      <div className="space-y-4">
        {problem && <Alert tone="danger">{problem}</Alert>}
        <div>
          <label htmlFor="bank-holdings-client" className="block text-sm font-semibold">Client</label>
          <p className="text-xs text-ink-muted">Whose holdings the files state. They show on that client's Holdings screen, by bank.</p>
          <select id="bank-holdings-client" value={clientId} onChange={(event) => setClientId(event.target.value)}
            className="mt-1.5 h-10 w-full rounded-xl border border-line bg-white px-3 text-sm">
            <option value="">Not said yet</option>
            {(clients.data?.clients ?? []).map((one) => <option key={one.id} value={one.id}>{one.name}</option>)}
          </select>
        </div>
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
            over ? "border-primary-600 bg-primary-50" : noFile ? "border-red-500 bg-canvas" : "border-line bg-canvas",
          )}
        >
          <p className="text-sm text-ink-soft">
            Drop the banks' Excel files here, or{" "}
            <button id="bank-holdings-choose" type="button" aria-invalid={noFile || undefined}
              aria-describedby={noFile ? "bank-holdings-files-error" : undefined}
              onClick={() => picker.current?.click()}
              className="font-semibold text-primary-700 underline underline-offset-2 focus-visible:ring-2 focus-visible:ring-line focus-visible:outline-none">
              choose files
            </button>
          </p>
          <p className="mt-1 text-xs text-ink-muted">Named like "Holdings - UBS Bank.xlsx". Up to 20 MB each.</p>
          {noFile && <p id="bank-holdings-files-error" className="mt-1 text-xs text-red-600">Pick a file to upload.</p>}
          <input ref={picker} id="bank-holdings-files" type="file" multiple
            accept=".xlsx,.xls,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            className="sr-only"
            onChange={(event) => {
              add(event.target.files);
              event.target.value = "";
            }} />
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
                <button type="button" onClick={() => setFiles(files.filter((one) => one !== file))}
                  className="text-xs font-semibold text-ink-muted hover:text-ink">
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex justify-end gap-3 pt-1">
          <Button variant="secondary" onClick={onClose} disabled={sending}>Cancel</Button>
          <Button disabled={sending} onClick={() => void send()}>
            {sending ? "Uploading…" : files.length > 1 ? `Upload ${files.length} files` : "Upload"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
