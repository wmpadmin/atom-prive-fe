import { ApiError } from "@atomprive/api-client";
import { useReadPipeline, type Pipeline, type PipelineRow } from "@atomprive/api-client/backoffice";
import { Alert, Badge, cn } from "@atomprive/ui";
import { useState } from "react";
import { Link } from "react-router";
import { formatDate } from "../../lib/labels";
import { deadlineSaid } from "./clearance-labels";

type Which = "all" | "inProgress" | "ready" | "overdue" | "blocked";

/**
 * Every client the firm is thinking of letting go, and where each has got to.
 *
 * <p>Operations and the Admin read the same list. Operations works it; the Admin watches it and answers
 * the ones that are ready. Two lists of the same thing is how two desks come to disagree about which
 * clients are waiting.
 *
 * <p>The tabs carry their counts, because a tab somebody has to open to find out whether it is empty is
 * a tab nobody opens.
 */
export function PipelinePanel() {
  const pipeline = useReadPipeline<Pipeline, ApiError>();
  const [which, setWhich] = useState<Which>("all");

  if (pipeline.isError) {
    return <Alert tone="danger">{pipeline.error.message}</Alert>;
  }
  const all = pipeline.data?.items ?? [];
  const shown = all.filter((row) =>
    which === "all" ? true
    : which === "ready" ? row.readyForAdmin
    : which === "overdue" ? row.overdue
    : which === "blocked" ? row.blocked
    : !row.readyForAdmin && row.asked > 0);

  const tabs: { id: Which; label: string; count?: number }[] = [
    { id: "all", label: "Every client", count: all.length },
    { id: "inProgress", label: "In progress", count: pipeline.data?.inProgress },
    { id: "ready", label: "Ready for the Admin", count: pipeline.data?.readyForAdmin },
    { id: "blocked", label: "Blocked", count: pipeline.data?.blocked },
    { id: "overdue", label: "Overdue", count: pipeline.data?.overdue },
  ];

  return (
    <div className="space-y-4">
      <div role="tablist" aria-label="Which clients" className="flex flex-wrap gap-1 border-b border-line">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            type="button"
            aria-selected={which === tab.id}
            onClick={() => setWhich(tab.id)}
            className={cn(
              "-mb-px border-b-2 px-4 py-2 text-sm font-semibold",
              which === tab.id
                ? "border-primary-600 text-primary-700"
                : "border-transparent text-ink-muted hover:text-ink",
            )}
          >
            {tab.label}
            {tab.count !== undefined && <span className="ml-1.5 text-ink-muted">· {tab.count}</span>}
          </button>
        ))}
      </div>

      <section className="rounded-2xl border border-line bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <caption className="sr-only">Clients waiting to be deactivated, and how far each has got.</caption>
            <thead>
              <tr className="border-b border-line text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                <th scope="col" className="py-3 pr-4 pl-6">Client</th>
                <th scope="col" className="px-4 py-3">Asked by</th>
                <th scope="col" className="px-4 py-3">Desks cleared</th>
                <th scope="col" className="px-4 py-3">Stage</th>
                <th scope="col" className="py-3 pr-6 pl-4">Wanted by</th>
              </tr>
            </thead>
            <tbody>
              {pipeline.isPending ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-ink-muted">Reading the pipeline…</td>
                </tr>
              ) : shown.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-ink-muted">
                    {all.length === 0
                      ? "No client is waiting to be deactivated."
                      : "None under this heading."}
                  </td>
                </tr>
              ) : (
                shown.map((row) => <Row key={row.requestId} row={row} />)
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Row({ row }: { row: PipelineRow }) {
  const days = deadlineSaid(row.daysLeft, row.overdue);
  const share = row.asked === 0 ? 0 : Math.round((row.cleared / row.asked) * 100);
  return (
    <tr className="border-b border-line last:border-b-0">
      <th scope="row" className="py-3 pr-4 pl-6 text-left font-medium">
        <Link to={`/clients/${row.customerId}`}
          state={{ tab: "deactivation" }} className="text-ink hover:text-primary-700 hover:underline">
          {row.clientName}
        </Link>
        <span className="block text-xs text-ink-muted">{row.clientCode}</span>
      </th>
      <td className="px-4 py-3 text-ink-soft">
        {row.askedByName ?? "—"}
        <span className="block text-xs text-ink-muted">{formatDate(row.askedAt)}</span>
      </td>
      <td className="px-4 py-3">
        {row.asked === 0 ? (
          <span className="text-ink-muted">Not asked yet</span>
        ) : (
          <>
            <span className="text-sm font-medium tabular-nums">
              {row.cleared}/{row.asked}
            </span>
            <span className="mt-1 block h-1.5 w-24 overflow-hidden rounded-full bg-canvas">
              <span
                className={cn("block h-full rounded-full", row.readyForAdmin ? "bg-emerald-500" : "bg-primary-600")}
                style={{ width: `${share}%` }}
              />
            </span>
          </>
        )}
      </td>
      <td className="px-4 py-3">
        <Badge tone={row.readyForAdmin ? "success" : row.blocked ? "danger" : "neutral"}>{row.stage}</Badge>
        {/* Blocked is said beside the stage rather than instead of it: a reader needs both where it has
            got to and whether somebody has stopped. */}
        {row.blocked && !row.readyForAdmin && (
          <span className="mt-1 block text-xs text-danger">A desk is blocked</span>
        )}
      </td>
      <td className="py-3 pr-6 pl-4">
        {row.deadline ? (
          <>
            {formatDate(row.deadline)}
            {days && (
              <span className={cn("block text-xs", row.overdue ? "font-semibold text-danger" : "text-ink-muted")}>
                {days}
              </span>
            )}
          </>
        ) : (
          <span className="text-ink-muted">—</span>
        )}
      </td>
    </tr>
  );
}
