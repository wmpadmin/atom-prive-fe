import { ApiError } from "@atomprive/api-client";
import {
  useAskToDeactivate,
  useListClientChecklist,
  getGetCustomerQueryKey,
  getListCustomersQueryKey,
  useGetCustomer,
  useRemoveAdvisor,
  useRemovePortfolioManager,
  type ClientChecklist,
  type ClientOnboardingStage,
  type CustomerDetail,
  type StaffMember,
} from "@atomprive/api-client/backoffice";
import { Alert, Avatar, Badge, Button, cn, Dialog, Field, StaffAvatar, TextArea } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import { Briefcase, Check, ChevronDown, ChevronLeft, PencilLine, UserRoundCog, UserX, Wallet } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useLocation, useParams } from "react-router";
import { useStaffUser } from "../../auth/session";
import { formatDate, formatRelative } from "../../lib/labels";
import { formatMobileNumber } from "../../lib/mobile-numbers";
import { hasAnyAuthority, hasAuthority, ONBOARDS_CLIENTS_CHANGE, READS_PROPOSALS, type Authority } from "../../lib/permissions";
import { ConfirmDialog } from "../config/confirm-dialog";
import { toForm } from "../onboarding/application";
import { ApplicationSummary } from "../onboarding/application-summary";
import { ProgressMeter } from "../onboarding/case-parts";
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
import { assignmentNotice, clientsHref, clientTypeLabels, kycStatusLabels, kycStatusTones, managerAssignmentNotice, oneLine } from "./client-labels";
import { ClientAccessPanel } from "./client-access-panel";
import { ClientFormsPanel } from "./client-forms-panel";

