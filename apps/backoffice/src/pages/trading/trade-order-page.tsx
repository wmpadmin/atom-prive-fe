import { ApiError } from "@atomprive/api-client";
import {
  useCancelTradeOrder,
  useGetTradeOrder,
  useListCustomers,
  useRaiseTradeOrder,
  useReviewTradeOrder,
  useSendTradeOrder,
  useSubmitTradeOrder,
  useTradeOrderExecuted,
  useTradeOrderSettled,
  type CustomerPage,
  type TradeOrderRow,
} from "@atomprive/api-client/backoffice";
import {
  Alert,
  Badge,
  Button,
  Dialog,
  Field,
  SelectInput,
  TextArea,
  TextInput,
  describedBy,
} from "@atomprive/ui";
import { ChevronLeft } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useStaffUser } from "../../auth/session";
import { noErrors, toFormErrors, type FormErrors } from "../../lib/api-errors";
import { asFigure } from "../../lib/figures";
import { formatDateTime } from "../../lib/labels";
import { hasAnyAuthority, PLACES_ORDERS, RAISES_ORDERS, REVIEWS_ORDERS } from "../../lib/permissions";
import { useAssetClasses } from "../portfolios/asset-classes";
import { orderAmount, orderStatusLabels, orderStatusTones, waitingOn } from "./trade-order-labels";

/** One step of the order's life, as the trail reads it. */
function Step({ what, when, who, note }: { what: string; when: string | null; who?: string | null; note?: string | null }) {
  if (!when) return null;
  return (
    <li className="border-l-2 border-line py-1.5 pl-4">
      <p className="text-sm font-medium text-ink">
        {what}
        {who && <span className="font-normal text-ink-muted"> · {who}</span>}
      </p>
      <p className="text-xs text-ink-muted">{formatDateTime(when)}</p>
      {note && <p className="mt-1 text-sm text-ink-soft">{note}</p>}
    </li>
  );
}

/**
 * One trade order: what it says, where it is, and whatever this person's job is to do next.
 *
 * <p>Three teams read this screen and each may do exactly one thing to it. The buttons shown are the ones
 * this person may actually press — a button that refuses on click teaches people to distrust the screen.
 */
