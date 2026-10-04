import { ApiError } from "@atomprive/api-client";
import {
  useListDrift,
  useListModelPortfolios,
  useListProposals,
  useListReviewsDue,
  type DriftPage,
  type DriftRow,
  type ModelsPage,
  type ProposalPage,
  type ReviewsDue,
} from "@atomprive/api-client/backoffice";
import { Alert, Avatar, Badge, cn } from "@atomprive/ui";
import { useState } from "react";
import { Link } from "react-router";
import { useStaffUser } from "../../auth/session";
import { ClientPortfolioDialog } from "./client-portfolio-dialog";
import {
  averageDriftLabel,
  driftLabel,
  standingLabels,
  standingTones,
  underManagementLabel,
  type DriftStanding,
} from "./portfolio-labels";

/** Everything off plan: within band is not work, and nothing written down is not an answer. */
const WANDERED: DriftStanding[] = ["BREACHED", "AT_EDGE", "WATCH"];

/** Enough of the queue to see the shape of the day without turning the dashboard into the queue itself. */
const NEEDS_ME = 5;

/**
 * Where the portfolio manager's day starts: how much is under the firm's models, what has wandered off them,
 * and what has gone out to clients. Each figure is counted from the screen it links to, so the dashboard
 * never says something that screen would contradict.
 */
