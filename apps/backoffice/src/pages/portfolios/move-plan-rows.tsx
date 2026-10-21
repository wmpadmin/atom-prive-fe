import type { MovePlanRow } from "@atomprive/api-client/backoffice";
import { Alert, Avatar, Badge, Button, cn } from "@atomprive/ui";
import { formatDateTime } from "../../lib/labels";
import { exactly, figure, named, netted, overItsBand } from "./money-words";

/**
 * One plan waiting on an answer, with the buttons that answer it.
 *
 * <p>Drawn once and used by both ways of reading this screen. Grouped under a client the plan is the same
 * plan, and a row that said one thing in one view and another in the other would be two screens pretending
 * to be one.
 */
export function WaitingPlan({ row, showClient, answering, refusal, onApprove, onTurnDown }: {
  row: MovePlanRow;
  /** False where a card header already names the client, so the name is not said twice in a row. */
  showClient: boolean;
  answering: boolean;
  refusal: string | undefined;
  onApprove: () => void;
  onTurnDown: () => void;
}) {
  const moved = row.legs.some((leg) => leg.figuresMoved);
  const leaves = netted(row.legs);
  return (
    <>
      {/* Who and why across the top, the buttons at the far end of that same line, and the figures given
          the whole width underneath. Held in one flex row with the buttons, the tables were squeezed into
          whatever the text beside them left over — a column of numbers an inch wide in a card a yard
          wide, and two tables that lined up with nothing. */}
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
            <p className={cn("text-sm", showClient && "mt-1")}>{row.why}</p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {moved && <Badge tone="warning">Figures have moved</Badge>}
          {leaves.some((line) => overItsBand(line) > 0) && <Badge tone="warning">Past a band</Badge>}
          {row.legs.some((leg) => leg.landsOnAskedByOthers >= 1) && (
            <Badge tone="warning">Another plan lands here</Badge>
          )}
          {row.changedAt && <Badge tone="warning">Changed</Badge>}
          {/* Said, because it is the one reason a plan appears to somebody who does not advise the client.
              Unexplained it reads as somebody else's work turning up in your list. */}
          {row.nobodyCloserCanAnswer && <Badge tone="warning">Nobody else can answer this</Badge>}
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
      {/* Side by side where there is room, one above the other where there is not. They are two halves of
          one reading — what moves, and what that leaves — and apart they are two lists to hold in the
          head at once. */}
      <div className="mt-4 grid gap-x-10 gap-y-5 lg:grid-cols-2">
        {/* Each column is the same width in both tables, so the names start in one place and the figures
            end in one place whichever table the eye is in. Left to the content they lined up with
            nothing, which is most of what made this unreadable. */}
        <table className="w-full table-fixed text-sm">
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
        {/* The question an approver is actually answering is not what moves but what the client is left
            holding, and until now that was arithmetic they did themselves — across legs the screen never
            put side by side. */}
        <table className="w-full table-fixed text-sm">
          <caption className="border-b border-line pb-2 text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
            What it would leave
          </caption>
          <colgroup>
            <col className="w-[38%]" />
            <col className="w-[31%]" />
            <col className="w-[31%]" />
          </colgroup>
          <thead>
            <tr className="border-b border-line text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
              <th scope="col" className="py-2 pr-3">Line</th>
              <th scope="col" className="px-3 py-2 text-right">Holds now</th>
              <th scope="col" className="py-2 pl-3 text-right">Would hold</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {leaves.map((line) => (
              <tr key={line.name} className="align-top">
                <th scope="row" className="py-2.5 pr-3 text-left font-medium break-words text-ink">
                  {line.name}
                  {/* Said against the line, because it is the line whose figure has moved. */}
                  {line.heldWhenRaised !== null && (
                    <span className="mt-0.5 block text-xs font-normal text-amber-700">
                      held {figure(line.heldWhenRaised)} when this was asked for
                    </span>
                  )}
                  {/* The half nothing on this screen could ask before: another plan is waiting to put
                      money in here too. Each was weighed against the same figures and each sits inside
                      the band on its own. */}
                  {line.askedByOthers >= 1 && (
                    <span className="mt-0.5 block text-xs font-normal text-amber-700">
                      another waiting plan would add {figure(line.askedByOthers)} here too
                    </span>
                  )}
                  {overItsBand(line) > 0 && (
                    <span className="mt-0.5 block text-xs font-normal text-amber-700">
                      {figure(overItsBand(line))} past the {figure(line.mayHold ?? 0)} allowed
                    </span>
                  )}
                </th>
                <td className="px-3 py-2.5 text-right tabular-nums whitespace-nowrap text-ink-muted">
                  {figure(line.holdsNow)}
                </td>
                <td className={cn("py-2.5 pl-3 text-right tabular-nums whitespace-nowrap",
                  overItsBand(line) > 0 ? "font-semibold text-amber-700" : "text-ink")}>
                  {figure(line.wouldHold)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* An amount with no denominator beside it could be a rounding error or half the book. The
          currency is said here, once, rather than on every cell of two tables of it. */}
      <p className="mt-4 text-xs text-ink-muted">
        Figures in {row.currency}. {exactly(row.amount, row.currency)} of{" "}
        {exactly(row.underManagement, row.currency)} · Asked by {row.raisedByName} ·{" "}
        {formatDateTime(row.raisedAt)}
      </p>
      {/* Said on the row, because nothing else on the screen can say it: the list is ordered on when a
          plan was first asked for, and changing one deliberately leaves that alone — so an amended plan
          does not move, and somebody who read this an hour ago would answer figures that are no longer
          being asked about. */}
      {row.changedAt && (
        <p className="mt-1 text-xs font-medium text-amber-700">
          Changed since it was asked · {formatDateTime(row.changedAt)}
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

/** One plan nobody is waiting on any more — answered, or taken back before anybody answered it. */
export function DealtWithPlan({ row, showClient }: { row: MovePlanRow; showClient: boolean }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        {showClient && <p className="text-sm font-semibold">{row.clientName}</p>}
        <p className="mt-0.5 text-xs text-ink-muted">
          {exactly(row.amount, row.currency)} · {row.statusSaid}
          {row.decidedByName && ` by ${row.decidedByName}`}
          {row.decidedAt && ` · ${formatDateTime(row.decidedAt)}`}
        </p>
        {/* Who asked for it. The row said who answered and never who asked, which is the half somebody
            goes looking for when a decision is questioned later. */}
        <p className="mt-0.5 text-xs text-ink-muted">
          Asked by {row.raisedByName} · {formatDateTime(row.raisedAt)}
        </p>
        {/* What it actually did. The row carried an amount and a verdict and nothing about the money:
            somebody asking "which move was that, and where did it go?" a day later had the answer in the
            plan's own legs, sent down with every row, and nowhere on the screen they were reading.

            Every leg, not the first. A plan is applied whole or not at all, so one leg of five describes
            a fifth of what happened. */}
        {row.legs.length > 0 && (
          <ul className="mt-1 space-y-0.5 text-xs text-ink-muted">
            {row.legs.map((leg, at) => (
              <li key={`${leg.fromSubClass ?? ""}-${leg.toSubClass ?? ""}-${at}`}>
                <span className="tabular-nums">{figure(leg.amount)}</span>
                {" out of "}
                <span className="text-ink">
                  {named(leg.fromSubClass, leg.fromAssetClass, leg.fromSubSubClass)}
                </span>
                {" into "}
                <span className="text-ink">
                  {named(leg.toSubClass, leg.toAssetClass, leg.toSubSubClass)}
                </span>
              </li>
            ))}
          </ul>
        )}
        {row.why && <p className="mt-0.5 text-xs text-ink-muted">{row.why}</p>}
        {row.decisionNote && <p className="mt-1 text-xs text-ink-muted">{row.decisionNote}</p>}
      </div>
      <Badge tone={row.status === "APPROVED" ? "success" : "neutral"}>{row.statusSaid}</Badge>
    </div>
  );
}
