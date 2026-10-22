import { ApiError } from "@atomprive/api-client";
import {
  useGetModelPerformance,
  type ModelPerformanceRow,
  type ModelPerformanceTable,
  type PeriodReturn,
} from "@atomprive/api-client/backoffice";
import { Alert, cn } from "@atomprive/ui";
import { type ReactNode } from "react";
import { ColumnPicker } from "../../components/column-picker";
import { ViewTabs } from "../../components/view-tabs";
import { useColumnDrag } from "../../lib/column-drag";
import { useTableView } from "../../lib/table-view";
import { ListPageHeader } from "../../components/record-list";
import { formatDate } from "../../lib/labels";
import { PagedFooter, usePagedRows } from "../../lib/paged-rows";
import { underManagementLabel } from "./portfolio-labels";

/**
 * How each plan itself is doing — not how any one client on it is doing. A client on Growth may do better or
 * worse than Growth: they joined at a different time and drifted differently, and a plan's figure deliberately
 * averages that out. A client's own performance belongs on the client's own screen.
 */
/**
 * The columns a reader may move and take off, in the order the firm wrote them.
 *
 * <p>The plan's own name is not here: a row with no plan on it cannot be told from any other row.
 *
 * <p>Each carries the width it is given, because this table is laid out to a fixed grid — move a column
 * and its width has to move with it, or the table rearranges into the wrong shape.
 */
const MOVABLE: {
  id: string;
  label: string;
  width: string;
  nowrap?: boolean;
  cell: (row: ModelPerformanceRow, currency: string) => ReactNode;
  tone?: (row: ModelPerformanceRow) => string | undefined;
  /*
   * A period measured in one piece has had any movement inside it treated as happening at the end, so
   * the screen admits how coarse the answer is rather than printing two decimals as though they were
   * earned.
   */
  title?: (row: ModelPerformanceRow) => string | undefined;
}[] = [
  {
    id: "clients",
    label: "Clients",
    width: "w-[7%]",
    cell: (row) => <span className="text-ink-soft">{row.clients}</span>,
  },
  {
    id: "assets",
    label: "On this plan",
    width: "w-[13%]",
    nowrap: true,
    cell: (row, currency) => (row.assets > 0
      ? underManagementLabel(row.assets, currency)
      : <span className="text-ink-muted">—</span>),
  },
  {
    id: "outside",
    label: "Outside band",
    width: "w-[13%]",
    nowrap: true,
    /*
     * What the plan looks like today, which is the question a desk asks of it daily. It answers on
     * today's money; the return beside it answers about a book that has changed every day since.
     *
     * How much of this plan's book is past what the plan allows, counted out of the clients on it —
     * "2 of 3" is a different fact from "2", and the plan with one client is not in more trouble than
     * the plan with twenty.
     */
    cell: (row) => (row.clients === 0 ? (
      <span className="text-ink-muted">—</span>
    ) : row.today.outsideBand === 0 ? (
      <span className="font-semibold text-emerald-700">All within band</span>
    ) : (
      <span className="font-semibold text-rose-700">{row.today.outsideBand} of {row.clients}</span>
    )),
  },
  {
    id: "thisYear",
    label: "This year",
    width: "w-[26%]",
    cell: (row) => <Percent value={row.thisYear.percent} period={row.thisYear} />,
    // Painted by whether the money went up or down, which is a thing about the figure rather than about
    // the column it happens to sit in.
    tone: (row) => (row.thisYear.percent === null ? undefined
      : row.thisYear.percent < 0 ? "font-semibold text-rose-700" : "font-semibold text-emerald-700"),
    title: (row) => (row.thisYear.from && row.thisYear.to
      ? `${formatDate(row.thisYear.from)} to ${formatDate(row.thisYear.to)}, in ${row.thisYear.split} `
        + `${row.thisYear.split === 1 ? "piece" : "pieces"}`
      : undefined),
  },
  {
    id: "writtenBy",
    label: "Written by",
    width: "w-[15%]",
    /*
     * "Nobody recorded" where nobody is. Naming whoever happens to be an administrator today would be
     * inventing an author for a plan nobody wrote.
     */
    cell: (row) => (
      <span className="block truncate text-ink-soft">
        {row.writtenBy ?? <span className="text-ink-muted">Nobody recorded</span>}
      </span>
    ),
  },
  {
    id: "revision",
    label: "Version",
    width: "w-[10%]",
    /*
     * Its own column rather than a line under the author: the two answer different questions, and a
     * version read as a caption to a name looks like part of the name.
     */
    cell: (row) => <span className="text-ink-soft">v{row.revision}</span>,
  },
];

