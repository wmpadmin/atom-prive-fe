import { ApiError } from "@atomprive/api-client";
import {
  getGetSecurityMasterQueryKey,
  getGetSecurityMasterTemplateUrl,
  useGetSecurityMaster,
  useGetSecurityMasterRows,
  type SecurityMaster,
  type SecurityMasterColumn,
  type SecurityMasterRows,
  type SecurityMasterUpload,
} from "@atomprive/api-client/backoffice";
import { Alert, Button, cn, Pagination } from "@atomprive/ui";
import { keepPreviousData, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, CloudUpload, Database, Download, History, Home, Search } from "lucide-react";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useStaffUser } from "../../auth/session";
import { saveApiFile } from "../../lib/download";
import { formatDate } from "../../lib/labels";
import { PAGE_SIZES } from "../../lib/page-sizes";
import { ASSET_CLASSES, applies, bands, cellText, isNumeric } from "./security-master-format";
import { UploadSecurityMasterDialog } from "./upload-security-master-dialog";

/** The widths of the frozen columns A to F, so each knows where the one before it ends. */
const FROZEN_WIDTHS = ["9rem", "7.5rem", "9rem", "11rem", "9rem", "16rem"];

/** Where each frozen column starts: the widths of the ones before it, added up. */
const FROZEN_LEFT = FROZEN_WIDTHS.map((_, index) => `calc(${FROZEN_WIDTHS.slice(0, index).join(" + ") || "0rem"})`);

/**
 * The Security master: the latest day's security data from Bloomberg, one row per security, as the client's template
 * lays it out — columns A to F (Asset Class to Security Name) held in place while the other 174 scroll, the
 * template's bands over the columns. Earlier days are on the History screen. Uploaded by whoever the permission matrix
 * gives Full access; View only reads it.
 */
