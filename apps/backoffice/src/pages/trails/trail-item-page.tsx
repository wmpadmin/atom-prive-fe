import { ApiError } from "@atomprive/api-client";
import {
  useGetProposal,
  useListClientMovePlans,
  useListModelChangesForClient,
  type ModelChangeRow,
  type MovePlanRow,
  type PlannedLeg,
  type ProposalDetail,
} from "@atomprive/api-client/backoffice";
import { Alert, Badge } from "@atomprive/ui";
import { ChevronLeft } from "lucide-react";
import { Link, useParams, useSearchParams } from "react-router";
import { formatDateTime } from "../../lib/labels";
import { figure, named } from "../portfolios/money-words";
import { trailOf } from "./trail-kinds";

/**
 * One thing out of a client's history, in full.
 *
 * <p>The last of three screens, and the one the other two exist to reach. A trail that stops at "money
 * was moved" answers nothing anybody asks — the questions are how much, out of what, into what, on what
 * day, and on whose say-so. Four trails land here and each answers those in its own words.
 */
export function TrailItemPage() {
  const { trail: asked, customerId = "", itemId = "" } = useParams();
  const trail = trailOf(asked);
  const [params] = useSearchParams();
  const name = params.get("name");
  const back = `/trails/${trail.id}/${customerId}${name ? `?name=${encodeURIComponent(name)}` : ""}`;

  return (
    <div className="space-y-5">
      <Link to={back} className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary-700 hover:underline">
        <ChevronLeft aria-hidden="true" className="size-4" />
        {name ?? "Back"} · {trail.label}
      </Link>

      {(trail.id === "trades" || trail.id === "client-requests") && (
        <OneMovePlan customerId={customerId} itemId={itemId} />
      )}
      {trail.id === "proposals" && <OneProposal itemId={itemId} />}
      {trail.id === "models" && <OneModelChange customerId={customerId} itemId={itemId} />}
    </div>
  );
}

function Fact({ label, value, under }: { label: string; value: string; under?: string }) {
  return (
    <div>
      <dt className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-ink">{value}</dd>
      {under && <dd className="text-xs text-ink-muted">{under}</dd>}
    </div>
  );
}

function Said({ label, what }: { label: string; what: string }) {
  return (
    <div className="mt-4 border-t border-line pt-4">
      <p className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">{label}</p>
      <p className="mt-1 max-w-[90ch] text-sm text-ink-soft">{what}</p>
    </div>
  );
}

function tone(status: string) {
  return status === "APPROVED" ? "success" : status === "REJECTED" ? "danger" : "neutral";
}

