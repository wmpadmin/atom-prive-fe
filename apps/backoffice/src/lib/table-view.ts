import { useCallback, useMemo, useState } from "react";

/**
 * How one reader has arranged one table: which columns, in what order.
 *
 * <p>Kept in the browser rather than against the account. It is nobody's figure and nobody else reads
 * it — a column somebody hid is a thing about their screen, not about the client — so it does not need
 * a row in the database, an endpoint to write it or an answer from anybody. It follows the person on
 * this machine and not to another one, which is the trade being made.
 */
export type TableView = {
  /** Every movable column, in the order this reader put them. */
  order: string[];
  /** The ones they have taken off. */
  hidden: string[];
};

/**
 * What a saved arrangement is written under.
 *
 * <p>The table's own name and a number. The number is raised when a change would make an old
 * arrangement mean something different, so a view saved against the columns of one table is never read
 * back into another.
 */
function where(table: string) {
  return `atomprive.table-view.v1.${table}`;
}

/** Nothing stored, a private window, blocked site data, a half-written value: all the same answer. */
function read(table: string): TableView | null {
  try {
    const found = window.localStorage.getItem(where(table));
    if (!found) return null;
    const parsed: unknown = JSON.parse(found);
    if (typeof parsed !== "object" || parsed === null) return null;
    const { order, hidden } = parsed as Partial<TableView>;
    if (!Array.isArray(order) || !Array.isArray(hidden)) return null;
    return {
      order: order.filter((one) => typeof one === "string"),
      hidden: hidden.filter((one) => typeof one === "string"),
    };
  }
  catch {
    return null;
  }
}

/**
 * A stored arrangement read against the columns the table actually has today.
 *
 * <p>Neither side is trusted over the other. A column the table no longer has is dropped, because an
 * arrangement cannot place something that is not there; a column the table has gained is put back where
 * it was written, because a reader who arranged seven columns last week did not ask for the eighth to
 * land at the end. Without both, a saved view quietly becomes wrong the first time the table changes.
 */
function settle(stored: TableView | null, columns: string[]): TableView {
  if (!stored) return { order: columns, hidden: [] };
  const known = new Set(columns);
  const kept = stored.order.filter((one) => known.has(one));
  const missing = columns.filter((one) => !kept.includes(one));
  const order = [...kept];
  for (const one of missing) {
    order.splice(Math.min(columns.indexOf(one), order.length), 0, one);
  }
  return { order, hidden: stored.hidden.filter((one) => known.has(one)) };
}

/**
 * One table's arrangement: what to draw, and the three things a reader can do to it.
 *
 * @param table what this arrangement is saved under
 * @param columns every movable column the table has, in the order the firm wrote them
 */
export function useTableView(table: string, columns: string[]) {
  // The list itself and not its identity: a new array of the same names is the same table, and a
  // dependency on the array would settle the view on every render instead of when the table changes.
  // Taken apart again from the same string so everything below can depend on one value that a reader —
  // and the compiler — can check, without holding the caller's array across renders.
  const signature = columns.join("\u0000");
  const named = useMemo(() => (signature === "" ? [] : signature.split("\u0000")), [signature]);

  // What is on file, read once on the render that first needs it. Read in an effect afterwards instead,
  // the table draws the firm's order first and the reader's a moment later, which looks like the screen
  // rearranging itself under them.
  const [kept, setKept] = useState<TableView | null>(() => read(table));

  // And settled against the columns the table actually has, here rather than in an effect: this is a
  // reading of what is already known, not a thing that has to happen to anything. Done in an effect it
  // would be a second render every time, and a render that draws an arrangement nobody asked for in
  // between.
  const view = useMemo(() => settle(kept, named), [kept, named]);

  const remember = useCallback((next: TableView) => {
    setKept(next);
    try {
      window.localStorage.setItem(where(table), JSON.stringify(next));
    }
    catch {
      // A browser that will not keep it still draws it. The arrangement lasts the sitting instead of
      // lasting, which is worth more than refusing to rearrange at all.
    }
  }, [table]);

  /** Where a column is put down, not how far it travelled: the same answer for a drag and for a keypress. */
  const move = useCallback((id: string, to: number) => {
    const from = view.order.indexOf(id);
    if (from < 0 || to < 0 || to >= view.order.length || from === to) return;
    const order = [...view.order];
    order.splice(from, 1);
    order.splice(to, 0, id);
    remember({ ...view, order });
  }, [view, remember]);

  const toggle = useCallback((id: string) => {
    remember({
      ...view,
      hidden: view.hidden.includes(id)
        ? view.hidden.filter((one) => one !== id)
        : [...view.hidden, id],
    });
  }, [view, remember]);

  /** Back to the order the firm wrote, with everything on. */
  const reset = useCallback(() => {
    try {
      window.localStorage.removeItem(where(table));
    }
    catch { /* nothing kept is the state this puts it back to anyway */ }
    setKept(null);
  }, [table]);

  const shown = view.order.filter((one) => !view.hidden.includes(one));
  return {
    order: view.order,
    hidden: view.hidden,
    /** The movable columns to draw, in order, with the hidden ones taken out. */
    shown,
    /** Whether this reader has arranged it at all, which is what decides whether Reset is worth offering. */
    arranged: view.hidden.length > 0 || view.order.join("\u0000") !== signature,
    move,
    toggle,
    reset,
    remember,
  };
}
