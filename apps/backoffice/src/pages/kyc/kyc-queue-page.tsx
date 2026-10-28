import { ApiError } from "@atomprive/api-client";
import {
  useListClientsForReview,
  useListOnboardingCases,
  type CasePage,
  type ReviewQueue,
  type ReviewRow,
} from "@atomprive/api-client/backoffice";
import { Alert, Avatar, Badge, SelectInput, TextInput, cn } from "@atomprive/ui";
import { keepPreviousData } from "@tanstack/react-query";
import { ChevronRight, Search } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router";
import { useStaffUser } from "../../auth/session";
import { ColumnPicker } from "../../components/column-picker";
import { ViewTabs } from "../../components/view-tabs";
import { useColumnDrag } from "../../lib/column-drag";
import { useTableView } from "../../lib/table-view";
import { formatRelative } from "../../lib/labels";
import { defaultPageSize } from "../../lib/page-sizes";
import { PagedFooter } from "../../lib/paged-rows";
import { hasAuthority } from "../../lib/permissions";
import { useDebouncedValue } from "../../lib/use-debounced-value";
import { clientTypeLabels } from "../clients/client-labels";
import { countryName } from "../../lib/countries";
import { standingLabels, standings } from "./kyc-labels-review";
import { reviewStateLabels, reviewStateTones } from "./kyc-labels";

/**
 * The queue Compliance work through: the clients whose KYC is pending.
 *
 * <p>Pending means somebody has sent something in and the firm has not decided yet, which is what there is to
 * work through. A client who has sent nothing is not here — there is nothing to decide on — and nor is one
 * already settled.
 *
 * <p>The papers themselves are decided on one by one on KYC document review; a form is read rather than decided
 * on here, since a filled-in form goes to the client's relationship manager to be signed.
 */
/** One column of the queue a reader may move: its heading, and what it draws on a row. */
type Column = {
  id: string;
  label: string;
  nowrap?: boolean;
  tone?: string;
  cell: (row: ReviewRow) => ReactNode;
};

/**
 * The columns a reader may move and take off, in the order the firm wrote them.
 *
 * <p>The client is not among them, and neither is the way in at the end: a row with no client on it does
 * not say whose KYC is waiting, and an action with no heading cannot be dragged or found in a list.
 */
const MOVABLE: Column[] = [
  // The first two are different questions, and a row that answered only one of them read as though a
  // client who had sent something had sent nothing. What is here to be looked at, and what is still to
  // come — so either may be taken off, but neither stands for the other.
  // Three columns read across one another — "Uploaded" and "This paper" here, "Put on file" at the end
  // of the row — each drawing one line per paper in the same order, so a row says what arrived, what
  // became of it, and when. Three rather than one because they are three questions, a reader wants to
  // run their eye down any one of them, and the firm can take off the ones it does not use. The dates
  // sit last at the firm's asking: what a paper is and where it has got to are what the queue is worked
  // on, and the day it landed is read once those two have been.
  {
    id: "uploaded",
    label: "Uploaded",
    cell: (row) => (row.papers.length > 0 ? (
      <ul className="space-y-0.5">
        {row.papers.map((paper, at) => (
          <li key={`${paper.kindTitle}-${at}`} className="font-semibold whitespace-nowrap text-ink-soft">
            {paper.kindTitle}
          </li>
        ))}
      </ul>
    ) : (
      <span className="text-ink-muted">Nothing sent yet</span>
    )),
  },
  {
    id: "review",
    // Named for what it is about rather than for what it is. Headed "Review" it sat two columns from
    // "Status" and the two read as one fact told twice: a reader cannot see from the words that one is
    // this paper and the other is the client. Most of the time they agree, which is what made it look
    // like a repeat; the times they do not are the times somebody needs the row.
    label: "This paper",
    cell: (row) => (row.papers.length > 0 ? (
      <ul className="space-y-0.5">
        {row.papers.map((paper, at) => (
          <li key={`${paper.kindTitle}-${at}`}>
            <Badge tone={reviewStateTones[paper.reviewState]}>{reviewStateLabels[paper.reviewState]}</Badge>
          </li>
        ))}
      </ul>
    ) : (
      <span className="text-ink-muted">Nothing to look at</span>
    )),
  },
  {
    id: "stillNeeded",
    label: "Still needed",
    nowrap: true,
    cell: (row) => (row.stillNeeded ? (
      <span className="text-ink-soft">{row.stillNeeded}</span>
    ) : (
      <span className="text-ink-muted">Nothing — every paper is in</span>
    )),
  },
  {
    // How far off the client is, beside what they owe next. One paper named says nothing about whether it
    // is the last of three or the first of six, and reading that off the row is the whole reason somebody
    // opens a client they then have nothing to do on.
    id: "checklist",
    label: "Papers in",
    nowrap: true,
    cell: (row) => {
      const done = row.papersRequired > 0 && row.papersIn === row.papersRequired;
      return (
        <span className="flex items-center gap-2 whitespace-nowrap">
          <span className={cn("font-semibold tabular-nums", done ? "text-emerald-700" : "text-ink-soft")}>
            {row.papersIn} of {row.papersRequired}
          </span>
          {/* Said as a bar as well as a figure, because a queue is scanned rather than read: three rows
              at "1 of 3" and one at "3 of 3" is a shape before it is a number. */}
          <span aria-hidden="true" className="flex gap-0.5">
            {Array.from({ length: row.papersRequired }, (_, at) => (
              <span
                key={at}
                className={cn("h-1.5 w-3 rounded-full", at < row.papersIn ? "bg-emerald-500" : "bg-slate-200")}
              />
            ))}
          </span>
        </span>
      );
    },
  },
  {
    id: "putOnFile",
    label: "Put on file",
    nowrap: true,
    cell: (row) => (row.papers.length > 0 ? (
      <ul className="space-y-0.5">
        {row.papers.map((paper, at) => (
          <li key={`${paper.kindTitle}-${at}`} className="whitespace-nowrap text-ink-soft tabular-nums">
            {formatRelative(paper.uploadedAt)}
          </li>
        ))}
      </ul>
    ) : (
      <span className="text-ink-muted">—</span>
    )),
  },
];

