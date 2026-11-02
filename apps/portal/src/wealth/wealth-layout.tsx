import { ApiError } from "@atomprive/api-client";
import {
  useLogout,
  useMe,
  useReceived,
  useRequests,
  useMyTickets,
  useSent,
  useWealthRequests,
  type FamilyRequest,
  type Me,
  type RequestRow,
  type TicketRow,
  type WealthRequestRow,
} from "@atomprive/api-client/portal";
import {
  Activity,
  Bell,
  ChevronDown,
  FileSignature,
  FileText,
  KeyRound,
  Layers,
  LayoutDashboard,
  LifeBuoy,
  LineChart,
  Menu,
  Network,
  ScrollText,
  ShieldCheck,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router";
import { useSession } from "../auth/session-context";
import { initialsOf } from "../lib/money";
import { rememberPage } from "./last-page";
import { lastSeen } from "./requests-seen";

/**
 * The new look of the client portal, beside the classic one so the firm can put the two side by side.
 *
 * <p>Every screen of the new design is on the menu from the start, the way the firm drew it. Those not built
 * yet are greyed and cannot be pressed: the menu shows where the portal is going without leading anybody to an
 * empty page.
 */
type Place = { label: string; icon: LucideIcon; to?: string };

const PLACES: Place[] = [
  { label: "Dashboard", icon: LayoutDashboard, to: "/new" },
  { label: "Portfolio", icon: LineChart, to: "/new/portfolio" },
  { label: "Holdings", icon: Layers, to: "/new/holdings" },
  { label: "Accounts", icon: Wallet, to: "/new/accounts" },
  { label: "Documents", icon: FileText, to: "/new/documents" },
  { label: "Forms & Signatures", icon: FileSignature, to: "/new/forms" },
  { label: "KYC", icon: ShieldCheck },
  { label: "Family Wealth", icon: Network, to: "/new/family-wealth" },
  { label: "Family & Access", icon: Users, to: "/new/family-access" },
  { label: "Access Requests", icon: KeyRound, to: "/new/access-requests" },
  { label: "Activity", icon: Activity, to: "/new/activity" },
  { label: "Audit Log", icon: ScrollText, to: "/new/audit-log" },
];

const HELP: Place = { label: "Help & Support", icon: LifeBuoy, to: "/new/support" };

function NavItem({ place, onGo }: { place: Place; onGo: () => void }) {
  const Icon = place.icon;
  if (!place.to) {
    return (
      <li>
        <span
          aria-disabled="true"
          title="Coming soon"
          className="flex cursor-default items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-ink-muted/55 select-none"
        >
          <Icon aria-hidden="true" className="size-4.5 shrink-0" />
          <span className="min-w-0 flex-1 truncate">{place.label}</span>
          <span className="rounded-full bg-canvas px-1.5 py-0.5 text-3xs font-semibold tracking-wide text-ink-muted uppercase">
            Soon
          </span>
        </span>
      </li>
    );
  }
  return (
    <li>
      <NavLink
        to={place.to}
        // Only the dashboard needs an exact match; an account's own page still lights up Accounts.
        end={place.to === "/new"}
        onClick={onGo}
        className={({ isActive }) =>
          `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
            isActive ? "bg-primary-100 font-semibold text-ink" : "text-ink-soft hover:bg-white"
          }`
        }
      >
        <Icon aria-hidden="true" className="size-4.5 shrink-0" />
        <span className="truncate">{place.label}</span>
      </NavLink>
    </li>
  );
}

function Sidebar({ onGo }: { onGo: () => void }) {
  return (
    <div className="flex h-full flex-col">
      <Link to="/new" onClick={onGo} className="flex items-center gap-2.5 px-3 pb-6">
        <span className="flex size-8 items-center justify-center rounded-lg bg-brand-900 text-sm font-bold text-on-fill">
          A
        </span>
        <span className="text-base font-bold text-brand-900">Atom Privé</span>
      </Link>
      <ul className="space-y-0.5">
        {PLACES.map((place) => (
          <NavItem key={place.label} place={place} onGo={onGo} />
        ))}
      </ul>
      <ul className="mt-auto border-t border-line pt-3">
        <NavItem place={HELP} onGo={onGo} />
      </ul>
    </div>
  );
}

/**
 * What is waiting on the client, and what has changed for them: requests to see their accounts or wealth,
 * invitations to join a family, and answers to their own requests that came in since they last looked.
 */
function Waiting() {
  const access = useReceived<RequestRow[], ApiError>();
  const sent = useSent<RequestRow[], ApiError>();
  const wealth = useWealthRequests<WealthRequestRow[], ApiError>();
  const joins = useRequests<FamilyRequest[], ApiError>();
  const seen = lastSeen();
  const onAccess =
    (access.data ?? []).filter((one) => one.status === "ASKED").length + (wealth.data ?? []).filter((one) => !one.mine && one.status === "ASKED").length;
  const answered = [...(sent.data ?? []), ...(wealth.data ?? []).filter((one) => one.mine)].filter(
    (one) => (one.status === "APPROVED" || one.status === "REJECTED") && one.decidedAt !== null && one.decidedAt > seen,
  ).length;
  const onJoins = (joins.data ?? []).length;
  const tickets = useMyTickets<TicketRow[], ApiError>();
  const onTickets = (tickets.data ?? []).filter((one) => one.status === "WAITING").length;
  const total = onAccess + answered + onJoins + onTickets;

  return (
    <Link
      to={onAccess > 0 ? "/new/access-requests?tab=incoming" : answered > 0 ? "/new/access-requests?tab=history" : onJoins > 0 ? "/requests" : onTickets > 0 ? "/new/support" : "/new"}
      aria-label={total > 0 ? `${total} waiting on you` : "Nothing waiting on you"}
      className="relative flex size-9 items-center justify-center rounded-lg text-ink-soft hover:bg-sidebar"
    >
      <Bell aria-hidden="true" className="size-5" />
      {total > 0 && (
        <span className="absolute top-1 right-1 flex min-w-4 justify-center rounded-full bg-red-600 px-1 text-3xs leading-4 font-bold text-on-accent">
          {total}
        </span>
      )}
    </Link>
  );
}

function Account({ me }: { me: Me | undefined }) {
  const { ended } = useSession();
  const signOut = useLogout<ApiError>({ mutation: { onSettled: () => ended() } });
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const away = (event: MouseEvent) => {
      if (!box.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, [open]);

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((was) => !was)}
        className="flex items-center gap-3 rounded-xl py-1.5 pr-2 pl-3 hover:bg-white"
      >
        <span className="hidden text-right leading-tight sm:block">
          <span className="block text-sm font-semibold text-ink">{me?.fullName ?? " "}</span>
          <span className="block text-xs text-ink-muted">Client</span>
        </span>
        {me?.photo ? (
          <img src={me.photo} alt="" className="size-10 rounded-full object-cover" />
        ) : (
          <span className="flex size-10 items-center justify-center rounded-full bg-brand-900 text-sm font-bold text-on-fill">
            {initialsOf(me?.fullName ?? "")}
          </span>
        )}
        <ChevronDown aria-hidden="true" className="size-4 text-ink-muted" />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-2 w-52 rounded-xl border border-line bg-white p-1.5 shadow-lg"
        >
          <Link
            role="menuitem"
            to="/family"
            className="block rounded-lg px-3 py-2 text-sm font-medium text-ink-soft hover:bg-sidebar"
          >
            Classic portal
          </Link>
          <button
            role="menuitem"
            type="button"
            onClick={() => signOut.mutate()}
            className="block w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-ink-soft hover:bg-sidebar"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

export function WealthLayout() {
  const me = useMe<Me, ApiError>();
  const [menuOpen, setMenuOpen] = useState(false);
  const where = useLocation();

  // A new page closes the menu on a phone, whichever way the page was reached.
  const [shownFor, setShownFor] = useState(where.pathname);
  if (shownFor !== where.pathname) {
    setShownFor(where.pathname);
    setMenuOpen(false);
  }

  // Where the client was before Help & Support, so a ticket can say which page the problem was on.
  useEffect(() => {
    if (!where.pathname.startsWith("/new/support")) {
      rememberPage(window.location.href);
    }
  }, [where]);

  return (
    <div className="flex min-h-screen bg-canvas text-ink">
      <nav
        aria-label="Portal"
        className="sticky top-0 hidden h-screen w-64 shrink-0 overflow-y-auto border-r border-line bg-sidebar px-4 py-6 lg:block print:hidden"
      >
        <Sidebar onGo={() => undefined} />
      </nav>

      {menuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-brand-950/40"
            onClick={() => setMenuOpen(false)}
          />
          <nav aria-label="Portal" className="relative h-full w-64 overflow-y-auto bg-sidebar px-4 py-6">
            <button
              type="button"
              aria-label="Close menu"
              onClick={() => setMenuOpen(false)}
              className="absolute top-4 right-3 rounded-lg p-1.5 text-ink-muted hover:bg-sidebar"
            >
              <X aria-hidden="true" className="size-4" />
            </button>
            <Sidebar onGo={() => setMenuOpen(false)} />
          </nav>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-20 items-center gap-3 px-4 sm:px-8 print:hidden">
          <button
            type="button"
            aria-label="Open menu"
            onClick={() => setMenuOpen(true)}
            className="rounded-lg p-2 text-ink-soft hover:bg-sidebar lg:hidden"
          >
            <Menu aria-hidden="true" className="size-5" />
          </button>
          <div className="ml-auto flex items-center gap-2">
            <Waiting />
            <Account me={me.data} />
          </div>
        </header>
        <main className="flex-1 px-4 pb-10 sm:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
