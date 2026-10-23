import { ApiError } from "@atomprive/api-client";
import {
  useAnswerModelChange,
  useListModelChanges,
  type ModelChangePage,
  type ModelChangeRow,
  type ModelChangeRowStatus,
} from "@atomprive/api-client/backoffice";
import { Alert, Avatar, Badge, Button, Pagination } from "@atomprive/ui";
import { AnswerDialog } from "./answer-dialog";
import { QueueBar } from "./queue-bar";
import { QueueFilters } from "./queue-filters";
import { useState } from "react";
import { formatDateTime } from "../../lib/labels";
import { DEFAULT_PAGE_SIZE, PAGE_SIZES } from "../../lib/page-sizes";

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
 * <p>A relationship manager who thinks a client is on the wrong plan asks here, and whoever may move them
 * answers. Saying yes is what moves the client — there is no second step afterwards to forget.
 */
export function ModelChangesPage() {
  const [tab, setTab] = useState<ModelChangeRowStatus | "all">("PENDING");
  const [page, setPage] = useState(0);
  // Chosen rather than fixed, the same as every other queue. Twenty-five was written into the request and
  // nowhere offered, so the footer counted the rows but gave nobody a way to change how many there were.
  const [size, setSize] = useState<number>(DEFAULT_PAGE_SIZE);
  /** Narrowed the same way the proposals beside this are: by client, by date, and read either way up. */
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [newestFirst, setNewestFirst] = useState(true);
  /** The change being answered and which way, because both answers are given in the same window now. */
  const [deciding, setDeciding] = useState<{ row: ModelChangeRow; approved: boolean } | null>(null);
  const [note, setNote] = useState("");

  const requests = useListModelChanges<ModelChangePage, ApiError>({
    status: tab === "all" ? undefined : tab,
    // Matched against the client's name by the server: a request holds their id and not their name, so
    // this is the one end that can turn the one into the other.
    query: search.trim() === "" ? undefined : search.trim(),
    from: from === "" ? undefined : new Date(from).toISOString(),
    // A date range people read as "up to and including", so the day asked for is counted whole.
    to: to === "" ? undefined : new Date(new Date(to).getTime() + 86_400_000).toISOString(),
    newestFirst,
    page,
    size,
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
      {requests.isError && <Alert tone="danger">{requests.error.message}</Alert>}
      {answer.isError && <Alert tone="danger">{answer.error.message}</Alert>}

      <QueueFilters
        search={search}
        onSearch={(next) => {
          setSearch(next);
          setPage(0);
        }}
        searchPlaceholder="Search by client"
        show={{
          value: tab,
          options: TABS.map((one) => ({ id: one.id, label: one.label })),
          onChange: (next) => {
            setTab(next);
            setPage(0);
          },
        }}
        dated={{
          verb: "Asked",
          from,
          to,
          onFrom: (day) => { setFrom(day); setPage(0); },
          onTo: (day) => { setTo(day); setPage(0); },
        }}
        newestFirst={newestFirst}
        onNewestFirst={(next) => {
          setNewestFirst(next);
          setPage(0);
        }}
      />
      <section className="rounded-2xl border border-line bg-white">
        <QueueBar name="Model switch" />
        <div className="overflow-x-auto">
          <table className="w-full table-fixed text-sm">
            {/* Every column told what it gets, so none of them is decided by what happens to be in it.
                Left to the browser the widths moved row to row — a long reason squeezed "Answered by" onto
                two lines, and a row nobody may answer handed its share of the table to empty space. */}
            <colgroup>
              <col className="w-[18%]" />
              <col className="w-[20%]" />
              <col className="w-[14%]" />
              <col className="w-[16%]" />
              <col className="w-[13%]" />
              <col className="w-[13%]" />
              <col className="w-[6%]" />
            </colgroup>
            <thead>
              <tr className="border-b border-line text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                <th scope="col" className="py-3 pr-4 pl-5">Client</th>
                <th scope="col" className="px-4 py-3">Change</th>
                <th scope="col" className="px-4 py-3">Why</th>
                <th scope="col" className="px-4 py-3">Asked by</th>
                <th scope="col" className="px-4 py-3 whitespace-nowrap">Answered by</th>
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
                    {/* Offered on the server's own answer rather than on a permission read here. The
                        screen used to look up one authority and draw buttons for whoever held it — so a
                        client's own relationship manager, who may answer this, got no buttons, and the
                        row sat there with nothing on it and nothing said. mayAnswer is worked out with
                        the same rule the answering itself uses, so a button is never offered that would
                        then be refused and a row is never silent about why it has none. */}
                    {row.status === "PENDING" && row.mayAnswer && (
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
              pageSize={requests.data?.size ?? size}
              totalItems={requests.data?.totalItems ?? 0}
              onPageChange={setPage}
              pageSizes={PAGE_SIZES}
              onPageSizeChange={(next) => {
                setSize(next);
                setPage(0);
              }}
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
