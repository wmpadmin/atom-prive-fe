import { ApiError } from "@atomprive/api-client";
import { useListClientCashflows, type CashflowList } from "@atomprive/api-client/backoffice";
import { CalendarCheck } from "lucide-react";
import { formatDate } from "../../lib/labels";

/**
 * The day this client joined the firm, printed where every figure on this screen is measured against it.
 *
 * <p>Read, never set. The firm already knows the day, because registering the client is what made the
 * record — and the clients list has been showing it all along. The first draft of this screen asked a
 * portfolio manager to type a second start date beside it, which is the same fact kept twice with
 * nothing keeping the two in step. One question, one answer, and the answer is not this screen's to
 * change: it is changed by correcting the client, not by correcting the return.
 *
 * <p>Printed here rather than left to the clients list because this is the screen where it bites. Below
 * it somebody types the day money moved, and the calendar will not open on anything earlier.
 */
export function ClientJoinedPanel({ customerId }: { customerId: string }) {
  // Off the movements list rather than a request of its own: the same answer the screen below enforces,
  // already fetched, and two reads of one fact is how the two come to disagree.
  const listed = useListClientCashflows<CashflowList, ApiError>(customerId);
  const joined = listed.data?.joinedOn ?? null;

  return (
    <section className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-line bg-white px-5 py-3">
      <CalendarCheck aria-hidden="true" className="size-4 text-ink-muted" />
      <h2 className="text-sm font-semibold text-ink">Joined the firm</h2>
      <p className="text-sm text-ink">
        {listed.isPending ? (
          <span className="text-ink-muted">Reading…</span>
        ) : joined ? (
          <span className="font-medium tabular-nums">{formatDate(joined)}</span>
        ) : (
          <span className="text-ink-muted">Not on file</span>
        )}
      </p>
      {joined && (
        <p className="basis-full text-xs text-ink-muted sm:basis-auto">
          Read off the client's registration, so it is not set here. Nothing about this client can be
          dated before it — money in or out, a review, or a rebalance.
        </p>
      )}
    </section>
  );
}