type Tab = "overview" | "family" | "advisors" | "portfolioManagers" | "banks" | "holdings" | "transactions" | "documents" | "activity";

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
  { id: "activity", label: "Activity" },
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
    const asked = (location.state as { tab?: string } | null)?.tab;
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
  const [deactivating, setDeactivating] = useState(false);
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

  const { client, advisors, portfolioManagers, family, familyInvitations, familyGroup, activity, application, onboarding } = detail.data;
  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <BackLink to={backTo} label={backLabel} />
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <Avatar name={client.fullName} photo={client.photo} className="size-14 text-base" />
            <div className="min-w-0">
              <h1 className="truncate text-[1.625rem] leading-tight font-bold">{client.fullName}</h1>
              <p className="mt-0.5 truncate text-sm text-ink-muted">
                {client.code} · {clientTypeLabels[client.type]}
                {client.email && ` · ${client.email}`}
              </p>
            </div>
          </div>
          {/* The badge on its own line, the buttons under it: they were one row, so the way into the
              portfolio sat among the holdings rather than with the client's other actions. */}
          <div className="flex flex-col items-end gap-2">
            {/* The papers on the client's file — their passport and proof of address — not the forms in
                their pack, which have statuses of their own. */}
            <Badge tone={kycStatusTones[client.kycStatus]}>
              KYC documents: {kycStatusLabels[client.kycStatus]}
            </Badge>
            <div className="flex flex-wrap items-center justify-end gap-2">
            {/* Down to it, not away to it. What the client holds, class by class against their model,
                is already on this screen under the tiles — and the button used to leave the client's
                file for a screen of its own, which is a page load and a way back for something that
                was never anywhere else. */}
            <Button
              variant="secondary"
              size="sm"
              onClick={openThePortfolio}
            >
              <Wallet aria-hidden="true" />
              Open the portfolio
            </Button>
            {/* The photograph is changed inside Edit profile, with the other two things this screen may
                change. A button of its own beside it was a third action for one field. */}
            {canEdit && (
              <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
                <PencilLine aria-hidden="true" />
                Edit profile
              </Button>
            )}
            {/* Last, and quiet. It is the one action on this screen that takes the client away from
                everybody, so it does not sit where somebody reaches for Edit profile and misses. */}
            {canAskToDeactivate && (
              <Button variant="secondary" size="sm" onClick={() => setDeactivating(true)}>
                <UserX aria-hidden="true" />
                Request deactivation
              </Button>
            )}
            </div>
          </div>
        </div>
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
              {option.label}
            </button>
          ))}
        </div>
      </header>

      {notice && <Alert tone="success">{notice}</Alert>}

      {tab === "overview" && (
        /*
         * The client's whole file on one screen, rather than ten tabs to walk through.
         *
         * <p>Overview used to be seven facts and whatever else had nowhere else to go, and everything
         * worth knowing about a client — what they hold, what has moved, which banks are linked, what
         * they have been advised, what the firm has done to them — was a tab away and a tab back. The
         * tabs are still there for depth; this is the same material laid out to be read at a glance.
         *
         * <p>Two across, not three. Who they are down the left, what is open against them on the right —
         * and what will not go in half a screen, what they hold and what they applied with, underneath
         * across the whole width, because half a screen wraps their columns into something nobody can
         * read. On a narrow screen the lot stacks in that order, which is the order somebody reads it in.
         */
        <div className="min-w-0 space-y-5">
        {/* Two across, from a narrow window up. A container query read the grid's own width instead,
            which is the more correct measure and did not take — so this is the plain one that does.
            What made the second column disappear was never the breakpoint: the holdings table below
            refused to shrink, the page grew wider than the window to fit it, and the second column was
            pushed off the side. That is fixed by the min-w-0 on this and its parent. */}
        <div className="grid min-w-0 grid-cols-1 items-start gap-5 sm:grid-cols-2">
          <Tile>
            <section className="rounded-2xl border border-line bg-white px-5 py-5">
              <h2 className="text-base font-bold">Personal profile</h2>
              {/* Down one side, then down the other — four here, three there — rather than across. Read
                  across, a pair sat on each line and the eye had to zig-zag; read down, each side is a
                  list and the two are side by side. */}
              {/* Down one side, then down the other — four here, four there — rather than across. Read
                  across, a pair sat on each line and the eye had to zig-zag; read down, each side is a
                  list and the two are side by side.

                  Who they are and how the firm reaches them down the left; what the firm has filed
                  against them down the right. */}
              <dl className="mt-4 grid grid-flow-col grid-rows-4 gap-x-5 gap-y-3">
                <Stacked label="Name">{client.fullName}</Stacked>
                {/* How the firm reaches them. Operations correct it, so it has to be readable here. */}
                <Stacked label="Mobile">
                  {formatMobileNumber(client.phone) ?? <span className="text-ink-muted">Not on the file</span>}
                </Stacked>
                <Stacked label="Email">{client.email ?? <span className="text-ink-muted">Not on the file</span>}</Stacked>
                {/* Where they live now, which is not always where they lived when they applied. */}
                <Stacked label="Address">
                  {oneLine(client.address) ?? <span className="text-ink-muted">Not on the file</span>}
                </Stacked>

                <Stacked label="Client code">
                  <span className="font-mono text-xs">{client.code}</span>
                </Stacked>
                <Stacked label="Registered">{formatDate(client.registeredAt)}</Stacked>
                <Stacked label="KYC documents">{kycStatusLabels[client.kycStatus]}</Stacked>
                <Stacked label="Last login">{formatRelative(client.lastLoginAt, "Never")}</Stacked>
              </dl>
            </section>
          </Tile>

          <Tile><BankAccountsPanel client={client} /></Tile>
          {/* No family group here. It has a tab of its own, and a table of people with their relationships,
              joining dates and accounts is not a tile: it was the one block on this page that had to be
              scrolled inside itself to be read. The way to add a spouse or a child is on that tab. */}
          {/* Five here, the rest on its own tab. The tile is a fixed height now, so a long list scrolls in it rather than stretching the line. */}
          <Tile>
            <ActivityPanel activity={activity} only={5} onViewMore={() => setTab("activity")} />
          </Tile>
          {setsAccess && <Tile><ClientAccessPanel clientId={clientId} /></Tile>}
          {readsProposals && <Tile><ProposalsPanel clientId={client.id} arrangeable={false} /></Tile>}
          {/* Where their onboarding stands: the same the case screen shows, on the client's own file,
              for whoever can open the client but not the case. What they were onboarded with is under
              everything, where there is room for it. */}
          {onboarding && (
            <Tile>
              <OnboardingStage
                stage={onboarding}
                clientId={client.id}
                advisors={advisors.map(({ advisor }) => advisor)}
                managers={portfolioManagers.map(({ manager }) => manager)}
              />
            </Tile>
          )}
          {/* Beside the onboarding, not across the foot of the screen. It carries no table yet — the
              feeds are not connected — so a line of it had the whole width to say nothing in, and left
              the place next to the onboarding empty to do it. */}
          <Tile><TransactionsPanel /></Tile>
        </div>

        {/* Across the whole screen, under the tiles. Only what will not go in half of one: the portfolio
            carries seven columns of figures and the application is a form of thirty-odd answers, and in a
            half-width column either of them wraps into something nobody can read down.

            The form pack is not among them. It is a worked screen rather than a read one — a due date
            set, a form opened, a form marked done — and it has the Documents tab to itself, where that
            work is done. Laid out here as well it was the same table twice on one file. */}
        {/* Where "Open the portfolio" lands, with a little room kept above it so the heading is not
            flush against the top of the window. */}
        <div id="portfolio" className="min-w-0 scroll-mt-4 overflow-x-auto">
          <AgainstTheModelPanel clientId={client.id} />
        </div>
        {/* The whole width, and last. It is the longest thing on the file by some way — every answer the
            client gave when they applied — and in a tile beside the others it was a hand's width of form
            with a scrollbar down it, where nothing could be read without dragging. */}
        {application && (
          <section
            aria-labelledby="application-title"
            className="min-w-0 space-y-4 rounded-2xl border border-line bg-white px-5 py-5"
          >
            <div>
              <h2 id="application-title" className="text-base font-bold">
                Application
              </h2>
              <p className="mt-0.5 text-xs text-ink-muted">
                The details this client was onboarded with.
              </p>
            </div>
            <ApplicationSummary
              application={toForm(application)}
              managers={advisors.map(({ advisor }) => advisor)}
            />
          </section>
        )}
        </div>
      )}

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

      <AskToDeactivate
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

