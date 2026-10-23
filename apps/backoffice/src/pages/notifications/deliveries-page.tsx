import { ApiError } from "@atomprive/api-client";
import {
  useListDeliveries,
  type DeliveryPage,
  type DeliveryRow,
  type ListDeliveriesChannel,
  type ListDeliveriesParams,
  type ListDeliveriesStatus,
} from "@atomprive/api-client/backoffice";
import { Alert, Badge, cn, Pagination, SelectInput, TextInput } from "@atomprive/ui";
import { keepPreviousData } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { ColumnPicker } from "../../components/column-picker";
import { ViewTabs } from "../../components/view-tabs";
import { useColumnDrag } from "../../lib/column-drag";
import { useTableView } from "../../lib/table-view";
import { useDebouncedValue } from "../../lib/use-debounced-value";
import { DEFAULT_PAGE_SIZE, PAGE_SIZES } from "../../lib/page-sizes";
import { formatDateTime } from "../../lib/labels";

const statusLabels: Record<ListDeliveriesStatus, string> = {
  QUEUED: "Queued",
  SENT: "Sent",
  DELIVERED: "Delivered",
  OPENED: "Opened",
  FAILED: "Failed",
};

const statusTones: Record<ListDeliveriesStatus, "neutral" | "info" | "success" | "danger"> = {
  QUEUED: "neutral",
  SENT: "info",
  DELIVERED: "success",
  OPENED: "success",
  FAILED: "danger",
};

const channelLabels: Record<ListDeliveriesChannel, string> = {
  EMAIL: "Email",
  SMS: "SMS",
  IN_APP: "In-app",
};

/**
 * The columns a reader may move and take off, in the order the firm wrote them.
 *
 * <p>The recipient is not among them. A line in this log is read as "what we sent this person", and a row
 * with nobody on it is a subject and a timestamp belonging to anyone.
 */
const MOVABLE: {
  id: string;
  label: string;
  align: "left" | "right";
  nowrap?: boolean;
  tone?: string;
  cell: (row: DeliveryRow) => ReactNode;
}[] = [
  {
    id: "subject",
    label: "Subject",
    align: "left",
    tone: "text-ink-soft",
    cell: (row) => (
      <>
        {row.subject}
        {/* Under the subject rather than beside the status: what the provider refused is about this one
            send, and the status it sits under says only that something went wrong. */}
        {row.errorDetail && <span className="mt-0.5 block text-xs text-red-700">{row.errorDetail}</span>}
      </>
    ),
  },
  {
    id: "channel",
    label: "Channel",
    align: "left",
    tone: "text-ink-soft",
    cell: (row) => channelLabels[row.channel],
  },
  {
    id: "queued",
    label: "Queued",
    align: "left",
    nowrap: true,
    tone: "text-ink-soft tabular-nums",
    cell: (row) => formatDateTime(row.queuedAt),
  },
  {
    id: "attempts",
    label: "Tries",
    align: "right",
    tone: "tabular-nums",
    cell: (row) => row.attempts,
  },
  {
    id: "status",
    label: "Status",
    align: "left",
    cell: (row) => <Badge tone={statusTones[row.status]}>{statusLabels[row.status]}</Badge>,
  },
];