export function TradeOrderPage() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const user = useStaffUser();
  const writing = orderId === undefined;
  const [errors, setErrors] = useState<FormErrors>(noErrors);
  const [answering, setAnswering] = useState<"refuse" | "cancel" | null>(null);
  const [comment, setComment] = useState("");
  const [amount, setAmount] = useState("");

  const { inUse, names } = useAssetClasses();
  const clients = useListCustomers<CustomerPage, ApiError>({ size: 100 });
  const order = useGetTradeOrder<TradeOrderRow, ApiError>(orderId ?? "", { query: { enabled: !writing } });

  const onError = (caught: ApiError) => setErrors(toFormErrors(caught));
  const moved = () => {
    setErrors(noErrors);
    setAnswering(null);
    setComment("");
    void order.refetch();
  };
  const raise = useRaiseTradeOrder<ApiError>({
    mutation: { onSuccess: (made) => navigate(`/trade-orders/${made.id}`, { replace: true }), onError },
  });
  const submit = useSubmitTradeOrder<ApiError>({ mutation: { onSuccess: moved, onError } });
  const review = useReviewTradeOrder<ApiError>({ mutation: { onSuccess: moved, onError } });
  const send = useSendTradeOrder<ApiError>({ mutation: { onSuccess: moved, onError } });
  const executed = useTradeOrderExecuted<ApiError>({ mutation: { onSuccess: moved, onError } });
  const settled = useTradeOrderSettled<ApiError>({ mutation: { onSuccess: moved, onError } });
  const cancel = useCancelTradeOrder<ApiError>({ mutation: { onSuccess: moved, onError } });
  const busy =
    raise.isPending || submit.isPending || review.isPending || send.isPending || executed.isPending ||
    settled.isPending || cancel.isPending;

  if (!writing && !order.data) {
    return order.isError ? (
      <Alert tone="danger">
        {order.error.status === 404 ? "That order doesn't exist." : order.error.message}
      </Alert>
    ) : (
      <p className="text-sm text-ink-muted">Loading the order…</p>
    );
  }

  const found = order.data;
  const mine = found?.raisedBy === user.id;
  const mayRaise = hasAnyAuthority(user, ...RAISES_ORDERS);
  // Whoever raised it cannot be the one who passes it, so the button is not offered to them either.
  const mayReview = hasAnyAuthority(user, ...REVIEWS_ORDERS) && !mine;
  const mayPlace = hasAnyAuthority(user, ...PLACES_ORDERS);

  function raiseIt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    raise.mutate({
      data: {
        customerId: String(form.get("customerId")),
        assetClass: String(form.get("assetClass")),
        holding: String(form.get("holding")).trim() || null,
        side: String(form.get("side")) as "BUY" | "SELL",
        amount: Number(amount),
        currency: String(form.get("currency")).trim().toUpperCase() || null,
        reason: String(form.get("reason")).trim() || null,
        positionId: null,
      },
    });
  }

  if (writing) {
    return (
      <div className="space-y-6">
        <Link to="/trade-orders" className="inline-flex items-center gap-1 text-sm text-ink-soft hover:text-ink">
          <ChevronLeft className="size-4" aria-hidden="true" />
          Trade blotter
        </Link>
        <h1 className="text-[1.625rem] font-bold">Raise an order</h1>

        <form onSubmit={raiseIt} className="space-y-5 rounded-2xl border border-line bg-white p-6">
          {errors.form && <Alert tone="danger">{errors.form}</Alert>}
          <Field id="order-client" label="Client" required error={errors.fields.customerId}>
            <SelectInput {...describedBy("order-client", errors.fields.customerId)} id="order-client" name="customerId" required>
              <option value="" disabled>
                Choose a client
              </option>
              {(clients.data?.items ?? []).map((one) => (
                <option key={one.id} value={one.id}>
                  {one.fullName} · {one.code}
                </option>
              ))}
            </SelectInput>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="order-class" label="Asset class" required error={errors.fields.assetClass}>
              <SelectInput id="order-class" name="assetClass" required>
                {inUse.map((one) => (
                  <option key={one.code} value={one.code}>
                    {names[one.code] ?? one.code}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Field id="order-holding" label="Holding" hint="The name, where the order is in one." error={errors.fields.holding}>
              <TextInput id="order-holding" name="holding" placeholder="Apple Inc" />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-[8rem_1fr_12rem]">
            <Field id="order-side" label="Side" required>
              <SelectInput id="order-side" name="side" required>
                <option value="BUY">Buy</option>
                <option value="SELL">Sell</option>
              </SelectInput>
            </Field>
            <Field id="order-amount" label="Amount" required error={errors.fields.amount}>
              <TextInput
                {...describedBy("order-amount", errors.fields.amount)}
                id="order-amount"
                inputMode="decimal"
                value={amount}
                required
                onChange={(event) => setAmount(asFigure(event.target.value, amount))}
              />
            </Field>
            {/* Left alone, the order is written in the currency the client's portfolio is held in. A fixed
                default here would quietly write a rupee client's trades in dollars. */}
            <Field
              id="order-currency"
              label="Currency"
              hint="The client's own if left empty."
              error={errors.fields.currency}
            >
              <TextInput
                id="order-currency"
                name="currency"
                maxLength={3}
                placeholder="INR"
                className="uppercase"
              />
            </Field>
          </div>

          <Field id="order-reason" label="Why" hint="What it is for, in the firm's own words." error={errors.fields.reason}>
            <TextArea id="order-reason" name="reason" rows={3} placeholder="Putting the equity sleeve back to its target." />
          </Field>

          <div className="flex items-center justify-between gap-3 border-t border-line pt-4">
            <p className="text-xs text-ink-muted">
              Saved as a draft. Nothing goes to Compliance until you put it to them.
            </p>
            <Button type="submit" disabled={busy || amount.trim() === ""}>
              {raise.isPending ? "Saving…" : "Save the draft"}
            </Button>
          </div>
        </form>
      </div>
    );
  }

  const next = waitingOn(found!.status);
  return (
    <div className="space-y-6">
      <Link to="/trade-orders" className="inline-flex items-center gap-1 text-sm text-ink-soft hover:text-ink">
        <ChevronLeft className="size-4" aria-hidden="true" />
        Trade blotter
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[1.625rem] font-bold">{found!.reference}</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {found!.side === "BUY" ? "Buy" : "Sell"} {orderAmount(found!.amount, found!.currency)} ·{" "}
            {found!.holding ?? names[found!.assetClass] ?? found!.assetClass} · {found!.clientName}
          </p>
        </div>
        <div className="text-right">
          <Badge tone={orderStatusTones[found!.status]}>{orderStatusLabels[found!.status]}</Badge>
          {next && <p className="mt-1 text-xs text-ink-muted">{next}</p>}
        </div>
      </header>

      {errors.form && <Alert tone="danger">{errors.form}</Alert>}

      {found!.status === "PENDING_REVIEW" && mine && (
        <Alert tone="info">
          This is yours, so somebody else passes it. A trade order is passed by somebody other than whoever
          raised it.
        </Alert>
      )}

      {found!.reason && (
        <section className="rounded-2xl border border-line bg-white px-6 py-5">
          <h2 className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">Why</h2>
          <p className="mt-2 text-sm leading-6 whitespace-pre-line text-ink">{found!.reason}</p>
        </section>
      )}

      <section className="rounded-2xl border border-line bg-white px-6 py-5">
        <h2 className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">What has happened</h2>
        <ol className="mt-3 space-y-1">
          <Step what="Raised" when={found!.raisedAt} who={found!.raisedByName} />
          <Step
            what={found!.status === "REJECTED" ? "Refused by Compliance" : "Passed by Compliance"}
            when={found!.reviewedAt}
            who={found!.reviewedByName}
            note={found!.reviewComment}
          />
          <Step what="Sent to the bank" when={found!.sentAt} />
          <Step what="Done" when={found!.executedAt} />
          <Step what="Settled" when={found!.settledAt} />
          <Step what="Stopped" when={found!.cancelledAt} note={found!.cancelledReason} />
        </ol>
      </section>

      <div className="flex flex-wrap justify-end gap-3">
        {found!.status === "DRAFT" && mayRaise && (
          <>
            <Button variant="secondary" disabled={busy} onClick={() => setAnswering("cancel")}>
              Stop it
            </Button>
            <Button disabled={busy} onClick={() => submit.mutate({ id: orderId! })}>
              {submit.isPending ? "Putting it…" : "Put it to Compliance"}
            </Button>
          </>
        )}
        {found!.status === "PENDING_REVIEW" && mayReview && (
          <>
            <Button variant="secondary" disabled={busy} onClick={() => setAnswering("refuse")}>
              Refuse it
            </Button>
            <Button disabled={busy} onClick={() => review.mutate({ id: orderId!, data: { passed: true, comment: null } })}>
              {review.isPending ? "Passing…" : "Pass it"}
            </Button>
          </>
        )}
        {found!.status === "APPROVED" && mayPlace && (
          <>
            <Button variant="secondary" disabled={busy} onClick={() => setAnswering("cancel")}>
              Stop it
            </Button>
            <Button disabled={busy} onClick={() => send.mutate({ id: orderId! })}>
              {send.isPending ? "Sending…" : "Sent to the bank"}
            </Button>
          </>
        )}
        {found!.status === "SENT" && mayPlace && (
          <Button disabled={busy} onClick={() => executed.mutate({ id: orderId! })}>
            {executed.isPending ? "Recording…" : "The bank has done it"}
          </Button>
        )}
        {found!.status === "EXECUTED" && mayPlace && (
          <Button disabled={busy} onClick={() => settled.mutate({ id: orderId! })}>
            {settled.isPending ? "Recording…" : "It has settled"}
          </Button>
        )}
      </div>

      <Dialog
        open={answering === "refuse"}
        title="Refuse this order?"
        onClose={() => setAnswering(null)}
      >
        <div className="space-y-4">
          <p className="text-sm text-ink-muted">It goes no further, and whoever raised it sees what you write here.</p>
          <Field id="refuse-comment" label="What is wrong with it?" required error={errors.fields.comment}>
            <TextArea id="refuse-comment" rows={3} value={comment} onChange={(event) => setComment(event.target.value)} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setAnswering(null)}>
              Cancel
            </Button>
            <Button
              disabled={busy || comment.trim() === ""}
              onClick={() => review.mutate({ id: orderId!, data: { passed: false, comment } })}
            >
              {review.isPending ? "Refusing…" : "Refuse it"}
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog open={answering === "cancel"} title="Stop this order?" onClose={() => setAnswering(null)}>
        <div className="space-y-4">
          <p className="text-sm text-ink-muted">
            It goes no further. Once an order has gone to the bank it is theirs to unwind, not something to
            stop here.
          </p>
          <Field id="cancel-reason" label="Why" required error={errors.fields.reason}>
            <TextArea id="cancel-reason" rows={3} value={comment} onChange={(event) => setComment(event.target.value)} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setAnswering(null)}>
              Keep it
            </Button>
            <Button
              disabled={busy || comment.trim() === ""}
              onClick={() => cancel.mutate({ id: orderId!, data: { reason: comment } })}
            >
              {cancel.isPending ? "Stopping…" : "Stop it"}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
