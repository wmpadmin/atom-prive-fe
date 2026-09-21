import { ApiError } from "@atomprive/api-client";
import {
  useListSyncRuns,
  type ListSyncRunsOutcome,
  type ListSyncRunsParams,
  type SyncRunPage,
  type SyncRunRow,
} from "@atomprive/api-client/backoffice";
import { Alert, Badge, Pagination, SelectInput } from "@atomprive/ui";
import { keepPreviousData } from "@tanstack/react-query";
import { useState } from "react";
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
  // The banks a run can belong to; the same list the filter offers.
  const banks = [...new Map((runs.data?.items ?? []).map((run) => [run.bankId, run.bankName])).entries()];

  if (runs.isError) {
    return <Alert tone="danger">{runs.error.message}</Alert>;
  }
  const counts = runs.data?.counts;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-[1.625rem] font-bold">Bank syncs</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Every attempt to pull a client's data from a bank, with what came back. Filled by the bank feeds once each
          bank is connected.
        </p>
      </header>

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
              {banks.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
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
                <th scope="col" className="py-3 pr-5 pl-4">Result</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {!runs.data && (
                <tr>
                  <td colSpan={9} className="px-5 py-8 text-center text-ink-muted">Loading runs…</td>
                </tr>
              )}
              {runs.data?.items.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-5 py-10 text-center text-ink-muted">
                    No sync runs yet. They appear here once a bank feed is connected.
                  </td>
                </tr>
              )}
              {(runs.data?.items ?? []).map((run) => <Row key={run.id} run={run} />)}
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

function Row({ run }: { run: SyncRunRow }) {
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
        <td className="py-3 pr-5 pl-4">
          <Badge tone={outcomeTones[run.outcome]}>{outcomeLabels[run.outcome]}</Badge>
        </td>
      </tr>
      {run.errorDetail && (
        <tr>
          <td colSpan={9} className="bg-red-50/60 px-5 py-2 text-xs text-red-800">
            {run.errorDetail}
          </td>
        </tr>
      )}
    </>
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
