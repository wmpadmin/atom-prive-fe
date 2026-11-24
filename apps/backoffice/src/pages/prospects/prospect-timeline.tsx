import { ApiError } from "@atomprive/api-client";
import { useGetProspectTimeline, type TimelineEntry } from "@atomprive/api-client/backoffice";
import { formatDateTime, roleLabel } from "../../lib/labels";

/** Everything done on a prospect, newest first (scope §6): who did it, as which role, and when. */
export function ProspectTimeline({ prospectId }: { prospectId: string }) {
  const timeline = useGetProspectTimeline<TimelineEntry[], ApiError>(prospectId);
  if (timeline.isLoading) return <p className="text-sm text-ink-muted">Loading…</p>;
  if (timeline.isError) return <p className="text-sm text-red-700">{timeline.error.message}</p>;
  const rows = timeline.data ?? [];
  if (rows.length === 0) return <p className="text-sm text-ink-muted">Nothing recorded yet.</p>;
  return (
    <ol className="space-y-4 border-l-2 border-line pl-5">
      {rows.map((one, index) => (
        <li key={`${one.at}-${index}`} className="relative text-sm">
          <span className="absolute top-1 -left-[1.6rem] size-2.5 rounded-full border-2 border-primary-600 bg-white" aria-hidden="true" />
          <p className="text-xs text-ink-muted">
            {formatDateTime(one.at)}
            {one.by ? ` · ${one.by}` : ""}
            {one.role ? ` (${roleLabel(one.role)})` : ""}
          </p>
          <p className="font-semibold">{one.what}</p>
        </li>
      ))}
    </ol>
  );
}
