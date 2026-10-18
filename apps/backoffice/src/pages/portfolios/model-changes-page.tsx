import { ApiError } from "@atomprive/api-client";
import {
  useAnswerModelChange,
  useListModelChanges,
  type ModelChangePage,
  type ModelChangeRow,
  type ModelChangeRowStatus,
} from "@atomprive/api-client/backoffice";
import { Alert, Avatar, Badge, Button, Pagination, cn } from "@atomprive/ui";
import { AnswerDialog } from "./answer-dialog";
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
  /** The change being answered and which way, because both answers are given in the same window now. */
  const [deciding, setDeciding] = useState<{ row: ModelChangeRow; approved: boolean } | null>(null);
  const [note, setNote] = useState("");

  const requests = useListModelChanges<ModelChangePage, ApiError>({
    status: tab === "all" ? undefined : tab,
    page,
    size: 25,
  });
  const answer = useAnswerModelChange<ApiError>({
    mutation: {
      onSuccess: () => {
        setDeciding(null);
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
                            setDeciding({ row, approved: false });
                            setNote("");
                          }}
                        >
                          Reject
                        </Button>
                        <Button
                          size="sm"
                          disabled={answer.isPending}
                          onClick={() => {
                            setDeciding({ row, approved: true });
                            setNote("");
                          }}
                        >
                          Approve and move them
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

      <AnswerDialog
        open={deciding !== null}
        approved={deciding?.approved ?? false}
        title={deciding
          ? `${deciding.approved ? "Approve" : "Reject"} the move for ${deciding.row.clientName}?`
          : "Answer it"}
        consequence={deciding?.approved
          ? `They move onto ${deciding.row.toModelName}.`
          : `They stay on ${deciding?.row.fromModelName}.`}
        shownTo={deciding?.row.raisedByName}
        note={note}
        onNote={setNote}
        busy={answer.isPending}
        error={answer.isError ? answer.error.message : null}
        onClose={() => setDeciding(null)}
        onConfirm={() => deciding && answer.mutate({
          id: deciding.row.id,
          data: { approved: deciding.approved, note: note.trim() === "" ? null : note.trim() },
        })}
        confirm={deciding?.approved ? "Approve and move them" : "Reject"}
        confirming={deciding?.approved ? "Moving them…" : "Rejecting…"}
      />
    </div>
  );
}
