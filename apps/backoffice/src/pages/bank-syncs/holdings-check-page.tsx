import { ApiError } from "@atomprive/api-client";
import {
  useCheckHoldings,
  useListBankFeeds,
  type BankFeed,
  type ClientComparison,
  type HoldingsOverview,
} from "@atomprive/api-client/backoffice";
import { Alert, Badge, cn, SelectInput } from "@atomprive/ui";
import { keepPreviousData } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { formatDate } from "../../lib/labels";
import { PagedFooter, usePagedRows } from "../../lib/paged-rows";
import { money, signed } from "./holdings-words";

/**
 * Holdings check (P10): what each bank says a client holds, beside the firm's file. Compared, never used — clients
 * go on seeing the firm's figures.
 */

type Only = "all" | "differences" | "matching";

export function HoldingsCheckPage() {
  const [params, setParams] = useSearchParams();
  const bankId = params.get("bank") ?? "";
  const [only, setOnly] = useState<Only>("all");
  const check = useCheckHoldings<HoldingsOverview, ApiError>(bankId ? { bankId } : undefined, {
    query: { placeholderData: keepPreviousData },
  });
  const feeds = useListBankFeeds<BankFeed[], ApiError>();
  const all = check.data?.rows ?? [];
  const differing = all.filter(hasDifferences);
  const rows = only === "differences" ? differing : only === "matching" ? all.filter((row) => !hasDifferences(row)) : all;
  const paged = usePagedRows(rows);

  if (check.isError) return <Alert tone="danger">{check.error.message}</Alert>;
  const data = check.data;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-[1.625rem] font-bold">Holdings check</h1>
        <p className="mt-1 text-sm text-ink-muted">
          What each bank says a client holds, beside what the firm's file says. Compared, not used: clients still see the
          firm's figures.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Card label="Clients checked" value={data?.clients}
          note={data ? `at ${data.banks} bank${data.banks === 1 ? "" : "s"}${data.asOf ? ` · as of ${formatDate(data.asOf)}` : ""}` : ""} />
        <Card label="Lines matching" value={data?.linesMatching}
          note={data && data.linesCompared > 0 ? `${Math.round((100 * data.linesMatching) / data.linesCompared)}% of ${data.linesCompared}` : "Nothing compared yet"} />
        <Card label="Differ" value={data?.linesDiffering} tone="danger" note="units, or value beyond 0.5% or 100" />
        <Card label="Only at the bank" value={data?.onlyAtBank} tone="warning" note="not on the firm's file" />
        <Card label="Not at the bank" value={data?.notAtBank} tone="warning" note="on file with an ISIN, no bank has it" />
      </div>

      <section className="rounded-2xl border border-line bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
          <div role="tablist" aria-label="Clients" className="flex flex-wrap gap-2">
            {([
              ["all", `All ${all.length}`],
              ["differences", `With differences ${differing.length}`],
              ["matching", `All matching ${all.length - differing.length}`],
            ] as const).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={only === id}
                onClick={() => setOnly(id)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-sm font-semibold whitespace-nowrap",
                  only === id ? "border-brand-900 bg-brand-900 text-on-fill" : "border-line text-ink-soft hover:bg-slate-50",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="w-56">
            <SelectInput
              aria-label="Bank"
              value={bankId}
              onChange={(event) => setParams(event.target.value ? { bank: event.target.value } : {}, { replace: true })}
            >
              <option value="">All banks</option>
              {(feeds.data ?? []).map((feed) => (
                <option key={feed.id} value={feed.id}>
                  {feed.name}
                </option>
              ))}
            </SelectInput>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                <th scope="col" className="py-3 pr-4 pl-5">Client</th>
                <th scope="col" className="px-4 py-3">Bank</th>
                <th scope="col" className="px-4 py-3 text-right">Bank says</th>
                <th scope="col" className="px-4 py-3 text-right">Firm's file</th>
                <th scope="col" className="px-4 py-3 text-right">Difference</th>
                <th scope="col" className="px-4 py-3">Lines</th>
                <th scope="col" className="px-4 py-3">As of</th>
                <th scope="col" className="py-3 pr-5 pl-4" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {!data && (
                <tr>
                  <td colSpan={8} className="px-5 py-8 text-center text-ink-muted">Comparing holdings…</td>
                </tr>
              )}
              {data && rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-8 text-center text-ink-muted">
                    {all.length === 0
                      ? "No bank has sent a client's holdings yet. They arrive with a bank's statement of positions."
                      : "Nothing here."}
                  </td>
                </tr>
              )}
              {paged.shown.map((row) => (
                <tr key={row.customerId}>
                  <td className="py-3 pr-4 pl-5">
                    <Link to={`/holdings-check/${row.customerId}`} className="font-semibold text-ink hover:underline">
                      {row.clientName}
                    </Link>
                    <div className="text-xs text-ink-muted">{row.clientCode}</div>
                  </td>
                  <td className="px-4 py-3">{row.banks.join(", ")}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums">{money(row.bankTotal, row.currency)}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums">{money(row.fileTotal, row.currency)}</td>
                  <td className={cn("px-4 py-3 text-right font-semibold whitespace-nowrap tabular-nums",
                    row.difference === 0 ? "text-ink-muted" : "text-red-600")}>
                    {row.difference === 0 ? "—" : signed(row.difference)}
                  </td>
                  <td className="px-4 py-3">
                    <LineCounts row={row} />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">{row.asOf ? formatDate(row.asOf) : "—"}</td>
                  <td className="py-3 pr-5 pl-4 text-right">
                    <Link to={`/holdings-check/${row.customerId}`} className="text-xs font-semibold text-primary-700 hover:underline">
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data && rows.length > 0 && <PagedFooter paged={paged} noun={["client", "clients"]} />}
      </section>
    </div>
  );
}

function hasDifferences(row: ClientComparison) {
  return row.differing + row.onlyAtBank + row.notAtBank > 0;
}

/** How a client's lines came out, in coloured counts; only the counts that are not nought. */
export function LineCounts({ row }: { row: ClientComparison }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {row.matching > 0 && <Badge tone="success">{row.matching} match</Badge>}
      {row.differing > 0 && <Badge tone="danger">{row.differing} differ</Badge>}
      {row.onlyAtBank > 0 && <Badge tone="warning">{row.onlyAtBank} only at bank</Badge>}
      {row.notAtBank > 0 && <Badge tone="warning">{row.notAtBank} not at bank</Badge>}
      {row.withoutIsin > 0 && <Badge tone="neutral">{row.withoutIsin} without ISIN</Badge>}
    </div>
  );
}

function Card({ label, value, note, tone }: { label: string; value: number | undefined; note: string; tone?: "danger" | "warning" }) {
  return (
    <div className="rounded-2xl border border-line bg-white px-5 py-4">
      <p className="text-xs font-semibold tracking-wider text-ink-muted uppercase">{label}</p>
      <p className={cn("mt-1 text-3xl font-bold tabular-nums", tone === "danger" && value ? "text-red-600" : tone === "warning" && value ? "text-amber-600" : "")}>
        {value ?? "—"}
      </p>
      <p className="mt-0.5 text-xs text-ink-muted">{note}</p>
    </div>
  );
}
