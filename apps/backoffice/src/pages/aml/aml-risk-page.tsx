import { ApiError } from "@atomprive/api-client";
import {
  useListAmlRatedClients,
  type RatedClientsPage,
  type RatingRow,
} from "@atomprive/api-client/backoffice";
import { Alert, Avatar, Badge, Pagination, TextInput, cn } from "@atomprive/ui";
import { keepPreviousData } from "@tanstack/react-query";
import { ShieldAlert } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router";
import { ColumnPicker } from "../../components/column-picker";
import { ListPageHeader } from "../../components/record-list";
import { ViewTabs } from "../../components/view-tabs";
import { useColumnDrag } from "../../lib/column-drag";
import { useTableView } from "../../lib/table-view";
import { formatDate } from "../../lib/labels";
import { DEFAULT_PAGE_SIZE, PAGE_SIZES } from "../../lib/page-sizes";
import { bandTone } from "./aml-labels";

/**
 * The columns a reader may move and take off, in the order the firm wrote them.
 *
 * <p>The client is not among them. A row here is one client's standing, and a standing with nobody's
 * name against it is a score nothing can be done about.
 *
 * <p>Each cell is handed the standing rather than the row, because a client nobody has rated has none of
 * these columns at all — their row says so across the width of them instead.
 */
const MOVABLE: {
  id: string;
  label: string;
  align: "left" | "right";
  nowrap?: boolean;
  tone?: (standing: RatingRow) => string | undefined;
  cell: (standing: RatingRow) => ReactNode;
}[] = [
  {
    id: "score",
    label: "Score",
    align: "right",
    cell: (standing) => <span className="font-semibold">{standing.score}</span>,
  },
  {
    id: "band",
    label: "Band",
    align: "left",
    cell: (standing) => (
      <>
        <Badge tone={bandTone(standing.bandFrom)}>{standing.bandName}</Badge>
        {/* Said on the row, because a band reached this way was not reached by the sum. */}
        {standing.forcedBy && (
          <span className="mt-1 block text-xs text-ink-muted">{standing.forcedBy}</span>
        )}
      </>
    ),
  },
  {
    id: "dueDiligence",
    label: "Due diligence",
    align: "left",
    nowrap: true,
    tone: () => "text-ink-soft",
    cell: (standing) => standing.dueDiligenceTitle,
  },
  {
    id: "rated",
    label: "Rated",
    align: "left",
    nowrap: true,
    tone: () => "text-ink-soft",
    cell: (standing) => (
      <>
        {formatDate(standing.ratedAt)}
        <span className="block text-xs text-ink-muted">{standing.ratedByName}</span>
      </>
    ),
  },
  {
    id: "dueAgain",
    label: "Due again",
    align: "left",
    nowrap: true,
    // A review that has come and gone is the firm's own deadline missed, so it is the one date here that
    // is given ink of its own.
    tone: (standing) => (standing.overdue ? "font-semibold text-amber-700" : "text-ink-soft"),
    cell: (standing) => (
      <>
        {formatDate(standing.nextReviewOn)}
        {standing.overdue && <span className="block text-xs">Waiting</span>}
      </>
    ),
  },
];

/**
 * Where every client sits on the firm's money-laundering risk matrix.
 *
 * <p>The figure that matters most on a screen about risk is how many have never been scored at all, so it is
 * the one read first: a client nobody has rated is not a low-risk client, they are an unknown one.
 */
