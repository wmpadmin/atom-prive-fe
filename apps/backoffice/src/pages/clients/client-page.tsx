import { ApiError } from "@atomprive/api-client";
import {
  getReadClientAskQueryKey,
  readClientAsk,
  useAskToDeactivate,
  useKeepTheAccount,
  type ClientAsk,
  getGetCustomerQueryKey,
  getListCustomersQueryKey,
  useGetCustomer,
  useRemoveAdvisor,
  useRemovePortfolioManager,
  type CustomerDetail,
  type StaffMember,
} from "@atomprive/api-client/backoffice";
import { Alert, Avatar, Badge, Button, cn, Dialog, Field, TextArea } from "@atomprive/ui";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Briefcase, ChevronDown, ChevronLeft, LayoutGrid, PencilLine, UserRoundCog, UserX } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useLocation, useParams } from "react-router";
import { useStaffUser } from "../../auth/session";
import { formatMobileNumber } from "../../lib/mobile-numbers";
import { hasAnyAuthority, hasAuthority, ONBOARDS_CLIENTS_CHANGE, READS_PROPOSALS, type Authority } from "../../lib/permissions";
import { ConfirmDialog } from "../config/confirm-dialog";
import { toForm } from "../onboarding/application";
import { ApplicationSummary } from "../onboarding/application-summary";
import { BankAccountsPanel } from "./bank-accounts-panel";
import { AssignAdvisorDialog } from "./assign-advisor-dialog";
import { AssignPortfolioManagerDialog } from "./assign-portfolio-manager-dialog";
import { AssignedStaffPanel } from "./assigned-staff-panel";
import { EditClientDialog } from "./edit-client-dialog";
import {
  ActivityPanel,
  AgainstTheModelPanel,
  FamilyPanel,
  HoldingsPanel,
  ProposalsPanel,
  TransactionsPanel,
} from "./client-file-panels";
import { assignmentNotice, clientsHref, clientTypeLabels, managerAssignmentNotice } from "./client-labels";
import { ClientAccessPanel } from "./client-access-panel";
import { DeactivationTab } from "../deactivation/deactivation-tab";
import { ClientFormsPanel } from "./client-forms-panel";
import { SecurityTab } from "./security-tab";
import { ClientOverviewTab, GenerateReport } from "./client-overview";
import { Popover } from "../book/overview-dialogs";

const STATUS_LABELS: Record<CustomerDetail["client"]["status"], string> = { ACTIVE: "Active", DEACTIVATED: "Deactivated", ARCHIVED: "Archived" };
const STATUS_TONES: Record<CustomerDetail["client"]["status"], "success" | "warning" | "neutral"> = { ACTIVE: "success", DEACTIVATED: "warning", ARCHIVED: "neutral" };

type Tab = "overview" | "family" | "advisors" | "portfolioManagers" | "banks" | "holdings" | "transactions" | "documents" | "security" | "activity" | "deactivation";

/** @param needs what the reader has to hold for this tab to be theirs; left out, the tab is everyone's */
const TABS: { id: Tab; label: string; needs?: Authority[] }[] = [
  { id: "overview", label: "Overview" },
  { id: "family", label: "Family group" },
  { id: "advisors", label: "Relationship managers" },
  // Its own tab beside the relationship managers' rather than two lists under one heading called
  // Relationship managers. Who manages the portfolio and who the client speaks to are two desks, and the
  // file says so.
  { id: "portfolioManagers", label: "Portfolio managers" },
  { id: "banks", label: "Bank accounts" },
  { id: "holdings", label: "Holdings" },
  { id: "transactions", label: "Transactions" },
  // Named for what is on it: the client's form pack. "Documents" was the word for the KYC papers as
  // well — the passport and the proof of address, which are read on the client's KYC screens — so one
  // word pointed at two different piles.
  { id: "documents", label: "Forms" },
  // How the client signs in to the portal, and the firm's hold on it. Operations and Admin act; Compliance reads.
  { id: "security", label: "Security & Authentication", needs: ["CLIENT_SIGN_IN:VIEW", "CLIENT_SIGN_IN:CHANGE"] },
  { id: "activity", label: "Activity" },
  // Last, because it is the end of a client's life with the firm and reads as one.
  { id: "deactivation", label: "Deactivation" },
];

