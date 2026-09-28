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
import { useState } from "react";
import { Link } from "react-router";
import { useStaffUser } from "../../auth/session";
import { formatDateTime } from "../../lib/labels";
import { hasAuthority } from "../../lib/permissions";
import { connectionLabels, feedStanding, scheduleLabels } from "./feed-labels";

type Only = "all" | "failed" | "off";

/**
 * Every bank feed on one screen (#50, #79, #81): what each one is for, how it is set to run, and where it has
 * got to. The run-by-run log is Ingestion log; this is the feeds themselves.
 */
export function IngestionMonitoringPage() {
  const [only, setOnly] = useState<Only>("all");
  const feeds = useListBankFeeds<BankFeed[], ApiError>({ query: { placeholderData: keepPreviousData } });
  const summary = useSummariseFeeds<FeedSummary, ApiError>({ query: { placeholderData: keepPreviousData } });
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

  if (feeds.isError) {
    return <Alert tone="danger">{feeds.error.message}</Alert>;
  }
  const all = feeds.data ?? [];
  const failed = all.filter((feed) => feed.enabled && (feed.failingForDays || feed.lastOutcome === "FAILED"));
  const off = all.filter((feed) => !feed.enabled);
  const rows = only === "failed" ? failed : only === "off" ? off : all;

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

      <section className="rounded-2xl border border-line bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
          <h2 className="text-base font-bold">All feeds</h2>
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
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                <th scope="col" className="py-3 pr-4 pl-5">Bank</th>
                <th scope="col" className="px-4 py-3">Method</th>
                <th scope="col" className="px-4 py-3">Scheduled</th>
                <th scope="col" className="px-4 py-3">Last sync</th>
                <th scope="col" className="px-4 py-3 text-right">Records today</th>
                <th scope="col" className="px-4 py-3">Status</th>
                <th scope="col" className="py-3 pr-5 pl-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {!feeds.data && (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-ink-muted">Loading feeds…</td>
                </tr>
              )}
              {feeds.data && rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-ink-muted">
                    {all.length === 0 ? "No bank is set up yet." : "No feed is in that state."}
                  </td>
                </tr>
              )}
              {rows.map((feed) => {
                const standing = feedStanding(feed);
                return (
                  <tr key={feed.id} className={feed.failingForDays ? "bg-red-50/40" : undefined}>
                    <td className="py-3 pr-4 pl-5">
                      <span className="block font-medium">{feed.name}</span>
                      <span className="block text-xs text-ink-muted">
                        {feed.liveAccounts} account{feed.liveAccounts === 1 ? "" : "s"}
                        {feed.takenOffAccounts > 0 ? ` · ${feed.takenOffAccounts} taken off` : ""}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-ink-soft">
                      {connectionLabels[feed.connectionType] ?? feed.connectionType}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-ink-soft">
                      {scheduleLabels[feed.schedule] ?? feed.schedule}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-ink-soft tabular-nums">
                      {feed.lastRunAt ? formatDateTime(feed.lastRunAt) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{feed.recordsToday}</td>
                    <td className="px-4 py-3">
                      <Badge tone={standing.tone}>{standing.label}</Badge>
                    </td>
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
                );
              })}
            </tbody>
          </table>
        </div>
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
