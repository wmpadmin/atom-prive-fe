import { ApiError } from "@atomprive/api-client";
import { useReadMyClearances, type MyClearanceRow, type MyClearances } from "@atomprive/api-client/backoffice";
import { Alert, Badge, cn } from "@atomprive/ui";
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
              <th scope="col" className="py-3 pr-6 pl-4">Wanted by</th>
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
                  <td className="py-3 pr-6 pl-4">
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
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