/**
 * A client's whole file: who they are, their family group, their relationship managers and what has
 * happened to them (#78).
 */
export function ClientPage() {
  const { clientId = "" } = useParams();
  const user = useStaffUser();
  const canAssign = hasAuthority(user, "ASSIGN_ADVISORS:CHANGE");
  // Its own permission, asked on its own. Operations hold both today, and the day that changes this screen
  // should follow the firm rather than carry on guessing from the relationship manager one.
  const canAssignManagers = hasAuthority(user, "ASSIGN_PORTFOLIO_MANAGERS:CHANGE");
  // Whoever runs a team decides who on it sees this client, and so who reads their documents.
  const setsAccess = hasAuthority(user, "ASSIGN_WORK:CHANGE");
  // Operations fill a client's forms but do not read the advice given to them. That was the Proposals
  // tab's guard; the tab is gone and the overview tile is the only place proposals are read on this file,
  // so the guard moves onto it. Ungated it would have handed Operations what the tab had refused them.
  const readsProposals = hasAnyAuthority(user, ...READS_PROPOSALS);
  // Everyone with access reads the file; only Operations correct it, because Operations entered it. Compliance
  // read the whole record to decide on the KYC and a head of desk decides who sees the client — neither types
  // over the details. An Admin has it because an Admin holds every permission there is.
  const canEdit = hasAuthority(user, "ONBOARD_CLIENTS:CHANGE");
  const location = useLocation();
  // The same file opens from All clients and from My clients. Back goes where they came from: a relationship
  // manager has no All clients screen to return to.
  const mine = location.pathname.startsWith("/my-clients");
  const backTo = mine ? "/my-clients" : clientsHref(location.state);
  const backLabel = mine ? "My clients" : "All clients";
  const queryClient = useQueryClient();
  const detail = useGetCustomer<CustomerDetail, ApiError>(clientId);
  // Coming back from one of the client's forms opens the tab it was reached from, rather than the top of
  // the file: whoever went into a document is on their way back to the rest of them.
  const tabs = TABS.filter((option) => !option.needs || hasAnyAuthority(user, ...option.needs));
  const [tab, setTab] = useState<Tab>(() => {
    const asked = (location.state as { tab?: string } | null)?.tab ?? new URLSearchParams(location.search).get("tab");
    return tabs.some((option) => option.id === asked) ? (asked as Tab) : "overview";
  });
  // "Open the portfolio" goes down this screen rather than away to another one, and from another tab
  // that is two steps: show the overview, then go to the section on it. The second cannot run until the
  // first has drawn, so it is left as a note here and carried out once the tab has changed. Already on
  // the overview there is nothing to wait for — and nothing to wait on either, since setting the tab to
  // the one it is on draws nothing and no effect would follow.
  const wantsThePortfolio = useRef(false);
  useEffect(() => {
    if (!wantsThePortfolio.current) return;
    wantsThePortfolio.current = false;
    goDownToThePortfolio();
  }, [tab]);
  const openThePortfolio = () => {
    if (tab === "overview") {
      goDownToThePortfolio();
      return;
    }
    wantsThePortfolio.current = true;
    setTab("overview");
  };
  const [editing, setEditing] = useState(false);
  const [arranging, setArranging] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  // What the deactivation dialog opens with: empty from the header, the client's own words from their ask.
  const [deactivateWhy, setDeactivateWhy] = useState("");
  /*
   * Off-boarding is offered again, and the other way round from how it was built. V75 wrote it as the
   * client's own asking, with thirty days they kept before the firm might act — and because nobody had
   * settled how a client would do the asking, the button was taken off this screen and the machinery left
   * running behind it. The firm asks now: the desk that looks after the client raises it and says why, the
   * Admin decides, and the ninety days run from the approval as the Admin's window to undo it.
   */
  // Whoever looks after this client: their relationship manager, or Operations across the book. The same
  // set the API admits, and the API checks the "own" half that this cannot see from here.
  const canAskToDeactivate = hasAnyAuthority(user, ...ONBOARDS_CLIENTS_CHANGE);
  const [assigning, setAssigning] = useState(false);
  const [removing, setRemoving] = useState<StaffMember | null>(null);
  const [notice, setNotice] = useState<string>();
  const removeAdvisor = useRemoveAdvisor<ApiError>({
    mutation: {
      onSuccess: (updated) => {
        queryClient.setQueryData(getGetCustomerQueryKey(clientId), updated);
        void queryClient.invalidateQueries({ queryKey: getListCustomersQueryKey() });
        setNotice(`${removing?.fullName ?? "The relationship manager"} no longer looks after ${updated.client.fullName}.`);
        setRemoving(null);
      },
    },
  });
  const [assigningManager, setAssigningManager] = useState(false);
  const [removingManager, setRemovingManager] = useState<StaffMember | null>(null);
  const removeManager = useRemovePortfolioManager<ApiError>({
    mutation: {
      onSuccess: (updated) => {
        queryClient.setQueryData(getGetCustomerQueryKey(clientId), updated);
        void queryClient.invalidateQueries({ queryKey: getListCustomersQueryKey() });
        // "No longer manages", not "no longer sees": taking a manager off writes off a line in a table, and
        // what they may open is not decided here.
        setNotice(`${removingManager?.fullName ?? "The portfolio manager"} no longer manages ${updated.client.fullName}.`);
        setRemovingManager(null);
      },
    },
  });

  if (!detail.data) {
    return (
      <div className="space-y-4">
        <BackLink to={backTo} label={backLabel} />
        {detail.isError ? (
          <Alert tone="danger">{detail.error.status === 404 ? "This client doesn't exist." : detail.error.message}</Alert>
        ) : (
          <p className="text-sm text-ink-muted">Loading the client…</p>
        )}
      </div>
    );
  }

  const { client, advisors, portfolioManagers, family, familyInvitations, familyGroup, activity, application } = detail.data;
  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <BackLink to={backTo} label={backLabel} />
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <Avatar name={client.fullName} photo={client.photo} className="size-14 text-base" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="truncate text-[1.625rem] leading-tight font-bold">{client.fullName}</h1>
                <Badge tone={STATUS_TONES[client.status]}>{STATUS_LABELS[client.status]}</Badge>
              </div>
              <p className="mt-0.5 truncate text-sm text-ink-muted">
                {client.code} · {clientTypeLabels[client.type]}
                {client.email && ` · ${client.email}`}
                {client.phone && ` · ${formatMobileNumber(client.phone)}`}
              </p>
            </div>
          </div>
          {/* The badge on its own line, the buttons under it: they were one row, so the way into the
              portfolio sat among the holdings rather than with the client's other actions. */}
          <div className="flex flex-col items-end gap-2">
            {/* The papers on the client's file — their passport and proof of address — not the forms in
                their pack, which have statuses of their own. */}
            <div className="flex flex-wrap items-center justify-end gap-2">
            {/* Down to it, not away to it. What the client holds, class by class against their model,
                is already on this screen under the tiles — and the button used to leave the client's
                file for a screen of its own, which is a page load and a way back for something that
                was never anywhere else. */}
            <GenerateReport detail={detail.data} />
            {canAskToDeactivate && (
              <Button variant="secondary" size="sm" onClick={() => { setDeactivateWhy(""); setDeactivating(true); }}>
                <UserX aria-hidden="true" />
                Request deactivation
              </Button>
            )}
            {/* The photograph is changed inside Edit profile, with the other two things this screen may
                change. A button of its own beside it was a third action for one field. */}
            <EditClientMenu
              canEdit={canEdit}
              onEdit={() => setEditing(true)}
              onArrange={() => {
                setTab("overview");
                setArranging(true);
              }}
            />
            </div>
          </div>
        </div>
        {canAskToDeactivate && (
          <ClientAskBanner
            clientId={client.id}
            clientName={client.fullName}
            onRaise={(why) => {
              setDeactivateWhy(why);
              setDeactivating(true);
            }}
          />
        )}
        {/* Scrolls rather than wraps: a second row would break the line the tabs sit on. */}
        <div role="tablist" aria-label="Client file" className="flex gap-1 overflow-x-auto border-b border-line">
          {tabs.map((option) => (
            <button
              key={option.id}
              type="button"
              role="tab"
              aria-selected={tab === option.id}
              onClick={() => setTab(option.id)}
              className={cn(
                "-mb-px border-b-2 px-3 py-2 text-sm font-semibold whitespace-nowrap transition-colors",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600",
                tab === option.id ? "border-primary-600 text-primary-700" : "border-transparent text-ink-muted hover:text-ink",
              )}
            >
              {/* A company or trust has no family, so calling the tab Family group on one reads as the
                  individual's screen reused. Stakeholders is what the thing actually is. */}
              {option.id === "family" && client.type === "ENTITY" ? "Stakeholders" : option.label}
            </button>
          ))}
        </div>
      </header>

      {notice && <Alert tone="success">{notice}</Alert>}

      {tab === "overview" && (
        <ClientOverviewTab
          detail={detail.data}
          canEdit={canEdit}
          onEdit={() => setEditing(true)}
          onOpen={setTab}
          arranging={arranging}
          onDoneArranging={() => setArranging(false)}
          // What the reference layout has no place for and the firm still works from, as cards on the same board.
          extra={[
            ...(setsAccess ? [{ id: "access", node: <Boxed><ClientAccessPanel clientId={clientId} /></Boxed> }] : []),
            ...(readsProposals ? [{ id: "proposals", node: <Boxed><ProposalsPanel clientId={client.id} arrangeable={false} /></Boxed> }] : []),
            {
              id: "portfolio",
              node: <Boxed><div id="portfolio" className="scroll-mt-4"><AgainstTheModelPanel clientId={client.id} /></div></Boxed>,
            },
            ...(application ? [{
              id: "application",
              node: (
                <Boxed>
                  <section aria-labelledby="application-title" className="min-w-0 space-y-4 rounded-2xl border border-line bg-white px-5 py-5">
                    <div>
                      <h2 id="application-title" className="panel-grip text-base font-bold">Application</h2>
                      <p className="mt-0.5 text-xs text-ink-muted">The details this client was onboarded with.</p>
                    </div>
                    <ApplicationSummary application={toForm(application)} managers={advisors.map(({ advisor }) => advisor)} />
                  </section>
                </Boxed>
              ),
            }] : []),
          ]}
        />
      )}

      {tab === "security" && <SecurityTab clientId={client.id} clientName={client.fullName} />}
      {tab === "family" && (
        <FamilyPanel
          client={client}
          family={family}
          invitations={familyInvitations}
          group={familyGroup}
        />
      )}
      {tab === "advisors" && (
        <AssignedStaffPanel
          id="advisors"
          title="Relationship managers"
          lead="A client can have several relationship managers. Only they, and staff who see every client, can open this client."
          people={advisors.map(({ advisor, since }) => ({ person: advisor, since }))}
          sinceLabel="Relationship manager since"
          empty="No relationship manager yet."
          assignLabel="Assign relationship manager"
          assignIcon={<UserRoundCog aria-hidden="true" />}
          canAssign={canAssign}
          onAssign={() => setAssigning(true)}
          onRemove={setRemoving}
          busy={removeAdvisor.isPending}
        />
      )}
      {tab === "portfolioManagers" && (
        <AssignedStaffPanel
          id="portfolio-managers"
          title="Portfolio managers"
          // Said plainly, because it is the question the panel raises: this is a record of who manages the
          // portfolio. Nobody's sight of the client, and nothing they may approve, is decided by it yet.
          lead="A client can have several portfolio managers. This records who manages their portfolio; it does not change who can open this client or what anybody may approve."
          people={portfolioManagers.map(({ manager, since }) => ({ person: manager, since }))}
          sinceLabel="Managing since"
          empty="No portfolio manager yet."
          assignLabel="Assign portfolio manager"
          assignIcon={<Briefcase aria-hidden="true" />}
          canAssign={canAssignManagers}
          onAssign={() => setAssigningManager(true)}
          onRemove={setRemovingManager}
          busy={removeManager.isPending}
        />
      )}
      {tab === "banks" && <BankAccountsPanel client={client} />}
      {tab === "holdings" && <HoldingsPanel onSeeThePortfolio={openThePortfolio} />}
      {tab === "transactions" && <TransactionsPanel />}
      {tab === "documents" && <ClientFormsPanel client={client} />}
      {tab === "activity" && <ActivityPanel activity={activity} />}
      {/* The whole of the deactivation on the client's own file: where it stands, the reader's own
          answer if they hold one of the desks asked, and Operations' controls if they are Operations.
          One tab rather than a screen per role, because every desk is looking at the same client. */}
      {tab === "deactivation" && <DeactivationTab customerId={client.id} clientName={client.fullName} />}

      <AskToDeactivate
        key={deactivateWhy}
        initialReason={deactivateWhy}
        open={deactivating}
        clientId={client.id}
        clientName={client.fullName}
        onClose={() => setDeactivating(false)}
      />

      <EditClientDialog
        client={editing ? client : null}
        onClose={() => setEditing(false)}
        onSaved={(saved, moved) => {
          setEditing(false);
          setNotice(
            moved
              ? `Saved. ${saved.client.fullName} has moved, and the new proof of address is with Compliance.`
              : `Saved. ${saved.client.fullName}'s details are up to date.`,
          );
        }}
      />

      <AssignAdvisorDialog
        open={assigning}
        clients={[client]}
        onClose={() => setAssigning(false)}
        onAssigned={(result) => {
          setAssigning(false);
          setNotice(assignmentNotice(result));
        }}
      />
      <ConfirmDialog
        open={removing !== null}
        title={`Take ${removing?.fullName ?? "this relationship manager"} off ${client.fullName}?`}
        description="They stop seeing this client straight away. You can give the client back to them later."
        confirmLabel="Take them off"
        tone="danger"
        busy={removeAdvisor.isPending}
        onConfirm={() => removing && removeAdvisor.mutate({ id: client.id, advisorId: removing.id })}
        onClose={() => setRemoving(null)}
      />
      <AssignPortfolioManagerDialog
        open={assigningManager}
        clients={[client]}
        onClose={() => setAssigningManager(false)}
        onAssigned={(result) => {
          setAssigningManager(false);
          setNotice(managerAssignmentNotice(result));
        }}
      />
      <ConfirmDialog
        open={removingManager !== null}
        title={`Take ${removingManager?.fullName ?? "this portfolio manager"} off ${client.fullName}?`}
        // Not "they stop seeing this client": nothing they can see or approve is settled here yet. What
        // changes is the record of who manages the portfolio.
        description="They stop being recorded as managing this client. Whoever else manages them is left alone, and you can give the client back to them later."
        confirmLabel="Take them off"
        tone="danger"
        busy={removeManager.isPending}
        onConfirm={() => removingManager && removeManager.mutate({ id: client.id, managerId: removingManager.id })}
        onClose={() => setRemovingManager(null)}
      />
    </div>
  );
}