/** Where the money went, leg by leg. The same table for a move plan and for a proposal's own weighing. */
function Legs({ legs, currency }: { legs: PlannedLeg[]; currency: string }) {
  if (legs.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-line px-5 py-8 text-center text-sm text-ink-muted">
        Nothing was weighed out of one holding into another.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-white">
      <table className="w-full">
        <thead>
          <tr className="border-b border-line bg-slate-50 text-2xs font-semibold tracking-wider text-ink-muted uppercase">
            <th className="px-4 py-2.5 text-left">#</th>
            <th className="px-4 py-2.5 text-left">Out of</th>
            <th className="px-4 py-2.5 text-left">Into</th>
            <th className="px-4 py-2.5 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {legs.map((leg, at) => (
            <tr key={at} className="border-b border-line last:border-0">
              <td className="px-4 py-2.5 text-sm text-ink-muted tabular-nums">{at + 1}</td>
              <td className="px-4 py-2.5 text-sm font-semibold">
                {named(leg.fromSubSubClass ?? leg.fromSubClass ?? null, leg.fromAssetClass)}
              </td>
              <td className="px-4 py-2.5 text-sm font-semibold">
                {named(leg.toSubSubClass ?? leg.toSubClass ?? null, leg.toAssetClass)}
              </td>
              <td className="px-4 py-2.5 text-right text-sm font-semibold tabular-nums">
                {currency} {figure(Number(leg.amount))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * One money move.
 *
 * <p>Read from the client's own history rather than from a plan-by-id call, because there is no such
 * call: a plan is only ever returned in a list or as the answer to a write. The list is a handful of
 * rows for one client and carries its legs, so one read serves both this screen and the one before it.
 */
function OneMovePlan({ customerId, itemId }: { customerId: string; itemId: string }) {
  const plans = useListClientMovePlans<MovePlanRow[], ApiError>(customerId);
  if (plans.isPending) return <p className="text-sm text-ink-muted">Reading it…</p>;
  if (plans.isError) return <Alert tone="danger">{plans.error.message}</Alert>;

  const plan = plans.data.find((one) => one.id === itemId);
  if (!plan) return <Alert tone="danger">That move is not on this client's history.</Alert>;
  const asking = plan.onBehalfOfClient;

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-[1.625rem] font-bold">
          {asking ? "Money moved as the client asked" : "Bulk rebalance"}
        </h1>
        <Badge tone={tone(plan.status)}>{plan.statusSaid}</Badge>
      </div>

      <section className="rounded-2xl border border-line bg-white px-5 py-5">
        <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <Fact label="Raised by" value={plan.raisedByName} under={formatDateTime(plan.raisedAt)} />
          {/* A client's own asking has nobody else on it: whoever wrote it down carried it out, which is
              the whole of why that trail is kept apart from this one. */}
          <Fact
            label={asking ? "Carried out by" : "Agreed by"}
            value={asking ? plan.raisedByName : (plan.decidedByName ?? "Nobody yet")}
            under={plan.decidedAt ? formatDateTime(plan.decidedAt) : "—"}
          />
          <Fact label="Moves" value={String(plan.legs.length)} under={plan.legs.length === 1 ? "one leg" : "legs"} />
          <Fact
            label="Moved in all"
            value={`${plan.currency} ${figure(Number(plan.amount))}`}
            under={plan.underManagement == null ? "—" : `of ${figure(Number(plan.underManagement))} held`}
          />
        </dl>
        <Said label="Why it was raised" what={plan.why} />
        {plan.decisionNote && <Said label="What the answer said" what={plan.decisionNote} />}
      </section>

      <Legs legs={plan.legs} currency={plan.currency} />
    </>
  );
}

/** One proposal: what was advised, what became of it, and what it weighed out of what. */
function OneProposal({ itemId }: { itemId: string }) {
  const detail = useGetProposal<ProposalDetail, ApiError>(itemId);
  if (detail.isPending) return <p className="text-sm text-ink-muted">Reading it…</p>;
  if (detail.isError) return <Alert tone="danger">{detail.error.message}</Alert>;

  const { summary, body, objective, weighed, portfolioCurrency } = detail.data;
  const currency = summary.valueCurrency ?? portfolioCurrency ?? "";

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-[1.625rem] font-bold">{summary.reference}</h1>
        <Badge tone={tone(summary.status)}>{summary.status.toLowerCase()}</Badge>
      </div>
      <p className="-mt-2 text-sm text-ink-muted">{summary.title}</p>

      <section className="rounded-2xl border border-line bg-white px-5 py-5">
        <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <Fact label="Written by" value={summary.advisorName} under={formatDateTime(summary.createdAt)} />
          <Fact
            label="Sent"
            value={summary.sentAt ? formatDateTime(summary.sentAt) : "Not sent"}
            under={summary.sentAt ? "to the client's relationship manager" : undefined}
          />
          <Fact
            label="Answered by"
            value={summary.answeredByName ?? "Nobody yet"}
            under={summary.decidedAt ? formatDateTime(summary.decidedAt) : "—"}
          />
          <Fact
            label="Value"
            value={summary.valueAmount == null ? "—" : `${currency} ${figure(Number(summary.valueAmount))}`}
          />
        </dl>
        {objective && <Said label="What it set out to do" what={objective} />}
        {body && <Said label="What it said" what={body} />}
        {summary.answerNote && <Said label="What the answer said" what={summary.answerNote} />}
      </section>

      <Legs legs={weighed} currency={currency} />
    </>
  );
}

/**
 * One ask to move a client onto another plan.
 *
 * <p>Nothing is weighed out of anything here — a plan change moves no figure on its own, it changes what
 * the client's figures are judged against. So this says which plan to which, and on whose word.
 */
function OneModelChange({ customerId, itemId }: { customerId: string; itemId: string }) {
  const changes = useListModelChangesForClient<ModelChangeRow[], ApiError>(customerId);
  if (changes.isPending) return <p className="text-sm text-ink-muted">Reading it…</p>;
  if (changes.isError) return <Alert tone="danger">{changes.error.message}</Alert>;

  const change = changes.data.find((one) => one.id === itemId);
  if (!change) return <Alert tone="danger">That plan change is not on this client's history.</Alert>;

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-[1.625rem] font-bold">
          {change.fromModelName} → {change.toModelName}
        </h1>
        <Badge tone={tone(change.status)}>{change.statusLabel}</Badge>
      </div>

      <section className="rounded-2xl border border-line bg-white px-5 py-5">
        <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <Fact label="Asked by" value={change.raisedByName} under={formatDateTime(change.raisedAt)} />
          <Fact
            label="Answered by"
            value={change.decidedByName ?? "Nobody yet"}
            under={change.decidedAt ? formatDateTime(change.decidedAt) : "—"}
          />
          <Fact label="Off" value={change.fromModelName} />
          <Fact label="Onto" value={change.toModelName} />
        </dl>
        <Said label="Why it was asked" what={change.why} />
        {change.decisionNote && <Said label="What the answer said" what={change.decisionNote} />}
      </section>
    </>
  );
}