export function AmlRiskPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);

  const clients = useListAmlRatedClients<RatedClientsPage, ApiError>(
    { query: query.trim() || undefined, page, size: pageSize },
    { query: { placeholderData: keepPreviousData } },
  );

  // Above the early return: how this reader has arranged the matrix is a thing about them rather than
  // about whether the fetch came back, and a hook React sees on one render and not the next is a hook it
  // cannot keep in order.
  const view = useTableView("aml-risk", MOVABLE.map((one) => one.id));
  const drag = useColumnDrag(view);

  if (clients.isError) {
    return <Alert tone="danger">{clients.error.message}</Alert>;
  }
  const rows = clients.data?.items ?? [];
  const counts = clients.data?.counts;
  const byId = new Map(MOVABLE.map((one) => [one.id, one]));
  const shownColumns = view.shown.map((id) => byId.get(id)).filter((one) => one !== undefined);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <ListPageHeader
          title="AML risk"
          lead="Where each client sits on the firm's money-laundering risk matrix, and when they are due to be looked at again."
        />
      </div>

      {counts && (
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* First, and in red when there are any: nobody scored is not the same as scored low. */}
          <Fact label="Never rated" tone={counts.neverRated > 0 ? "danger" : undefined}>
            {counts.neverRated}
          </Fact>
          <Fact label="Due to be rated again" tone={counts.overdue > 0 ? "warning" : undefined}>
            {counts.overdue}
          </Fact>
          <Fact label="Clients">{counts.all}</Fact>
          <div className="rounded-xl border border-line bg-white px-4 py-3">
            <dt className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">By band</dt>
            <dd className="mt-1 flex flex-wrap gap-1.5">
              {Object.keys(counts.byBand).length === 0 ? (
                <span className="text-sm text-ink-muted">Nothing rated yet</span>
              ) : (
                Object.entries(counts.byBand).map(([band, howMany]) => (
                  <Badge key={band} tone="neutral">
                    {band} {howMany}
                  </Badge>
                ))
              )}
            </dd>
          </div>
        </dl>
      )}

      <div className="max-w-sm">
        <TextInput
          id="aml-search"
          aria-label="Search clients"
          value={query}
          placeholder="Search by name, email or code"
          onChange={(event) => {
            setQuery(event.target.value);
            setPage(0);
          }}
        />
      </div>

      {/* Above the card: which of their arrangements a reader is in is read before anything in it. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ViewTabs
          views={view.views}
          current={view.current}
          edited={view.current === null ? view.arranged : view.changed}
          onPick={(name) => (name === null ? view.reset() : view.apply(name))}
          onSave={view.saveAs}
          onDelete={view.remove}
          firstLabel="Everyone on the matrix"
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

      <section className="rounded-2xl border border-line bg-white">
        <div className="overflow-x-auto">
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
                      column.align === "right" ? "text-right" : "text-left",
                      at === shownColumns.length - 1 && "pr-5",
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
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {!clients.data && (
                <tr>
                  <td colSpan={shownColumns.length + 1} className="px-5 py-8 text-center text-ink-muted">
                    Loading the clients…
                  </td>
                </tr>
              )}
              {clients.data && rows.length === 0 && (
                <tr>
                  <td colSpan={shownColumns.length + 1} className="px-5 py-10 text-center text-ink-muted">
                    {query.trim() ? "Nobody matches that." : "No clients yet."}
                  </td>
                </tr>
              )}
              {rows.map((row) => {
                // Taken out of the row before the cells are drawn, so each one is handed a standing that
                // is there rather than one it has to check for itself.
                const standing = row.standing;
                return (
                  <tr
                    key={row.customerId}
                    onClick={() => void navigate(`/aml-risk/clients/${row.customerId}`)}
                    className="cursor-pointer hover:bg-slate-50/60"
                  >
                    <td className="py-3 pr-4 pl-5">
                      <div className="flex items-center gap-3">
                        <Avatar name={row.clientName} photo={row.clientPhoto} />
                        <div>
                          <Link
                            to={`/aml-risk/clients/${row.customerId}`}
                            onClick={(event) => event.stopPropagation()}
                            className="block font-medium hover:text-primary-600"
                          >
                            {row.clientName}
                          </Link>
                          <span className="block font-mono text-xs text-ink-muted">{row.clientCode}</span>
                        </div>
                      </div>
                    </td>
                    {/* The columns this reader has on, in the order the headings are in — or, for a client
                        nobody has rated, the one sentence that stands in for all of them. */}
                    {standing ? (
                      shownColumns.map((column, at) => (
                        <td
                          key={column.id}
                          className={cn(
                            "px-4 py-3",
                            column.align === "right" && "text-right tabular-nums",
                            column.nowrap && "whitespace-nowrap",
                            at === shownColumns.length - 1 && "pr-5",
                            column.tone?.(standing),
                          )}
                        >
                          {column.cell(standing)}
                        </td>
                      ))
                    ) : (
                      <td colSpan={shownColumns.length || 1} className="px-4 py-3">
                        <span className="inline-flex items-center gap-2 text-sm font-medium text-red-700">
                          <ShieldAlert className="size-4" aria-hidden="true" />
                          Never rated
                        </span>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {(clients.data?.totalItems ?? 0) > 0 && (
          <div className="border-t border-line px-5 py-3">
            <Pagination
              page={page}
              pageSize={pageSize}
              totalItems={clients.data?.totalItems ?? 0}
              onPageChange={setPage}
              pageSizes={PAGE_SIZES}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(0);
              }}
              noun={["client", "clients"]}
            />
          </div>
        )}
      </section>
    </div>
  );
}

function Fact({ label, children, tone }: { label: string; children: React.ReactNode; tone?: "danger" | "warning" }) {
  return (
    <div className="rounded-xl border border-line bg-white px-4 py-3">
      <dt className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">{label}</dt>
      <dd
        className={cn(
          "mt-0.5 text-lg font-bold tabular-nums",
          tone === "danger" ? "text-red-700" : tone === "warning" ? "text-amber-700" : "text-ink",
        )}
      >
        {children}
      </dd>
    </div>
  );
}
