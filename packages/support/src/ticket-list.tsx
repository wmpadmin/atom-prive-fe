import type { TicketRow } from "@atomprive/api-client/portal";
import { MessageSquare } from "lucide-react";
import type { ReactNode } from "react";
import { TicketStatus } from "./ticket-status";

function when(at: string) {
  return new Date(at).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** Tickets as a table: reference, subject, who raised it where that matters, status and when it last changed. */
export function TicketList({
  tickets,
  side,
  open,
  showRaiser = false,
  empty,
}: {
  tickets: TicketRow[];
  side: "raiser" | "support";
  /** What a ticket's row links to: a link element wrapping its children. */
  open: (ticket: TicketRow, children: ReactNode) => ReactNode;
  showRaiser?: boolean;
  empty: string;
}) {
  if (tickets.length === 0) {
    return <p className="py-12 text-center text-sm text-ink-muted">{empty}</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-y border-line text-left text-2xs font-semibold tracking-wider whitespace-nowrap text-ink-muted uppercase">
            <th scope="col" className="py-3 pr-4 pl-3">Ticket</th>
            <th scope="col" className="px-4 py-3">Subject</th>
            {showRaiser && <th scope="col" className="px-4 py-3">Raised by</th>}
            <th scope="col" className="px-4 py-3">Status</th>
            <th scope="col" className="py-3 pr-3 pl-4">Last update</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {tickets.map((one) => (
            <tr key={one.id} className="hover:bg-sidebar">
              <td className="px-3 py-2.5 font-semibold whitespace-nowrap text-primary-700">{open(one, one.reference)}</td>
              <td className="px-3 py-2.5">
                {open(one, <span className="font-semibold text-ink">{one.subject}</span>)}
                {one.messages > 0 && (
                  <span className="ml-2 inline-flex items-center gap-1 text-xs text-ink-muted">
                    <MessageSquare aria-hidden="true" className="size-3" />
                    {one.messages}
                  </span>
                )}
              </td>
              {showRaiser && (
                <td className="px-3 py-2.5 whitespace-nowrap text-ink-soft">
                  {one.raisedByName} <span className="text-xs text-ink-muted">· {one.raisedByType === "CLIENT" ? "Client" : "Staff"}</span>
                </td>
              )}
              <td className="px-3 py-2.5">
                <TicketStatus status={one.status} side={side} />
              </td>
              <td className="px-3 py-2.5 whitespace-nowrap text-ink-soft tabular-nums">{when(one.updatedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
