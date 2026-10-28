import { ApiError } from "@atomprive/api-client";
import {
  getReadKycDocumentUrl,
  useListKycDocuments,
  type KycDocumentRow,
  type KycDocumentRowReviewState,
  type KycQueue,
} from "@atomprive/api-client/backoffice";
import { Alert, Avatar, Badge, Button, Pagination, cn } from "@atomprive/ui";
import { keepPreviousData } from "@tanstack/react-query";
import { ChevronRight, Download, Search } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { TextInput } from "@atomprive/ui";
import { ColumnPicker } from "../../components/column-picker";
import { ViewTabs } from "../../components/view-tabs";
import { useColumnDrag } from "../../lib/column-drag";
import { useTableView } from "../../lib/table-view";
import { downloadTextFile, openApiFile } from "../../lib/download";
import { formatRelative } from "../../lib/labels";
import { PAGE_SIZES } from "../../lib/page-sizes";
import { clientLine, fileMark, pageCount, reviewStateLabels, reviewStateTones } from "./kyc-labels";
import { PutOnFileBy } from "./kyc-who";
import { PickClientDialog } from "./pick-client-dialog";
import { ArchivedMark, archivedRow } from "../../components/archived-client";
import { useStaffUser } from "../../auth/session";
import { hasAnyAuthority, UPLOADS_CLIENT_DOCUMENTS } from "../../lib/permissions";

/**
 * Every KYC document waiting on Compliance, with the client it belongs to. Opening one goes to that client's
 * whole pack, since a paper is judged against the rest of what they have handed over, not on its own (#83).
 */
/** One column of the queue a reader may move: its heading, and what it draws on a row. */
type Column = {
  id: string;
  label: string;
  nowrap?: boolean;
  tone?: string;
  cell: (row: KycDocumentRow) => ReactNode;
};

/**
 * The columns a reader may move and take off, in the order the firm wrote them.
 *
 * <p>The client stays where it is and so does the way through to their pack: a paper with no client beside
 * it is a file name nobody can act on, and the button at the end has no heading to drag or to list.
 */
const MOVABLE: Column[] = [
  {
    id: "document",
    label: "Document",
    cell: (row) => (
      <div className="flex items-center gap-3">
        <span className="grid h-8 w-10 shrink-0 place-items-center rounded-md border border-line bg-slate-50 text-2xs font-bold text-ink-soft">
          {fileMark(row.contentType)}
        </span>
        <div className="min-w-0">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              void openApiFile(fileHref(row.id), row.fileName);
            }}
            className="block max-w-full truncate text-left font-semibold hover:text-primary-600"
          >
            {row.fileName}
          </button>
          <span className="block truncate text-xs text-ink-muted">{row.kindTitle}</span>
        </div>
      </div>
    ),
  },
  {
    id: "uploaded",
    label: "Uploaded",
    tone: "text-ink-soft",
    cell: (row) => <PutOnFileBy at={row.uploadedAt} by={row.uploadedByName} />,
  },
  {
    id: "pages",
    label: "Pages",
    nowrap: true,
    tone: "text-ink-soft tabular-nums",
    cell: (row) => pageCount(row.pages),
  },
  {
    id: "status",
    label: "Status",
    cell: (row) => <Badge tone={reviewStateTones[row.reviewState]}>{reviewStateLabels[row.reviewState]}</Badge>,
  },
];

