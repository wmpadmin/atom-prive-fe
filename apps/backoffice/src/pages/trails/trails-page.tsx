import { ApiError } from "@atomprive/api-client";
import {
  useListAdvisedClients,
  useListTrailClients,
  type AdvisedClient,
  type TrailClient,
} from "@atomprive/api-client/backoffice";
import { Alert, cn } from "@atomprive/ui";
import { ChevronRight } from "lucide-react";
import { Link, useSearchParams } from "react-router";
import { formatDate } from "../../lib/labels";
import { figure } from "../portfolios/money-words";
import { TRAILS, trailOf, type TrailId } from "./trail-kinds";
import { ArchivedMark, archivedRow } from "../../components/archived-client";

/**
 * Everything the firm has written down, by the kind of work and then by the client it happened to.
 *
 * <p>Client first, because that is the question: somebody asks what has been done to Aman, not what the
 * firm did on Tuesday. The trail opens on the clients a kind of work has happened to — a name, how many
 * times, how much, when it last happened — and each is a press away from their own history.
 *
 * <p>A client nothing has happened to is absent rather than listed empty. This is the work grouped, not
 * the client directory.
 */
export function TrailsPage() {
  const [params] = useSearchParams();
  const trail = trailOf(params.get("trail"));

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-[1.625rem] font-bold">Trails</h1>
        <p className="mt-1 max-w-[84ch] text-sm text-ink-muted">
          Everything the firm has written down, by the kind of work. Open a client to read their history.
        </p>
      </header>

      <TrailTabs current={trail.id} href={(id) => `/trails?trail=${id}`} />
      <p className="max-w-[90ch] text-sm text-ink-muted">{trail.description}</p>

      {trail.id === "proposals" ? <AdvisedClients /> : <WorkedClients trail={trail.id} />}
    </div>
  );
}

/**
 * The four trails, as one row.
 *
 * <p>Each tab is given the address it goes to rather than working one out. The trail sits in the query
 * on the opening screen and in the path once you are inside a client, and a component that guessed wrote
 * the query one while the page read the path one: the address changed, the tab lit, and the table under
 * it did not move.
 */
export function TrailTabs({ current, href }: { current: TrailId; href: (id: TrailId) => string }) {
  return (
    <div role="tablist" aria-label="Which trail" className="flex gap-1 scroll-x-quietly border-b border-line">
      {TRAILS.map((one) => (
        <Link
          key={one.id}
          role="tab"
          aria-selected={current === one.id}
          to={href(one.id)}
          className={cn(
            "-mb-px border-b-2 px-3 py-2 text-sm font-semibold whitespace-nowrap transition-colors",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600",
            current === one.id
              ? "border-primary-600 text-primary-700"
              : "border-transparent text-ink-muted hover:text-ink",
          )}
        >
          {one.label}
        </Link>
      ))}
    </div>
  );
}

/** Clients the desk has advised. Proposals are their own module, so they are asked for separately. */
function AdvisedClients() {
  const clients = useListAdvisedClients<AdvisedClient[], ApiError>();
  // A proposal carries a value, but the advice itself is not a sum of money the way a move is, so the
  // proposal trail counts and does not total.
  return <ClientList trail="proposals" asked={clients} what="proposal" />;
}

/** Clients a money move or a plan change has happened to. */
function WorkedClients({ trail }: { trail: TrailId }) {
  const clients = useListTrailClients<TrailClient[], ApiError>(trail);
  return (
    <ClientList
      trail={trail}
      asked={clients}
      what={trail === "models" ? "plan change" : trail === "trades" ? "rebalance" : "request"}
    />
  );
}

type Asked = {
  isPending: boolean;
  isError: boolean;
  error: ApiError | null;
  data: (TrailClient | AdvisedClient)[] | undefined;
};

function ClientList({ trail, asked, what }: { trail: TrailId; asked: Asked; what: string }) {
  if (asked.isPending) {
    return <p className="text-sm text-ink-muted">Reading the trail…</p>;
  }
  if (asked.isError) {
    return <Alert tone="danger">{asked.error?.message}</Alert>;
  }
  const clients = asked.data ?? [];
  if (clients.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-line px-5 py-10 text-center text-sm text-ink-muted">
        Nothing of this kind has happened to any client yet.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {clients.map((one) => {
        // A deactivated client keeps their line — the work happened, and a trail that dropped it would be
        // a trail somebody could empty by having a client deactivated — but the line stops opening.
        const inside = (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold">{one.clientName}</span>
              {one.clientCode && <span className="block text-xs text-ink-muted">{one.clientCode}</span>}
              {one.clientArchived && <ArchivedMark />}
            </span>
            <span className="shrink-0 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-ink-soft tabular-nums">
              {one.items} {one.items === 1 ? what : `${what}s`}
            </span>
            {/* Only where the trail is about money. A plan change moves nobody's figures on its own. */}
            {"amount" in one && one.amount != null && (
              <span className="shrink-0 text-xs font-semibold text-ink tabular-nums">
                {figure(Number(one.amount))}
              </span>
            )}
            <span className="shrink-0 text-xs whitespace-nowrap text-ink-muted">
              last {formatDate(one.lastAt.slice(0, 10))}
            </span>
            {!one.clientArchived && (
              <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-slate-400" />
            )}
          </>
        );
        const shell = "flex items-center gap-4 rounded-2xl border border-line bg-white px-5 py-3.5";
        return (
          <li key={one.customerId}>
            {one.clientArchived ? (
              <div className={cn(shell, archivedRow)}>{inside}</div>
            ) : (
              <Link
                to={`/trails/${trail}/${one.customerId}?name=${encodeURIComponent(one.clientName)}`}
                className={cn(
                  shell,
                  "transition-colors hover:border-ink/20 hover:bg-slate-50",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600",
                )}
              >
                {inside}
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}
