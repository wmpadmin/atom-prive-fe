import { ApiError } from "@atomprive/api-client";
import {
  useAnswerTheMovePlan,
  useListMovePlans,
  type MovePlanQueue,
  type MovePlanRow,
} from "@atomprive/api-client/backoffice";
import { Alert, Avatar, Badge, Button, FilterMenu, cn } from "@atomprive/ui";
import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { useStaffUser } from "../../auth/session";
import { formatDateTime } from "../../lib/labels";
import { AnswerDialog } from "./answer-dialog";
import { exactly, figure, named, netted, overItsBand } from "./money-words";
import { QueueBar } from "./queue-bar";
import { hasAuthority } from "../../lib/permissions";

/** What a reader can narrow the list to, in the order a plan passes through them. */
const STATUS_TABS = [
  { id: "PENDING", label: "Waiting for approval" },
  { id: "APPROVED", label: "Approved" },
  { id: "REJECTED", label: "Rejected" },
  { id: "WITHDRAWN", label: "Cancelled" },
  { id: "all", label: "Everything" },
] as const;

type StatusTab = (typeof STATUS_TABS)[number]["id"];

/**
 * One plan waiting on an answer, with the buttons that answer it.
 *
 * <p>Drawn once and used by both ways of reading this screen. Grouped under a client the plan is the same
 * plan, and a row that said one thing in one view and another in the other would be two screens pretending
 * to be one.
 */
