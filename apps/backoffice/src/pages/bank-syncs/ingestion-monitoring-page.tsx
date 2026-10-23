import { ApiError } from "@atomprive/api-client";
import {
  getListBankFeedsQueryKey,
  getListSyncRunsQueryKey,
  getSummariseFeedsQueryKey,
  useListBankFeeds,
  useStartSyncNow,
  useSummariseFeeds,
  type BankFeed,
  type FeedSummary,
} from "@atomprive/api-client/backoffice";
import { Alert, Badge, Button, cn } from "@atomprive/ui";
import { keepPreviousData, useQueryClient } from "@tanstack/react-query";
import { Play } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link } from "react-router";
import { useStaffUser } from "../../auth/session";
import { ColumnPicker } from "../../components/column-picker";
import { ViewTabs } from "../../components/view-tabs";
import { useColumnDrag } from "../../lib/column-drag";
import { formatDateTime } from "../../lib/labels";
import { PagedFooter, usePagedRows } from "../../lib/paged-rows";
import { hasAuthority } from "../../lib/permissions";
import { useTableView } from "../../lib/table-view";
import { connectionLabels, feedStanding, scheduleLabels } from "./feed-labels";

type Only = "all" | "failed" | "off";

/**
 * The columns a reader may move and take off, in the order the firm wrote them.
 *
 * <p>The bank is not among them and neither is what can be done to its feed: a row with no bank on it
 * says nothing about any feed, and the end of the row is the only way to ask for a run.
 */
const MOVABLE: {
  id: string;
  label: string;
  align: "left" | "right";
  nowrap?: boolean;
  tone?: string;
  cell: (feed: BankFeed) => ReactNode;
}[] = [
  {
    id: "method",
    label: "Method",
    align: "left",
    nowrap: true,
    tone: "text-ink-soft",
    cell: (feed) => connectionLabels[feed.connectionType] ?? feed.connectionType,
  },
  {
    id: "schedule",
    label: "Scheduled",
    align: "left",
    nowrap: true,
    tone: "text-ink-soft",
    cell: (feed) => scheduleLabels[feed.schedule] ?? feed.schedule,
  },
  {
    id: "lastSync",
    label: "Last sync",
    align: "left",
    nowrap: true,
    tone: "text-ink-soft tabular-nums",
    cell: (feed) => (feed.lastRunAt ? formatDateTime(feed.lastRunAt) : "—"),
  },
  {
    id: "recordsToday",
    label: "Records today",
    align: "right",
    cell: (feed) => feed.recordsToday,
  },
  {
    id: "standing",
    label: "Status",
    align: "left",
    cell: (feed) => {
      const standing = feedStanding(feed);
      return <Badge tone={standing.tone}>{standing.label}</Badge>;
    },
  },
];

/**
 * Every bank feed on one screen (#50, #79, #81): what each one is for, how it is set to run, and where it has
 * got to. The run-by-run log is Ingestion log; this is the feeds themselves.
 */
/** How often the screen reads again while somebody is watching it. */
const EVERY_MINUTE = 60_000;

