import { DateInput, FilterMenu, TextInput, type FilterOption } from "@atomprive/ui";
import type { ReactNode } from "react";

/** The firm's record does not go back twenty years, so neither does a date picker over it. */
function yearsAgo(years: number) {
  const day = new Date();
  return new Date(day.getFullYear() - years, day.getMonth(), day.getDate());
}

/**
 * The line above a queue: what to search for on the left, what narrows the list on the right.
 *
 * <p>Above the card rather than inside its heading. The card is the list; what narrows the list is a
 * thing somebody does before reading it — and crammed into the heading row it pushed the card's own name
 * to the far left of four tall controls and read as part of the table.
 *
 * <p>Written once because three queues were drawing this line three times, and the three had already
 * drifted: one had a search and no dates, one had dates and no search, and the order control existed on
 * one of them. A reader who has learnt a queue has learnt them all, and that is only true while one file
 * decides what the row holds.
 *
 * <p>The words differ by queue and nothing else does. A proposal is SENT and a request is ASKED, so the
 * date labels are the caller's to name; everything about how they behave is here.
 */
export function QueueFilters<T extends string>({
  search, onSearch, searchPlaceholder, show, dated, newestFirst, onNewestFirst, children,
}: {
  search: string;
  onSearch: (search: string) => void;
  searchPlaceholder: string;
  /** What states the list may be narrowed to, with how many are in each. */
  show: { value: T; options: FilterOption<T>[]; onChange: (value: T) => void };
  /**
   * The date range, and the verb it is read in.
   *
   * <p>Left out where a queue has no date worth narrowing by — a queue of what is waiting on one person
   * is short by definition, and a date range over it is a control that answers nothing.
   */
  dated?: { verb: string; from: string; to: string; onFrom: (day: string) => void; onTo: (day: string) => void };
  newestFirst: boolean;
  /**
   * Left out on the same grounds as the dates: a queue of what is waiting on one person is served by its
   * own endpoint, which is not asked which end to read from. A control that cannot change what is on
   * screen is worse than a missing one — it is read as broken.
   */
  onNewestFirst?: (newestFirst: boolean) => void;
  /** Anything the queue does rather than reads — Export, New proposal — kept at the left of the row. */
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <TextInput
        id={`search-${searchPlaceholder.replace(/\W+/g, "-").toLowerCase()}`}
        value={search}
        onChange={(event) => onSearch(event.target.value)}
        placeholder={searchPlaceholder}
        className="w-full max-w-md"
      />
      {children}
      {/* At the right-hand end, where somebody who has read the list to the bottom looks to change it. */}
      <div className="ml-auto flex flex-wrap items-end justify-end gap-3">
        <div>
          <Label>Show</Label>
          <FilterMenu label="Show" value={show.value} options={show.options} onChange={show.onChange}
            align="right" />
        </div>
        {dated && (
          <>
            <label className="block">
              <Label>{dated.verb} from</Label>
              <DateInput id="queue-from" name="from" value={dated.from} clearable min={yearsAgo(20)}
                max={new Date()} onChange={(next) => dated.onFrom(next ?? "")} />
            </label>
            <label className="block">
              <Label>{dated.verb} to</Label>
              <DateInput id="queue-to" name="to" value={dated.to} clearable min={yearsAgo(20)}
                max={new Date()} onChange={(next) => dated.onTo(next ?? "")} />
            </label>
          </>
        )}
        {onNewestFirst && (
          <div>
            <Label>Order</Label>
            <FilterMenu
              label="Order"
              value={newestFirst ? "newest" : "oldest"}
              options={[{ id: "newest", label: "Newest first" }, { id: "oldest", label: "Oldest first" }]}
              onChange={(next) => onNewestFirst(next === "newest")}
              align="right"
            />
          </div>
        )}
      </div>
    </div>
  );
}

/** The little caption above a control. Set once so four of them in a row are four of the same thing. */
function Label({ children }: { children: ReactNode }) {
  return (
    <span className="block text-2xs font-semibold tracking-wider text-ink-muted uppercase">{children}</span>
  );
}
