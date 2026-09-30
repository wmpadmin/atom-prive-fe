import { ApiError } from "@atomprive/api-client";
import {
  getListDeactivationsQueryKey,
  useApproveDeactivation,
  useListDeactivations,
  useWithdrawDeactivation,
  type DeactivationQueue,
  type DeactivationRow,
} from "@atomprive/api-client/backoffice";
import { Alert, Badge, Button, Dialog, Field, TextArea, cn } from "@atomprive/ui";
import { keepPreviousData, useQueryClient } from "@tanstack/react-query";
import { UserX } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { useStaffUser } from "../../auth/session";
import { formatDate, formatDateTime } from "../../lib/labels";
import { hasAuthority } from "../../lib/permissions";

const statusLabels: Record<DeactivationRow["status"], string> = {
  ASKED: "Asked",
  APPROVED: "Closed",
  WITHDRAWN: "Taken back",
};

const statusTones: Record<DeactivationRow["status"], "warning" | "danger" | "neutral"> = {
  ASKED: "warning",
  APPROVED: "danger",
  WITHDRAWN: "neutral",
};

/**
 * Customer deactivation and data deletion approvals (#20, R20). A client asks for their account to go; they
 * keep it for thirty days with everything still theirs to read and take, and only once those have passed may
 * the firm close it.
 */
export function OffboardingTab() {
  const queryClient = useQueryClient();
  const [decided, setDecided] = useState(false);
  const [approving, setApproving] = useState<DeactivationRow | null>(null);
  const [note, setNote] = useState("");
  const [wrong, setWrong] = useState<string>();
  const canDecide = hasAuthority(useStaffUser(), "MANAGE_USERS_AND_ROLES:CHANGE");

  const queue = useListDeactivations<DeactivationQueue, ApiError>(
    { decided },
    { query: { placeholderData: keepPreviousData } },
  );
  function kept() {
    setApproving(null);
    setNote("");
    setWrong(undefined);
    void queryClient.invalidateQueries({ queryKey: getListDeactivationsQueryKey({ decided: false }) });
    void queryClient.invalidateQueries({ queryKey: getListDeactivationsQueryKey({ decided: true }) });
  }
  const onError = (caught: ApiError) => setWrong(caught.message);
  const approve = useApproveDeactivation<ApiError>({ mutation: { onSuccess: kept, onError } });
  const withdraw = useWithdrawDeactivation<ApiError>({ mutation: { onSuccess: kept, onError } });
  const busy = approve.isPending || withdraw.isPending;

  const rows = queue.data?.items ?? [];
  const awaiting = queue.data?.awaiting ?? 0;

  return (
    <section aria-labelledby="offboarding-title" className="rounded-2xl border border-line bg-white">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <h2 id="offboarding-title" className="text-base font-bold">
            Customer deactivation &amp; data deletion
          </h2>
          <p className="mt-0.5 text-xs text-ink-muted">
            A client keeps their account for thirty days after asking, with everything still theirs to read and
            take. The closure is approved only once those have passed; the reason and the approver are kept
            permanently in the audit log.
          </p>
        </div>
        <div className="flex gap-1">
          {([[false, `Waiting${awaiting > 0 ? ` (${awaiting})` : ""}`], [true, "Decided"]] as [boolean, string][]).map(
            ([which, label]) => (
              <button
                key={label}
                type="button"
                onClick={() => setDecided(which)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                  decided === which ? "bg-primary-100 text-ink" : "text-ink-muted hover:bg-canvas",
                )}
              >
                {label}
              </button>
            ),
          )}
        </div>
      </div>

      {wrong && (
        <div className="px-5 pt-4">
          <Alert tone="danger">{wrong}</Alert>
        </div>
      )}

      {queue.isLoading && <p className="px-5 py-8 text-center text-sm text-ink-muted">Loading…</p>}

      {!queue.isLoading && rows.length === 0 && (
        <div className="grid place-items-center px-6 py-14 text-center">
          <span className="grid size-11 place-items-center rounded-xl bg-primary-50 text-primary-600">
            <UserX className="size-5" aria-hidden="true" />
          </span>
          <p className="mt-3 font-semibold">
            {decided ? "Nothing has been decided yet" : "No off-boarding requests"}
          </p>
          <p className="mt-1 max-w-md text-sm text-ink-muted">
            {decided
              ? "A request appears here once it has been approved or taken back."
              : "When a client asks to close their account, the request appears here with the thirty days counting down."}
          </p>
        </div>
      )}

      {rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                <th scope="col" className="py-3 pr-4 pl-5">Client</th>
                <th scope="col" className="px-4 py-3">Asked</th>
                <th scope="col" className="px-4 py-3">{decided ? "Decided" : "They keep it until"}</th>
                <th scope="col" className="px-4 py-3">Standing</th>
                <th scope="col" className="py-3 pr-5 pl-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="py-3 pr-4 pl-5">
                    <Link to={`/clients/${row.customerId}`} className="font-semibold hover:text-primary-600">
                      {row.clientName}
                    </Link>
                    <p className="text-xs text-ink-muted">
                      {row.clientCode}
                      {row.reason ? ` · ${row.reason}` : ""}
                    </p>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-ink-soft">
                    {formatDate(row.askedAt)}
                    {row.askedByName && <span className="block text-xs">written down by {row.askedByName}</span>}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-ink-soft">
                    {decided
                      ? row.decidedAt
                        ? formatDateTime(row.decidedAt)
                        : "—"
                      : formatDate(row.graceEndsOn)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={statusTones[row.status]}>{statusLabels[row.status]}</Badge>
                    {row.status === "ASKED" && (
                      <p className="mt-0.5 text-xs text-ink-muted">
                        {row.graceHasPassed
                          ? "The thirty days are up."
                          : row.daysLeft === 1
                            ? "1 day left"
                            : `${row.daysLeft} days left`}
                      </p>
                    )}
                    {row.decidedByName && <p className="mt-0.5 text-xs text-ink-muted">by {row.decidedByName}</p>}
                  </td>
                  <td className="py-3 pr-5 pl-4 text-right whitespace-nowrap">
                    {row.status === "ASKED" && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={busy}
                          onClick={() => withdraw.mutate({ customerId: row.customerId })}
                        >
                          They changed their mind
                        </Button>
                        {canDecide && (
                          <Button
                            variant="danger"
                            size="sm"
                            className="ml-2"
                            disabled={busy || !row.graceHasPassed}
                            title={row.graceHasPassed ? undefined : "The client keeps the account until the thirty days are up."}
                            onClick={() => {
                              setWrong(undefined);
                              setApproving(row);
                            }}
                          >
                            Close the account
                          </Button>
                        )}
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog
        open={approving !== null}
        title="Close this account?"
        description={approving ? `${approving.clientName} · ${approving.clientCode}` : null}
        onClose={() => setApproving(null)}
      >
        <div className="space-y-4">
          <p className="text-sm text-ink-muted">
            The account is closed and the client is told. Their record stays on file: what the firm has to keep
            for the regulator is not deleted by this.
          </p>
          {wrong && <Alert tone="danger">{wrong}</Alert>}
          <Field id="closure-note" label="Anything to note about the closure">
            <TextArea id="closure-note" rows={3} value={note} onChange={(event) => setNote(event.target.value)} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setApproving(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={busy}
              onClick={() => approving && approve.mutate({ customerId: approving.customerId, data: { note: note || null } })}
            >
              {approve.isPending ? "Closing…" : "Close the account"}
            </Button>
          </div>
        </div>
      </Dialog>
    </section>
  );
}