export function SecurityMasterPage() {
  const master = useGetSecurityMaster<SecurityMaster, ApiError>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState<SecurityMasterUpload | null>(null);
  const [downloadProblem, setDownloadProblem] = useState<string | null>(null);

  const data = master.data;
  const latest = data?.days[0] ?? null;

  const download = () => {
    setDownloadProblem(null);
    saveApiFile(getGetSecurityMasterTemplateUrl(), "Security Master Template.xlsx")
      .catch((caught) => setDownloadProblem(caught instanceof ApiError ? caught.message : "The template could not be downloaded."));
  };

  const saved = (one: SecurityMasterUpload) => {
    setUploading(false);
    setUploaded(one);
    void queryClient.invalidateQueries({ queryKey: getGetSecurityMasterQueryKey() });
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <SecurityMasterCrumbs />
          <h1 className="mt-2 text-[1.625rem] font-bold">Security master</h1>
          <p className="mt-1 max-w-3xl text-sm text-ink-muted">
            {latest
              ? `${formatDate(latest.asOf)} · ${latest.rowCount} ${latest.rowCount === 1 ? "security" : "securities"}`
              : "Each day's security data from Bloomberg, one row per security, in the client's template."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {/* Every day's upload on a screen of its own (26 Nov 2026), rather than in the side panel. */}
          <Button variant="secondary" onClick={() => navigate("/security-master/history")}>
            <History aria-hidden="true" className="size-4" />
            History
          </Button>
          <Button variant="secondary" onClick={download}>
            <Download aria-hidden="true" className="size-4" />
            Download template
          </Button>
          {data?.canUpload && (
            <Button onClick={() => setUploading(true)}>
              <CloudUpload aria-hidden="true" className="size-4" />
              Upload security master
            </Button>
          )}
        </div>
      </header>

      {downloadProblem && <Alert tone="danger">{downloadProblem}</Alert>}
      {uploaded && (
        <Alert tone="success">
          Uploaded {uploaded.fileName}: {formatDate(uploaded.asOf)}, {uploaded.rowCount} securities.
          {latest && latest.id !== uploaded.id && " It is an earlier day than the latest, so it is on the History screen."}
        </Alert>
      )}
      {master.isError && <Alert tone="danger">{master.error.message}</Alert>}
      {master.isPending && <p className="text-sm text-ink-muted">Loading the security master…</p>}

      {data && data.uploads.length === 0 && (
        <section className="rounded-2xl border border-line bg-white px-6 py-14 text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-xl bg-primary-50 text-primary-700">
            <Database aria-hidden="true" className="size-6" />
          </span>
          <h2 className="mt-4 text-base font-bold">No security master uploaded yet</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-ink-muted">
            Upload the day's file in the client's template (sheet "Holdings Data"). One file per day; all four asset
            classes go in the same sheet.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Button variant="secondary" onClick={download}>
              <Download aria-hidden="true" className="size-4" />
              Download template
            </Button>
            {data.canUpload && (
              <Button onClick={() => setUploading(true)}>
                <CloudUpload aria-hidden="true" className="size-4" />
                Upload the first one
              </Button>
            )}
          </div>
        </section>
      )}

      {data && latest && <SecurityDay key={latest.id} uploadId={latest.id} columns={data.columns} />}

      {uploading && <UploadSecurityMasterDialog onClose={() => setUploading(false)} onSaved={saved} />}
    </div>
  );
}

/**
 * One upload opened from the History screen, on a screen of its own (26 Nov 2026): its day and file over the same
 * table, and Back to the History screen.
 */
export function SecurityMasterUploadPage() {
  const master = useGetSecurityMaster<SecurityMaster, ApiError>();
  const { uploadId = "" } = useParams();
  const navigate = useNavigate();
  const upload = master.data?.uploads.find((one) => one.id === uploadId);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <SecurityMasterCrumbs here="History" also={upload ? formatDate(upload.asOf) : undefined} />
          <h1 className="mt-2 text-[1.625rem] font-bold">
            Security master{upload && ` · ${formatDate(upload.asOf)}`}
          </h1>
          {upload && (
            <p className="mt-1 max-w-3xl text-sm text-ink-muted">
              {upload.fileName} · {upload.rowCount} {upload.rowCount === 1 ? "security" : "securities"}
              {" · "}{upload.replacedAt ? "Replaced" : "Current"}
            </p>
          )}
        </div>
        <Button variant="secondary" onClick={() => navigate("/security-master/history")}>
          <ChevronLeft aria-hidden="true" className="size-4" />
          Back to history
        </Button>
      </header>

      {master.isError && <Alert tone="danger">{master.error.message}</Alert>}
      {master.isPending && <p className="text-sm text-ink-muted">Loading the upload…</p>}
      {master.data && !upload && <Alert tone="danger">No such security master upload.</Alert>}
      {master.data && upload && <SecurityDay key={upload.id} uploadId={upload.id} columns={master.data.columns} />}
    </div>
  );
}

