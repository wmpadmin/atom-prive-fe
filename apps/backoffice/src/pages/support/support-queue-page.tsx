import { ApiError } from "@atomprive/api-client";
import { useSupportQueue, type TicketRow } from "@atomprive/api-client/backoffice";
import { TicketList } from "@atomprive/support/ticket-list";
import { useState } from "react";
import { Link } from "react-router";

/**
 * The IT Admin's queue: every ticket raised by a client or a member of staff, newest change first, filtered by
 * status and by who raised it.
 */

const FILTERS = [
  { id: "active", label: "Active", statuses: ["OPEN", "IN_PROGRESS", "WAITING"] },
  { id: "OPEN", label: "Open", statuses: ["OPEN"] },
  { id: "IN_PROGRESS", label: "In progress", statuses: ["IN_PROGRESS"] },
  { id: "WAITING", label: "Waiting on them", statuses: ["WAITING"] },
  { id: "done", label: "Resolved & closed", statuses: ["RESOLVED", "CLOSED"] },
] as const;

export function SupportQueuePage() {
  const queue = useSupportQueue<TicketRow[], ApiError>();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("active");
  const [from, setFrom] = useState<"" | "CLIENT" | "STAFF">("");
  const all = queue.data ?? [];
  const statuses: readonly string[] = FILTERS.find((one) => one.id === filter)?.statuses ?? [];
  const shown = all.filter((one) => statuses.includes(one.status) && (!from || one.raisedByType === from));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[1.625rem] font-bold text-balance">Support tickets</h1>
        <p className="mt-1 text-sm text-ink-muted">Technical problems raised by clients and staff.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((one) => (
          <button
            key={one.id}
            type="button"
            aria-pressed={filter === one.id}
            onClick={() => setFilter(one.id)}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${filter === one.id ? "border-primary-600 bg-primary-600 text-on-accent" : "border-line bg-white text-ink-soft hover:bg-sidebar"}`}
          >
            {one.label} <span className="opacity-80">{all.filter((ticket) => (one.statuses as readonly string[]).includes(ticket.status)).length}</span>
          </button>
        ))}
        <select
          id="support-from"
          aria-label="Raised by"
          value={from}
          onChange={(event) => setFrom(event.target.value as "" | "CLIENT" | "STAFF")}
          className="ml-auto h-9 rounded-xl border border-line bg-white px-3 text-sm"
        >
          <option value="">Raised by: anyone</option>
          <option value="CLIENT">Clients</option>
          <option value="STAFF">Staff</option>
        </select>
      </div>
      <section className="rounded-2xl border border-line bg-white p-5">
        {queue.isError ? (
          <p className="py-8 text-center text-sm text-red-600">The tickets could not be loaded.</p>
        ) : !queue.data ? (
          <div className="h-40 animate-pulse rounded-xl bg-sidebar" />
        ) : (
          <TicketList
            tickets={shown}
            side="support"
            showRaiser
            open={(ticket, children) => (
              <Link to={`/support/${ticket.id}`} className="hover:underline">
                {children}
              </Link>
            )}
            empty="No tickets here."
          />
        )}
      </section>
    </div>
  );
}
