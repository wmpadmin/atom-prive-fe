import { ApiError } from "@atomprive/api-client";
import {
  useAnswerModelChange,
  useListModelChanges,
  type ModelChangePage,
  type ModelChangeRow,
  type ModelChangeRowStatus,
} from "@atomprive/api-client/backoffice";
import { Alert, Avatar, Badge, Button, FilterMenu, Pagination } from "@atomprive/ui";
import { AnswerDialog } from "./answer-dialog";
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

      {/* Five chips said the four states you are not reading alongside the one you are, and wrapped onto a
          second line to do it. One control says the state being read, and it is what every other list on
          this app filters with. */}
      <div className="w-fit">
        <span className="block text-2xs font-semibold tracking-wider text-ink-muted uppercase">Show</span>
        <FilterMenu
          label="Requests"
          value={tab}
          options={TABS}
          onChange={(next) => {
            setTab(next);
            setPage(0);
          }}
        />
      </div>

      {requests.isError && <Alert tone="danger">{requests.error.message}</Alert>}
      {answer.isError && <Alert tone="danger">{answer.error.message}</Alert>}

      <section className="overflow-hidden rounded-2xl border border-line bg-white">
        <h2 className="border-b border-line px-5 py-3 text-2xs font-semibold tracking-wider text-ink-muted uppercase">
          {TABS.find((one) => one.id === tab)?.label}
        </h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                <th scope="col" className="py-3 pr-4 pl-5">Client</th>
                <th scope="col" className="px-4 py-3">Change</th>
                <th scope="col" className="px-4 py-3">Why</th>
                <th scope="col" className="px-4 py-3">Asked by</th>
                <th scope="col" className="px-4 py-3">Answered by</th>
                <th scope="col" className="px-4 py-3">Status</th>
                <th scope="col" className="py-3 pr-5 pl-4 text-right"><span className="sr-only">Answer</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {requests.isPending && (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-ink-muted">
                    Reading the requests…
                  </td>
                </tr>
              )}
              {!requests.isPending && rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-ink-muted">
                    {tab === "PENDING" ? "Nothing is waiting for approval." : "Nothing here."}
                  </td>
                </tr>
              )}
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="py-3 pr-4 pl-5">
                    <div className="flex items-center gap-3">
                      <Avatar name={row.clientName} />
                      <div>
                        <span className="block font-semibold">{row.clientName}</span>
                        <span className="block font-mono text-xs text-ink-muted">{row.clientCode}</span>
                      </div>
                    </div>
                  </td>
                  {/* Both ends named, so the row reads without opening anything. */}
                  <td className="px-4 py-3">
                    <span className="text-ink-muted">{row.fromModelName}</span>
                    <span aria-hidden="true" className="mx-2 text-ink-muted">→</span>
                    <span className="font-semibold">{row.toModelName}</span>
                  </td>
                  <td className="min-w-0 px-4 py-3 text-ink-soft">{row.why}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-ink-muted">
                    {row.raisedByName}
                    <span className="block text-2xs">{formatDateTime(row.raisedAt)}</span>
                  </td>
                  <td className="px-4 py-3 text-ink-muted">
                    {/* "NA" rather than a dash. Most of this column is empty by design — nothing waiting
                        has been answered yet — and a column of dashes reads as a column that stopped
                        working rather than one with nothing to say. */}
                    {row.decidedByName ?? "NA"}
                    {row.decidedAt && (
                      <span className="block text-2xs">{formatDateTime(row.decidedAt)}</span>
                    )}
                    {row.decisionNote && <span className="block text-2xs">{row.decisionNote}</span>}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={TONES[row.status]}>{row.statusLabel}</Badge>
                  </td>
                  <td className="py-3 pr-5 pl-4 text-right">
                    {/* Whoever asked cannot answer, so the buttons are not offered to them either. */}
                    {row.status === "PENDING" && mayAnswer && row.raisedBy !== user.id && (
                      <div className="flex items-center justify-end gap-2 whitespace-nowrap">
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
                      </div>
                    )}
                    {row.status === "PENDING" && mayAnswer && row.raisedBy === user.id && (
                      <p className="ml-auto max-w-56 text-xs text-ink-muted">
                        You asked for this one, so somebody else answers it.
                      </p>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

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