/** One upload's securities: a tab per asset class, a search of the identifiers, the table and its pages. */
function SecurityDay({ uploadId, columns }: { uploadId: string; columns: SecurityMasterColumn[] }) {
  const [assetClass, setAssetClass] = useState<string>("ALL");
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(PAGE_SIZES[PAGE_SIZES.length - 1] ?? 50);

  // The search goes to the server once the typing pauses, not on every key.
  useEffect(() => {
    const wait = setTimeout(() => { setSearch(query.trim()); setPage(0); }, 300);
    return () => clearTimeout(wait);
  }, [query]);

  const rows = useGetSecurityMasterRows<SecurityMasterRows, ApiError>(uploadId,
    { assetClass: assetClass === "ALL" ? undefined : assetClass, search: search || undefined, page, size },
    { query: { placeholderData: keepPreviousData } });

  return (
    <section className="rounded-2xl border border-line bg-white p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div role="tablist" aria-label="Asset class" className="flex flex-wrap gap-1 rounded-xl border border-line p-1">
          {[{ id: "ALL", label: "All" }, ...ASSET_CLASSES].map((one) => (
            <button key={one.id} type="button" role="tab" aria-selected={assetClass === one.id}
              onClick={() => { setAssetClass(one.id); setPage(0); }}
              className={cn("rounded-lg px-3 py-1.5 text-sm font-semibold",
                assetClass === one.id ? "bg-primary-50 text-primary-700 ring-1 ring-primary-100" : "text-ink-muted hover:text-ink")}>
              {one.label}
              <span className="ml-1.5 font-medium text-ink-muted tabular-nums">{rows.data?.counts[one.id] ?? "—"}</span>
            </button>
          ))}
        </div>
        <label className="relative ml-auto min-w-64">
          <span className="sr-only">Search ISIN, name, ticker or issuer</span>
          <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted" />
          <input type="search" value={query} placeholder="Search ISIN, name, ticker, issuer…"
            onChange={(event) => setQuery(event.target.value)}
            className="h-10 w-full rounded-xl border border-line bg-white pr-3 pl-9 text-sm placeholder:text-ink-muted focus-visible:ring-2 focus-visible:ring-primary-200 focus-visible:outline-none" />
        </label>
      </div>

      {rows.isError && <div className="mt-4"><Alert tone="danger">{rows.error.message}</Alert></div>}
      <div className="mt-4">
        <SecurityTable columns={columns} rows={rows.data} loading={rows.isPending} />
      </div>
      <p className="mt-2 text-xs text-ink-muted">
        Blank: the column does not apply to that asset class. —: it applies, but the file left it blank.
        Figures as sent: percentages in percent points, spreads in bp, (mn) in millions.
      </p>
      {rows.data && rows.data.total > 0 && (
        <div className="mt-3">
          <Pagination page={page} pageSize={size} totalItems={rows.data.total} onPageChange={setPage}
            pageSizes={PAGE_SIZES} onPageSizeChange={(next) => { setSize(next); setPage(0); }}
            noun={["security", "securities"]} />
        </div>
      )}
    </section>
  );
}

/**
 * Where the Security master sits on the reader's menu: under Portfolio management for the desk, under Home for the rest.
 * Its History screen is one step under it, and an upload opened from there one more.
 */
export function SecurityMasterCrumbs({ here, also }: { here?: string; also?: string }) {
  const user = useStaffUser();
  return (
    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-sm text-ink-muted">
      <Link to="/" aria-label="Home" className="hover:text-ink"><Home aria-hidden="true" className="size-4" /></Link>
      {user.activeRole === "PORTFOLIO_MANAGER" && (
        <>
          <ChevronRight aria-hidden="true" className="size-3.5" />
          <span>Portfolio management</span>
        </>
      )}
      <ChevronRight aria-hidden="true" className="size-3.5" />
      {here ? (
        <>
          <Link to="/security-master" className="hover:text-ink">Security master</Link>
          <ChevronRight aria-hidden="true" className="size-3.5" />
          {also ? (
            <>
              <Link to="/security-master/history" className="hover:text-ink">{here}</Link>
              <ChevronRight aria-hidden="true" className="size-3.5" />
              <span aria-current="page" className="font-semibold text-ink">{also}</span>
            </>
          ) : (
            <span aria-current="page" className="font-semibold text-ink">{here}</span>
          )}
        </>
      ) : (
        <span aria-current="page" className="font-semibold text-ink">Security master</span>
      )}
    </nav>
  );
}

/**
 * The day's securities under the template's 180 columns: its bands on top, the labels under them, A to F held at
 * the left while the rest scroll sideways, and both heading rows held at the top while the rows scroll down.
 */
