import { ApiError } from "@atomprive/api-client";
import {
  useListModelChangesForClient,
  useListClientMovePlans,
  useListProposals,
  type ModelChangeRow,
  type MovePlanRow,
  type ProposalPage,
} from "@atomprive/api-client/backoffice";
import { Alert, Badge } from "@atomprive/ui";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { formatDate } from "../../lib/labels";
import { figure } from "../portfolios/money-words";
import { TrailTabs } from "./trails-page";
import { trailOf, type TrailId } from "./trail-kinds";

/**
 * One client's history on one trail.
 *
 * <p>The middle of three screens: the trail says which clients, this says what happened to this one, and
 * a press on any line says what it was made of. Each is its own address, so the back button, a bookmark
 * and a link pasted into a message all work — which none of them do when a row expands in place.
 */
export function TrailClientPage() {
  const { trail: asked, customerId = "" } = useParams();
  const trail = trailOf(asked);
  const [params] = useSearchParams();
  const name = params.get("name");

  return (
    <div className="space-y-5">
      <header>
        <Link
          to={`/trails?trail=${trail.id}`}
          className="mb-1 inline-flex items-center gap-1.5 text-sm font-semibold text-primary-700 hover:underline"
        >
          <ChevronLeft aria-hidden="true" className="size-4" />
          All clients on this trail
        </Link>
        <h1 className="text-[1.625rem] font-bold">{name ?? "This client"}</h1>
        <p className="mt-1 max-w-[84ch] text-sm text-ink-muted">{trail.description}</p>
      </header>

      {/* The same four tabs, still on this client: moving between trails should not throw away who you
          were reading about. The trail is the path segment here, so that is what a tab changes. */}
      <TrailTabs
        current={trail.id}
        href={(id) => `/trails/${id}/${customerId}${name ? `?name=${encodeURIComponent(name)}` : ""}`}
      />

      {trail.id === "proposals" && <TheirProposals customerId={customerId} />}
      {(trail.id === "trades" || trail.id === "client-requests") && (
        <TheirMovePlans customerId={customerId} trail={trail.id} />
      )}
      {trail.id === "models" && <TheirModelChanges customerId={customerId} />}
    </div>
  );
}

function Empty({ what }: { what: string }) {
  return (
    <p className="rounded-2xl border border-dashed border-line px-5 py-10 text-center text-sm text-ink-muted">
      {what}
    </p>
  );
}

