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
  ArrowLeftRight,
  ChevronDown,
  KeyRound,
  LogOut,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router";
import { useSession, useStaffUser } from "./auth/session";
import { menuFor } from "./menu";
import { roleLabels, type StaffRole } from "./lib/labels";

// Menu items appear as their screens are built; each is hidden from people the permission matrix doesn't allow (#75, #85).
// A null authority is a screen everyone signed in can reach, such as their own declarations.
//
// `notFor` keeps a screen off a role's menu even where the matrix would allow it. The Admin runs the platform
// rather than the firm's clients: they hold every permission so that nothing is ever locked away from them,
// but servicing a client is Operations', Advisory's and Compliance's work, and their menu says so.
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
  const items = menuFor(user);

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
