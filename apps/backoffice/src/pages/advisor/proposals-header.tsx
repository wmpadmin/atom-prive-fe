import { Alert, Button, TextInput } from "@atomprive/ui";
import { Download, Plus, Search } from "lucide-react";
import { Link } from "react-router";
import { QueueActions } from "../../components/queue-actions";

/**
 * The top of the proposals screen: what it is and what can be done from it.
 *
 * <p>Named for the thing and not for a direction. "Sent" was true for an advisor, who sends what is on
 * this list, and false for whoever reads every advisor's — and flatly confusing for somebody holding
 * both roles, who sends some of these and oversees the rest.
 *
 * <p>No line of its own saying whose proposals these are. It said what the screen already says: the tab
 * that opened it is named, the card below is named, and every row carries the advisor who wrote it — so
 * the sentence was a third naming, set above the filter row it had nothing to do with.
 *
 * <p>It sits above an open proposal as well as above the list, so opening one never loses the way back to
 * everything else — the screen is the list, and a proposal is read within it.
 */
export function ProposalsHeader({
  writes,
  search,
  onSearch,
  onExport,
  exporting,
  canExport,
  cappedAt,
  reading = false,
}: {
  /** Whoever cannot write a proposal is not offered the button that starts one. */
  writes: boolean;
  /**
   * The box that searches the list, where this header stands above an open proposal rather than above the
   * list itself.
   *
   * <p>Left out above the list, where the search sits in the filter row with everything else that narrows
   * it — one row, the same row every other queue draws, rather than a box of its own floating a strip of
   * page above the controls it belongs with.
   */
  search?: string;
  onSearch?: (value: string) => void;
  onExport: () => void;
  exporting: boolean;
  canExport: boolean;
  /**
   * What the last export actually carried, where it could not carry everything. An export that quietly
   * stops at its limit is worse than no export: the file looks whole, and whoever takes it to a meeting
   * finds out what was missing from it there.
   */
  cappedAt: { carried: number; of: number } | null;
  /**
   * Whether a proposal is open below this.
   *
   * <p>The header sits above the list AND above one open proposal, which is what keeps the way back on
   * the page. Above an open one it must not offer to start a new one: the reader is in the middle of
   * reading something, and the button sent them somewhere else with no warning. What Export means changes
   * with it — the list exports the list, and a proposal exports itself.
   */
  reading?: boolean;
}) {
  return (
    // No box of its own. Above a list the buttons go up to the screen's heading row, where there was room
    // for them, and what is left here is the alert and the search — each spaced by whatever holds them.
    <>
      {/* Only what can be done, at the end of the row. There is nothing on the left of it to justify
          against any more, so the row ends at the right edge rather than spanning a width of nothing. */}
      <QueueActions className="flex flex-wrap items-center justify-end gap-2">
        <Button variant="secondary" disabled={exporting || !canExport} onClick={onExport}>
          <Download aria-hidden="true" />
          {exporting ? (reading ? "Preparing…" : "Exporting…") : reading ? "Download PDF" : "Export"}
        </Button>
        {writes && !reading && (
          <Link to="/proposals/new">
            <Button>
              <Plus aria-hidden="true" />
              New proposal
            </Button>
          </Link>
        )}
      </QueueActions>

      {cappedAt && (
        <Alert tone="warning">
          That file holds the first {cappedAt.carried.toLocaleString()} of{" "}
          {cappedAt.of.toLocaleString()} proposals — {(cappedAt.of - cappedAt.carried).toLocaleString()}{" "}
          are not in it. Narrow it by tab, by date or by search and export again to carry the rest.
        </Alert>
      )}

      {onSearch && (
        <label className="relative block max-w-md">
          <span className="sr-only">Search proposals</span>
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted"
          />
          <TextInput
            value={search ?? ""}
            placeholder="Search by proposal, reference or client"
            className="pl-9"
            onChange={(event) => onSearch(event.target.value)}
          />
        </label>
      )}
    </>
  );
}
