import { ApiError } from "@atomprive/api-client";
import {
  useListMyClients,
  useListPacksToSign,
  useListProposals,
  type CustomerPage,
  type ProposalPage,
  type SignaturePackPage,
} from "@atomprive/api-client/backoffice";
import { cn } from "@atomprive/ui";
import { Link } from "react-router";
import { useStaffUser } from "../../auth/session";

/**
 * Where an advisor's own day stands: their clients, what is with a client, what is running out, and what is
 * waiting on their signature. Every figure is counted from what is recorded against them — there is nothing
 * here about the firm as a whole, which is not theirs to see.
 */
export function AdvisorDashboard() {
  const user = useStaffUser();
  // One row each, asked for only to be counted: the lists themselves live on their own screens.
  const clients = useListMyClients<CustomerPage, ApiError>({ size: 1 });
  const proposals = useListProposals<ProposalPage, ApiError>({ size: 1 });
  const toSign = useListPacksToSign<SignaturePackPage, ApiError>({ size: 1 });

  const counts = proposals.data?.counts;
  const first = user.fullName.split(" ")[0];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-[1.625rem] font-bold">Good to see you, {first}</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Your clients and your advice. Every figure is counted from what is recorded against you.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile
          label="Assigned customers"
          value={clients.data?.totalItems}
          failed={clients.isError}
          to="/my-clients"
        />
        <Tile label="With the client" value={counts?.awaitingClient} failed={proposals.isError} to="/proposals" />
        {/* The two that are somebody waiting on you, so they stand out when there are any. */}
        <Tile
          label="Running out"
          value={counts?.expiringSoon}
          failed={proposals.isError}
          to="/proposals"
          urgent={(counts?.expiringSoon ?? 0) > 0}
        />
        <Tile
          label="Waiting on your signature"
          value={toSign.data?.totalItems}
          failed={toSign.isError}
          to="/to-sign"
          urgent={(toSign.data?.totalItems ?? 0) > 0}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile label="Drafts" value={counts?.draft} failed={proposals.isError} to="/proposals" />
        <Tile label="With the manager" value={counts?.awaitingManager} failed={proposals.isError} to="/proposals" />
        <Tile label="Approved" value={counts?.approved} failed={proposals.isError} to="/proposals" />
        <Tile label="Rejected" value={counts?.rejected} failed={proposals.isError} to="/proposals" />
      </div>
    </div>
  );
}

/** One figure. It links to the screen it was counted from, because a number alone is not an answer. */
function Tile({
  label,
  value,
  to,
  failed = false,
  urgent = false,
}: {
  label: string;
  value: number | undefined;
  to: string;
  /** A figure that could not be counted says so, rather than counting for ever. */
  failed?: boolean;
  urgent?: boolean;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "block rounded-2xl border bg-white px-5 py-4 transition-colors hover:border-primary-300",
        urgent ? "border-amber-300" : "border-line",
      )}
    >
      <p className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">{label}</p>
      <p className={cn("mt-1 text-2xl font-bold tabular-nums", urgent ? "text-amber-700" : "text-ink")}>
        {failed ? (
          <span className="text-base font-normal text-ink-muted">Couldn't be counted</span>
        ) : value === undefined ? (
          <span className="text-base font-normal text-ink-muted">Counting…</span>
        ) : (
          value
        )}
      </p>
    </Link>
  );
}
