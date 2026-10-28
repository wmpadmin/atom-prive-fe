import { ApiError } from "@atomprive/api-client";
import {
  useCancelFamilyInvitation,
  useGetClientPortfolio,
  useInviteFamilyMember,
  useListProposals,
  useRemoveFamilyMember,
  useRenameFamily,
  useResendFamilyInvitation,
  type ClientEvent,
  type CustomerDetail,
  type FamilyGroupSummary,
  type FamilyInvitationRow,
  type FamilyMember,
  type PortfolioStanding,
  type ProposalPage,
  type ProposalRow,
} from "@atomprive/api-client/backoffice";
import { Alert, Avatar, Badge, Button, Dialog, Field, SelectInput, TextArea, TextInput, cn } from "@atomprive/ui";
import { keepPreviousData, useQueryClient } from "@tanstack/react-query";
import { FileSignature, Landmark, LayoutGrid, PencilLine, ReceiptText, Rows3, ScrollText, UsersRound, Wallet } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { useStaffUser } from "../../auth/session";
import { ColumnPicker } from "../../components/column-picker";
import { ViewTabs } from "../../components/view-tabs";
import { useColumnDrag } from "../../lib/column-drag";
import { formatDate, formatDateTime } from "../../lib/labels";
import { hasAnyAuthority, ONBOARDS_CLIENTS_CHANGE } from "../../lib/permissions";
import { useRelationshipTypes } from "../../lib/relationship-types";
import { useTableView } from "../../lib/table-view";
import { ClassStandingTable } from "../portfolios/class-standing-table";
import { FamilyChart } from "./family-overview";
import { downTheTree, treeOf, whoCanBeInvitedUnder } from "./family-tree";
import { TemporaryPassword } from "./temporary-password";
import { proposalStatusLabels, proposalStatusTones } from "../advisor/proposal-labels";
import { clientsHref, kycStatusLabels, kycStatusTones } from "./client-labels";

/**
 * What each still-to-come section is waiting for, said plainly rather than left blank.
 *
 * @param actions what can be done about it, where anything can. A section with nothing in it yet is often
 * exactly where somebody wants to put the first thing.
 */
export function WaitingPanel({ icon, title, children, actions }: { icon: ReactNode; title: string; children?: ReactNode; actions?: ReactNode }) {
  return (
    <section className="grid place-items-center rounded-2xl border border-dashed border-line bg-white px-6 py-14 text-center">
      <span className="grid size-11 place-items-center rounded-xl bg-primary-50 text-primary-600 [&_svg]:size-5" aria-hidden="true">
        {icon}
      </span>
      <p className="mt-3 font-semibold">{title}</p>
      {children && <p className="mt-1 max-w-md text-sm text-ink-muted">{children}</p>}
      {actions && <div className="mt-4">{actions}</div>}
    </section>
  );
}

/**
 * Holdings, which the firm does not have yet.
 *
 * <p>This tab drew the allocation against the client's model — the asset classes, their sub-assets, each
 * one's target and what it would take to put it back. That is the portfolio, and it is not what a holding
 * is. A holding is a thing the client owns: a name, an identifier, an issuer, what it is worth. The firm
 * has none written down. What it has is money placed against buckets, typed into the Net AUM calculator by
 * the portfolio team, and the deepest row of it carries the name of the bucket it sits in.
 *
 * <p>Said in the same words the portfolio screen's own Holdings tab has always said them in, because the
 * two are the same empty thing and were describing it differently.
 */
export function HoldingsPanel({ onSeeThePortfolio }: { onSeeThePortfolio: () => void }) {
  return (
    <WaitingPanel
      icon={<Landmark />}
      title="Holdings is not built yet"
      actions={
        <Button variant="secondary" size="sm" onClick={onSeeThePortfolio}>
          See the portfolio
        </Button>
      }
    >
      The firm&apos;s own list of what this client holds, instrument by instrument — a name, an identifier,
      an issuer and what each line is worth — goes here once the custodian feeds are connected. Until then,
      what they hold by asset class is on the Overview, under Portfolio.
    </WaitingPanel>
  );
}

/**
 * Where a client's portfolio stands against the plan it is measured on, class by class.
 *
 * <p>The overview carried the portfolio in full — every sub-asset under every class, line by line, each
 * class its own foldable table — and that is a screen of figures on a screen meant to be read at a
 * glance. This is the top of it: a row per class, what the plan asks for against what is held, and what
 * would have to move to close the gap. Line by line is still the Holdings tab, where somebody who wants
 * that goes looking for it.
 */
