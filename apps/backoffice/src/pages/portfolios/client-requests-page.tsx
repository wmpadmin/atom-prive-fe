import { ApiError } from "@atomprive/api-client";
import {
  useAnswerTheMovePlan,
  useAskOnBehalfOfTheClient,
  useListClientHoldings,
  useListClientRequests,
  useListMyClients,
  useSendTheMovePlanBack,
  type ClientHoldings,
  type CustomerPage,
  type MovePlanQueue,
  type MovePlanRow,
} from "@atomprive/api-client/backoffice";
import { Alert, Avatar, Badge, Button, Field, FilterMenu, TextArea, TextInput } from "@atomprive/ui";
import { ChevronLeft } from "lucide-react";
import { useState } from "react";
import { useStaffUser } from "../../auth/session";
import { formatDateTime } from "../../lib/labels";
import { hasAnyAuthority, RAISES_CLIENT_REQUESTS } from "../../lib/permissions";
import { ClientAskingRows, EMPTY_ROW, isAsked, legsFromRows, type AskedRow } from "./client-asking-rows";
import { ClientHoldingsPanel } from "./client-holdings-panel";
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
function ClientRequest({ row, answering, refusal, onAnswer, mine }: {
  row: MovePlanRow;
  answering: boolean;
  refusal: string | undefined;
  onAnswer: (how: Answer) => void;
  /** Whether this reader is the person who wrote it down, which decides what a row with no buttons says. */
  mine: boolean;
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
            // Three different reasons for having no buttons, and they are not the same sentence. Whose
            // turn it is, whose work it is, and whose job it is.
            //
            // The third used to be told as the second: everybody who could not answer was told they had
            // written it down themselves. This list is the whole book — a client's asking is read by
            // whoever holds it, not by the clients one person looks after — so a relationship manager
            // reading it sees every other manager's work and was told, on every row of it, that it was
            // their own.
            <p className="max-w-56 text-xs text-ink-muted">
              {row.status === "RETURNED"
                ? `Waiting on ${row.raisedByName} to put it right.`
                : mine
                  ? "You wrote this one down, so somebody else answers it."
                  : `${row.raisedByName} wrote this down. Somebody who holds the whole book answers it.`}
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
/**
 * Which of this reader's clients the request is for.
 *
 * <p>Their own clients and no others, read from the list the firm keeps rather than filtered here: a
 * relationship manager writes down what their own clients say, and a picker that offered the whole book
 * would be offering to write down something nobody said to them.
 */
function WhichClient({ onPick, onClose }: {
  onPick: (client: { id: string; name: string; code: string }) => void;
  onClose: () => void;
}) {
  const [typed, setTyped] = useState("");
  const mine = useListMyClients<CustomerPage, ApiError>(
    { query: typed.trim() === "" ? undefined : typed.trim(), page: 0, size: 25 },
    { query: { refetchOnWindowFocus: false } },
  );
  const found = mine.data?.items ?? [];

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={onClose}
        className="inline-flex items-center gap-1 text-sm font-semibold text-primary-700 hover:underline"
      >
        <ChevronLeft aria-hidden="true" className="size-4" />
        Back to client requests
      </button>
      <section className="rounded-2xl border border-line bg-white">
        <QueueBar name="Which client asked?">
          <div className="w-72">
            <TextInput
              aria-label="Search your clients"
              placeholder="Search your clients"
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
            />
          </div>
        </QueueBar>
        {mine.isError ? (
          <p className="px-5 py-8 text-sm text-red-600">{mine.error.message}</p>
        ) : mine.isPending ? (
          <p className="px-5 py-8 text-sm text-ink-muted">Reading your clients…</p>
        ) : found.length === 0 ? (
          <p className="px-5 py-8 text-sm text-ink-muted">
            {typed.trim() === "" ? "You look after nobody yet." : "No client of yours matches that."}
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {found.map((client) => (
              <li key={client.id}>
                <button
                  type="button"
                  onClick={() => onPick({ id: client.id, name: client.fullName, code: client.code })}
                  className="flex w-full items-center gap-3 px-5 py-3.5 text-left hover:bg-slate-50/60"
                >
                  <Avatar name={client.fullName} />
                  <span>
                    <span className="block font-semibold">{client.fullName}</span>
                    <span className="block font-mono text-xs text-ink-muted">{client.code}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/**
 * Writing down what one client asked for.
 *
 * <p>Their portfolio first, because it is what the asking is about and what the person writing it reads
 * while they write. The asking itself is rows: out of a line, into a line, an amount — as many as the
 * client asked for in the one telephone call.
 */
function WritingForAclient({ client, onDone, onClose }: {
  client: { id: string; name: string; code: string };
  onDone: () => void;
  onClose: () => void;
}) {
  const held = useListClientHoldings<ClientHoldings, ApiError>(client.id);
  const [writing, setWriting] = useState(false);
  const [rows, setRows] = useState<AskedRow[]>([{ ...EMPTY_ROW }]);
  const [why, setWhy] = useState("");
  const [refused, setRefused] = useState<string | null>(null);

  const ask = useAskOnBehalfOfTheClient<ApiError>({
    mutation: {
      onSuccess: onDone,
      // Kept on the screen rather than in a notice that fades: every refusal this can give changes what
      // the writer does next, and the server's sentence is the only place its figures appear.
      onError: (error) => setRefused(error.message),
    },
  });

  const written = rows.filter(isAsked);
  const ready = written.length > 0 && why.trim() !== "";

  return (
    <div className="space-y-5">
      <div>
        <button
          type="button"
          onClick={() => (writing ? setWriting(false) : onClose())}
          className="inline-flex items-center gap-1 text-sm font-semibold text-primary-700 hover:underline"
        >
          <ChevronLeft aria-hidden="true" className="size-4" />
          {writing ? `Back to ${client.name}'s portfolio` : "Back to client requests"}
        </button>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">What {client.name} asked for</h2>
            <p className="text-sm text-ink-muted">
              {client.code} · Nothing moves until a portfolio manager agrees to it.
            </p>
          </div>
          {/* Above what it is about, where somebody looking for it looks: under a portfolio this long it
              sat below the fold on every client the firm has. */}
          {!writing && <Button onClick={() => setWriting(true)}>Create client request</Button>}
        </div>
      </div>

      {/* The portfolio, until the asking is being written. They are two steps rather than one screen: the
          holdings are long, and a form under them is a form nobody sees without scrolling past the whole
          book. */}
      {!writing ? <ClientHoldingsPanel customerId={client.id} readOnly /> : (
        <section className="space-y-4 rounded-2xl border border-line bg-white p-5">
          <h3 className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">
            What the client asked for
          </h3>
          <ClientAskingRows
            holdings={held.data}
            rows={rows}
            disabled={ask.isPending}
            onChange={(next) => {
              setRows(next);
              setRefused(null);
            }}
          />
          <Field id="why-the-client-asked" label="Why it should move" required
            hint="Whoever answers is being asked about the reason, not the figures. They can see those.">
            <TextArea
              id="why-the-client-asked"
              rows={2}
              value={why}
              disabled={ask.isPending}
              placeholder="The client rang and asked for this"
              onChange={(event) => setWhy(event.target.value)}
            />
          </Field>
          {refused && <Alert tone="danger">{refused}</Alert>}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-ink-muted">
              Nothing moves yet. This goes to the portfolio manager, and agreeing to it is what moves the
              money.
            </p>
            <div className="flex gap-3">
              <Button variant="secondary" disabled={ask.isPending} onClick={() => setWriting(false)}>
                Cancel
              </Button>
              <Button
                disabled={!ready || ask.isPending}
                onClick={() => {
                  setRefused(null);
                  ask.mutate({
                    customerId: client.id,
                    // Raised by hand, not carried out of a proposal: this is the client's own asking.
                    data: { legs: legsFromRows(rows, held.data), why: why.trim(), fromProposalId: null },
                  });
                }}
              >
                {ask.isPending ? "Sending…" : "Send to the portfolio manager"}
              </Button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

export function ClientRequestsPage() {
  // To tell a row this reader wrote down from one somebody else did, which is the difference between
  // "somebody else answers it" and "this is not yours to answer".
  const user = useStaffUser();
  // The relationship manager writes these; the portfolio manager answers them. One screen, because what
  // became of a request is the same reader's business as writing the next one.
  const writes = hasAnyAuthority(user, ...RAISES_CLIENT_REQUESTS);
  /** Which client a new request is being written for, and whether one is being chosen. */
  const [writingFor, setWritingFor] = useState<{ id: string; name: string; code: string } | null>(null);
  const [choosing, setChoosing] = useState(false);
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

  // Writing one down: the client is chosen first, then their portfolio is read, and the asking is written
  // against it. The portfolio is there to be read while it is written — what a client asks for is always
  // about something they already hold, and a line written from memory matches nothing.
  if (writingFor) {
    return (
      <WritingForAclient
        client={writingFor}
        onDone={() => {
          setWritingFor(null);
          void queue.refetch();
        }}
        onClose={() => setWritingFor(null)}
      />
    );
  }

  if (choosing) {
    return <WhichClient onPick={(client) => {
      setWritingFor(client);
      setChoosing(false);
    }} onClose={() => setChoosing(false)} />;
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-line bg-white">
        <QueueBar name="Client requests">
          {writes && (
            <Button size="sm" onClick={() => setChoosing(true)}>
              Create client request
            </Button>
          )}
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
                  mine={row.raisedBy === user.id}
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
