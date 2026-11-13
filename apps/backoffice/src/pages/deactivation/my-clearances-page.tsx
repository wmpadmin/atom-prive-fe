import { ApiError } from "@atomprive/api-client";
import {
  getReadMyClearancesQueryKey,
  useReadMyClearances,
  useSayClearance,
  type MyClearanceRow,
  type MyClearances,
  type SayClearanceRequestStanding,
} from "@atomprive/api-client/backoffice";
import { Alert, Badge, Button, cn, Dialog, Field, TextArea } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router";
import { useStaffUser } from "../../auth/session";
import { formatDate } from "../../lib/labels";
import { deadlineSaid, standingLabels, standingTones } from "./clearance-labels";

/**
 * What this reader's own desks still owe an answer on.
 *
 * <p>Their list rather than a filter on the pipeline. A desk arrives holding one question — what do I
 * still have to answer — and the pipeline answers a different one, which is what the whole firm is
 * waiting on. The rows are the reader's own desks and nobody else's.
 *
 * <p>Somebody who holds none of the desks asked sees an empty list rather than a refusal, which is the
 * truth about them: nothing is waiting on them.
 */
export function MyClearancesPage() {
  const mine = useReadMyClearances<MyClearances, ApiError>();

  if (mine.isError) {
    return <Alert tone="danger">{mine.error.message}</Alert>;
  }

  const rows = mine.data?.items ?? [];
  const waiting = mine.data?.waiting ?? 0;
  const owed = rows.filter((one) => one.standing !== "GO_AHEAD");
  const answered = rows.filter((one) => one.standing === "GO_AHEAD");

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-[1.625rem] font-bold">My clearance requests</h1>
        <p className="mt-1 max-w-prose text-sm text-ink-muted">
          Clients the firm is thinking of letting go, where one of your desks has been asked whether
          anything of yours is still outstanding.
        </p>
      </header>

      {mine.isPending ? (
        <p className="py-10 text-center text-sm text-ink-muted">Reading your desks…</p>
      ) : rows.length === 0 ? (
        <section className="grid place-items-center rounded-2xl border border-dashed border-line bg-white px-6 py-14 text-center">
          <p className="font-semibold">Nothing is waiting on you.</p>
          <p className="mt-1 max-w-md text-sm text-ink-muted">
            A client appears here when Operations asks the desks to clear their work before the firm
            stops acting for them.
          </p>
        </section>
      ) : (
        <>
          <p className="text-sm text-ink-soft">
            <span className="font-semibold">{waiting}</span>{" "}
            {waiting === 1 ? "client is" : "clients are"} waiting on you.
          </p>
          {owed.length > 0 && <Rows title="Still owed" rows={owed} />}
          {answered.length > 0 && <Rows title="Answered" rows={answered} />}
        </>
      )}
    </div>
  );
}

