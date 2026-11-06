import {
  Archive,
  LayoutDashboard,
  ArrowLeftRight,
  BellRing,
  ClipboardCheck,
  UserMinus,
  Clock,
  Contact,
  Eye,
  FileCheck,
  FileCheck2,
  ChartNoAxesColumn,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  LifeBuoy,
  Landmark,
  Layers,
  ListChecks,
  Mail,
  Radio,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  SlidersHorizontal,
  Stamp,
  TrendingUp,
  TriangleAlert,
  UserX,
  UserPlus,
  Users,
  UsersRound,
  Scale,
  KeyRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  hasAnyAuthority,
  hasAuthority,
  ANSWERS_MOVE_PLANS,
  ONBOARDS_EVERY_CLIENT,
  READS_AML_RISK,
  READS_CLIENT_PORTFOLIOS,
  READS_PROPOSALS,
  UPLOADS_CLIENT_DOCUMENTS,
  type Authority,
} from "./lib/permissions";
import { MENU_ORDER } from "./menu-order";
import type { StaffProfile } from "@atomprive/api-client/backoffice";
import type { StaffRole } from "./lib/labels";

/**
 * The back office's menu: every screen it has, who may open each one, and the order the firm reads them in.
 *
 * <p>Its own file rather than the sidebar's, because it is asked for in two places now. The sidebar draws
 * it, and Settings offers it as the list of screens somebody may choose to open on — and that second
 * reader has to be given the same list as the first, or a reader lands on a screen their role is then
 * bounced off, straight back to a home screen that sends them to it again.
 */

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
  { to: "/dashboard" },
  { to: "/users" },
  // Prospects and clients together, as one section: its overview, the prospects being followed up, and
  // the client directory below them.
  { to: "/client-management" },
  { to: "/prospective-clients", under: "/client-management" },
  // The client directory, the same screen Operations and Compliance read, under the name they read it by.
  // It was called "Assign relationship managers" after the one job an Admin was given it for; an entry
  // naming one job on a screen that does all of them sends a reader looking for a second entry that does
  // not exist. The screen is theirs in full - putting a relationship manager on a client is one of the
  // things done on it, not the whole of it.
  { to: "/clients", under: "/client-management" },
  // Deciding whether the firm stops acting for a client, and the clients it has stopped acting for. Both
  // are the Admin's alone: nobody else may answer a request, and nobody else may see an archived client.
  { to: "/deactivation-requests", under: "/client-management" },
  { to: "/archived-clients", under: "/client-management" },
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
  // Asked for on 4 Nov 2026 so the dashboard's links have somewhere to go: the approval queues, the portfolio
  // reports and the bank feeds, each opened as the screen the desk that works it already uses.
  { to: "/approvals" },
  { to: "/reports" },
  { to: "/ingestion", label: "Bank feeds" },
  { to: "/family-access-trail" },
  { to: "/audit-log" },
  // An Admin signs the same nine as everybody else. Their menu is written out rather than filtered down, so
  // their own declarations had to be written into it or they had no way to them at all — the screen was
  // open to them the whole time, with nothing on the menu pointing at it.
  { to: "/my-clearances", under: "/client-management" },
  { to: "/my-declarations" },
  { to: "/support" },
  { to: "/assistant" },
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
  // The Dashboard was off every role's menu at the firm's request; it is back for every desk, whose dashboards the firm asked for on 4 Nov 2026. Other roles' dashboards come back one at a time as each is
  // agreed, by adding their role here.
  {
    to: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    // Each role's dashboard asks the server only for what that role reads, so the entry itself asks for nothing.
    authority: null,
    onlyFor: ["ADMIN", "COMPLIANCE", "OPERATIONS", "ADVISOR", "PORTFOLIO_MANAGER", "IT_ADMIN"],
  },
  {
    // Prospects and clients as one section. The heading is the overview itself, and the lists sit under it.
    to: "/client-management",
    label: "Client Management",
    icon: UsersRound,
    authority: ["PROSPECTIVE_CLIENTS:VIEW", "PROSPECTIVE_CLIENTS:OWN_CLIENTS"],
    at: (path) => path === "/client-management" || path === "/client-management/overview",
  },
  {
    to: "/prospective-clients",
    label: "Prospective Clients",
    icon: UserPlus,
    authority: ["PROSPECTIVE_CLIENTS:VIEW", "PROSPECTIVE_CLIENTS:OWN_CLIENTS"],
    under: "/client-management",
  },
  {
    to: "/clients",
    label: "All clients",
    icon: Contact,
    authority: "VIEW_ALL_CLIENTS:VIEW",
    // In the Client Management section for whoever has it; a reader who does not work with prospects keeps
    // it at the top level, where it always was.
    under: "/client-management",
    // A relationship manager onboards from the whole book, but reads in full only the clients assigned to
    // them, which is My clients. A second screen onto every client would say otherwise.
    notFor: ["ADMIN", "ADVISOR", "PORTFOLIO_MANAGER"],
    at: (path) => (path === "/clients" || path.startsWith("/clients/")) && !NOTICE_OF_TREATMENT.test(path),
  },
  {
    // The portfolio manager's own clients, starred first, each opening on an overview of their money.
    to: "/book",
    label: "Client list",
    icon: UsersRound,
    authority: READS_CLIENT_PORTFOLIOS,
    onlyFor: ["PORTFOLIO_MANAGER"],
    at: (path) => path === "/book" || path.startsWith("/book/"),
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
  {
    // The firm's own figures, beside the reports they sit with. The screen has been routed and guarded
    // all along and nothing anywhere pointed at it, so it could only be opened by typing its address —
    // and unlike the Dashboard and the AML screens, no comment said it was being withheld on purpose.
    // Offered on the permission its own route already enforces, to the desk that route admits.
    to: "/mis",
    label: "Management information",
    icon: ChartNoAxesColumn,
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
  // No "To sign": the relationship manager signed for the client only while the client had no portal to sign in.
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
    // Whoever may answer one, which is the Admin and nobody else, and Operations, who read where each stands
    // without answering (4 Nov 2026).
    authority: ["MANAGE_USERS_AND_ROLES:CHANGE", "ONBOARD_CLIENTS:CHANGE"],
    onlyFor: ["ADMIN", "OPERATIONS"],
    // With the rest of the client lifecycle, in the Client Management section.
    under: "/client-management",
  },
  {
    to: "/archived-clients",
    label: "Archived clients",
    icon: Archive,
    authority: "MANAGE_USERS_AND_ROLES:CHANGE",
    under: "/client-management",
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
  // What the banks say each client holds, beside the firm's file: the feeds' other half, read by the same desk.
  { to: "/holdings-check", label: "Holdings check", icon: Scale, authority: "MANAGE_BANK_FEEDS:CHANGE" },
  { to: "/notifications", label: "Notification log", icon: Mail, authority: "MANAGE_CONFIGURATION:VIEW" },
  // The firm's AML sheet and where each client sits on it. On Compliance's menu since 4 Nov 2026: their
  // dashboard counts what is due on it, and a figure with no way to its screen is no use to them.
  { to: "/aml-risk", label: "AML risk", icon: ShieldAlert, authority: READS_AML_RISK, onlyFor: ["COMPLIANCE"] },
  { to: "/audit-log", label: "Audit log", icon: Landmark, authority: "VIEW_AUDIT_LOG:VIEW" },
  // Beside the audit log rather than inside it. "Who has been reading whose money" is a question somebody
  // comes to the screen already holding, and finding it meant knowing to filter the whole trail by a
  // prefix nobody would guess.
  { to: "/family-access-trail", label: "Family access trail", icon: Eye, authority: "VIEW_AUDIT_LOG:VIEW" },
  // Four trails that were four places, or in two cases no place at all.
  { to: "/trails", label: "Trails", icon: UsersRound, authority: "VIEW_AUDIT_LOG:VIEW" },
  // Everybody's, because what it holds is decided by which desks somebody sits at rather than by a
  // permission: a reader who holds none of the desks asked sees an empty list, which is the truth about
  // them. Beside their own declarations, which is the other thing on this menu that is theirs alone.
  // In the Client Management section for whoever has it; at the top level for everybody else.
  { to: "/my-clearances", label: "My clearance requests", icon: UserMinus, authority: null, under: "/client-management" },
  { to: "/my-declarations", label: "My declarations", icon: FileCheck, authority: null },
  // The clients assigned to this relationship manager: the whole book is not theirs, and this is the part that is.
  {
    to: "/my-clients",
    label: "Assigned customers",
    icon: Contact,
    authority: "VIEW_CUSTOMER_PROFILE:OWN_CLIENTS",
    under: "/client-management",
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
  // Somebody's own account, which everybody signed in has one of — the portfolio desk included. It was off
  // their menu for a while, and a portfolio manager then had no way to their profile, notifications or
  // preferences short of typing the address.
  // One Support for everybody since 4 Nov 2026: their own tickets and New ticket, and for the IT Admin every
  // ticket and the SLA monitor. It replaced the IT Admin's "Support tickets" and everybody else's "Report an issue".
  { to: "/support", label: "Support", icon: LifeBuoy, authority: null },
  { to: "/sign-in-as", label: "Sign in as", icon: Eye, authority: "SIGN_IN_AS:CHANGE" },
  // The IT Admin's alone: Admin sets credentials on Config, beside the rest of a bank's details.
  {
    to: "/bank-credentials",
    label: "Bank credentials",
    icon: KeyRound,
    authority: "MANAGE_BANK_CREDENTIALS:CHANGE",
    onlyFor: ["IT_ADMIN"],
  },
  // Everybody's: the Firm Assistant answers only from what the asker may already see.
  { to: "/assistant", label: "AI Assistant", icon: Sparkles, authority: null },
  { to: "/settings", label: "Settings", icon: Settings, authority: null },
];


/**
 * The menu one reader gets: what their role may open, in the firm's own order.
 *
 * <p>Lifted out of the sidebar because it is now asked twice. The sidebar draws it, and Settings offers it
 * as the list of screens somebody may choose to open on — and that second reader has to be the same list
 * as the first, or a reader lands on a screen their role is then bounced off, straight back to a home
 * screen that sends them to it again.
 */
export function menuFor(user: StaffProfile) {
  const permitted = (item: (typeof allNavigation)[number]) =>
    item.authority === null ||
    (Array.isArray(item.authority) ? hasAnyAuthority(user, ...item.authority) : hasAuthority(user, item.authority));
  // An Admin's menu is written out by hand rather than filtered down, which means it is already in
  // the firm's own order — and must not be sorted again below.
  const admin = user.activeRole === "ADMIN";
  const navigation = admin
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

  // An entry and whatever sits under it, so the menu is drawn as the sections it actually has. An entry
  // whose section this reader does not have stays at the top level rather than disappearing with it.
  const present = new Set(navigation.map((item) => item.to));
  const sections = navigation
    .filter((item) => !item.under || !present.has(item.under))
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
  // The Admin's is left exactly as ADMINS_MENU wrote it. Sorting it by MENU_ORDER as well was the
  // bug: that list decided which entries an Admin gets, then this line immediately threw its order
  // away and re-sorted by the order every other desk uses. Manage staff users, which the firm puts
  // first, came out ninth.
  const items = admin ? sections : [...named, ...sections.filter((item) => !MENU_ORDER.includes(item.to))];
  return items;
}
