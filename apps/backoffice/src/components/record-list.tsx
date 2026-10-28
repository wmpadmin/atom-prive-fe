import { Pagination, cn } from "@atomprive/ui";
import type { ReactNode } from "react";
import { PAGE_SIZES } from "../lib/page-sizes";

/**
 * The shape every list in the back office takes: a title with whatever it lets you do, then a card holding the
 * search and filters, the table, and the pager. The two lists that started life apart — clients and onboarding
 * cases — are built from this so they cannot drift again; what stays theirs is their columns and their rows.
 */

/** The top of a list screen: what it is, what it is for, and the controls that act on the whole list. */
export function ListPageHeader({ title, lead, children }: { title: string; lead: string; children?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-[1.625rem] font-bold">{title}</h1>
        <p className="mt-1 text-sm text-ink-muted">{lead}</p>
      </div>
      {children}
    </header>
  );
}

interface RecordListProps {
  /** What the list holds, over the table: "Clients", "Onboarding cases". */
  caption: string;
  /** The line under it, such as "Newest first". */
  subtitle?: string;
  /**
   * The box that searches the list.
   *
   * <p>Above the card, on its own line. Searching is what somebody does before they have a list to read —
   * it is the question, and the card below is the answer — and a search box set inside the card read as
   * one more thing in the table's furniture.
   */
  search?: ReactNode;
  /**
   * The one thing this screen is for doing, on the search box's own line and at the far end of it.
   *
   * <p>Not in the page heading with the column picker and the export. Those are about how the list is
   * read; this is the work the list exists to start, and it belongs beside the box somebody types in
   * rather than above the sentence describing the screen.
   */
  action?: ReactNode;
  /**
   * What narrows the list once it is on screen: a relationship manager, a status, a date range.
   *
   * <p>On the card's own heading line, at the right-hand end, the same line the queues on the approvals
   * screens draw. These belong to the list rather than to the question — floated above the card a lone
   * dropdown sat in open space with nothing to line up against, and beside the name of the list it reads
   * as what that list has been narrowed to.
   */
  filters?: ReactNode;
  /** A bar under the filters, such as what is ticked and what can be done with it. */
  banner?: ReactNode;
  /** Whether anything is searched or filtered, which is what offers to clear it. */
  filtered?: boolean;
  onClear?: () => void;
  /** The table's own heading cells, which belong to the list rather than to this. */
  head: ReactNode;
  /** How many columns the table draws, for the lines that run the width of it. */
  columns: number;
  /** Still fetching the first page, with nothing to show yet. */
  loading?: boolean;
  loadingLabel?: string;
  /** What to say when the list is empty, in the list's own words. */
  empty?: ReactNode;
  /** A page still shown while the next is fetched: dimmed rather than emptied. */
  stale?: boolean;
  busy?: boolean;
  /** Where the list has got to. The pager is left out when there is nothing to page through. */
  page: number;
  size: number;
  total: number;
  /** What one row is, singular and plural: ["client", "clients"]. */
  noun: [string, string];
  onPage: (page: number) => void;
  onSize: (size: number) => void;
  /** The rows. */
  children: ReactNode;
}

export function RecordList({
  caption,
  subtitle = "Newest first",
  search,
  action,
  filters,
  banner,
  filtered,
  onClear,
  head,
  columns,
  loading,
  loadingLabel,
  empty,
  stale,
  busy,
  page,
  size,
  total,
  noun,
  onPage,
  onSize,
  children,
}: RecordListProps) {
  return (
    <>
      {/* Top-aligned rather than centred. The one action a list screen offers is a taller control than
          the search box beside it, and centred it hung below the box's own line; aligned at the top the
          two read as one line. A row holding only a search box looks the same either way. */}
      {(search || action) && (
        <div className="flex flex-wrap items-start gap-3">
          {search}
          {action && <div className="ml-auto">{action}</div>}
        </div>
      )}

      <section className="rounded-2xl border border-line bg-white">
        <div className="space-y-4 px-5 pt-5 pb-4">
          {/* Top-aligned: a control carrying a little label above it is taller than the two lines of the
              heading, and bottom-aligning dropped the name of the list below everything it names. */}
          <div className="flex flex-wrap items-start gap-3">
            <div>
              <h2 className="text-base font-bold">{caption}</h2>
              <p className="text-xs text-ink-muted">{subtitle}</p>
            </div>
            {(filters || (filtered && onClear)) && (
              <div className="ml-auto flex flex-wrap items-end justify-end gap-2">
                {filters}
                {filtered && onClear && (
                  <button
                    type="button"
                    onClick={onClear}
                    className="pb-2 text-sm font-semibold text-primary-600 hover:text-primary-700"
                  >
                    Clear search and filters
                  </button>
                )}
              </div>
            )}
          </div>
          {banner}
        </div>

        <div className="overflow-x-auto">
          <table className={cn("min-w-full text-sm transition-opacity", stale && "opacity-60")} aria-busy={busy}>
            <thead>
              <tr className="border-y border-line text-left text-2xs font-semibold tracking-wider whitespace-nowrap text-ink-muted uppercase">
                {head}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {loading && (
                <tr>
                  <td colSpan={columns} className="px-5 py-8 text-center text-ink-muted">
                    {loadingLabel ?? `Loading ${noun[1]}…`}
                  </td>
                </tr>
              )}
              {!loading && empty && (
                <tr>
                  <td colSpan={columns} className="px-5 py-10 text-center text-ink-muted">
                    {empty}
                  </td>
                </tr>
              )}
              {children}
            </tbody>
          </table>
        </div>

        {total > 0 && (
          <div className="border-t border-line px-5 py-3">
            <Pagination
              page={page}
              pageSize={size}
              totalItems={total}
              noun={noun}
              onPageChange={(next) => {
                onPage(next);
                window.scrollTo({ top: 0 });
              }}
              pageSizes={PAGE_SIZES}
              onPageSizeChange={onSize}
            />
          </div>
        )}
      </section>
    </>
  );
}

/** The link a list's empty line offers when a search or a filter is what emptied it. */
export function ClearFiltersLink({ onClear, children }: { onClear: () => void; children: ReactNode }) {
  return (
    <>
      {children}{" "}
      <button type="button" onClick={onClear} className="font-semibold text-primary-600 hover:text-primary-700">
        Clear search and filters
      </button>
    </>
  );
}