export function KycDocumentReviewPage() {
  const navigate = useNavigate();
  const [state, setState] = useState<KycDocumentRowReviewState>("AWAITING_REVIEW");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);
  const [picking, setPicking] = useState(false);
  // Offered to whoever may actually put a paper on file. It was offered to everybody who could open
  // this screen, which after V201 means Compliance — and their journey ended on a client's pack with
  // no Upload on it, because deciding on papers and collecting them are now different desks.
  const mayAdd = hasAnyAuthority(useStaffUser(), ...UPLOADS_CLIENT_DOCUMENTS);
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
  const view = useTableView("kyc-documents", MOVABLE.map((one) => one.id));
  const drag = useColumnDrag(view);
  const byId = new Map(MOVABLE.map((one) => [one.id, one]));
  const shownColumns = view.shown.map((id) => byId.get(id)).filter((one) => one !== undefined);

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
            onClick={() => oldest && void navigate(`/kyc/${oldest.customerId}?from=review`)}
          >
            Review oldest
          </Button>
          {mayAdd && (
            <Button onClick={() => setPicking(true)}>
              Add a document
            </Button>
          )}
        </div>
      </header>

      <PickClientDialog
        open={picking}
        onClose={() => setPicking(false)}
        onChoose={(client) => void navigate(`/kyc/${client.id}?from=review`)}
      />

      {queue.isError && <Alert tone="danger">{queue.error.message}</Alert>}

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
            <p className="mt-0.5 text-xs text-ink-muted">Click a document to read it. Review opens the client's pack, where the decision is recorded.</p>
          </div>
          {/* The arrangements beside the search rather than above the card: both are ways of reading this
              one table, and a reader looking for either looks on this line. */}
          <div className="flex flex-wrap items-center gap-3">
            <ViewTabs
              views={view.views}
              current={view.current}
              edited={view.current === null ? view.arranged : view.changed}
              onPick={(name) => (name === null ? view.reset() : view.apply(name))}
              onSave={view.saveAs}
              onDelete={view.remove}
              firstLabel="Every document"
            />
            <ColumnPicker
              columns={MOVABLE.map((one) => ({ id: one.id, label: one.label }))}
              shown={new Set(view.shown)}
              order={view.order}
              arranged={view.arranged}
              onChange={(next) => {
                for (const one of MOVABLE) {
                  if (next.has(one.id) === view.hidden.includes(one.id)) view.toggle(one.id);
                }
              }}
              onMove={view.move}
              onReset={view.reset}
            />
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
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                <th scope="col" className="py-3 pr-4 pl-5">Client</th>
                {shownColumns.map((column, at) => (
                  <th
                    key={column.id}
                    scope="col"
                    {...drag.headingProps(column.id)}
                    className={cn(
                      "cursor-grab touch-none px-4 py-3 select-none",
                      column.nowrap && "whitespace-nowrap",
                      drag.dragging === column.id && "cursor-grabbing opacity-40",
                      drag.over === column.id && "bg-primary-50",
                    )}
                    title={`Drag to move ${column.label}`}
                  >
                    {column.label}
                    <span className="sr-only">
                      , column {at + 1} of {shownColumns.length}. Use the Columns button to move or hide it.
                    </span>
                  </th>
                ))}
                <th scope="col" className="py-3 pr-5 pl-4">
                  <span className="sr-only">Review</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {queue.isPending && (
                <tr>
                  <td colSpan={shownColumns.length + 2} className="px-5 py-10 text-center text-ink-muted">Loading the queue…</td>
                </tr>
              )}
              {queue.data && shown.length === 0 && (
                <tr>
                  <td colSpan={shownColumns.length + 2} className="px-5 py-10 text-center text-ink-muted">
                    {words ? "No document matches that." : `Nothing ${reviewStateLabels[state].toLowerCase()}.`}
                  </td>
                </tr>
              )}
              {shown.map((row) => (
                <tr
                  key={row.id}
                  // A deactivated client's paper stays on the queue and stops opening. The row is the
                  // record that it was here; the document behind it is the Admin's now.
                  onClick={
                    row.clientArchived ? undefined : () => void openApiFile(fileHref(row.id), row.fileName)
                  }
                  className={cn(
                    row.clientArchived ? archivedRow : "cursor-pointer hover:bg-slate-50/60",
                  )}
                >
                  <td className="py-3 pr-4 pl-5">
                    <div className="flex items-center gap-3">
                      <Avatar name={row.clientName} photo={row.clientPhoto} />
                      <div className="min-w-0">
                        <span className="block truncate font-semibold">{row.clientName}</span>
                        <span className="block truncate text-xs text-ink-muted">
                          {clientLine(row.clientType, row.clientCode)}
                        </span>
                        {row.clientArchived && <ArchivedMark />}
                      </div>
                    </div>
                  </td>
                  {/* The cells in the order the headings are in, out of the one list that holds both. */}
                  {shownColumns.map((column) => (
                    <td
                      key={column.id}
                      className={cn("px-4 py-3", column.nowrap && "whitespace-nowrap", column.tone)}
                    >
                      {column.cell(row)}
                    </td>
                  ))}
                  <td className="py-3 pr-5 pl-4 text-right">
                    <button
                      type="button"
                      onClick={(event) => {
                        // The row opens the paper; this opens the client's pack, where it is decided on.
                        event.stopPropagation();
                        void navigate(`/kyc/${row.customerId}?from=review`);
                      }}
                      className="inline-flex items-center gap-1 rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-semibold text-ink hover:bg-slate-50"
                    >
                      Review
                      <ChevronRight aria-hidden="true" className="size-3.5" />
                    </button>
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
    </div>
  );
}


/** Where a document is read. It is served through the API, so every look is recorded against the client. */
function fileHref(documentId: string) {
  return `/api${getReadKycDocumentUrl(documentId).replace("/api", "")}`;
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
