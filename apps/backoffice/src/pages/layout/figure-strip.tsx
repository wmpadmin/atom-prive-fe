import { cn } from "@atomprive/ui";
import { createContext, use, type ReactNode } from "react";
import { useCardChart } from "./chart-kinds";

/**
 * A card of key figures — a screen's strip of tiles — drawn as the reader chose in Customize view: Tiles, the card's own
 * look, or Table, one row per figure. The figures are the screen's own either way; a table only lays them out in rows,
 * since figures in different units (money beside counts) have no chart to share.
 */

/** The kinds a card of key figures may be drawn as. */
export const FIGURE_KINDS = ["tiles", "table"] as const;

const RowsContext = createContext(false);

/** Whether the figure being drawn sits in a strip shown as a table, and so draws itself as a row. */
export function useFigureRow() {
  return use(RowsContext);
}

/** Whether the card being drawn is a strip of figures the reader chose to see as a table. */
export function useFiguresAsTable() {
  return useCardChart()?.kind === "table";
}

/**
 * The strip's tiles as the screen lays them out, or the same figures as the rows of one table.
 *
 * @param bare for a strip already inside a card of its own: the table takes no box of its own
 * @param list for tiles drawn as a definition list (dt and dd)
 */
export function FigureStrip({ className, bare, list, children }: { className?: string; bare?: boolean; list?: boolean; children: ReactNode }) {
  const table = useFiguresAsTable();
  if (!table) return list ? <dl className={className}>{children}</dl> : <div className={className}>{children}</div>;
  return (
    <RowsContext.Provider value={true}>
      <div role="table" aria-label="Key figures" className={cn("divide-y divide-line", !bare && "rounded-2xl border border-line bg-white px-5")}>
        {children}
      </div>
    </RowsContext.Provider>
  );
}

/** One figure as a row of the table: its name, its value, and the line the tile carries under it. */
export function FigureRow({ label, value, note, tone }: { label: ReactNode; value: ReactNode; note?: ReactNode; tone?: string }) {
  return (
    <div role="row" className="grid items-baseline gap-x-6 gap-y-0.5 py-2.5 sm:grid-cols-[minmax(0,15rem)_minmax(0,12rem)_minmax(0,1fr)]">
      <span role="rowheader" className="text-xs font-semibold tracking-wider text-ink-muted uppercase">{label}</span>
      <span role="cell" className={cn("text-base font-bold tabular-nums", tone)}>{value ?? "—"}</span>
      <span role="cell" className="text-xs text-ink-muted">{note}</span>
    </div>
  );
}
