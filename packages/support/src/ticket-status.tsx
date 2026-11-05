import { statusLabel } from "./ticket-status-label";

/**
 * A ticket's status as both portals write it. "Waiting" is waiting on whoever raised the ticket, so it reads to
 * them as "Waiting on you" and to support as "Waiting on them".
 */
const TONES: Record<string, string> = {
  OPEN: "bg-access-view-soft text-access-view-ink",
  IN_PROGRESS: "bg-blue-50 text-blue-700",
  WAITING: "bg-amber-50 text-amber-700",
  RESOLVED: "bg-access-full-soft text-access-full-ink",
  CLOSED: "bg-canvas text-ink-soft",
};

export function TicketStatus({ status, side }: { status: string; side: "raiser" | "support" }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${TONES[status] ?? TONES.CLOSED}`}>
      {statusLabel(status, side)}
    </span>
  );
}
