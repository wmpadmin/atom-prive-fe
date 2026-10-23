import { ApiError } from "@atomprive/api-client";
import { useListDrift, type DriftPage, type DriftRow } from "@atomprive/api-client/backoffice";
import { Alert, Avatar, Badge, cn } from "@atomprive/ui";
import { keepPreviousData } from "@tanstack/react-query";
import { Link, useLocation, useNavigate } from "react-router";
import { type ReactNode } from "react";
import { ColumnPicker } from "../../components/column-picker";
import { ListPageHeader, RecordList } from "../../components/record-list";
import { ViewTabs } from "../../components/view-tabs";
import { useColumnDrag } from "../../lib/column-drag";
import { useTableView } from "../../lib/table-view";
import { PAGE_SIZES } from "../../lib/page-sizes";
import { useListAddress } from "../../lib/use-list-address";
import {
  driftLabel,
  driftTones,
  standingLabels,
  standingTones,
  underManagementLabel,
  type DriftStanding,
} from "./portfolio-labels";

/** The one standing worth queueing: a portfolio where the model wants it is not a thing to do. */
const WANDERED: DriftStanding[] = ["BREACHED"];

/**
 * The queue a portfolio manager works down: every client whose portfolio has wandered from its model, the
 * worst deviation first.
 *
 * <p>A deviation is not a warning — it is past what the model allows, and the portfolio has to be put back. The
 * count of them is of the whole book, so narrowing the list to one standing never hides how many there are.
 */
/**
 * The columns a reader may move and take off, in the order the firm wrote them.
 *
 * <p>The client is not here and neither is the way in at the end: a row with no client on it cannot be
 * told from any other row, and an action with no heading cannot be dragged or found in a list.
 */
const MOVABLE: {
  id: string;
  label: string;
  align: "left" | "right";
  nowrap?: boolean;
  cell: (row: DriftRow) => ReactNode;
  tone?: (row: DriftRow) => string | undefined;
}[] = [
  {
    id: "model",
    label: "Measured against",
    align: "left",
    cell: (row) => row.modelName,
  },
  {
    id: "aum",
    label: "AUM",
    align: "right",
    nowrap: true,
    cell: (row) => <span className="font-semibold">{underManagementLabel(row.underManagement, row.currency)}</span>,
  },
  {
    id: "allowed",
    label: "Allowed",
    align: "right",
    nowrap: true,
    /*
     * What that drift is to be read against, in money rather than in points. A drift of twelve points
     * says nothing by itself; twelve points of a portfolio against the two and a half million it was
     * allowed to wander is a sentence somebody can act on.
     */
    cell: (row) => (row.allowed === null ? (
      <span className="text-ink-muted">—</span>
    ) : (
      <>
        {/* The range turned into money against this portfolio: a drift is in points of the whole, so the
            points the plan allows are that share of the whole. */}
        <span className="block">
          ±{underManagementLabel((row.underManagement * Number(row.allowed)) / 100, row.currency)}
        </span>
        <span className="block text-xs text-ink-muted">
          ±{Number(row.allowed).toFixed(1)}% of the portfolio
        </span>
      </>
    )),
    tone: () => "text-ink-soft",
  },
  {
    id: "drift",
    label: "Drift",
    align: "right",
    nowrap: true,
    /*
     * Which side of the target it has gone is kept in the sign — "+6.4pp" against "−6.4pp" — but the ink
     * follows the standing. Coloured by side, a deviation the wrong way read as good news.
     */
    tone: (row) => driftTones[row.standing],
    cell: (row) => <span className="font-semibold">{driftLabel(row.drift)}</span>,
  },
  {
    id: "standing",
    label: "Standing",
    align: "left",
    cell: (row) => <Badge tone={standingTones[row.standing]}>{standingLabels[row.standing]}</Badge>,
  },
];

