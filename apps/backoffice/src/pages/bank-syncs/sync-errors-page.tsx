import { ApiError } from "@atomprive/api-client";
import {
  getListSyncRunsQueryKey,
  useListSyncRuns,
  useRetrySyncRun,
  type SyncRunPage,
  type SyncRunRow,
} from "@atomprive/api-client/backoffice";
import { Alert, Badge, Button, cn, Pagination, SelectInput } from "@atomprive/ui";
import { keepPreviousData, useQueryClient } from "@tanstack/react-query";
import { RotateCcw } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useStaffUser } from "../../auth/session";
import { ColumnPicker } from "../../components/column-picker";
import { ViewTabs } from "../../components/view-tabs";
import { useColumnDrag } from "../../lib/column-drag";
import { formatDateTime } from "../../lib/labels";
import { PAGE_SIZES, defaultPageSize } from "../../lib/page-sizes";
import { hasAuthority } from "../../lib/permissions";
import { useTableView } from "../../lib/table-view";

/**
 * The columns a reader may move and take off, in the order the firm wrote them.
 *
 * <p>Three of the five. The bank is the row — a failure with no bank on it is nobody's to chase — and
 * trying it again has no heading to take hold of.
 */
const MOVABLE: {
  id: string;
  label: string;
  align: "left" | "right";
  nowrap?: boolean;
  tone?: string;
  cell: (run: SyncRunRow) => ReactNode;
}[] = [
  {
    id: "account",
    label: "Account",
    align: "left",
    tone: "text-ink-soft",
    cell: (run) => run.accountLabel,
  },
  {
    id: "failed",
    label: "Failed",
    align: "left",
    nowrap: true,
    tone: "text-ink-soft tabular-nums",
    cell: (run) => formatDateTime(run.startedAt),
  },
  {
    id: "reason",
    label: "What the bank said",
    align: "left",
    tone: "text-ink",
    cell: (run) => run.errorDetail ?? <Badge tone="danger">No reason recorded</Badge>,
  },
];

/**
 * What has gone wrong with the feeds, and nothing else (#81). Ingestion monitoring is the whole log; this is
 * the part of it somebody has to do something about, with the feeds that have been failing for days called
 * out above the rest.
 */
export function SyncErrorsPage() {
  const [bankId, setBankId] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number>(defaultPageSize);

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
  // Above the refusal below: how this reader has arranged the table is a thing about their own screen
  // rather than about what came back, and a hook React sees on one render and not the next is a hook it
  // cannot keep in order.
  const view = useTableView("sync-errors", MOVABLE.map((one) => one.id));
  const drag = useColumnDrag(view);

  if (runs.isError) {
    return <Alert tone="danger">{runs.error.message}</Alert>;
  }
  const byId = new Map(MOVABLE.map((one) => [one.id, one]));
  const shownColumns = view.shown.map((id) => byId.get(id)).filter((one) => one !== undefined);
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

      {/* Above the table: which of their arrangements a reader is in is read before anything in it. */}
      <ViewTabs
        views={view.views}
        current={view.current}
        edited={view.current === null ? view.arranged : view.changed}
        onPick={(name) => (name === null ? view.reset() : view.apply(name))}
        onSave={view.saveAs}
        onDelete={view.remove}
        firstLabel="Everything that failed"
      />

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
          <div className="ml-auto">
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
                <th scope="col" className="py-3 pr-5 pl-4 text-right">
                  <span className="sr-only">Try again</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {!runs.data && (
                <tr>
                  <td colSpan={shownColumns.length + 2} className="px-5 py-8 text-center text-ink-muted">Loading errors…</td>
                </tr>
              )}
              {runs.data && rows.length === 0 && (
                <tr>
                  <td colSpan={shownColumns.length + 2} className="px-5 py-10 text-center text-ink-muted">
                    Nothing has failed. Every run the feeds have made came back.
                  </td>
                </tr>
              )}
              {rows.map((run: SyncRunRow) => (
                <tr key={run.id}>
                  <td className="py-3 pr-4 pl-5 font-medium">{run.bankName}</td>
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
                      {column.cell(run)}
                    </td>
                  ))}
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
