import { ApiError } from "@atomprive/api-client";
import { useListSyncRuns, type ListSyncRunsParams, type SyncRunPage } from "@atomprive/api-client/backoffice";
import { formatDateTime } from "../../lib/labels";

const RESULT = { RUNNING: "Running", SUCCEEDED: "Succeeded", FAILED: "Failed" } as const;

/** How many runs the side panel reads at once; the log itself pages through the rest. */
const AT_MOST = 50;

/**
 * The runs behind a figure on the ingestion screens, read from the log when the side panel opens: newest first,
 * the first {@link AT_MOST}, each with what it fetched, inserted and refused, as the log shows them.
 */
export function RunsMore({ params, title }: { params: ListSyncRunsParams; title: string }) {
  const runs = useListSyncRuns<SyncRunPage, ApiError>({ ...params, page: 0, size: AT_MOST });
  const items = runs.data?.items ?? [];
  return (
    <section>
      <h3 className="mb-2 text-2xs font-semibold tracking-wider text-ink-muted uppercase">{title}</h3>
      {runs.isLoading && <p className="text-sm text-ink-muted">Reading the runs…</p>}
      {runs.isError && <p className="text-sm text-red-700">The runs could not be read. {runs.error.message}</p>}
      {runs.data && items.length === 0 && <p className="text-sm text-ink-muted">No run.</p>}
      {items.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-canvas text-left text-2xs font-semibold tracking-wider whitespace-nowrap text-ink-muted uppercase">
                <th scope="col" className="py-2.5 pr-3 pl-4">Bank</th>
                <th scope="col" className="px-3 py-2.5">Account</th>
                <th scope="col" className="px-3 py-2.5">Started</th>
                <th scope="col" className="px-3 py-2.5 text-right">Fetched</th>
                <th scope="col" className="px-3 py-2.5 text-right">Inserted</th>
                <th scope="col" className="px-3 py-2.5 text-right">Errors</th>
                <th scope="col" className="px-3 py-2.5">Result</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {items.map((run) => (
                <tr key={run.id}>
                  <td className="py-2 pr-3 pl-4 font-medium">{run.bankName}</td>
                  <td className="px-3 py-2 text-ink-soft">{run.accountLabel}</td>
                  <td className="px-3 py-2 whitespace-nowrap tabular-nums">{formatDateTime(run.startedAt)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{run.fetched}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{run.inserted}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{run.validationErrors}</td>
                  <td className="px-3 py-2">{RESULT[run.outcome]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {runs.data && runs.data.totalItems > items.length && (
        <p className="mt-2 text-xs text-ink-muted">The newest {items.length} of {runs.data.totalItems}; the Ingestion log has every one.</p>
      )}
    </section>
  );
}
