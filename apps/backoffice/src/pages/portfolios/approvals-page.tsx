import { cn } from "@atomprive/ui";
import { useSearchParams } from "react-router";
import { useStaffUser } from "../../auth/session";
import {
  ANSWERS_MOVE_PLANS,
  hasAnyAuthority,
  READS_CLIENT_PORTFOLIOS,
  READS_PROPOSALS,
  type Authority,
} from "../../lib/permissions";
import { ProposalsPage } from "../advisor/proposals-page";
import { AllocationsToApprovePage } from "./allocations-to-approve-page";
import { ModelChangesPage } from "./model-changes-page";
import { ModelEditsToApprovePage } from "./model-edits-to-approve-page";
import { MovesToApprovePage } from "./moves-to-approve-page";
import { RestoresToApprovePage } from "./restores-to-approve-page";

/** Which queue is being read. The value is in the address, so a link can point at one. */
export type ApprovalTab =
  | "proposals" | "model-changes" | "moves" | "restores" | "figures" | "model-sign-off";

type TabSpec = {
  id: ApprovalTab;
  label: string;
  lead: string;
  /** What somebody must hold to be offered this one at all. */
  authority: Authority[];
  Panel: () => React.ReactElement;
};

/**
 * The six queues, in the order the work reaches them: what the firm advises, then what it changes about
 * a client, then what it changes about a plan.
 *
 * <p>Each is named for the act rather than for the thing it touches. "Moves" and "Model moves" sat beside
 * each other reading as the same word twice, and the first person to see them had to ask which was which:
 * money moves and a plan is switched, and the two sentences share no verb.
 */
const TABS: TabSpec[] = [
  {
    id: "proposals",
    label: "Proposals",
    lead: "The firm's advice to its clients, and what became of each piece of it. Advisory only — the "
      + "platform never places a trade.",
    authority: READS_PROPOSALS,
    Panel: ProposalsPage,
  },
  {
    id: "moves",
    label: "Money moves",
    lead: "Plans to move money between what a client holds. Nothing has moved: saying yes is what moves it.",
    authority: ANSWERS_MOVE_PLANS,
    Panel: MovesToApprovePage,
  },
  {
    id: "figures",
    label: "Net AUM",
    lead: "Asks to rewrite what a client holds, owes and owns outright. Nothing has changed: saying yes "
      + "is what writes them.",
    authority: ANSWERS_MOVE_PLANS,
    Panel: AllocationsToApprovePage,
  },
  {
    id: "restores",
    label: "Restores",
    lead: "Asks to put a client's figures back to a version they stood at. Nothing has changed: saying "
      + "yes is what puts them back.",
    authority: ANSWERS_MOVE_PLANS,
    Panel: RestoresToApprovePage,
  },
  {
    id: "model-changes",
    label: "Model switch",
    lead: "Asking for a client to be measured against a different plan. Saying yes is what moves them.",
    authority: READS_CLIENT_PORTFOLIOS,
    Panel: ModelChangesPage,
  },
  {
    id: "model-sign-off",
    label: "Model edits",
    lead: "Changes to a plan clients are measured against. Nothing has changed: saying yes is what writes "
      + "it, for every client on the plan at once.",
    // Not the money-move permission: a model is shared, so its edit is signed off by somebody who may
    // write the firm's advice rather than by whoever answers for one client.
    authority: ["SEND_PROPOSALS:CHANGE"],
    Panel: ModelEditsToApprovePage,
  },
];

/**
 * Everything waiting on somebody, on one screen.
 *
 * <p>Six queues sat as six entries down the menu, and two of them sat nowhere at all — they were never
 * written into a menu group, so the only way to reach the figures queue and the model sign-off was a
 * notification link or a typed address. They are one job done six ways: something is waiting, somebody
 * other than whoever raised it says yes or no. So they are one screen, and which queue is a tab.
 *
 * <p>Tabs rather than a filter, because unlike the states inside one queue these are not readings of the
 * same list — a proposal and a restore have nothing in common to put in one table.
 *
 * <p>Only the tabs this reader may open are drawn. The three queues sit behind three different
 * permissions, and a tab that answers "you cannot see this" is worse than no tab.
 */
export function ApprovalsPage() {
  const user = useStaffUser();
  const [params, setParams] = useSearchParams();
  const mine = TABS.filter((one) => hasAnyAuthority(user, ...one.authority));

  const asked = params.get("queue");
  const tab = mine.find((one) => one.id === asked) ?? mine[0];

  function choose(id: ApprovalTab) {
    // Replaced rather than pushed: the tabs are one screen read six ways, and Back should leave the
    // screen rather than walk through every tab somebody glanced at. The queue's own filter, which lives
    // in `tab`, goes with it — it belongs to the queue that is being left.
    const next = new URLSearchParams(params);
    next.set("queue", id);
    next.delete("tab");
    setParams(next, { replace: true });
  }

  if (!tab) {
    return null;
  }
  const Panel = tab.Panel;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-[1.625rem] font-bold">Approvals</h1>
        <p className="mt-1 max-w-prose text-sm text-ink-muted">{tab.lead}</p>
      </header>

      {/* Scrolls rather than wraps: a second row would break the line the tabs sit on. */}
      <div role="tablist" aria-label="What is waiting" className="flex gap-1 overflow-x-auto border-b border-line">
        {mine.map((one) => (
          <button
            key={one.id}
            type="button"
            role="tab"
            aria-selected={tab.id === one.id}
            onClick={() => choose(one.id)}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-semibold whitespace-nowrap transition-colors",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600",
              tab.id === one.id
                ? "border-primary-600 text-primary-700"
                : "border-transparent text-ink-muted hover:text-ink",
            )}
          >
            {one.label}
          </button>
        ))}
      </div>

      {/* Keyed by tab, so leaving one queue and coming back opens it afresh rather than on whatever was
          typed into the one before it. */}
      <Panel key={tab.id} />
    </div>
  );
}
