import { ApiError } from "@atomprive/api-client";
import {
  answerOwnedAssetChange,
  getListOwnedAssetChangesQueryKey,
  useListOwnedAssetChanges,
  withdrawOwnedAssetChange,
  type OwnedAssetChangeQueue,
  type OwnedAssetChangeRow,
} from "@atomprive/api-client/backoffice";
import { Alert, Avatar, Badge, Button, Dialog, Field, Pagination, TextArea, cn, type FilterOption } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { ColumnPicker } from "../../components/column-picker";
import { QueueActions } from "../../components/queue-actions";
import { ViewTabs } from "../../components/view-tabs";
import { useColumnDrag } from "../../lib/column-drag";
import { formatDate, formatDateTime } from "../../lib/labels";
import { PAGE_SIZES, defaultPageSize } from "../../lib/page-sizes";
import { useTableView } from "../../lib/table-view";
import { download, quoted } from "../advisor/proposal-export";
import { QueueBar } from "./queue-bar";
import { QueueFilters } from "./queue-filters";

const money = (value: number) => value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type Status = "PENDING" | "APPROVED" | "REJECTED" | "WITHDRAWN";
type Tab = Status | "all";

const TABS: { id: Tab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "PENDING", label: "Waiting for approval" },
  { id: "APPROVED", label: "Approved" },
  { id: "REJECTED", label: "Rejected" },
  { id: "WITHDRAWN", label: "Taken back" },
];

const LABELS: Record<Status, string> = {
  PENDING: "Waiting for approval",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  WITHDRAWN: "Taken back",
};

const TONES: Record<Status, "neutral" | "success" | "danger" | "warning"> = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "danger",
  WITHDRAWN: "neutral",
};

const KINDS: Record<string, string> = { ADD: "New item", VALUE: "New valuation", EDIT: "Cost or owners", REMOVE: "Take off" };

/** What a change asks for, with the figures it carries. */
function asked(change: OwnedAssetChangeRow) {
  switch (change.kind) {
    case "ADD":
      return change.item
        ? `Add ${change.assetName} at ${money(change.item.value)}${change.item.cost !== null ? `, cost ${money(change.item.cost)}` : ""}`
        : `Add ${change.assetName}`;
    case "VALUE":
      return change.valuation
        ? `Value ${change.assetName} at ${money(change.valuation.value)} on ${formatDate(change.valuation.valuedOn)}${change.valuation.valuedBy ? ` (by ${change.valuation.valuedBy})` : ""}`
        : `Value ${change.assetName}`;
    case "EDIT":
      return change.item
        ? `Set the cost of ${change.assetName} to ${change.item.cost === null ? "none" : money(change.item.cost)} and its owners to ${change.item.owners.map((one) => `${Number(one.share)}%`).join(" / ")}`
        : `Change the cost or owners of ${change.assetName}`;
    default:
      return `Take ${change.assetName} off the list`;
  }
}

/** The columns a reader may move or hide; the client stays first and the answer last. */
const MOVABLE: { id: string; label: string; width?: string; nowrap?: boolean; tone?: string; cell: (row: OwnedAssetChangeRow) => ReactNode }[] = [
  {
    id: "change",
    label: "Change",
    width: "w-[30%]",
    cell: (row) => (
      <>
        <span className="block font-semibold">{asked(row)}</span>
        <span className="block text-xs text-ink-muted">{KINDS[row.kind] ?? row.kind}</span>
      </>
    ),
  },
  {
    id: "asked",
    label: "Asked by",
    nowrap: true,
    tone: "text-ink-muted",
    cell: (row) => (
      <>
        {row.raisedBy}
        <span className="block text-2xs">{formatDateTime(row.raisedAt)}</span>
      </>
    ),
  },
  {
    id: "answered",
    label: "Answered by",
    tone: "text-ink-muted",
    cell: (row) => (
      <>
        {row.answeredBy ?? "NA"}
        {row.answeredAt && <span className="block text-2xs">{formatDateTime(row.answeredAt)}</span>}
        {row.reason && <span className="block text-2xs">{row.reason}</span>}
      </>
    ),
  },
  {
    id: "status",
    label: "Status",
    nowrap: true,
    cell: (row) => <Badge tone={TONES[row.status as Status]}>{LABELS[row.status as Status] ?? row.status}</Badge>,
  },
];

