import { ApiError } from "@atomprive/api-client";
import { getMyTicketsQueryKey, getRaiseTicketUrl, useMyTickets, type TicketRow } from "@atomprive/api-client/portal";
import { RaiseTicketDialog } from "@atomprive/support/raise-ticket-dialog";
import { TicketList } from "@atomprive/support/ticket-list";
import { Button } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import { LifeBuoy, Plus } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { lastPage } from "./last-page";

/**
 * Help &amp; Support: tickets for technical problems, raised here and answered by the firm's IT team. Open holds
 * what is still being worked on — including anything waiting on the client — and Closed what is done.
 */

const TABS = [
  { id: "open", label: "Open" },
  { id: "closed", label: "Resolved & closed" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const DONE = ["RESOLVED", "CLOSED"];

export function SupportPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab: TabId = params.get("tab") === "closed" ? "closed" : "open";
  const [raising, setRaising] = useState(false);
  const tickets = useMyTickets<TicketRow[], ApiError>();
  const all = tickets.data ?? [];
  const shown = all.filter((one) => (tab === "closed") === DONE.includes(one.status));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[1.625rem] font-bold text-balance text-ink">Help &amp; Support</h1>
          <p className="mt-1 text-sm text-ink-muted">Something not working? Raise a ticket and our IT team will help.</p>
        </div>
        <Button onClick={() => setRaising(true)}>
          <Plus aria-hidden="true" />
          Raise a ticket
        </Button>
      </div>

      <div role="tablist" aria-label="Tickets" className="flex gap-6 overflow-x-auto border-b border-line">
        {TABS.map((one) => (
          <button
            key={one.id}
            type="button"
            role="tab"
            aria-selected={tab === one.id}
            onClick={() => setParams({ tab: one.id }, { replace: true })}
            className={`-mb-px border-b-2 pb-2.5 text-sm font-semibold whitespace-nowrap ${tab === one.id ? "border-primary-600 text-primary-700" : "border-transparent text-ink-muted hover:text-ink"}`}
          >
            {one.label} ({all.filter((ticket) => (one.id === "closed") === DONE.includes(ticket.status)).length})
          </button>
        ))}
      </div>

      <section className="rounded-2xl border border-line bg-white p-5">
        {tickets.isError ? (
          <p className="py-8 text-center text-sm text-access-none-ink">Your tickets could not be loaded. Refresh the page to try again.</p>
        ) : !tickets.data ? (
          <div className="h-40 animate-pulse rounded-xl bg-sidebar" />
        ) : all.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <LifeBuoy aria-hidden="true" className="size-8 text-ink-muted" />
            <p className="text-sm text-ink-muted">You haven't raised any tickets.</p>
          </div>
        ) : (
          <TicketList
            tickets={shown}
            side="raiser"
            open={(ticket, children) => (
              <Link to={`/new/support/${ticket.id}`} className="hover:underline">
                {children}
              </Link>
            )}
            empty={tab === "open" ? "Nothing open." : "Nothing resolved or closed yet."}
          />
        )}
      </section>

      {raising && (
        <RaiseTicketDialog
          url={getRaiseTicketUrl()}
          pageUrl={lastPage()}
          onClose={() => setRaising(false)}
          onRaised={(raised) => {
            void queryClient.invalidateQueries({ queryKey: getMyTicketsQueryKey() });
            setRaising(false);
            void navigate(`/new/support/${raised.ticket.id}`);
          }}
        />
      )}
    </div>
  );
}