export function WaitingPlan({ row, showClient, answering, refusal, onApprove, onTurnDown }: {
  row: MovePlanRow;
  /** False where a card header already names the client, so the name is not said twice in a row. */
  showClient: boolean;
  answering: boolean;
  refusal: string | undefined;
  onApprove: () => void;
  onTurnDown: () => void;
}) {
  const moved = row.legs.some((leg) => leg.figuresMoved);
  const leaves = netted(row.legs);
  return (
    <>
      {/* Who and why across the top, the buttons at the far end of that same line, and the figures given
          the whole width underneath. Held in one flex row with the buttons, the tables were squeezed into
          whatever the text beside them left over — a column of numbers an inch wide in a card a yard
          wide, and two tables that lined up with nothing. */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          {showClient && <Avatar name={row.clientName} />}
          <div className="min-w-0">
            {showClient && (
              <>
                <p className="font-semibold">{row.clientName}</p>
                <p className="font-mono text-xs text-ink-muted">{row.clientCode}</p>
              </>
            )}
            {/* The reason first, because it is the thing whoever asked was told they would be
                judged on. The figures are below it and they can be read. */}
            <p className={cn("text-sm", showClient && "mt-1")}>{row.why}</p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {moved && <Badge tone="warning">Figures have moved</Badge>}
          {leaves.some((line) => overItsBand(line) > 0) && <Badge tone="warning">Past a band</Badge>}
          {row.legs.some((leg) => leg.landsOnAskedByOthers >= 1) && (
            <Badge tone="warning">Another plan lands here</Badge>
          )}
          {row.changedAt && <Badge tone="warning">Changed</Badge>}
          {/* Said, because it is the one reason a plan appears to somebody who does not advise the client.
              Unexplained it reads as somebody else's work turning up in your list. */}
          {row.nobodyCloserCanAnswer && <Badge tone="warning">Nobody else can answer this</Badge>}
          {row.mayAnswer ? (
            <>
              <Button variant="secondary" size="sm" onClick={onTurnDown}>
                Reject
              </Button>
              <Button size="sm" disabled={answering} onClick={onApprove}>
                {answering ? "Moving it…" : "Approve and move it"}
              </Button>
            </>
          ) : (
            <p className="max-w-56 text-xs text-ink-muted">
              You asked for this one, so somebody else answers it.
            </p>
          )}
        </div>
      </div>
      {/* Side by side where there is room, one above the other where there is not. They are two halves of
          one reading — what moves, and what that leaves — and apart they are two lists to hold in the
          head at once. */}
      <div className="mt-4 grid gap-x-10 gap-y-5 lg:grid-cols-2">
        {/* Each column is the same width in both tables, so the names start in one place and the figures
            end in one place whichever table the eye is in. Left to the content they lined up with
            nothing, which is most of what made this unreadable. */}
        <table className="w-full table-fixed text-sm">
          <caption className="border-b border-line pb-2 text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
            What would move
          </caption>
          <colgroup>
            <col className="w-[38%]" />
            <col className="w-[38%]" />
            <col className="w-[24%]" />
          </colgroup>
          <thead>
            <tr className="border-b border-line text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
              <th scope="col" className="py-2 pr-3">Out of</th>
              <th scope="col" className="px-3 py-2">Into</th>
              <th scope="col" className="py-2 pl-3 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {row.legs.map((leg, at) => (
              <tr key={`${leg.fromSubClass ?? ""}-${leg.toSubClass ?? ""}-${at}`} className="align-top">
                <th scope="row" className="py-2.5 pr-3 text-left font-medium break-words text-ink">
                  {named(leg.fromSubClass, leg.fromAssetClass, leg.fromSubSubClass)}
                </th>
                <td className="px-3 py-2.5 break-words text-ink">
                  {named(leg.toSubClass, leg.toAssetClass, leg.toSubSubClass)}
                </td>
                <td className="py-2.5 pl-3 text-right tabular-nums whitespace-nowrap text-ink">
                  {figure(leg.amount)}
                </td>
              </tr>
            ))}
          </tbody>
          {/* Only where there is more than one. A total under a single figure is that figure again. */}
          {row.legs.length > 1 && (
            <tfoot>
              <tr className="border-t-2 border-line font-semibold">
                <th scope="row" colSpan={2} className="py-2.5 pr-3 text-left">Total</th>
                <td className="py-2.5 pl-3 text-right tabular-nums whitespace-nowrap">
                  {figure(row.amount)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
        {/* The question an approver is actually answering is not what moves but what the client is left
            holding, and until now that was arithmetic they did themselves — across legs the screen never
            put side by side. */}
        <table className="w-full table-fixed text-sm">
          <caption className="border-b border-line pb-2 text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
            What it would leave
          </caption>
          <colgroup>
            <col className="w-[38%]" />
            <col className="w-[31%]" />
            <col className="w-[31%]" />
          </colgroup>
          <thead>
            <tr className="border-b border-line text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
              <th scope="col" className="py-2 pr-3">Line</th>
              <th scope="col" className="px-3 py-2 text-right">Holds now</th>
              <th scope="col" className="py-2 pl-3 text-right">Would hold</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {leaves.map((line) => (
              <tr key={line.name} className="align-top">
                <th scope="row" className="py-2.5 pr-3 text-left font-medium break-words text-ink">
                  {line.name}
                  {/* Said against the line, because it is the line whose figure has moved. */}
                  {line.heldWhenRaised !== null && (
                    <span className="mt-0.5 block text-xs font-normal text-amber-700">
                      held {figure(line.heldWhenRaised)} when this was asked for
                    </span>
                  )}
                  {/* The half nothing on this screen could ask before: another plan is waiting to put
                      money in here too. Each was weighed against the same figures and each sits inside
                      the band on its own. */}
                  {line.askedByOthers >= 1 && (
                    <span className="mt-0.5 block text-xs font-normal text-amber-700">
                      another waiting plan would add {figure(line.askedByOthers)} here too
                    </span>
                  )}
                  {overItsBand(line) > 0 && (
                    <span className="mt-0.5 block text-xs font-normal text-amber-700">
                      {figure(overItsBand(line))} past the {figure(line.mayHold ?? 0)} allowed
                    </span>
                  )}
                </th>
                <td className="px-3 py-2.5 text-right tabular-nums whitespace-nowrap text-ink-muted">
                  {figure(line.holdsNow)}
                </td>
                <td className={cn("py-2.5 pl-3 text-right tabular-nums whitespace-nowrap",
                  overItsBand(line) > 0 ? "font-semibold text-amber-700" : "text-ink")}>
                  {figure(line.wouldHold)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* An amount with no denominator beside it could be a rounding error or half the book. The
          currency is said here, once, rather than on every cell of two tables of it. */}
      <p className="mt-4 text-xs text-ink-muted">
        Figures in {row.currency}. {exactly(row.amount, row.currency)} of{" "}
        {exactly(row.underManagement, row.currency)} · Asked by {row.raisedByName} ·{" "}
        {formatDateTime(row.raisedAt)}
      </p>
      {/* Said on the row, because nothing else on the screen can say it: the list is ordered on when a
          plan was first asked for, and changing one deliberately leaves that alone — so an amended plan
          does not move, and somebody who read this an hour ago would answer figures that are no longer
          being asked about. */}
      {row.changedAt && (
        <p className="mt-1 text-xs font-medium text-amber-700">
          Changed since it was asked · {formatDateTime(row.changedAt)}
        </p>
      )}
      {refusal && (
        <div className="mt-3">
          <Alert tone="danger">{refusal}</Alert>
        </div>
      )}
    </>
  );
}

/** One plan nobody is waiting on any more — answered, or taken back before anybody answered it. */
export function DealtWithPlan({ row, showClient }: { row: MovePlanRow; showClient: boolean }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        {showClient && <p className="text-sm font-semibold">{row.clientName}</p>}
        <p className="mt-0.5 text-xs text-ink-muted">
          {exactly(row.amount, row.currency)} · {row.statusSaid}
          {row.decidedByName && ` by ${row.decidedByName}`}
          {row.decidedAt && ` · ${formatDateTime(row.decidedAt)}`}
        </p>
        {/* Who asked for it. The row said who answered and never who asked, which is the half somebody
            goes looking for when a decision is questioned later. */}
        <p className="mt-0.5 text-xs text-ink-muted">
          Asked by {row.raisedByName} · {formatDateTime(row.raisedAt)}
        </p>
        {/* What it actually did. The row carried an amount and a verdict and nothing about the money:
            somebody asking "which move was that, and where did it go?" a day later had the answer in the
            plan's own legs, sent down with every row, and nowhere on the screen they were reading.

            Every leg, not the first. A plan is applied whole or not at all, so one leg of five describes
            a fifth of what happened. */}
        {row.legs.length > 0 && (
          <ul className="mt-1 space-y-0.5 text-xs text-ink-muted">
            {row.legs.map((leg, at) => (
              <li key={`${leg.fromSubClass ?? ""}-${leg.toSubClass ?? ""}-${at}`}>
                <span className="tabular-nums">{figure(leg.amount)}</span>
                {" out of "}
                <span className="text-ink">
                  {named(leg.fromSubClass, leg.fromAssetClass, leg.fromSubSubClass)}
                </span>
                {" into "}
                <span className="text-ink">
                  {named(leg.toSubClass, leg.toAssetClass, leg.toSubSubClass)}
                </span>
              </li>
            ))}
          </ul>
        )}
        {row.why && <p className="mt-0.5 text-xs text-ink-muted">{row.why}</p>}
        {row.decisionNote && <p className="mt-1 text-xs text-ink-muted">{row.decisionNote}</p>}
      </div>
      <Badge tone={row.status === "APPROVED" ? "success" : "neutral"}>{row.statusSaid}</Badge>
    </div>
  );
}

/**
 * The same plans, gathered under the clients they are about.
 *
 * <p>A client has one plan waiting at most, so grouping what is waiting buys nothing on its own — what it
 * buys is the answer beside the asking. Somebody deciding whether to approve a move wants to know what was
 * asked for this client last month and what came of it, and that was two sections apart with everybody
 * else's plans in between.
 *
 * <p>Clients with something waiting come first, because they are the ones the screen is asking about.
 */
function byClient(waiting: MovePlanRow[], dealtWith: MovePlanRow[]) {
  const clients = new Map<string, {
    customerId: string; clientName: string; clientCode: string;
    waiting: MovePlanRow | null; dealtWith: MovePlanRow[];
  }>();
  const of = (row: MovePlanRow) => {
    const had = clients.get(row.customerId);
    if (had) return had;
    const made = {
      customerId: row.customerId, clientName: row.clientName, clientCode: row.clientCode,
      waiting: null as MovePlanRow | null, dealtWith: [] as MovePlanRow[],
    };
    clients.set(row.customerId, made);
    return made;
  };
  // Waiting first, so the order the server sent survives into the order the groups appear in.
  for (const row of waiting) of(row).waiting = row;
  for (const row of dealtWith) of(row).dealtWith.push(row);
  return [...clients.values()].sort((first, second) => {
    if ((first.waiting === null) !== (second.waiting === null)) return first.waiting === null ? 1 : -1;
    return first.clientName.localeCompare(second.clientName);
  });
}

/**
 * Answering a plan to move a client's money.
 *
 * <p>The screen that raises one tells whoever raised it that the person answering is being asked about the
 * reason, not the figures — they can see those. This is where that promise is kept: what the plan does leg
 * by leg, what the client is worth for the amount to be read against, and what each source line holds now
 * beside what it held when the plan was raised.
 *
 * <p>Nothing has moved. Saying yes is what moves it, through exactly the code the holdings screen calls.
 */
export function MovesToApprovePage() {
  const user = useStaffUser();
  // For the wording only, never for whether the screen or its buttons appear. Who may answer which plan is
  // the server's question, and it comes back on every row as mayAnswer — asked there with the same rule the
  // answering itself uses, so a button is never offered that would then be refused.
  const firmWide = hasAuthority(user, "APPROVE_PORTFOLIO_CHANGES:CHANGE");
  const queue = useListMovePlans<MovePlanQueue, ApiError>({
    query: { refetchOnWindowFocus: true },
  });
  // Which way the queue is read lives in the address. Held in the component, coming back from a client's
  // own screen landed on the other one — the link said "back" and went somewhere else.
  const [address, setAddress] = useSearchParams();
  const view: "queue" | "client" = address.get("by") === "client" ? "client" : "queue";
  const setView = (which: "queue" | "client") => {
    const next = new URLSearchParams(address);
    if (which === "queue") next.delete("by");
    else next.set("by", which);
    setAddress(next, { replace: true });
  };
  const [status, setStatus] = useState<StatusTab>("PENDING");
  /** The plan being answered and which way, because both answers are given in the same window now. */
  const [deciding, setDeciding] = useState<{ row: MovePlanRow; approved: boolean } | null>(null);
  const [note, setNote] = useState("");
  const [refused, setRefused] = useState<Record<string, string>>({});
  const answer = useAnswerTheMovePlan<ApiError>({
    mutation: {
      onSuccess: () => {
        setDeciding(null);
        setNote("");
        void queue.refetch();
      },
      // Kept on the row rather than thrown away in a notice that fades. Both refusals this can give —
      // the figures have moved, somebody else has answered it — change what the reader does next, and the
      // server's sentence is the only place the figures in it appear.
      onError: (error, variables) => {
        setRefused((was) => ({ ...was, [variables.id]: error.message }));
        void queue.refetch();
      },
    },
  });

  if (queue.isError) {
    return <Alert tone="danger">{queue.error.message}</Alert>;
  }

  const waiting = queue.data?.waiting ?? [];
  const dealtWith = queue.data?.answered ?? [];
  const mine = waiting.filter((row) => !row.mayAnswer);
  const grouped = byClient(waiting, dealtWith);
  // One list to filter, because a plan is in exactly one state and the two the server sends are only
  // where it put them. Ordered waiting-first so "Everything" opens on what is still being asked.
  const shown = status === "all"
    ? [...waiting, ...dealtWith]
    : [...waiting, ...dealtWith].filter((row) => row.status === status);

  // Two ways of reading the same plans, because the question changes. Deciding what to answer next is a
  // question about the queue; deciding whether to answer THIS is a question about the client, and the
  // answer to it was two sections away with everybody else's plans in between.
  //
  // Written once and drawn in whichever bar is on screen. Grouping by client takes the status filter away,
  // and a toggle built twice is a toggle that ends up two sizes.
  //
  // Each button says the whole thing rather than finishing a label beside it. Sat next to the pair, a
  // "Group by" in the uppercase this app gives its section headings read as a third button and made the
  // control look like three — and the question it raised was what the control even did. Said on the
  // buttons, there is nothing left beside them to mistake for one of them.
  const groupBy = (
    <div className="flex w-fit rounded-lg border border-line p-0.5" role="group" aria-label="Group by">
      {([["queue", "Group by status"], ["client", "Group by client"]] as const).map(([which, said]) => (
        <button
          key={which}
          type="button"
          aria-pressed={view === which}
          onClick={() => setView(which)}
          className={cn("rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            view === which ? "bg-primary-600 text-white" : "text-ink-muted hover:text-ink")}
        >
          {said}
        </button>
      ))}
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Whose plans these are, which the masthead above the tabs cannot say: it is this reader's own
          answer rather than the queue's.
          Set like the lead it sits under rather than a weight heavier. Bold, it read as a second heading
          and made this tab the one whose text was a different size from every other tab's. */}
      <p className="-mt-2 text-sm text-ink-muted">
        {firmWide ? "Every client's plans." : "Your clients' plans."}
      </p>

      {/* Said once at the top rather than hunted for row by row, so nobody looks for a button on a row that
          is there and inert. */}
      {mine.length > 0 && (
        <Alert tone="info">
          {mine.length === 1
            ? "One of these is yours, so somebody else answers it."
            : `${mine.length} of these are yours, so somebody else answers them.`}
        </Alert>
      )}

      {/* One card either way, so the line that says what is on screen and the controls that change it do
          not move as the reader switches between the two readings. The queue is read by status and so has
          a status to pick; the clients are read by name and have nothing to pick, which is the only
          difference between the two bars. */}
      <section className="rounded-2xl border border-line bg-white">
        <QueueBar name="Money moves">
          {groupBy}
          {view === "queue" && (
            /* Grouping by status without being able to pick one is only a heading. A row of pills spread
               the choice across the page beside a second row of pills that does something else entirely;
               the dropdown is one control saying one thing, and it is what every other list on this app
               filters with. */
            <FilterMenu
              label="Plans"
              value={status}
              options={STATUS_TABS.map((one) => ({
                id: one.id,
                label: one.label,
                count: one.id === "all"
                  ? waiting.length + dealtWith.length
                  : [...waiting, ...dealtWith].filter((row) => row.status === one.id).length,
              }))}
              onChange={setStatus}
              align="right"
            />
          )}
        </QueueBar>

        {view === "queue" ? (
          queue.isPending ? (
            <p className="px-5 py-8 text-sm text-ink-muted">Reading the plans…</p>
          ) : shown.length === 0 ? (
            <p className="px-5 py-8 text-sm text-ink-muted">
              {status === "PENDING" ? "Nothing is waiting on you." : "Nothing here."}
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {shown.map((row) => (
                <li key={row.id} className="px-5 py-4">
                  {row.status === "PENDING" ? (
                    <WaitingPlan
                      row={row}
                      showClient
                      answering={answer.isPending}
                      refusal={refused[row.id]}
                      onApprove={() => {
                        setDeciding({ row, approved: true });
                        setNote("");
                      }}
                      onTurnDown={() => {
                        setDeciding({ row, approved: false });
                        setNote("");
                      }}
                    />
                  ) : (
                    <DealtWithPlan row={row} showClient />
                  )}
                </li>
              ))}
            </ul>
          )
        ) : queue.isPending ? (
          <p className="px-5 py-8 text-sm text-ink-muted">Reading the plans…</p>
        ) : grouped.length === 0 ? (
          <p className="px-5 py-8 text-sm text-ink-muted">None of your clients has a money move to read.</p>
        ) : (
          <ul className="divide-y divide-line">
            {grouped.map((client) => {
              const asked = client.waiting;
              return (
              // A row that goes to the client's own screen rather than opening under itself. Opened in place,
              // a client's moves pushed every other client down the page, and what was being read sat in a
              // drawer under the name instead of on a screen of its own.
              //
              // The one with something waiting is tinted, because that is the whole question this list is
              // asked: which of these needs me.
              <li key={client.customerId}>
                <Link
                  to={`/moves-to-approve/${client.customerId}?by=client`}
                  className={cn(
                    // A row of the card's own list, lined up with the heading above it. It used to be a
                    // card in its own right because it sat loose on the page; inside one, a second border
                    // a few pixels in from the first reads as a box drawn twice.
                    "flex flex-wrap items-center justify-between gap-3 px-5 py-3 transition-colors",
                    asked
                      ? "bg-primary-50 hover:bg-primary-100"
                      : "hover:bg-slate-50",
                  )}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar name={client.clientName} />
                    <div className="min-w-0">
                      <p className="font-semibold">{client.clientName}</p>
                      <p className="font-mono text-xs text-ink-muted">{client.clientCode}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    {asked && <Badge tone="warning">Waiting for approval</Badge>}
                    <span className="text-xs text-ink-muted">
                      {client.dealtWith.length + (asked ? 1 : 0) === 1
                        ? "1 move"
                        : `${client.dealtWith.length + (asked ? 1 : 0)} moves`}
                    </span>
                    <ChevronRight aria-hidden="true" className="size-4 text-ink-muted" />
                  </div>
                </Link>
              </li>
              );
            })}
          </ul>
        )}
      </section>

      <AnswerDialog
        open={deciding !== null}
        approved={deciding?.approved ?? false}
        title={deciding
          ? `${deciding.approved ? "Approve" : "Reject"} the move for ${deciding.row.clientName}?`
          : "Answer it"}
        consequence={deciding?.approved ? "Nothing is undone once this moves." : "Nothing moves."}
        shownTo={deciding?.row.raisedByName}
        note={note}
        onNote={setNote}
        busy={answer.isPending}
        error={answer.isError ? answer.error.message : null}
        onClose={() => setDeciding(null)}
        onConfirm={() => deciding && answer.mutate({
          id: deciding.row.id,
          data: { approved: deciding.approved, note: note.trim() === "" ? null : note.trim() },
        })}
        confirm={deciding?.approved ? "Approve and move it" : "Reject"}
        confirming={deciding?.approved ? "Moving it…" : "Rejecting…"}
      >
        {deciding && (
          <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm">
            <p>{deciding.row.why}</p>
            <ul className="mt-2 space-y-0.5 text-xs text-ink-muted">
              {deciding.row.legs.map((leg, at) => (
                <li key={`${leg.fromSubClass ?? ""}-${leg.toSubClass ?? ""}-${at}`}>
                  {exactly(leg.amount, deciding.row.currency)} out of{" "}
                  {named(leg.fromSubClass, leg.fromAssetClass, leg.fromSubSubClass)} and into{" "}
                  {named(leg.toSubClass, leg.toAssetClass, leg.toSubSubClass)}
                </li>
              ))}
            </ul>
          </div>
        )}
      </AnswerDialog>
    </div>
  );
}
