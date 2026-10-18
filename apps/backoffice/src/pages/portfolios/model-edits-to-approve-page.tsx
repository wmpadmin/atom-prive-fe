import { ApiError } from "@atomprive/api-client";
import {
  useAnswerTheModelEdit,
  useListModelEdits,
  type ModelEditQueue,
  type ModelEditRow,
} from "@atomprive/api-client/backoffice";
import { Alert, Badge, Button } from "@atomprive/ui";
import { useState } from "react";
import { Link } from "react-router";
import { ListPageHeader } from "../../components/record-list";
import { formatDateTime } from "../../lib/labels";
import { AnswerDialog } from "./answer-dialog";

/** Every class either side of the change names, in one list, so a class that is being dropped still has a row. */
function classesIn(row: ModelEditRow) {
  return [...new Set([...Object.keys(row.targetsNow), ...Object.keys(row.targetsAfter)])].sort();
}

/**
 * Signing off a change to a live model.
 *
 * <p>The one approval on the platform that is not about a single client, and could not be: a model is
 * shared, so an edit re-judges every client on it at once and there is no customer to key an ask on.
 * Answered by somebody holding the same authority as whoever asked, and never by them.
 */
export function ModelEditsToApprovePage() {
  const queue = useListModelEdits<ModelEditQueue, ApiError>({
    query: { refetchOnWindowFocus: true },
  });
  const [deciding, setDeciding] = useState<{ row: ModelEditRow; approved: boolean } | null>(null);
  const [note, setNote] = useState("");
  const [refused, setRefused] = useState<Record<string, string>>({});
  const answer = useAnswerTheModelEdit<ApiError>({
    mutation: {
      onSuccess: () => {
        setDeciding(null);
        setNote("");
        void queue.refetch();
      },
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
  const decided = queue.data?.decided ?? [];

  return (
    <div className="space-y-5">
      <ListPageHeader
        title="Model changes to approve"
        lead={"Changes to a plan clients are measured against. Nothing has changed: saying yes is what "
          + "writes it, for every client on the plan at once."}
      />

      <section className="overflow-hidden rounded-2xl border border-line bg-white">
        <h2 className="border-b border-line px-5 py-3 text-2xs font-semibold tracking-wider text-ink-muted uppercase">
          Waiting for sign-off
        </h2>
        {queue.isPending ? (
          <p className="px-5 py-8 text-sm text-ink-muted">Reading the asks…</p>
        ) : waiting.length === 0 ? (
          <p className="px-5 py-8 text-sm text-ink-muted">Nothing is waiting on you.</p>
        ) : (
          <ul className="divide-y divide-line">
            {waiting.map((row) => {
              const moving = classesIn(row)
                .filter((code) => (row.targetsNow[code] ?? 0) !== (row.targetsAfter[code] ?? 0));
              return (
                <li key={row.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <Link
                        to={`/model-portfolios/${row.modelPortfolioId}`}
                        className="font-semibold underline-offset-2 hover:underline"
                      >
                        {row.wasNamed}
                      </Link>
                      {row.wouldBeNamed !== row.wasNamed && (
                        <span className="text-sm text-ink-muted"> → {row.wouldBeNamed}</span>
                      )}
                      <p className="mt-1 text-sm">{row.why}</p>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      {/* The figure that makes this worth answering rather than pressing. */}
                      <Badge tone={row.holders > 0 ? "warning" : "neutral"}>
                        {row.holders === 0
                          ? "No client on it yet"
                          : row.holders === 1 ? "1 client re-judged" : `${row.holders} clients re-judged`}
                      </Badge>
                      {row.statusAfter !== row.statusNow && (
                        <Badge tone="warning">
                          {row.statusNow} → {row.statusAfter}
                        </Badge>
                      )}
                      {row.changedAt && <Badge tone="warning">Changed</Badge>}
                      {row.mayAnswer ? (
                        <>
                          <Button variant="secondary" size="sm"
                            onClick={() => { setDeciding({ row, approved: false }); setNote(""); }}>
                            Reject
                          </Button>
                          <Button size="sm" disabled={answer.isPending}
                            onClick={() => { setDeciding({ row, approved: true }); setNote(""); }}>
                            Sign it off
                          </Button>
                        </>
                      ) : (
                        <p className="max-w-56 text-xs text-ink-muted">
                          You asked for this one, so somebody else signs it off.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Only the classes whose target moves. A plan of ten where two changed is a table a
                      reader has to find two in, and the two are the whole ask. */}
                  <table className="mt-3 min-w-full text-sm">
                    <caption className="sr-only">What the plan would ask of each class.</caption>
                    <thead>
                      <tr className="border-y border-line text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                        <th scope="col" className="py-2 pr-3">Asset class</th>
                        <th scope="col" className="px-3 py-2 text-right">Asks now</th>
                        <th scope="col" className="py-2 pl-3 text-right">Would ask</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {moving.map((code) => {
                        const now = row.targetsNow[code] ?? 0;
                        const after = row.targetsAfter[code] ?? 0;
                        return (
                          <tr key={code}>
                            <th scope="row" className="py-2 pr-3 text-left font-medium text-ink">{code}</th>
                            <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap text-ink-muted">
                              {now.toFixed(2)}%
                            </td>
                            <td className={`py-2 pl-3 text-right font-semibold tabular-nums whitespace-nowrap ${
                              after > now ? "text-emerald-700" : "text-red-600"}`}>
                              {after.toFixed(2)}%
                            </td>
                          </tr>
                        );
                      })}
                      {moving.length === 0 && (
                        <tr>
                          <td colSpan={3} className="py-2 text-sm text-ink-muted">
                            No class target moves. What this asks for is elsewhere in the plan — its
                            bands, its lines, its name or whether it is live.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>

                  <p className="mt-3 text-xs text-ink-muted">
                    Asked by {row.raisedByName} · {formatDateTime(row.raisedAt)}
                  </p>
                  {row.changedAt && (
                    <p className="mt-1 text-xs font-medium text-amber-700">
                      Changed since it was asked · {formatDateTime(row.changedAt)}
                    </p>
                  )}
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

      {decided.length > 0 && (
        <section className="overflow-hidden rounded-2xl border border-line bg-white">
          <h2 className="border-b border-line px-5 py-3 text-2xs font-semibold tracking-wider text-ink-muted uppercase">
            Recently decided
          </h2>
          <ul className="divide-y divide-line">
            {decided.map((row) => (
              <li key={row.id} className="flex flex-wrap items-start justify-between gap-4 px-5 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{row.wasNamed}</p>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    {row.statusSaid}
                    {row.decidedByName && ` by ${row.decidedByName}`}
                    {row.decidedAt && ` · ${formatDateTime(row.decidedAt)}`}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    Asked by {row.raisedByName} · {formatDateTime(row.raisedAt)}
                  </p>
                  {row.decisionNote && <p className="mt-1 text-xs text-ink-muted">{row.decisionNote}</p>}
                </div>
                <Badge tone={row.status === "APPROVED" ? "success" : "neutral"}>{row.statusSaid}</Badge>
              </li>
            ))}
          </ul>
        </section>
      )}

      <AnswerDialog
        open={deciding !== null}
        approved={deciding?.approved ?? false}
        title={deciding
          ? `${deciding.approved ? "Sign off" : "Reject"} the change to ${deciding.row.wasNamed}?`
          : "Answer it"}
        consequence={deciding?.approved
          ? `The plan is written as asked, and every client on it is judged by it from this moment${
            deciding.row.holders > 0 ? ` — ${deciding.row.holders} of them` : ""}.`
          : "The plan stays exactly as it is."}
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
        confirm={deciding?.approved ? "Sign it off" : "Reject"}
        confirming={deciding?.approved ? "Writing it…" : "Rejecting…"}
      />
    </div>
  );
}
