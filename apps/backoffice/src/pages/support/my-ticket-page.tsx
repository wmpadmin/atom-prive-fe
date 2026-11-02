import { ApiError, http } from "@atomprive/api-client";
import {
  getMyStaffTicketFileUrl,
  getMyStaffTicketQueryKey,
  getMyStaffTicketsQueryKey,
  useCloseMyStaffTicket,
  useMyStaffTicket,
  useReopenMyStaffTicket,
  type TicketDetail,
} from "@atomprive/api-client/backoffice";
import { TicketView } from "@atomprive/support/ticket-view";
import { Alert, Button } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronLeft } from "lucide-react";
import { Link, useParams } from "react-router";

/** One of the member of staff's own tickets, as they follow it. */
export function MyTicketPage() {
  const { id = "" } = useParams();
  const queryClient = useQueryClient();
  const detail = useMyStaffTicket<TicketDetail, ApiError>(id);
  const refreshed = (fresh: TicketDetail) => {
    queryClient.setQueryData(getMyStaffTicketQueryKey(id), fresh);
    void queryClient.invalidateQueries({ queryKey: getMyStaffTicketsQueryKey() });
  };
  const close = useCloseMyStaffTicket<ApiError>({ mutation: { onSuccess: refreshed } });
  const reopen = useReopenMyStaffTicket<ApiError>({ mutation: { onSuccess: refreshed } });

  const reply = async (body: string, files: File[]) => {
    const form = new FormData();
    form.append("body", body);
    for (const file of files) form.append("files", file);
    refreshed(await http<TicketDetail>(`/api/backoffice/support/my-tickets/${id}/messages`, { method: "POST", body: form }));
  };

  return (
    <div className="space-y-5">
      <Link to="/my-tickets" className="inline-flex items-center gap-1 text-sm font-semibold text-primary-700 hover:underline">
        <ChevronLeft aria-hidden="true" className="size-4" />
        Report an issue
      </Link>
      {detail.isError ? (
        <p className="rounded-2xl border border-line bg-white p-6 text-sm text-ink-muted">This ticket can't be found.</p>
      ) : !detail.data ? (
        <div className="h-96 animate-pulse rounded-2xl bg-white/60" />
      ) : (
        <>
          {(close.error ?? reopen.error) && <Alert tone="danger">{(close.error ?? reopen.error)?.message}</Alert>}
          <TicketView
            detail={detail.data}
            side="raiser"
            fileUrl={(fileId) => getMyStaffTicketFileUrl(id, fileId)}
            onReply={reply}
            canReply={detail.data.ticket.status !== "CLOSED"}
            actions={
              detail.data.ticket.status === "CLOSED" || detail.data.ticket.status === "RESOLVED" ? (
                detail.data.canReopen && (
                  <Button variant="secondary" size="sm" disabled={reopen.isPending} onClick={() => reopen.mutate({ id })}>
                    Reopen
                  </Button>
                )
              ) : (
                <Button variant="secondary" size="sm" disabled={close.isPending} onClick={() => close.mutate({ id })}>
                  Close ticket
                </Button>
              )
            }
          />
        </>
      )}
    </div>
  );
}