export function IngestionMonitoringPage() {
  const [only, setOnly] = useState<Only>("all");
  // Read again on its own, because this screen is watched rather than visited: somebody who presses Run now
  // waits on it, and an Operations reader leaves it open to see a feed turn. Kept previous data while it
  // refetches, so the numbers do not blink to nothing every minute.
  const feeds = useListBankFeeds<BankFeed[], ApiError>({
    query: { placeholderData: keepPreviousData, refetchInterval: EVERY_MINUTE, refetchOnWindowFocus: true },
  });
  const summary = useSummariseFeeds<FeedSummary, ApiError>({
    query: { placeholderData: keepPreviousData, refetchInterval: EVERY_MINUTE, refetchOnWindowFocus: true },
  });
  const user = useStaffUser();
  const canRun = hasAuthority(user, "MANAGE_BANK_FEEDS:CHANGE");
  const queryClient = useQueryClient();
  const start = useStartSyncNow<ApiError>({
    mutation: {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: getListBankFeedsQueryKey() });
        void queryClient.invalidateQueries({ queryKey: getSummariseFeedsQueryKey() });
        void queryClient.invalidateQueries({ queryKey: getListSyncRunsQueryKey() });
      },
    },
  });

  // Worked out above the refusal below rather than after it, because which page a reader is on is held in a
  // hook, and a hook reached on one render and skipped on the next loses track of which state is its own.
  // The three buttons go on counting the whole list — what is failing is not what is failing on this page.
  const all = feeds.data ?? [];
  const failed = all.filter((feed) => feed.enabled && (feed.failingForDays || feed.lastOutcome === "FAILED"));
  const off = all.filter((feed) => !feed.enabled);
  const rows = only === "failed" ? failed : only === "off" ? off : all;
  const paged = usePagedRows(rows);
  // Read here for the same reason the page is: how a reader has arranged the table is a thing about
  // their own screen, not about whether the feeds came back.
  const view = useTableView("bank-feeds", MOVABLE.map((one) => one.id));
  const drag = useColumnDrag(view);

  if (feeds.isError) {
    return <Alert tone="danger">{feeds.error.message}</Alert>;
  }
  const byId = new Map(MOVABLE.map((one) => [one.id, one]));
  const shownColumns = view.shown.map((id) => byId.get(id)).filter((one) => one !== undefined);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-[1.625rem] font-bold">Ingestion monitoring</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Every bank the firm pulls from, what its feed is for and where it has got to. A run asked for here is
          recorded against you.
        </p>
      </header>

      {start.error && <Alert tone="danger">{start.error.message}</Alert>}

      {/* No transport is built, so a run fetches nothing. Said once, plainly, rather than left to be guessed. */}
      <Alert tone="info">
        No bank's feed is connected yet — SFTP, a bank's API and uploaded files are all configured but not built.
        A sync asked for now is recorded as an attempt and comes back with nothing, saying so.
      </Alert>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card
          label="Feeds"
          value={summary.data ? `${summary.data.enabled} / ${summary.data.feeds}` : undefined}
          note={summary.data ? `${summary.data.feeds - summary.data.enabled} switched off` : ""}
        />
        <Card
          label="Records today"
          value={summary.data?.recordsToday.toLocaleString()}
          note={summary.data ? `across ${summary.data.accounts.toLocaleString()} accounts` : ""}
        />
        <Card
          label="Asked for by hand"
          value={summary.data?.manualToday.toLocaleString()}
          note="today, rather than by the schedule"
        />
      </div>

      {/* Above the table: which of their arrangements a reader is in is read before anything in it. */}
      <ViewTabs
        views={view.views}
        current={view.current}
        edited={view.current === null ? view.arranged : view.changed}
        onPick={(name) => (name === null ? view.reset() : view.apply(name))}
        onSave={view.saveAs}
        onDelete={view.remove}
        firstLabel="Every feed"
      />

      <section className="rounded-2xl border border-line bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
          <h2 className="text-base font-bold">All feeds</h2>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-1">
              {(
                [
                  ["all", `All ${all.length}`],
                  ["failed", `Failing ${failed.length}`],
                  ["off", `Switched off ${off.length}`],
                ] as [Only, string][]
              ).map(([which, label]) => (
                <button
                  key={which}
                  type="button"
                  onClick={() => setOnly(which)}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                    only === which ? "bg-primary-100 text-ink" : "text-ink-muted hover:bg-canvas",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <ColumnPicker
              columns={MOVABLE.map((one) => ({ id: one.id, label: one.label }))}
              shown={new Set(view.shown)}
              order={view.order}
              arranged={view.arranged}
              onChange={(next) => {
                for (const one of MOVABLE) {
                  if (next.has(one.id) === view.hidden.includes(one.id)) view.toggle(one.id);
                }
              }}
              onMove={view.move}
              onReset={view.reset}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                <th scope="col" className="py-3 pr-4 pl-5">Bank</th>
                {shownColumns.map((column, at) => (
                  <th
                    key={column.id}
                    scope="col"
                    {...drag.headingProps(column.id)}
                    className={cn(
                      "cursor-grab touch-none px-4 py-3 select-none",
                      column.align === "right" ? "text-right" : "text-left",
                      column.nowrap && "whitespace-nowrap",
                      drag.dragging === column.id && "cursor-grabbing opacity-40",
                      drag.over === column.id && "bg-primary-50",
                    )}
                    title={`Drag to move ${column.label}`}
                  >
                    {column.label}
                    <span className="sr-only">
                      , column {at + 1} of {shownColumns.length}. Use the Columns button to move or hide it.
                    </span>
                  </th>
                ))}
                <th scope="col" className="py-3 pr-5 pl-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {!feeds.data && (
                <tr>
                  <td colSpan={shownColumns.length + 2} className="px-5 py-8 text-center text-ink-muted">Loading feeds…</td>
                </tr>
              )}
              {feeds.data && rows.length === 0 && (
                <tr>
                  <td colSpan={shownColumns.length + 2} className="px-5 py-10 text-center text-ink-muted">
                    {all.length === 0 ? "No bank is set up yet." : "No feed is in that state."}
                  </td>
                </tr>
              )}
              {paged.shown.map((feed) => (
                <tr key={feed.id} className={feed.failingForDays ? "bg-red-50/40" : undefined}>
                  <td className="py-3 pr-4 pl-5">
                    <span className="block font-medium">{feed.name}</span>
                    <span className="block text-xs text-ink-muted">
                      {feed.liveAccounts} account{feed.liveAccounts === 1 ? "" : "s"}
                      {feed.takenOffAccounts > 0 ? ` · ${feed.takenOffAccounts} taken off` : ""}
                    </span>
                  </td>
                  {/* The cells in the order the headings are in, out of the one list that holds both. */}
                  {shownColumns.map((column) => (
                    <td
                      key={column.id}
                      className={cn(
                        "px-4 py-3",
                        column.align === "right" && "text-right tabular-nums",
                        column.nowrap && "whitespace-nowrap",
                        column.tone,
                      )}
                    >
                      {column.cell(feed)}
                    </td>
                  ))}
                  <td className="py-3 pr-5 pl-4">
                    <div className="flex justify-end gap-3">
                      {canRun && feed.enabled && (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={start.isPending}
                          onClick={() => start.mutate({ bankId: feed.id, data: { accountLabel: null } })}
                        >
                          <Play aria-hidden="true" />
                          Run now
                        </Button>
                      )}
                      <Link
                        to={`/bank-syncs?bankId=${feed.id}`}
                        className="self-center text-xs font-semibold text-primary-700 hover:underline"
                      >
                        View runs
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Outside the box the table scrolls in, and left off while the loading and empty lines hold the
            table: a count of nothing under a row saying there is nothing says it twice. */}
        {feeds.data && rows.length > 0 && <PagedFooter paged={paged} noun={["feed", "feeds"]} />}
      </section>
    </div>
  );
}

function Card({ label, value, note }: { label: string; value: string | undefined; note: string }) {
  return (
    <div className="rounded-2xl border border-line bg-white px-5 py-4">
      <p className="text-xs font-semibold tracking-wider text-ink-muted uppercase">{label}</p>
      <p className="mt-1 text-3xl font-bold tabular-nums">{value ?? "—"}</p>
      <p className="mt-0.5 text-xs text-ink-muted">{note}</p>
    </div>
  );
}
