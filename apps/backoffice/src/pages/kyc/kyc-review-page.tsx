import { ApiError } from "@atomprive/api-client";
import {
  useListKycDocuments,
  useListOnboardingCases,
  type CasePage,
  type KycDocumentRowReviewState,
  type KycQueue,
} from "@atomprive/api-client/backoffice";
import { Alert, Avatar, Badge, Button, Pagination, cn } from "@atomprive/ui";
import { keepPreviousData, type UseQueryResult } from "@tanstack/react-query";
import { ChevronRight, Download, Plus, Search } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { TextInput } from "@atomprive/ui";
import { downloadTextFile } from "../../lib/download";
import { formatRelative } from "../../lib/labels";
import { PAGE_SIZES } from "../../lib/page-sizes";
import { clientLine, fileMark, pageCount, reviewStateLabels, reviewStateTones } from "./kyc-labels";
import { PickClientDialog } from "./pick-client-dialog";

/**
 * Every KYC document waiting on Compliance, with the client it belongs to. Opening one goes to that client's
 * whole pack, since a paper is judged against the rest of what they have handed over, not on its own (#36).
 */
export function KycReviewPage() {
  const navigate = useNavigate();
  const [state, setState] = useState<KycDocumentRowReviewState>("AWAITING_REVIEW");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);
  const [picking, setPicking] = useState(false);
  /** The queue proper: the clients Operations have handed over. Documents are the other half of the job. */
  const [showing, setShowing] = useState<"clients" | "documents">("clients");

  const clients = useListOnboardingCases<CasePage, ApiError>(
    { signOff: "AWAITING", size: 50 },
    { query: { placeholderData: keepPreviousData } },
  );

  const queue = useListKycDocuments<KycQueue, ApiError>(
    { state, page, size },
    { query: { placeholderData: keepPreviousData } },
  );

  const words = search.trim().toLowerCase();
  const shown = (queue.data?.items ?? []).filter((row) =>
    !words
      ? true
      : [row.fileName, row.clientName, row.clientCode, row.kindTitle]
          .filter(Boolean)
          .some((said) => said.toLowerCase().includes(words)),
  );

  function show(next: KycDocumentRowReviewState) {
    setState(next);
    setPage(0);
  }

  /** The one that has waited longest, which is where Compliance should start. */
  const oldest = (queue.data?.items ?? [])[0];

  function exportQueue() {
    const header = ["Document", "Type", "Client", "Client code", "Pages", "Uploaded", "Status"];
    const lines = shown.map((row) => [
      row.fileName,
      row.kindTitle,
      row.clientName,
      row.clientCode,
      row.pages ?? "",
      row.uploadedAt,
      reviewStateLabels[row.reviewState],
    ]);
    const csv = [header, ...lines]
      .map((line) => line.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
      .join("\r\n");
    downloadTextFile(`kyc-${state.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`, csv, "text/csv");
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[1.625rem] font-bold">KYC document review</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Every document waiting on Compliance, with its client. Open one to review the client's pack and record
            the decision.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="secondary" onClick={exportQueue} disabled={shown.length === 0}>
            <Download aria-hidden="true" />
            Export
          </Button>
          <Button
            variant="secondary"
            disabled={oldest === undefined}
            title={oldest === undefined ? "Nothing is waiting" : undefined}
            onClick={() => oldest && void navigate(`/kyc/${oldest.customerId}`)}
          >
            Review oldest
          </Button>
          <Button onClick={() => setPicking(true)}>
            <Plus aria-hidden="true" />
            Add a document
          </Button>
        </div>
      </header>

      <PickClientDialog
        open={picking}
        onClose={() => setPicking(false)}
        onChoose={(client) => void navigate(`/kyc/${client.id}`)}
      />

      {queue.isError && <Alert tone="danger">{queue.error.message}</Alert>}

      <div role="tablist" aria-label="What to review" className="inline-flex max-w-full flex-wrap gap-1 rounded-xl border border-line bg-white p-1">
        {([
          ["clients", `Clients awaiting review${clients.data ? ` (${clients.data.totalItems})` : ""}`],
          ["documents", "Documents"],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={showing === id}
            onClick={() => setShowing(id)}
            className={cn(
              "rounded-lg px-6 py-2 text-sm font-medium transition-colors",
              showing === id ? "bg-primary-600 text-white" : "text-ink-soft hover:bg-slate-50",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {showing === "clients" && <ClientsAwaitingReview cases={clients} />}

      {showing === "documents" && (
      <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile
          label="Awaiting review"
          count={queue.data?.awaitingReview}
          note={
            queue.data?.oldestWaitingSince
              ? `Oldest waiting ${formatRelative(queue.data.oldestWaitingSince)}`
              : "Nothing waiting"
          }
          dot="bg-primary-600"
          chosen={state === "AWAITING_REVIEW"}
          onChoose={() => show("AWAITING_REVIEW")}
        />
        <Tile
          label="Re-upload"
          count={queue.data?.reUploadRequested}
          note="Waiting on the client"
          dot="bg-amber-500"
          chosen={state === "RE_UPLOAD_REQUESTED"}
          onChoose={() => show("RE_UPLOAD_REQUESTED")}
        />
        <Tile
          label="Approved"
          count={queue.data?.approved}
          note="Signed off by Compliance"
          dot="bg-emerald-500"
          chosen={state === "APPROVED"}
          onChoose={() => show("APPROVED")}
        />
        <Tile
          label="Rejected"
          count={queue.data?.rejected}
          note="Returned with a reason"
          dot="bg-red-500"
          chosen={state === "REJECTED"}
          onChoose={() => show("REJECTED")}
        />
      </div>

      <section className="rounded-2xl border border-line bg-white">
        <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5">
          <div>
            <h2 className="text-base font-bold">{reviewStateLabels[state]}</h2>
            <p className="mt-0.5 text-xs text-ink-muted">Click a document to open the client's review screen</p>
          </div>
          <div className="relative w-72 max-w-full">
            <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted" />
            <TextInput
              aria-label="Search document, client or type"
              placeholder="Search document, client or type…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                <th scope="col" className="py-3 pr-4 pl-5">Document</th>
                <th scope="col" className="px-4 py-3">Client</th>
                <th scope="col" className="px-4 py-3">Uploaded</th>
                <th scope="col" className="px-4 py-3">Pages</th>
                <th scope="col" className="px-4 py-3">Status</th>
                <th scope="col" className="py-3 pr-5 pl-4">
                  <span className="sr-only">Review</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {queue.isPending && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-ink-muted">Loading the queue…</td>
                </tr>
              )}
              {queue.data && shown.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-ink-muted">
                    {words ? "No document matches that." : `Nothing ${reviewStateLabels[state].toLowerCase()}.`}
                  </td>
                </tr>
              )}
              {shown.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => void navigate(`/kyc/${row.customerId}`)}
                  className="cursor-pointer hover:bg-slate-50/60"
                >
                  <td className="py-3 pr-4 pl-5">
                    <div className="flex items-center gap-3">
                      <span className="grid h-8 w-10 shrink-0 place-items-center rounded-md border border-line bg-slate-50 text-2xs font-bold text-ink-soft">
                        {fileMark(row.contentType)}
                      </span>
                      <div className="min-w-0">
                        <span className="block truncate font-semibold">{row.fileName}</span>
                        <span className="block truncate text-xs text-ink-muted">{row.kindTitle}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={row.clientName} />
                      <div className="min-w-0">
                        <span className="block truncate font-semibold">{row.clientName}</span>
                        <span className="block truncate text-xs text-ink-muted">
                          {clientLine(row.clientType, row.clientCode)}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-ink-soft">{formatRelative(row.uploadedAt)}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-ink-soft tabular-nums">{pageCount(row.pages)}</td>
                  <td className="px-4 py-3">
                    <Badge tone={reviewStateTones[row.reviewState]}>{reviewStateLabels[row.reviewState]}</Badge>
                  </td>
                  <td className="py-3 pr-5 pl-4 text-right">
                    <span className="inline-flex items-center gap-1 rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-semibold text-ink">
                      Review
                      <ChevronRight aria-hidden="true" className="size-3.5" />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {(queue.data?.totalItems ?? 0) > 0 && (
          <div className="border-t border-line px-5 py-3">
            <Pagination
              page={page}
              pageSize={size}
              totalItems={queue.data?.totalItems ?? 0}
              onPageChange={setPage}
              pageSizes={PAGE_SIZES}
              onPageSizeChange={(next) => {
                setSize(next);
                setPage(0);
              }}
              noun={["document", "documents"]}
            />
          </div>
        )}
      </section>
      </>
      )}
    </div>
  );
}

/**
 * The clients Operations have handed over for KYC. This is the queue proper: Operations finish a client's
 * forms, submit them for KYC, and the client lands here for Compliance to review and sign off.
 */
function ClientsAwaitingReview({ cases }: { cases: UseQueryResult<CasePage, ApiError> }) {
  const navigate = useNavigate();
  const rows = cases.data?.items ?? [];
  return (
    <section className="rounded-2xl border border-line bg-white">
      <div className="px-5 pt-5">
        <h2 className="text-base font-bold">Clients awaiting KYC review</h2>
        <p className="mt-0.5 text-xs text-ink-muted">
          Sent over by Operations once the client's forms are in. Open one to read what was submitted and sign it
          off.
        </p>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
              <th scope="col" className="py-3 pr-4 pl-5">Client</th>
              <th scope="col" className="px-4 py-3">Forms</th>
              <th scope="col" className="px-4 py-3">Relationship manager</th>
              <th scope="col" className="px-4 py-3">Waiting since</th>
              <th scope="col" className="py-3 pr-5 pl-4">
                <span className="sr-only">Review</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {cases.isPending && (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-ink-muted">Loading the queue…</td>
              </tr>
            )}
            {cases.data && rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-ink-muted">
                  No client is waiting for KYC review. Operations send them over once the forms are in.
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr
                key={row.id}
                onClick={() => void navigate(`/kyc/cases/${row.id}`)}
                className="cursor-pointer hover:bg-slate-50/60"
              >
                <td className="py-3 pr-4 pl-5">
                  <div className="flex items-center gap-3">
                    <Avatar name={row.clientName} />
                    <div className="min-w-0">
                      <span className="block truncate font-semibold">{row.clientName}</span>
                      <span className="block truncate text-xs text-ink-muted">
                        {row.clientType === "ENTITY" ? "Entity" : `${row.accountHolders} account holder${row.accountHolders === 1 ? "" : "s"}`}
                      </span>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-ink-soft tabular-nums">
                  {row.completedSteps} of {row.totalSteps}
                </td>
                <td className="px-4 py-3 text-ink-soft">{row.relationshipManager?.fullName ?? "—"}</td>
                <td className="px-4 py-3 whitespace-nowrap text-ink-soft">{formatRelative(row.updatedAt)}</td>
                <td className="py-3 pr-5 pl-4 text-right">
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary-700">
                    Review
                    <ChevronRight aria-hidden="true" className="size-3.5" />
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** One of the counts across the top, which also chooses what the table below shows. */
function Tile({
  label,
  count,
  note,
  dot,
  chosen,
  onChoose,
}: {
  label: string;
  count: number | undefined;
  note: string;
  dot: string;
  chosen: boolean;
  onChoose: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={chosen}
      onClick={onChoose}
      className={cn(
        "rounded-2xl border bg-white px-6 py-5 text-left transition-colors",
        chosen ? "border-primary-600 ring-1 ring-primary-600/20" : "border-line hover:border-primary-100",
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">{label}</p>
        <span aria-hidden="true" className={cn("size-2 rounded-full", dot)} />
      </div>
      <p className="mt-1 text-2xl font-bold tabular-nums">{count ?? "—"}</p>
      <p className="mt-0.5 text-xs text-ink-muted">{note}</p>
    </button>
  );
}
