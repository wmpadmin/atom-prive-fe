import { Alert, Button, TextInput } from "@atomprive/ui";
import { Download, Plus, Search } from "lucide-react";
import { Link } from "react-router";
import { useStaffUser } from "../../auth/session";
import { readsEveryAdvisors } from "../../lib/permissions";

/**
 * The top of the proposals screen: what it is, what can be done from it, and the box that searches it.
 *
 * <p>Named for the thing and not for a direction. "Sent" was true for an advisor, who sends what is on
 * this list, and false for whoever reads every advisor's — and flatly confusing for somebody holding
 * both roles, who sends some of these and oversees the rest. The subtitle below says whose they are,
 * which is the question a direction was standing in for.
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
}: {
  /** Whoever cannot write a proposal is not offered the button that starts one. */
  writes: boolean;
  search: string;
  onSearch: (value: string) => void;
  onExport: () => void;
  exporting: boolean;
  canExport: boolean;
  /**
   * What the last export actually carried, where it could not carry everything. An export that quietly
   * stops at its limit is worse than no export: the file looks whole, and whoever takes it to a meeting
   * finds out what was missing from it there.
   */
  cappedAt: { carried: number; of: number } | null;
}) {
  // Whose proposals this list actually answers with. One reading of it, shared with the list below, which
  // asked the other question — may you write one — and so told somebody reading the whole firm's empty
  // list that they had not written a proposal yet.
  const wholeBook = readsEveryAdvisors(useStaffUser());
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          {/* Whose they are, which the screen above cannot say: it is this reader's own answer, not the
              queue's. The queue's own masthead sits above the tabs. */}
          <p className="text-sm font-semibold text-ink">
            {wholeBook ? "Every proposal the firm has written." : "Proposals written for your clients."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" disabled={exporting || !canExport} onClick={onExport}>
            <Download aria-hidden="true" />
            {exporting ? "Exporting…" : "Export"}
          </Button>
          {writes && (
            <Link to="/proposals/new">
              <Button>
                <Plus aria-hidden="true" />
                New proposal
              </Button>
            </Link>
          )}
        </div>
      </div>

      {cappedAt && (
        <Alert tone="warning">
          That file holds the first {cappedAt.carried.toLocaleString()} of{" "}
          {cappedAt.of.toLocaleString()} proposals — {(cappedAt.of - cappedAt.carried).toLocaleString()}{" "}
          are not in it. Narrow it by tab, by date or by search and export again to carry the rest.
        </Alert>
      )}

      <label className="relative block max-w-md">
        <span className="sr-only">Search proposals</span>
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted"
        />
        <TextInput
          value={search}
          placeholder="Search by proposal, reference or client"
          className="pl-9"
          onChange={(event) => onSearch(event.target.value)}
        />
      </label>
    </div>
  );
}
