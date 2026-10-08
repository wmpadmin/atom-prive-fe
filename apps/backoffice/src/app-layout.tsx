import { Avatar, cn } from "@atomprive/ui";
import { SystemStatusPanel } from "./components/system-status";
import { ThemeToggle } from "./components/theme-toggle";
import { TopSearch } from "./components/top-search";
import { NotificationBell } from "./components/notification-bell";
import {
  FileCheck2,
  ArrowLeftRight,
  ChevronDown,
  ClipboardCheck,
  Clock,
  ChartPie,
  Contact,
  FileCheck,
  FileSignature,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  KeyRound,
  Landmark,
  LogOut,
  Mail,
  PenLine,
  BellRing,
  Radio,
  Ruler,
  Scale,
  TrendingUp,
  TriangleAlert,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Stamp,
  SlidersHorizontal,
  UserPlus,
  Users,
  UsersRound,
  type LucideIcon,
  Layers,
  LayoutGrid,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router";
import { useSession, useStaffUser } from "./auth/session";
import { hasAnyAuthority, hasAuthority, ONBOARDS_CLIENTS, ONBOARDS_EVERY_CLIENT, READS_CLIENT_PORTFOLIOS, READS_PROPOSALS, UPLOADS_CLIENT_DOCUMENTS, type Authority } from "./lib/permissions";
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
 * A client's own KYC file. It is opened from both KYC screens — from the review queue to see why a client is
 * not ready, and from the document review to decide on what they sent — so neither owns it outright.
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
  {
    // Numbers for the partners rather than the working day. Read only: nothing here changes a client.
    to: "/mis",
    label: "MIS",
    icon: ChartPie,
    authority: READS_CLIENT_PORTFOLIOS,
    onlyFor: ["PORTFOLIO_MANAGER"],
  },
  {
    // The indices the plans are measured against. Its own screen rather than a tab on Model performance:
    // maintaining the reference data is a different job from reading what it says.
    to: "/benchmarks",
    label: "Benchmarks",
    icon: Ruler,
    authority: READS_CLIENT_PORTFOLIOS,
    onlyFor: ["PORTFOLIO_MANAGER"],
  },
  // Whoever passes a proposal to the client. Its own screen, not a tab on the proposals list: the queue is
  // other people's work waiting on you, which is a different job from following your own.
  {
    to: "/manager-review",
    label: "Waiting on my sign-off",
    icon: Stamp,
    authority: "APPROVE_PROPOSALS:CHANGE",
    at: (path, search) => path === "/manager-review" || ownsSharedScreen(path, search, A_PROPOSAL, "review"),
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
    at: (path, search) => path.startsWith("/kyc-documents") || livesHere(path, search, A_CLIENT_KYC, ["queue"]),
  },
  { to: "/client-documents", label: "Client documents", icon: FolderOpen, authority: UPLOADS_CLIENT_DOCUMENTS, notFor: ["ADMIN"] },
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
  {
    to: "/proposals",
    label: "Sent proposals",
    icon: FileSignature,
    authority: READS_PROPOSALS,
    notFor: ["ADMIN"],
    // A proposal opened from the sign-off queue or from a client's own file is read there, not here.
    at: (path, search) => path === "/proposals" || livesHere(path, search, A_PROPOSAL, ["review"]),
  },
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
 * <p>An entry that gathers others shows them, and can be shut again by whoever wants the menu shorter. It
 * reopens itself when the screen being read is one of them, so arriving at a screen never leaves it hidden
 * under a closed heading. An entry that gathers nothing is a link and nothing else.
 */
function NavEntry({
  item,
  pathname,
  search,
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
}) {
  const Icon = item.icon;
  const here = isHere(item, pathname, search);
  const holdsTheScreen = item.below.some((under) => isHere(under, pathname, search));
  // Open to begin with: what an entry gathers is the point of it, and a section that starts shut hides the
  // only thing under it from somebody who has not thought to click the arrow.
  const [open, setOpen] = useState(true);
  const showing = open || holdsTheScreen;

  return (
    <li>
      <div className="flex items-center">
        <NavLink
          to={item.to}
          aria-current={here ? "page" : undefined}
          className={cn(
            ENTRY_CLASS,
            "flex-1",
            here ? "bg-primary-100 font-semibold text-ink" : "text-ink-soft hover:bg-white",
          )}
        >
          <Icon className="size-4.5" aria-hidden="true" />
          {item.label}
        </NavLink>
        {item.below.length > 0 && (
          <button
            type="button"
            onClick={() => setOpen(!showing)}
            aria-expanded={showing}
            aria-label={`${showing ? "Hide" : "Show"} what is under ${item.label}`}
            className="ml-1 rounded-lg p-1.5 text-ink-muted transition-colors hover:bg-white hover:text-ink"
          >
            <ChevronDown className={cn("size-4 transition-transform", showing && "rotate-180")} aria-hidden="true" />
          </button>
        )}
      </div>
      {item.below.length > 0 && showing && (
        <ul className="mt-1 space-y-1 border-l border-line pl-3 ml-5">
          {item.below.map((under) => {
            const UnderIcon = under.icon;
            const onIt = isHere(under, pathname, search);
            return (
              <li key={under.to}>
                <NavLink
                  to={under.to}
                  aria-current={onIt ? "page" : undefined}
                  className={cn(
                    ENTRY_CLASS,
                    onIt ? "bg-primary-100 font-semibold text-ink" : "text-ink-soft hover:bg-white",
                  )}
                >
                  <UnderIcon className="size-4" aria-hidden="true" />
                  {under.label}
                </NavLink>
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

  return (
    <div className="flex min-h-screen bg-canvas font-sans text-ink">
      <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col border-r border-line bg-sidebar px-4 py-6">
        <nav aria-label="Back-office" className="mt-14">
          <ul className="space-y-1">
            {sections.map((item) => (
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
