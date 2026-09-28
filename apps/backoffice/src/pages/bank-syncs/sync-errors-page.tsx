import { ApiError } from "@atomprive/api-client";
import {
  getListSyncRunsQueryKey,
  useListSyncRuns,
  useRetrySyncRun,
  type SyncRunPage,
  type SyncRunRow,
} from "@atomprive/api-client/backoffice";
import { Alert, Badge, Button, Pagination, SelectInput } from "@atomprive/ui";
import { keepPreviousData, useQueryClient } from "@tanstack/react-query";
import { RotateCcw } from "lucide-react";
import { useState } from "react";
import { useStaffUser } from "../../auth/session";
import { formatDateTime } from "../../lib/labels";
import { DEFAULT_PAGE_SIZE, PAGE_SIZES } from "../../lib/page-sizes";
import { hasAuthority } from "../../lib/permissions";

/**
 * What has gone wrong with the feeds, and nothing else (#81). Ingestion monitoring is the whole log; this is
 * the part of it somebody has to do something about, with the feeds that have been failing for days called
 * out above the rest.
 */
export function SyncErrorsPage() {
  const [bankId, setBankId] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);

  const runs = useListSyncRuns<SyncRunPage, ApiError>(
    { bankId: bankId || undefined, outcome: "FAILED", page, size: pageSize },
    { query: { placeholderData: keepPreviousData } },
  );
  const user = useStaffUser();
  const canRetry = hasAuthority(user, "MANAGE_BANK_FEEDS:CHANGE");
  const queryClient = useQueryClient();
  const retry = useRetrySyncRun<ApiError>({
    mutation: { onSuccess: () => void queryClient.invalidateQueries({ queryKey: getListSyncRunsQueryKey() }) },
  });

  if (runs.isError) {
    return <Alert tone="danger">{runs.error.message}</Alert>;
  }
  const banks = runs.data?.banks ?? [];
  const failing = runs.data?.failing ?? [];
  const rows = runs.data?.items ?? [];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-[1.625rem] font-bold">Sync errors</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Every run that failed, newest first, with what the bank said. Try one again once whatever stopped it
          has been put right.
        </p>
      </header>

      {retry.error && <Alert tone="danger">{retry.error.message}</Alert>}

      {/* A feed that fails once rights itself; one still failing after three days is somebody's to chase. */}
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

      <section className="rounded-2xl border border-line bg-white">
        <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-4">
          <label className="flex items-center gap-2 text-xs text-ink-muted">
            Bank
            <SelectInput
              id="error-bank"
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
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                <th scope="col" className="py-3 pr-4 pl-5">Bank</th>
                <th scope="col" className="px-4 py-3">Account</th>
                <th scope="col" className="px-4 py-3">Failed</th>
                <th scope="col" className="px-4 py-3">What the bank said</th>
                <th scope="col" className="py-3 pr-5 pl-4 text-right">
                  <span className="sr-only">Try again</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {!runs.data && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-ink-muted">Loading errors…</td>
                </tr>
              )}
              {runs.data && rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-ink-muted">
                    Nothing has failed. Every run the feeds have made came back.
                  </td>
                </tr>
              )}
              {rows.map((run: SyncRunRow) => (
                <tr key={run.id}>
                  <td className="py-3 pr-4 pl-5 font-medium">{run.bankName}</td>
                  <td className="px-4 py-3 text-ink-soft">{run.accountLabel}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-ink-soft tabular-nums">
                    {formatDateTime(run.startedAt)}
                  </td>
                  <td className="px-4 py-3 text-ink">
                    {run.errorDetail ?? <Badge tone="danger">No reason recorded</Badge>}
                  </td>
                  <td className="py-3 pr-5 pl-4 text-right">
                    {canRetry && (
                      <Button variant="ghost" size="sm" disabled={retry.isPending} onClick={() => retry.mutate({ runId: run.id })}>
                        <RotateCcw aria-hidden="true" />
                        Try again
                      </Button>
                    )}
                  </td>
                </tr>
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
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(0);
              }}
              noun={["error", "errors"]}
            />
          </div>
        )}
      </section>
    </div>
  );
}
