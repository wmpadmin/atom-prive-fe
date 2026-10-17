import { ApiError } from "@atomprive/api-client";
import {
  useAnswerTheMovePlan,
  useListMovePlans,
  type MovePlanQueue,
  type MovePlanRow,
  type PlannedLeg,
} from "@atomprive/api-client/backoffice";
import { Alert, Avatar, Badge, Button, Dialog, Field, TextArea, cn } from "@atomprive/ui";
import { useState } from "react";
import { Link } from "react-router";
import { useStaffUser } from "../../auth/session";
import { ListPageHeader } from "../../components/record-list";
import { formatDateTime } from "../../lib/labels";
import { hasAuthority } from "../../lib/permissions";

/** Money, written the way every other portfolio screen writes it. */
function exactly(amount: number, currency: string) {
  return `${currency} ${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** A sub-asset nobody has grouped is a real place for money to be, and it needs a name to be named by. */
function named(subClass: string | null) {
  return subClass ?? "what is not grouped";
}

/**
 * By how much a leg would leave its destination past the most that line may hold, or nothing if it would not.
 *
 * <p>Filling a line to the end of its band is offered on purpose and going past it is a decision rather than
 * a mistake, so it is said and not refused. It was being said only on the screen where the plan was raised —
 * to the one person who had already made that decision — while whoever was being asked to agree to it saw
 * only the amount. The ceiling is the platform's own figure, the same one it reads the line's breach
 * against, so this cannot call a line fine where the table beside it calls that line breached.
 */
function pastItsBand(leg: PlannedLeg) {
  if (leg.landsOnMayHold === null) return 0;
  const over = leg.landsOnHeldNow + leg.amount - leg.landsOnMayHold;
  // A whole unit or it is nothing: a ceiling worked out as a share lands a hair either side of its figure,
  // and a leg filling a line exactly to the end of its band is not an overshoot worth a line of warning.
  return over < 1 ? 0 : over;
}

/**
 * One plan waiting on an answer, with the buttons that answer it.
 *
 * <p>Drawn once and used by both ways of reading this screen. Grouped under a client the plan is the same
 * plan, and a row that said one thing in one view and another in the other would be two screens pretending
 * to be one.
 */
function WaitingPlan({ row, showClient, answering, refusal, onApprove, onTurnDown }: {
  row: MovePlanRow;
  /** False where a card header already names the client, so the name is not said twice in a row. */
  showClient: boolean;
  answering: boolean;
  refusal: string | undefined;
  onApprove: () => void;
  onTurnDown: () => void;
}) {
  const moved = row.legs.some((leg) => leg.figuresMoved);
  return (
    <>
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
            <p className="mt-1 text-sm">{row.why}</p>
            <ul className="mt-2 space-y-0.5 text-sm text-ink-muted">
              {row.legs.map((leg, at) => (
                <li key={`${leg.fromSubClass ?? ""}-${leg.toSubClass ?? ""}-${at}`}>
                  {exactly(leg.amount, row.currency)} out of {named(leg.fromSubClass)} and into{" "}
                  {named(leg.toSubClass)}
                  {leg.figuresMoved && (
                    <span className="text-amber-700">
                      {" — "}
                      {named(leg.fromSubClass)} held{" "}
                      {exactly(leg.heldWhenRaised ?? 0, row.currency)} when this was asked for and
                      holds {exactly(leg.heldNow, row.currency)} now
                    </span>
                  )}
                  {pastItsBand(leg) > 0 && (
                    <span className="block text-amber-700">
                      This would leave {named(leg.toSubClass)} holding{" "}
                      {exactly(leg.landsOnHeldNow + leg.amount, row.currency)}, which is{" "}
                      {exactly(pastItsBand(leg), row.currency)} past the{" "}
                      {exactly(leg.landsOnMayHold ?? 0, row.currency)} the model allows it
                    </span>
                  )}
                </li>
              ))}
            </ul>
            {/* An amount with no denominator beside it could be a rounding error or half the
                book. */}
            <p className="mt-2 text-xs text-ink-muted">
              {exactly(row.amount, row.currency)} of{" "}
              {exactly(row.underManagement, row.currency)} · Asked by {row.raisedByName} ·{" "}
              {formatDateTime(row.raisedAt)}
            </p>
            {/* Said on the row, because nothing else on the screen can say it: the list is ordered on when
                a plan was first asked for, and changing one deliberately leaves that alone — so an amended
                plan does not move, and somebody who read this an hour ago would answer figures that are no
                longer being asked about. */}
            {row.changedAt && (
              <p className="mt-1 text-xs font-medium text-amber-700">
                Changed since it was asked · {formatDateTime(row.changedAt)}
              </p>
            )}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {moved && <Badge tone="warning">Figures have moved</Badge>}
          {row.legs.some((leg) => pastItsBand(leg) > 0) && <Badge tone="warning">Past a band</Badge>}
          {row.changedAt && <Badge tone="warning">Changed</Badge>}
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
      {refusal && (
        <div className="mt-3">
          <Alert tone="danger">{refusal}</Alert>
        </div>
      )}
    </>
  );
}

/** One plan nobody is waiting on any more — answered, or taken back before anybody answered it. */
function DealtWithPlan({ row, showClient }: { row: MovePlanRow; showClient: boolean }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        {showClient && <p className="text-sm font-semibold">{row.clientName}</p>}
        <p className="mt-0.5 text-xs text-ink-muted">
          {exactly(row.amount, row.currency)} · {row.statusSaid}
          {row.decidedByName && ` by ${row.decidedByName}`}
          {row.decidedAt && ` · ${formatDateTime(row.decidedAt)}`}
        </p>
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
  const [view, setView] = useState<"queue" | "client">("queue");
  const [turningDown, setTurningDown] = useState<MovePlanRow | null>(null);
  const [note, setNote] = useState("");
  const [refused, setRefused] = useState<Record<string, string>>({});
  const answer = useAnswerTheMovePlan<ApiError>({
    mutation: {
      onSuccess: () => {
        setTurningDown(null);
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

  return (
    <div className="space-y-5">
      <ListPageHeader
        title="Moves to approve"
        lead={
          firmWide
            ? "Plans to move money between what a client holds. Nothing has moved: saying yes is what moves it."
            : "Plans to move money between what your clients hold. Nothing has moved: saying yes is what moves it."
        }
      />

      {/* Said once at the top rather than hunted for row by row, so nobody looks for a button on a row that
          is there and inert. */}
      {mine.length > 0 && (
        <Alert tone="info">
          {mine.length === 1
            ? "One of these is yours, so somebody else answers it."
            : `${mine.length} of these are yours, so somebody else answers them.`}
        </Alert>
      )}

      {/* Two ways of reading the same plans, because the question changes. Deciding what to answer next is
          a question about the queue; deciding whether to answer THIS is a question about the client, and
          the answer to it was two sections away with everybody else's plans in between. */}
      {/* Each button says the whole thing rather than finishing a label beside it. Sat next to the pair,
          a "Group by" in the uppercase this app gives its section headings read as a third button and
          made the control look like three — and the question it raised was what the control even did.
          Said on the buttons, there is nothing left beside them to mistake for one of them. */}
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

      {view === "queue" ? (
        <>
          <section className="overflow-hidden rounded-2xl border border-line bg-white">
            <h2 className="border-b border-line px-5 py-3 text-2xs font-semibold tracking-wider text-ink-muted uppercase">
              Waiting for approval
            </h2>
            {queue.isPending ? (
              <p className="px-5 py-8 text-sm text-ink-muted">Reading the plans…</p>
            ) : waiting.length === 0 ? (
              <p className="px-5 py-8 text-sm text-ink-muted">
                {firmWide ? "Nothing is waiting for approval." : "Nothing is waiting on you."}
              </p>
            ) : (
              <ul className="divide-y divide-line">
                {waiting.map((row) => (
                  <li key={row.id} className="px-5 py-4">
                    <WaitingPlan
                      row={row}
                      showClient
                      answering={answer.isPending}
                      refusal={refused[row.id]}
                      onApprove={() => answer.mutate({ id: row.id, data: { approved: true, note: null } })}
                      onTurnDown={() => {
                        setTurningDown(row);
                        setNote("");
                      }}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* A queue that empties itself the moment somebody answers gives them nothing back: the row they
              have just decided on simply disappears, and the only thing left is its absence. */}
          {dealtWith.length > 0 && (
            <section className="overflow-hidden rounded-2xl border border-line bg-white">
              {/* Not "answered": a plan the person who raised it cancelled was never answered by anybody,
                  and it sits in this list too. Decided covers both — somebody decided it, even if that
                  somebody was the person who asked. */}
              <h2 className="border-b border-line px-5 py-3 text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                Recently decided
              </h2>
              <ul className="divide-y divide-line">
                {dealtWith.map((row) => (
                  <li key={row.id} className="px-5 py-3">
                    <DealtWithPlan row={row} showClient />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      ) : queue.isPending ? (
        <section className="overflow-hidden rounded-2xl border border-line bg-white">
          <p className="px-5 py-8 text-sm text-ink-muted">Reading the plans…</p>
        </section>
      ) : grouped.length === 0 ? (
        <section className="overflow-hidden rounded-2xl border border-line bg-white">
          <p className="px-5 py-8 text-sm text-ink-muted">
            {firmWide ? "No client has a money move to read." : "None of your clients has a money move to read."}
          </p>
        </section>
      ) : (
        <ul className="space-y-3">
          {grouped.map((client) => {
            // Bound out of the group so the closures below keep it: narrowing does not survive into a
            // callback, and the one that approves reads it after the render that checked it.
            const asked = client.waiting;
            return (
            <li
              key={client.customerId}
              className="overflow-hidden rounded-2xl border border-line bg-white"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar name={client.clientName} />
                  <div className="min-w-0">
                    {/* The client's own page, because somebody reading a plan against a client's history is
                        one question away from wanting the figures it is all about. */}
                    <Link
                      to={`/portfolio-clients/${client.customerId}`}
                      className="font-semibold underline-offset-2 hover:underline"
                    >
                      {client.clientName}
                    </Link>
                    <p className="font-mono text-xs text-ink-muted">{client.clientCode}</p>
                  </div>
                </div>
                {asked
                  ? <Badge tone="warning">Waiting for approval</Badge>
                  : <Badge tone="neutral">Nothing waiting</Badge>}
              </div>
              {asked && (
                <div className="border-b border-line px-5 py-4">
                  <WaitingPlan
                    row={asked}
                    showClient={false}
                    answering={answer.isPending}
                    refusal={refused[asked.id]}
                    onApprove={() => answer.mutate({ id: asked.id, data: { approved: true, note: null } })}
                    onTurnDown={() => {
                      setTurningDown(asked);
                      setNote("");
                    }}
                  />
                </div>
              )}
              {client.dealtWith.length > 0 && (
                <ul className="divide-y divide-line">
                  {client.dealtWith.map((row) => (
                    <li key={row.id} className="px-5 py-3">
                      <DealtWithPlan row={row} showClient={false} />
                    </li>
                  ))}
                </ul>
              )}
            </li>
            );
          })}
        </ul>
      )}

      {/* The note is collected against what it refuses, so somebody writing it can see what they are
          rejecting rather than remembering it. */}
      <Dialog
        open={turningDown !== null}
        title={turningDown ? `Reject the move for ${turningDown.clientName}?` : "Reject it"}
        onClose={() => setTurningDown(null)}
      >
        <div className="space-y-4">
          {turningDown && (
            <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm">
              <p>{turningDown.why}</p>
              <ul className="mt-2 space-y-0.5 text-xs text-ink-muted">
                {turningDown.legs.map((leg, at) => (
                  <li key={`${leg.fromSubClass ?? ""}-${leg.toSubClass ?? ""}-${at}`}>
                    {exactly(leg.amount, turningDown.currency)} out of {named(leg.fromSubClass)} and into{" "}
                    {named(leg.toSubClass)}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-sm text-ink-muted">
            Nothing moves. What you write here is shown to {turningDown?.raisedByName}.
          </p>
          <Field id="turn-down-note" label="Why not?" required>
            <TextArea
              id="turn-down-note"
              rows={3}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setTurningDown(null)}>
              Cancel
            </Button>
            <Button
              disabled={note.trim() === "" || answer.isPending}
              onClick={() =>
                turningDown &&
                answer.mutate({ id: turningDown.id, data: { approved: false, note: note.trim() } })
              }
            >
              {answer.isPending ? "Rejecting…" : "Reject"}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