/**
 * Changes to what clients own outside the portfolio: a new item, a new valuation, a new cost or split between
 * owners, or an item taken off. Laid out as the proposals queue is — narrowed above the card, arranged on the
 * card's own line — and keeping the answered ones, so the queue is also the record of what was said.
 */
export function OwnedAssetChangesPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const queue = useListOwnedAssetChanges<OwnedAssetChangeQueue, ApiError>({ query: { refetchOnWindowFocus: true } });
  const [tab, setTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [newestFirst, setNewestFirst] = useState(true);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState<number>(defaultPageSize);
  const [declining, setDeclining] = useState<OwnedAssetChangeRow | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const view = useTableView("owned-asset-changes", MOVABLE.map((one) => one.id));
  const drag = useColumnDrag(view);
  const byId = new Map(MOVABLE.map((one) => [one.id, one]));
  const shownColumns = view.shown.map((id) => byId.get(id)).filter((one) => one !== undefined);
  const refresh = () => queryClient.invalidateQueries({ queryKey: getListOwnedAssetChangesQueryKey() });

  const act = async (id: string, doing: () => Promise<unknown>) => {
    setBusy(id);
    setError(null);
    try {
      await doing();
      await refresh();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "That could not be done. Try again.");
    } finally {
      setBusy(null);
    }
  };

  const all = queue.data?.items ?? [];
  const typed = search.trim().toLowerCase();
  // Everything but the tab, so each tab's count says what picking it would show.
  const narrowed = all.filter((one) => {
    const day = one.raisedAt.slice(0, 10);
    if (from && day < from) return false;
    if (to && day > to) return false;
    if (!typed) return true;
    return [one.clientName, one.clientCode ?? "", one.assetName, asked(one)].some((words) => words.toLowerCase().includes(typed));
  });
  const countFor = (id: Tab) => (id === "all" ? narrowed.length : narrowed.filter((one) => one.status === id).length);
  const listed = narrowed
    .filter((one) => tab === "all" || one.status === tab)
    .sort((a, b) => (newestFirst ? b.raisedAt.localeCompare(a.raisedAt) : a.raisedAt.localeCompare(b.raisedAt)));
  const rows = listed.slice(page * size, (page + 1) * size);
  const shown: FilterOption<Tab>[] = TABS.map((one) => ({ id: one.id, label: one.label, count: countFor(one.id) }));
  const reset = () => setPage(0);

  const exportListed = () => {
    const head = ["Client", "Client code", "Change", "Kind", "Asked by", "Asked on", "Answered by", "Answered on", "Reason", "Status"];
    const lines = listed.map((one) => [
      one.clientName, one.clientCode ?? "", asked(one), KINDS[one.kind] ?? one.kind, one.raisedBy, formatDate(one.raisedAt.slice(0, 10)),
      one.answeredBy ?? "", one.answeredAt ? formatDate(one.answeredAt.slice(0, 10)) : "", one.reason ?? "", LABELS[one.status as Status] ?? one.status,
    ].map(quoted).join(","));
    download([head.map(quoted).join(","), ...lines].join("\r\n"), "owned-asset-changes.csv");
  };

  if (queue.isError) return <Alert tone="danger">{queue.error.message}</Alert>;
  return (
    <div className="space-y-6">
      <QueueActions className="flex flex-wrap items-center justify-end gap-2">
        <Button variant="secondary" disabled={listed.length === 0} onClick={exportListed}>
          <Download aria-hidden="true" />
          Export
        </Button>
      </QueueActions>
      {error && <Alert tone="danger">{error}</Alert>}

      <QueueFilters
        search={search}
        onSearch={(next) => { setSearch(next); reset(); }}
        searchPlaceholder="Search by item or client"
        show={{ value: tab, options: shown, onChange: (next) => { setTab(next); reset(); } }}
        dated={{
          verb: "Asked",
          from,
          to,
          onFrom: (day) => { setFrom(day); reset(); },
          onTo: (day) => { setTo(day); reset(); },
        }}
        newestFirst={newestFirst}
        onNewestFirst={(next) => { setNewestFirst(next); reset(); }}
      />

      <section className="rounded-2xl border border-line bg-white">
        <QueueBar name="Owned assets">
          <ViewTabs
            views={view.views}
            current={view.current}
            edited={view.current === null ? view.arranged : view.changed}
            onPick={(name) => (name === null ? view.reset() : view.apply(name))}
            onSave={view.saveAs}
            onDelete={view.remove}
            firstLabel="Every change"
          />
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
        </QueueBar>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                <th scope="col" className="w-[16%] py-3 pr-4 pl-5">Client</th>
                {shownColumns.map((column, at) => (
                  <th
                    key={column.id}
                    scope="col"
                    {...drag.headingProps(column.id)}
                    className={cn(
                      "cursor-grab touch-none px-4 py-3 select-none",
                      column.width,
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
                <th scope="col" className="py-3 pr-5 pl-4 text-right"><span className="sr-only">Answer</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {!queue.data && (
                <tr>
                  <td colSpan={shownColumns.length + 2} className="px-5 py-8 text-center text-ink-muted">Reading the changes…</td>
                </tr>
              )}
              {queue.data && rows.length === 0 && (
                <tr>
                  <td colSpan={shownColumns.length + 2} className="px-5 py-10 text-center text-ink-muted">
                    {typed || from || to ? "No change matches what you searched for." : tab === "PENDING" ? "Nothing is waiting." : "Nothing here."}
                  </td>
                </tr>
              )}
              {rows.map((one) => (
                <tr key={one.id} onClick={() => void navigate(`/book/${one.customerId}`)} className="cursor-pointer hover:bg-slate-50/60">
                  <td className="py-3 pr-4 pl-5">
                    <div className="flex items-center gap-3">
                      <Avatar name={one.clientName} photo={one.clientPhoto ?? undefined} />
                      <div className="min-w-0">
                        <span className="block truncate">{one.clientName}</span>
                        {one.clientCode && <span className="block font-mono text-xs text-ink-muted">{one.clientCode}</span>}
                      </div>
                    </div>
                  </td>
                  {shownColumns.map((column) => (
                    <td key={column.id} className={cn("px-4 py-3", column.nowrap && "whitespace-nowrap", column.tone)}>
                      {column.cell(one)}
                    </td>
                  ))}
                  <td className="py-3 pr-5 pl-4 text-right" onClick={(event) => event.stopPropagation()}>
                    <div className="flex items-center justify-end gap-2 whitespace-nowrap">
                      {one.canAnswer && (
                        <>
                          <Button size="sm" variant="secondary" disabled={busy === one.id} onClick={() => { setReason(""); setDeclining(one); }}>
                            Reject
                          </Button>
                          <Button size="sm" disabled={busy === one.id}
                            onClick={() => void act(one.id, () => answerOwnedAssetChange(one.id, { approve: true, reason: null }))}>
                            Approve
                          </Button>
                        </>
                      )}
                      {one.canWithdraw && (
                        <Button size="sm" variant="secondary" disabled={busy === one.id}
                          onClick={() => void act(one.id, () => withdrawOwnedAssetChange(one.id))}>
                          Take back
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {listed.length > 0 && (
          <div className="border-t border-line px-5 py-3">
            <Pagination
              page={page}
              pageSize={size}
              totalItems={listed.length}
              onPageChange={setPage}
              pageSizes={PAGE_SIZES}
              onPageSizeChange={(next) => { setSize(next); reset(); }}
              noun={["change", "changes"]}
            />
          </div>
        )}
      </section>

      <Dialog open={declining !== null} title="Reject this change?" description={declining ? asked(declining) : undefined}
        onClose={() => setDeclining(null)}>
        <Field id="owned-reason" label="Why" required hint="Shown to whoever asked.">
          <TextArea id="owned-reason" rows={3} value={reason} maxLength={1000} onChange={(event) => setReason(event.target.value)} />
        </Field>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setDeclining(null)}>Cancel</Button>
          <Button variant="danger" disabled={!reason.trim() || busy !== null}
            onClick={() => {
              const change = declining;
              if (!change) return;
              setDeclining(null);
              void act(change.id, () => answerOwnedAssetChange(change.id, { approve: false, reason: reason.trim() }));
            }}>
            Reject
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
