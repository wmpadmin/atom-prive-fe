import { ApiError } from "@atomprive/api-client";
import {
  useAnswerTheAllocationChange,
  useListAllocationChanges,
  type AllocationChangeQueue,
  type AllocationChangeRow,
} from "@atomprive/api-client/backoffice";
import { Alert, Avatar, Badge, Button, FilterMenu } from "@atomprive/ui";
import { useState } from "react";
import { Link } from "react-router";
import { ListPageHeader } from "../../components/record-list";
import { formatDateTime } from "../../lib/labels";
import { AnswerDialog } from "./answer-dialog";

/** What a reader can narrow the list to, in the order an ask passes through them. */
const STATUS_TABS = [
  { id: "PENDING", label: "Waiting for approval" },
  { id: "APPROVED", label: "Approved" },
  { id: "REJECTED", label: "Rejected" },
  { id: "WITHDRAWN", label: "Cancelled" },
  { id: "all", label: "Everything" },
] as const;

type StatusTab = (typeof STATUS_TABS)[number]["id"];

/** Money, written the way every other portfolio screen writes it. */
function exactly(amount: number, currency: string) {
  return `${currency} ${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** A figure without its currency, for a column of them. */
function figure(amount: number) {
  return amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Answering an ask to rewrite what a client holds.
 *
 * <p>Its own queue, for the same reason the restores have one: the three are answered by the same people
 * under the same rule but they are not the same question. A move is read by its legs, a restore by the
 * difference between two days, and this by the difference between what each line holds and what it is
 * being asked to hold — which is a table, because there is one row a line and most of them have not moved.
 */
export function AllocationsToApprovePage() {
  const queue = useListAllocationChanges<AllocationChangeQueue, ApiError>({
    query: { refetchOnWindowFocus: true },
  });
  const [status, setStatus] = useState<StatusTab>("PENDING");
  const [deciding, setDeciding] = useState<{ row: AllocationChangeRow; approved: boolean } | null>(null);
  const [note, setNote] = useState("");
  const [refused, setRefused] = useState<Record<string, string>>({});
  const answer = useAnswerTheAllocationChange<ApiError>({
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
  // One list to filter, because an ask is in exactly one state and the two the server sends are only where
  // it put them. Ordered waiting-first so "Everything" opens on what is still being asked.
  const shown = status === "all"
    ? [...waiting, ...decided]
    : [...waiting, ...decided].filter((row) => row.status === status);

  return (
    <div className="space-y-5">
      <ListPageHeader
        title="Figures to approve"
        lead={"Asks to rewrite what a client holds. Nothing has changed: saying yes is what writes them."}
      />

      {/* Two sections named the state a row was in and left the reader no way to ask for one: everything
          decided arrived at once, under everything still waiting, however long ago it was answered, and a
          rejected ask could only be found by reading past the approved ones. */}
      <div className="w-fit">
        <span className="block text-2xs font-semibold tracking-wider text-ink-muted uppercase">Show</span>
        <FilterMenu
          label="Asks"
          value={status}
          options={STATUS_TABS.map((one) => ({
            id: one.id,
            label: one.label,
            count: one.id === "all"
              ? waiting.length + decided.length
              : [...waiting, ...decided].filter((row) => row.status === one.id).length,
          }))}
          onChange={setStatus}
        />
      </div>

      <section className="overflow-hidden rounded-2xl border border-line bg-white">
        <h2 className="border-b border-line px-5 py-3 text-2xs font-semibold tracking-wider text-ink-muted uppercase">
          {STATUS_TABS.find((one) => one.id === status)?.label}
        </h2>
        {queue.isPending ? (
          <p className="px-5 py-8 text-sm text-ink-muted">Reading the asks…</p>
        ) : shown.length === 0 ? (
          <p className="px-5 py-8 text-sm text-ink-muted">
            {status === "PENDING" ? "Nothing is waiting on you." : "Nothing here."}
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {shown.map((row) => {
              // Nobody is waiting on this one, and what it would have changed is no longer a decision
              // anybody makes — so it is said in a line, not in a table of figures to weigh.
              if (row.status !== "PENDING") {
                return (
                  <li key={row.id} className="flex flex-wrap items-start justify-between gap-4 px-5 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{row.clientName}</p>
                      <p className="mt-0.5 text-xs text-ink-muted">
                        {exactly(row.netAum ?? row.netAumNow, row.currency)} · {row.statusSaid}
                        {row.decidedByName && ` by ${row.decidedByName}`}
                        {row.decidedAt && ` · ${formatDateTime(row.decidedAt)}`}
                      </p>
                      <p className="mt-0.5 text-xs text-ink-muted">
                        Asked by {row.raisedByName} · {formatDateTime(row.raisedAt)}
                      </p>
                      {row.decisionNote && (
                        <p className="mt-1 text-xs text-ink-muted">{row.decisionNote}</p>
                      )}
                    </div>
                    <Badge tone={row.status === "APPROVED" ? "success" : "neutral"}>{row.statusSaid}</Badge>
                  </li>
                );
              }
              const moving = row.lines.filter((line) => line.valueAmount !== line.heldNow);
              // The rest of the calculator, where this ask carries it. Shown only where it would change:
              // a row saying a loan stays what it is adds nothing to a decision about the lines.
              const loanMoving = row.coversTheRest && row.loanAmount !== null
                && row.loanAmount !== row.loanNow;
              const ownedAsked = row.ownedOutright.reduce((sum, one) => sum + one.valueAmount, 0);
              const ownedMoving = row.coversTheRest && ownedAsked !== row.ownedOutrightNow;
              return (
                <li key={row.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex min-w-0 items-start gap-3">
                      <Avatar name={row.clientName} />
                      <div className="min-w-0">
                        <Link
                          to={`/portfolio-clients/${row.customerId}`}
                          className="font-semibold underline-offset-2 hover:underline"
                        >
                          {row.clientName}
                        </Link>
                        <p className="font-mono text-xs text-ink-muted">{row.clientCode}</p>
                        <p className="mt-1 text-sm">{row.why}</p>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      {row.linesGoing > 0 && (
                        <Badge tone="warning">
                          {row.linesGoing === 1 ? "A line comes off" : `${row.linesGoing} lines come off`}
                        </Badge>
                      )}
                      {row.changedAt && <Badge tone="warning">Changed</Badge>}
                      {row.nobodyCloserCanAnswer && (
                        <Badge tone="warning">Nobody else can answer this</Badge>
                      )}
                      {row.mayAnswer ? (
                        <>
                          <Button variant="secondary" size="sm"
                            onClick={() => { setDeciding({ row, approved: false }); setNote(""); }}>
                            Reject
                          </Button>
                          <Button size="sm" disabled={answer.isPending}
                            onClick={() => { setDeciding({ row, approved: true }); setNote(""); }}>
                            Approve and write them
                          </Button>
                        </>
                      ) : (
                        <p className="max-w-56 text-xs text-ink-muted">
                          You asked for this one, so somebody else answers it.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Only the lines that would move. A portfolio of thirty lines where two changed is a
                      table of thirty rows a reader has to find two in, and the two are the whole ask. */}
                  <table className="mt-3 min-w-full text-sm">
                    <caption className="sr-only">What would change, line by line.</caption>
                    <thead>
                      <tr className="border-y border-line text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                        <th scope="col" className="py-2 pr-3">Line</th>
                        <th scope="col" className="px-3 py-2">Class</th>
                        <th scope="col" className="px-3 py-2 text-right">Holds now</th>
                        <th scope="col" className="py-2 pl-3 text-right">Would hold</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {moving.map((line) => (
                        <tr key={`${line.assetClass}-${line.name}`}>
                          <th scope="row" className="py-2 pr-3 text-left font-medium break-words text-ink">
                            {line.name}
                          </th>
                          <td className="px-3 py-2 break-words text-ink-muted">
                            {line.assetClassName || line.assetClass}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap text-ink-muted">
                            {figure(line.heldNow)}
                          </td>
                          <td className="py-2 pl-3 text-right tabular-nums whitespace-nowrap text-ink">
                            {figure(line.valueAmount)}
                          </td>
                        </tr>
                      ))}
                      {moving.length === 0 && !loanMoving && !ownedMoving && (
                        <tr>
                          <td colSpan={4} className="py-2 text-sm text-ink-muted">
                            No line changes figure. What this asks for is elsewhere — a line coming off,
                            or the total the client is measured against.
                          </td>
                        </tr>
                      )}
                    </tbody>
                    <tfoot>
                      {/* The rest of the calculator, under the lines rather than beside them, because
                          neither of these is a holding: a target is a share of money that can be moved
                          to reach it, and neither a debt nor a flat can be moved. They are asked for in
                          the same press all the same, and an approver who cannot see them is agreeing to
                          half of what is in front of them. */}
                      {loanMoving && (
                        <tr className="border-t border-line">
                          <th scope="row" colSpan={2} className="py-2 pr-3 text-left font-medium text-ink">
                            Loan
                          </th>
                          <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap text-ink-muted">
                            {figure(row.loanNow)}
                          </td>
                          <td className="py-2 pl-3 text-right tabular-nums whitespace-nowrap text-ink">
                            {figure(row.loanAmount ?? 0)}
                          </td>
                        </tr>
                      )}
                      {ownedMoving && (
                        <tr className={loanMoving ? undefined : "border-t border-line"}>
                          <th scope="row" colSpan={2} className="py-2 pr-3 text-left font-medium text-ink">
                            Owned outright
                            <span className="block text-xs font-normal text-ink-muted">
                              {row.ownedOutright.length === 0
                                ? "Nothing is left on the list"
                                : row.ownedOutright.map((one) => one.item).join(", ")}
                            </span>
                          </th>
                          <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap text-ink-muted">
                            {figure(row.ownedOutrightNow)}
                          </td>
                          <td className="py-2 pl-3 text-right tabular-nums whitespace-nowrap text-ink">
                            {figure(ownedAsked)}
                          </td>
                        </tr>
                      )}
                      <tr className="border-t-2 border-line font-semibold">
                        <th scope="row" colSpan={2} className="py-2 pr-3 text-left">
                          Measured against
                        </th>
                        <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap text-ink-muted">
                          {figure(row.netAumNow)}
                        </td>
                        <td className="py-2 pl-3 text-right tabular-nums whitespace-nowrap">
                          {row.netAum === null ? "—" : figure(row.netAum)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>

                  <p className="mt-3 text-xs text-ink-muted">
                    Figures in {row.currency}. {row.lines.length}{" "}
                    {row.lines.length === 1 ? "line" : "lines"} in all
                    {row.linesGoing > 0 && `, and ${row.linesGoing} the client holds that this stops naming`}
                    {" · "}Asked by {row.raisedByName} · {formatDateTime(row.raisedAt)}
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

      <AnswerDialog
        open={deciding !== null}
        approved={deciding?.approved ?? false}
        title={deciding
          ? `${deciding.approved ? "Approve" : "Reject"} the change for ${deciding.row.clientName}?`
          : "Answer it"}
        consequence={deciding?.approved
          ? "Every line this client holds is written as asked, and any the ask stops naming comes off."
          : "Nothing changes."}
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
        confirm={deciding?.approved ? "Approve and write them" : "Reject"}
        confirming={deciding?.approved ? "Writing them…" : "Rejecting…"}
      />
    </div>
  );
}
