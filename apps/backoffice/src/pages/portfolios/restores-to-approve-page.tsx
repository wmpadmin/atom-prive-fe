import { ApiError } from "@atomprive/api-client";
import {
  useListRestores,
  type RestoreQueue,
} from "@atomprive/api-client/backoffice";
import { Alert, Avatar, Badge, FilterMenu } from "@atomprive/ui";
import { QueueBar } from "./queue-bar";
import { useState } from "react";
import { Link } from "react-router";
import { formatDateTime } from "../../lib/labels";

/**
 * What a reader can narrow the list to, in the order an ask passes through them.
 *
 * <p>Cancelled stands apart from the two answers rather than sitting with them: an ask the person who
 * raised it took back was never answered by anybody.
 */
const STATUS_TABS = [
  { id: "PENDING", label: "Waiting for approval" },
  { id: "APPROVED", label: "Approved" },
  { id: "REJECTED", label: "Rejected" },
  { id: "WITHDRAWN", label: "Cancelled" },
  { id: "all", label: "Everything" },
] as const;

type StatusTab = (typeof STATUS_TABS)[number]["id"];

/** Money, written the way every other portfolio screen writes it. */
function exactly(amount: number, currency: string) {
  return `${currency} ${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * What was asked when a client's figures could be put back to a version they stood at.
 *
 * <p>A record now, not a queue. Nobody may ask for a restore any more: it replaced every figure a client
 * had at once, which is a larger change than the firm wants anybody making by hand, and what a client
 * holds will come from the daily file instead. Taking the asking away is not the same as taking away the
 * record that it happened, so every ask ever raised is still read here — what was wanted, by whom, and
 * what became of it.
 *
 * <p>The waiting branch is kept rather than cut. Nothing can reach it today, because no ask can be
 * raised and none was left open; it stays so that a row somebody finds in an old database still draws as
 * itself instead of falling through to the shape meant for a decided one.
 */
export function RestoresToApprovePage() {
  const queue = useListRestores<RestoreQueue, ApiError>({ query: { refetchOnWindowFocus: true } });
  // Everything, because nothing is waiting: opening on "Waiting for approval" would show an empty list
  // over a screen whose whole content is what has already been decided.
  const [status, setStatus] = useState<StatusTab>("all");

  if (queue.isError) {
    return <Alert tone="danger">{queue.error.message}</Alert>;
  }

  const waiting = queue.data?.waiting ?? [];
  const decided = queue.data?.decided ?? [];
  // One list to filter, because an ask is in exactly one state and the two the server sends are only where
  // it put them. Ordered waiting-first so "Everything" opens on what is still being asked.
  const shown = status === "all"
    ? [...waiting, ...decided]
    : [...waiting, ...decided].filter((row) => row.status === status);

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-line bg-white">
        <QueueBar name="Restores">
          {/* Two fixed sections told the reader what the screen had decided to show them: everything
              waiting, and however much of the rest it felt like keeping. Asked instead, the question has
              one answer at a time — and a rejection from last week is reachable without a section being
              built for it. */}
          <FilterMenu
            label="Asks"
            value={status}
            options={STATUS_TABS.map((one) => ({
              id: one.id,
              label: one.label,
              count: one.id === "all"
                ? waiting.length + decided.length
                : [...waiting, ...decided].filter((row) => row.status === one.id).length,
            }))}
            onChange={setStatus}
            align="right"
          />
        </QueueBar>
        {queue.isPending ? (
          <p className="px-5 py-8 text-sm text-ink-muted">Reading the asks…</p>
        ) : shown.length === 0 ? (
          <p className="px-5 py-8 text-sm text-ink-muted">
            {status === "PENDING" ? "Nothing is waiting on you." : "Nothing here."}
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {shown.map((row) => (
              <li key={row.id} className="px-5 py-4">
                {/* An ask still waiting is a question, and one already decided is a record of one. The same
                    row cannot be both, so each is drawn as what it is. */}
                {row.status === "PENDING" ? (
                  <>
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="flex min-w-0 items-start gap-3">
                        <Avatar name={row.clientName} />
                        <div className="min-w-0">
                          <Link
                            to={`/portfolio-clients/${row.customerId}?tab=daily&from=restores`}
                            className="font-semibold underline-offset-2 hover:underline"
                          >
                            {row.clientName}
                          </Link>
                          <p className="font-mono text-xs text-ink-muted">{row.clientCode}</p>
                          {/* The reason first, because it is the thing whoever asked was told they would be
                              judged on. The figures are below it and they can be read. */}
                          <p className="mt-1 text-sm">{row.why}</p>
                          <p className="mt-2 text-sm text-ink-muted">
                            Back to {row.restoreTo} · version {row.fromRevision} · {row.linesThen}{" "}
                            {row.linesThen === 1 ? "sub-asset" : "sub-assets"}
                          </p>
                          {/* What the yes would actually do, which a date on its own does not say. */}
                          <p className="mt-1 text-sm">
                            <span className="text-ink-muted">Worth now </span>
                            <span className="font-medium tabular-nums">{exactly(row.worthNow, row.currency)}</span>
                            <span className="text-ink-muted"> · worth then </span>
                            <span className="font-medium tabular-nums">{exactly(row.worthThen, row.currency)}</span>
                          </p>
                          {/* The plan that day stood against. A day is the figures AND what they were
                              judged against, so a restore that put only the figures back would read every
                              percentage against a plan they were never written for. */}
                          {row.planThen === null ? (
                            <p className="mt-1 text-sm text-amber-700">
                              This day does not say which plan it stood against, so only the figures go
                              back. {row.planNow === null
                                ? "The client stays on no plan."
                                : `The client stays on ${row.planNow}.`}
                            </p>
                          ) : row.planThen !== row.planNow ? (
                            <p className="mt-1 text-sm">
                              <span className="text-ink-muted">Plan </span>
                              <span className="font-medium">{row.planNow ?? "none"}</span>
                              <span aria-hidden="true" className="mx-1.5 text-ink-muted">→</span>
                              <span className="font-semibold">{row.planThen}</span>
                              <span className="text-ink-muted"> · they go back to it too</span>
                            </p>
                          ) : (
                            <p className="mt-1 text-sm text-ink-muted">
                              Plan {row.planThen} · unchanged by this
                            </p>
                          )}
                          <p className="mt-2 text-xs text-ink-muted">
                            Asked by {row.raisedByName} · {formatDateTime(row.raisedAt)}
                          </p>
                          {row.changedAt && (
                            <p className="mt-1 text-xs font-medium text-amber-700">
                              Changed since it was asked · {formatDateTime(row.changedAt)}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-2">
                        {row.changedAt && <Badge tone="warning">Changed</Badge>}
                        {row.nobodyCloserCanAnswer && <Badge tone="warning">Nobody else can answer this</Badge>}
                        <p className="max-w-56 text-xs text-ink-muted">
                          Restores are no longer asked for or answered.
                        </p>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{row.clientName}</p>
                      <p className="mt-0.5 text-xs text-ink-muted">
                        Back to {row.restoreTo} · version {row.fromRevision} · {row.statusSaid}
                        {row.decidedByName && ` by ${row.decidedByName}`}
                        {row.decidedAt && ` · ${formatDateTime(row.decidedAt)}`}
                      </p>
                      {row.decisionNote && <p className="mt-1 text-xs text-ink-muted">{row.decisionNote}</p>}
                    </div>
                    <Badge tone={row.status === "APPROVED" ? "success" : "neutral"}>{row.statusSaid}</Badge>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
