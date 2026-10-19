import { ApiError } from "@atomprive/api-client";
import {
  useAnswerTheMovePlan,
  useGetCustomer,
  useListClientMovePlans,
  type CustomerDetail,
  type MovePlanRow,
} from "@atomprive/api-client/backoffice";
import { Alert, Avatar, Badge } from "@atomprive/ui";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { formatDateTime } from "../../lib/labels";
import { exactly } from "./money-words";
import { AnswerDialog } from "./answer-dialog";
import { WaitingPlan } from "./moves-to-approve-page";

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
  // Back to the queue as it was being read, not to whichever way it opens by default.
  const cameBy = useSearchParams()[0].get("by");
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

  if (plans.isError) {
    return <Alert tone="danger">{plans.error.message}</Alert>;
  }

  const every = plans.data ?? [];
  const waiting = every.filter((one) => one.status === "PENDING");
  const decided = every.filter((one) => one.status !== "PENDING");
  const named = client.data?.client.fullName ?? "";

  return (
    <div className="space-y-5">
      <div>
        <Link
          to={cameBy === "client" ? "/moves-to-approve?by=client" : "/moves-to-approve"}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-700 underline-offset-2 hover:underline"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Back to moves to approve
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
          Every plan to move money between what this client holds. Nothing has moved: saying yes is what
          moves it.
        </p>
      </div>

      <section className="overflow-hidden rounded-2xl border border-line bg-white">
        <h2 className="border-b border-line px-5 py-3 text-2xs font-semibold tracking-wider text-ink-muted uppercase">
          Waiting for approval
        </h2>
        {plans.isPending ? (
          <p className="px-5 py-8 text-sm text-ink-muted">Reading the plans…</p>
        ) : waiting.length === 0 ? (
          <p className="px-5 py-8 text-sm text-ink-muted">Nothing is waiting for this client.</p>
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
        <section className="overflow-hidden rounded-2xl border border-line bg-white">
          {/* Not "answered": one the person who raised it cancelled was never answered by anybody. */}
          <h2 className="border-b border-line px-5 py-3 text-2xs font-semibold tracking-wider text-ink-muted uppercase">
            Everything else asked for this client
          </h2>
          {/* A table, because that is what it is: the same five facts about each one, and a reader looking
              down a column for who asked, or for when something was answered, should not be reading them
              out of a paragraph each time. */}
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <caption className="sr-only">
                Every move asked for {named} that is no longer waiting, newest first.
              </caption>
              <thead>
                <tr className="border-b border-line text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                  <th scope="col" className="px-5 py-3 text-right whitespace-nowrap">Amount</th>
                  <th scope="col" className="px-5 py-3">Why</th>
                  <th scope="col" className="px-5 py-3 whitespace-nowrap">Asked by</th>
                  <th scope="col" className="px-5 py-3 whitespace-nowrap">Answered by</th>
                  <th scope="col" className="px-5 py-3">What they said</th>
                  <th scope="col" className="px-5 py-3 text-right">Outcome</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {decided.map((row) => (
                  <tr key={row.id}>
                    <td className="px-5 py-3 text-right tabular-nums font-medium whitespace-nowrap text-ink">
                      {exactly(row.amount, row.currency)}
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
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