function Rows({ title, rows }: { title: string; rows: MyClearanceRow[] }) {
  // A relationship manager opens their clients from their own list; the all-clients address turns them away.
  const user = useStaffUser();
  const clientsAt = user.activeRole === "ADVISOR" ? "/my-clients" : "/clients";
  const [answering, setAnswering] = useState<MyClearanceRow | null>(null);
  return (
    <section className="rounded-2xl border border-line bg-white">
      <h2 className="px-6 pt-5 pb-4 text-base font-bold">{title}</h2>
      <div className="overflow-x-auto border-t border-line">
        <table className="min-w-full text-sm">
          <caption className="sr-only">{title}, with the desk each one was asked of.</caption>
          <thead>
            <tr className="border-b border-line text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
              <th scope="col" className="py-3 pr-4 pl-6">Client</th>
              <th scope="col" className="px-4 py-3">Your desk</th>
              <th scope="col" className="px-4 py-3">You said</th>
              <th scope="col" className="px-4 py-3">Wanted by</th>
              <th scope="col" className="py-3 pr-6 pl-4 text-right"><span className="sr-only">Answer</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const days = deadlineSaid(row.daysLeft, row.overdue);
              return (
                <tr key={`${row.requestId}-${row.role}`} className="border-b border-line last:border-b-0">
                  <th scope="row" className="py-3 pr-4 pl-6 text-left font-medium">
                    {/* Through to the client's own file, where the answer is actually given: a list that
                        cannot be acted on from is a list somebody reads and then goes looking. */}
                    <Link
                      to={`${clientsAt}/${row.customerId}`}
          state={{ tab: "deactivation" }}
                      className="text-ink hover:text-primary-700 hover:underline"
                    >
                      {row.clientName}
                    </Link>
                    <span className="block text-xs text-ink-muted">{row.clientCode}</span>
                  </th>
                  <td className="px-4 py-3 text-ink-soft">{row.roleSaid}</td>
                  <td className="px-4 py-3">
                    <Badge tone={standingTones[row.standing]}>{standingLabels[row.standing]}</Badge>
                    {row.comments && (
                      <span className="mt-1 block max-w-xs text-xs text-ink-muted">{row.comments}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {row.deadline ? (
                      <>
                        {formatDate(row.deadline)}
                        {days && (
                          <span
                            className={cn(
                              "block text-xs",
                              row.overdue ? "font-semibold text-danger" : "text-ink-muted",
                            )}
                          >
                            {days}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-ink-muted">—</span>
                    )}
                  </td>
                  {/* Answered here, for this desk: somebody holding several desks gives each its answer from this
                      one list, whichever role they happen to be working in. */}
                  <td className="py-3 pr-6 pl-4 text-right">
                    <Button size="sm" variant={row.standing === "AWAITED" ? "primary" : "secondary"} onClick={() => setAnswering(row)}>
                      {row.standing === "AWAITED" ? "Answer" : "Change answer"}
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {answering && <AnswerDialog row={answering} onClose={() => setAnswering(null)} />}
      </div>
    </section>
  );
}

/** One desk's answer on one client: go ahead, still pending, or blocked with the reason. */
function AnswerDialog({ row, onClose }: { row: MyClearanceRow; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [standing, setStanding] = useState<SayClearanceRequestStanding>(
    row.standing === "AWAITED" ? "GO_AHEAD" : (row.standing as SayClearanceRequestStanding),
  );
  const [comments, setComments] = useState(row.comments ?? "");
  // Set by a Save on "blocked" with no reason; the box then shows red until one is written.
  const [tried, setTried] = useState(false);
  const missing = standing === "BLOCKED" && !comments.trim();
  const say = useSayClearance<ApiError>({
    mutation: {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: getReadMyClearancesQueryKey() });
        onClose();
      },
    },
  });
  const choices: SayClearanceRequestStanding[] = ["GO_AHEAD", "PENDING", "BLOCKED"];
  return (
    <Dialog open title={`${row.clientName} · ${row.roleSaid}`} onClose={onClose}>
      <div className="space-y-4">
        <div role="radiogroup" aria-label="Your answer" className="grid grid-cols-3 overflow-hidden rounded-lg border border-line">
          {choices.map((one) => (
            <button
              key={one}
              type="button"
              role="radio"
              aria-checked={standing === one}
              onClick={() => setStanding(one)}
              className={cn("h-10 text-sm", standing === one ? "bg-primary-50 font-semibold text-primary-700" : "text-ink-soft hover:bg-slate-50")}
            >
              {standingLabels[one]}
            </button>
          ))}
        </div>
        <Field id="clearance-comments" label={standing === "BLOCKED" ? "What is blocking it" : "Note"} required={standing === "BLOCKED"}
          error={tried && missing ? "Say what is blocking it." : undefined}>
          <TextArea id="clearance-comments" rows={3} aria-invalid={tried && missing} value={comments} onChange={(event) => setComments(event.target.value)} />
        </Field>
        {say.error && <Alert tone="danger">{say.error.message}</Alert>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            disabled={say.isPending}
            onClick={() => {
              if (missing) {
                setTried(true);
                document.getElementById("clearance-comments")?.focus();
                return;
              }
              say.mutate({ customerId: row.customerId, data: { standing, comments: comments.trim() || null, role: row.role } });
            }}
          >
            Save answer
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
