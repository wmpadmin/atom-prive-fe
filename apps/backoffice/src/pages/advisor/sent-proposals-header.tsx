import { Button, TextInput } from "@atomprive/ui";
import { Download, Plus, Search } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { useStaffUser } from "../../auth/session";
import { hasAuthority } from "../../lib/permissions";

/**
 * The top of the sent proposals screen: what it is, what can be done from it, and the box that searches it.
 *
 * <p>It sits above an open proposal as well as above the list, so opening one never loses the way back to
 * everything else — the screen is the list, and a proposal is read within it.
 */
export function SentProposalsHeader({
  writes,
  search,
  onSearch,
  onExport,
  exporting,
  canExport,
  extra,
}: {
  /** Whoever cannot write a proposal is not offered the button that starts one. */
  writes: boolean;
  search: string;
  onSearch: (value: string) => void;
  onExport: () => void;
  exporting: boolean;
  canExport: boolean;
  /** An action belonging to whatever is open below, such as resending the proposal being read. */
  extra?: ReactNode;
}) {
  // Whose proposals this list actually answers with, asked the same way the API asks it: whoever oversees
  // proposals reads every advisor's. It used to be read off whether you may write one, which is a different
  // question — a portfolio manager writes proposals and reads everybody's, so the page said "your clients
  // only" over a list full of other advisors' work.
  const everyAdvisors = hasAuthority(useStaffUser(), "SEND_PROPOSALS:VIEW");
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[1.625rem] font-bold">Sent proposals list</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {everyAdvisors ? "Every advisor's. " : "Your clients only. "}
            Open one for the full proposal, the client's decision and its audit trail. Advisory only — the
            platform never places a trade.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {extra}
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
