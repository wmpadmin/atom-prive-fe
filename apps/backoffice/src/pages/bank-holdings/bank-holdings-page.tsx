import { ApiError } from "@atomprive/api-client";
import { useGetBankHoldingsBanks, type BankHoldingsBank, type BankHoldingsBanks } from "@atomprive/api-client/backoffice";
import { Button, FilterMenu, Pagination } from "@atomprive/ui";
import { ChevronRight, CloudUpload, FileText, Landmark, Search, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { useBookPanel } from "../../components/book-panel";
import { formatDate, formatDateTime } from "../../lib/labels";
import { PAGE_SIZES } from "../../lib/page-sizes";
import { opens } from "../portfolios/figure-opens";
import { bankCount, byClient } from "./bank-holdings-clients";
import { BankHoldingsCrumbs } from "./bank-holdings-crumbs";
import { UploadBankHoldingsDialog } from "./upload-bank-holdings-dialog";

/** A time of day as the back office writes it: 23:27. */
function formatTime(value: string) {
  return new Date(value).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

const ALL = "__all";

/**
 * Bank holdings: every client whose banks have sent a holdings Excel, with how many banks hold their assets, for the
 * Admin and the portfolio manager. A client opens their banks; a bank opens its holdings. The search finds a client
 * or a bank, and the Bank filter keeps the clients one bank holds for.
 */
export function BankHoldingsPage() {
  const list = useGetBankHoldingsBanks<BankHoldingsBanks, ApiError>();
  const [query, setQuery] = useState("");
  const [bank, setBank] = useState<string>(ALL);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(PAGE_SIZES[0] ?? 10);
  const [uploading, setUploading] = useState(false);
  const navigate = useNavigate();
  const panel = useBookPanel();
  const banks = useMemo(() => list.data?.banks ?? [], [list.data]);
  const clients = useMemo(() => byClient(banks), [banks]);
  const bankNames = useMemo(() => [...new Set(banks.map((one) => one.bankName))].sort((a, b) => a.localeCompare(b)), [banks]);

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return clients.filter((client) =>
      (bank === ALL || client.banks.some((one) => one.bankName === bank))
      && (!needle || client.name.toLowerCase().includes(needle)
        || client.banks.some((one) => one.bankName.toLowerCase().includes(needle) || one.fileName.toLowerCase().includes(needle))));
  }, [clients, query, bank]);
  const pageRows = shown.slice(page * size, (page + 1) * size);
  const named = clients.filter((one) => one.named);
  // The newest file of all the banks': when it came, which bank's, and who put it up.
  const latest = banks.reduce<BankHoldingsBank | null>((newest, one) =>
    newest == null || new Date(one.uploadedAt) > new Date(newest.uploadedAt) ? one : newest, null);
  const newestFirst = [...banks].sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
  const openClients = () => panel?.({
    name: "Clients",
    figure: {
      label: "Bank holdings",
      value: String(named.length),
      note: "Every client a bank's holdings file has been uploaded for.",
      table: {
        columns: ["Client", "Banks", "Last upload"],
        rows: clients.map((one) => [one.name, one.banks.map((b) => b.bankName).join(", "), formatDate(one.latest.uploadedAt)]),
        links: clients.map((one) => `/bank-holdings/clients/${one.key}`),
      },
    },
  });
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
        columns: ["Uploaded", "Bank", "Client", "By"],
        rows: newestFirst.map((one) => [formatDateTime(one.uploadedAt), one.bankName, one.clientName ?? null, one.uploadedBy]),
        links: newestFirst.map((one) => `/bank-holdings/${one.id}`),
      },
    },
  });
  const clear = () => { setQuery(""); setBank(ALL); setPage(0); };

  return (
    <div className="space-y-6">
      <BankHoldingsCrumbs />

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[1.625rem] font-bold">Bank holdings</h1>
          <p className="mt-1 text-sm text-ink-muted">Clients and the banks that hold their assets</p>
        </div>
        <Button onClick={() => setUploading(true)}>
          <CloudUpload aria-hidden="true" className="size-4" />
          Upload bank data
        </Button>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Stat icon={<Users aria-hidden="true" className="size-6 text-emerald-700" />} tone="bg-emerald-50" label="Clients"
          value={list.data ? named.length : "—"} onOpen={list.data ? openClients : undefined} />
        <Stat icon={<Landmark aria-hidden="true" className="size-6 text-primary-700" />} tone="bg-primary-50" label="Banks available"
          value={list.data ? banks.length : "—"} onOpen={list.data ? openBanks : undefined} />
        <Stat icon={<FileText aria-hidden="true" className="size-6 text-violet-700" />} tone="bg-violet-50" label="Last upload"
          value={latest ? formatDate(latest.uploadedAt) : "—"} small
          note={latest ? `${latest.bankName} · ${formatTime(latest.uploadedAt)} by ${latest.uploadedBy}` : list.data ? "No file yet" : undefined}
          onOpen={list.data ? openUploads : undefined} />
      </div>

      <div className="flex flex-wrap items-start gap-3">
        <label className="relative min-w-60 flex-1">
          <span className="sr-only">Search client or bank</span>
          <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-muted" />
          <input id="bank-holdings-search" type="search" value={query} placeholder="Search client or bank…"
            onChange={(event) => { setQuery(event.target.value); setPage(0); }}
            className="h-11 w-full rounded-xl border border-line bg-white pr-3 pl-10 text-sm placeholder:text-ink-muted focus-visible:ring-2 focus-visible:ring-primary-200 focus-visible:outline-none" />
        </label>
        <FilterMenu<string> label="Bank" value={bank} align="right" onChange={(next) => { setBank(next); setPage(0); }}
          options={[
            { id: ALL, label: "All banks", count: clients.length },
            ...bankNames.map((name) => ({ id: name, label: name, count: clients.filter((c) => c.banks.some((one) => one.bankName === name)).length })),
          ]} />
      </div>

      <section className="overflow-hidden rounded-2xl border border-line bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-canvas text-left text-2xs font-semibold tracking-wider whitespace-nowrap text-ink-muted uppercase">
                <th scope="col" className="py-3 pr-3 pl-6">Client</th>
                <th scope="col" className="px-3 py-3">Banks</th>
                <th scope="col" className="px-3 py-3">Last upload</th>
                <th scope="col" className="py-3 pr-6 pl-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {list.isLoading && (
                <tr><td colSpan={4} className="px-6 py-8 text-center text-ink-muted">Loading clients…</td></tr>
              )}
              {list.isError && (
                <tr><td colSpan={4} className="px-6 py-8 text-center text-red-700">The clients could not be loaded. Refresh to try again.</td></tr>
              )}
              {list.data && clients.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-10 text-center text-ink-muted">
                    No bank has sent a holdings file yet.{" "}
                    <button type="button" onClick={() => setUploading(true)} className="font-semibold text-primary-600 hover:text-primary-700">
                      Upload the first one
                    </button>
                  </td>
                </tr>
              )}
              {list.data && clients.length > 0 && shown.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-10 text-center text-ink-muted">
                    No client or bank matches.{" "}
                    <button type="button" onClick={clear} className="font-semibold text-primary-600 hover:text-primary-700">
                      Clear search and filter
                    </button>
                  </td>
                </tr>
              )}
              {pageRows.map((client) => {
                const to = `/bank-holdings/clients/${client.key}`;
                return (
                  // The whole row opens the client's banks; the button stays the way in for a keyboard.
                  <tr key={client.key} onClick={() => navigate(to)} className="cursor-pointer hover:bg-canvas">
                    <th scope="row" className="py-4 pr-3 pl-6 text-left font-normal">
                      <span className={`block text-base font-bold ${client.named ? "text-ink" : "text-ink-muted"}`}>{client.name}</span>
                      <span className="block text-xs text-ink-muted">{bankCount(client.banks.length)}</span>
                    </th>
                    <td className="px-3 py-4">
                      <span className="flex flex-wrap gap-1.5">
                        {client.banks.map((one) => (
                          <span key={one.id}
                            className={`rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${client.named ? "bg-primary-50 text-primary-700" : "bg-canvas text-ink-muted"}`}>
                            {one.bankName}
                          </span>
                        ))}
                      </span>
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap">
                      <span className="block">{formatDate(client.latest.uploadedAt)}</span>
                      <span className="block text-xs text-ink-muted">{client.latest.bankName}</span>
                    </td>
                    <td className="py-4 pr-6 pl-3 text-right">
                      <Link to={to} onClick={(event) => event.stopPropagation()}
                        className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-primary-600 px-4 text-sm font-semibold whitespace-nowrap text-primary-700 hover:bg-primary-50">
                        View banks
                        <ChevronRight aria-hidden="true" className="size-4" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {shown.length > 0 && (
          <div className="border-t border-line px-6 py-3">
            <Pagination page={page} pageSize={size} totalItems={shown.length} noun={["client", "clients"]}
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