/** Where the client's onboarding got to, read the way the onboarding case reads it. */
function OnboardingStage({ stage, advisors, managers, clientId }: {
  stage: ClientOnboardingStage;
  advisors: StaffMember[];
  managers: StaffMember[];
  clientId: string;
}) {
  // Whoever signs it off reads this notice too, and for them it is the thing to act on rather than news
  // about somebody else. Said as a sentence either way, with the way in added only for them: a link
  // offered to a reader the case screen would refuse is worse than no link.
  const signs = hasAuthority(useStaffUser(), "APPROVE_ONBOARDING:CHANGE");
  // Collecting the client's forms is one step of the case, and a pack runs to a dozen of them. The meter
  // counts the steps, so the step somebody is standing on says how far through itself it is — the figure
  // the Forms tab carries, on the tile that says that is where the case has got to.
  const checklist = useListClientChecklist<ClientChecklist, ApiError>(clientId);
  const pack = checklist.data?.forms ?? [];
  const packDone = pack.filter((form) => form.status === "SUBMITTED").length;
  // Shut to begin with. The figure is the answer most of the time; which steps it counts is the question
  // somebody asks once, and asked it on a tile that has eight other things on it.
  const [showingSteps, setShowingSteps] = useState(false);
  return (
    /* One card, like every other tile. It used to be a bare fragment, and the tile gives each of its own
       children the full height — so the notice and the facts were handed a tile apiece and the thing
       stood two and three deep. */
    <section className="space-y-4 rounded-2xl border border-line bg-white px-5 py-5">
      <h2 className="text-base font-bold">Onboarding</h2>
      {stage.signOff === "AWAITING" && (
        <Alert tone="info">
          {signs ? (
            <>
              This case is waiting on your KYC sign-off.{" "}
              <Link to={`/kyc/cases/${stage.caseId}`} className="font-semibold underline underline-offset-2">
                Open it
              </Link>
              .
            </>
          ) : (
            "This case is with Compliance for KYC sign-off."
          )}
        </Alert>
      )}
      {stage.signOff === "RETURNED" && (
        <Alert tone="warning">
          Compliance sent this back{stage.signOffComment ? `: ${stage.signOffComment}` : "."}
        </Alert>
      )}
      {stage.signOff === "APPROVED" && <Alert tone="success">Compliance have signed the KYC off.</Alert>}
      {!stage.submitted && <Alert tone="info">This application is still a draft.</Alert>}

      {/* The people first, side by side, and the dates under them — rather than all five poured down two
          columns of three. A column of names and a column of one-line dates are nothing like the same
          height, and a grid gives every row the height of the tallest thing on it: a date sat alone over
          a hand's depth of white, twice over, and the last fact was pushed off the bottom of the tile. */}
      <dl className="grid grid-cols-2 items-start gap-x-5 gap-y-5">
        {/* Who looks after them, both desks, read from the client's own assignments and not from the
            case. The case carries one relationship manager — whoever was written on the application —
            and either desk may be put on a client at any time afterwards, so that one name was both the
            wrong answer and only part of it: this client had two relationship managers within ten
            minutes of the application going in. All of them here, however many there are, under the same
            words their own tabs use. */}
        <People label="Relationship manager" people={advisors} />
        <People label="Portfolio manager" people={managers} />
        {/* A rule under the people, because what follows is the case rather than the desk. */}
        <Stacked label="Started" className="border-t border-line pt-5">
          {formatDate(stage.startedAt)}
        </Stacked>
        <Stacked label="Submitted" className="border-t border-line pt-5">
          {stage.submittedAt ? formatDate(stage.submittedAt) : "Not yet"}
        </Stacked>
        <Stacked label="Current stage">
          <span className="block">{stage.currentStage}</span>
          {/* The figure opens the list. A count with no way to ask what it counts is what put "4 of 6"
              over a client with eleven forms and let it be read as four of them. */}
          {stage.steps.length > 0 ? (
            <button
              type="button"
              aria-expanded={showingSteps}
              onClick={() => setShowingSteps((open) => !open)}
              className={"mt-2 flex items-center gap-1 rounded-md text-left "
                + "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"}
            >
              <ProgressMeter done={stage.completedSteps} total={stage.totalSteps} inWords />
              <ChevronDown
                aria-hidden="true"
                className={cn("size-3.5 text-slate-400 transition-transform", showingSteps && "rotate-180")}
              />
            </button>
          ) : (
            <ProgressMeter done={stage.completedSteps} total={stage.totalSteps} className="mt-2" inWords />
          )}
          {showingSteps && (
            <ol className="mt-2 space-y-1">
              {stage.steps.map((step, at) => (
                <li key={`${step.name}-${at}`} className="flex items-center gap-2 text-xs">
                  <span
                    aria-hidden="true"
                    className={cn(
                      "grid size-4 shrink-0 place-items-center rounded-full",
                      step.done ? "bg-emerald-500 text-white" : "border border-line bg-white",
                    )}
                  >
                    {step.done && <Check className="size-2.5" strokeWidth={3} />}
                  </span>
                  <span className={step.done ? "text-ink-soft" : "font-semibold text-ink"}>{step.name}</span>
                </li>
              ))}
            </ol>
          )}
        </Stacked>
        {/* Beside the stage rather than under its meter. The two are a pair — where the case has got to,
            and how far through the step it is standing on — and under the meter it read as a third thing
            the meter was counting. */}
        {pack.length > 0 && (
          <Stacked label="Client forms">
            {packDone} of {pack.length} complete
          </Stacked>
        )}
      </dl>
    </section>
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
 * One tile of the overview, every one the same size.
 *
 * <p>Two tries got this wrong in opposite directions. Left to their own heights the tiles finished
 * wherever their content did and the right-hand edge was ragged; stretched to match their row, every
 * short tile grew to the tallest one beside it and the screen doubled in length. So the height is fixed
 * — the profile's, which is the one the firm reads first — and a tile holding more than that scrolls
 * inside itself rather than pushing the page down.
 *
 * <p>The wide panels under the grid are not tiles and are not held to it: a table of holdings cut to a
 * tile's height would be a table read four rows at a time.
 */
function Tile({ children }: { children: ReactNode }) {
  return <div className="h-[20rem] min-w-0 [&>*]:h-full [&>*]:overflow-y-auto">{children}</div>;
}

/**
 * A desk's people, however many of them there are.
 *
 * <p>One name or five, read the same way: the heading takes the plural from the count, so a client with
 * two relationship managers is not described in the singular by the word above them.
 */
function People({ label, people, className }: { label: string; people: StaffMember[]; className?: string }) {
  return (
    <Stacked label={people.length > 1 ? `${label}s` : label} className={className}>
      {people.length === 0 ? (
        "Nobody yet"
      ) : (
        // Along the line and wrapping, not one under the next. Three names down a column is three lines
        // of tile for something read at a glance, and the tile has eight other things to hold.
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          {people.map((one) => (
            <span key={one.id} className="flex items-center gap-1.5 whitespace-nowrap">
              <StaffAvatar name={one.fullName} photo={one.photo} className="size-5 text-3xs" />
              {one.fullName}
            </span>
          ))}
        </span>
      )}
    </Stacked>
  );
}

/** One fact, label above value, for a column narrow enough that a row of them would not fit. */
function Stacked({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">{label}</dt>
      <dd className="mt-0.5 text-sm text-ink">{children}</dd>
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
  onClose,
}: {
  open: boolean;
  clientId: string;
  clientName: string;
  onClose: () => void;
}) {
  const [why, setWhy] = useState("");
  const queryClient = useQueryClient();
  const ask = useAskToDeactivate<ApiError>({
    mutation: {
      onSuccess: () => {
        setWhy("");
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
      description="This goes to the Admin to decide. Nothing changes until they approve it."
      onClose={() => {
        setWhy("");
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
        >
          <TextArea
            id="why-deactivate"
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
          <Button variant="secondary" disabled={ask.isPending} onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={ask.isPending || said.length === 0}
            onClick={() => ask.mutate({ customerId: clientId, data: { reason: said } })}
          >
            {ask.isPending ? "Sending…" : "Send it to the Admin"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
