import { ChevronLeft, ChevronRight } from "lucide-react";
import { useId, type ReactNode } from "react";
import { cn } from "./cn";
import { SelectInput } from "./form";

interface PaginationProps {
  /** Zero-based, as the API counts pages. */
  page: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  /** The page sizes to offer; leave out to keep the size fixed. */
  pageSizes?: readonly number[];
  onPageSizeChange?: (size: number) => void;
  /** What the rows are, singular and plural, such as ["case", "cases"]. */
  noun: readonly [singular: string, plural: string];
}

/** Below a table: "Showing 11–20 of 45 cases", rows per page, and the pages, such as ‹ 1 … 4 5 6 … 12 ›. */
export function Pagination({ page, pageSize, totalItems, onPageChange, pageSizes, onPageSizeChange, noun }: PaginationProps) {
  const sizeId = useId();
  const pageCount = Math.max(1, Math.ceil(totalItems / pageSize));
  const first = page * pageSize + 1;
  const last = Math.min((page + 1) * pageSize, totalItems);
  const rows = totalItems === 1 ? noun[0] : noun[1];

  let summary = `No ${noun[1]}`;
  if (totalItems > 0 && first <= totalItems) {
    summary = first === last ? `Showing ${first} of ${totalItems} ${rows}` : `Showing ${first}–${last} of ${totalItems} ${rows}`;
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-ink-muted tabular-nums">{summary}</p>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        {pageSizes && onPageSizeChange && (
          <div className="flex items-center gap-2 text-sm text-ink-muted">
            <label htmlFor={sizeId}>Rows per page</label>
            <SelectInput
              id={sizeId}
              value={pageSize}
              onChange={(event) => onPageSizeChange(Number(event.target.value))}
              className="h-8 w-auto rounded-lg pr-8 pl-3 text-xs"
            >
              {pageSizes.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </SelectInput>
          </div>
        )}
        <nav aria-label="Pages" className="flex items-center gap-1">
          <PageButton label="Previous page" disabled={page === 0} onClick={() => onPageChange(page - 1)}>
            <ChevronLeft aria-hidden="true" />
          </PageButton>
          {pageItems(page, pageCount).map((item, index) =>
            item === "gap" ? (
              <span key={`gap-${index}`} aria-hidden="true" className="grid h-8 w-6 place-items-center text-xs text-ink-muted">
                …
              </span>
            ) : (
              <PageButton key={item} label={`Page ${item + 1}`} current={item === page} onClick={() => onPageChange(item)}>
                {item + 1}
              </PageButton>
            ),
          )}
          <PageButton label="Next page" disabled={page >= pageCount - 1} onClick={() => onPageChange(page + 1)}>
            <ChevronRight aria-hidden="true" />
          </PageButton>
        </nav>
      </div>
    </div>
  );
}

function PageButton({ label, current, disabled, onClick, children }: { label: string; current?: boolean; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-current={current ? "page" : undefined}
      disabled={disabled}
      onClick={current ? undefined : onClick}
      className={cn(
        "inline-grid h-8 min-w-8 place-items-center rounded-lg border px-2 text-xs font-semibold tabular-nums transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600",
        "disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-4",
        current ? "border-primary-600 bg-primary-600 text-white" : "border-line bg-white text-ink-soft hover:bg-slate-50",
      )}
    >
      {children}
    </button>
  );
}

/** The pages to show: always the first and last, the current one with its neighbours, and "…" for the rest. */
function pageItems(page: number, pageCount: number): (number | "gap")[] {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, index) => index);
  }
  const start = Math.max(1, Math.min(page - 1, pageCount - 5));
  const end = Math.min(pageCount - 2, Math.max(page + 1, 4));
  const items: (number | "gap")[] = [0];
  // A gap of a single page shows that page instead of "…".
  if (start === 2) items.push(1);
  else if (start > 2) items.push("gap");
  for (let index = start; index <= end; index++) items.push(index);
  if (end === pageCount - 3) items.push(pageCount - 2);
  else if (end < pageCount - 3) items.push("gap");
  items.push(pageCount - 1);
  return items;
}
