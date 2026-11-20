import { ApiError } from "@atomprive/api-client";
import { getExportHoldingHistoryUrl, useGetHoldingHistory, type HoldingHistory, type TrailRow } from "@atomprive/api-client/backoffice";
import { Button, cn } from "@atomprive/ui";
import { Download } from "lucide-react";
import { useState } from "react";
import { saveApiFile } from "../lib/download";
import { formatDate } from "../lib/labels";

type Show = "all" | "changes" | "values";

const KIND: Record<string, string> = {
  VALUE: "Daily value",
  BANK_FILE: "Bank file",
  RECORDED: "Recorded",
  REMOVED: "Taken off",
  MOVED: "Money moved",
  PLAN: "Move plan",
  APPROVAL: "Approval",
  CHANGED: "Changed",
};

/**
 * One holding's whole trail, newest first: every day's value, every bank file that changed it, and everything done
 * to it — written down, money moved, a move plan, a new line approved — with who did it. All of it is read from what
 * the platform already keeps; nothing here is typed for the trail.
 */
export function HoldingTrail({ customerId, isin, name, positionId }: {
  customerId: string;
  isin?: string | null;
  name: string;
  positionId?: string | null;
}) {
  const params = { isin: isin ?? undefined, name: isin ? undefined : name, positionId: isin ? undefined : positionId ?? undefined };
  const history = useGetHoldingHistory<HoldingHistory, ApiError>(customerId, params);
  const [show, setShow] = useState<Show>("all");
  const [saving, setSaving] = useState(false);

  const rows = history.data?.trail ?? [];
  const shown = rows.filter((one) => show === "all" || (show === "values" ? one.kind === "VALUE" : one.kind !== "VALUE"));
  const days = (history.data?.days ?? []).filter((one) => one.currency === history.data?.days[0]?.currency).slice().reverse();

  return (
    <section className="min-w-0">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h3 className="mr-auto text-2xs font-bold tracking-wider text-ink-soft uppercase">History</h3>
        <div role="group" aria-label="What to show" className="flex rounded-lg border border-line p-0.5 text-xs">
          {([["all", "Everything"], ["changes", "Changes only"], ["values", "Daily values"]] as const).map(([id, label]) => (
            <button key={id} type="button" aria-pressed={show === id} onClick={() => setShow(id)}
              className={cn("rounded-md px-2.5 py-1 font-medium", show === id ? "bg-primary-50 text-primary-700" : "text-ink-soft hover:text-ink")}>
              {label}
            </button>
          ))}
        </div>
        <Button variant="secondary" size="sm" disabled={saving || rows.length === 0}
          onClick={() => {
            setSaving(true);
            void saveApiFile(getExportHoldingHistoryUrl(customerId, params), `${name.replace(/[^\w-]+/g, "-")}-history.xlsx`)
              .finally(() => setSaving(false));
          }}>
          <Download aria-hidden="true" /> Excel
        </Button>
      </div>

      {history.isError ? (
        <p className="py-4 text-sm text-red-700">The history could not be loaded. Try again.</p>
      ) : !history.data ? (
        <div className="h-32 animate-pulse rounded-xl bg-slate-50" />
      ) : rows.length === 0 ? (
        <p className="py-4 text-sm text-ink-muted">Nothing is on file for this holding yet.</p>
      ) : (
        <>
          {days.length > 1 && show !== "changes" && <Line values={days.map((one) => one.value)} />}
          <div className="max-h-[28rem] overflow-auto">
            <table className="w-full min-w-[34rem] table-fixed text-sm">
              <colgroup>
                <col className="w-28" />
                <col className="w-28" />
                <col />
                <col className="w-28" />
              </colgroup>
              <thead className="sticky top-0 bg-white">
                <tr className="border-b border-line text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                  <th scope="col" className="py-1.5 pr-2">Date</th>
                  <th scope="col" className="py-1.5 pr-2">Event</th>
                  <th scope="col" className="py-1.5 pr-2">What changed</th>
                  <th scope="col" className="py-1.5 text-right">Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {shown.map((one, at) => <Row key={`${one.day}-${one.at ?? ""}-${at}`} one={one} />)}
              </tbody>
            </table>
            {shown.length === 0 && <p className="py-4 text-center text-sm text-ink-muted">Nothing of this kind on file.</p>}
          </div>
          <p className="mt-2 text-2xs text-ink-muted italic">
            {history.data.asSent ? "Values as the bank's files sent them, in their own currency." : "Each day's closing value on the platform."}
            {" "}Acts come from the audit trail, move plans and new-holding approvals.
          </p>
        </>
      )}
    </section>
  );
}

function Row({ one }: { one: TrailRow }) {
  const act = one.kind !== "VALUE";
  return (
    <tr className={cn(act && one.kind !== "BANK_FILE" && "bg-primary-50/30")}>
      <td className="py-2 pr-2 align-top whitespace-nowrap tabular-nums">
        {formatDate(one.day)}
        {one.at && <span className="block text-2xs text-ink-muted">{new Date(one.at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span>}
      </td>
      <td className={cn("py-2 pr-2 align-top text-xs font-semibold", act ? "text-primary-700" : "text-ink-muted")}>{KIND[one.kind] ?? one.kind}</td>
      <td className="py-2 pr-2 align-top break-words">
        {one.what}
        {one.by && <span className="block text-2xs text-ink-muted">by {one.by}</span>}
      </td>
      <td className="py-2 text-right align-top whitespace-nowrap tabular-nums">
        {one.value == null ? "—" : `${one.currency ? `${one.currency} ` : ""}${one.value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
      </td>
    </tr>
  );
}

/** The value over the days on file, oldest at the left. */
function Line({ values }: { values: number[] }) {
  const low = Math.min(...values);
  const high = Math.max(...values);
  const span = high - low || 1;
  const points = values.map((value, at) => `${(at / (values.length - 1)) * 300},${70 - ((value - low) / span) * 60}`).join(" ");
  return (
    <svg viewBox="0 0 300 76" className="mb-2 h-20 w-full" role="img" aria-label="Value over the days on file" preserveAspectRatio="none">
      <line x1="0" y1="74" x2="300" y2="74" stroke="currentColor" className="text-slate-200" />
      <polyline fill="none" strokeWidth="2" points={points} stroke="currentColor" className="text-primary-600" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
