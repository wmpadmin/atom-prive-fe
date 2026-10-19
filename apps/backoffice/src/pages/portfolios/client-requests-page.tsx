import { ApiError } from "@atomprive/api-client";
import {
  useAnswerTheMovePlan,
  useListClientRequests,
  useSendTheMovePlanBack,
  type MovePlanQueue,
  type MovePlanRow,
} from "@atomprive/api-client/backoffice";
import { Alert, Avatar, Badge, Button, FilterMenu } from "@atomprive/ui";
import { useState } from "react";
import { formatDateTime } from "../../lib/labels";
import { AnswerDialog } from "./answer-dialog";
import { exactly, figure, named } from "./money-words";
import { QueueBar } from "./queue-bar";

/**
 * What a reader can narrow the list to, in the order a request passes through them.
 *
 * <p>Sent back sits beside waiting rather than down with the two answers. A request somebody returned was
 * never answered — it is back with whoever wrote it down, to be put right and asked again — so reading it
 * as a decision would be reading it as the opposite of what it is.
 */
const STATUS_TABS = [
  { id: "PENDING", label: "Waiting for approval" },
  { id: "RETURNED", label: "Sent back" },
  { id: "APPROVED", label: "Approved" },
  { id: "REJECTED", label: "Rejected" },
  { id: "WITHDRAWN", label: "Cancelled" },
  { id: "all", label: "Everything" },
] as const;

type StatusTab = (typeof STATUS_TABS)[number]["id"];

/** Which of the three answers is being given. Two of them owe a reason, and one of them moves money. */
type Answer = "approve" | "reject" | "back";

/**
 * What each answer says, and what saying it does.
 *
 * <p>The button says the act rather than the verdict, so what is read on the row is what is read in the
 * window that confirms it.
 */
const SAID: Record<Answer,
    { confirm: string; confirming: string; consequence: string; asks?: string }> = {
  approve: {
    confirm: "Approve and move it",
    confirming: "Moving it…",
    consequence: "Nothing is undone once this moves.",
  },
  reject: {
    confirm: "Reject",
    confirming: "Rejecting…",
    consequence: "Nothing moves, and the client's request is closed.",
  },
  back: {
    confirm: "Send back",
    confirming: "Sending back…",
    consequence: "Nothing moves. It goes back to whoever wrote it down, to be put right and asked again.",
    // Neither of the window's two questions fits: nothing is being refused, so "Why not?" over the box
    // reads as a refusal the sender is not making.
    asks: "What needs putting right?",
  },
};

/** How each state is read: one that needs somebody, one that went through, one that came to nothing. */
const TONES: Record<MovePlanRow["status"], "neutral" | "success" | "warning"> = {
  PENDING: "warning",
  RETURNED: "warning",
  APPROVED: "success",
  REJECTED: "neutral",
  WITHDRAWN: "neutral",
};

/** Nobody has answered it, so it is still a question rather than the record of one. */
function stillOpen(row: MovePlanRow) {
  return row.status === "PENDING" || row.status === "RETURNED";
}

/**
 * One request, drawn the same whichever state it is in.
 *
 * <p>The figures are shown on an answered request too. Somebody coming back to ask why a move was approved
 * last month is asking about what moved, and a row that kept the reason and dropped the legs answers the
 * easier half of that question.
 */
