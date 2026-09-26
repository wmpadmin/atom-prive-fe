import { ApiError } from "@atomprive/api-client";
import {
  getListSyncRunsQueryKey,
  useListSyncRuns,
  useRetrySyncRun,
  useStartSyncNow,
  type ListSyncRunsOutcome,
  type ListSyncRunsParams,
  type SyncRunPage,
  type SyncRunRow,
} from "@atomprive/api-client/backoffice";
import { Alert, Badge, Button, Pagination, SelectInput, TextInput } from "@atomprive/ui";
import { keepPreviousData, useQueryClient } from "@tanstack/react-query";
import { Play, RotateCcw } from "lucide-react";
import { useState } from "react";
import { useStaffUser } from "../../auth/session";
import { hasAuthority } from "../../lib/permissions";
import { DEFAULT_PAGE_SIZE, PAGE_SIZES } from "../../lib/page-sizes";
import { formatDateTime } from "../../lib/labels";

const outcomeLabels: Record<ListSyncRunsOutcome, string> = {
  RUNNING: "Running",
  SUCCEEDED: "Succeeded",
  FAILED: "Failed",
};

const outcomeTones: Record<ListSyncRunsOutcome, "info" | "success" | "danger"> = {
  RUNNING: "info",
  SUCCEEDED: "success",
  FAILED: "danger",
};

/**
 * Sync monitoring and the ingestion log on one screen (#50, #79, #81): how the feeds are doing across the top, then
 * every run in detail with what each one fetched, inserted, skipped and refused.
 */
export function SyncRunsPage() {
  const [bankId, setBankId] = useState("");
  const [outcome, setOutcome] = useState<ListSyncRunsOutcome | "">("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);

  // A different page size starts again at the first page, so the rows on screen always match the summary.
  function changePageSize(size: number) {
    setPageSize(size);
    setPage(0);
  }

  const filters: ListSyncRunsParams = {
    bankId: bankId || undefined,
    outcome: outcome || undefined,
    page,
    size: pageSize,
  };
  const runs = useListSyncRuns<SyncRunPage, ApiError>(filters, { query: { placeholderData: keepPreviousData } });
  // Every bank the feeds cover, not only the ones this page of runs happens to name.
  const banks = runs.data?.banks ?? [];
  const user = useStaffUser();
  const canRun = hasAuthority(user, "MANAGE_BANK_FEEDS:CHANGE");
  const queryClient = useQueryClient();
  const again = () => void queryClient.invalidateQueries({ queryKey: getListSyncRunsQueryKey() });
  const start = useStartSyncNow<ApiError>({ mutation: { onSuccess: again } });
  const retry = useRetrySyncRun<ApiError>({ mutation: { onSuccess: again } });
  const asking = start.isPending || retry.isPending;

  if (runs.isError) {
    return <Alert tone="danger">{runs.error.message}</Alert>;
  }
  const counts = runs.data?.counts;
  const refused = start.error ?? retry.error;
  const failing = runs.data?.failing ?? [];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[1.625rem] font-bold">Bank syncs</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Every attempt to pull a client's data from a bank, with what came back — the ones the schedule brought
            round, and the ones somebody asked for.
          </p>
        </div>
        {canRun && (
          <RunNow
            banks={banks.filter((bank) => bank.enabled)}
            busy={asking}
            onRun={(bank, account) => start.mutate({ bankId: bank, data: { accountLabel: account || null } })}
          />
        )}
      </header>

      {refused && <Alert tone="danger">{refused.message}</Alert>}

      {/* A feed still failing after three days is somebody's to chase, so the screen says so rather than
          leaving it to be noticed among the rows. */}
      {failing.length > 0 && (
        <Alert tone="danger">
          <span className="font-semibold">
            {failing.length === 1 ? "A bank's feed has" : `${failing.length} banks' feeds have`} been failing for
            three days.
          </span>{" "}
          {failing
            .map((feed) => `${feed.name} — ${feed.failedRuns} failed, last tried ${formatDateTime(feed.lastTried)}`)
            .join(" · ")}
        </Alert>
      )}

      {/* Nobody should read a run of nothing as a run that worked. */}
      <Alert tone="info">
        No bank's feed is connected yet — SFTP, a bank's API and uploaded files are all configured but not built. A
        sync asked for now is recorded as an attempt and comes back with nothing, saying so.
      </Alert>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Count label="Runs in 24 hours" value={counts?.runsToday} />
        <Count label="Failed in 24 hours" value={counts?.failedToday} danger={(counts?.failedToday ?? 0) > 0} />
        <Count label="Running now" value={counts?.runningNow} />
        <Count label="Banks connected" value={counts?.banksConnected} />
      </div>

      <section className="rounded-2xl border border-line bg-white">
        <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-4">
          <label className="flex items-center gap-2 text-xs text-ink-muted">
            Bank
            <SelectInput
              id="sync-bank"
              name="bank"
              value={bankId}
              onChange={(event) => {
                setBankId(event.target.value);
                setPage(0);
              }}
              className="w-auto pr-8 pl-3"
            >
              <option value="">All banks</option>
              {banks.map((bank) => (
                <option key={bank.id} value={bank.id}>
                  {bank.name}
                </option>
              ))}
            </SelectInput>
          </label>
          <label className="flex items-center gap-2 text-xs text-ink-muted">
            Result
            <SelectInput
              id="sync-outcome"
              name="outcome"
              value={outcome}
              onChange={(event) => {
                setOutcome(event.target.value as ListSyncRunsOutcome | "");
                setPage(0);
              }}
              className="w-auto pr-8 pl-3"
            >
              <option value="">Any result</option>
              {(Object.keys(outcomeLabels) as ListSyncRunsOutcome[]).map((value) => (
                <option key={value} value={value}>
                  {outcomeLabels[value]}
                </option>
              ))}
            </SelectInput>
          </label>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                <th scope="col" className="py-3 pr-4 pl-5">Bank</th>
                <th scope="col" className="px-4 py-3">Account</th>
                <th scope="col" className="px-4 py-3">Started</th>
                <th scope="col" className="px-4 py-3">Finished</th>
                <th scope="col" className="px-4 py-3 text-right">Fetched</th>
                <th scope="col" className="px-4 py-3 text-right">Inserted</th>
                <th scope="col" className="px-4 py-3 text-right">Skipped</th>
                <th scope="col" className="px-4 py-3 text-right">Errors</th>
                <th scope="col" className="px-4 py-3">Result</th>
                <th scope="col" className="py-3 pr-5 pl-4">
                  <span className="sr-only">Try again</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {!runs.data && (
                <tr>
                  <td colSpan={10} className="px-5 py-8 text-center text-ink-muted">Loading runs…</td>
                </tr>
              )}
              {runs.data?.items.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-5 py-10 text-center text-ink-muted">
                    No sync runs yet. They appear here as the schedule comes round, or as somebody asks for one.
                  </td>
                </tr>
              )}
              {(runs.data?.items ?? []).map((run) => (
                <Row
                  key={run.id}
                  run={run}
                  canRetry={canRun}
                  busy={asking}
                  onRetry={() => retry.mutate({ runId: run.id })}
                />
              ))}
            </tbody>
          </table>
        </div>

        {runs.data && runs.data.totalItems > 0 && (
          <div className="border-t border-line px-5 py-3">
            <Pagination
              page={runs.data.page}
              pageSize={runs.data.size}
              totalItems={runs.data.totalItems}
              onPageChange={setPage}
              pageSizes={PAGE_SIZES}
              onPageSizeChange={changePageSize}
              noun={["run", "runs"]}
            />
          </div>
        )}
      </section>
    </div>
  );
}

