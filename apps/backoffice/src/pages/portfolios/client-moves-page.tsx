import { ApiError } from "@atomprive/api-client";
import {
  useGetClientValuations,
  type ValuationHistory,
  useAnswerTheMovePlan,
  useGetCustomer,
  useListClientMovePlans,
  type CustomerDetail,
  type MovePlanRow,
} from "@atomprive/api-client/backoffice";
import { Alert, Avatar, Badge } from "@atomprive/ui";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router";
import { formatDateTime } from "../../lib/labels";
import { PagedFooter, usePagedRows } from "../../lib/paged-rows";
import { exactly, named as whatItIsCalled } from "./money-words";
import { AnswerDialog } from "./answer-dialog";
import { QueueBar } from "./queue-bar";
import { WaitingPlan } from "./move-plan-rows";

/**
 * One client's money moves, on a screen of their own.
 *
 * <p>Grouped under a client in the queue they used to open under the name, which pushed every other client
 * down the page and left what was being read in a drawer rather than on a screen. A client's moves are a
 * subject in themselves — what has been asked for them, what came of it, and what is waiting now — and that
 * is a page, not a panel.
 */
export function ClientMovesPage() {
  const { customerId = "" } = useParams();
  const client = useGetCustomer<CustomerDetail, ApiError>(customerId);
  const plans = useListClientMovePlans<MovePlanRow[], ApiError>(customerId, {
    query: { refetchOnWindowFocus: true },
  });
  /** The plan being answered and which way, because both answers are given in the same window now. */
  const [deciding, setDeciding] = useState<{ row: MovePlanRow; approved: boolean } | null>(null);
  const [note, setNote] = useState("");
  const [refused, setRefused] = useState<Record<string, string>>({});
  const answer = useAnswerTheMovePlan<ApiError>({
    mutation: {
      onSuccess: () => {
        setDeciding(null);
        setNote("");
        void plans.refetch();
      },
      onError: (error, variables) => {
        setRefused((was) => ({ ...was, [variables.id]: error.message }));
        void plans.refetch();
      },
    },
  });

  // Which day each change was written on, so the trail from a decision to the figures it wrote lands on
  // the right page. Worked out from the moment it was answered, the link would be a day out whenever a
  // move was approved either side of midnight — a trail that ends in a page saying nothing happened.
  const history = useGetClientValuations<ValuationHistory, ApiError>(customerId, { every: true });

  // Read above the refusal below rather than under it, because taking a page is a hook and a hook
  // skipped on the way out of an early return is one React counts as missing on the render after it.
  // Nothing moves by reading them earlier: with no plans in hand both lists are simply empty.
  const every = plans.data ?? [];
  // Sent back counts as still open: it is waiting on whoever wrote it down, not on a reader, and filing
  // it under what was decided hid the one thing its author still has to do.
  const waiting = every.filter((one) => one.status === "PENDING" || one.status === "RETURNED");
  const decided = every.filter((one) => one.status !== "PENDING" && one.status !== "RETURNED");
  const paged = usePagedRows(decided);

  if (plans.isError) {
    return <Alert tone="danger">{plans.error.message}</Alert>;
  }

  const named = client.data?.client.fullName ?? "";
  const dayOf = new Map((history.data?.points ?? []).map((one) => [one.revision, one.valuedOn]));

  return (
    <div className="space-y-5">
      <div>
        <Link
          to={`/portfolio-clients/${customerId}`}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-700 underline-offset-2 hover:underline"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Back to this client's portfolio
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar name={named} />
            <div className="min-w-0">
              <h1 className="text-[1.625rem] font-bold">{named}</h1>
              <p className="font-mono text-xs text-ink-muted">{client.data?.client.code}</p>
            </div>
          </div>
          <Link
            to={`/portfolio-clients/${customerId}?from=moves`}
            className="text-sm font-medium text-primary-700 underline-offset-2 hover:underline"
          >
            Open their portfolio
          </Link>
        </div>
        <p className="mt-2 text-sm text-ink-muted">
          Every move of money between what this client holds. What the client asked for moved as it was
          written down; anything still waiting below was raised before that was so, and is answered here.
        </p>
      </div>

      {/* The same bar the queue this screen is reached from carries. One click apart and drawn two ways,
          the pair read as two different products — and a heading written out by hand here is one more copy
          of a line that is now said in one place. */}
      <section className="rounded-2xl border border-line bg-white">
        <QueueBar name="Waiting for approval" />
        {plans.isPending ? (
          <p className="px-5 py-8 text-sm text-ink-muted">Reading the plans…</p>
        ) : waiting.length === 0 ? (
          <p className="px-5 py-8 text-sm text-ink-muted">
            Nothing is waiting for this client. A client's own asking moves the money as it is written
            down, so nothing new arrives here.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {waiting.map((row) => (
              <li key={row.id} className="px-5 py-4">
                <WaitingPlan
                  row={row}
                  showClient={false}
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
              </li>
            ))}
          </ul>
        )}
      </section>

      {decided.length > 0 && (
        <section className="rounded-2xl border border-line bg-white">
          {/* Not "answered": one the person who raised it cancelled was never answered by anybody. */}
          <QueueBar name="Everything else asked for this client" />
          {/* A table, because that is what it is: the same facts about each one, and a reader looking
              down a column for who asked, or for when something was answered, should not be reading them
              out of a paragraph each time.
              What actually moved is the first of those facts and was the one missing. A row said the
              amount, the reason, the two names and the verdict — everything except which line the money
              came out of and which it went into. Somebody coming back a week later to ask "which move was
              that?" had the answer in the plan's own legs and nowhere on screen. */}
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <caption className="sr-only">
                Every move asked for {named} that is no longer waiting, newest first.
              </caption>
              <thead>
                <tr className="border-b border-line text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                  <th scope="col" className="px-5 py-3 text-right whitespace-nowrap">Amount</th>
                  <th scope="col" className="px-5 py-3">What moved</th>
                  <th scope="col" className="px-5 py-3">Why</th>
                  <th scope="col" className="px-5 py-3 whitespace-nowrap">Asked by</th>
                  <th scope="col" className="px-5 py-3 whitespace-nowrap">Answered by</th>
                  <th scope="col" className="px-5 py-3">What they said</th>
                  <th scope="col" className="px-5 py-3 text-right">Outcome</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {paged.shown.map((row) => (
                  <tr key={row.id}>
                    <td className="px-5 py-3 text-right tabular-nums font-medium whitespace-nowrap text-ink">
                      {exactly(row.amount, row.currency)}
                    </td>
                    <td className="px-5 py-3 text-ink-muted">
                      {/* Every leg, not the first. A plan is applied whole or not at all, so one leg of
                          five describes a fifth of what happened. */}
                      <ul className="space-y-0.5">
                        {row.legs.map((leg, at) => (
                          <li key={`${leg.fromSubClass ?? ""}-${leg.toSubClass ?? ""}-${at}`}>
                            <span className="tabular-nums">{exactly(leg.amount, row.currency)}</span>
                            {" out of "}
                            <span className="text-ink">{whatItIsCalled(leg.fromSubClass, leg.fromAssetClass, leg.fromSubSubClass)}</span>
                            {" into "}
                            <span className="text-ink">{whatItIsCalled(leg.toSubClass, leg.toAssetClass, leg.toSubSubClass)}</span>
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td className="px-5 py-3 text-ink">{row.why}</td>
                    <td className="px-5 py-3 whitespace-nowrap text-ink-muted">
                      {row.raisedByName}
                      <span className="block text-2xs">{formatDateTime(row.raisedAt)}</span>
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap text-ink-muted">
                      {/* Nobody answered one the raiser cancelled, and a dash says that better than a
                          blank, which reads as a figure somebody forgot to fill in. */}
                      {row.decidedByName ?? "—"}
                      {row.decidedAt && (
                        <span className="block text-2xs">{formatDateTime(row.decidedAt)}</span>
                      )}
                    </td>
                    {/* "NA" rather than a dash. An approval owes no reason — the note is asked for and
                        not demanded — so most of this column is empty by design, and a column of dashes
                        reads as a column that stopped working rather than one with nothing to say. */}
                    <td className="px-5 py-3 text-ink-muted">{row.decisionNote ?? "NA"}</td>
                    <td className="px-5 py-3 text-right">
                      <Badge tone={row.status === "APPROVED" ? "success" : "neutral"}>
                        {row.statusSaid}
                      </Badge>
                      {/* Where the money actually landed. An approved move writes a change like any
                          other, and this is the way from the decision to the figures it wrote — without
                          it the trail stops at "Approved" and the reader has to find the day themselves. */}
                      {row.appliedRevision !== null && (
                        dayOf.has(row.appliedRevision) ? (
                          <Link
                            to={`/portfolio-clients/${customerId}/days/${dayOf.get(row.appliedRevision)}`
                              + `/changes/${row.appliedRevision}`}
                            className="mt-0.5 block text-2xs font-medium text-primary-700 underline-offset-2 hover:underline"
                          >
                            wrote change {row.appliedRevision}
                          </Link>
                        ) : (
                          <span className="mt-0.5 block text-2xs text-ink-muted">
                            wrote change {row.appliedRevision}
                          </span>
                        )
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Outside the strip the table scrolls in, so the count keeps its place while the columns
              move under it. */}
          <PagedFooter paged={paged} noun={["move", "moves"]} />
        </section>
      )}

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
      />
    </div>
  );
}