export function KycReviewQueuePage() {
  // Operations follow the same queue to see where a client has got to; the decision is Compliance's.
  const decides = hasAuthority(useStaffUser(), "APPROVE_ONBOARDING:CHANGE");
  const [typed, setTyped] = useState("");
  const [standing, setStanding] = useState("");
  const query = useDebouncedValue(typed, 250);
  // The server pages this queue itself and always had the page and the size to take; the screen asked for
  // fifty in one go and then drew no footer at all, so a fifty-first client in review was off the end of a
  // table that said nothing about having an end. The reader's own page is asked for instead.
  const [page, setPage] = useState(0);
  const [size, setSize] = useState<number>(defaultPageSize);
  const queue = useListClientsForReview<ReviewQueue, ApiError>(
    { query: query || undefined, standing: (standing || undefined) as never, page, size },
    { query: { placeholderData: keepPreviousData } },
  );
  // The cases whose papers are all in and which are waiting on the signature that activates the client.
  // A different question from the queue above, and a different table: that one is papers being reviewed,
  // this one is clients already reviewed and waiting on somebody. Asked only of whoever may sign, since
  // nobody else can act on it.
  const signing = useListOnboardingCases<CasePage, ApiError>(
    { signOff: "AWAITING", page: 0, size: 50 },
    { query: { enabled: decides, placeholderData: keepPreviousData } },
  );
  const awaiting = signing.data?.items ?? [];

  const rows = queue.data?.items ?? [];
  const found = queue.data?.totalItems ?? 0;
  const view = useTableView("kyc-queue", MOVABLE.map((one) => one.id));
  const drag = useColumnDrag(view);
  const byId = new Map(MOVABLE.map((one) => [one.id, one]));
  const shownColumns = view.shown.map((id) => byId.get(id)).filter((one) => one !== undefined);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-[1.625rem] font-bold">KYC review queue</h1>
        <p className="mt-1 text-sm text-ink-muted">
          {decides
            ? "The clients whose KYC is pending. Open one to read what they sent, then approve it or reject it with a reason."
            : "The clients whose KYC is pending. Open one to see where it has got to; the decision is Compliance's."}
        </p>
      </header>

      {queue.isError && <Alert tone="danger">{queue.error.message}</Alert>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile
          label="Pending review"
          count={queue.data?.pendingReview}
          hint={queue.data ? `${queue.data.readyForDecision} ready for the decision` : ""}
        />
        <Tile label="Expiring" count={queue.data?.expiring} hint="A paper lapses within 30 days" />
        <Tile label="Rejected" count={queue.data?.rejected} hint="Refused, with a reason on file" />
        <Tile label="Re-upload" count={queue.data?.reUpload} hint="Waiting on the client" />
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-60 flex-1">
          <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted" />
          <TextInput
            id="kyc-search"
            value={typed}
            // Back to the first page, because narrowing a long queue from page four otherwise leaves the
            // reader standing past the end of what is left and reading an empty table.
            onChange={(event) => {
              setTyped(event.target.value);
              setPage(0);
            }}
            placeholder="Search clients"
            className="pl-9"
            aria-label="Search clients"
          />
        </div>
        <SelectInput
          id="kyc-standing"
          value={standing}
          onChange={(event) => {
            setStanding(event.target.value);
            setPage(0);
          }}
          aria-label="Filter by where the client stands"
          className="w-56"
        >
          <option value="">Every client</option>
          {standings.map((one) => (
            <option key={one} value={one}>
              {standingLabels[one]}
            </option>
          ))}
        </SelectInput>
      </div>

      {/* The sign-off had no door. Approving a client's papers is on this screen and reachable; signing
          their KYC off — the act that activates them — lived on a case screen with no menu entry, no link
          and no button anywhere, reached only by a bell notification somebody happened to get or by
          typing an address with a case id they had no way to look up. It is the end of the job this queue
          is the start of, so it belongs at the top of it. */}
      {decides && awaiting.length > 0 && (
        <section className="rounded-2xl border border-amber-300 bg-amber-50/60">
          <div className="px-5 pt-5">
            <h2 className="text-base font-bold">Awaiting your sign-off</h2>
            <p className="mt-0.5 text-xs text-ink-soft">
              {awaiting.length === 1
                ? "One client has every paper in and approved, and is waiting on the signature that activates them."
                : `${awaiting.length} clients have every paper in and approved, and are waiting on the signature that activates them.`}
            </p>
          </div>
          <ul className="mt-3 divide-y divide-amber-200/70">
            {awaiting.map((one) => (
              <li key={one.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar name={one.clientName} photo={one.clientPhoto} />
                  <div className="min-w-0">
                    <span className="block font-semibold">{one.clientName}</span>
                    <span className="block text-xs text-ink-muted">
                      {clientTypeLabels[one.clientType]}
                      {one.relationshipManager && ` · ${one.relationshipManager.fullName}`}
                      {` · updated ${formatRelative(one.updatedAt)}`}
                    </span>
                  </div>
                </div>
                <Link
                  to={`/kyc/cases/${one.id}`}
                  className="text-sm font-semibold text-primary-700 hover:underline"
                >
                  Open and sign off
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-2xl border border-line bg-white">
        {/* Which of their arrangements a reader is in sits on the card's own line, above the table it
            describes and beside the name of it. */}
        <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5">
          <div>
            <h2 className="text-base font-bold">Clients in review</h2>
            <p className="mt-0.5 text-xs text-ink-muted">
              {queue.data
                ? `${queue.data.totalItems} client${queue.data.totalItems === 1 ? "" : "s"} pending. A client is ready to decide on once every paper on their checklist is in and approved.`
                : "A client is ready to decide on once every paper on their checklist is in and approved."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <ViewTabs
              views={view.views}
              current={view.current}
              edited={view.current === null ? view.arranged : view.changed}
              onPick={(name) => (name === null ? view.reset() : view.apply(name))}
              onSave={view.saveAs}
              onDelete={view.remove}
              firstLabel="Everyone in review"
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
                  <span className="sr-only">Open</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {queue.isPending && (
                <tr>
                  <td colSpan={shownColumns.length + 2} className="px-5 py-10 text-center text-ink-muted">Loading the queue…</td>
                </tr>
              )}
              {queue.data && rows.length === 0 && (
                <tr>
                  <td colSpan={shownColumns.length + 2} className="px-5 py-10 text-center text-ink-muted">
                    {query || standing
                      ? "No client matches that."
                      : "No client's KYC is pending. They arrive here once something has been sent in for the firm to decide on."}
                  </td>
                </tr>
              )}
              {rows.map((row) => (
                <Row key={row.customerId} row={row} columns={shownColumns} decides={decides} />
              ))}
            </tbody>
          </table>
        </div>
        {/* The server's own page, size and count rather than a second slice of them: the rows here are one
            page of the queue and not the whole of it, so counting what arrived would count the page. */}
        {found > 0 && (
          <PagedFooter
            paged={{
              page,
              size,
              total: found,
              onPage: setPage,
              onSize: (next) => {
                setSize(next);
                setPage(0);
              },
            }}
            noun={["client", "clients"]}
          />
        )}
      </section>
    </div>
  );
}

/** One count the queue is read by: what it is, how many, and what that means. */
function Tile({ label, count, hint }: { label: string; count?: number; hint: string }) {
  return (
    <div className="rounded-2xl border border-line bg-white px-5 py-4">
      <p className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">{label}</p>
      <p className="mt-1 text-3xl font-bold text-ink">{count ?? "—"}</p>
      <p className="mt-0.5 text-xs text-ink-muted">{hint}</p>
    </div>
  );
}

function Row({ row, columns, decides }: { row: ReviewRow; columns: Column[]; decides: boolean }) {
  const navigate = useNavigate();
  return (
    <tr
      // The client's file is opened from both KYC screens, so it carries which one it came from: the menu
      // highlights that one, and Back returns to it.
      onClick={() => void navigate(`/kyc/${row.customerId}?from=queue`)}
      className="cursor-pointer hover:bg-slate-50/60"
    >
      <td className="py-3 pr-4 pl-5">
        <div className="flex items-center gap-3">
          <Avatar name={row.clientName} photo={row.clientPhoto} />
          <div className="min-w-0">
            <span className="block truncate font-semibold">{row.clientName}</span>
            <span className="block truncate text-xs text-ink-muted">
              {clientTypeLabels[row.clientType]}
              {row.countryCode && ` · ${countryName(row.countryCode)}`}
            </span>
          </div>
        </div>
      </td>
      {/* The cells in the order the headings are in, out of the one list that holds both. */}
      {columns.map((column) => (
        <td
          key={column.id}
          className={cn("px-4 py-3", column.nowrap && "whitespace-nowrap", column.tone)}
        >
          {column.cell(row)}
        </td>
      ))}
      <td className="py-3 pr-5 pl-4 text-right">
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary-700">
          {decides && row.standing === "READY" ? "Decide" : "Open"}
          <ChevronRight aria-hidden="true" className="size-3.5" />
        </span>
      </td>
    </tr>
  );
}
