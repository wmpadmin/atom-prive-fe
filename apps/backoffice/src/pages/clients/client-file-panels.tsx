import { ApiError } from "@atomprive/api-client";
import {
  useListProposals,
  type ClientEvent,
  type CustomerDetail,
  type FamilyMember,
  type ProposalPage,
  type ProposalRow,
} from "@atomprive/api-client/backoffice";
import { Alert, Avatar, Badge, Button, cn } from "@atomprive/ui";
import { keepPreviousData } from "@tanstack/react-query";
import { FileSignature, ReceiptText, ScrollText, UserRoundPlus, Wallet } from "lucide-react";
import type { ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { useStaffUser } from "../../auth/session";
import { ColumnPicker } from "../../components/column-picker";
import { ViewTabs } from "../../components/view-tabs";
import { useColumnDrag } from "../../lib/column-drag";
import { formatDateTime } from "../../lib/labels";
import { hasAnyAuthority, ONBOARDS_CLIENTS_CHANGE } from "../../lib/permissions";
import { useTableView } from "../../lib/table-view";
import { ClientHoldingsPanel } from "../portfolios/client-holdings-panel";
import { proposalStatusLabels, proposalStatusTones } from "../advisor/proposal-labels";
import { clientsHref, kycStatusLabels, kycStatusTones } from "./client-labels";

/**
 * What each still-to-come section is waiting for, said plainly rather than left blank.
 *
 * @param actions what can be done about it, where anything can. A section with nothing in it yet is often
 * exactly where somebody wants to put the first thing.
 */
export function WaitingPanel({ icon, title, children, actions }: { icon: ReactNode; title: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="grid place-items-center rounded-2xl border border-dashed border-line bg-white px-6 py-14 text-center">
      <span className="grid size-11 place-items-center rounded-xl bg-primary-50 text-primary-600 [&_svg]:size-5" aria-hidden="true">
        {icon}
      </span>
      <p className="mt-3 font-semibold">{title}</p>
      <p className="mt-1 max-w-md text-sm text-ink-muted">{children}</p>
      {actions && <div className="mt-4">{actions}</div>}
    </section>
  );
}

/**
 * What the client holds, as the firm has written it down.
 *
 * <p>This tab used to say the holdings were waiting on bank data. They are not: the portfolio screens record
 * them, so a client could have a portfolio here and an empty tab there. What is still waiting on the feeds
 * is the positions arriving by themselves rather than being typed, which the note below says — and writing
 * them down is the portfolio screen's job, so here they are only read.
 */
export function HoldingsPanel({ clientId }: { clientId: string }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Link to={`/portfolio-clients/${clientId}`}>
          <Button variant="secondary" size="sm">
            <Wallet aria-hidden="true" />
            Open the portfolio
          </Button>
        </Link>
      </div>
      <ClientHoldingsPanel customerId={clientId} readOnly />
      <p className="text-xs text-ink-muted">
        Written down by the portfolio team. Positions pulled from the banks themselves arrive here once the
        feeds are connected.
      </p>
    </div>
  );
}

export function TransactionsPanel() {
  return (
    <WaitingPanel icon={<ReceiptText />} title="No transactions yet">
      Transaction history comes from the banks, alongside holdings.
    </WaitingPanel>
  );
}

/**
 * The columns of the proposals table a reader may move and take off, in the order the firm wrote them.
 *
 * <p>The proposal itself is not among them. It is both what names the row and the way through to it, and a
 * line carrying only a reference and a date would be the record of something nobody could open.
 */
const MOVABLE: {
  id: string;
  label: string;
  nowrap?: boolean;
  tone?: string;
  cell: (proposal: ProposalRow) => ReactNode;
}[] = [
  {
    id: "reference",
    label: "Reference",
    nowrap: true,
    tone: "font-mono text-xs text-ink-soft",
    cell: (proposal) => proposal.reference,
  },
  {
    id: "status",
    label: "Status",
    cell: (proposal) => (
      <Badge tone={proposalStatusTones[proposal.status]}>{proposalStatusLabels[proposal.status]}</Badge>
    ),
  },
  {
    id: "sent",
    label: "Sent",
    nowrap: true,
    tone: "text-ink-soft",
    cell: (proposal) => (proposal.sentAt ? formatDateTime(proposal.sentAt) : "Not sent"),
  },
  {
    id: "answeredBy",
    label: "Answered by",
    nowrap: true,
    tone: "text-ink-soft",
    cell: (proposal) => proposal.answeredByName ?? "—",
  },
];