export function ModelPerformancePage() {
  const table = useGetModelPerformance<ModelPerformanceTable, ApiError>();
  // Read before the refusal below, because usePagedRows is a hook and a hook cannot be called on only some
  // of a component's renders. Both lines already carried their own optional chaining, so they are safe here.
  const rows = table.data?.items ?? [];
  const measured = rows.filter((row) => row.thisYear.percent !== null);
  const paged = usePagedRows(rows);
  const view = useTableView("model-performance", MOVABLE.map((one) => one.id));
  const drag = useColumnDrag(view);
  const byId = new Map(MOVABLE.map((one) => [one.id, one]));
  const shownColumns = view.shown.map((id) => byId.get(id)).filter((one) => one !== undefined);

  if (table.isError) {
    return <Alert tone="danger">{table.error.message}</Alert>;
  }

  return (
    <div className="space-y-6">
      <ListPageHeader
        title="Model performance"
        lead={
          table.data
            ? `Whether today's money is where each plan says it should be. In ${table.data.currency}, as at ${formatDate(table.data.asOf)}. The return is for the calendar year ${table.data.year}.`
            : "Whether today's money is where each plan says it should be."
        }
      />

      {rows.length > 0 && measured.length === 0 && (
        <Alert tone="warning">
          No plan has a return yet. A return needs a portfolio written down on at least two days: the first
          writing-down is a photograph, not a period.
        </Alert>
      )}

      {/* Which arrangement, then what is in it: above the table, because it decides what the table is
          showing. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ViewTabs
          views={view.views}
          current={view.current}
          edited={view.current === null ? view.arranged : view.changed}
          onPick={(name) => (name === null ? view.reset() : view.apply(name))}
          onSave={view.saveAs}
          onDelete={view.remove}
          firstLabel="All plans"
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

      {/* The scrolling is the table's own rather than the card's, so the footer below sits still while the
          columns slide under it. */}
      <section className="rounded-2xl border border-line bg-white">
        <div className="overflow-x-auto">
          {/* Laid out to a fixed grid rather than to whatever the longest cell happens to be. Left to
              size itself, the column of dates pushed to the far right of the table and left a hand's
              width of nothing between it and the figure it belongs beside. Six columns, one width. */}
          <table className="w-full table-fixed text-sm">
            {/* Weighted to what each column holds. The name needs room for "Copy of Conservative" and no
                more — given a quarter of the table it held its words at the left and pushed the count of
                clients a hand's width away from them, which is a gap nothing is in. */}
            {/* The widths travel with their columns: a fixed table whose widths stay put while its
                columns move is a table rearranged into the wrong shape. */}
            <colgroup>
              <col className="w-[16%]" />
              {shownColumns.map((column) => <col key={column.id} className={column.width} />)}
            </colgroup>
            <thead>
              <tr className="border-b border-line text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                <th scope="col" className="py-3 pr-3 pl-5">Model</th>
                {/* Everything after the name reads from the right: one column reading the other way is
                    the hole that opens down the middle of a fixed table. */}
                {shownColumns.map((column, at) => (
                  <th
                    key={column.id}
                    scope="col"
                    {...drag.headingProps(column.id)}
                    className={cn(
                      "cursor-grab touch-none px-3 py-3 text-right select-none",
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
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {table.isPending && (
                <tr>
                  <td colSpan={shownColumns.length + 1} className="px-5 py-10 text-center text-ink-muted">Working out the returns…</td>
                </tr>
              )}
              {table.data && rows.length === 0 && (
                <tr>
                  <td colSpan={shownColumns.length + 1} className="px-5 py-10 text-center text-ink-muted">
                    There are no model portfolios yet.
                  </td>
                </tr>
              )}
              {paged.shown.map((row) => (
                <Row key={row.id} row={row} currency={table.data!.currency} columns={shownColumns} />
              ))}
            </tbody>
          </table>
        </div>
        {/* Not while the returns are still being worked out: a count under a table that says it is still
            counting answers a question nobody has asked yet. */}
        {!table.isPending && <PagedFooter paged={paged} noun={["model", "models"]} />}
      </section>
    </div>
  );
}

function Row({ row, currency, columns }: {
  row: ModelPerformanceRow;
  currency: string;
  columns: typeof MOVABLE;
}) {
  return (
    <tr className="hover:bg-slate-50/60">
      <td className="py-3 pr-3 pl-5">
        <span className="block font-semibold">{row.modelName}</span>
      </td>
      {columns.map((column) => (
        <td
          key={column.id}
          title={column.title?.(row)}
          className={cn(
            "px-3 py-3 text-right tabular-nums",
            column.nowrap && "whitespace-nowrap",
            column.tone?.(row),
          )}
        >
          {column.cell(row, currency)}
        </td>
      ))}
    </tr>
  );
}

/** A return. Absent rather than estimated, so a blank is an answer: nobody has written down enough yet. */
function Percent({ value, period }: { value: number | null; period?: PeriodReturn }) {
  const span = daysBetween(period);
  return (
    <>
      {/* What the figure actually covers, beside the figure rather than in a column of its own: the two
          percentages are measured over different periods, and one column could only describe one of them.
          Without it, four days of a portfolio being written down properly read as a year's performance —
          "+4155.4%" under a heading that says "This year".

          Beside it and not under it, because under it this was the only cell on the row standing two
          lines tall: every body row ran half as tall again as the header above them, and a table whose
          heading row is a different size from its rows reads as two tables. Left of the figure, so the
          percentages still line up down the column with everything else read from the right. */}
      {value !== null && span !== null && (
        <span className="mr-1.5 text-[11px] font-normal text-ink-muted">{span}</span>
      )}
      {value === null ? <span className="text-ink-muted">—</span> : percentLabel(value)}
    </>
  );
}

/**
 * The days a figure actually covers, said as the two days themselves.
 *
 * <p>It was a count — "over 5 days" — and a count is read as the age of the thing beside it. A plan
 * written on the 16th, read on the 22nd, whose last figure is the 21st, is six days old and measured over
 * five, and nobody should have to work that out. The two days say it outright.
 *
 * <p>The first day is the first one written down inside the period, not the day the period opens: a plan
 * written in March whose first portfolio was written down in June is measured from June, because a return
 * needs a figure to start at.
 */
function daysBetween(period?: PeriodReturn) {
  if (!period?.from || !period.to) {
    return null;
  }
  const from = new Date(period.from);
  const to = new Date(period.to);
  const day = (when: Date) => when.getDate();
  const month = (when: Date) => when.toLocaleDateString("en-GB", { month: "short" });
  const year = (when: Date) => when.getFullYear();
  if (year(from) !== year(to)) {
    return `${day(from)} ${month(from)} ${year(from)} – ${day(to)} ${month(to)} ${year(to)}`;
  }
  // Within one month the month is said once: "16–21 Oct" rather than "16 Oct – 21 Oct".
  return month(from) === month(to)
    ? `${day(from)}–${day(to)} ${month(to)}`
    : `${day(from)} ${month(from)} – ${day(to)} ${month(to)}`;
}

/**
 * "+8.2%", "−1.1%", and anything that comes out as nought as "0.0%".
 *
 * <p>The sign is decided by what is drawn, not by what was worked out. A plan up a fiftieth of a percent
 * read "+0.0%" beside a plan that had not moved at all reading "0.0%" — two figures the reader cannot
 * tell apart, written differently, which reads as one of them being wrong.
 */
function percentLabel(percent: number) {
  const rounded = Math.abs(percent).toFixed(1);
  if (rounded === "0.0") return "0.0%";
  return percent > 0 ? `+${rounded}%` : `−${rounded}%`;
}