/** Every notification the platform sent, and what became of it (#99). */
export function DeliveriesPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<ListDeliveriesStatus | "">("");
  const [channel, setChannel] = useState<ListDeliveriesChannel | "">("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);

  // A different page size starts again at the first page, so the rows on screen always match the summary.
  function changePageSize(size: number) {
    setPageSize(size);
    setPage(0);
  }
  const recipient = useDebouncedValue(search.trim());

  const filters: ListDeliveriesParams = {
    recipient: recipient || undefined,
    status: status || undefined,
    channel: channel || undefined,
    page,
    size: pageSize,
  };
  const deliveries = useListDeliveries<DeliveryPage, ApiError>(filters, {
    query: { placeholderData: keepPreviousData },
  });

  // Read before the refusal below. How this reader has arranged the log is a thing about them and not
  // about whether the fetch came back, and a hook React sees on one render and not the next is a hook it
  // cannot keep in order.
  const view = useTableView("notification-log", MOVABLE.map((one) => one.id));
  const drag = useColumnDrag(view);
  const byId = new Map(MOVABLE.map((one) => [one.id, one]));
  const shownColumns = view.shown.map((id) => byId.get(id)).filter((one) => one !== undefined);

  if (deliveries.isError) {
    return <Alert tone="danger">{deliveries.error.message}</Alert>;
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-[1.625rem] font-bold">Notification log</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Every email the platform sent, with what became of it. Delivered and Opened arrive once a mail provider
          reports them back; until then a send is recorded as Sent.
        </p>
      </header>

      {deliveries.data && deliveries.data.failedToday > 0 && (
        <Alert tone="danger">
          {deliveries.data.failedToday} notification{deliveries.data.failedToday === 1 ? "" : "s"} failed in the last 24
          hours. A failure is tried three times before it is given up on.
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
        firstLabel="Everything sent"
      />

      <section className="rounded-2xl border border-line bg-white">
        <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-4">
          <TextInput
            id="delivery-search"
            name="recipient"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(0);
            }}
            placeholder="Search by recipient"
            className="max-w-xs"
            aria-label="Search by recipient"
          />
          <label className="flex items-center gap-2 text-xs text-ink-muted">
            Status
            <SelectInput
              id="delivery-status"
              name="status"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as ListDeliveriesStatus | "");
                setPage(0);
              }}
              className="w-auto pr-8 pl-3"
            >
              <option value="">Any status</option>
              {(Object.keys(statusLabels) as ListDeliveriesStatus[]).map((value) => (
                <option key={value} value={value}>
                  {statusLabels[value]}
                </option>
              ))}
            </SelectInput>
          </label>
          <label className="flex items-center gap-2 text-xs text-ink-muted">
            Channel
            <SelectInput
              id="delivery-channel"
              name="channel"
              value={channel}
              onChange={(event) => {
                setChannel(event.target.value as ListDeliveriesChannel | "");
                setPage(0);
              }}
              className="w-auto pr-8 pl-3"
            >
              <option value="">Any channel</option>
              {(Object.keys(channelLabels) as ListDeliveriesChannel[]).map((value) => (
                <option key={value} value={value}>
                  {channelLabels[value]}
                </option>
              ))}
            </SelectInput>
          </label>
          {/* At the far end of the row, away from the three controls that narrow the list: what the table
              shows is not another filter. */}
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
                <th scope="col" className="py-3 pr-4 pl-5">Recipient</th>
                {shownColumns.map((column, at) => (
                  <th
                    key={column.id}
                    scope="col"
                    {...drag.headingProps(column.id)}
                    className={cn(
                      "cursor-grab touch-none px-4 py-3 select-none",
                      column.align === "right" ? "text-right" : "text-left",
                      column.nowrap && "whitespace-nowrap",
                      at === shownColumns.length - 1 && "pr-5",
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
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {!deliveries.data && (
                <tr>
                  <td colSpan={shownColumns.length + 1} className="px-5 py-8 text-center text-ink-muted">
                    Loading notifications…
                  </td>
                </tr>
              )}
              {deliveries.data?.items.length === 0 && (
                <tr>
                  <td colSpan={shownColumns.length + 1} className="px-5 py-10 text-center text-ink-muted">
                    Nothing matches these filters.
                  </td>
                </tr>
              )}
              {(deliveries.data?.items ?? []).map((delivery) => (
                <tr key={delivery.id}>
                  <td className="py-3 pr-4 pl-5 font-medium">{delivery.recipient}</td>
                  {/* The cells in the order the headings are in, out of the one list that holds both. */}
                  {shownColumns.map((column, at) => (
                    <td
                      key={column.id}
                      className={cn(
                        "px-4 py-3",
                        column.align === "right" && "text-right",
                        column.nowrap && "whitespace-nowrap",
                        at === shownColumns.length - 1 && "pr-5",
                        column.tone,
                      )}
                    >
                      {column.cell(delivery)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {deliveries.data && deliveries.data.totalItems > 0 && (
          <div className="border-t border-line px-5 py-3">
            <Pagination
              page={deliveries.data.page}
              pageSize={deliveries.data.size}
              totalItems={deliveries.data.totalItems}
              onPageChange={setPage}
              pageSizes={PAGE_SIZES}
              onPageSizeChange={changePageSize}
              noun={["notification", "notifications"]}
            />
          </div>
        )}
      </section>
    </div>
  );
}
