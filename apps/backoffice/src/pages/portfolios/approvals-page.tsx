import { ApiError } from "@atomprive/api-client";
import {
  useListClientRequests,
  useListModelChanges,
  useListModelEdits,
  useListProposalsAwaitingMyAnswer,
  type ModelChangePage,
  type ModelEditQueue,
  type MovePlanQueue,
  type ProposalPage,
} from "@atomprive/api-client/backoffice";
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
import { ClientRequestsPage } from "./client-requests-page";
import { ModelChangesPage } from "./model-changes-page";
import { ModelEditsToApprovePage } from "./model-edits-to-approve-page";

/** Which queue is being read. The value is in the address, so a link can point at one. */
export type ApprovalTab =
  | "proposals" | "client-requests" | "model-changes" | "model-sign-off";

type TabSpec = {
  id: ApprovalTab;
  label: string;
  /** What somebody must hold to be offered this one at all. */
  authority: Authority[];
  Panel: () => React.ReactElement;
};

/**
 * The queues, in the order the work reaches them: what the firm advises, then what it changes about a
 * client, then what it changes about a plan.
 *
 * <p>Two of them are gone. Rewriting what a client holds and putting their figures back to an earlier day
 * each replaced every figure at once, which is a larger change than the firm wants anybody making by
 * hand; what a client holds will come from the daily file instead. Money moves between the lines is what
 * is left, and it is answered here as it always was.
 *
 * <p>Each is named for the act rather than for the thing it touches. "Moves" and "Model moves" sat beside
 * each other reading as the same word twice, and the first person to see them had to ask which was which:
 * money moves and a plan is switched, and the two sentences share no verb.
 */
const TABS: TabSpec[] = [
  {
    id: "proposals",
    label: "Proposals",
    authority: READS_PROPOSALS,
    Panel: ProposalsPage,
  },
  {
    id: "client-requests",
    label: "Client requests",
    // The money-move permission, because answering one of these moves the money. It is the queue beside it
    // read the other way round: the asking comes from outside the firm, and the same people answer it.
    authority: ANSWERS_MOVE_PLANS,
    Panel: ClientRequestsPage,
  },
  {
    id: "model-changes",
    label: "Model switch",
    authority: READS_CLIENT_PORTFOLIOS,
    Panel: ModelChangesPage,
  },
  {
    id: "model-sign-off",
    label: "Model edits",
    // Not the money-move permission: a model is shared, so its edit is signed off by somebody who may
    // write the firm's advice rather than by whoever answers for one client.
    authority: ["SEND_PROPOSALS:CHANGE"],
    Panel: ModelEditsToApprovePage,
  },
];

/**
 * How many are waiting in each queue this reader may open.
 *
 * <p>Every one of them is asked for, because the number belongs on the tab rather than inside it: a menu
 * that says one thing is waiting and a screen that makes you open seven tabs to find it has told you
 * nothing you could act on. A queue this reader may not open is not asked for at all, and answers
 * nothing.
 */
function useHowManyAreWaiting(mine: TabSpec[]) {
  const offered = (id: ApprovalTab) => mine.some((one) => one.id === id);
  const proposals = useListProposalsAwaitingMyAnswer<ProposalPage, ApiError>({ page: 0, size: 1 },
    { query: { enabled: offered("proposals"), refetchOnWindowFocus: true } });
  const clientRequests = useListClientRequests<MovePlanQueue, ApiError>(
    { query: { enabled: offered("client-requests"), refetchOnWindowFocus: true } });
  const modelChanges = useListModelChanges<ModelChangePage, ApiError>({ status: "PENDING", page: 0, size: 1 },
    { query: { enabled: offered("model-changes"), refetchOnWindowFocus: true } });
  const modelEdits = useListModelEdits<ModelEditQueue, ApiError>(
    { query: { enabled: offered("model-sign-off"), refetchOnWindowFocus: true } });
  return {
    proposals: proposals.data?.totalItems ?? 0,
    "client-requests": (clientRequests.data?.waiting ?? []).length,
    // What is waiting on THIS reader, not what they can see. The total counted every pending request
    // their scope reached, including ones somebody else answers — so a tab read "1" over a row the
    // reader had no button on.
    "model-changes": modelChanges.data?.waitingOnYou ?? 0,
    "model-sign-off": (modelEdits.data?.waiting ?? []).length,
  } as Record<ApprovalTab, number>;
}

/**
 * Everything waiting on somebody, on one screen.
 *
 * <p>The queues sat as entries down the menu, and two of them sat nowhere at all — they were never
 * written into a menu group, so the only way to reach them was a notification link or a typed address.
 * They are one job done over and over: something is waiting, somebody other than whoever raised it says
 * yes or no. So they are one screen, and which queue is a tab.
 *
 * <p>Client requests is the one that runs the other way. Everywhere else the firm asks and whoever looks
 * after the client answers; there the client asked, and the firm answers. It is the same job for all that
 * — something is waiting on somebody — which is why it belongs on this screen rather than its own.
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
  const waiting = useHowManyAreWaiting(mine);

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
      <h1 className="text-[1.625rem] font-bold">Approvals</h1>

      {/* Scrolls rather than wraps: a second row would break the line the tabs sit on.
          Above the lead, not below it. The lead belongs to whichever tab is open and they are not the
          same length — one wraps to two lines, the next fits on one — so with the lead between the
          heading and the tabs, the whole row jumped up and down as somebody read across it. The tabs now
          sit at one height whatever is chosen, which is what a row of tabs is for. */}
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
            {/* How many are in it. The menu says one thing is waiting; without this the reader opens
                seven tabs to find out which. */}
            {(waiting[one.id] ?? 0) > 0 && (
              <span className={cn(
                "ml-2 rounded-full px-1.5 py-0.5 text-2xs tabular-nums",
                tab.id === one.id ? "bg-primary-600 text-on-accent" : "bg-slate-200 text-ink-soft",
              )}>
                {waiting[one.id]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* A paragraph explaining each queue stood here. It said what the rows already say — who answers a
          proposal is on the row, and what saying yes does is on the button — and it pushed the work itself
          below the fold on a screen somebody opens to do that work. */}

      {/* Keyed by tab, so leaving one queue and coming back opens it afresh rather than on whatever was
          typed into the one before it. */}
      <Panel key={tab.id} />
    </div>
  );
}
