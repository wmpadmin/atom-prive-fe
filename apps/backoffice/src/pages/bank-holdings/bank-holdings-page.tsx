import { ApiError } from "@atomprive/api-client";
import { useGetBankHoldingsBanks, type BankHoldingsBank, type BankHoldingsBanks } from "@atomprive/api-client/backoffice";
import { Button, FilterMenu, Pagination } from "@atomprive/ui";
import { ChevronRight, CloudUpload, FileText, Landmark, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { useBookPanel } from "../../components/book-panel";
import { formatDate, formatDateTime } from "../../lib/labels";
import { PAGE_SIZES } from "../../lib/page-sizes";
import { opens } from "../portfolios/figure-opens";
import { BankHoldingsCrumbs } from "./bank-holdings-crumbs";
import { UploadBankHoldingsDialog } from "./upload-bank-holdings-dialog";

/** A time of day as the back office writes it: 23:27. */
function formatTime(value: string) {
  return new Date(value).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

type Age = "all" | "week" | "older";

const WEEK = 7 * 24 * 60 * 60 * 1000;

function isThisWeek(one: BankHoldingsBank) {
  return Date.now() - new Date(one.uploadedAt).getTime() <= WEEK;
}

/**
 * Bank holdings: every bank whose holdings Excel the client's banks have sent, for the Admin and the portfolio
 * manager. Each bank is named by its file, and its holdings open from here.
 */
export function BankHoldingsPage() {
  const list = useGetBankHoldingsBanks<BankHoldingsBanks, ApiError>();
  const [query, setQuery] = useState("");
  const [age, setAge] = useState<Age>("all");
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(PAGE_SIZES[0] ?? 10);
  const [uploading, setUploading] = useState(false);
  const navigate = useNavigate();
  const panel = useBookPanel();
  const banks = useMemo(() => list.data?.banks ?? [], [list.data]);

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return banks.filter((one) =>
      (!needle || one.bankName.toLowerCase().includes(needle) || one.fileName.toLowerCase().includes(needle))
      && (age === "all" || (age === "week") === isThisWeek(one)));
  }, [banks, query, age]);
  const pageRows = shown.slice(page * size, (page + 1) * size);
  const thisWeek = banks.filter(isThisWeek).length;
  // The newest file of all the banks': when it came, which bank's, and who put it up.
  const latest = banks.reduce<BankHoldingsBank | null>((newest, one) =>
    newest == null || new Date(one.uploadedAt) > new Date(newest.uploadedAt) ? one : newest, null);
  const newestFirst = [...banks].sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
  const openBanks = () => panel?.({
    name: "Banks available",
    figure: {
      label: "Bank holdings",
      value: String(banks.length),
      note: "Every bank whose holdings file has been uploaded.",
      table: {
        columns: ["Bank", "Client", "File", "Uploaded"],
        rows: banks.map((one) => [one.bankName, one.clientName ?? null, one.fileName, formatDate(one.uploadedAt)]),
        links: banks.map((one) => `/bank-holdings/${one.id}`),
      },
    },
  });
  const openUploads = () => panel?.({
    name: "Last upload",
    figure: {
      label: "Bank holdings",
      value: latest ? formatDate(latest.uploadedAt) : "—",
      note: latest ? `${latest.bankName} · ${formatTime(latest.uploadedAt)} by ${latest.uploadedBy}` : "No file yet",
      table: {
        title: "Uploads, newest first",
        columns: ["Uploaded", "Bank", "File", "By"],
        rows: newestFirst.map((one) => [formatDateTime(one.uploadedAt), one.bankName, one.fileName, one.uploadedBy]),
        links: newestFirst.map((one) => `/bank-holdings/${one.id}`),
      },
    },
  });

  return (
    <div className="space-y-6">
      <BankHoldingsCrumbs />

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[1.625rem] font-bold">Bank holdings</h1>
          <p className="mt-1 text-sm text-ink-muted">View holdings across all banks</p>
        </div>
        <Button onClick={() => setUploading(true)}>
          <CloudUpload aria-hidden="true" className="size-4" />
          Upload bank data
        </Button>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:max-w-3xl">
        <Stat icon={<Landmark aria-hidden="true" className="size-6 text-primary-700" />} tone="bg-primary-50" label="Banks available"
          value={list.data ? banks.length : "—"} onOpen={list.data ? openBanks : undefined} />
        <Stat icon={<FileText aria-hidden="true" className="size-6 text-violet-700" />} tone="bg-violet-50" label="Last upload"
          value={latest ? formatDate(latest.uploadedAt) : "—"} small
          note={latest ? `${latest.bankName} · ${formatTime(latest.uploadedAt)} by ${latest.uploadedBy}` : list.data ? "No file yet" : undefined}
          onOpen={list.data ? openUploads : undefined} />
      </div>

      <div className="flex flex-wrap items-start gap-3">
        <label className="relative min-w-60 flex-1">
          <span className="sr-only">Search bank name</span>
          <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-muted" />
          <input id="bank-holdings-search" type="search" value={query} placeholder="Search bank name…"
            onChange={(event) => { setQuery(event.target.value); setPage(0); }}
            className="h-11 w-full rounded-xl border border-line bg-white pr-3 pl-10 text-sm placeholder:text-ink-muted focus-visible:ring-2 focus-visible:ring-primary-200 focus-visible:outline-none" />
        </label>
        <FilterMenu<Age> label="Filter" value={age} align="right" onChange={(next) => { setAge(next); setPage(0); }}
          options={[
            { id: "all", label: "All banks", count: banks.length },
            { id: "week", label: "Uploaded in the last 7 days", count: thisWeek },
            { id: "older", label: "Uploaded earlier", count: banks.length - thisWeek },
          ]} />
      </div>

      <section className="overflow-hidden rounded-2xl border border-line bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-canvas text-left text-2xs font-semibold tracking-wider whitespace-nowrap text-ink-muted uppercase">
                <th scope="col" className="py-3 pr-3 pl-6">Bank name</th>
                <th scope="col" className="px-3 py-3">Holdings source</th>
                <th scope="col" className="py-3 pr-6 pl-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {list.isLoading && (
                <tr><td colSpan={3} className="px-6 py-8 text-center text-ink-muted">Loading banks…</td></tr>
              )}
              {list.isError && (
                <tr><td colSpan={3} className="px-6 py-8 text-center text-red-700">The banks could not be loaded. Refresh to try again.</td></tr>
              )}
              {list.data && banks.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-6 py-10 text-center text-ink-muted">
                    No bank has sent a holdings file yet.{" "}
                    <button type="button" onClick={() => setUploading(true)} className="font-semibold text-primary-600 hover:text-primary-700">
                      Upload the first one
                    </button>
                  </td>
                </tr>
              )}
              {list.data && banks.length > 0 && shown.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-6 py-10 text-center text-ink-muted">
                    No bank matches.{" "}
                    <button type="button" onClick={() => { setQuery(""); setAge("all"); }} className="font-semibold text-primary-600 hover:text-primary-700">
                      Clear search and filter
                    </button>
                  </td>
                </tr>
              )}
              {pageRows.map((one) => (
                // The whole row opens the bank's holdings; the button stays the way in for a keyboard.
                <tr key={one.id} onClick={() => navigate(`/bank-holdings/${one.id}`)} className="cursor-pointer hover:bg-canvas">
                  <th scope="row" className="py-4 pr-3 pl-6 text-left font-normal">
                    <div className="flex items-center gap-4">
                      <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary-50">
                        <Landmark aria-hidden="true" className="size-6 text-primary-700" />
                      </span>
                      <span>
                        <span className="block text-base font-bold text-ink">{one.bankName}</span>
                        <span className="block text-xs text-ink-muted">{one.clientName ? `${one.clientName}'s holdings` : "Holdings data available · no client said yet"}</span>
                      </span>
                    </div>
                  </th>
                  <td className="px-3 py-4">
                    <span className="flex items-center gap-3">
                      <FileText aria-hidden="true" className="size-5 shrink-0 text-ink-muted" />
                      <span>
                        <span className="block">{one.fileName}</span>
                        <span className="block text-xs text-ink-muted">Uploaded {formatDateTime(one.uploadedAt)} by {one.uploadedBy}</span>
                      </span>
                    </span>
                  </td>
                  <td className="py-4 pr-6 pl-3 text-right">
                    <Link to={`/bank-holdings/${one.id}`}
                      className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-primary-600 px-4 text-sm font-semibold whitespace-nowrap text-primary-700 hover:bg-primary-50">
                      View holdings
                      <ChevronRight aria-hidden="true" className="size-4" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {shown.length > 0 && (
          <div className="border-t border-line px-6 py-3">
            <Pagination page={page} pageSize={size} totalItems={shown.length} noun={["bank", "banks"]}
              onPageChange={setPage} pageSizes={PAGE_SIZES} onPageSizeChange={(next) => { setSize(next); setPage(0); }} />
          </div>
        )}
      </section>

      {uploading && <UploadBankHoldingsDialog onClose={() => setUploading(false)} onTaken={() => void list.refetch()} />}
    </div>
  );
}

function Stat({ icon, tone, label, value, note, small = false, onOpen }: {
  icon: React.ReactNode; tone: string; label: string; value: number | string; note?: string; small?: boolean; onOpen?: () => void;
}) {
  return (
    <div {...(onOpen ? opens(onOpen) : {})}
      className={`flex items-center gap-5 rounded-2xl border border-line bg-white px-5 py-4${onOpen ? " cursor-pointer hover:border-primary-200 hover:bg-canvas" : ""}`}>
      <span className={`flex size-14 shrink-0 items-center justify-center rounded-full ${tone}`}>{icon}</span>
      <span className="h-10 w-px bg-line" aria-hidden="true" />
      <span>
        <span className="block text-sm text-ink-muted">{label}</span>
        <span className={small ? "block text-2xl font-bold" : "block text-3xl font-bold tabular-nums"}>{value}</span>
        {note && <span className="block text-xs text-ink-muted">{note}</span>}
      </span>
    </div>
  );
}
