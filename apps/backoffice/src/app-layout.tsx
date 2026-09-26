import { Avatar, cn } from "@atomprive/ui";
import {
  FileCheck2,
  ArrowLeftRight,
  ChevronDown,
  ClipboardCheck,
  Contact,
  FileCheck,
  FileSignature,
  FileText,
  FolderOpen,
  KeyRound,
  Landmark,
  LogOut,
  Mail,
  PenLine,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
  UserPlus,
  Users,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet } from "react-router";
import { useSession, useStaffUser } from "./auth/session";
import { hasAnyAuthority, hasAuthority, ONBOARDS_CLIENTS, READS_PROPOSALS, UPLOADS_CLIENT_DOCUMENTS, type Authority } from "./lib/permissions";
import { roleLabels, type StaffRole } from "./lib/labels";

// Menu items appear as their screens are built; each is hidden from people the permission matrix doesn't allow (#75, #85).
// A null authority is a screen everyone signed in can reach, such as their own declarations.
//
// `notFor` keeps a screen off a role's menu even where the matrix would allow it. The Admin runs the platform
// rather than the firm's clients: they hold every permission so that nothing is ever locked away from them,
// but servicing a client is Operations', Advisory's and Compliance's work, and their menu says so.
const allNavigation: {
  to: string;
  label: string;
  icon: LucideIcon;
  authority: Authority | Authority[] | null;
  notFor?: StaffRole[];
}[] = [
  { to: "/clients", label: "All clients", icon: Contact, authority: "VIEW_ALL_CLIENTS:VIEW", notFor: ["ADMIN"] },
  { to: "/my-clients", label: "My clients", icon: Contact, authority: "VIEW_CUSTOMER_PROFILE:OWN_CLIENTS" },
  { to: "/proposals", label: "Proposals", icon: FileSignature, authority: READS_PROPOSALS, notFor: ["ADMIN"] },
  { to: "/onboarding", label: "Client onboarding", icon: UserPlus, authority: ONBOARDS_CLIENTS, notFor: ["ADMIN"] },
  { to: "/to-sign", label: "To sign", icon: PenLine, authority: "APPROVE_PROPOSALS:OWN_CLIENTS" },
  // The queue is where a client's KYC is decided, which is Compliance's alone. The papers themselves the
  // Admin reads too, so the document review sits on both menus.
  { to: "/kyc", label: "KYC review", icon: ShieldCheck, authority: "APPROVE_ONBOARDING:CHANGE", notFor: ["ADMIN"] },
  { to: "/kyc-documents", label: "KYC document review", icon: FileCheck2, authority: "APPROVE_ONBOARDING:CHANGE" },
  { to: "/client-documents", label: "Client documents", icon: FolderOpen, authority: UPLOADS_CLIENT_DOCUMENTS, notFor: ["ADMIN"] },
  { to: "/forms", label: "Forms", icon: FileText, authority: "FILL_CLIENT_FORMS:VIEW", notFor: ["ADMIN"] },
  { to: "/staff-declarations", label: "Staff declarations", icon: ClipboardCheck, authority: "MANAGE_USERS_AND_ROLES:VIEW", notFor: ["ADMIN"] },
  { to: "/users", label: "Manage staff users", icon: Users, authority: "MANAGE_USERS_AND_ROLES:VIEW" },
  { to: "/roles", label: "Permission matrix", icon: ShieldCheck, authority: "MANAGE_USERS_AND_ROLES:VIEW" },
  { to: "/config", label: "Config data", icon: SlidersHorizontal, authority: "MANAGE_CONFIGURATION:VIEW" },
  { to: "/bank-syncs", label: "Bank syncs", icon: RefreshCw, authority: "MANAGE_BANK_FEEDS:CHANGE" },
  { to: "/notifications", label: "Notification log", icon: Mail, authority: "MANAGE_CONFIGURATION:VIEW" },
  { to: "/audit-log", label: "Audit log", icon: Landmark, authority: "VIEW_AUDIT_LOG:VIEW" },
  { to: "/family-access", label: "Family access trail", icon: UsersRound, authority: "VIEW_AUDIT_LOG:VIEW" },
  { to: "/proposal-trail", label: "Proposal trail", icon: FileSignature, authority: "VIEW_AUDIT_LOG:VIEW" },
  { to: "/my-declarations", label: "My declarations", icon: FileCheck, authority: null },
];

export function AppLayout() {
  const user = useStaffUser();
  const navigation = allNavigation.filter(
    (item) =>
      !(user.activeRole && item.notFor?.includes(user.activeRole)) &&
      (item.authority === null ||
      (Array.isArray(item.authority) ? hasAnyAuthority(user, ...item.authority) : hasAuthority(user, item.authority))),
  );

  return (
    <div className="flex min-h-screen bg-canvas font-sans text-ink">
      <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col border-r border-line bg-sidebar px-4 py-6">
        <nav aria-label="Back-office" className="mt-14">
          <ul className="space-y-1">
            {navigation.map(({ to, label, icon: Icon }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                      isActive ? "bg-primary-100 font-semibold text-ink" : "text-ink-soft hover:bg-white",
                    )
                  }
                >
                  <Icon className="size-4.5" aria-hidden="true" />
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-20 items-center justify-between gap-4 px-8">
          <p className="text-2xl font-bold">{user.activeRole ? roleLabels[user.activeRole] : ""}</p>
          <UserMenu />
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
