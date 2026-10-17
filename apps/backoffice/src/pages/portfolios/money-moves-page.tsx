import { ApiError } from "@atomprive/api-client";
import {
  useAnswerTheMovePlan,
  useListMovePlans,
  type MovePlanQueue,
  type MovePlanRow,
  type PlannedLeg,
} from "@atomprive/api-client/backoffice";
import { Alert, Avatar, Badge, Button, Dialog, Field, TextArea } from "@atomprive/ui";
import { useState } from "react";
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
 * Answering a plan to move a client's money.
 *
 * <p>The screen that raises one tells whoever raised it that the person answering is being asked about the
 * reason, not the figures — they can see those. This is where that promise is kept: what the plan does leg
 * by leg, what the client is worth for the amount to be read against, and what each source line holds now
 * beside what it held when the plan was raised.
 *
 * <p>Nothing has moved. Saying yes is what moves it, through exactly the code the holdings screen calls.
 */
export function MoneyMovesPage() {
  const user = useStaffUser();
  // For the wording only, never for whether the screen or its buttons appear. Who may answer which plan is
  // the server's question, and it comes back on every row as mayAnswer — asked there with the same rule the
  // answering itself uses, so a button is never offered that would then be refused.
  const firmWide = hasAuthority(user, "APPROVE_PORTFOLIO_CHANGES:CHANGE");
  const queue = useListMovePlans<MovePlanQueue, ApiError>({
    query: { refetchOnWindowFocus: true },
  });
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
  const answered = queue.data?.answered ?? [];
  const mine = waiting.filter((row) => !row.mayAnswer);

  return (
    <div className="space-y-5">
      <ListPageHeader
        title="Money moves"
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

      <section className="overflow-hidden rounded-2xl border border-line bg-white">
        <h2 className="border-b border-line px-5 py-3 text-2xs font-semibold tracking-wider text-ink-muted uppercase">
          Waiting on an answer
        </h2>
        {queue.isPending ? (
          <p className="px-5 py-8 text-sm text-ink-muted">Reading the plans…</p>
        ) : waiting.length === 0 ? (
          <p className="px-5 py-8 text-sm text-ink-muted">
            {firmWide
              ? "Nothing is waiting on an answer."
              : "Nothing is waiting on you."}
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {waiting.map((row) => {
              const moved = row.legs.some((leg) => leg.figuresMoved);
              return (
                <li key={row.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex min-w-0 items-start gap-3">
                      <Avatar name={row.clientName} />
                      <div className="min-w-0">
                        <p className="font-semibold">{row.clientName}</p>
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
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      {moved && <Badge tone="warning">Figures have moved</Badge>}
                      {row.legs.some((leg) => pastItsBand(leg) > 0) && (
                        <Badge tone="warning">Past a band</Badge>
                      )}
                      {row.mayAnswer ? (
                        <>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              setTurningDown(row);
                              setNote("");
                            }}
                          >
                            Turn it down
                          </Button>
                          <Button
                            size="sm"
                            disabled={answer.isPending}
                            onClick={() => answer.mutate({ id: row.id, data: { approved: true, note: null } })}
                          >
                            {answer.isPending ? "Moving it…" : "Approve and move it"}
                          </Button>
                        </>
                      ) : (
                        <p className="max-w-56 text-xs text-ink-muted">
                          You asked for this one, so somebody else answers it.
                        </p>
                      )}
                    </div>
                  </div>
                  {refused[row.id] && (
                    <div className="mt-3">
                      <Alert tone="danger">{refused[row.id]}</Alert>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* A queue that empties itself the moment somebody answers gives them nothing back: the row they have
          just decided on simply disappears, and the only thing left is its absence. */}
      {answered.length > 0 && (
        <section className="overflow-hidden rounded-2xl border border-line bg-white">
          <h2 className="border-b border-line px-5 py-3 text-2xs font-semibold tracking-wider text-ink-muted uppercase">
            Lately answered
          </h2>
          <ul className="divide-y divide-line">
            {answered.map((row) => (
              <li key={row.id} className="flex flex-wrap items-start justify-between gap-4 px-5 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{row.clientName}</p>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    {exactly(row.amount, row.currency)} · {row.statusSaid}
                    {row.decidedByName && ` by ${row.decidedByName}`}
                    {row.decidedAt && ` · ${formatDateTime(row.decidedAt)}`}
                  </p>
                  {row.decisionNote && <p className="mt-1 text-xs text-ink-muted">{row.decisionNote}</p>}
                </div>
                <Badge tone={row.status === "APPROVED" ? "success" : "neutral"}>{row.statusSaid}</Badge>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* The note is collected against what it refuses, so somebody writing it can see what they are
          turning down rather than remembering it. */}
      <Dialog
        open={turningDown !== null}
        title={turningDown ? `Turn down the move for ${turningDown.clientName}?` : "Turn it down"}
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
              {answer.isPending ? "Turning it down…" : "Turn it down"}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