function BackLink({ to, label }: { to: string; label: string }) {
  return (
    <Link to={to} className="inline-flex items-center gap-1 text-sm font-medium text-ink-muted hover:text-primary-700">
      <ChevronLeft aria-hidden="true" className="size-4" />
      {label}
    </Link>
  );
}

/**
 * Down to what the client holds, on the screen that is already open.
 *
 * <p>The way in used to be a link to a portfolio screen of its own. Nothing on it was anywhere else, so
 * the client's file was closed and re-opened to read a table that sits under its own tiles.
 */
function goDownToThePortfolio() {
  document.getElementById("portfolio")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

/**
 * A panel of the page's own as a card on the overview board: held to the size the card is given, scrolling inside
 * it, with a thin strip along the top to drag it by while the cards are being arranged.
 */
function Boxed({ children }: { children: ReactNode }) {
  return (
    <div className="relative h-full min-w-0 overflow-y-auto rounded-2xl [&>*:last-child]:min-h-full">
      <div aria-hidden="true" className="panel-grip absolute inset-x-0 top-0 z-10 h-3" />
      {children}
    </div>
  );
}

/**
 * Edit client, as a menu: the client's details, for whoever may correct them, and how this overview's cards are
 * laid out, for anybody — it changes nothing about the client, only how their screen reads.
 */
function EditClientMenu({ canEdit, onEdit, onArrange }: { canEdit: boolean; onEdit: () => void; onArrange: () => void }) {
  const [open, setOpen] = useState(false);
  const item = "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-canvas [&>svg]:size-4 [&>svg]:text-ink-muted";
  return (
    <div className="relative">
      <Button size="sm" aria-expanded={open} onClick={() => setOpen((was) => !was)}>
        <PencilLine aria-hidden="true" />
        Edit client
        <ChevronDown aria-hidden="true" />
      </Button>
      <Popover open={open} onClose={() => setOpen(false)} className="top-11 right-0 w-56 p-1.5">
        {canEdit && (
          <button type="button" className={item} onClick={() => { setOpen(false); onEdit(); }}>
            <PencilLine aria-hidden="true" />
            Edit details
          </button>
        )}
        <button type="button" className={item} onClick={() => { setOpen(false); onArrange(); }}>
          <LayoutGrid aria-hidden="true" />
          Arrange cards
        </button>
      </Popover>
    </div>
  );
}

/**
 * Asking the Admin to stop acting for this client.
 *
 * <p>The reason is required, which departs from this codebase's usual view that a box you must fill gets
 * filled with a full stop. It is required because this note is the whole of what the Admin has to decide
 * on: they do not know the client, they were not in the conversation, and a request that says nothing is
 * a request to take somebody's word for it.
 *
 * <p>What would happen is spelled out before it is sent, because none of it is visible from here. The
 * desk raising this sees their own lists; what they are asking for is that the client leave everybody
 * else's too.
 */
function AskToDeactivate({
  open,
  clientId,
  clientName,
  initialReason = "",
  onClose,
}: {
  open: boolean;
  clientId: string;
  clientName: string;
  initialReason?: string;
  onClose: () => void;
}) {
  const [why, setWhy] = useState(initialReason);
  // Set by a press with no reason; the box then shows red until one is written.
  const [tried, setTried] = useState(false);
  const queryClient = useQueryClient();
  const ask = useAskToDeactivate<ApiError>({
    mutation: {
      onSuccess: () => {
        setWhy("");
        setTried(false);
        void queryClient.invalidateQueries();
        onClose();
      },
    },
  });
  const said = why.trim();

  return (
    <Dialog
      open={open}
      title={`Ask for ${clientName} to be deactivated?`}
      description="This goes to Operations, who ask every desk to clear their work on this client. Nothing changes until all of them have, and the Admin approves."
      onClose={() => {
        setWhy("");
        setTried(false);
        ask.reset();
        onClose();
      }}
    >
      <div className="space-y-3">
        {ask.error && <Alert tone="danger">{ask.error.message}</Alert>}
        <Field
          id="why-deactivate"
          label="Why"
          required
          hint="The Admin sees this, and it stays on the client's record for good."
          error={tried && said.length === 0 ? "Enter a reason." : undefined}
        >
          <TextArea
            id="why-deactivate"
            aria-invalid={tried && said.length === 0}
            rows={3}
            maxLength={2000}
            value={why}
            onChange={(event) => setWhy(event.target.value)}
            placeholder="The family has moved their mandate to another firm."
          />
        </Field>
        <Alert tone="warning">
          <span className="font-semibold">If the Admin approves:</span> {clientName} disappears from your
          lists and everybody else&rsquo;s — Operations, Compliance and the portfolio desk. Only the Admin
          will be able to see them. Nothing is deleted, and the Admin can put them back within 90 days.
        </Alert>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" disabled={ask.isPending} onClick={() => { setTried(false); onClose(); }}>
            Cancel
          </Button>
          <Button
            disabled={ask.isPending}
            onClick={() => {
              if (said.length === 0) {
                setTried(true);
                requestAnimationFrame(() => document.getElementById("why-deactivate")?.focus());
                return;
              }
              ask.mutate({ customerId: clientId, data: { reason: said } });
            }}
          >
            {ask.isPending ? "Sending…" : "Send it to Operations"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

/**
 * The client asked, from their portal, for their account to be closed (S20). It waits here for whoever looks
 * after them: raise the deactivation through the usual dialog, with their words carried in, or write down
 * that they have changed their mind.
 */
function ClientAskBanner({ clientId, clientName, onRaise }: { clientId: string; clientName: string; onRaise: (why: string) => void }) {
  const queryClient = useQueryClient();
  const asked = useQuery<ClientAsk | null, ApiError>({
    queryKey: getReadClientAskQueryKey(clientId),
    queryFn: async ({ signal }) => (await readClientAsk(clientId, { signal })) ?? null,
  });
  const [keeping, setKeeping] = useState(false);
  const [note, setNote] = useState("");
  // Set by a press with no note; the box then shows red until one is written.
  const [tried, setTried] = useState(false);
  const keep = useKeepTheAccount<ApiError>({
    mutation: {
      onSuccess: () => {
        setKeeping(false);
        setNote("");
        void queryClient.invalidateQueries({ queryKey: getReadClientAskQueryKey(clientId) });
      },
    },
  });
  const ask = asked.data;
  if (!ask) return null;
  const on = new Date(ask.askedAt);
  const day = on.toLocaleDateString("en-GB", { day: "numeric", month: "short" });

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-3.5">
      <div className="min-w-0 text-sm">
        <p>
          <b>{clientName} asked to close their account</b>
          <span className="text-ink-muted"> · {on.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}, from the portal</span>
        </p>
        {ask.reason && <p className="text-ink-muted">“{ask.reason}”</p>}
      </div>
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" onClick={() => { setKeeping(true); setTried(false); }}>They&rsquo;ve changed their mind</Button>
        <Button size="sm" onClick={() => onRaise(`Client asked on ${day}${ask.reason ? `: ${ask.reason}` : "."}`)}>Ask for deactivation</Button>
      </div>
      <Dialog
        open={keeping}
        title={`${clientName} is keeping their account`}
        description="Their request to close is taken off. Say in a line what was agreed; it stays on their record."
        onClose={() => setKeeping(false)}
      >
        <div className="space-y-3">
          {keep.error && <Alert tone="danger">{keep.error.message}</Alert>}
          <Field id="keep-note" label="Note" required error={tried && !note.trim() ? "Write what was agreed." : undefined}>
            <TextArea id="keep-note" rows={3} aria-invalid={tried && !note.trim()} maxLength={2000} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Spoke to them on the phone; staying with the firm." />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setKeeping(false)}>Cancel</Button>
            <Button
              disabled={keep.isPending}
              onClick={() => {
                if (!note.trim()) {
                  setTried(true);
                  requestAnimationFrame(() => document.getElementById("keep-note")?.focus());
                  return;
                }
                keep.mutate({ customerId: clientId, data: { note: note.trim() } });
              }}
            >
              {keep.isPending ? "Saving…" : "Record it"}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
