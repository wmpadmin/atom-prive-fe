import { useCallback, useContext, useEffect, useMemo, useState, type RefObject } from "react";
import { CardColumnsContext } from "../pages/layout/custom-view";
import { ColumnPicker } from "./column-picker";

/**
 * A Columns button for whatever table a card is showing, so that every table on a client's screens can
 * have columns taken off and put back without each one being written to allow it.
 *
 * <p>It reads the table's own headings, and hides a column by hiding its cells, row by row; a cell that
 * spans several columns (a class's heading row, a total) is narrowed by the columns it loses, and goes
 * only when all of them have. The first column names the row and always stays.
 *
 * <p>What is taken off is saved with the reader's layout of the screen, to their account, as a card's
 * chart type is. A card that switches between tabs shows a different table on each, so each column is
 * kept with a short tag of its table's headings: taking "NAV" off one tab leaves it on the others.
 *
 * <p>A table that already has a Columns menu of its own is marked {@code data-own-columns} and left to it.
 */
export function TableColumns({ scope }: { scope: RefObject<HTMLElement | null> }) {
  const saved = useContext(CardColumnsContext);
  const [mine, setMine] = useState<string[]>([]);
  const all = saved?.hidden ?? mine;
  const [table, setTable] = useState<{ tag: string; labels: string[] } | null>(null);

  const read = useCallback(() => {
    const found = firstTable(scope.current);
    const labels = found ? named(found) : [];
    const next = labels.length > 0 ? { tag: tagOf(labels), labels } : null;
    setTable((now) => (now?.tag === next?.tag ? now : next));
  }, [scope]);

  // The table can change under the card at any time: a tab, a filter, the data arriving.
  useEffect(() => {
    const root = scope.current;
    if (!root) return;
    const watch = new MutationObserver(() => read());
    watch.observe(root, { childList: true, subtree: true });
    const first = requestAnimationFrame(read);
    return () => {
      watch.disconnect();
      cancelAnimationFrame(first);
    };
  }, [scope, read]);

  const hiddenKey = all.join("\n");
  // Applied after every change below the card, since a row drawn again comes back with all its cells.
  useEffect(() => {
    const root = scope.current;
    if (!root) return;
    const off = new Set(hiddenKey ? hiddenKey.split("\n") : []);
    const apply = () => root.querySelectorAll("table").forEach((one) => {
      if (one.hasAttribute("data-own-columns")) return;
      const labels = headings(one);
      const tag = tagOf(labels.slice(1).filter(Boolean));
      hide(one, new Set(labels.flatMap((label, at) => (at > 0 && label && off.has(`${tag}:${label}`) ? [at] : []))));
    });
    apply();
    const watch = new MutationObserver(() => apply());
    watch.observe(root, { childList: true, subtree: true, characterData: true });
    return () => watch.disconnect();
  }, [scope, hiddenKey]);

  const shown = useMemo(
    () => new Set(table ? table.labels.filter((label) => !all.includes(`${table.tag}:${label}`)) : []),
    [table, all],
  );
  if (!table) return null;
  return (
    <ColumnPicker columns={table.labels.map((label) => ({ id: label, label: title(label) }))} shown={shown}
      onChange={(now) => {
        const others = all.filter((one) => !one.startsWith(`${table.tag}:`));
        const next = [...others, ...table.labels.filter((label) => !now.has(label)).map((label) => `${table.tag}:${label}`)];
        if (saved) saved.change(next);
        else setMine(next);
      }} />
  );
}

function firstTable(root: HTMLElement | null) {
  if (!root) return null;
  return [...root.querySelectorAll("table")].find((one) => !one.hasAttribute("data-own-columns") && one.tHead) ?? null;
}

/** The headings a reader can take off: every one but the first, which names the row. */
function named(table: HTMLTableElement) {
  return headings(table).slice(1).filter(Boolean);
}

/** The headings of the table's last heading row, one per column it spans. */
function headings(table: HTMLTableElement): string[] {
  const rows = table.tHead?.rows;
  if (!rows || rows.length === 0) return [];
  const out: string[] = [];
  for (const cell of [...rows[rows.length - 1]!.cells]) {
    const span = Number(cell.dataset.span ?? cell.colSpan) || 1;
    out.push((cell.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 120));
    for (let more = 1; more < span; more += 1) out.push("");
  }
  return out;
}

/** A short tag of a table's headings, so a column is kept with the table it was taken off. */
function tagOf(labels: string[]) {
  let hash = 5381;
  for (const char of labels.join("|")) hash = ((hash * 33) ^ char.charCodeAt(0)) >>> 0;
  return hash.toString(36);
}

function hide(table: HTMLTableElement, gone: Set<number>) {
  for (const row of [...table.rows]) {
    let at = 0;
    for (const cell of [...row.cells]) {
      if (cell.dataset.span === undefined) cell.dataset.span = String(cell.colSpan || 1);
      const span = Number(cell.dataset.span) || 1;
      let kept = 0;
      for (let column = at; column < at + span; column += 1) if (!gone.has(column)) kept += 1;
      cell.hidden = kept === 0;
      if (span > 1 && kept > 0 && cell.colSpan !== kept) cell.colSpan = kept;
      at += span;
    }
  }
}

function title(label: string) {
  return label.length > 1 && label === label.toUpperCase() ? label.charAt(0) + label.slice(1).toLowerCase() : label;
}
