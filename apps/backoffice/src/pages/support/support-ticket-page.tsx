import { ApiError, http } from "@atomprive/api-client";
import {
  getSupportQueueQueryKey,
  getSupportTicketFileUrl,
  getSupportTicketQueryKey,
  useSetTicketStatus,
  useSupportTicket,
  type TicketDetail,
} from "@atomprive/api-client/backoffice";
import { statusLabel } from "@atomprive/support/ticket-status-label";
import { TicketView } from "@atomprive/support/ticket-view";
import { Alert } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronLeft } from "lucide-react";
import { Link, useParams } from "react-router";

/** A ticket as the IT Admin works it: the conversation, a reply as the firm's support, and its status. */
export function SupportTicketPage() {
  const { id = "" } = useParams();
  const queryClient = useQueryClient();
  const detail = useSupportTicket<TicketDetail, ApiError>(id);
  const refreshed = (fresh: TicketDetail) => {
    queryClient.setQueryData(getSupportTicketQueryKey(id), fresh);
    void queryClient.invalidateQueries({ queryKey: getSupportQueueQueryKey() });
  };
  const status = useSetTicketStatus<ApiError>({ mutation: { onSuccess: refreshed } });

  const reply = async (body: string, files: File[]) => {
    const form = new FormData();
    form.append("body", body);
    for (const file of files) form.append("files", file);
    refreshed(await http<TicketDetail>(`/api/backoffice/support/tickets/${id}/messages`, { method: "POST", body: form }));
  };

  return (
    <div className="space-y-5">
      <Link to="/support" className="inline-flex items-center gap-1 text-sm font-semibold text-primary-700 hover:underline">
        <ChevronLeft aria-hidden="true" className="size-4" />
        Support tickets
      </Link>
      {detail.isError ? (
        <p className="rounded-2xl border border-line bg-white p-6 text-sm text-ink-muted">This ticket can't be found.</p>
      ) : !detail.data ? (
        <div className="h-96 animate-pulse rounded-2xl bg-white/60" />
      ) : (
        <>
          {status.error && <Alert tone="danger">{status.error.message}</Alert>}
          <TicketView
            detail={detail.data}
            side="support"
            fileUrl={(fileId) => getSupportTicketFileUrl(id, fileId)}
            onReply={reply}
            canReply
            actions={
              <select
                id="ticket-status"
                aria-label="Status"
                value={detail.data.ticket.status}
                disabled={status.isPending}
                onChange={(event) => status.mutate({ id, data: { status: event.target.value } })}
                className="h-9 rounded-xl border border-line bg-white px-3 text-sm font-semibold"
              >
                {["OPEN", "IN_PROGRESS", "WAITING", "RESOLVED", "CLOSED"].map((one) => (
                  <option key={one} value={one}>
                    {statusLabel(one, "support")}
                  </option>
                ))}
              </select>
            }
          />
        </>
      )}
    </div>
  );
}
