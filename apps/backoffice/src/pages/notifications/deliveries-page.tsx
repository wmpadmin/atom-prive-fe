import { ApiError } from "@atomprive/api-client";
import {
  useListDeliveries,
  type DeliveryPage,
  type ListDeliveriesChannel,
  type ListDeliveriesParams,
  type ListDeliveriesStatus,
} from "@atomprive/api-client/backoffice";
import { Alert, Badge, Pagination, SelectInput, TextInput } from "@atomprive/ui";
import { keepPreviousData } from "@tanstack/react-query";
import { useState } from "react";
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
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                <th scope="col" className="py-3 pr-4 pl-5">Recipient</th>
                <th scope="col" className="px-4 py-3">Subject</th>
                <th scope="col" className="px-4 py-3">Channel</th>
                <th scope="col" className="px-4 py-3">Queued</th>
                <th scope="col" className="px-4 py-3 text-right">Tries</th>
                <th scope="col" className="py-3 pr-5 pl-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {!deliveries.data && (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-ink-muted">Loading notifications…</td>
                </tr>
              )}
              {deliveries.data?.items.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-ink-muted">
                    Nothing matches these filters.
                  </td>
                </tr>
              )}
              {(deliveries.data?.items ?? []).map((delivery) => (
                <tr key={delivery.id}>
                  <td className="py-3 pr-4 pl-5 font-medium">{delivery.recipient}</td>
                  <td className="px-4 py-3 text-ink-soft">
                    {delivery.subject}
                    {delivery.errorDetail && <span className="mt-0.5 block text-xs text-red-700">{delivery.errorDetail}</span>}
                  </td>
                  <td className="px-4 py-3 text-ink-soft">{channelLabels[delivery.channel]}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-ink-soft tabular-nums">{formatDateTime(delivery.queuedAt)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{delivery.attempts}</td>
                  <td className="py-3 pr-5 pl-4">
                    <Badge tone={statusTones[delivery.status]}>{statusLabels[delivery.status]}</Badge>
                  </td>
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
