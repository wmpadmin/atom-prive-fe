import { ApiError } from "@atomprive/api-client";
import {
  useAnswerModelChange,
  useListModelChanges,
  type ModelChangePage,
  type ModelChangeRow,
  type ModelChangeRowStatus,
} from "@atomprive/api-client/backoffice";
import { Alert, Avatar, Badge, Button, Dialog, Field, Pagination, TextArea, cn } from "@atomprive/ui";
import { ListPageHeader } from "../../components/record-list";
import { useState } from "react";
import { useStaffUser } from "../../auth/session";
import { hasAuthority } from "../../lib/permissions";
import { formatDateTime } from "../../lib/labels";

const TABS: { id: ModelChangeRowStatus | "all"; label: string }[] = [
  { id: "PENDING", label: "Waiting for approval" },
  { id: "APPROVED", label: "Approved" },
  { id: "REJECTED", label: "Rejected" },
  { id: "WITHDRAWN", label: "Cancelled" },
  { id: "all", label: "Everything" },
];

const TONES: Record<ModelChangeRowStatus, "neutral" | "success" | "danger" | "warning"> = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "danger",
  WITHDRAWN: "neutral",
};

/**
 * Requests to put a client on a different model, and the answers.
 *
 * <p>An advisor who thinks a client is on the wrong plan asks here, and whoever may move them answers.
 * Saying yes is what moves the client — there is no second step afterwards to forget.
 */
export function ModelChangesPage() {
  const user = useStaffUser();
  const mayAnswer = hasAuthority(user, "SEND_PROPOSALS:CHANGE");
  const [tab, setTab] = useState<ModelChangeRowStatus | "all">("PENDING");
  const [page, setPage] = useState(0);
  const [turningDown, setTurningDown] = useState<ModelChangeRow | null>(null);
  const [note, setNote] = useState("");

  const requests = useListModelChanges<ModelChangePage, ApiError>({
    status: tab === "all" ? undefined : tab,
    page,
    size: 25,
  });
  const answer = useAnswerModelChange<ApiError>({
    mutation: {
      onSuccess: () => {
        setTurningDown(null);
        setNote("");
        void requests.refetch();
      },
    },
  });

  const rows = requests.data?.items ?? [];

  return (
    <div className="space-y-6">
      <ListPageHeader
        title="Model changes"
        lead="Asking for a client to be measured against a different plan. Saying yes is what moves them."
      />

      <div role="tablist" aria-label="Model change requests" className="flex flex-wrap gap-2">
        {TABS.map((one) => (
          <button
            key={one.id}
            type="button"
            role="tab"
            aria-selected={tab === one.id}
            onClick={() => {
              setTab(one.id);
              setPage(0);
            }}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600",
              tab === one.id
                ? "border-primary-600 bg-primary-600 text-white"
                : "border-line bg-white text-ink-soft hover:text-ink",
            )}
          >
            {one.label}
          </button>
        ))}
      </div>

      {requests.isError && <Alert tone="danger">{requests.error.message}</Alert>}
      {answer.isError && <Alert tone="danger">{answer.error.message}</Alert>}

      <section className="overflow-hidden rounded-2xl border border-line bg-white">
        {requests.isPending ? (
          <p className="px-5 py-10 text-center text-sm text-ink-muted">Reading the requests…</p>
        ) : rows.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-ink-muted">
            {tab === "PENDING" ? "Nothing is waiting for approval." : "Nothing here."}
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((row) => (
              <li key={row.id} className="px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex min-w-0 items-start gap-3">
                    <Avatar name={row.clientName} />
                    <div className="min-w-0">
                      <p className="font-semibold">{row.clientName}</p>
                      <p className="font-mono text-xs text-ink-muted">{row.clientCode}</p>
                      {/* Both ends named, so the row reads without opening anything. */}
                      <p className="mt-2 text-sm">
                        <span className="text-ink-muted">{row.fromModelName}</span>
                        <span aria-hidden="true" className="mx-2 text-ink-muted">→</span>
                        <span className="font-semibold">{row.toModelName}</span>
                      </p>
                      <p className="mt-1 max-w-prose text-sm text-ink-soft">{row.why}</p>
                      <p className="mt-1.5 text-xs text-ink-muted">
                        Asked by {row.raisedByName} · {formatDateTime(row.raisedAt)}
                      </p>
                      {row.decidedByName && (
                        <p className="mt-0.5 text-xs text-ink-muted">
                          {row.statusLabel} by {row.decidedByName}
                          {row.decidedAt ? ` · ${formatDateTime(row.decidedAt)}` : ""}
                          {row.decisionNote ? ` — ${row.decisionNote}` : ""}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge tone={TONES[row.status]}>{row.statusLabel}</Badge>
                    {/* Whoever asked cannot answer, so the buttons are not offered to them either. */}
                    {row.status === "PENDING" && mayAnswer && row.raisedBy !== user.id && (
                      <>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setTurningDown(row);
                            setNote("");
                          }}
                        >
                          Reject
                        </Button>
                        <Button
                          size="sm"
                          disabled={answer.isPending}
                          onClick={() => answer.mutate({ id: row.id, data: { approved: true, note: null } })}
                        >
                          {answer.isPending ? "Moving them…" : "Approve and move them"}
                        </Button>
                      </>
                    )}
                    {row.status === "PENDING" && mayAnswer && row.raisedBy === user.id && (
                      <p className="max-w-56 text-xs text-ink-muted">
                        You asked for this one, so somebody else answers it.
                      </p>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        {(requests.data?.totalItems ?? 0) > 0 && (
          <div className="border-t border-line px-5 py-3">
            <Pagination
              page={page}
              pageSize={requests.data?.size ?? 25}
              totalItems={requests.data?.totalItems ?? 0}
              onPageChange={setPage}
              noun={["request", "requests"]}
            />
          </div>
        )}
      </section>

      {/* Rejecting one asks why, and what is said goes back to whoever asked. */}
      <Dialog
        open={turningDown !== null}
        title={turningDown ? `Reject the move for ${turningDown.clientName}?` : "Reject it"}
        onClose={() => setTurningDown(null)}
      >
        <div className="space-y-4">
          <p className="text-sm text-ink-muted">
            They stay on {turningDown?.fromModelName}. What you write here is shown to{" "}
            {turningDown?.raisedByName}.
          </p>
          <Field id="turn-down-note" label="Why not?" required>
            <TextArea id="turn-down-note" rows={3} value={note} onChange={(event) => setNote(event.target.value)} />
          </Field>
          {answer.isError && <Alert tone="danger">{answer.error.message}</Alert>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setTurningDown(null)}>
              Cancel
            </Button>
            <Button
              disabled={note.trim() === "" || answer.isPending}
              onClick={() =>
                turningDown
                && answer.mutate({ id: turningDown.id, data: { approved: false, note: note.trim() } })
              }
            >
              {answer.isPending ? "Rejecting…" : "Reject"}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
