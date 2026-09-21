import type { DeclarationRow } from "@atomprive/api-client/backoffice";
import { Badge, cn } from "@atomprive/ui";
import { formatDate } from "../../lib/labels";

const MISSING = "—";

/**
 * All nine of one person's declarations, as the register sets them out. Shown both on the Operations
 * register and on the employee's own staff record, so it is the one table in both places.
 */
export function DeclarationsTable({ declarations }: { declarations: DeclarationRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[40rem] border-collapse text-sm">
        <thead>
          <tr className="border-b border-line text-2xs tracking-wider text-ink-muted uppercase">
            <th scope="col" className="w-10 py-2 text-left font-semibold" />
            <th scope="col" className="py-2 text-left font-semibold">
              Declaration
            </th>
            <th scope="col" className="py-2 text-left font-semibold">
              Status
            </th>
            <th scope="col" className="py-2 text-left font-semibold">
              Signed date
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {declarations.map((one, at) => (
            <tr key={one.kind}>
              <td className="py-3 align-top">
                <span className="grid size-6 place-items-center rounded-full bg-canvas text-2xs font-semibold text-ink-muted">
                  {at + 1}
                </span>
              </td>
              <td className="py-3 pr-4 align-top">
                <span className="block font-semibold text-ink">{one.title}</span>
                {/* The cycle, as the firm sets it. The day it fell due is said once, where it is overdue. */}
                <span className={cn("block text-xs", one.overdue && !one.signed ? "text-red-600" : "text-ink-muted")}>
                  {one.schedule}
                  {one.overdue && !one.signed && one.dueOn ? ` · overdue since ${formatDate(one.dueOn)}` : ""}
                </span>
              </td>
              <td className="py-3 pr-4 align-top">
                <Badge tone={one.signed ? "success" : "danger"}>{one.signed ? "Signed" : "Unsigned"}</Badge>
              </td>
              <td className="py-3 align-top text-ink">{one.signedOn ? formatDate(one.signedOn) : MISSING}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** How far through the nine someone is, as a bar with what is outstanding said under it. */
export function DeclarationsProgress({
  signed,
  total,
  outstanding,
  oldestOverdueSince,
}: {
  signed: number;
  total: number;
  outstanding: number;
  oldestOverdueSince?: string | null;
}) {
  const share = total === 0 ? 0 : Math.round((signed / total) * 100);
  return (
    <div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-canvas">
        <div
          className={cn("h-full rounded-full", share === 100 ? "bg-emerald-500" : "bg-amber-400")}
          style={{ width: `${share}%` }}
        />
      </div>
      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-xs text-ink-muted">
        <span>
          {outstanding === 0
            ? "Nothing outstanding."
            : `${outstanding} outstanding${oldestOverdueSince ? ` · oldest overdue since ${formatDate(oldestOverdueSince)}` : ""}`}
        </span>
        <span>{share}%</span>
      </div>
    </div>
  );
}