/** Every move plan of one kind, newest first. Legs come with the list, so nothing is asked for twice. */
function TheirMovePlans({ customerId, trail }: { customerId: string; trail: TrailId }) {
  const navigate = useNavigate();
  // The whole row is the press. A link in one cell is a target the width of a word on a row the width
  // of the screen, and everything else on it looks pressable and is not.
  const openOne = (id: string, who: string) =>
    navigate(`/trails/${trail}/${customerId}/${id}?name=${encodeURIComponent(who)}`);
  const plans = useListClientMovePlans<MovePlanRow[], ApiError>(customerId);
  if (plans.isPending) return <p className="text-sm text-ink-muted">Reading their history…</p>;
  if (plans.isError) return <Alert tone="danger">{plans.error.message}</Alert>;

  // The same table holds both: one the client asked for, and one the desk raised and somebody agreed to.
  const asked = trail === "client-requests";
  const rows = plans.data.filter((one) => one.onBehalfOfClient === asked);
  if (rows.length === 0) {
    return <Empty what={asked ? "This client has asked for nothing to be moved." : "The desk has raised nothing for this client."} />;
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-white">
      <table className="w-full">
        <thead>
          <tr className="border-b border-line bg-slate-50 text-2xs font-semibold tracking-wider text-ink-muted uppercase">
            <th className="px-4 py-2.5 text-left">Raised</th>
            <th className="px-4 py-2.5 text-left">By</th>
            <th className="px-4 py-2.5 text-left">Moves</th>
            <th className="px-4 py-2.5 text-right">Amount</th>
            {!asked && <th className="px-4 py-2.5 text-left">Answered by</th>}
            <th className="px-4 py-2.5 text-left">Standing</th>
            <th className="px-4 py-2.5" />
          </tr>
        </thead>
        <tbody>
          {rows.map((one) => (
            <tr
              key={one.id}
              onClick={() => openOne(one.id, one.clientName)}
              className="cursor-pointer border-b border-line last:border-0 hover:bg-slate-50/60"
            >
              <td className="px-4 py-2.5 text-sm font-semibold whitespace-nowrap">
                {formatDate(one.raisedAt.slice(0, 10))}
              </td>
              <td className="px-4 py-2.5 text-sm">{one.raisedByName}</td>
              <td className="px-4 py-2.5 text-sm tabular-nums">{one.legs.length}</td>
              <td className="px-4 py-2.5 text-right text-sm font-semibold tabular-nums">
                {one.currency} {figure(Number(one.amount))}
              </td>
              {!asked && (
                <td className="px-4 py-2.5 text-sm">
                  {one.decidedByName
                    ? `${one.decidedByName} · ${formatDate((one.decidedAt ?? "").slice(0, 10))}`
                    : "—"}
                </td>
              )}
              <td className="px-4 py-2.5">
                <Badge tone={one.status === "APPROVED" ? "success" : one.status === "REJECTED" ? "danger" : "neutral"}>
                  {one.statusSaid}
                </Badge>
              </td>
              <td className="px-4 py-2.5 text-right">
                <ChevronRight aria-hidden="true" className="ml-auto size-4 text-slate-400" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Every proposal written for this client. */
function TheirProposals({ customerId }: { customerId: string }) {
  const navigate = useNavigate();
  // The whole row is the press. A link in one cell is a target the width of a word on a row the width
  // of the screen, and everything else on it looks pressable and is not.
  const openOne = (id: string, who: string) =>
    navigate(`/trails/${"proposals"}/${customerId}/${id}?name=${encodeURIComponent(who)}`);
  const page = useListProposals<ProposalPage, ApiError>({ customerId, page: 0, size: 100 });
  if (page.isPending) return <p className="text-sm text-ink-muted">Reading their history…</p>;
  if (page.isError) return <Alert tone="danger">{page.error.message}</Alert>;
  if (page.data.items.length === 0) return <Empty what="The desk has written this client no proposals." />;

  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-white">
      <table className="w-full">
        <thead>
          <tr className="border-b border-line bg-slate-50 text-2xs font-semibold tracking-wider text-ink-muted uppercase">
            <th className="px-4 py-2.5 text-left">Reference</th>
            <th className="px-4 py-2.5 text-left">Written by</th>
            <th className="px-4 py-2.5 text-left">Sent</th>
            <th className="px-4 py-2.5 text-right">Value</th>
            <th className="px-4 py-2.5 text-left">Standing</th>
            <th className="px-4 py-2.5" />
          </tr>
        </thead>
        <tbody>
          {page.data.items.map((one) => (
            <tr
              key={one.id}
              onClick={() => openOne(one.id, one.customerName)}
              className="cursor-pointer border-b border-line last:border-0 hover:bg-slate-50/60"
            >
              <td className="px-4 py-2.5 text-sm font-semibold">{one.reference}</td>
              <td className="px-4 py-2.5 text-sm">{one.advisorName}</td>
              <td className="px-4 py-2.5 text-sm whitespace-nowrap">
                {one.sentAt ? formatDate(one.sentAt.slice(0, 10)) : "Not sent"}
              </td>
              <td className="px-4 py-2.5 text-right text-sm tabular-nums">
                {one.valueAmount == null ? "—" : `${one.valueCurrency ?? ""} ${figure(Number(one.valueAmount))}`}
              </td>
              <td className="px-4 py-2.5">
                <Badge tone={one.status === "APPROVED" ? "success" : one.status === "REJECTED" ? "danger" : "neutral"}>
                  {one.status.toLowerCase()}
                </Badge>
              </td>
              <td className="px-4 py-2.5 text-right">
                <ChevronRight aria-hidden="true" className="ml-auto size-4 text-slate-400" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Every time the firm was asked to move this client onto another plan. */
function TheirModelChanges({ customerId }: { customerId: string }) {
  const navigate = useNavigate();
  // The whole row is the press. A link in one cell is a target the width of a word on a row the width
  // of the screen, and everything else on it looks pressable and is not.
  const openOne = (id: string, who: string) =>
    navigate(`/trails/${"models"}/${customerId}/${id}?name=${encodeURIComponent(who)}`);
  const changes = useListModelChangesForClient<ModelChangeRow[], ApiError>(customerId);
  if (changes.isPending) return <p className="text-sm text-ink-muted">Reading their history…</p>;
  if (changes.isError) return <Alert tone="danger">{changes.error.message}</Alert>;
  if (changes.data.length === 0) return <Empty what="Nobody has asked for this client's plan to be changed." />;

  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-white">
      <table className="w-full">
        <thead>
          <tr className="border-b border-line bg-slate-50 text-2xs font-semibold tracking-wider text-ink-muted uppercase">
            <th className="px-4 py-2.5 text-left">Asked</th>
            <th className="px-4 py-2.5 text-left">By</th>
            <th className="px-4 py-2.5 text-left">From</th>
            <th className="px-4 py-2.5 text-left">To</th>
            <th className="px-4 py-2.5 text-left">Answered by</th>
            <th className="px-4 py-2.5 text-left">Standing</th>
            <th className="px-4 py-2.5" />
          </tr>
        </thead>
        <tbody>
          {changes.data.map((one) => (
            <tr
              key={one.id}
              onClick={() => openOne(one.id, one.clientName)}
              className="cursor-pointer border-b border-line last:border-0 hover:bg-slate-50/60"
            >
              <td className="px-4 py-2.5 text-sm font-semibold whitespace-nowrap">
                {formatDate(one.raisedAt.slice(0, 10))}
              </td>
              <td className="px-4 py-2.5 text-sm">{one.raisedByName}</td>
              <td className="px-4 py-2.5 text-sm">{one.fromModelName}</td>
              <td className="px-4 py-2.5 text-sm font-semibold">{one.toModelName}</td>
              <td className="px-4 py-2.5 text-sm">
                {one.decidedByName
                  ? `${one.decidedByName} · ${formatDate((one.decidedAt ?? "").slice(0, 10))}`
                  : "—"}
              </td>
              <td className="px-4 py-2.5">
                <Badge tone={one.status === "APPROVED" ? "success" : one.status === "REJECTED" ? "danger" : "neutral"}>
                  {one.statusLabel}
                </Badge>
              </td>
              <td className="px-4 py-2.5 text-right">
                <ChevronRight aria-hidden="true" className="ml-auto size-4 text-slate-400" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