function ClientRequest({ row, answering, refusal, onAnswer }: {
  row: MovePlanRow;
  answering: boolean;
  refusal: string | undefined;
  onAnswer: (how: Answer) => void;
}) {
  const open = stillOpen(row);
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <Avatar name={row.clientName} />
          <div className="min-w-0">
            <p className="font-semibold">{row.clientName}</p>
            <p className="font-mono text-xs text-ink-muted">{row.clientCode}</p>
            {/* The reason first, because here it is the client's own asking, written down by whoever took
                the call. The figures are below it and they can be read. */}
            <p className="mt-1 text-sm">{row.why}</p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Badge tone={TONES[row.status]}>{row.statusSaid}</Badge>
          {open && (row.mayAnswer ? (
            <>
              <Button variant="secondary" size="sm" disabled={answering} onClick={() => onAnswer("reject")}>
                Reject
              </Button>
              {/* Between the two answers, because it is neither of them: the request stands and somebody
                  is being told what to change about it. */}
              <Button variant="secondary" size="sm" disabled={answering} onClick={() => onAnswer("back")}>
                Send back
              </Button>
              {/* The label does not change while something is in flight. All three answers go through a
                  window that reports its own progress, and a row behind it saying "Moving it…" while
                  somebody is part way through rejecting says the opposite of what is happening. */}
              <Button size="sm" disabled={answering} onClick={() => onAnswer("approve")}>
                Approve and move it
              </Button>
            </>
          ) : (
            // Two different reasons for having no buttons, and they are not the same sentence. One is
            // whose work it is; the other is whose turn it is.
            <p className="max-w-56 text-xs text-ink-muted">
              {row.status === "RETURNED"
                ? `Waiting on ${row.raisedByName} to put it right.`
                : "You wrote this one down, so somebody else answers it."}
            </p>
          ))}
        </div>
      </div>

      {/* Each column the same width whatever is in it, so the names start in one place and the figures end
          in one place. Left to the content they line up with nothing, which is most of what makes a table
          of money unreadable. */}
      <div className="mt-4">
        <table className="w-full table-fixed text-sm lg:w-1/2">
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
      </div>

      {/* An amount with no denominator beside it could be a rounding error or half the book. The currency
          is said here, once, rather than on every cell of the table above it. */}
      <p className="mt-4 text-xs text-ink-muted">
        Figures in {row.currency}. {exactly(row.amount, row.currency)} of{" "}
        {exactly(row.underManagement, row.currency)} · Asked by {row.raisedByName} ·{" "}
        {formatDateTime(row.raisedAt)}
      </p>

      {/* What was wrong with it last time. Sent back is the one state where somebody has to do something
          and the reason is the whole of the message, so it is read on the row and not hunted for. */}
      {row.sentBackNote && (
        <div className="mt-3">
          <Alert tone="warning">
            <span className="font-semibold">
              Sent back by {row.sentBackByName} · {formatDateTime(row.sentBackAt)}
            </span>
            <span className="mt-0.5 block">{row.sentBackNote}</span>
          </Alert>
        </div>
      )}

      {/* Who answered it and what they said. The row said who asked and never who answered, which is the
          half somebody goes looking for when a decision is questioned later. */}
      {!open && row.decidedByName && (
        <p className="mt-1 text-xs text-ink-muted">
          {row.statusSaid} by {row.decidedByName} · {formatDateTime(row.decidedAt)}
          {row.decisionNote && ` · ${row.decisionNote}`}
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

/**
 * Answering what a client has asked for.
 *
 * <p>It runs the opposite way to every other queue on this screen. Everywhere else the firm asks and
 * whoever looks after the client answers; here the client rang and asked, their relationship manager wrote
 * that asking down, and somebody holding the whole book answers it.
 *
 * <p>Which is why there are three answers rather than two. Yes moves the money and no closes the request,
 * but a request can also be neither — right in what the client wants and wrong in how it was written down
 * — and without a way to hand it back the only thing to do with one was reject the client.
 *
 * <p>Nothing has moved. Saying yes is what moves it, through exactly the code the holdings screen calls.
 */
export function ClientRequestsPage() {
  const queue = useListClientRequests<MovePlanQueue, ApiError>({
    query: { refetchOnWindowFocus: true },
  });
  const [status, setStatus] = useState<StatusTab>("PENDING");
  /** The request being answered and which way, because all three answers are given in the same window. */
  const [deciding, setDeciding] = useState<{ row: MovePlanRow; how: Answer } | null>(null);
  const [note, setNote] = useState("");
  const [refused, setRefused] = useState<Record<string, string>>({});

  function went() {
    setDeciding(null);
    setNote("");
    void queue.refetch();
  }
  // Kept on the row rather than thrown away in a notice that fades. Every refusal this can give — the
  // figures have moved, somebody else has answered it — changes what the reader does next, and the
  // server's sentence is the only place the figures in it appear.
  function wouldNot(id: string, why: string) {
    setRefused((was) => ({ ...was, [id]: why }));
    void queue.refetch();
  }

  const answer = useAnswerTheMovePlan<ApiError>({
    mutation: {
      onSuccess: went,
      onError: (error, variables) => wouldNot(variables.id, error.message),
    },
  });
  const sendBack = useSendTheMovePlanBack<ApiError>({
    mutation: {
      onSuccess: went,
      onError: (error, variables) => wouldNot(variables.id, error.message),
    },
  });

  if (queue.isError) {
    return <Alert tone="danger">{queue.error.message}</Alert>;
  }

  const waiting = queue.data?.waiting ?? [];
  const dealtWith = queue.data?.answered ?? [];
  // One list to filter, because a request is in exactly one state and the two the server sends are only
  // where it put them. Ordered waiting-first so "Everything" opens on what is still being asked.
  const everything = [...waiting, ...dealtWith];
  const shown = status === "all" ? everything : everything.filter((row) => row.status === status);

  const busy = answer.isPending || sendBack.isPending;
  const failed = deciding?.how === "back"
    ? (sendBack.isError ? sendBack.error.message : null)
    : (answer.isError ? answer.error.message : null);

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-line bg-white">
        <QueueBar name="Client requests">
          <FilterMenu
            label="Requests"
            value={status}
            options={STATUS_TABS.map((one) => ({
              id: one.id,
              label: one.label,
              count: one.id === "all"
                ? everything.length
                : everything.filter((row) => row.status === one.id).length,
            }))}
            onChange={setStatus}
            align="right"
          />
        </QueueBar>
        {queue.isPending ? (
          <p className="px-5 py-8 text-sm text-ink-muted">Reading the requests…</p>
        ) : shown.length === 0 ? (
          <p className="px-5 py-8 text-sm text-ink-muted">
            {status === "PENDING" ? "No client is waiting on you." : "Nothing here."}
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {shown.map((row) => (
              <li key={row.id} className="px-5 py-4">
                <ClientRequest
                  row={row}
                  answering={busy}
                  refusal={refused[row.id]}
                  onAnswer={(how) => {
                    setDeciding({ row, how });
                    setNote("");
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* The same window all three answers are given in. Sending back is given here too, with the reason
          owed rather than asked for: it is the only one of the three whose whole content is the reason —
          a request handed back with nothing said about it is a request handed back twice. */}
      <AnswerDialog
        open={deciding !== null}
        approved={deciding?.how === "approve"}
        title={deciding === null
          ? "Answer it"
          : deciding.how === "back"
            ? `Send ${deciding.row.clientName}'s request back?`
            : `${deciding.how === "approve" ? "Approve" : "Reject"} the move `
              + `${deciding.row.clientName} asked for?`}
        consequence={deciding === null ? "" : SAID[deciding.how].consequence}
        asks={deciding === null ? undefined : SAID[deciding.how].asks}
        shownTo={deciding?.row.raisedByName}
        note={note}
        onNote={setNote}
        busy={busy}
        error={failed}
        onClose={() => setDeciding(null)}
        onConfirm={() => {
          if (deciding === null) return;
          const data = {
            approved: deciding.how === "approve",
            note: note.trim() === "" ? null : note.trim(),
          };
          if (deciding.how === "back") sendBack.mutate({ id: deciding.row.id, data });
          else answer.mutate({ id: deciding.row.id, data });
        }}
        confirm={deciding === null ? "Answer it" : SAID[deciding.how].confirm}
        confirming={deciding === null ? "Answering…" : SAID[deciding.how].confirming}
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
