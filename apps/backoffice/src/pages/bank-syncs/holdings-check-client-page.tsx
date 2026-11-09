import { ApiError } from "@atomprive/api-client";
import {
  useCheckClientHoldings,
  type ClientHoldingsCheck,
  type HoldingLine,
  type HoldingLineStatus,
} from "@atomprive/api-client/backoffice";
import { Alert, Badge, cn } from "@atomprive/ui";
import { ChevronLeft } from "lucide-react";
import { Fragment, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router";
import { formatDate } from "../../lib/labels";
import { money, signed } from "./holdings-words";

/**
 * One client's holdings, line by line (P10): matched by ISIN and grouped by asset class as the firm's file groups
 * them, the bank's units, price and value beside the file's, and what each line came to.
 */

const STATUS: Record<HoldingLineStatus, { label: string; tone: "success" | "danger" | "warning" }> = {
  MATCHES: { label: "Matches", tone: "success" },
  UNITS_DIFFER: { label: "Units differ", tone: "danger" },
  VALUE_DIFFERS: { label: "Value differs", tone: "danger" },
  ONLY_AT_BANK: { label: "Only at bank", tone: "warning" },
  NOT_AT_BANK: { label: "Not at bank", tone: "warning" },
};

type Only = "all" | "differences" | "matching";

export function HoldingsCheckClientPage() {
  const { customerId = "" } = useParams();
  const check = useCheckClientHoldings<ClientHoldingsCheck, ApiError>(customerId);
  const [only, setOnly] = useState<Only>("differences");

  if (check.isError) {
    return <Alert tone="danger">{check.error.status === 404 ? "No bank has sent this client's holdings." : check.error.message}</Alert>;
  }
  if (!check.data) return <p className="text-sm text-ink-muted">Comparing holdings…</p>;
  const { summary, accounts, lines } = check.data;
  const differences = lines.filter((line) => line.status !== "MATCHES");
  const shown = only === "differences" ? differences : only === "matching" ? lines.filter((line) => line.status === "MATCHES") : lines;
  // Shown in groups, as the file groups them; a group is named once, above its first line.
  const groups = [...new Set(shown.map((line) => line.group))];

  return (
    <div className="space-y-5">
      <Link to="/holdings-check" className="inline-flex items-center gap-1 text-sm font-medium text-primary-700 hover:underline">
        <ChevronLeft aria-hidden="true" className="size-4" />
        Holdings check
      </Link>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[1.625rem] font-bold">
            {summary.clientName} · {summary.banks.join(", ")}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            {accounts.join(" and ")}
            {summary.asOf && ` · bank's statement of ${formatDate(summary.asOf)}`}
          </p>
        </div>
        {check.data.inUse.length > 0
          ? <Badge tone="success">{check.data.inUse.join(", ")} in use</Badge>
          : <Badge tone="info">Compared, not used</Badge>}
      </header>

      {/* No total of the bank's side: its holdings are each in their own currency, as the bank sent them. */}
      <dl className="grid gap-3 sm:grid-cols-2">
        <Fact label="Firm's file">{money(summary.fileTotal, summary.currency)}</Fact>
        <Fact label="Lines">
          {[`${summary.matching} match`, summary.differing && `${summary.differing} differ`,
            summary.onlyAtBank && `${summary.onlyAtBank} only at bank`, summary.notAtBank && `${summary.notAtBank} not at bank`]
            .filter(Boolean).join(" · ")}
        </Fact>
      </dl>
      {summary.withoutIsin > 0 && (
        <p className="text-xs text-ink-muted">
          {summary.withoutIsin} line{summary.withoutIsin === 1 ? "" : "s"} on the firm's file {summary.withoutIsin === 1 ? "has" : "have"} no
          ISIN, so {summary.withoutIsin === 1 ? "it is" : "they are"} not compared. Cash and deposits usually have none.
        </p>
      )}

      <section className="rounded-2xl border border-line bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
          <div role="tablist" aria-label="Lines" className="flex flex-wrap gap-2">
            {([
              ["all", `All ${lines.length}`],
              ["differences", `Differences ${differences.length}`],
              ["matching", `Matching ${lines.length - differences.length}`],
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
          <p className="text-xs text-ink-muted">A line matches when units are equal and value is within 0.5% or 100</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                <th scope="col" className="py-3 pr-4 pl-5">Holding</th>
                <th scope="col" className="px-3 py-3">Account</th>
                <th scope="col" className="px-3 py-3 text-right">Bank: units</th>
                <th scope="col" className="px-3 py-3 text-right">Bank: price</th>
                <th scope="col" className="px-3 py-3 text-right">Bank: value</th>
                <th scope="col" className="px-3 py-3 text-right">Bank: accrued</th>
                <th scope="col" className="px-3 py-3 text-right">File: units</th>
                <th scope="col" className="px-3 py-3 text-right">File: value</th>
                <th scope="col" className="px-3 py-3 text-right">Difference</th>
                <th scope="col" className="py-3 pr-5 pl-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {shown.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-5 py-8 text-center text-ink-muted">
                    {only === "differences" ? "No differences: every line the banks state matches the firm's file." : "Nothing here."}
                  </td>
                </tr>
              )}
              {groups.map((group) => (
                <Fragment key={group}>
                  <tr className="border-b border-line bg-slate-50">
                    <td colSpan={10} className="px-5 py-2 text-xs font-bold text-ink-soft">{group}</td>
                  </tr>
                  {shown.filter((line) => line.group === group).map((line) => (
                    <Line key={(line.isin ?? line.name) + line.status} line={line} waitingToBePlaced={check.data.inUse.length > 0} />
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Line({ line, waitingToBePlaced }: { line: HoldingLine; waitingToBePlaced: boolean }) {
  // At a bank in use, a holding still only at the bank is one Operations have to place by hand.
  const status = line.status === "ONLY_AT_BANK" && waitingToBePlaced
    ? { label: "Waiting to be placed", tone: "warning" as const }
    : STATUS[line.status];
  return (
    <tr className="border-b border-line align-top last:border-b-0">
      <td className="py-3 pr-4 pl-5">
        <div className="font-semibold">{line.name}</div>
        {line.isin && <div className="font-mono text-xs text-ink-muted">{line.isin}</div>}
      </td>
      <td className="px-3 py-3 whitespace-nowrap">{line.accounts.join(", ") || "—"}</td>
      <td className="px-3 py-3 text-right whitespace-nowrap tabular-nums">{asSent(line.bankUnits)}</td>
      <td className="px-3 py-3 text-right whitespace-nowrap tabular-nums">{asSent(line.bankPrice)}</td>
      <td className="px-3 py-3 text-right whitespace-nowrap tabular-nums">
        {asSent(line.bankValue)}
        {line.bankCurrency && line.bankValue != null && <span className="ml-1 text-xs text-ink-muted">{line.bankCurrency}</span>}
      </td>
      <td className="px-3 py-3 text-right whitespace-nowrap tabular-nums">
        {asSent(line.bankAccruedInterest)}
        {line.bankCurrency && line.bankAccruedInterest != null && <span className="ml-1 text-xs text-ink-muted">{line.bankCurrency}</span>}
      </td>
      <td className="px-3 py-3 text-right whitespace-nowrap tabular-nums">{figure(line.fileUnits)}</td>
      <td className="px-3 py-3 text-right whitespace-nowrap tabular-nums">{line.fileValue == null ? "—" : whole(line.fileValue)}</td>
      <td className={cn("px-3 py-3 text-right font-semibold whitespace-nowrap tabular-nums", line.status === "MATCHES" ? "text-ink-muted" : "text-red-600")}>
        {line.unitsDifference != null && line.unitsDifference !== 0 && (
          <div>{signed(line.unitsDifference)} units</div>
        )}
        {line.status === "ONLY_AT_BANK" && line.bankValue != null
          // Nothing on the file to set it against: the difference is the bank's own figure, in its own currency.
          ? <>{line.bankValue > 0 ? "+" : ""}{asSent(line.bankValue)}<span className="ml-1 text-xs">{line.bankCurrency}</span></>
          : line.valueDifference === 0 ? "—" : signed(line.valueDifference)}
      </td>
      <td className="py-3 pr-5 pl-3">
        <Badge tone={status.tone}>{status.label}</Badge>
        {line.filePricedOn && <div className="mt-1 text-xs text-ink-muted">File written {formatDate(line.filePricedOn)}</div>}
      </td>
    </tr>
  );
}

/** A value as the rest of the screen writes it: whole units of money. */
function whole(value: number) {
  return value.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

/** A bank's figure exactly as it sent it: every decimal it gave, none added, nothing rounded. */
function asSent(value: number | null | undefined) {
  return value == null ? "—" : value.toLocaleString("en-US", { maximumFractionDigits: 8 });
}

function figure(value: number | null | undefined, places = 0) {
  return value == null ? "—" : value.toLocaleString("en-US", { minimumFractionDigits: places, maximumFractionDigits: places || 2 });
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-white px-4 py-3">
      <dt className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">{label}</dt>
      <dd className="mt-1 font-semibold tabular-nums">{children}</dd>
    </div>
  );
}
