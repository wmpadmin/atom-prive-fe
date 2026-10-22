import { Pagination } from "@atomprive/ui";
import { useState } from "react";
import { DEFAULT_PAGE_SIZE, PAGE_SIZES } from "./page-sizes";

/**
 * A page of rows the browser already holds, and the controls to move through them.
 *
 * <p>Some lists come back from the server a page at a time, and those screens pass the server's own page
 * straight to {@link Pagination}. Others arrive whole — a queue the server sends in two pieces, a client's
 * holdings, a model's clients — and those were drawn all at once, with no footer under them at all. Two
 * tables side by side on one screen, one of them counting itself and one of them not, is not a choice
 * anybody made; it is what happens when paging is something each screen decides for itself.
 *
 * <p>So the rows are sliced here, and the footer below looks and reads the same either way.
 */
export function usePagedRows<T>(rows: readonly T[], startingSize: number = DEFAULT_PAGE_SIZE) {
  const [page, setPage] = useState(0);
  const [size, setSize] = useState<number>(startingSize);
  // Narrowing a list can leave the reader standing past the end of it — four pages of requests, filtered
  // down to one, and page three is a table with nothing in it and no way back. The page is pulled back to
  // the last one that exists rather than reset, so narrowing from page one keeps you on page one.
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const on = Math.min(page, pages - 1);
  return {
    page: on,
    size,
    /** Just this page's worth, which is what the table draws. */
    shown: rows.slice(on * size, on * size + size),
    total: rows.length,
    onPage: setPage,
    onSize(next: number) {
      setSize(next);
      setPage(0);
    },
  };
}

/**
 * The line under a table: how much of it you are looking at, how much to show, and the way through.
 *
 * <p>Drawn whatever the count. A single row still says "Showing 1 of 1", because a table that only grows
 * a footer once it is long leaves a reader unsure whether a short list is short or cut off.
 */
export function PagedFooter({ paged, noun }: {
  paged: { page: number; size: number; total: number; onPage: (page: number) => void; onSize: (size: number) => void };
  /** What one row is, and what many are: ["request", "requests"]. */
  noun: [string, string];
}) {
  return (
    <div className="border-t border-line px-5 py-3">
      <Pagination
        page={paged.page}
        pageSize={paged.size}
        totalItems={paged.total}
        onPageChange={paged.onPage}
        pageSizes={PAGE_SIZES}
        onPageSizeChange={paged.onSize}
        noun={noun}
      />
    </div>
  );
}