function Row({
  run,
  canRetry,
  busy,
  onRetry,
}: {
  run: SyncRunRow;
  canRetry: boolean;
  busy: boolean;
  onRetry: () => void;
}) {
  return (
    <>
      <tr>
        <td className="py-3 pr-4 pl-5 font-medium">{run.bankName}</td>
        <td className="px-4 py-3 text-ink-soft">{run.accountLabel}</td>
        <td className="px-4 py-3 whitespace-nowrap text-ink-soft tabular-nums">{formatDateTime(run.startedAt)}</td>
        <td className="px-4 py-3 whitespace-nowrap text-ink-soft tabular-nums">
          {run.finishedAt ? formatDateTime(run.finishedAt) : "—"}
        </td>
        <td className="px-4 py-3 text-right tabular-nums">{run.fetched}</td>
        <td className="px-4 py-3 text-right tabular-nums">{run.inserted}</td>
        <td className="px-4 py-3 text-right tabular-nums">{run.skipped}</td>
        <td className={`px-4 py-3 text-right tabular-nums ${run.validationErrors > 0 ? "font-semibold text-red-600" : ""}`}>
          {run.validationErrors}
        </td>
        <td className="px-4 py-3">
          <Badge tone={outcomeTones[run.outcome]}>{outcomeLabels[run.outcome]}</Badge>
        </td>
        <td className="py-3 pr-5 pl-4 text-right">
          {/* Only a run that failed is worth trying again; the rest have nothing to put right. */}
          {canRetry && run.outcome === "FAILED" && (
            <Button variant="ghost" size="sm" disabled={busy} onClick={onRetry}>
              <RotateCcw aria-hidden="true" />
              Try again
            </Button>
          )}
        </td>
      </tr>
      {run.errorDetail && (
        <tr>
          <td colSpan={10} className="bg-red-50/60 px-5 py-2 text-xs text-red-800">
            {run.errorDetail}
          </td>
        </tr>
      )}
    </>
  );
}

/**
 * Asking a bank to run now. The account is optional: named, the run is for that one; left blank it is for
 * everything the bank sends.
 */
function RunNow({
  banks,
  busy,
  onRun,
}: {
  banks: { id: string; name: string }[];
  busy: boolean;
  onRun: (bankId: string, accountLabel: string) => void;
}) {
  const [bankId, setBankId] = useState("");
  const [account, setAccount] = useState("");

  if (banks.length === 0) {
    return <p className="text-xs text-ink-muted">No bank is switched on, so there is nothing to pull from.</p>;
  }
  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="flex items-center gap-2 text-xs text-ink-muted">
        Run now
        <SelectInput
          id="run-bank"
          name="runBank"
          value={bankId}
          onChange={(event) => setBankId(event.target.value)}
          className="w-auto pr-8 pl-3"
        >
          <option value="">Choose a bank</option>
          {banks.map((bank) => (
            <option key={bank.id} value={bank.id}>
              {bank.name}
            </option>
          ))}
        </SelectInput>
      </label>
      <TextInput
        id="run-account"
        name="runAccount"
        value={account}
        placeholder="An account, or every account"
        onChange={(event) => setAccount(event.target.value)}
        className="w-56"
      />
      <Button disabled={!bankId || busy} onClick={() => onRun(bankId, account.trim())}>
        <Play aria-hidden="true" />
        {busy ? "Asking…" : "Run now"}
      </Button>
    </div>
  );
}

function Count({ label, value, danger }: { label: string; value: number | undefined; danger?: boolean }) {
  return (
    <div className="rounded-2xl border border-line bg-white px-5 py-4">
      <p className="text-xs font-semibold tracking-wider text-ink-muted uppercase">{label}</p>
      <p className={`mt-1 text-3xl font-bold tabular-nums ${danger ? "text-red-600" : ""}`}>{value ?? "—"}</p>
    </div>
  );
}