export function AgainstTheModelPanel({ clientId }: { clientId: string }) {
  const standing = useGetClientPortfolio<PortfolioStanding, ApiError>(clientId);

  return (
    <section className="rounded-2xl border border-line bg-white px-6 py-5">
      <h2 className="text-base font-bold">Portfolio</h2>
      <p className="mt-0.5 text-xs text-ink-muted">
        Each asset class set against the plan this client is measured on.
      </p>
      <div className="mt-3">
        {standing.isPending && <p className="text-sm text-ink-muted">Reading the portfolio…</p>}
        {standing.isError && <Alert tone="danger">{standing.error.message}</Alert>}
        {/* Nothing to draw, said as the reason there is nothing rather than as an empty table. A client
            measured against no plan has no target for any class, so every column but one would be a
            dash — which reads as a portfolio nobody has looked at rather than one nobody has put on a
            plan yet. */}
        {standing.data && standing.data.classes.length === 0 && (
          <p className="text-sm text-ink-muted">
            {standing.data.modelName
              ? "Nothing is held against this plan yet."
              : "This client is measured against no plan, so there is nothing to set their holdings beside."}
          </p>
        )}
        {/* No way through from a row. On the portfolio screen a class name opens the lines inside it,
            further down that same page; there is nothing further down this one to open. */}
        {standing.data && standing.data.classes.length > 0 && (
          <ClassStandingTable
            classes={standing.data.classes}
            currency={standing.data.currency}
            suggestions={!standing.data.customModel}
            underManagement={standing.data.underManagement}
          />
        )}
      </div>
    </section>
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
export function ProposalsPanel({ clientId, arrangeable = true }: {
  clientId: string;
  /**
   * Whether to offer the saved views and the column picker above the table.
   *
   * <p>Off on the overview, where this is one tile among eight and a glance at what the client has been
   * advised. Arranging a table is work somebody sits down to do, on the tab that holds nothing else; a
   * row of controls over a tile three proposals deep was furniture for a job nobody starts there.
   */
  arrangeable?: boolean;
}) {
  // Above the two ways out of this panel: a hook React sees on one render and not the next is a hook it
  // cannot keep in order.
  const navigate = useNavigate();
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
      {arrangeable && (
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
      )}
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            {/* The heading band the firm's other tables wear — Trails, the KYC queues, the FX rates. The
                columns were there already; what was missing was anything marking them off from the rows,
                so a short list read as loose lines on a white card rather than as a table. */}
            <tr className="border-b border-line bg-slate-50 text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
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
              /* The whole row is the press, the way the trails read. A link in one cell is a target the
                 width of a word on a row the width of the screen, and everything else on it looks
                 pressable and is not. The link on the title stays — it is what a keyboard reaches, and
                 what opens a proposal in another tab — and it stops the press going any further so the
                 two do not both navigate and leave a reader pressing Back twice. */
              <tr
                key={proposal.id}
                onClick={() => void navigate(`/proposals/${proposal.id}?from=client`)}
                className="cursor-pointer hover:bg-slate-50/60"
              >
                <td className="py-3 pr-4 pl-5">
                  <Link
                    to={`/proposals/${proposal.id}?from=client`}
                    onClick={(event) => event.stopPropagation()}
                    className="font-semibold hover:text-primary-600"
                  >
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
export function FamilyPanel({
  client,
  family,
  invitations,
  group,
}: {
  client: CustomerDetail["client"];
  family: FamilyMember[];
  invitations: FamilyInvitationRow[];
  group: FamilyGroupSummary | null;
}) {
  const navigate = useNavigate();
  const user = useStaffUser();
  const [inviting, setInviting] = useState(false);
  // The firm's own list, so a sixth relationship the firm adds is offered here without a deploy.
  const { labelFor } = useRelationshipTypes();
  // Only the ones still waiting. A cancelled invitation stays on the record and is read in the trail, not
  // kept on the family group as though somebody were still expected.
  const waiting = invitations.filter((one) => one.status === "INVITED");
  const [drawn, setDrawn] = useState<"chart" | "list">("chart");
  // Whose branch the next invitation hangs off, chosen by pressing Invite under somebody on the chart.
  // Null means the client whose file this is, which is where an invitation landed before families had
  // generations and is still the right answer for the button at the top of the panel.
  const [inviteUnder, setInviteUnder] = useState<string | null>(null);
  // Who the firm is about to take out of the group, held until they confirm. Nothing happens on the row.
  const [removing, setRemoving] = useState<FamilyMember | null>(null);
  const location = useLocation();
  const backTo = clientsHref(location.state);
  // A client is read under whichever list they were reached from: a relationship manager has My clients
  // and no sight of every client, so sending them to the whole book's address would only turn them round
  // at the door.
  const mine = location.pathname.startsWith("/my-clients");
  const mayAdd = hasAnyAuthority(user, ...ONBOARDS_CLIENTS_CHANGE) && client.type === "INDIVIDUAL";
  const openTheir = (id: string) => `${mine ? "/my-clients" : "/clients"}/${id}`;

  // Inviting, and nothing else. Adding an account holder stood here too and has been taken off: somebody
  // does not join an account because a desk typed their name on this screen. They are invited, they come
  // in, and they are onboarded — with their own papers, their own checks and their own file.
  const addThem = mayAdd ? (
    <Button
      size="lg"
      onClick={() => {
        setInviteUnder(null);
        setInviting(true);
      }}
    >
      Invite family member
    </Button>
  ) : null;

  // Two ways of reading the same people. The chart answers who they are to each other, which is what
  // somebody opening this tab wants first; the table answers what is true of each, which is what they want
  // once they have found the person. Neither is a subset of the other, so neither replaces the other.
  const howToRead = (
    <span className="flex rounded-lg border border-line bg-white p-0.5 text-xs font-semibold">
      {([["chart", "Chart", <LayoutGrid key="c" />], ["list", "List", <Rows3 key="l" />]] as const).map(
        ([which, label, icon]) => (
          <button
            key={which}
            type="button"
            aria-pressed={drawn === which}
            onClick={() => setDrawn(which)}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 [&_svg]:size-3.5",
              drawn === which ? "bg-slate-100 text-ink" : "text-ink-muted hover:text-ink",
            )}
          >
            {icon}
            {label}
          </button>
        ),
      )}
    </span>
  );

  const takeOut = (
    <RemoveFromFamily
      clientId={client.id}
      member={removing}
      onClose={() => setRemoving(null)}
    />
  );

  const invite = (
    <InviteFamilyMember
      open={inviting}
      clientId={client.id}
      clientName={client.fullName}
      family={family}
      under={inviteUnder}
      onUnderChange={setInviteUnder}
      onClose={() => setInviting(false)}
    />
  );
  if (family.length === 0 && waiting.length === 0) {
    return (
      <>
        <WaitingPanel icon={<Wallet />} title="No family group" actions={addThem} />
        {invite}
      </>
    );
  }

  return (
    <section aria-labelledby="family-title" className="rounded-2xl border border-line bg-white">
      {invite}
      {takeOut}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-6 py-5">
        <div>
          <h2 id="family-title" className="text-base font-bold">
            Family group
          </h2>
          <p className="mt-0.5 text-xs text-ink-muted">
            Everyone holding this account, and anyone asked to join it.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {howToRead}
          {addThem}
        </div>
      </div>

      {drawn === "chart" ? (
        <FamilyChart
          client={client}
          family={family}
          invitations={waiting}
          group={group}
          openTheir={openTheir}
          backTo={backTo}
          mayInvite={mayAdd}
          onInviteUnder={(memberId) => {
            setInviteUnder(memberId);
            setInviting(true);
          }}
        >
          {group && <GroupSummary clientId={client.id} group={group} mayEdit={mayAdd} />}
        </FamilyChart>
      ) : (
        <>
      {group && <GroupSummary clientId={client.id} group={group} mayEdit={mayAdd} />}

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-y border-line bg-slate-50 text-2xs font-semibold tracking-wider text-ink-muted uppercase">
              <th className="px-6 py-2.5 text-left">Name</th>
              <th className="px-4 py-2.5 text-left">Relationship</th>
              <th className="px-4 py-2.5 text-left">Joined</th>
              <th className="px-4 py-2.5 text-left">Bank accounts</th>
              <th className="px-4 py-2.5 text-left">KYC</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {downTheTree(treeOf(family, [])).map(({ branch, depth }) => {
              const member = branch.member;
              const theirs = member.id !== client.id;
              return (
                // The whole line opens them, not the name alone: everybody on an application is a client in
                // their own right, with the same file behind them.
                <tr
                  key={member.id}
                  onClick={theirs ? () => void navigate(openTheir(member.id), { state: { from: backTo } }) : undefined}
                  className={cn("border-b border-line last:border-0", theirs && "cursor-pointer hover:bg-slate-50/60")}
                >
                  <td className="px-6 py-3">
                    <span
                      className="flex items-center gap-3"
                      style={{ paddingLeft: `${depth * 1.5}rem` }}
                    >
                      <Avatar name={member.fullName} photo={member.photo} />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">
                          {theirs ? (
                            <Link
                              to={openTheir(member.id)}
                              state={{ from: backTo }}
                              className="hover:text-primary-700"
                            >
                              {member.fullName}
                            </Link>
                          ) : (
                            member.fullName
                          )}
                        </span>
                        <span className="block truncate text-xs text-ink-muted">
                          {member.code}
                          {!theirs && " · this client"}
                        </span>
                      </span>
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone="neutral">
                      {member.primaryHolder
                        ? "Primary holder"
                        : member.accountHolder
                          ? "Joint holder"
                          : (member.relationshipToPrimary ?? labelFor(member.relationship))}
                    </Badge>
                    {/* A co-holder is a peer of the holder, so the badge says what they hold. What they
                        are to the holder is still worth having, and goes underneath as the chart does. */}
                    {!member.primaryHolder && member.accountHolder && (
                      <span className="mt-0.5 block text-2xs text-ink-muted">
                        {labelFor(member.relationship)}
                      </span>
                    )}
                    {/* Said only where the tree makes it different from the line above. */}
                    {member.parentName && member.relationshipToPrimary && (
                      <span className="mt-0.5 block text-2xs text-ink-muted">under {member.parentName}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm whitespace-nowrap">{formatDate(member.joinedOn)}</td>
                  <td className="px-4 py-3 text-sm tabular-nums">{member.bankAccounts}</td>
                  <td className="px-4 py-3">
                    <Badge tone={kycStatusTones[member.kycStatus]}>{kycStatusLabels[member.kycStatus]}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <RowActions
                      actions={[
                        ...(theirs
                          ? [{
                              label: "Open their file",
                              go: () => void navigate(openTheir(member.id), { state: { from: backTo } }),
                            }]
                          : []),
                        // Not offered on the holder: the family is their application, and a group without
                        // the person it belongs to has no owner and no tier to hang anybody off.
                        ...(mayAdd && !member.primaryHolder
                          ? [{ label: "Remove from family", go: () => setRemoving(member) }]
                          : []),
                      ]}
                    />
                  </td>
                </tr>
              );
            })}
            {/* Asked, and not here yet. Under the people rather than among them: an invitation is an
                address, and a member is a client with a file behind them. */}
            {waiting.map((one) => (
              <InvitedRow key={one.id} clientId={client.id} invitation={one} mayAct={mayAdd} />
            ))}
          </tbody>
        </table>
      </div>
      <Invitations clientId={client.id} invitations={invitations} mayAct={mayAdd} />
        </>
      )}
    </section>
  );
}

/**
 * What the firm calls this group, and the handful of facts a reader wants above the people.
 *
 * <p>The name is worked out from the first holder's surname until somebody disagrees. Shown as editable
 * either way, and the pencil is the only hint that it was a guess — a screen that announced "we guessed
 * this" on every family group would be shouting about a thing that is right most of the time.
 */
function GroupSummary({
  clientId,
  group,
  mayEdit,
}: {
  clientId: string;
  group: FamilyGroupSummary;
  mayEdit: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(group.name);
  const queryClient = useQueryClient();
  const rename = useRenameFamily<ApiError>({
    mutation: {
      onSuccess: () => {
        void queryClient.invalidateQueries();
        setEditing(false);
      },
    },
  });

  return (
    <div className="m-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-slate-50/60 px-5 py-4">
      <div className="flex min-w-0 items-center gap-4">
        <span
          aria-hidden="true"
          className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary-50 text-primary-600 [&_svg]:size-5"
        >
          <UsersRound />
        </span>
        <div className="min-w-0">
          {editing ? (
            <span className="flex flex-wrap items-center gap-2">
              <TextInput
                id="family-name"
                aria-label="What the firm calls this family"
                className="h-9 w-56"
                value={name}
                maxLength={120}
                onChange={(event) => setName(event.target.value)}
              />
              <Button
                size="sm"
                disabled={rename.isPending}
                onClick={() => rename.mutate({ id: clientId, data: { name: name.trim() || null } })}
              >
                {rename.isPending ? "Saving…" : "Save"}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={rename.isPending}
                onClick={() => {
                  setName(group.name);
                  rename.reset();
                  setEditing(false);
                }}
              >
                Cancel
              </Button>
              {/* Emptying it is not leaving the group nameless — it puts the worked-out name back. */}
              <span className="text-xs text-ink-muted">Leave it empty to go back to {group.name}.</span>
            </span>
          ) : (
            <p className="flex items-center gap-2 text-base font-bold">
              {group.name}
              {mayEdit && (
                <button
                  type="button"
                  aria-label="Rename this family group"
                  onClick={() => setEditing(true)}
                  className="text-ink-muted hover:text-primary-700"
                >
                  <PencilLine aria-hidden="true" className="size-4" />
                </button>
              )}
            </p>
          )}
          {rename.error && <p className="mt-1 text-xs text-red-600">{rename.error.message}</p>}
          <p className="mt-0.5 text-xs text-ink-muted">
            Primary holder: {group.primaryHolderName}
            {group.primaryHolderCode && ` · ${group.primaryHolderCode}`}
          </p>
          {group.openedOn && (
            <p className="text-xs text-ink-muted">Account opened {formatDate(group.openedOn)}</p>
          )}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">Members</p>
        <p className="text-2xl font-bold tabular-nums">{group.members}</p>
        {group.invited > 0 && <p className="text-xs text-ink-muted">+{group.invited} invited</p>}
      </div>
    </div>
  );
}

/**
 * The row's own menu.
 *
 * <p>Kept even where it holds one thing, because what it holds is going to grow. Drawn as nothing at all
 * when it would be empty: a button that opens onto a blank list is worse than no button.
 */
function RowActions({ actions }: { actions: { label: string; go: () => void }[] }) {
  const [open, setOpen] = useState(false);
  if (actions.length === 0) {
    return null;
  }
  return (
    <span className="relative inline-block">
      <button
        type="button"
        aria-label="What can be done with this row"
        aria-expanded={open}
        onClick={(event) => {
          // The row underneath opens the client; this button is its own thing.
          event.stopPropagation();
          setOpen((was) => !was);
        }}
        className="rounded-lg px-2 py-1 text-lg leading-none font-bold text-ink-muted hover:bg-slate-100 hover:text-ink"
      >
        &#8943;
      </button>
      {open && (
        <span
          className="absolute right-0 z-10 mt-1 block min-w-44 rounded-xl border border-line bg-white py-1 text-left shadow-lg"
          onMouseLeave={() => setOpen(false)}
        >
          {actions.map((one) => (
            <button
              key={one.label}
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setOpen(false);
                one.go();
              }}
              className="block w-full px-3 py-2 text-left text-sm whitespace-nowrap hover:bg-slate-50"
            >
              {one.label}
            </button>
          ))}
        </span>
      )}
    </span>
  );
}

/**
 * Somebody asked to join the group who has not come in yet.
 *
 * <p>Drawn plainly as what it is: an address, not a person. No avatar initials, because initials off an
 * email address read as a name the firm does not have — and nowhere to click through to, because there is
 * no file behind an invitation.
 */
function InvitedRow({
  clientId,
  invitation,
  mayAct,
}: {
  clientId: string;
  invitation: FamilyInvitationRow;
  mayAct: boolean;
}) {
  const queryClient = useQueryClient();
  const done = { mutation: { onSuccess: () => void queryClient.invalidateQueries() } };
  const resend = useResendFamilyInvitation<ApiError>(done);
  const cancel = useCancelFamilyInvitation<ApiError>(done);
  const busy = resend.isPending || cancel.isPending;
  const failed = resend.error ?? cancel.error;

  // A row of the same table, not a list item. It was one when this panel was a list, and left behind when
  // the panel became a table: a <li> inside a <tbody> is not a row, so the browser lifted its contents out
  // and piled them into the first cell.
  return (
    <tr className="border-b border-line bg-amber-50/30 last:border-0">
      <td className="px-6 py-3">
        <span className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="grid size-9 shrink-0 place-items-center rounded-full border border-dashed border-amber-400 bg-amber-50 text-xs font-bold text-amber-700"
          >
            ?
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-amber-900">{invitation.email}</span>
            <span className="block truncate text-xs text-ink-muted">
              Invited {formatDate(invitation.invitedAt.slice(0, 10))}
              {invitation.invitedByName && ` by ${invitation.invitedByName}`}
            </span>
            {failed && <span className="block text-xs text-red-600">{failed.message}</span>}
          </span>
        </span>
      </td>
      <td className="px-4 py-3">
        <Badge tone="neutral">{invitation.relationship}</Badge>
      </td>
      {/* Nothing to say yet: they have not joined, so they have no joining date and no accounts. */}
      <td className="px-4 py-3 text-sm text-ink-muted">—</td>
      <td className="px-4 py-3 text-sm text-ink-muted">—</td>
      <td className="px-4 py-3">
        <Badge tone="warning">Invited</Badge>
      </td>
      <td className="px-4 py-3 text-right whitespace-nowrap">
        {mayAct && (
          <span className="inline-flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={busy}
              onClick={() => resend.mutate({ id: clientId, invitationId: invitation.id })}
            >
              {resend.isPending ? "Sending…" : "Resend"}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={busy}
              onClick={() => cancel.mutate({ id: clientId, invitationId: invitation.id })}
            >
              Cancel
            </Button>
          </span>
        )}
      </td>
    </tr>
  );
}

/**
 * Every invitation this client has sent, and what became of each.
 *
 * <p>Under the people rather than among them, and all of them rather than only the ones still waiting.
 * The table above shows who is in the family; this answers the other question a desk asks — who has been
 * approached, and how that went. Until now a settled invitation simply vanished from the screen, so a desk
 * asked "did we ever write to her?" had nowhere to look and asked her again.
 */
function Invitations({
  clientId,
  invitations,
  mayAct,
}: {
  clientId: string;
  invitations: FamilyInvitationRow[];
  mayAct: boolean;
}) {
  if (invitations.length === 0) {
    return null;
  }
  return (
    <section className="border-t border-line px-6 py-5">
      <h3 className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">Invitations</h3>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-line text-2xs font-semibold tracking-wider text-ink-muted uppercase">
              <th className="py-2 pr-4 text-left">Email</th>
              <th className="px-4 py-2 text-left">Relationship</th>
              <th className="px-4 py-2 text-left">Sent</th>
              <th className="px-4 py-2 text-left">Status</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {invitations.map((one) => (
              <tr key={one.id} className="border-b border-line text-sm last:border-0">
                <td className="py-2.5 pr-4">{one.email}</td>
                <td className="px-4 py-2.5">{one.relationship}</td>
                <td className="px-4 py-2.5 whitespace-nowrap">
                  {formatDate((one.lastSentAt ?? one.invitedAt).slice(0, 10))}
                </td>
                <td className="px-4 py-2.5">
                  <Badge tone={invitationTones[one.status]}>{one.statusSaid}</Badge>
                </td>
                <td className="px-4 py-2.5 text-right whitespace-nowrap">
                  {/* Only one still open can be taken back. There is nothing to revoke on an invitation
                      that has been accepted, refused or already run out. */}
                  {mayAct && one.status === "INVITED" && (
                    <RevokeInvitation clientId={clientId} invitationId={one.id} />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** How each outcome is coloured, in the firm's own words for them. */
const invitationTones: Record<FamilyInvitationRow["status"], "warning" | "success" | "neutral" | "danger"> = {
  INVITED: "warning",
  JOINED: "success",
  CANCELLED: "neutral",
  DECLINED: "danger",
  EXPIRED: "neutral",
};

/** Taking an open invitation back. */
function RevokeInvitation({ clientId, invitationId }: { clientId: string; invitationId: string }) {
  const queryClient = useQueryClient();
  const cancel = useCancelFamilyInvitation<ApiError>({
    mutation: { onSuccess: () => void queryClient.invalidateQueries() },
  });
  return (
    <Button
      variant="secondary"
      size="sm"
      disabled={cancel.isPending}
      onClick={() => cancel.mutate({ id: clientId, invitationId })}
    >
      {cancel.isPending ? "Revoking…" : "Revoke"}
    </Button>
  );
}

/**
 * Taking somebody out of a family group.
 *
 * <p>Spelled out, because "remove" is the most frightening word on this screen and what it does here is
 * much smaller than what it sounds like. Nothing of theirs is deleted, deactivated or closed; they stop
 * being counted as part of this household and carry on as a client of the firm exactly as before. A desk
 * that was not told that will not press it, and a desk that assumed the worst and pressed it anyway is the
 * one this wording is really for.
 */
function RemoveFromFamily({
  clientId,
  member,
  onClose,
}: {
  clientId: string;
  member: FamilyMember | null;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const queryClient = useQueryClient();
  const remove = useRemoveFamilyMember<ApiError>({
    mutation: {
      onSuccess: () => {
        setReason("");
        void queryClient.invalidateQueries();
        onClose();
      },
    },
  });

  return (
    <Dialog
      open={member !== null}
      title={member ? `Remove ${member.fullName} from this family?` : ""}
      description="They stay a client of the firm. Only their place in this group ends."
      onClose={() => {
        setReason("");
        remove.reset();
        onClose();
      }}
    >
      <div className="space-y-4">
        {remove.error && <Alert tone="danger">{remove.error.message}</Alert>}

        <ul className="space-y-2 text-sm text-ink-soft">
          <li>They will no longer be part of this family group.</li>
          <li>Their own record, accounts and documents are untouched.</li>
          {/* Said because somebody will otherwise wonder what happened to the people under them. */}
          <li>Anyone below them in the family moves up to where they were.</li>
        </ul>

        <Field id="remove-reason" label="Why" hint="Optional. Kept on the record.">
          <TextArea
            id="remove-reason"
            rows={2}
            maxLength={500}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </Field>

        <div className="flex justify-end gap-2">
          <Button variant="secondary" disabled={remove.isPending} onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="danger"
            disabled={remove.isPending || !member}
            onClick={() =>
              member &&
              remove.mutate({ id: clientId, memberId: member.id, data: { reason: reason.trim() || null } })
            }
          >
            {remove.isPending ? "Removing…" : "Remove from family"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

/** Somebody's first name, for a label that has to fit on one line. */
function firstWordOf(name: string) {
  return name.trim().split(/\s+/)[0] ?? name;
}

/**
 * Asking somebody to join the group.
 *
 * <p>Two fields, because two is all the firm has at this point. The relationship list is the firm's own,
 * read from Config rather than written out here, so adding a sixth is a row in a table and not a release.
 *
 * <p>What they get is a way in and not an account. The email carries a link to a page where they set
 * themselves up, and the desk can read out a password that opens the same page for somebody the email did
 * not reach. Being in a family group is not being onboarded: their KYC starts where everybody's does.
 */
function InviteFamilyMember({
  open,
  clientId,
  clientName,
  family,
  under,
  onUnderChange,
  onClose,
}: {
  open: boolean;
  clientId: string;
  clientName: string;
  /** Everybody already in the group, because any of them may be the one invited under. */
  family: FamilyMember[];
  /** Whose branch this one hangs off; null for the client whose file this is. */
  under: string | null;
  onUnderChange: (memberId: string | null) => void;
  onClose: () => void;
}) {
  const [email, setEmail] = useState("");
  const [relationship, setRelationship] = useState("");
  const [message, setMessage] = useState("");
  // What was sent, once it has been. The window does not close on success: the password is minted by the
  // send and is the one thing on this screen that cannot be looked up again, so closing on success would
  // mean handing it over and taking it away in the same instant.
  const [sent, setSent] = useState<{ email: string; password: string } | null>(null);
  const { inUse } = useRelationshipTypes();
  const queryClient = useQueryClient();
  const address = email.trim();
  // Who they are joining under, and therefore who the relationship is measured from. The client whose
  // file this is, unless a desk pressed Invite under somebody on the chart.
  const parent = family.find((one) => one.id === under) ?? family.find((one) => one.id === clientId);
  const parentName = parent?.fullName ?? clientName;
  const invite = useInviteFamilyMember<ApiError>({
    mutation: {
      onSuccess: (after: CustomerDetail) => {
        const made = after.familyInvitations.find(
          (one) => one.status === "INVITED" && one.email.toLowerCase() === address.toLowerCase(),
        );
        setSent({ email: address, password: made?.joinPassword ?? "" });
        void queryClient.invalidateQueries();
      },
    },
  });

  const shut = () => {
    setEmail("");
    setRelationship("");
    setMessage("");
    setSent(null);
    invite.reset();
    onClose();
  };

  return (
    <Dialog
      open={open}
      title="Invite family member"
      description={sent ? sent.email : `They will be emailed and asked to join ${clientName}'s account.`}
      onClose={shut}
    >
      {sent ? (
        <TemporaryPassword password={sent.password} onDone={shut} />
      ) : (
      <div className="space-y-4">
        {invite.error && <Alert tone="danger">{invite.error.message}</Alert>}

        {/* Where in the family they land, chosen before anything else is typed: it is what the
            relationship below is measured from, and a desk that filled the form first and then changed
            this would have described somebody's child as somebody else's. */}
        {whoCanBeInvitedUnder(family).length > 1 && (
          <Field
            id="invite-under"
            label="Invite under"
            hint={`They join the family as a member of ${parentName}'s branch.`}
          >
            <SelectInput
              id="invite-under"
              value={under ?? clientId}
              onChange={(event) => onUnderChange(event.target.value)}
            >
              {whoCanBeInvitedUnder(family).map((one) => (
                <option key={one.id} value={one.id}>
                  {one.fullName}
                  {one.primaryHolder
                    ? " (primary holder)"
                    : one.relationshipToPrimary
                      ? ` (${one.relationshipToPrimary.toLowerCase()})`
                      : ""}
                </option>
              ))}
            </SelectInput>
          </Field>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="invite-email" label="Email address" required>
            <TextInput
              id="invite-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="rohan.khan@example.com"
            />
          </Field>
          <Field id="invite-relationship" label={`Relationship to ${firstWordOf(parentName)}`} required>
            <SelectInput
              id="invite-relationship"
              value={relationship}
              onChange={(event) => setRelationship(event.target.value)}
            >
              <option value="">Choose one…</option>
              {inUse.map((entry) => (
                <option key={entry.code} value={entry.code}>
                  {entry.name}
                </option>
              ))}
            </SelectInput>
          </Field>
        </div>

        {/* The firm's wording explains what an invitation is. It cannot say the one thing the person
            opening it wants to know — that it is really from their mother, and why she is asking. */}
        <Field
          id="invite-message"
          label="Add a personal message (optional)"
          hint={`Sent in ${clientName.split(" ")[0]}'s name, inside the firm's own email.`}
        >
          <TextArea
            id="invite-message"
            rows={3}
            maxLength={500}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Join our family group so we can look after things together."
          />
        </Field>


        <div className="flex justify-end gap-2">
          <Button variant="secondary" disabled={invite.isPending} onClick={shut}>
            Cancel
          </Button>
          <Button
            disabled={invite.isPending || address.length === 0 || relationship.length === 0}
            onClick={() =>
              invite.mutate({
                id: clientId,
                data: {
                  email: address,
                  relationshipCode: relationship,
                  personalMessage: message.trim() || null,
                  inviteUnder: under,
                },
              })
            }
          >
            {invite.isPending ? "Sending…" : "Send invite"}
          </Button>
        </div>
      </div>
      )}
    </Dialog>
  );
}

/** Everything that has happened to this client, newest first, from the same trail the Audit log reads. */
/**
 * What has been done to this client, newest first.
 *
 * <p>On the overview it is cut to a handful. The trail runs to every time anybody opened the file, so
 * drawn whole it was a column of "Viewed a client" that pushed the rest of the screen a page and a half
 * down — and the screen is meant to be read at a glance. The tab beside it draws the lot.
 *
 * @param only how many to draw; everything when it is not given
 * @param onViewMore where the rest is, shown as a link when there is more than is drawn
 */
export function ActivityPanel({ activity, only, onViewMore }: {
  activity: ClientEvent[];
  only?: number;
  onViewMore?: () => void;
}) {
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
        {(only == null ? activity : activity.slice(0, only)).map((event, index) => (
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
      {/* Only where there is more than was drawn: a link to the same thing you are already reading all
          of says there is something behind it, and there is not. */}
      {only != null && onViewMore && activity.length > only && (
        <div className="border-t border-line px-6 py-3">
          <button
            type="button"
            onClick={onViewMore}
            className="text-sm font-semibold text-primary-700 hover:underline"
          >
            View more
          </button>
        </div>
      )}
    </section>
  );
}

function roleLabel(code: string) {
  return code.charAt(0) + code.slice(1).toLowerCase().replaceAll("_", " ");
}
