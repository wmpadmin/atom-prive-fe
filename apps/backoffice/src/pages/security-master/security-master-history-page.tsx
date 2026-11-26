import { ApiError } from "@atomprive/api-client";
import { useGetSecurityMaster, type SecurityMaster } from "@atomprive/api-client/backoffice";
import { Alert, Button, cn, FilterMenu, Pagination } from "@atomprive/ui";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { formatDate, formatDateTime, roleLabel } from "../../lib/labels";
import { PAGE_SIZES } from "../../lib/page-sizes";
import { SecurityMasterCrumbs } from "./security-master-page";

type Status = "ALL" | "CURRENT" | "REPLACED";

/**
 * The Security master's history (26 Nov 2026): every day's Excel upload on a screen of its own, newest first — a day
 * uploaded twice shows both, the earlier marked Replaced. A row opens that upload's securities on the Security master.
 */
export function SecurityMasterHistoryPage() {
  const master = useGetSecurityMaster<SecurityMaster, ApiError>();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<Status>("ALL");
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(PAGE_SIZES[1] ?? 25);

  const uploads = useMemo(() => master.data?.uploads ?? [], [master.data]);
  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return uploads.filter((one) =>
      (status === "ALL" || (status === "REPLACED") === (one.replacedAt != null))
      && (!needle || one.fileName.toLowerCase().includes(needle) || one.uploadedBy.toLowerCase().includes(needle)
        || formatDate(one.asOf).toLowerCase().includes(needle)));
  }, [uploads, query, status]);
  const pageRows = shown.slice(page * size, (page + 1) * size);
  const days = new Set(uploads.map((one) => one.asOf)).size;
  const replaced = uploads.filter((one) => one.replacedAt != null).length;
  const open = (id: string) => navigate(`/security-master/uploads/${id}`);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <SecurityMasterCrumbs here="History" />
          <h1 className="mt-2 text-[1.625rem] font-bold">Security master history</h1>
          <p className="mt-1 max-w-3xl text-sm text-ink-muted">
            Every day's Excel upload, newest first. Click a row to open that day's securities. A refused file is never
            saved, so it is not listed.
          </p>
        </div>
        <Button variant="secondary" onClick={() => navigate("/security-master")}>
          <ChevronLeft aria-hidden="true" className="size-4" />
          Back to the latest day
        </Button>
      </header>

      {master.isError && <Alert tone="danger">{master.error.message}</Alert>}

      <section className="rounded-2xl border border-line bg-white p-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="relative w-full max-w-sm">
            <span className="sr-only">Search file name, day or uploaded by</span>
            <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted" />
            <input type="search" value={query} placeholder="Search file name, day or uploaded by…"
              onChange={(event) => { setQuery(event.target.value); setPage(0); }}
              className="h-10 w-full rounded-xl border border-line bg-white pr-3 pl-9 text-sm placeholder:text-ink-muted focus-visible:ring-2 focus-visible:ring-primary-200 focus-visible:outline-none" />
          </label>
          <FilterMenu<Status> label="Status" value={status} onChange={(next) => { setStatus(next); setPage(0); }}
            options={[
              { id: "ALL", label: "All", count: uploads.length },
              { id: "CURRENT", label: "Current", count: uploads.length - replaced },
              { id: "REPLACED", label: "Replaced", count: replaced },
            ]} />
          {master.data && (
            <span className="ml-auto text-sm text-ink-muted">
              {uploads.length} {uploads.length === 1 ? "upload" : "uploads"} · {days} {days === 1 ? "day" : "days"}
            </span>
          )}
        </div>

        <div className="mt-4 overflow-x-auto rounded-xl border border-line">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 text-xs tracking-wide text-ink-muted uppercase">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-semibold">As of</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">File</th>
                <th scope="col" className="px-4 py-2.5 text-right font-semibold">Securities</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Uploaded</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">By</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Status</th>
                <th scope="col" className="px-4 py-2.5"><span className="sr-only">Open</span></th>
              </tr>
            </thead>
            <tbody>
              {master.isPending && (
                <tr><td colSpan={7} className="px-4 py-6 text-ink-muted">Loading uploads…</td></tr>
              )}
              {master.data && shown.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-ink-muted">
                    {uploads.length === 0 ? "No security master uploaded yet." : "No upload matches."}
                  </td>
                </tr>
              )}
              {pageRows.map((one) => (
                // The whole row opens the day; the link at its end stays the way in for a keyboard.
                <tr key={one.id} onClick={() => open(one.id)} className="cursor-pointer border-t border-line hover:bg-slate-50">
                  <td className="px-4 py-3 font-semibold">{formatDate(one.asOf)}</td>
                  <td className="px-4 py-3">{one.fileName}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{one.rowCount}</td>
                  <td className="px-4 py-3">{formatDateTime(one.uploadedAt)}</td>
                  <td className="px-4 py-3">
                    {one.uploadedBy}
                    {one.uploadedByRole && <span className="text-ink-muted"> · {roleLabel(one.uploadedByRole)}</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn("rounded-md px-1.5 py-0.5 text-xs font-semibold",
                      one.replacedAt ? "bg-slate-100 text-ink-soft" : "bg-emerald-50 text-emerald-700")}
                      title={one.replacedAt ? `Replaced ${formatDateTime(one.replacedAt)}` : undefined}>
                      {one.replacedAt ? "Replaced" : "Current"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link to={`/security-master/uploads/${one.id}`} onClick={(event) => event.stopPropagation()}
                      className="inline-flex items-center gap-0.5 font-semibold text-primary-600 hover:text-primary-700">
                      Open
                      <ChevronRight aria-hidden="true" className="size-4" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {shown.length > 0 && (
          <div className="mt-3">
            <Pagination page={page} pageSize={size} totalItems={shown.length} onPageChange={setPage}
              pageSizes={PAGE_SIZES} onPageSizeChange={(next) => { setSize(next); setPage(0); }}
              noun={["upload", "uploads"]} />
          </div>
        )}
      </section>
    </div>
  );
}
