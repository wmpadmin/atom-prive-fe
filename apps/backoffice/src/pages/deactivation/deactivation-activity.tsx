import type { RequestClearances } from "@atomprive/api-client/backoffice";
import { Badge } from "@atomprive/ui";
import { FileText } from "lucide-react";
import type { ReactNode } from "react";
import { formatDate, formatDateTime } from "../../lib/labels";
import { standingLabels, standingTones } from "./clearance-labels";

type Entry = { at: string; who?: string | null; what: ReactNode; note?: string | null; file?: string | null };

/**
 * Everything that has happened on this request, oldest first.
 *
 * <p>Put together from the things the request already keeps — when it was raised, every move of the
 * date, every answer a desk gave — rather than written to a log of its own. A second copy of what
 * happened is a copy that can disagree with the first.
 */
export function DeactivationActivity({ standing }: { standing: RequestClearances }) {
  const entries: Entry[] = [
    { at: standing.askedAt, who: standing.askedByName, what: "Raised the deactivation request", note: standing.reason },
    ...standing.deadlineMoves.map((move) => ({
      at: move.changedAt,
      who: move.changedByName,
      what: move.was
        ? `Moved the deadline from ${formatDate(move.was)} to ${formatDate(move.nowIs)}`
        : `Sent the clearance request to the desks, wanted by ${formatDate(move.nowIs)}`,
      note: move.was ? move.why : null,
    })),
    ...standing.answers.map((answer) => ({
      at: answer.saidAt,
      who: answer.saidByName,
      what: (
        <>
          Answered for {answer.roleSaid}:{" "}
          <Badge tone={standingTones[answer.standing]}>{standingLabels[answer.standing]}</Badge>
        </>
      ),
      note: answer.comments,
      file: answer.attachmentName,
    })),
  ].sort((one, other) => Date.parse(one.at) - Date.parse(other.at));

  return (
    <section className="rounded-2xl border border-line bg-white px-6 py-5">
      <h2 className="text-base font-bold">Activity log</h2>
      <p className="mt-0.5 text-xs text-ink-muted">
        Every step on this request, including answers a desk has since changed.
      </p>
      <ol className="mt-4 flex flex-col">
        {entries.map((entry, index) => (
          <li key={`${entry.at}-${index}`} className="relative flex gap-4 pb-5 last:pb-0">
            {index < entries.length - 1 && (
              <span aria-hidden="true" className="absolute top-3 bottom-0 left-[5px] w-px bg-line" />
            )}
            <span aria-hidden="true" className="relative mt-1.5 size-[11px] shrink-0 rounded-full border-2 border-primary-600 bg-white" />
            <div className="min-w-0 text-sm">
              <p className="text-ink">
                <span className="font-semibold">{entry.who ?? "Someone"}</span> · {entry.what}
              </p>
              <p className="text-xs text-ink-muted">{formatDateTime(entry.at)}</p>
              {entry.note && <p className="mt-1 text-ink-soft">{entry.note}</p>}
              {entry.file && (
                <p className="mt-1 inline-flex items-center gap-1 text-xs text-ink-muted">
                  <FileText aria-hidden="true" className="size-3.5" /> {entry.file}
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

/**
 * The papers the desks have put behind their answers.
 *
 * <p>Only the one each desk currently stands behind can be opened: a desk that answers again with a new
 * file replaces the old one. Earlier files are still named in the activity log, so it is clear one existed.
 */
export function DeactivationDocuments({ standing }: { standing: RequestClearances }) {
  const held = standing.roles.filter((row) => row.hasAttachment && row.attachmentName);
  return (
    <section className="rounded-2xl border border-line bg-white">
      <div className="px-6 pt-5 pb-4">
        <h2 className="text-base font-bold">Documents</h2>
        <p className="mt-0.5 text-xs text-ink-muted">What each desk has attached to its answer.</p>
      </div>
      {held.length === 0 ? (
        <p className="border-t border-line px-6 py-10 text-center text-sm text-ink-muted">
          No desk has attached anything yet.
        </p>
      ) : (
        <ul className="border-t border-line">
          {held.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-6 py-3 last:border-b-0">
              <span className="flex min-w-0 items-center gap-3">
                <FileText aria-hidden="true" className="size-4 shrink-0 text-primary-600" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{row.attachmentName}</span>
                  <span className="block text-xs text-ink-muted">
                    {row.roleSaid}
                    {row.saidByName && ` · ${row.saidByName}`}
                    {row.saidAt && ` · ${formatDate(row.saidAt)}`}
                  </span>
                </span>
              </span>
              <a
                href={`/api/backoffice/deactivations/clearances/${row.id}/document`}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-semibold text-primary-700 underline underline-offset-2"
              >
                Open
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