export function DriftBreachesPage() {
  const navigate = useNavigate();
  // The queue as it is being read, so Back from a portfolio comes to the same page of the same filter.
  const asLeft = encodeURIComponent(useLocation().search);
  const { params, update } = useListAddress();

  const page = Number(params.get("page")) || 0;
  const size = Number(params.get("size")) || PAGE_SIZES[0]!;


  const queue = useListDrift<DriftPage, ApiError>(
    { standing: WANDERED, page, size },
    { query: { placeholderData: keepPreviousData } },
  );

  // Before the queue is read at all: how this reader has arranged the table is a thing about them, not
  // about whether the fetch came back, and a hook that is skipped on the error render is a hook React
  // cannot keep in order.
  const view = useTableView("drift", MOVABLE.map((one) => one.id));
  const drag = useColumnDrag(view);

  if (queue.isError) {
    return <Alert tone="danger">{queue.error.message}</Alert>;
  }
  const rows = queue.data?.items ?? [];
  const byId = new Map(MOVABLE.map((one) => [one.id, one]));
  const shownColumns = view.shown.map((id) => byId.get(id)).filter((one) => one !== undefined);
  const breached = queue.data?.breached ?? 0;

  return (
    <div className="space-y-6">
      <ListPageHeader
        title="Drift & deviations"
        lead="Clients whose portfolio has wandered from its model, the worst first."
      />

      {breached > 0 && (
        <Alert tone="danger">
          <span className="font-semibold">
            {breached === 1 ? "1 portfolio is" : `${breached} portfolios are`} past what the model allows.
          </span>{" "}
          Each one needs putting back. Open a client to see which asset class has gone and what it would take
          to close the gap.
        </Alert>
      )}

      {/* Above the table: which of their arrangements a reader is in is read before anything in it. */}
      <ViewTabs
        views={view.views}
        current={view.current}
        edited={view.current === null ? view.arranged : view.changed}
        onPick={(name) => (name === null ? view.reset() : view.apply(name))}
        onSave={view.saveAs}
        onDelete={view.remove}
        firstLabel="Everything adrift"
      />

      <RecordList
        caption="Drift & deviations"
        subtitle="Worst first"
        filters={
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
        }
        head={
          <>
            <th scope="col" className="px-5 py-3 text-left font-semibold">
              Client
            </th>
            {shownColumns.map((column, at) => (
              <th
                key={column.id}
                scope="col"
                {...drag.headingProps(column.id)}
                className={cn(
                  "cursor-grab touch-none px-4 py-3 font-semibold select-none",
                  column.align === "right" ? "text-right" : "text-left",
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
            <th scope="col" className="px-4 py-3 text-right font-semibold">
              <span className="sr-only">Open</span>
            </th>
          </>
        }
        columns={shownColumns.length + 2}
        loading={queue.isLoading}
        stale={queue.isPlaceholderData}
        empty={rows.length > 0 ? undefined : "Every portfolio is where its model wants it."}
        page={page}
        size={size}
        total={queue.data?.totalItems ?? 0}
        noun={["portfolio", "portfolios"]}
        onPage={(next) => update({ page: String(next) })}
        onSize={(next) => update({ size: String(next), page: "0" })}
      >
        {rows.map((row) => (
          // The row opens the portfolio, the same as the client's name and Open do. A queue is worked down
          // by clicking the line you are reading, not by finding the small word at the end of it.
          <tr
            key={row.customerId}
            onClick={() => void navigate(`/portfolio-clients/${row.customerId}?from=drift&back=${asLeft}`)}
            className="cursor-pointer border-t border-line hover:bg-slate-50/60"
          >
            <td className="px-5 py-3">
              <div className="flex items-center gap-3">
                <Avatar name={row.clientName} />
                <div>
                  <Link
                    to={`/portfolio-clients/${row.customerId}?from=drift&back=${asLeft}`}
                    className="font-semibold text-ink hover:text-primary-600"
                  >
                    {row.clientName}
                  </Link>
                  <p className="text-xs text-ink-muted">{row.clientCode}</p>
                </div>
              </div>
            </td>
            {/* The cells in the order the headings are in, out of the one list that holds both. */}
            {shownColumns.map((column) => (
              <td
                key={column.id}
                className={cn(
                  "px-4 py-3",
                  column.align === "right" && "text-right tabular-nums",
                  column.nowrap && "whitespace-nowrap",
                  column.tone?.(row),
                )}
              >
                {column.cell(row)}
              </td>
            ))}
            <td className="px-4 py-3 text-right">
              <Link
                to={`/portfolio-clients/${row.customerId}?from=drift&back=${asLeft}`}
                className="text-sm font-medium text-primary-700 hover:underline"
              >
                Open
              </Link>
            </td>
          </tr>
        ))}
      </RecordList>

    </div>
  );
}