/** Every proposal written for this client, newest first: what was sent, where it got to, and who answered. */
export function ProposalsPanel({ clientId }: { clientId: string }) {
  const proposals = useListProposals<ProposalPage, ApiError>(
    { customerId: clientId, size: 50 },
    { query: { placeholderData: keepPreviousData } },
  );
  // Read above both ways out of this panel. How somebody has arranged the table is a thing about them
  // rather than about what came back, and a hook React sees on one render and not the next is a hook it
  // cannot keep in order.
  const view = useTableView("client-proposals", MOVABLE.map((one) => one.id));
  const drag = useColumnDrag(view);
  const rows = proposals.data?.items ?? [];
  const byId = new Map(MOVABLE.map((one) => [one.id, one]));
  const shownColumns = view.shown.map((id) => byId.get(id)).filter((one) => one !== undefined);

  if (proposals.isError) {
    return <Alert tone="danger">{proposals.error.message}</Alert>;
  }
  if (proposals.data && rows.length === 0) {
    return (
      <WaitingPanel icon={<FileSignature />} title="No proposals yet">
        Proposals written for this client appear here, with what was sent and where each one got to.
      </WaitingPanel>
    );
  }
  return (
    <section className="rounded-2xl border border-line bg-white">
      {/* On the card's own line above the table, the way the bank accounts panel beside it carries its
          own. The tab already names this list, so the line holds the arrangement and nothing else. */}
      <div className="flex flex-wrap items-end justify-end gap-3 border-b border-line px-5 py-3">
        <ViewTabs
          views={view.views}
          current={view.current}
          edited={view.current === null ? view.arranged : view.changed}
          onPick={(name) => (name === null ? view.reset() : view.apply(name))}
          onSave={view.saveAs}
          onDelete={view.remove}
          firstLabel="Every proposal"
        />
        <ColumnPicker
          columns={MOVABLE.map((one) => ({ id: one.id, label: one.label }))}
          shown={new Set(view.shown)}
          order={view.order}
          arranged={view.arranged}
          onChange={(next) => {
            for (const one of MOVABLE) {
              if (next.has(one.id) === view.hidden.includes(one.id)) view.toggle(one.id);
            }
          }}
          onMove={view.move}
          onReset={view.reset}
        />
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
              <th scope="col" className="py-3 pr-4 pl-5">Proposal</th>
              {shownColumns.map((column, at) => (
                <th
                  key={column.id}
                  scope="col"
                  {...drag.headingProps(column.id)}
                  className={cn(
                    "cursor-grab touch-none px-4 py-3 select-none",
                    column.nowrap && "whitespace-nowrap",
                    at === shownColumns.length - 1 && "pr-5",
                    drag.dragging === column.id && "cursor-grabbing opacity-40",
                    drag.over === column.id && "bg-primary-50",
                  )}
                  title={`Drag to move ${column.label}`}
                >
                  {column.label}
                  <span className="sr-only">
                    , column {at + 1} of {shownColumns.length}. Use the Columns button to move or hide it.
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {!proposals.data && (
              <tr>
                <td colSpan={shownColumns.length + 1} className="px-5 py-8 text-center text-ink-muted">
                  Loading proposals…
                </td>
              </tr>
            )}
            {rows.map((proposal) => (
              <tr key={proposal.id}>
                <td className="py-3 pr-4 pl-5">
                  <Link to={`/proposals/${proposal.id}?from=client`} className="font-semibold hover:text-primary-600">
                    {proposal.title}
                  </Link>
                  {proposal.summary && <p className="truncate text-xs text-ink-muted">{proposal.summary}</p>}
                </td>
                {/* The cells in the order the headings are in, out of the one list that holds both. */}
                {shownColumns.map((column, at) => (
                  <td
                    key={column.id}
                    className={cn(
                      "px-4 py-3",
                      column.nowrap && "whitespace-nowrap",
                      column.tone,
                      at === shownColumns.length - 1 && "pr-5",
                    )}
                  >
                    {column.cell(proposal)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** Everyone onboarded on the same application, this client included. */
export function FamilyPanel({ client, family }: { client: CustomerDetail["client"]; family: FamilyMember[] }) {
  const navigate = useNavigate();
  const user = useStaffUser();
  const location = useLocation();
  const backTo = clientsHref(location.state);
  // A client is read under whichever list they were reached from: a relationship manager has My clients
  // and no sight of every client, so sending them to the whole book's address would only turn them round
  // at the door.
  const mine = location.pathname.startsWith("/my-clients");
  // A client who came in alone is exactly the one who gains a spouse later, so the way to add somebody is
  // offered whether or not there is a group yet.
  const mayAdd = hasAnyAuthority(user, ...ONBOARDS_CLIENTS_CHANGE) && client.type === "INDIVIDUAL";
  const addThem = mayAdd ? (
    <Button variant="secondary" size="sm" onClick={() => void navigate(`/clients/${client.id}/account-holders/new`)}>
      <UserRoundPlus aria-hidden="true" />
      Add an account holder
    </Button>
  ) : null;
  if (family.length === 0) {
    return (
      <WaitingPanel icon={<Wallet />} title="Onboarded on their own" actions={addThem}>
        This client came in on their own application, so there is no family group. Anyone who joins the account —
        a spouse, a child coming of age — appears here and shares the same forms.
      </WaitingPanel>
    );
  }
  return (
    <section aria-labelledby="family-title" className="rounded-2xl border border-line bg-white">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-6 py-5">
        <div>
          <h2 id="family-title" className="text-base font-bold">
            Family group
          </h2>
          <p className="mt-0.5 text-xs text-ink-muted">Everyone holding this account, on the same application.</p>
        </div>
        {addThem}
      </div>
      <ul className="divide-y divide-line">
        {family.map((member) => {
          const theirs = member.id !== client.id;
          return (
          // The whole line opens them, not the name alone: everybody on an application is a client in their
          // own right, with the same file behind them, and a row that only answers to its first few words
          // reads as a list of names rather than a way through to them.
          <li
            key={member.id}
            onClick={theirs ? () => void navigate(`${mine ? "/my-clients" : "/clients"}/${member.id}`, { state: { from: backTo } }) : undefined}
            className={cn(
              "flex flex-wrap items-center justify-between gap-3 px-6 py-4",
              theirs && "cursor-pointer hover:bg-slate-50/60",
            )}
          >
            <div className="flex min-w-0 items-center gap-3">
              <Avatar name={member.fullName} />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">
                  {theirs ? (
                    <Link
                      to={`${mine ? "/my-clients" : "/clients"}/${member.id}`}
                      state={{ from: backTo }}
                      className="hover:text-primary-700"
                    >
                      {member.fullName}
                    </Link>
                  ) : (
                    <>
                      {member.fullName} <span className="text-xs font-normal text-ink-muted">· this client</span>
                    </>
                  )}
                </p>
                <p className="truncate text-xs text-ink-muted">
                  {member.code}
                  {member.email && ` · ${member.email}`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {member.relationship && <Badge>{relationshipLabels[member.relationship] ?? member.relationship}</Badge>}
              <Badge tone={kycStatusTones[member.kycStatus]}>{kycStatusLabels[member.kycStatus]}</Badge>
            </div>
          </li>
          );
        })}
      </ul>
    </section>
  );
}

const relationshipLabels: Record<string, string> = {
  SPOUSE: "Spouse",
  CHILD: "Child",
  PARENT: "Parent",
  SIBLING: "Sibling",
  OTHER: "Other relative",
};

/** Everything that has happened to this client, newest first, from the same trail the Audit log reads. */
export function ActivityPanel({ activity }: { activity: ClientEvent[] }) {
  if (activity.length === 0) {
    return (
      <WaitingPanel icon={<ScrollText />} title="Nothing recorded yet">
        Registration, relationship manager changes and every time someone opens this file are recorded here.
      </WaitingPanel>
    );
  }
  return (
    <section aria-labelledby="activity-title" className="rounded-2xl border border-line bg-white">
      <div className="border-b border-line px-6 py-5">
        <h2 id="activity-title" className="text-base font-bold">
          Activity
        </h2>
        <p className="mt-0.5 text-xs text-ink-muted">
          From the audit trail, which cannot be changed. The Audit log screen has the full history.
        </p>
      </div>
      <ol className="divide-y divide-line">
        {activity.map((event, index) => (
          <li key={`${event.occurredAt}-${index}`} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-6 py-3">
            <p className="text-sm font-medium">
              {event.description}
              {event.byWhom && <span className="font-normal text-ink-muted"> · {event.byWhom}</span>}
              {event.theirRole && <span className="font-normal text-ink-muted"> ({roleLabel(event.theirRole)})</span>}
              {/* Done for the client rather than to them, which is most of what the back office does here. */}
              {event.onBehalfOf && (
                <span className="font-normal text-ink-muted"> on behalf of {event.onBehalfOf}</span>
              )}
            </p>
            <p className="text-xs whitespace-nowrap text-ink-muted tabular-nums">{formatDateTime(event.occurredAt)}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function roleLabel(code: string) {
  return code.charAt(0) + code.slice(1).toLowerCase().replaceAll("_", " ");
}
