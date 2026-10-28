import { ApiError } from "@atomprive/api-client";
import {
  useEnterWorkspace,
  useListClientRequests,
  useListModelChanges,
  useListProposalsAwaitingMyAnswer,
  useListAllocationChanges,
  useListRestores,
  type ModelChangePage,
  type MovePlanQueue,
  type ProposalPage,
  type AllocationChangeQueue,
  type RestoreQueue,
  type StaffProfile,
} from "@atomprive/api-client/backoffice";
import { cn, StaffAvatar } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import type { ComponentProps } from "react";
import { ThemeToggle } from "./components/theme-toggle";
import { TopSearch } from "./components/top-search";
import { NotificationBell } from "./components/notification-bell";
import {
  Archive,
  ArrowLeftRight,
  BellRing,
  ChevronDown,
  ClipboardCheck,
  Clock,
  Contact,
  Eye,
  FileCheck,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  KeyRound,
  Landmark,
  Layers,
  ListChecks,
  LogOut,
  Mail,
  PenLine,
  Radio,
  Scale,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Stamp,
  TrendingUp,
  TriangleAlert,
  type LucideIcon,
  Users,
  UsersRound,
  UserX,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router";
import { useSession, useStaffUser } from "./auth/session";
import { MENU_ORDER } from "./menu-order";
import { hasAnyAuthority, hasAuthority, ANSWERS_MOVE_PLANS, ONBOARDS_EVERY_CLIENT, READS_CLIENT_PORTFOLIOS, READS_PROPOSALS, SIGNS_CLIENT_FORMS, UPLOADS_CLIENT_DOCUMENTS, type Authority } from "./lib/permissions";
import { roleLabels, type StaffRole } from "./lib/labels";

// Menu items appear as their screens are built; each is hidden from people the permission matrix doesn't allow (#75, #85).
// A null authority is a screen everyone signed in can reach, such as their own declarations.
//
// `notFor` keeps a screen off a role's menu even where the matrix would allow it. The Admin runs the platform
// rather than the firm's clients: they hold every permission so that nothing is ever locked away from them,
// but servicing a client is Operations', Advisory's and Compliance's work, and their menu says so.
/** The Notice of Treatment letter, which is a client's document but is only ever opened from the notice. */
const NOTICE_OF_TREATMENT = /^\/clients\/[^/]+\/documents\/NOTICE_OF_TREATMENT$/;

/**
 * Which queue a shared screen was opened from, as that screen's own back link reads it.
 *
 * <p>A client's portfolio and a proposal are each reached from several queues and are the same address from
 * all of them, so the path alone cannot say which menu they belong to. Somebody working the drift queue who
 * opens a client is still working the drift queue; lighting up Clients tells them they have left it.
 */
function openedFrom(search: string) {
  return new URLSearchParams(search).get("from");
}

/** A screen of its own, or a shared one opened from this entry's queue. */
function ownsSharedScreen(path: string, search: string, shared: RegExp, from: string) {
  return shared.test(path) && openedFrom(search) === from;
}

/**
 * The entry a shared screen falls back to: where the thing lives, rather than where somebody came from. Only
 * a queue that claims the screen takes it away — a proposal read from a client's own file is still a sent
 * proposal, and that is the menu it belongs on, even though Back there returns to the client.
 */
function livesHere(path: string, search: string, shared: RegExp, claimedBy: string[]) {
  return shared.test(path) && !claimedBy.includes(openedFrom(search) ?? "");
}

const A_PORTFOLIO = /^\/portfolio-clients\/[^/]+$/;

const A_PROPOSAL = /^\/proposals\/[^/]+$/;

/**
 * A client's own KYC file. It is opened from three screens — the review queue to see why a client is not
 * ready, the document review to decide on what they sent, and Client documents to add to their file — so
 * none of them owns it outright and each says in its query which one it is.
 */
const A_CLIENT_KYC = /^\/kyc\/[^/]+(\/documents\/[^/]+)?$/;

/**
 * The Admin's own menu, as the firm drew it.
 *
 * <p>An Admin runs the platform rather than the book of clients, so the client and portfolio screens are not
 * theirs even where the permission matrix would let them in: holding VIEW_CUSTOMER_PROFILE so that staff
 * administration works is not the same as having a reason to read the firm's models and drift.
 *
 * <p>Written out rather than filtered down, so that a screen added later does not quietly appear here, and in
 * the order the firm listed it rather than the order the rest of the menu happens to be in. It is the whole
 * answer for an Admin: the rules that hide a screen from them elsewhere do not apply, because this list has
 * already said what they get. An entry is still only shown where the Admin's permissions allow it, so
 * narrowing the matrix narrows this too.
 */
const ADMINS_MENU: { to: string; label?: string; under?: string }[] = [
  { to: "/users" },
  // The client directory, which is where a relationship manager is put on a client. An Admin is given it for
  // that job and the menu says so: the screen is the same one Operations and Compliance read.
  { to: "/clients", label: "Assign relationship managers" },
  // Deciding whether the firm stops acting for a client, and the clients it has stopped acting for. Both
  // are the Admin's alone: nobody else may answer a request, and nobody else may see an archived client.
  { to: "/deactivation-requests" },
  { to: "/archived-clients" },
  { to: "/kyc-documents" },
  // What the firm may do and what it runs on, before the people who do it: the Admin's own order puts
  // the permission matrix and the configuration above the staff they apply to.
  { to: "/roles" },
  { to: "/config" },
  { to: "/staff-tracker" },
  // The declarations register is reached from under the tracker rather than from the menu's top level: it is
  // one of the things being tracked, not a heading of its own.
  { to: "/staff-declarations", under: "/staff-tracker" },
  // The narrower read before the wider one: family access is one question asked of the trail, and the
  // audit log is every question at once.
  { to: "/family-access-trail" },
  { to: "/audit-log" },
  // An Admin signs the same nine as everybody else. Their menu is written out rather than filtered down, so
  // their own declarations had to be written into it or they had no way to them at all — the screen was
  // open to them the whole time, with nothing on the menu pointing at it.
  { to: "/my-declarations" },
  { to: "/settings" },
];

const allNavigation: {
  to: string;
  label: string;
  icon: LucideIcon;
  authority: Authority | Authority[] | null;
  notFor?: StaffRole[];
  /** Where an entry belongs to particular roles rather than to whoever holds the permission. */
  onlyFor?: StaffRole[];
  /** The entry this one sits under, where it is one of the things that entry gathers rather than its own heading. */
  under?: string;
  /**
   * Which screens this entry is the menu for, where the path alone does not say. The two KYC screens share
   * the /kyc prefix: the queue owns a case and a form opened from it, the document review owns a client's
   * own file, which is reached from there. Left out, an entry owns its path and whatever hangs off it.
   *
   * <p>The address is given in full, because a screen shared between queues says which queue it was opened
   * from in its query rather than in its path.
   */
  at?: (path: string, search: string) => boolean;
}[] = [
  // The Dashboard is off every role's menu at the firm's request. Taken off the menu rather than out of
  // the codebase: the screen and its route are untouched, so putting it back is this entry and nothing
  // else. Nobody lands on it — HomePage sends each role to its own first screen and falls through to a
  // welcome card, never here — so hiding it strands no one.
  {
    to: "/clients",
    label: "All clients",
    icon: Contact,
    authority: "VIEW_ALL_CLIENTS:VIEW",
    // A relationship manager onboards from the whole book, but reads in full only the clients assigned to
    // them, which is My clients. A second screen onto every client would say otherwise.
    notFor: ["ADMIN", "ADVISOR", "PORTFOLIO_MANAGER"],
    at: (path) => (path === "/clients" || path.startsWith("/clients/")) && !NOTICE_OF_TREATMENT.test(path),
  },
  {
    // The same clients, set out for portfolio work rather than for servicing the account.
    to: "/portfolio-clients",
    label: "Clients",
    icon: Contact,
    authority: "VIEW_ALL_CLIENTS:VIEW",
    onlyFor: ["PORTFOLIO_MANAGER"],
    // A portfolio opened from a queue belongs to that queue's menu, not to this one.
    at: (path, search) =>
      path === "/portfolio-clients" || livesHere(path, search, A_PORTFOLIO, ["drift", "dashboard"]),
  },
  {
    to: "/model-portfolios",
    label: "Model portfolios",
    icon: Layers,
    authority: READS_CLIENT_PORTFOLIOS,
    onlyFor: ["PORTFOLIO_MANAGER"],
  },
  {
    to: "/drift",
    label: "Drift & deviations",
    at: (path, search) => path === "/drift" || ownsSharedScreen(path, search, A_PORTFOLIO, "drift"),
    icon: TriangleAlert,
    authority: READS_CLIENT_PORTFOLIOS,
    onlyFor: ["PORTFOLIO_MANAGER"],
  },
  {
    to: "/bulk-rebalancing",
    label: "Bulk rebalancing",
    icon: Scale,
    authority: READS_CLIENT_PORTFOLIOS,
    onlyFor: ["PORTFOLIO_MANAGER"],
  },
  {
    // How the plans themselves are doing, which is a different question from how any one client is doing.
    to: "/model-performance",
    label: "Model performance",
    icon: TrendingUp,
    authority: READS_CLIENT_PORTFOLIOS,
    onlyFor: ["PORTFOLIO_MANAGER"],
  },
  {
    to: "/reports",
    label: "Reports",
    icon: FileSpreadsheet,
    authority: READS_CLIENT_PORTFOLIOS,
    onlyFor: ["PORTFOLIO_MANAGER"],
  },
  // Six queues were six entries, and two of them were in no menu group at all — the figures queue and the
  // model sign-off could only be reached by a notification link or a typed address. They are one job done
  // six ways: something is waiting, and somebody other than whoever raised it says yes or no. So they are
  // one screen with a tab each, and one entry here.
  {
    to: "/approvals",
    label: "Approvals",
    icon: Stamp,
    authority: [...ANSWERS_MOVE_PLANS, ...READS_PROPOSALS, ...READS_CLIENT_PORTFOLIOS],
    // Nor Compliance's. They hold no answering permission on any of its queues, so every row there was
    // one they could read and not press — and what became of each is on Trails, client by client.
    notFor: ["ADMIN", "COMPLIANCE"],
    // A proposal, or one client's moves, opened from here is read here: this is where they live now.
    at: (path, search) => path === "/approvals"
      // Not one opened from Trade logs. A bulk rebalance is read and answered there, and the two screens
      // show different halves of the same table — so the highlight follows the door somebody came in by.
      || livesHere(path, search, A_PROPOSAL, ["client", "trade-logs"])
      || path.startsWith("/moves-to-approve/"),
  },
  // Both desks. The portfolio desk raises these and places them; the relationship managers answer them,
  // and this is the only screen either of them is shown one on.
  {
    to: "/trade-logs",
    label: "Trade logs",
    icon: ArrowLeftRight,
    authority: READS_PROPOSALS,
    // Not Compliance's. What this screen showed them — every bulk rebalance the firm agreed — is the
    // Trades trail now, grouped by the client it happened to and carrying the legs it was made of.
    // The desks keep it: they raise and place these, and read them here while the work is live.
    notFor: ["COMPLIANCE"],
    at: (path, search) => path === "/trade-logs" || path === "/trade-orders"
      || (A_PROPOSAL.test(path) && openedFrom(search) === "trade-logs"),
  },
  {
    to: "/post-onboarding",
    label: "Post onboarding notice",
    icon: BellRing,
    // Every client's pack, so it stays with Operations. A relationship manager onboarding their own clients
    // does not thereby follow what every other client is owed.
    authority: ONBOARDS_EVERY_CLIENT,
    notFor: ["ADMIN"],
    at: (path) => path === "/post-onboarding" || NOTICE_OF_TREATMENT.test(path),
  },
  { to: "/to-sign", label: "To sign", icon: PenLine, authority: SIGNS_CLIENT_FORMS },
  // The queue is where a client's KYC is signed off, which is Compliance's alone. The papers themselves the
  // Admin reads too, so the document review sits on both menus.
  {
    to: "/kyc",
    // Signing a client's KYC off is Compliance's, and so is the screen: Operations follow a case from Client
    // onboarding, which is their own.
    label: "KYC review queue",
    icon: ShieldCheck,
    authority: "APPROVE_ONBOARDING:CHANGE",
    notFor: ["ADMIN"],
    at: (path, search) =>
      path === "/kyc" || path.startsWith("/kyc/cases/") || path.startsWith("/kyc/forms/")
      || ownsSharedScreen(path, search, A_CLIENT_KYC, "queue"),
  },
  {
    to: "/kyc-documents",
    label: "KYC document review",
    icon: FileCheck2,
    authority: "APPROVE_ONBOARDING:CHANGE",
    // A client's own KYC file hangs off /kyc and is opened from here, so this is the menu it belongs to —
    // unless it was opened from the review queue, which says so in its query.
    at: (path, search) =>
      path.startsWith("/kyc-documents") || livesHere(path, search, A_CLIENT_KYC, ["queue", "documents"]),
  },
  {
    // What the KYC waits on, kept by the people who wait on it. Compliance's own screen: the lists were
    // constants in the code, so a fourth paper or a dropped one was a release.
    to: "/kyc-checklist",
    label: "What KYC asks for",
    icon: ListChecks,
    authority: "APPROVE_ONBOARDING:CHANGE",
    notFor: ["ADMIN"],
  },
  {
    to: "/client-documents",
    label: "Client documents",
    icon: FolderOpen,
    // Whoever puts a client's papers on file, and nobody else. This read OPENS_CLIENT_DOCUMENTS once,
    // which let Compliance in on the strength of APPROVE_ONBOARDING — a third door into the same client
    // KYC file beside their queue and their document review. Compliance decide on these papers from
    // those two screens; this one is where the papers come from, so it belongs to the desks that collect
    // them. The two reviews are guarded on APPROVE_ONBOARDING:CHANGE, which an RM does not hold at all
    // and Operations holds only as VIEW_ONLY — so without this entry neither desk could reach the client
    // file they are the only ones allowed to add to.
    authority: UPLOADS_CLIENT_DOCUMENTS,
    notFor: ["ADMIN"],
    // A client's file opened from here stays here on the menu, as it does for the review queue. Without
    // this it lit the document review instead — a screen the reader had not been on.
    at: (path, search) =>
      path === "/client-documents" || ownsSharedScreen(path, search, A_CLIENT_KYC, "documents"),
  },
  {
    to: "/deactivation-requests",
    label: "Deactivation requests",
    icon: UserX,
    // Whoever may answer one, which is the Admin and nobody else — the same authority the API's approve
    // and reject endpoints ask for, so the menu offers exactly what the screen admits.
    authority: "MANAGE_USERS_AND_ROLES:CHANGE",
  },
  {
    to: "/archived-clients",
    label: "Archived clients",
    icon: Archive,
    authority: "MANAGE_USERS_AND_ROLES:CHANGE",
  },
  // Client risk (AML) is off every role's menu at the firm's request, with the risk matrix that sat
  // under it. Taken off the menu rather than out of the codebase: both screens, their routes and the
  // permissions that guard them are untouched, so putting them back is these two entries.
  // The AML risk matrix is off the menu at the firm's request, the same way as the Dashboard above: the
  // screen, its route and its permission are untouched, and Client risk (AML) stays where it was. What
  // went is the sheet underneath it, not client risk itself.
  { to: "/forms", label: "Forms", icon: FileText, authority: "FILL_CLIENT_FORMS:VIEW", notFor: ["ADMIN"] },
  // The register of everybody's, which is the Admin's alone: staff declarations are administration of the
  // staff, like creating them and setting what they may do. It is reached from under the staff tracker, so
  // the Admin's menu says where it is; here it is the entry that screen is drawn from.
  {
    to: "/staff-declarations",
    label: "Staff declarations",
    icon: ClipboardCheck,
    authority: "VIEW_STAFF_DECLARATIONS:VIEW",
    onlyFor: ["ADMIN"],
  },
  // An Admin's own screen, which gathers what the firm is waiting on from its staff.
  {
    to: "/staff-tracker",
    label: "Staff tracker",
    icon: Clock,
    authority: "VIEW_STAFF_DECLARATIONS:VIEW",
    onlyFor: ["ADMIN"],
  },
  { to: "/users", label: "Manage staff users", icon: Users, authority: "MANAGE_USERS_AND_ROLES:VIEW" },
  { to: "/roles", label: "Permission matrix", icon: ShieldCheck, authority: "MANAGE_USERS_AND_ROLES:VIEW" },
  { to: "/config", label: "Config data", icon: SlidersHorizontal, authority: "MANAGE_CONFIGURATION:VIEW" },
  {
    to: "/ingestion",
    label: "Ingestion monitoring",
    icon: Radio,
    authority: "MANAGE_BANK_FEEDS:CHANGE",
    // The run log hangs off the feeds screen: it is the same subject, read run by run.
    at: (path) => path.startsWith("/ingestion") || path.startsWith("/bank-syncs"),
  },
  { to: "/sync-errors", label: "Sync errors", icon: TriangleAlert, authority: "MANAGE_BANK_FEEDS:CHANGE" },
  { to: "/notifications", label: "Notification log", icon: Mail, authority: "MANAGE_CONFIGURATION:VIEW" },
  { to: "/audit-log", label: "Audit log", icon: Landmark, authority: "VIEW_AUDIT_LOG:VIEW" },
  // Beside the audit log rather than inside it. "Who has been reading whose money" is a question somebody
  // comes to the screen already holding, and finding it meant knowing to filter the whole trail by a
  // prefix nobody would guess.
  { to: "/family-access-trail", label: "Family access trail", icon: Eye, authority: "VIEW_AUDIT_LOG:VIEW" },
  // Four trails that were four places, or in two cases no place at all.
  { to: "/trails", label: "Trails", icon: UsersRound, authority: "VIEW_AUDIT_LOG:VIEW" },
  { to: "/my-declarations", label: "My declarations", icon: FileCheck, authority: null },
  // The clients assigned to this relationship manager: the whole book is not theirs, and this is the part that is.
  {
    to: "/my-clients",
    label: "Assigned customers",
    icon: Contact,
    authority: "VIEW_CUSTOMER_PROFILE:OWN_CLIENTS",
  },
  // Somebody's own account, which everybody signed in has one of.
  {
    // The firm's portfolio rules. Named apart from Settings below, which is a person's own account.
    to: "/portfolio-settings",
    label: "Portfolio settings",
    icon: SlidersHorizontal,
    authority: READS_CLIENT_PORTFOLIOS,
    onlyFor: ["PORTFOLIO_MANAGER"],
  },
  // Somebody's own account. Off the portfolio desk's menu at the firm's asking; switching role, changing
  // a password and signing out are all on the profile menu at the top of every screen, so nothing they
  // need has gone with it.
  { to: "/settings", label: "Settings", icon: Settings, authority: null, notFor: ["PORTFOLIO_MANAGER"] },
];

/** Whether an entry is the one being read, which it is for its own address and whatever hangs off it. */
function isHere(item: { to: string; at?: (path: string, search: string) => boolean }, pathname: string,
  search: string) {
  return item.at ? item.at(pathname, search) : pathname === item.to || pathname.startsWith(`${item.to}/`);
}

const ENTRY_CLASS = "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors";

/**
 * One entry in the menu, with whatever sits under it.
 *
 * <p>What an entry gathers is always shown. It was collapsible once, and the arrow that did it was the only
 * way to reach the things underneath — a menu that hides its own contents behind a control nobody thinks to
 * press is a menu with screens nobody finds. An entry that gathers nothing is a link and nothing else.
 */
/**
 * How many things are waiting on this person behind a menu entry, where the entry is a queue.
 *
 * <p>Asked here rather than passed down from the menu, because only the entry knows which queue it is and
 * only the queues have a count worth showing. Everything else answers nought and draws nothing.
 */
function useWaitingOn(to: string) {
  // The four queues are one entry now, so the figure beside it is everything waiting on this person
  // rather than one queue's share of it. A reader who sees 7 opens the screen and the tabs say where the
  // seven are; four separate numbers down the menu said the same thing and made them add it up.
  const queue = to === "/approvals";
  const restores = useListRestores<RestoreQueue, ApiError>({
    query: { enabled: queue, refetchOnWindowFocus: true },
  });
  const figures = useListAllocationChanges<AllocationChangeQueue, ApiError>({
    query: { enabled: queue, refetchOnWindowFocus: true },
  });
  // The other three queues on that screen. They were left out when the entries were merged, so the
  // number beside it counted four of seven — a reader could open it on the strength of a 2 and find a
  // third thing they had not been counted.
  const clientRequests = useListClientRequests<MovePlanQueue, ApiError>({
    query: { enabled: queue, refetchOnWindowFocus: true },
  });
  const proposals = useListProposalsAwaitingMyAnswer<ProposalPage, ApiError>({ page: 0, size: 1 },
    { query: { enabled: queue, refetchOnWindowFocus: true } });
  const modelChanges = useListModelChanges<ModelChangePage, ApiError>({ status: "PENDING", page: 0, size: 1 },
    { query: { enabled: queue, refetchOnWindowFocus: true } });
  if (!queue) {
    return 0;
  }
  // A queue this reader may not open answers nothing rather than erroring, so a count that never
  // arrives simply adds nought.
  return (restores.data?.waiting ?? []).length
    + (figures.data?.waiting ?? []).length
    + (clientRequests.data?.waiting ?? []).length
    + (proposals.data?.totalItems ?? 0)
    // Waiting on this reader, not visible to them: a bell that counts somebody else's work sends
    // people to a queue with nothing in it for them.
    + (modelChanges.data?.waitingOnYou ?? 0);
}

/** Yours rather than a desk's. Where each goes inside a workspace is decided below, and they differ. */
const MY_DECLARATIONS = "/my-declarations";

const SETTINGS = "/settings";

/**
 * The menu, grouped by the workspaces this person holds.
 *
 * <p>One open at a time, and the open one is always the workspace they are working in — because the menu
 * can only ever be the active role's. What a role may open is decided by the permissions the API sends,
 * and it sends the active role's alone; the browser does not know what the others could see. So a closed
 * group is not a list waiting to be unfolded, it is a door: pressing it enters that workspace, and the
 * menu that comes back is that role's.
 *
 * <p>Somebody holding one role has no groups at all. A heading over the only list there is would be a
 * word that never changes and never answers anything.
 */
function RoleGroups({ user, items, pathname, search }: {
  user: StaffProfile;
  /** The entries this reader may open, already filtered and ordered — the same ones NavEntry draws. */
  items: ComponentProps<typeof NavEntry>["item"][];
  pathname: string;
  search: string;
}) {
  const queryClient = useQueryClient();
  const { applyProfile } = useSession();
  const navigate = useNavigate();
  const enter = useEnterWorkspace<ApiError>({
    mutation: {
      onSuccess: (profile) => {
        // Three things, and leaving any one of them out leaves the screen lying. The cache belongs to the
        // role being left; the profile in hand still says the old role is the active one, so the menu would
        // redraw exactly as it was; and the screen underneath belongs to a workspace this reader has just
        // walked out of, which the API will now refuse them.
        queryClient.clear();
        applyProfile(profile);
        navigate("/", { replace: true });
      },
    },
  });

  const declarations = items.find((item) => item.to === MY_DECLARATIONS);
  const settings = items.find((item) => item.to === SETTINGS);
  const desk = items.filter((item) => item.to !== MY_DECLARATIONS && item.to !== SETTINGS);
  /**
   * The workspace this person calls home — the Admin's choice, or their own from Settings.
   *
   * <p>Their declarations hang off it and nowhere else. They are owed once by the person, not once by each
   * desk they sit at, and repeating them under every role would say the opposite.
   */
  const home = user.opensIn ?? (user.roles.length === 1 ? user.roles[0] : null);
  /**
   * The workspace being worked in, first; the rest after it in the order they are held.
   *
   * <p>It is the only one with anything under it, and left in its own place it could open halfway down the
   * sidebar with its screens running off the foot of the window — so the list began with four headings and
   * the work was below the fold.
   */
  const active = user.activeRole;

  if (user.roles.length < 2 || active === null) {
    return (
      <ul className="h-full space-y-1 overflow-y-auto">
        {items.map((item) => (
          <NavEntry key={item.to} item={item} pathname={pathname} search={search} />
        ))}
      </ul>
    );
  }

  const header = (role: StaffRole, here: boolean) => (
    <button
      key={role}
      type="button"
      aria-expanded={here}
      disabled={enter.isPending}
      onClick={() => {
        if (here) return;
        enter.mutate({ data: { role, fromNowOn: false } });
      }}
      className={cn(
        "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-2xs font-bold tracking-wider uppercase",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600",
        here ? "text-primary-700" : "text-ink-muted hover:bg-white/60 hover:text-ink",
        enter.isPending && !here && "cursor-wait",
      )}
    >
      <ChevronDown
        aria-hidden="true"
        className={cn("size-3 shrink-0 transition-transform", here ? "" : "-rotate-90")}
      />
      <span className="min-w-0 flex-1 truncate">{roleLabels[role]}</span>
    </button>
  );

  /*
   * Three bands, and only the middle one moves. The open workspace's name is held at the top, its screens
   * scroll between, and the other workspaces are held at the foot — so however long a desk's list runs,
   * both the name of the desk you are at and the way to every other one stay on screen. Scrolled, they
   * were a heading that left the top and four headings that could only be reached by going to the bottom
   * of somebody else's menu.
   */
  return (
    <div className="flex h-full min-h-0 flex-col">
      {header(active as StaffRole, true)}

      {/* Shrinks to fit, never grows to fill. Told to grow, a short desk's list stretched to the foot of
          the window and left a hand's depth of white between its last screen and the workspaces under it.
          Left to its own height it ends where its screens end, and only a list taller than the window is
          cut down to what is left and scrolled. */}
      <ul className="mt-1 ml-[1.0625rem] min-h-0 space-y-1 overflow-y-auto border-l border-line pl-2">
        {desk.map((item) => (
          <NavEntry key={item.to} item={item} pathname={pathname} search={search} />
        ))}
        {/* Only in the workspace they open in. One person owes one set of declarations. */}
        {active === home && declarations && (
          <NavEntry item={declarations} pathname={pathname} search={search} />
        )}
        {/* In every one of them: what somebody may change about their own account is theirs at whichever
            desk they happen to be sitting at. */}
        {settings && <NavEntry item={settings} pathname={pathname} search={search} />}
      </ul>

      {/* Faint. It is there to say the workspaces below are held still, not to cut the sidebar in two. */}
      <div className="mt-2 shrink-0 space-y-1 border-t border-line/50 pt-2">
        {user.roles.filter((role) => role !== active).map((role) => header(role as StaffRole, false))}
      </div>
    </div>
  );
}

function NavEntry({
  item,
  pathname,
  search,
  locked,
}: {
  item: {
    to: string;
    label: string;
    icon: LucideIcon;
    at?: (path: string, search: string) => boolean;
    below: { to: string; label: string; icon: LucideIcon; at?: (path: string, search: string) => boolean }[];
  };
  pathname: string;
  search: string;
  /**
   * Shown, named, and not a way in. A session's screens are listed beside the one being shown so the
   * room can see where what they are being shown sits in the whole — which is a different thing from
   * letting somebody wander into a session nobody is talking about.
   */
  locked?: boolean;
}) {
  const Icon = item.icon;
  const here = isHere(item, pathname, search);
  const waiting = useWaitingOn(item.to);

  if (locked) {
    return (
      <li>
        <span
          aria-disabled="true"
          className={cn(ENTRY_CLASS, "cursor-default text-ink-muted/55 select-none")}
        >
          <Icon className="size-4.5 shrink-0" aria-hidden="true" />
          {item.label}
        </span>
      </li>
    );
  }

  return (
    <li>
      <div className="flex items-center">
        {/* A plain link, not a NavLink: NavLink decides "active" from the path by itself and overrides the
            aria-current given to it, so it lit one entry and told a screen reader a different one — a
            client's file read as the KYC queue because /kyc is the start of /kyc/{id}. These entries work
            out where they are themselves, and both the highlight and what is announced follow that. */}
        <Link
          to={item.to}
          aria-current={here ? "page" : undefined}
          className={cn(
            ENTRY_CLASS,
            "flex-1",
            here ? "bg-primary-100 font-semibold text-ink" : "text-ink-soft hover:bg-white",
          )}
        >
          <Icon className="size-4.5" aria-hidden="true" />
          <span className="min-w-0 flex-1">{item.label}</span>
          {/* How many are waiting, where the entry is a queue. A queue reached by remembering to look at it
              is a queue people stop looking at; the number is what makes somebody open it on the day there
              is something in it, and its absence is what lets them leave it alone on the days there is not. */}
          {waiting > 0 && (
            <span className="shrink-0 rounded-full bg-primary-600 px-1.5 py-0.5 text-2xs font-semibold tabular-nums text-white">
              {waiting}
            </span>
          )}
        </Link>
      </div>
      {item.below.length > 0 && (
        <ul className="mt-1 space-y-1 border-l border-line pl-3 ml-5">
          {item.below.map((under) => {
            const UnderIcon = under.icon;
            const onIt = isHere(under, pathname, search);
            return (
              <li key={under.to}>
                <Link
                  to={under.to}
                  aria-current={onIt ? "page" : undefined}
                  className={cn(
                    ENTRY_CLASS,
                    onIt ? "bg-primary-100 font-semibold text-ink" : "text-ink-soft hover:bg-white",
                  )}
                >
                  <UnderIcon className="size-4" aria-hidden="true" />
                  {under.label}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}

export function AppLayout() {
  const user = useStaffUser();
  const { pathname, search } = useLocation();
  const permitted = (item: (typeof allNavigation)[number]) =>
    item.authority === null ||
    (Array.isArray(item.authority) ? hasAnyAuthority(user, ...item.authority) : hasAuthority(user, item.authority));
  const navigation =
    user.activeRole === "ADMIN"
      ? ADMINS_MENU.flatMap((entry) =>
          allNavigation
            .filter((item) => item.to === entry.to && permitted(item))
            .map((item) => ({ ...item, label: entry.label ?? item.label, under: entry.under })),
        )
      : allNavigation.filter(
          (item) =>
            !(user.activeRole && item.notFor?.includes(user.activeRole)) &&
            (!item.onlyFor || (user.activeRole != null && item.onlyFor.includes(user.activeRole))) &&
            permitted(item),
        );

  // An entry and whatever sits under it, so the menu is drawn as the sections it actually has.
  const sections = navigation
    .filter((item) => !item.under)
    .map((item) => ({ ...item, below: navigation.filter((under) => under.under === item.to) }));

  /*
   * While a session is being shown, the menu is that session: named, its screens under it, in the order
   * they are walked through — the session's order and not the menu's, because the point of it is to be
   * a route somebody can follow.
   *
   * Its screens are not all a way in. The ones being walked through are links; the rest of the story is
   * drawn and goes nowhere, so the room can see that what they are being shown has a beginning and an
   * end beyond it. Shown only the four, a sidebar of four says the platform is four screens wide.
   *
   * A screen being walked through is one this reader would have had anyway: their role may open it, or
   * it is not a link, because a way in that refuses them is worse than no way in. The ones only being
   * shown come from the whole list instead — a name and an icon that go nowhere and fetch nothing.
   * Drawn from one account's access, the map would be a map of that account's permissions.
   */
  /*
   * The menu as one list, in the order the work is actually done rather than the order the entries
   * happen to be declared in.
   *
   * <p>One list rather than three folded sections. Folded, a reader who knew the name of the screen they
   * wanted still had to guess which section the firm had filed it under, and open it to find out.
   *
   * <p>Anything the order does not name is drawn after the ones it does, rather than dropped. A menu
   * built only from a hand-written list loses a screen the day somebody adds one and forgets to write it
   * down, which has happened here: two approval queues existed, worked, and could be reached by nothing
   * but a typed address.
   *
   * <p>Only what this reader may open, as before — the order arranges the menu they already had rather
   * than offering screens they cannot reach.
   */
  const named = MENU_ORDER
    .map((route) => sections.find((item) => item.to === route))
    .filter((item) => item !== undefined);
  const items = [...named, ...sections.filter((item) => !MENU_ORDER.includes(item.to))];

  return (
    <div className="flex min-h-screen bg-canvas font-sans text-ink">
      <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col border-r border-line bg-sidebar px-4 py-6">
        {/* Scrolls on its own rather than with the page: the whole menu is on screen at once now, and on
            a short window the foot of it has to be reachable without the sidebar's own status panel
            sliding away under it. */}
        {/* The menu does its own scrolling now: the workspace headings are held still and only the screens
            between them move, which it cannot do if the whole menu scrolls as one. */}
        <nav aria-label="Back-office" className="mt-14 flex min-h-0 flex-1 flex-col overflow-hidden">
          <RoleGroups user={user} items={items} pathname={pathname} search={search} />
        </nav>

      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-20 items-center justify-between gap-4 px-8">
          <p className="text-2xl font-bold">{user.activeRole ? roleLabels[user.activeRole] : ""}</p>
          <div className="flex items-center gap-3">
            <TopSearch />
            <div className="flex items-center gap-1">
              <ThemeToggle />
              <NotificationBell />
              <UserMenu />
            </div>
          </div>
        </header>
        <main className="flex-1 px-8 pb-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function UserMenu() {
  const user = useStaffUser();
  const { signOut } = useSession();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex items-center gap-3 rounded-xl py-1.5 pr-2 pl-3 hover:bg-white"
      >
        <span className="text-right leading-tight">
          <span className="block text-sm font-semibold">{user.fullName}</span>
          <span className="block text-xs text-ink-muted">{user.activeRole ? roleLabels[user.activeRole] : ""}</span>
        </span>
        <StaffAvatar name={user.fullName} photo={user.photo} className="size-10" />
        <ChevronDown className="size-4 text-ink-muted" aria-hidden="true" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-10 mt-2 w-52 rounded-xl border border-line bg-white p-1.5 shadow-lg">
          {user.roles.length > 1 && (
            <Link
              role="menuitem"
              to="/workspace"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-ink-soft hover:bg-slate-50"
            >
              <ArrowLeftRight className="size-4" aria-hidden="true" />
              Switch role
            </Link>
          )}
          <Link
            role="menuitem"
            to="/change-password"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-ink-soft hover:bg-slate-50"
          >
            <KeyRound className="size-4" aria-hidden="true" />
            Change password
          </Link>
          <button
            role="menuitem"
            type="button"
            onClick={() => void signOut()}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-ink-soft hover:bg-slate-50"
          >
            <LogOut className="size-4" aria-hidden="true" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
