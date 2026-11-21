import { ApiError } from "@atomprive/api-client";
import { useGetBankHoldingsBanks, type BankHoldingsBanks } from "@atomprive/api-client/backoffice";
import { ChevronRight, FileText, Landmark, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { formatDateTime } from "../../lib/labels";
import { bankCount, byClient } from "./bank-holdings-clients";
import { BankHoldingsCrumbs } from "./bank-holdings-crumbs";

/** One client's banks: each bank whose holdings file names them, and the way into that bank's holdings. */
export function BankHoldingsClientPage() {
  const { clientKey = "" } = useParams();
  const list = useGetBankHoldingsBanks<BankHoldingsBanks, ApiError>();
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const client = useMemo(() => byClient(list.data?.banks ?? []).find((one) => one.key === clientKey), [list.data, clientKey]);
  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (client?.banks ?? []).filter((one) =>
      !needle || one.bankName.toLowerCase().includes(needle) || one.fileName.toLowerCase().includes(needle));
  }, [client, query]);

  return (
    <div className="space-y-6">
      <BankHoldingsCrumbs trail={[{ label: client?.name ?? "…" }]} />

      {list.isLoading && <p className="py-10 text-center text-sm text-ink-muted">Loading the client's banks…</p>}
      {list.isError && <p className="py-10 text-center text-sm text-red-700">The banks could not be loaded. Refresh to try again.</p>}
      {list.data && !client && (
        <p className="py-10 text-center text-sm text-ink-muted">
          No bank's file names this client any more.{" "}
          <Link to="/bank-holdings" className="font-semibold text-primary-600 hover:text-primary-700">Back to Bank holdings</Link>
        </p>
      )}

      {client && (
        <>
          <header>
            <h1 className="text-[1.625rem] font-bold">{client.name}</h1>
            <p className="mt-1 text-sm text-ink-muted">
              {client.named ? `${bankCount(client.banks.length)} hold this client's assets` : `${bankCount(client.banks.length)} whose file names no client yet`}
            </p>
          </header>

          <label className="relative block max-w-xl">
            <span className="sr-only">Search bank</span>
            <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-muted" />
            <input id="bank-holdings-client-search" type="search" value={query} placeholder="Search bank…"
              onChange={(event) => setQuery(event.target.value)}
              className="h-11 w-full rounded-xl border border-line bg-white pr-3 pl-10 text-sm placeholder:text-ink-muted focus-visible:ring-2 focus-visible:ring-primary-200 focus-visible:outline-none" />
          </label>

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
                  {shown.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-6 py-10 text-center text-ink-muted">
                        No bank matches.{" "}
                        <button type="button" onClick={() => setQuery("")} className="font-semibold text-primary-600 hover:text-primary-700">Clear search</button>
                      </td>
                    </tr>
                  )}
                  {shown.map((one) => (
                    // The whole row opens the bank's holdings; the button stays the way in for a keyboard.
                    <tr key={one.id} onClick={() => navigate(`/bank-holdings/${one.id}`)} className="cursor-pointer hover:bg-canvas">
                      <th scope="row" className="py-4 pr-3 pl-6 text-left font-normal">
                        <div className="flex items-center gap-4">
                          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary-50">
                            <Landmark aria-hidden="true" className="size-6 text-primary-700" />
                          </span>
                          <span className="block text-base font-bold text-ink">{one.bankName}</span>
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
                        <Link to={`/bank-holdings/${one.id}`} onClick={(event) => event.stopPropagation()}
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
          </section>
        </>
      )}
    </div>
  );
}
