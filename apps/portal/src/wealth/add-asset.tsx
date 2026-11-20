import { ApiError, http } from "@atomprive/api-client";
import {
  getAskToAddMyAssetUrl,
  getListMyAssetRequestsQueryKey,
  useListMyAssetCategories,
  useListMyAssetRequests,
  type ClientAssetRequestRow,
  type OwnedAssetCategoryRow,
} from "@atomprive/api-client/portal";
import { Alert, Button, Dialog, Field, RequiredMark, SelectInput, TextInput } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import { Paperclip, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import { money } from "../lib/money";

/** The most a client attaches to one request, and how large each file may be; the server holds the same. */
const MOST_FILES = 5;
const LARGEST_FILE = 10 * 1024 * 1024;

const STANDING: Record<string, [string, string]> = {
  PENDING: ["Waiting for approval", "bg-amber-50 text-amber-800"],
  APPROVED: ["Added", "bg-emerald-50 text-emerald-700"],
  REJECTED: ["Not added", "bg-red-50 text-red-700"],
  WITHDRAWN: ["Taken back", "bg-slate-100 text-ink-muted"],
};

/**
 * Something the client owns outside the portfolio, which they ask to be added: a flat, a painting, a watch. It
 * waits for their portfolio manager, who approves or turns it down; the client is emailed the answer.
 */
export function AddAssetDialog({ currency, onClose }: { currency: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const categories = useListMyAssetCategories<OwnedAssetCategoryRow[], ApiError>();
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [value, setValue] = useState("");
  const [cost, setCost] = useState("");
  const [acquiredOn, setAcquiredOn] = useState("");
  const [location, setLocation] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [tried, setTried] = useState(false);
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState<ApiError | null>(null);
  const [fileProblem, setFileProblem] = useState<string | null>(null);
  const fields = problem?.problem?.errors ?? {};

  function pick(chosen: FileList | null) {
    setFileProblem(null);
    const all = [...files, ...Array.from(chosen ?? [])];
    if (all.length > MOST_FILES) {
      setFileProblem(`Attach up to ${MOST_FILES} files.`);
      return;
    }
    if (all.some((one) => one.size > LARGEST_FILE)) {
      setFileProblem("Each file can be up to 10 MB.");
      return;
    }
    setFiles(all);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setTried(true);
    if (!name.trim() || !categoryId || value === "") return;
    setSending(true);
    setProblem(null);
    const form = new FormData();
    form.append("name", name.trim());
    form.append("categoryId", categoryId);
    form.append("value", value);
    if (cost !== "") form.append("cost", cost);
    if (acquiredOn) form.append("acquiredOn", acquiredOn);
    if (location.trim()) form.append("location", location.trim());
    files.forEach((one) => form.append("files", one, one.name));
    try {
      await http<ClientAssetRequestRow>(getAskToAddMyAssetUrl(), { method: "POST", body: form });
      await queryClient.invalidateQueries({ queryKey: getListMyAssetRequestsQueryKey() });
      onClose();
    } catch (caught) {
      setProblem(caught instanceof ApiError ? caught : new ApiError(0, { status: 0, detail: "It could not be sent. Try again." }));
    } finally {
      setSending(false);
    }
  }

  const input = "h-10 w-full rounded-xl border border-line bg-white px-3 text-sm focus-visible:border-primary-600 focus-visible:outline-2 focus-visible:outline-primary-600";
  return (
    <Dialog open onClose={onClose} title="Add an asset you own"
      description="Something you own outside your portfolio, such as property, art, a watch or jewellery. Your portfolio manager checks it before it joins your net worth.">
      <form onSubmit={(event) => void submit(event)} className="space-y-4" noValidate>
        {problem && !Object.keys(fields).length && <Alert tone="danger">{problem.message}</Alert>}
        <Field id="asset-name" label="Name" required error={fields.name ?? (tried && !name.trim() ? "Name the item." : undefined)}>
          <TextInput id="asset-name" value={name} maxLength={200} placeholder="Cartier necklace" onChange={(event) => setName(event.target.value)} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="asset-category" label="Category" required error={fields.categoryId ?? (tried && !categoryId ? "Pick a category." : undefined)}>
            <SelectInput id="asset-category" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
              <option value="">Choose…</option>
              {(categories.data ?? []).map((one) => <option key={one.id} value={one.id}>{one.name}</option>)}
            </SelectInput>
          </Field>
          <Field id="asset-value" label={`Worth now (${currency})`} required error={fields.value ?? (tried && value === "" ? "Say what it is worth now." : undefined)}>
            <input id="asset-value" type="number" min="0" step="0.01" inputMode="decimal" value={value} onChange={(event) => setValue(event.target.value)} className={input} />
          </Field>
          <Field id="asset-cost" label={`What you paid (${currency})`} hint="Optional" error={fields.cost}>
            <input id="asset-cost" type="number" min="0" step="0.01" inputMode="decimal" value={cost} onChange={(event) => setCost(event.target.value)} className={input} />
          </Field>
          <Field id="asset-bought" label="Bought on" hint="Optional" error={fields.acquiredOn}>
            <input id="asset-bought" type="date" max={new Date().toISOString().slice(0, 10)} value={acquiredOn} onChange={(event) => setAcquiredOn(event.target.value)} className={input} />
          </Field>
        </div>
        <Field id="asset-location" label="Where it is kept" hint="Optional" error={fields.location}>
          <TextInput id="asset-location" value={location} maxLength={200} placeholder="Home safe, Mumbai" onChange={(event) => setLocation(event.target.value)} />
        </Field>
        <div>
          <p className="mb-1.5 text-2xs font-semibold tracking-wider text-ink-muted uppercase">Supporting papers (optional)</p>
          <label htmlFor="asset-files" className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-line px-3 py-2.5 text-sm text-ink-soft hover:bg-sidebar">
            <Paperclip aria-hidden="true" className="size-4" />
            Attach a valuation, invoice or deed
          </label>
          <input id="asset-files" type="file" multiple className="sr-only" onChange={(event) => { pick(event.target.files); event.target.value = ""; }} />
          {fileProblem && <p className="mt-1 text-xs text-red-600">{fileProblem}</p>}
          {files.length > 0 && (
            <ul className="mt-2 space-y-1">
              {files.map((one, at) => (
                <li key={`${one.name}-${at}`} className="flex items-center justify-between gap-2 rounded-lg bg-sidebar px-3 py-1.5 text-sm">
                  <span className="min-w-0 truncate">{one.name}</span>
                  <button type="button" aria-label={`Remove ${one.name}`} onClick={() => setFiles(files.filter((_, index) => index !== at))}
                    className="text-ink-muted hover:text-ink">
                    <X aria-hidden="true" className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex justify-end gap-2.5">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={sending}>{sending ? "Sending…" : "Send for approval"}</Button>
        </div>
        <p className="text-xs text-ink-muted"><RequiredMark /> Required</p>
      </form>
    </Dialog>
  );
}

/**
 * What the client has asked to add, and what became of each: waiting, added, or not added with the reason. Only
 * drawn once there is something to show.
 */
export function MyAssetRequests({ currency }: { currency: string }) {
  const requests = useListMyAssetRequests<ClientAssetRequestRow[], ApiError>();
  const rows = requests.data ?? [];
  if (rows.length === 0) return null;
  return (
    <section className="rounded-2xl border border-line bg-white p-5">
      <h2 className="text-base font-bold text-ink">Assets you added</h2>
      <p className="mt-0.5 text-sm text-ink-muted">Each one joins your holdings once your portfolio manager approves it.</p>
      <ul className="mt-3 divide-y divide-line border-y border-line">
        {rows.map((one) => {
          const [label, tone] = STANDING[one.status] ?? [one.status, "bg-slate-100 text-ink-muted"];
          return (
            <li key={one.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="font-semibold text-ink">{one.name}</p>
                <p className="text-xs text-ink-muted">
                  {money(one.value, currency)}
                  {one.files > 0 && ` · ${one.files} ${one.files === 1 ? "file" : "files"} attached`}
                  {` · sent ${new Date(one.askedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`}
                </p>
                {one.status === "REJECTED" && one.reason && <p className="mt-1 text-sm text-red-700">{one.reason}</p>}
              </div>
              <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${tone}`}>{label}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
