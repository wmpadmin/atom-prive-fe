import { ApiError, httpFile } from "@atomprive/api-client";
import { getDocumentsQueryKey, useDocuments, useUpload, type DocumentRow } from "@atomprive/api-client/portal";
import { Alert, Button, Dialog, SelectInput } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import { Download, Eye, FileImage, FileSpreadsheet, FileText, Search, Upload } from "lucide-react";
import { useState } from "react";
import { useSearchParams } from "react-router";
import { when } from "../lib/dates";

/**
 * Every document on the client's file: what they have put there in the portal, and what the firm has put there
 * for them — KYC papers, files on their forms, files kept against things they own, and reports produced about
 * them. Viewed in a new tab or saved. A client may upload a KYC paper; it waits for the firm to check it.
 */

const TABS = [
  { id: "ALL", label: "All" },
  { id: "STATEMENTS", label: "Statements" },
  { id: "REPORTS", label: "Reports" },
  { id: "AGREEMENTS", label: "Agreements" },
  { id: "KYC", label: "KYC" },
  { id: "OTHERS", label: "Others" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const CATEGORY_LABEL: Record<string, string> = {
  STATEMENTS: "Statements",
  REPORTS: "Reports",
  AGREEMENTS: "Agreements",
  KYC: "KYC",
  OTHERS: "Others",
};

const STATUS: Record<string, { label: string; tone: string }> = {
  VERIFIED: { label: "Verified", tone: "bg-access-full-soft text-access-full-ink" },
  PENDING: { label: "Pending review", tone: "bg-access-view-soft text-access-view-ink" },
  NOT_ACCEPTED: { label: "Not accepted", tone: "bg-access-none-soft text-access-none-ink" },
  NEW_COPY_NEEDED: { label: "New copy needed", tone: "bg-access-none-soft text-access-none-ink" },
  EXPIRED: { label: "Expired", tone: "bg-access-none-soft text-access-none-ink" },
};

/** The KYC papers a client may send from here. */
const KINDS = [
  { id: "PASSPORT", label: "Passport" },
  { id: "NATIONAL_ID", label: "National ID" },
  { id: "PROOF_OF_ADDRESS", label: "Proof of address" },
  { id: "SOURCE_OF_FUNDS", label: "Source of funds" },
  { id: "SOURCE_OF_WEALTH", label: "Source of wealth" },
  { id: "OTHER", label: "Other KYC document" },
];

function iconFor(type: string) {
  if (type.startsWith("image/")) return FileImage;
  if (type.includes("csv") || type.includes("sheet")) return FileSpreadsheet;
  return FileText;
}

function sizeOf(bytes: number) {
  return bytes >= 1_048_576 ? `${(bytes / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function urlOf(one: DocumentRow, download: boolean) {
  return `/api/portal/documents/${one.source}/${one.id}${download ? "?download=true" : ""}`;
}

/** Choose the kind of paper and the file; it goes to the firm to check. */
function UploadDialog({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [kind, setKind] = useState("");
  const [otherName, setOtherName] = useState("");
  const [expiresOn, setExpiresOn] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const upload = useUpload<ApiError>({
    mutation: {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: getDocumentsQueryKey() });
        onClose();
      },
    },
  });
  // Set by an Upload with something missing; each such box then shows red until it is filled in.
  const [tried, setTried] = useState(false);
  const noKind = tried && !kind;
  const noName = tried && kind === "OTHER" && !otherName.trim();
  const noFile = tried && !file;

  return (
    <Dialog open onClose={onClose} title="Upload a document" description="Send the firm a KYC document. It shows as Pending review until they have checked it.">
      <div className="space-y-4">
        <div>
          <label htmlFor="upload-kind" className="mb-1.5 block text-2xs font-semibold tracking-wider text-ink-muted uppercase">
            What is it?
          </label>
          <SelectInput id="upload-kind" value={kind} aria-invalid={noKind} onChange={(event) => setKind(event.target.value)}>
            <option value="">Choose…</option>
            {KINDS.map((one) => (
              <option key={one.id} value={one.id}>
                {one.label}
              </option>
            ))}
          </SelectInput>
          {noKind && <p className="mt-1 text-xs text-red-600">Choose what the document is.</p>}
        </div>
        {kind === "OTHER" && (
          <div>
            <label htmlFor="upload-name" className="mb-1.5 block text-2xs font-semibold tracking-wider text-ink-muted uppercase">
              Name of the document
            </label>
            <input
              id="upload-name"
              value={otherName}
              maxLength={120}
              aria-invalid={noName}
              onChange={(event) => setOtherName(event.target.value)}
              placeholder="e.g. Tax residency certificate"
              className="h-10 w-full rounded-xl border border-line bg-white px-3 text-sm focus-visible:border-primary-600 focus-visible:outline-2 focus-visible:outline-primary-600 aria-invalid:border-red-500"
            />
            {noName && <p className="mt-1 text-xs text-red-600">Enter the name of the document.</p>}
          </div>
        )}
        <div>
          <label htmlFor="upload-expires" className="mb-1.5 block text-2xs font-semibold tracking-wider text-ink-muted uppercase">
            Expires on (optional)
          </label>
          <input
            id="upload-expires"
            type="date"
            value={expiresOn}
            onChange={(event) => setExpiresOn(event.target.value)}
            className="h-10 w-full rounded-xl border border-line bg-white px-3 text-sm focus-visible:border-primary-600 focus-visible:outline-2 focus-visible:outline-primary-600"
          />
        </div>
        <div>
          <label htmlFor="upload-file" className="mb-1.5 block text-2xs font-semibold tracking-wider text-ink-muted uppercase">
            File
          </label>
          <input
            id="upload-file"
            type="file"
            accept="application/pdf,image/jpeg,image/png"
            aria-invalid={noFile}
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            className="block w-full text-sm text-ink-soft file:mr-3 file:rounded-lg file:border-0 file:bg-primary-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-primary-700"
          />
          {noFile
            ? <p className="mt-1 text-xs text-red-600">Pick a file to upload.</p>
            : <p className="mt-1 text-xs text-ink-muted">PDF, JPEG or PNG, up to 10 MB.</p>}
        </div>
        {upload.isError && <Alert tone="danger">{upload.error.message}</Alert>}
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={upload.isPending}>
            Cancel
          </Button>
          <Button
            disabled={upload.isPending}
            onClick={() => {
              if (!kind || !file || (kind === "OTHER" && !otherName.trim())) {
                setTried(true);
                requestAnimationFrame(() => document.querySelector<HTMLElement>("[aria-invalid='true']")?.focus());
                return;
              }
              upload.mutate({
                params: { kind, otherName: kind === "OTHER" ? otherName.trim() : undefined, expiresOn: expiresOn || undefined },
                data: { file },
              });
            }}
          >
            <Upload aria-hidden="true" />
            {upload.isPending ? "Uploading…" : "Upload"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

export function DocumentsPage() {
  const [params, setParams] = useSearchParams();
  const tab: TabId = TABS.some((one) => one.id === params.get("tab")) ? (params.get("tab") as TabId) : "ALL";
  const documents = useDocuments<DocumentRow[], ApiError>();
  const [search, setSearch] = useState("");
  const [uploading, setUploading] = useState(false);
  const [problem, setProblem] = useState<string>();

  const all = documents.data ?? [];
  const count = (id: TabId) => (id === "ALL" ? all.length : all.filter((one) => one.category === id).length);
  const wanted = search.trim().toLowerCase();
  const shown = all.filter(
    (one) =>
      (tab === "ALL" || one.category === tab) &&
      (!wanted || one.name.toLowerCase().includes(wanted) || one.fileName.toLowerCase().includes(wanted)),
  );

  const view = async (one: DocumentRow) => {
    setProblem(undefined);
    // Opened while the click is still the client's, or the browser takes it for a pop-up.
    const opened = window.open("", "_blank");
    try {
      const blob = await httpFile(urlOf(one, false));
      const href = URL.createObjectURL(blob);
      if (opened) opened.location.replace(href);
      else window.location.assign(href);
    } catch (caught) {
      opened?.close();
      setProblem(caught instanceof ApiError ? caught.message : "The document could not be opened.");
    }
  };

  const save = async (one: DocumentRow) => {
    setProblem(undefined);
    try {
      const blob = await httpFile(urlOf(one, true));
      const href = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = href;
      link.download = one.fileName;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(href), 1_000);
    } catch (caught) {
      setProblem(caught instanceof ApiError ? caught.message : "The document could not be downloaded.");
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[1.625rem] font-bold text-balance text-ink">Documents</h1>
          <p className="mt-1 text-sm text-ink-muted">Upload, view and download your documents.</p>
        </div>
        <Button onClick={() => setUploading(true)}>
          <Upload aria-hidden="true" />
          Upload document
        </Button>
      </div>

      <section className="rounded-2xl border border-line bg-white p-5">
        <div role="tablist" aria-label="Document categories" className="mb-4 flex gap-6 overflow-x-auto border-b border-line">
          {TABS.map((one) => (
            <button
              key={one.id}
              type="button"
              role="tab"
              aria-selected={tab === one.id}
              onClick={() =>
                setParams(
                  (was) => {
                    const next = new URLSearchParams(was);
                    next.set("tab", one.id);
                    return next;
                  },
                  { replace: true },
                )
              }
              className={`-mb-px border-b-2 pb-2.5 text-sm font-semibold whitespace-nowrap ${
                tab === one.id ? "border-primary-600 text-primary-700" : "border-transparent text-ink-muted hover:text-ink"
              }`}
            >
              {one.label} ({count(one.id)})
            </button>
          ))}
        </div>

        <label className="relative mb-4 block max-w-md">
          <span className="sr-only">Search documents</span>
          <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-muted" />
          <input
            id="document-search"
            type="search"
            value={search}
            placeholder="Search documents…"
            onChange={(event) => setSearch(event.target.value)}
            className="h-10 w-full rounded-xl border border-line bg-white pr-3 pl-10 text-sm focus-visible:border-primary-600 focus-visible:outline-2 focus-visible:outline-primary-600"
          />
        </label>
        {problem && <p className="mb-3 text-sm text-access-none-ink">{problem}</p>}

        {documents.isError ? (
          <p className="py-8 text-center text-sm text-access-none-ink">Your documents could not be loaded. Refresh the page to try again.</p>
        ) : !documents.data ? (
          <div className="h-60 animate-pulse rounded-xl bg-sidebar" />
        ) : shown.length === 0 ? (
          <p className="py-10 text-center text-sm text-ink-muted">{all.length > 0 && wanted ? "No documents match your search." : "None yet."}</p>
        ) : (
          <>
          {/* On a phone, one card per document with its status, View and Download in view (S64). */}
          <ul className="divide-y divide-line border-y border-line sm:hidden">
            {shown.map((one) => {
              const status = one.status ? STATUS[one.status] : undefined;
              return (
                <li key={`${one.source}-${one.id}`} className="px-1 py-3">
                  <div className="flex justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-ink">{one.name}</p>
                      <p className="truncate text-sm text-ink-muted">
                        {one.fileName} · {sizeOf(one.sizeBytes)}
                      </p>
                      <p className="text-sm text-ink-muted">
                        {CATEGORY_LABEL[one.category] ?? one.category} · {when(one.uploadedAt)} · {one.byYou ? "You" : "Atom Privé"}
                      </p>
                    </div>
                    {status && <span className={`h-fit shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${status.tone}`}>{status.label}</span>}
                  </div>
                  {one.reason && <p className="mt-1 text-sm text-ink-muted">{one.reason}</p>}
                  <div className="mt-2 flex gap-2">
                    <Button variant="secondary" size="sm" onClick={() => void view(one)} aria-label={`View ${one.name}`}>
                      <Eye aria-hidden="true" />
                      View
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => void save(one)} aria-label={`Download ${one.name}`}>
                      <Download aria-hidden="true" />
                      Download
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="border-y border-line text-left text-2xs font-semibold tracking-wider whitespace-nowrap text-ink-muted uppercase">
                  <th scope="col" className="py-3 pr-4 pl-3">Document name</th>
                  <th scope="col" className="px-4 py-3">Category</th>
                  <th scope="col" className="px-4 py-3">Uploaded on</th>
                  <th scope="col" className="px-4 py-3">Uploaded by</th>
                  <th scope="col" className="px-4 py-3">Status</th>
                  <th scope="col" className="py-3 pr-3 pl-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {shown.map((one) => {
                  const Icon = iconFor(one.contentType);
                  const status = one.status ? STATUS[one.status] : undefined;
                  return (
                    <tr key={`${one.source}-${one.id}`}>
                      <td className="px-3 py-3">
                        <span className="flex items-center gap-3">
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
                            <Icon aria-hidden="true" className="size-4" />
                          </span>
                          <span className="min-w-0">
                            <span className="block font-semibold text-ink">{one.name}</span>
                            <span className="block truncate text-xs text-ink-muted">
                              {one.fileName} · {sizeOf(one.sizeBytes)}
                            </span>
                          </span>
                        </span>
                      </td>
                      <td className="px-3 py-3 text-ink-soft">{CATEGORY_LABEL[one.category] ?? one.category}</td>
                      <td className="px-3 py-3 whitespace-nowrap text-ink-soft">{when(one.uploadedAt)}</td>
                      <td className="px-3 py-3 text-ink-soft">{one.byYou ? "You" : "Atom Privé"}</td>
                      <td className="px-3 py-3">
                        {status ? (
                          <>
                            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${status.tone}`}>{status.label}</span>
                            {one.reason && <span className="mt-1 block max-w-56 text-xs text-ink-muted">{one.reason}</span>}
                          </>
                        ) : (
                          <span className="text-ink-muted">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <span className="flex justify-end gap-1">
                          <button type="button" aria-label={`View ${one.name}`} onClick={() => void view(one)} className="rounded-lg p-2 text-ink-soft hover:bg-sidebar hover:text-ink">
                            <Eye aria-hidden="true" className="size-4" />
                          </button>
                          <button type="button" aria-label={`Download ${one.name}`} onClick={() => void save(one)} className="rounded-lg p-2 text-ink-soft hover:bg-sidebar hover:text-ink">
                            <Download aria-hidden="true" className="size-4" />
                          </button>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          </>
        )}
      </section>
      {uploading && <UploadDialog onClose={() => setUploading(false)} />}
    </div>
  );
}