export function PortfolioManagerDashboard() {
  const user = useStaffUser();
  const models = useListModelPortfolios<ModelsPage, ApiError>();
  // Worst first, as the queue itself orders them; totalItems counts the whole queue, not this page of it.
  const queue = useListDrift<DriftPage, ApiError>({ standing: WANDERED, page: 0, size: NEEDS_ME });
  // One row, asked for only to read the counts off it.
  const proposals = useListProposals<ProposalPage, ApiError>({ size: 1 });
  // One row for the same reason: the tile wants the total, not the list.
  const reviews = useListReviewsDue<ReviewsDue, ApiError>({ size: 1 });

  const [opening, setOpening] = useState<DriftRow | null>(null);

  const rows = models.data?.items ?? [];
  const onModels = rows.filter((model) => model.clients > 0);
  // Every model's total is already in the firm's reporting currency, so these add up to something real.
  const underManagement = rows.reduce((total, model) => total + model.aumTracked, 0);
  const reportingCurrency = rows[0]?.aumCurrency ?? "USD";
  const unconverted = rows.reduce((total, model) => total + model.aumUnconverted, 0);
  const clients = rows.reduce((total, model) => total + model.clients, 0);
  const counts = proposals.data?.counts;
  const first = user.fullName.split(" ")[0];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-[1.625rem] font-bold">Good to see you, {first}</h1>
        <p className="mt-1 text-sm text-ink-muted">
          How much is on the firm's models, what has wandered off them, and what has gone out to clients.
        </p>
      </header>

      {models.isError && <Alert tone="danger">{models.error.message}</Alert>}

      {/* A figure that could not be converted is left out, not added in at face value. The tile says so
          rather than quietly being short by a client. */}
      {unconverted > 0 && (
        <Alert tone="warning">
          {unconverted === 1
            ? "One client is held in a currency with no rate on file, so they are not in the figure above."
            : `${unconverted} clients are held in a currency with no rate on file, so they are not in the figure above.`}{" "}
          Ask an Admin to put the rate on file and they will be counted.
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Tile
          label="Under the firm's models"
          value={models.data ? underManagementLabel(underManagement, reportingCurrency) : undefined}
          failed={models.isError}
          to="/model-portfolios"
        />
        <Tile
          label="Clients on a model"
          value={models.data ? String(clients) : undefined}
          failed={models.isError}
          to="/portfolio-clients"
        />
        <Tile
          label="Off plan"
          value={queue.data ? String(queue.data.totalItems) : undefined}
          failed={queue.isError}
          to="/drift"
          urgent={(queue.data?.totalItems ?? 0) > 0}
        />
        <Tile
          label="Breached"
          value={queue.data ? String(queue.data.breached) : undefined}
          failed={queue.isError}
          to="/drift"
          urgent={(queue.data?.breached ?? 0) > 0}
        />
        {/* The deck's amber: a client nobody has looked at in the firm's own cadence. */}
        <Tile
          label="Due a review"
          value={reviews.data ? String(reviews.data.total) : undefined}
          failed={reviews.isError}
          to="/portfolio-clients"
          urgent={(reviews.data?.total ?? 0) > 0}
        />
      </div>

      <section aria-labelledby="needs-me-title" className="rounded-2xl border border-line bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-6 py-5">
          <div>
            <h2 id="needs-me-title" className="text-base font-bold">
              Needs me today
            </h2>
            <p className="mt-0.5 text-xs text-ink-muted">
              The worst of the queue. One client is one row, whichever asset class carried it here.
            </p>
          </div>
          <Link
            to="/drift"
            className="shrink-0 text-sm font-semibold whitespace-nowrap text-primary-600 hover:text-primary-700"
          >
            Drift &amp; breaches
          </Link>
        </div>

        {queue.isError ? (
          <p className="px-6 py-10 text-center text-sm text-ink-muted">The queue couldn't be read.</p>
        ) : queue.isPending ? (
          <p className="px-6 py-10 text-center text-sm text-ink-muted">Reading the queue…</p>
        ) : queue.data.items.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-ink-muted">
            Nothing is off plan. Clients appear here as their portfolios wander from the model they are measured
            against.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                  <th scope="col" className="py-3 pr-4 pl-6">Client</th>
                  <th scope="col" className="px-4 py-3">Model</th>
                  <th scope="col" className="px-4 py-3 text-right">Value</th>
                  <th scope="col" className="px-4 py-3 text-right">Worst drift</th>
                  <th scope="col" className="px-4 py-3">Standing</th>
                  <th scope="col" className="py-3 pr-6 pl-4">
                    <span className="sr-only">Open</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {queue.data.items.map((row) => (
                  <tr key={row.customerId} className="hover:bg-slate-50/60">
                    <td className="py-3 pr-4 pl-6">
                      <div className="flex items-center gap-3">
                        <Avatar name={row.clientName} />
                        <div className="min-w-0">
                          <span className="block truncate font-semibold">{row.clientName}</span>
                          <span className="block truncate text-xs text-ink-muted">{row.clientCode}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-ink-soft">{row.modelName}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums">
                      {underManagementLabel(row.underManagement, row.currency)}
                    </td>
                    <td
                      className={cn(
                        "px-4 py-3 text-right font-semibold whitespace-nowrap tabular-nums",
                        row.standing === "BREACHED" ? "text-rose-700" : "text-ink",
                      )}
                    >
                      {driftLabel(row.drift)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={standingTones[row.standing]}>{standingLabels[row.standing]}</Badge>
                    </td>
                    <td className="py-3 pr-6 pl-4 text-right">
                      <button
                        type="button"
                        onClick={() => setOpening(row)}
                        className="text-sm font-medium text-primary-700 hover:underline"
                      >
                        Open
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <section aria-labelledby="models-title" className="rounded-2xl border border-line bg-white lg:col-span-2">
          <div className="flex items-center justify-between gap-4 border-b border-line px-6 py-5">
            <div className="min-w-0">
              <h2 id="models-title" className="text-base font-bold">
                Models at a glance
              </h2>
              <p className="mt-0.5 text-xs text-ink-muted">
                Only the models somebody is measured against. Average drift ignores which side of the target a
                client sits on.
              </p>
            </div>
            <Link
              to="/model-portfolios"
              className="shrink-0 text-sm font-semibold whitespace-nowrap text-primary-600 hover:text-primary-700"
            >
              Model portfolios
            </Link>
          </div>

          {models.isPending ? (
            <p className="px-6 py-10 text-center text-sm text-ink-muted">Reading the models…</p>
          ) : onModels.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-ink-muted">
              No client is measured against a model yet.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {onModels.map((model) => (
                <li key={model.id} className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 px-6 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{model.name}</p>
                    <p className="text-xs text-ink-muted">
                      {model.clients} {model.clients === 1 ? "client" : "clients"} · {model.riskProfile}
                    </p>
                  </div>
                  <div className="flex items-baseline gap-6 text-sm whitespace-nowrap tabular-nums">
                    <span className="font-semibold">
                      {underManagementLabel(model.aumTracked, model.aumCurrency)}
                    </span>
                    <span className="text-ink-muted">
                      {model.averageDrift === null ? "—" : `${averageDriftLabel(model.averageDrift)} average drift`}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="sent-title" className="rounded-2xl border border-line bg-white">
          <div className="flex items-center justify-between border-b border-line px-6 py-5">
            <h2 id="sent-title" className="text-base font-bold">
              What I sent
            </h2>
            <Link
              to="/proposals"
              className="shrink-0 text-sm font-semibold whitespace-nowrap text-primary-600 hover:text-primary-700"
            >
              Proposals
            </Link>
          </div>
          <dl className="divide-y divide-line">
            <Sent label="Awaiting a client's answer" value={counts?.awaitingClient} failed={proposals.isError} />
            <Sent label="Accepted in the last week" value={counts?.approvedLately} failed={proposals.isError} />
            {/* Not a failure to hide: no answer in the window and it lapses on its own. */}
            <Sent label="Expired without an answer" value={counts?.expired} failed={proposals.isError} />
          </dl>
        </section>
      </div>

      {opening && (
        <ClientPortfolioDialog
          customerId={opening.customerId}
          clientName={opening.clientName}
          onClose={() => setOpening(null)}
          onSaved={() => void queue.refetch()}
        />
      )}
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
  value: string | undefined;
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

function Sent({ label, value, failed }: { label: string; value: number | undefined; failed: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 px-6 py-3">
      <dt className="text-sm text-ink-soft">{label}</dt>
      <dd className="text-lg font-bold tabular-nums">
        {failed ? (
          <span className="text-sm font-normal text-ink-muted">—</span>
        ) : value === undefined ? (
          <span className="text-sm font-normal text-ink-muted">…</span>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}
