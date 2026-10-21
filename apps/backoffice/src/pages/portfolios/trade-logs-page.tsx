import { QueueActionsBox, QueueActionsFrame } from "../../components/queue-actions";
import { ListPageHeader } from "../../components/record-list";
import { ProposalsPage } from "../advisor/proposals-page";

/**
 * Every bulk rebalance the firm has asked for, and what became of it.
 *
 * <p>The trade blotter stood here: orders raised, passed by Compliance, placed by Operations. Bulk
 * rebalancing was the only thing that ever fed it, and it does not feed it any more — it asks the client's
 * own manager instead. So what is left to keep is the record of those askings, which is this.
 *
 * <p>The proposals list, asked for the other kind. Two screens rather than one because the two are
 * different acts: agreeing to the firm's own advice moves the money there and then, and agreeing to a
 * rebalance moves nothing — it opens the client's portfolio to the desk, who place it themselves. Read in
 * one list, half the rows would sit under words that do not describe them.
 *
 * <p>The same table, the same filters, and the same screen behind each row — including the one the
 * relationship manager answers on. A reader works these the way they work the other list, because there
 * is nothing about a rebalance that makes the reading different.
 */
export function TradeLogsPage() {
  return (
    // Named, like every other screen in the menu. Without a heading of its own this one opened on a row of
    // buttons and a filter line, with nothing to say which of the two lists somebody was looking at.
    <QueueActionsFrame>
      <div className="space-y-5">
        <ListPageHeader
          title="Trade logs"
          lead="Every bulk rebalance the firm has asked for, and what became of it."
        >
          {/* The list's own buttons, lifted on to this line rather than left in a row of their own. */}
          <QueueActionsBox className="flex flex-wrap items-center gap-2" />
        </ListPageHeader>

        <ProposalsPage fromRebalance />
      </div>
    </QueueActionsFrame>
  );
}
