import { ApiError } from "@atomprive/api-client";
import {
  useCancelTradeOrders,
  useListTradeOrders,
  useReviewTradeOrders,
  useSendTradeOrders,
  useSubmitTradeOrders,
  useTradeOrdersExecuted,
  useTradeOrdersSettled,
  type OrdersMoved,
  type TradeOrderPage,
  type TradeOrderRowStatus,
} from "@atomprive/api-client/backoffice";
import { Alert, Avatar, Badge, Button, Dialog, Field, Pagination, TextArea, cn } from "@atomprive/ui";
import { keepPreviousData } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { useStaffUser } from "../../auth/session";
import { formatDate } from "../../lib/labels";
import { useAssetClasses } from "../portfolios/asset-classes";
import { DEFAULT_PAGE_SIZE, PAGE_SIZES } from "../../lib/page-sizes";
import { hasAnyAuthority, PLACES_ORDERS, RAISES_ORDERS, REVIEWS_ORDERS } from "../../lib/permissions";
import { orderAmount, orderStatusLabels, orderStatusTones, waitingOn } from "./trade-order-labels";

/** The tabs across the top. "Open" is everything still going somewhere, not a state of its own. */
type Tab = "open" | "all" | TradeOrderRowStatus;

const TABS: { id: Tab; label: string }[] = [
  { id: "open", label: "Open" },
  { id: "DRAFT", label: "Drafts" },
  { id: "PENDING_REVIEW", label: "With Compliance" },
  { id: "APPROVED", label: "Passed" },
  { id: "SENT", label: "At the bank" },
  { id: "EXECUTED", label: "Done" },
  { id: "SETTLED", label: "Settled" },
  { id: "REJECTED", label: "Refused" },
  { id: "CANCELLED", label: "Stopped" },
  { id: "all", label: "Everything" },
];

/**
 * The trade blotter: every order the firm has raised and how far along each is.
 *
 * <p>Read by three teams who each do a different thing to an order, so every row says whose move it is next
 * rather than leaving each of them to assume it is one of the others'.
 */
