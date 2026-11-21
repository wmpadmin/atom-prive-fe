import { ApiError } from "@atomprive/api-client";
import { useGetClientHoldingsBook, type ClientHoldingsBook } from "@atomprive/api-client/backoffice";
import { useState } from "react";
import { formatDate } from "../lib/labels";
import { FileViewToggle, inUsd, MissingRates, type FileView } from "./converted-usd";

function exact(amount: number, currency: string) {
  return `${currency} ${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function plain(amount: number | null | undefined) {
  return amount == null ? "—" : amount.toLocaleString("en-US", { maximumFractionDigits: 4 });
}

/**
 * A bank-file client's lines, read from his bank's latest files: either in dollars at the latest FX rates, or as the
 * bank sent them, each in its own currency. Draws nothing for anybody else, whose holdings are the firm's own.
 */
export function BankFileHoldings({ customerId }: { customerId: string }) {
  const book = useGetClientHoldingsBook<ClientHoldingsBook, ApiError>(customerId, { query: { staleTime: 60_000 } });
  const [view, setView] = useState<FileView>("converted");
  const data = book.data;
  if (!data?.bankFile) return null;
  const conv = view === "converted" ? data.converted?.file ?? null : null;
  const rows = data.positions;
  return (
    <section className="rounded-2xl border border-line bg-white p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Holdings · from the bank's file</h2>
          <p className="mt-0.5 text-xs text-ink-muted">
            {conv ? `Each line in ${conv.currency} at FX rates${conv.ratesOn ? ` of ${formatDate(conv.ratesOn)}` : ""}, the bank's own amount beneath`
              : "Each line as the bank's file states it, in its own currency"}
          </p>
        </div>
        <FileViewToggle value={view} onChange={setView} />
      </div>
      {rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-ink-muted">No bank file has come in for this client yet.</p>
      ) : (
        <div className="-mx-5 overflow-x-auto">
          <table className="w-full min-w-[52rem] table-fixed text-sm">
            <colgroup>
              <col />
              <col className="w-44" />
              <col className="w-40" />
              <col className="w-24" />
              <col className="w-24" />
              <col className="w-40" />
              <col className="w-24" />
            </colgroup>
            <thead>
              <tr className="border-y border-line text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                <th scope="col" className="py-2 pr-3 pl-5">Position</th>
                <th scope="col" className="px-2 py-2">Bank's class</th>
                <th scope="col" className="px-2 py-2">Account</th>
                <th scope="col" className="px-2 py-2 text-right">Quantity</th>
                <th scope="col" className="px-2 py-2 text-right">Price</th>
                <th scope="col" className="px-2 py-2 text-right">Value{conv ? ` · ${conv.currency}` : ""}</th>
                <th scope="col" className="py-2 pr-5 pl-2 text-right">Weight</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((one) => {
                const usd = conv ? inUsd(one.value, one.currency, conv) : null;
                return (
                  <tr key={one.id}>
                    <th scope="row" className="py-2 pr-3 pl-5 text-left font-medium">
                      <span className="block break-words">{one.name}</span>
                      {one.identifier && <span className="block font-mono text-2xs font-normal text-ink-muted">{one.identifier}</span>}
                    </th>
                    <td className="px-2 py-2 text-xs break-words">{one.assetClassName}</td>
                    <td className="px-2 py-2 text-xs break-words text-ink-soft">{one.account ?? one.custodian ?? "—"}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{plain(one.quantity)}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{plain(one.price)}</td>
                    <td className="px-2 py-2 text-right font-semibold whitespace-nowrap tabular-nums">
                      {!conv ? exact(one.value, one.currency ?? "") : usd == null ? <span className="text-xs font-normal text-amber-700">no FX rate</span> : (
                        <>{exact(usd, conv.currency)}
                          {one.currency !== conv.currency && <span className="block text-2xs font-normal text-ink-muted">{exact(one.value, one.currency ?? "")}</span>}</>
                      )}
                    </td>
                    <td className="py-2 pr-5 pl-2 text-right tabular-nums">
                      {conv && usd != null && conv.total !== 0 ? `${((usd / Math.abs(conv.total)) * 100).toFixed(1)}%` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-line font-semibold">
                <th scope="row" className="py-2 pr-3 pl-5 text-left">Total · {rows.length} lines</th>
                <td colSpan={6} className="py-2 pr-5 pl-2 text-right tabular-nums">
                  {conv ? exact(conv.total, conv.currency) : data.fileTotals.map((one) => exact(one.amount, one.currency)).join(" · ")}
                  {!conv && <span className="block text-2xs font-normal text-ink-muted">per currency, not added together</span>}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      {data.converted && <div className="mt-3"><MissingRates converted={data.converted.file} /></div>}
    </section>
  );
}
