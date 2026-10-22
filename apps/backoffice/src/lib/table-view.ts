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

/** An arrangement somebody has kept and named, so they can come back to it. */
export type SavedView = TableView & { name: string };

type Stored = {
  /** What the table looks like right now, named or not. */
  working: TableView | null;
  views: SavedView[];
  /** The name of the view the working arrangement was last taken from, where it was taken from one. */
  current: string | null;
};

/**
 * What a reader's arrangements are written under.
 *
 * <p>The table's own name and a number. The number is raised when a change would make an old
 * arrangement mean something different, so a view saved against the columns of one table is never read
 * back into another.
 */
function where(table: string) {
  return `atomprive.table-view.v2.${table}`;
}

/** Where a single arrangement was kept before a reader could name more than one. */
function whereBefore(table: string) {
  return `atomprive.table-view.v1.${table}`;
}

function anArrangement(parsed: unknown): TableView | null {
  if (typeof parsed !== "object" || parsed === null) return null;
  const { order, hidden } = parsed as Partial<TableView>;
  if (!Array.isArray(order) || !Array.isArray(hidden)) return null;
  return {
    order: order.filter((one) => typeof one === "string"),
    hidden: hidden.filter((one) => typeof one === "string"),
  };
}

/**
 * Everything on file for this table.
 *
 * <p>Nothing stored, a private window, blocked site data, a half-written value: all the same answer,
 * which is the one the firm's own order gives. An arrangement kept before views could be named is read
 * as the working one, because somebody who arranged their table last week did not ask to lose it.
 */
function read(table: string): Stored {
  const empty: Stored = { working: null, views: [], current: null };
  try {
    const found = window.localStorage.getItem(where(table));
    if (!found) {
      const before = window.localStorage.getItem(whereBefore(table));
      return before ? { ...empty, working: anArrangement(JSON.parse(before)) } : empty;
    }
    const parsed: unknown = JSON.parse(found);
    if (typeof parsed !== "object" || parsed === null) return empty;
    const { working, views, current } = parsed as Partial<Stored>;
    return {
      working: anArrangement(working),
      views: (Array.isArray(views) ? views : []).flatMap((one) => {
        const arrangement = anArrangement(one);
        const name = (one as Partial<SavedView> | null)?.name;
        return arrangement && typeof name === "string" && name !== ""
          ? [{ ...arrangement, name }]
          : [];
      }),
      current: typeof current === "string" ? current : null,
    };
  }
  catch {
    return empty;
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

function same(a: TableView, b: TableView) {
  return a.order.join("\u0000") === b.order.join("\u0000")
    && [...a.hidden].sort().join("\u0000") === [...b.hidden].sort().join("\u0000");
}

/**
 * One table's arrangements: the one on screen, the ones this reader has kept, and what can be done to
 * either.
 *
 * @param table what these arrangements are saved under
 * @param columns every movable column the table has, in the order the firm wrote them
 */
export function useTableView(table: string, columns: string[]) {
  // The list itself and not its identity: a new array of the same names is the same table. Taken apart
  // again from the same string so everything below depends on one value a reader — and the compiler —
  // can check, without holding the caller's array across renders.
  const signature = columns.join("\u0000");
  const named = useMemo(() => (signature === "" ? [] : signature.split("\u0000")), [signature]);

  // What is on file, read once on the render that first needs it. Read in an effect afterwards instead,
  // the table draws the firm's order first and the reader's a moment later, which looks like the screen
  // rearranging itself under them.
  const [kept, setKept] = useState<Stored>(() => read(table));

  // Settled against the columns the table actually has, here rather than in an effect: this is a reading
  // of what is already known, not a thing that has to happen to anything.
  const view = useMemo(() => settle(kept.working, named), [kept.working, named]);
  const views = useMemo(
    () => kept.views.map((one) => ({ ...settle(one, named), name: one.name })),
    [kept.views, named],
  );

  const write = useCallback((next: Stored) => {
    setKept(next);
    try {
      window.localStorage.setItem(where(table), JSON.stringify(next));
      // The single arrangement this replaces, so it is not read back the next time a browser is opened.
      window.localStorage.removeItem(whereBefore(table));
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
    write({ ...kept, working: { ...view, order } });
  }, [view, kept, write]);

  const toggle = useCallback((id: string) => {
    write({
      ...kept,
      working: {
        ...view,
        hidden: view.hidden.includes(id)
          ? view.hidden.filter((one) => one !== id)
          : [...view.hidden, id],
      },
    });
  }, [view, kept, write]);

  /** Back to the order the firm wrote, with everything on. The saved views are left alone. */
  const reset = useCallback(() => {
    write({ ...kept, working: null, current: null });
  }, [kept, write]);

  /**
   * Keeps what is on screen under a name.
   *
   * <p>A name already in use is written over rather than kept twice: two views called the same thing is
   * a list nobody can choose from.
   */
  const saveAs = useCallback((name: string) => {
    const trimmed = name.trim();
    if (trimmed === "") return;
    const saved: SavedView = { ...view, name: trimmed };
    write({
      ...kept,
      views: [...kept.views.filter((one) => one.name !== trimmed), saved],
      current: trimmed,
    });
  }, [view, kept, write]);

  /** Puts a saved view on screen. */
  const apply = useCallback((name: string) => {
    const found = kept.views.find((one) => one.name === name);
    if (!found) return;
    write({ ...kept, working: { order: found.order, hidden: found.hidden }, current: name });
  }, [kept, write]);

  const remove = useCallback((name: string) => {
    write({
      ...kept,
      views: kept.views.filter((one) => one.name !== name),
      current: kept.current === name ? null : kept.current,
    });
  }, [kept, write]);

  const current = kept.current;
  const currently = views.find((one) => one.name === current);
  const shown = view.order.filter((one) => !view.hidden.includes(one));
  return {
    order: view.order,
    hidden: view.hidden,
    /** The movable columns to draw, in order, with the hidden ones taken out. */
    shown,
    /** Whether this reader has arranged it at all, which decides whether putting it back is worth offering. */
    arranged: view.hidden.length > 0 || view.order.join("\u0000") !== signature,
    views,
    /** The view on screen, where it came from one. */
    current,
    /** Whether what is on screen has been changed since it was taken from that view. */
    changed: currently !== undefined && !same(currently, view),
    move,
    toggle,
    reset,
    saveAs,
    apply,
    remove,
  };
}