export function TradeBlotterPage() {
  const navigate = useNavigate();
  const user = useStaffUser();
  const [tab, setTab] = useState<Tab>("open");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);
  const mayRaise = hasAnyAuthority(user, ...RAISES_ORDERS);
  const mayReview = hasAnyAuthority(user, ...REVIEWS_ORDERS);
  const mayPlace = hasAnyAuthority(user, ...PLACES_ORDERS);
  // An order with no named holding is read by its class, and the firm's own name for it is the one it uses.
  const { names } = useAssetClasses();

  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [asking, setAsking] = useState<"refuse" | "stop" | null>(null);
  const [reason, setReason] = useState("");
  const [done, setDone] = useState<OrdersMoved | null>(null);
  const [whatMoved, setWhatMoved] = useState("");

  const orders = useListTradeOrders<TradeOrderPage, ApiError>(
    {
      status: tab === "open" || tab === "all" ? undefined : tab,
      // "Open" is asked of the server, not sieved out of a page here: a desk with a year of settled orders
      // behind it would otherwise open on a page with three rows on it and no way to reach the rest.
      open: tab === "open",
      page,
      size: pageSize,
    },
    { query: { placeholderData: keepPreviousData } },
  );

  const stepped = (said: string) => ({
    mutation: {
      onSuccess: (result: OrdersMoved) => {
        setDone(result);
        setWhatMoved(said);
        setChosen(new Set());
        setAsking(null);
        setReason("");
        void orders.refetch();
      },
    },
  });
  const putToCompliance = useSubmitTradeOrders<ApiError>(stepped("put to Compliance"));
  const answer = useReviewTradeOrders<ApiError>(stepped("answered"));
  const sendToBank = useSendTradeOrders<ApiError>(stepped("sent to the bank"));
  const markDone = useTradeOrdersExecuted<ApiError>(stepped("written down as done"));
  const markSettled = useTradeOrdersSettled<ApiError>(stepped("written down as settled"));
  const stop = useCancelTradeOrders<ApiError>(stepped("stopped"));
  const working =
    putToCompliance.isPending || answer.isPending || sendToBank.isPending || markDone.isPending ||
    markSettled.isPending || stop.isPending;

  if (orders.isError) {
    return <Alert tone="danger">{orders.error.message}</Alert>;
  }
  const counts = orders.data?.counts;
  const rows = orders.data?.items ?? [];
  const countFor: Partial<Record<Tab, number | undefined>> = {
    open: counts?.open,
    all: counts?.all,
    DRAFT: counts?.draft,
    PENDING_REVIEW: counts?.pendingReview,
    APPROVED: counts?.approved,
    SENT: counts?.sent,
    EXECUTED: counts?.executed,
    SETTLED: counts?.settled,
    REJECTED: counts?.rejected,
    CANCELLED: counts?.cancelled,
  };

  function changeTab(next: Tab) {
    setTab(next);
    setPage(0);
    // A selection belongs to the list it was made from; carrying it to another tab would act on rows
    // nobody is looking at.
    setChosen(new Set());
    setDone(null);
  }

  /**
   * The steps this person may take on this list. On a tab that is one state, only the step that state can
   * take; on a mixed list, whatever their job allows — the server names back anything that could not move.
   */
  const ids = [...chosen];
  const onOneState = tab !== "open" && tab !== "all";
  const allowed = (status: TradeOrderRowStatus) => !onOneState || tab === status;
  const steps = [
    mayRaise && allowed("DRAFT")
      ? { key: "submit", label: "Put to Compliance", run: () => putToCompliance.mutate({ data: { orderIds: ids } }) }
      : null,
    mayReview && allowed("PENDING_REVIEW")
      ? { key: "pass", label: "Pass", run: () => answer.mutate({ data: { orderIds: ids, passed: true, comment: null } }) }
      : null,
    mayReview && allowed("PENDING_REVIEW")
      ? { key: "refuse", label: "Refuse", run: () => setAsking("refuse") }
      : null,
    mayPlace && allowed("APPROVED")
      ? { key: "send", label: "Send to the bank", run: () => sendToBank.mutate({ data: { orderIds: ids } }) }
      : null,
    mayPlace && allowed("SENT")
      ? { key: "done", label: "Mark done", run: () => markDone.mutate({ data: { orderIds: ids } }) }
      : null,
    mayPlace && allowed("EXECUTED")
      ? { key: "settled", label: "Mark settled", run: () => markSettled.mutate({ data: { orderIds: ids } }) }
      : null,
    (mayRaise || mayReview) && (!onOneState || ["DRAFT", "PENDING_REVIEW", "APPROVED"].includes(tab))
      ? { key: "stop", label: "Stop", run: () => setAsking("stop") }
      : null,
  ].filter((one) => one !== null);

  const choosable = rows.filter((one) => one.status !== "SETTLED" && one.status !== "CANCELLED" && one.status !== "REJECTED");
  const allChosen = choosable.length > 0 && choosable.every((one) => chosen.has(one.id));

  function toggle(id: string) {
    const next = new Set(chosen);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setChosen(next);
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[1.625rem] font-bold">Trade blotter</h1>
          <p className="mt-1 max-w-prose text-sm text-ink-muted">
            Every order the firm has raised, and how far along each is. Raised by whoever manages the
            portfolio, passed by Compliance, placed by Operations — three people, never one. The platform
            places nothing itself.
          </p>
        </div>
        {mayRaise && (
          <Link to="/trade-orders/new">
            <Button>
              <Plus aria-hidden="true" />
              Raise an order
            </Button>
          </Link>
        )}
      </header>

      <div role="tablist" aria-label="Trade orders" className="flex flex-wrap gap-2">
        {TABS.map((one) => (
          <button
            key={one.id}
            type="button"
            role="tab"
            aria-selected={tab === one.id}
            onClick={() => changeTab(one.id)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600",
              tab === one.id
                ? "border-primary-600 bg-primary-600 text-white"
                : "border-line bg-white text-ink-soft hover:text-ink",
            )}
          >
            {one.label}
            {countFor[one.id] !== undefined && (
              <span className="ml-2 tabular-nums opacity-80">{countFor[one.id]}</span>
            )}
          </button>
        ))}
      </div>

      {/* What moved and what did not. A selection is made by eye, so some of it is always out of date. */}
      {done && (
        <Alert tone={done.moved === 0 ? "warning" : "success"}>
          <p>
            {done.moved === 0
              ? `Nothing was ${whatMoved}.`
              : `${done.moved} order${done.moved === 1 ? "" : "s"} ${whatMoved}.`}
          </p>
          {done.skipped.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-sm">
              {done.skipped.map((one) => (
                <li key={one.orderId}>
                  <span className="font-mono font-semibold">{one.reference}</span> — {one.why}
                </li>
              ))}
            </ul>
          )}
        </Alert>
      )}

      {steps.length > 0 && chosen.size > 0 && (
        <div className="sticky top-2 z-10 flex flex-wrap items-center gap-3 rounded-xl border border-primary-200 bg-primary-50 px-4 py-3">
          <span className="text-sm font-semibold">
            {chosen.size} chosen
          </span>
          <button type="button" className="text-sm text-ink-soft underline hover:text-ink" onClick={() => setChosen(new Set())}>
            Clear
          </button>
          <div className="ml-auto flex flex-wrap gap-2">
            {steps.map((step) => (
              <Button
                key={step.key}
                size="sm"
                variant={step.key === "refuse" || step.key === "stop" ? "secondary" : "primary"}
                disabled={working}
                onClick={step.run}
              >
                {step.label}
              </Button>
            ))}
          </div>
        </div>
      )}

      <section className="rounded-2xl border border-line bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                {steps.length > 0 && (
                  <th scope="col" className="py-3 pr-3 pl-5">
                    <input
                      type="checkbox"
                      aria-label="Choose every order on this page that can still move"
                      checked={allChosen}
                      disabled={choosable.length === 0}
                      onChange={() => setChosen(allChosen ? new Set() : new Set(choosable.map((one) => one.id)))}
                    />
                  </th>
                )}
                <th scope="col" className="py-3 pr-4 pl-5">Order</th>
                <th scope="col" className="px-4 py-3">Client</th>
                <th scope="col" className="px-4 py-3">Side</th>
                <th scope="col" className="px-4 py-3 text-right">Amount</th>
                <th scope="col" className="px-4 py-3">Raised by</th>
                <th scope="col" className="px-4 py-3">Raised</th>
                <th scope="col" className="py-3 pr-5 pl-4">Where it is</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {!orders.data && (
                <tr>
                  <td colSpan={steps.length > 0 ? 8 : 7} className="px-5 py-8 text-center text-ink-muted">
                    Loading the blotter…
                  </td>
                </tr>
              )}
              {orders.data && rows.length === 0 && (
                <tr>
                  <td colSpan={steps.length > 0 ? 8 : 7} className="px-5 py-10 text-center text-ink-muted">
                    {tab === "open" ? "Nothing is waiting on anybody." : "Nothing in this tab."}
                  </td>
                </tr>
              )}
              {rows.map((order) => {
                const next = waitingOn(order.status);
                return (
                  <tr
                    key={order.id}
                    onClick={() => void navigate(`/trade-orders/${order.id}`)}
                    className={cn("cursor-pointer hover:bg-slate-50/60", chosen.has(order.id) && "bg-primary-50/40")}
                  >
                    {/* An order that has stopped moving cannot take a step, so it cannot be chosen for one. */}
                    {steps.length > 0 && (
                      <td className="py-3 pr-3 pl-5" onClick={(event) => event.stopPropagation()}>
                        <input
                          type="checkbox"
                          aria-label={`Choose ${order.reference}`}
                          checked={chosen.has(order.id)}
                          disabled={!choosable.some((one) => one.id === order.id)}
                          onChange={() => toggle(order.id)}
                        />
                      </td>
                    )}
                    <td className="py-3 pr-4 pl-5">
                      <Link
                        to={`/trade-orders/${order.id}`}
                        onClick={(event) => event.stopPropagation()}
                        className="font-semibold hover:text-primary-600"
                      >
                        {order.reference}
                      </Link>
                      <span className="block text-xs text-ink-muted">
                        {order.holding ?? names[order.assetClass] ?? order.assetClass}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={order.clientName} />
                        <div>
                          <span className="block">{order.clientName}</span>
                          <span className="block font-mono text-xs text-ink-muted">{order.clientCode}</span>
                        </div>
                      </div>
                    </td>
                    {/* Which way the money goes is the first thing anybody reads, so it is not a word to scan past. */}
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "text-2xs font-semibold tracking-wider uppercase",
                          order.side === "BUY" ? "text-emerald-700" : "text-red-600",
                        )}
                      >
                        {order.side === "BUY" ? "Buy" : "Sell"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium whitespace-nowrap tabular-nums">
                      {orderAmount(order.amount, order.currency)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-ink-soft">{order.raisedByName}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-ink-soft">
                      {formatDate(order.raisedAt)}
                    </td>
                    <td className="py-3 pr-5 pl-4">
                      <Badge tone={orderStatusTones[order.status]}>{orderStatusLabels[order.status]}</Badge>
                      {next && <span className="mt-1 block text-xs text-ink-muted">{next}</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {(orders.data?.totalItems ?? 0) > 0 && (
          <div className="border-t border-line px-5 py-3">
            <Pagination
              page={page}
              pageSize={pageSize}
              totalItems={orders.data?.totalItems ?? 0}
              onPageChange={setPage}
              pageSizes={PAGE_SIZES}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(0);
              }}
              noun={["order", "orders"]}
            />
          </div>
        )}
      </section>

      {/* A refusal says why, and the same words go on every order in the selection. */}
      <Dialog open={asking === "refuse"} title={`Refuse ${chosen.size} order${chosen.size === 1 ? "" : "s"}?`} onClose={() => setAsking(null)}>
        <div className="space-y-4">
          <p className="text-sm text-ink-muted">
            They go no further, and whoever raised them sees what you write here — the same words on each.
          </p>
          <Field id="bulk-refuse" label="What is wrong with them?" required>
            <TextArea id="bulk-refuse" rows={3} value={reason} onChange={(event) => setReason(event.target.value)} />
          </Field>
          {answer.isError && <Alert tone="danger">{answer.error.message}</Alert>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setAsking(null)}>
              Cancel
            </Button>
            <Button
              disabled={reason.trim() === "" || working}
              onClick={() => answer.mutate({ data: { orderIds: ids, passed: false, comment: reason.trim() } })}
            >
              Refuse them
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog open={asking === "stop"} title={`Stop ${chosen.size} order${chosen.size === 1 ? "" : "s"}?`} onClose={() => setAsking(null)}>
        <div className="space-y-4">
          <p className="text-sm text-ink-muted">
            They go no further. Anything already at the bank is theirs to unwind, so it will be left alone and
            named back to you.
          </p>
          <Field id="bulk-stop" label="Why" required>
            <TextArea id="bulk-stop" rows={3} value={reason} onChange={(event) => setReason(event.target.value)} />
          </Field>
          {stop.isError && <Alert tone="danger">{stop.error.message}</Alert>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setAsking(null)}>
              Cancel
            </Button>
            <Button
              disabled={reason.trim() === "" || working}
              onClick={() => stop.mutate({ data: { orderIds: ids, reason: reason.trim() } })}
            >
              Stop them
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
