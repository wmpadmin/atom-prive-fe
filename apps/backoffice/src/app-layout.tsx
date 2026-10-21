import { ApiError } from "@atomprive/api-client";
import {
  useListClientRequests,
  useListModelChanges,
  useListProposalsAwaitingMyAnswer,
  useListAllocationChanges,
  useListModelEdits,
  useListRestores,
  type ModelChangePage,
  type MovePlanQueue,
  type ProposalPage,
  type AllocationChangeQueue,
  type ModelEditQueue,
  type RestoreQueue,
} from "@atomprive/api-client/backoffice";
import { Avatar, cn } from "@atomprive/ui";
import { SystemStatusPanel } from "./components/system-status";
import { ThemeToggle } from "./components/theme-toggle";
import { TopSearch } from "./components/top-search";
import { NotificationBell } from "./components/notification-bell";
import {
  ArrowLeftRight,
  BellRing,
  ChevronDown,
  ClipboardCheck,
  Clock,
  Contact,
  FileCheck,
  FileCheck2,
  FileSignature,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  KeyRound,
  Landmark,
  Layers,
  LayoutGrid,
  LogOut,
  Mail,
  PenLine,
  Radio,
  Scale,
  Settings,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Stamp,
  TrendingUp,
  TriangleAlert,
  type LucideIcon,
  UserPlus,
  Users,
  UsersRound,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, Outlet, useLocation } from "react-router";
import { useSession, useStaffUser } from "./auth/session";
import { MENU_ORDER } from "./menu-order";
import { hasAnyAuthority, hasAuthority, ANSWERS_MOVE_PLANS, ONBOARDS_CLIENTS, READS_ORDERS, ONBOARDS_EVERY_CLIENT, READS_CLIENT_PORTFOLIOS, READS_PROPOSALS, OPENS_CLIENT_DOCUMENTS, type Authority } from "./lib/permissions";
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
  { to: "/dashboard" },
  { to: "/users" },
  // The client directory, which is where an advisor is put on a client. An Admin is given it for that job
  // and the menu says so: the screen is the same one Operations and Compliance read.
  { to: "/clients", label: "Assign advisors" },
  { to: "/kyc-documents" },
  { to: "/staff-tracker" },
  // The declarations register is reached from under the tracker rather than from the menu's top level: it is
  // one of the things being tracked, not a heading of its own.
  { to: "/staff-declarations", under: "/staff-tracker" },
  { to: "/roles" },
  { to: "/config" },
  { to: "/audit-log" },
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
  // Whoever runs the platform gets the firm's figures; everybody else gets their own day, on the same address.
  {
    to: "/dashboard",
    label: "Dashboard",
    icon: LayoutGrid,
    authority: null,
    at: (path, search) => path === "/dashboard" || ownsSharedScreen(path, search, A_PORTFOLIO, "dashboard"),
  },
  {
    to: "/clients",
    label: "All clients",
    icon: Contact,
    authority: "VIEW_ALL_CLIENTS:VIEW",
    // An advisor onboards from the whole book, but reads in full only the clients assigned to them, which is
    // My clients. A second screen onto every client would say otherwise.
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
    label: "Drift & breaches",
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
    // How risky the plans are, which is a different question from how they have done: two plans that
    // returned the same are not the same plan if one of them lurched to get there.
    to: "/model-risk",
    label: "Model risk",
    icon: ShieldAlert,
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
    notFor: ["ADMIN"],
    // A proposal, or one client's moves, opened from here is read here: this is where they live now.
    at: (path, search) => path === "/approvals"
      || livesHere(path, search, A_PROPOSAL, ["client"])
      || path.startsWith("/moves-to-approve/"),
  },
  // Three teams read the blotter and each does one thing to an order, so it sits on all three menus.
  {
    to: "/trade-orders",
    label: "Trade blotter",
    icon: ArrowLeftRight,
    authority: READS_ORDERS,
    at: (path) => path === "/trade-orders" || path.startsWith("/trade-orders/"),
  },
  { to: "/onboarding", label: "Client onboarding", icon: UserPlus, authority: ONBOARDS_CLIENTS, notFor: ["ADMIN"] },
  {
    to: "/post-onboarding",
    label: "Post onboarding notice",
    icon: BellRing,
    // Every client's pack, so it stays with Operations. An advisor onboarding their own clients does not
    // thereby follow what every other client is owed.
    authority: ONBOARDS_EVERY_CLIENT,
    notFor: ["ADMIN"],
    at: (path) => path === "/post-onboarding" || NOTICE_OF_TREATMENT.test(path),
  },
  { to: "/to-sign", label: "To sign", icon: PenLine, authority: "APPROVE_PROPOSALS:OWN_CLIENTS" },
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
    to: "/client-documents",
    label: "Client documents",
    icon: FolderOpen,
    // Whoever may open a client's papers, not only whoever may add to them: Operations read every
    // client's documents to service them, and had no way in at all.
    authority: OPENS_CLIENT_DOCUMENTS,
    notFor: ["ADMIN"],
    // A client's file opened from here stays here on the menu, as it does for the review queue. Without
    // this it lit the document review instead — a screen the reader had not been on.
    at: (path, search) =>
      path === "/client-documents" || ownsSharedScreen(path, search, A_CLIENT_KYC, "documents"),
  },
  { to: "/forms", label: "Forms", icon: FileText, authority: "FILL_CLIENT_FORMS:VIEW", notFor: ["ADMIN"] },
  { to: "/staff-declarations", label: "Staff declarations", icon: ClipboardCheck, authority: "VIEW_STAFF_DECLARATIONS:VIEW", notFor: ["ADMIN"] },
  // An Admin's own screen. Operations keep the declarations register itself, under its own name.
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
  { to: "/family-access", label: "Family access trail", icon: UsersRound, authority: "VIEW_AUDIT_LOG:VIEW" },
  { to: "/proposal-trail", label: "Proposal trail", icon: FileSignature, authority: "VIEW_AUDIT_LOG:VIEW" },
  { to: "/my-declarations", label: "My declarations", icon: FileCheck, authority: null },
  // The clients assigned to this advisor: the whole book is not theirs, and this is the part that is.
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
  { to: "/settings", label: "Settings", icon: Settings, authority: null },
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
  const modelEdits = useListModelEdits<ModelEditQueue, ApiError>({
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
    + (modelEdits.data?.waiting ?? []).length
    + (clientRequests.data?.waiting ?? []).length
    + (proposals.data?.totalItems ?? 0)
    // Waiting on this reader, not visible to them: a bell that counts somebody else's work sends
    // people to a queue with nothing in it for them.
    + (modelChanges.data?.waitingOnYou ?? 0);
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
        <nav aria-label="Back-office" className="mt-14 min-h-0 flex-1 overflow-y-auto">
          <ul className="space-y-1">
            {items.map((item) => (
              <NavEntry key={item.to} item={item} pathname={pathname} search={search} />
            ))}
          </ul>
        </nav>

        {/* Pushed to the foot of the sidebar: it is there to be glanced at, not read. */}
        <div className="mt-auto pt-6">
          <SystemStatusPanel />
        </div>
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
        <Avatar name={user.fullName} className="size-10" />
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
