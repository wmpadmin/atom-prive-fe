import type { ClearanceRow, DeadlineChangeRow, RequestClearances } from "@atomprive/api-client/backoffice";
import { Badge, cn } from "@atomprive/ui";
import { formatDate } from "../../lib/labels";
import { deadlineSaid, standingLabels, standingTones } from "./clearance-labels";

/**
 * Where a client's clearance has got to, desk by desk.
 *
 * <p>One component because four screens show the same thing: the client's own file, the shared
 * pipeline, the Admin's review and the desk's own list. Four drawings of one answer is how two screens
 * come to disagree about whether Compliance has cleared something.
 */
export function ClearancePanel({ standing }: { standing: RequestClearances }) {
  const days = deadlineSaid(standing.daysLeft, standing.overdue);
  const share = standing.asked === 0 ? 0 : Math.round((standing.cleared / standing.asked) * 100);

  return (
    <section className="rounded-2xl border border-line bg-white">
      <div className="flex flex-wrap items-start justify-between gap-4 px-6 pt-5 pb-4">
        <div>
          <h2 className="text-base font-bold">Clearance from the desks</h2>
          <p className="mt-0.5 text-xs text-ink-muted">
            {standing.startedAt
              ? "Every desk that holds work on this client has been asked."
              : "Operations has not sent the question out yet."}
          </p>
        </div>
        {standing.deadline && (
          <div className="text-right">
            <p className="text-xs text-ink-muted">Wanted by</p>
            <p className="text-sm font-semibold">{formatDate(standing.deadline)}</p>
            {days && (
              <p className={cn("text-xs", standing.overdue ? "text-danger" : "text-ink-muted")}>{days}</p>
            )}
          </div>
        )}
      </div>

      {/* The first entry is the date being set, not moved, so a date nobody has touched shows nothing. */}
      {standing.deadlineMoves.some((move) => move.was) && <DeadlineMoves moves={standing.deadlineMoves} />}

      {standing.asked > 0 && (
        <div className="px-6 pb-4">
          <div className="flex items-baseline justify-between text-sm">
            <span className="font-medium">
              {standing.cleared} of {standing.asked} gone ahead
            </span>
            <span className="text-ink-muted tabular-nums">{share}%</span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-canvas">
            <div
              className={cn("h-full rounded-full", standing.clear ? "bg-emerald-500" : "bg-primary-600")}
              style={{ width: `${share}%` }}
            />
          </div>
        </div>
      )}

      <div className="overflow-x-auto border-t border-line">
        <table className="min-w-full text-sm">
          <caption className="sr-only">What each desk has said about this client.</caption>
          <thead>
            <tr className="border-b border-line text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
              <th scope="col" className="py-3 pr-4 pl-6">Desk</th>
              <th scope="col" className="px-4 py-3">Said</th>
              <th scope="col" className="px-4 py-3">When</th>
              <th scope="col" className="py-3 pr-6 pl-4">Comments</th>
            </tr>
          </thead>
          <tbody>
            {standing.roles.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-10 text-center text-ink-muted">
                  Nobody has been asked yet. Operations sends the question out with the date it is all
                  wanted by.
                </td>
              </tr>
            ) : (
              standing.roles.map((row) => <DeskRow key={row.id} row={row} />)
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function DeskRow({ row }: { row: ClearanceRow }) {
  return (
    <tr className="border-b border-line last:border-b-0">
      <th scope="row" className="py-3 pr-4 pl-6 text-left font-medium">
        {row.roleSaid}
        {/* Said on the reader's own row rather than only in the panel below, because a desk scanning
            this table is looking for the line they have to answer. */}
        {row.mine && <span className="ml-2 text-2xs font-normal text-ink-muted">yours</span>}
      </th>
      <td className="px-4 py-3">
        <Badge tone={standingTones[row.standing]}>{standingLabels[row.standing]}</Badge>
      </td>
      <td className="px-4 py-3 text-ink-soft">
        {row.saidAt ? (
          <>
            {formatDate(row.saidAt)}
            {row.saidByName && <span className="block text-xs text-ink-muted">{row.saidByName}</span>}
          </>
        ) : (
          <span className="text-ink-muted">—</span>
        )}
      </td>
      <td className="py-3 pr-6 pl-4 text-ink-soft">
        {row.comments ?? <span className="text-ink-muted">—</span>}
        {row.hasAttachment && row.attachmentName && (
          <a
            href={`/api/backoffice/deactivations/clearances/${row.id}/document`}
            target="_blank"
            rel="noreferrer"
            className="mt-1 block text-xs font-semibold text-primary-700 underline underline-offset-2"
          >
            {row.attachmentName}
          </a>
        )}
      </td>
    </tr>
  );
}

/**
 * How the date got to be the date it is.
 *
 * <p>Shown wherever the date is, because a date that has moved twice reads very differently from one
 * that has not, and the Admin is the one who has to judge which this is.
 */
function DeadlineMoves({ moves }: { moves: DeadlineChangeRow[] }) {
  const moved = moves.filter((move) => move.was).length;
  return (
    <details className="mx-6 mb-4 rounded-xl border border-line bg-canvas px-4 py-2.5 text-sm">
      <summary className="cursor-pointer text-xs font-semibold text-ink-soft">
        Date moved {moved} {moved === 1 ? "time" : "times"}
      </summary>
      <ol className="mt-2 flex flex-col gap-2">
        {moves.map((move) => (
          <li key={move.changedAt} className="text-xs">
            <span className="font-medium text-ink">
              {move.was ? `${formatDate(move.was)} → ${formatDate(move.nowIs)}` : `Set to ${formatDate(move.nowIs)}`}
            </span>
            <span className="text-ink-muted">
              {" "}
              · {formatDate(move.changedAt)}
              {move.changedByName && ` by ${move.changedByName}`}
            </span>
            {move.why && <p className="mt-0.5 text-ink-soft">{move.why}</p>}
          </li>
        ))}
      </ol>
    </details>
  );
}
