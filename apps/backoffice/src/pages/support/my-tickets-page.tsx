import { ApiError } from "@atomprive/api-client";
import { getMyStaffTicketsQueryKey, getRaiseStaffTicketUrl, useMyStaffTickets, type TicketRow } from "@atomprive/api-client/backoffice";
import { RaiseTicketDialog } from "@atomprive/support/raise-ticket-dialog";
import { TicketList } from "@atomprive/support/ticket-list";
import { Button } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { lastPage } from "../../lib/last-page";

/** Any member of staff's own tickets: raise one for a technical problem and follow it to the end. */
export function MyTicketsPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [raising, setRaising] = useState(false);
  const tickets = useMyStaffTickets<TicketRow[], ApiError>();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[1.625rem] font-bold text-balance">Report an issue</h1>
          <p className="mt-1 text-sm text-ink-muted">Something not working? Raise a ticket and IT will help.</p>
        </div>
        <Button onClick={() => setRaising(true)}>
          <Plus aria-hidden="true" />
          Raise a ticket
        </Button>
      </div>
      <section className="rounded-2xl border border-line bg-white p-5">
        {tickets.isError ? (
          <p className="py-8 text-center text-sm text-red-600">Your tickets could not be loaded.</p>
        ) : !tickets.data ? (
          <div className="h-40 animate-pulse rounded-xl bg-sidebar" />
        ) : (
          <TicketList
            tickets={tickets.data}
            side="raiser"
            open={(ticket, children) => (
              <Link to={`/my-tickets/${ticket.id}`} className="hover:underline">
                {children}
              </Link>
            )}
            empty="You haven't raised any tickets."
          />
        )}
      </section>
      {raising && (
        <RaiseTicketDialog
          url={getRaiseStaffTicketUrl()}
          pageUrl={lastPage()}
          onClose={() => setRaising(false)}
          onRaised={(raised) => {
            void queryClient.invalidateQueries({ queryKey: getMyStaffTicketsQueryKey() });
            setRaising(false);
            void navigate(`/my-tickets/${raised.ticket.id}`);
          }}
        />
      )}
    </div>
  );
}