function SecurityTable({ columns, rows, loading }: {
  columns: SecurityMasterColumn[]; rows: SecurityMasterRows | undefined; loading: boolean;
}) {
  const frozen = columns.filter((one) => one.frozen);
  const rest = columns.filter((one) => !one.frozen);
  const restBands = useMemo(() => bands(rest), [rest]);
  const day = (iso: string) => formatDate(iso);
  const pinned = (index: number): CSSProperties => ({
    position: "sticky", left: FROZEN_LEFT[index], width: FROZEN_WIDTHS[index], minWidth: FROZEN_WIDTHS[index],
    maxWidth: FROZEN_WIDTHS[index],
  });
  const lastFrozen = "shadow-[6px_0_6px_-4px_rgba(15,23,42,0.18)] border-r border-slate-300";

  return (
    <div className="max-h-[calc(100vh-17rem)] min-h-48 overflow-auto rounded-xl border border-line">
      <table className="border-separate border-spacing-0 text-sm whitespace-nowrap">
        <thead>
          <tr className="text-[0.6875rem] font-bold tracking-wide text-ink-soft uppercase">
            <th scope="colgroup" style={pinned(0)}
              className="sticky top-0 z-30 h-8 border-b border-line bg-slate-100 px-3 text-left">Asset class</th>
            <th scope="colgroup" colSpan={frozen.length - 1}
              style={{ position: "sticky", left: FROZEN_LEFT[1] }}
              className={cn("sticky top-0 z-30 h-8 border-b border-line bg-slate-100 px-3 text-left", lastFrozen)}>
              Identifiers
            </th>
            {restBands.map((band, index) => (
              <th key={index} scope="colgroup" colSpan={band.span}
                className="sticky top-0 z-10 h-8 border-r border-b border-line bg-slate-50 px-3 text-left">
                {band.category}
              </th>
            ))}
          </tr>
          <tr className="text-[0.6875rem] font-semibold tracking-wide text-ink-muted uppercase">
            {frozen.map((column, index) => (
              <th key={column.key} scope="col" style={pinned(index)} title={`${column.bloomberg} · ${column.description}`}
                className={cn("sticky top-8 z-30 h-9 border-b border-line bg-slate-50 px-3 text-left",
                  index === frozen.length - 1 && lastFrozen)}>
                <Label column={column} />
              </th>
            ))}
            {rest.map((column) => (
              <th key={column.key} scope="col" title={`${column.bloomberg} · ${column.description}`}
                className={cn("sticky top-8 z-10 h-9 border-b border-line bg-slate-50 px-3",
                  isNumeric(column.type) ? "text-right" : "text-left")}>
                <Label column={column} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading && (
            <tr><td colSpan={columns.length} className="px-3 py-6 text-ink-muted">Loading securities…</td></tr>
          )}
          {rows && rows.rows.length === 0 && (
            <tr><td colSpan={columns.length} className="px-3 py-6 text-ink-muted">No security matches.</td></tr>
          )}
          {rows?.rows.map((row) => {
            const assetClass = row.cells.asset_class;
            const tone = ASSET_CLASSES.find((one) => one.id === assetClass)?.tone ?? "bg-slate-100 text-ink-soft";
            return (
              <tr key={row.rowNo} className="group">
                {frozen.map((column, index) => {
                  const text = cellText(column, row.cells[column.key], day);
                  return (
                    <td key={column.key} style={pinned(index)}
                      className={cn("z-20 overflow-hidden border-b border-line bg-white px-3 py-2 text-ellipsis group-hover:bg-slate-50",
                        index === frozen.length - 1 && lastFrozen,
                        column.key === "security_name" && "font-semibold",
                        (column.key === "isin" || column.key === "figi") && "font-mono text-xs")}
                      title={text ?? undefined}>
                      {column.key === "asset_class" && text
                        ? <span className={cn("rounded-md px-1.5 py-0.5 text-xs font-semibold", tone)}>{text}</span>
                        : text ?? <span className="text-slate-400">—</span>}
                    </td>
                  );
                })}
                {rest.map((column) => {
                  const text = cellText(column, row.cells[column.key], day);
                  const fits = applies(column, assetClass);
                  return (
                    <td key={column.key}
                      className={cn("border-b border-line px-3 py-2 group-hover:bg-slate-50",
                        isNumeric(column.type) && "text-right tabular-nums")}>
                      {text ?? (fits ? <span className="text-slate-400">—</span> : null)}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** A column's label as row 4 of the template writes it, with the red * of one every row must fill. */
function Label({ column }: { column: SecurityMasterColumn }) {
  return (
    <>
      {column.label}
      {column.requiredFor.length === ASSET_CLASSES.length && <span className="text-red-600">*</span>}
    </>
  );
}
