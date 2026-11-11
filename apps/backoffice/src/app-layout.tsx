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
import {
  SIDEBAR_DEFAULT,
  SIDEBAR_NARROWEST,
  SIDEBAR_WIDEST,
  usePreferences,
} from "./lib/preferences";
import { ThemeToggle } from "./components/theme-toggle";
import { TopSearch } from "./components/top-search";
import { NotificationBell } from "./components/notification-bell";
import { AssistantButton } from "./components/portfolio-assistant";
import {
  Check,
  ChevronDown,
  ChevronsUpDown,
  KeyRound,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  // Aliased: the bare name is the DOM's own KeyboardEvent, which a listener further down this file needs.
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router";
import { useSession, useStaffUser } from "./auth/session";
import { currentSupportView } from "@atomprive/support/support-view";
import { SupportViewBanner } from "@atomprive/support/support-view-banner";
import { rememberPage } from "./lib/last-page";
import { menuFor } from "./menu";
import { arrangeMenu, type MenuEntry } from "./menu-groups";
import { createPortal } from "react-dom";
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

const ENTRY_CLASS = "flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors";

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

/** Yours rather than a desk's: owed once by the person, so only in the workspace they call home. */
const MY_DECLARATIONS = "/my-declarations";

/**
 * The selected entry: a quiet neutral fill a step stronger than hover, and stronger text. No blue and no ring,
 * which in dark mode drew a thick light-blue outline round the entry.
 */
const HERE_CLASS = "bg-slate-200/70 font-semibold text-ink";

const IDLE_CLASS = "text-ink-soft hover:bg-white";

/** The collapsed sidebar's width: an icon and its padding. */
const RAIL = 60;

/** Puts the cursor in the top bar's client search, the one search there is. */
function focusSearch() {
  const box = document.getElementById("top-search");
  if (box instanceof HTMLInputElement) {
    box.focus();
    box.select();
  }
}

/**
 * A name beside an icon, for the collapsed rail. Drawn on the page's top layer rather than inside the sidebar,
 * because the sidebar's menu scrolls and anything inside a scrolling box that reaches past its edge is cut off.
 */
function RailTip({ label, show, children }: { label: string; show: boolean; children: ReactNode }) {
  const [at, setAt] = useState<DOMRect | null>(null);
  if (!show) {
    return <>{children}</>;
  }
  const open = (event: { currentTarget: HTMLElement }) => setAt(event.currentTarget.getBoundingClientRect());
  return (
    <div onMouseEnter={open} onMouseLeave={() => setAt(null)} onFocus={open} onBlur={() => setAt(null)}>
      {children}
      {at && createPortal(
        <span
          role="tooltip"
          style={{ top: at.top + at.height / 2, left: at.right + 8 }}
          // Ink on canvas: near-black with light text in the light theme, light with dark text in the dark one —
          // both theme tokens, so it inverts with the page. (It was slate-900 and white, and the dark theme
          // redefines white as its own panel colour, which left dark text on a dark chip.) Opaque, above
          // everything, with a ring and a shadow to lift it off whatever is under it.
          className="pointer-events-none fixed z-[1000] -translate-y-1/2 rounded-md bg-ink px-2.5 py-1 text-[13px] leading-5 font-semibold whitespace-nowrap text-canvas opacity-100 shadow-lg ring-1 ring-black/20"
        >
          {label}
        </span>,
        document.body,
      )}
    </div>
  );
}

type Entry = {
  to: string;
  label: string;
  icon: LucideIcon;
  at?: (path: string, search: string) => boolean;
  below: { to: string; label: string; icon: LucideIcon; at?: (path: string, search: string) => boolean }[];
};

/**
 * Entering another of this person's workspaces, for now rather than from now on: where they open is their own
 * choice in Settings.
 */
function useEnterRole(onEntered?: () => void) {
  const queryClient = useQueryClient();
  const { applyProfile } = useSession();
  const navigate = useNavigate();
  return useEnterWorkspace<ApiError>({
    mutation: {
      onSuccess: (profile) => {
        // Three things, and leaving any one of them out leaves the screen lying. The cache belongs to the
        // role being left; the profile in hand still says the old role is the active one, so the menu would
        // redraw exactly as it was; and the screen underneath belongs to a workspace this reader has just
        // walked out of, which the API will now refuse them.
        queryClient.clear();
        applyProfile(profile);
        onEntered?.();
        navigate("/", { replace: true });
      },
    },
  });
}

/**
 * A workspace's heading. The open one sits above its screens; the others are held at the foot, and pressing one
 * enters it — the menu that comes back is that role's, because the API only ever sends the active role's
 * permissions and the browser cannot know what another role would see.
 */
function RoleHeader({ role, here, enter }: {
  role: StaffRole;
  here: boolean;
  enter: ReturnType<typeof useEnterRole>;
}) {
  return (
    <button
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
        here ? "text-ink" : "text-ink-muted hover:bg-white/60 hover:text-ink",
        enter.isPending && !here && "cursor-wait",
      )}
    >
      <ChevronDown aria-hidden="true" className={cn("size-3 shrink-0 transition-transform", here ? "" : "-rotate-90")} />
      <span className="min-w-0 flex-1 truncate">{roleLabels[role]}</span>
    </button>
  );
}

/**
 * The top of the sidebar: the platform's mark and name, and the button that folds the sidebar to a rail. On the
 * rail, where the workspace headings have no room, the mark opens the list of this person's workspaces instead.
 */
function WorkspaceHeader({ user, rail, onFold }: { user: StaffProfile; rail: boolean; onFold: () => void }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const enter = useEnterRole(() => setOpen(false));
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !box.current?.contains(event.target as Node)) {
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

  const role = user.activeRole ? roleLabels[user.activeRole] : "";
  const fold = (
    <button
      type="button"
      onClick={onFold}
      aria-pressed={rail}
      aria-label={rail ? "Expand the menu" : "Collapse the menu"}
      title={rail ? "Expand the menu" : "Collapse the menu"}
      className="grid size-8 shrink-0 place-items-center rounded-lg border border-line text-ink-muted hover:bg-white hover:text-ink
        focus-visible:ring-2 focus-visible:ring-line focus-visible:outline-none"
    >
      {rail ? <PanelLeftOpen className="size-4" aria-hidden="true" /> : <PanelLeftClose className="size-4" aria-hidden="true" />}
    </button>
  );
  const markClass = "grid size-8 shrink-0 place-items-center rounded-lg bg-primary-600 text-sm font-bold text-on-accent";

  if (!rail) {
    return (
      <div className="flex items-center gap-2.5">
        <span className={markClass} aria-hidden="true">A</span>
        <p className="min-w-0 flex-1 truncate text-sm font-bold">Atom Privé</p>
        {fold}
      </div>
    );
  }
  // Somebody holding one role has nothing to switch to, so on the rail their mark is a name and not a control.
  const switches = user.roles.length > 1;
  return (
    <div ref={box} className="relative flex flex-col items-center gap-2">
      <RailTip label={switches ? `${role} · switch workspace` : `Atom Privé · ${role}`} show={!open}>
        {switches ? (
          <button type="button" aria-haspopup="menu" aria-expanded={open} aria-label={`${role}, switch workspace`}
            onClick={() => setOpen((current) => !current)} className={cn(markClass, "hover:opacity-90")}>
            A
          </button>
        ) : (
          <span className={markClass} aria-hidden="true">A</span>
        )}
      </RailTip>
      {fold}
      {open && (
        <div role="menu" aria-label="Workspaces"
          className="absolute top-0 left-full z-30 ml-3 w-56 rounded-xl border border-line bg-white p-1.5 shadow-lg">
          {user.roles.map((one) => {
            const here = one === user.activeRole;
            return (
              <button
                key={one}
                type="button"
                role="menuitemradio"
                aria-checked={here}
                disabled={enter.isPending}
                onClick={() => {
                  if (here) {
                    setOpen(false);
                    return;
                  }
                  enter.mutate({ data: { role: one as StaffRole, fromNowOn: false } });
                }}
                className={cn("flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm",
                  here ? HERE_CLASS : "text-ink-soft hover:bg-slate-50", enter.isPending && !here && "cursor-wait")}
              >
                <span className="min-w-0 flex-1 truncate">{roleLabels[one as StaffRole]}</span>
                {here && <Check className="size-4 shrink-0" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** The menu as one list, nested entries indented under the entry they belong to. */
function MenuList({ items, rail, pathname, search }: {
  items: MenuEntry[];
  rail: boolean;
  pathname: string;
  search: string;
}) {
  return (
    <ul className="space-y-0.5">
      {items.map((item) => (
        <NavEntry key={item.to} item={item} pathname={pathname} search={search} rail={rail} />
      ))}
    </ul>
  );
}

function NavEntry({
  item,
  pathname,
  search,
  rail,
}: {
  item: Entry;
  pathname: string;
  search: string;
  rail: boolean;
}) {
  const Icon = item.icon;
  const here = isHere(item, pathname, search);
  const waiting = useWaitingOn(item.to);

  if (rail) {
    return (
      <>
        <li>
          <RailTip label={waiting > 0 ? `${item.label} · ${waiting}` : item.label} show>
            <Link
              to={item.to}
              aria-label={item.label}
              aria-current={here ? "page" : undefined}
              className={cn("relative mx-auto grid size-10 place-items-center rounded-xl transition-colors", here ? HERE_CLASS : IDLE_CLASS)}
            >
              <Icon className="size-4.5" aria-hidden="true" />
              {waiting > 0 && <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-primary-600" aria-hidden="true" />}
            </Link>
          </RailTip>
        </li>
        {item.below.map((under) => {
          const UnderIcon = under.icon;
          const onIt = isHere(under, pathname, search);
          return (
            <li key={under.to}>
              <RailTip label={under.label} show>
                <Link
                  to={under.to}
                  aria-label={under.label}
                  aria-current={onIt ? "page" : undefined}
                  className={cn("mx-auto grid size-10 place-items-center rounded-xl transition-colors", onIt ? HERE_CLASS : IDLE_CLASS)}
                >
                  <UnderIcon className="size-4" aria-hidden="true" />
                </Link>
              </RailTip>
            </li>
          );
        })}
      </>
    );
  }

  return (
    <li>
      {/* A plain link, not a NavLink: NavLink decides "active" from the path by itself and overrides the
          aria-current given to it, so it lit one entry and told a screen reader a different one — a
          client's file read as the KYC queue because /kyc is the start of /kyc/{id}. These entries work
          out where they are themselves, and both the highlight and what is announced follow that. */}
      <Link
        to={item.to}
        aria-current={here ? "page" : undefined}
        className={cn(ENTRY_CLASS, here ? HERE_CLASS : IDLE_CLASS)}
      >
        <Icon className="size-4.5 shrink-0" aria-hidden="true" />
        <span className="min-w-0 flex-1">{item.label}</span>
        {/* How many are waiting, where the entry is a queue. A queue reached by remembering to look at it
            is a queue people stop looking at; the number is what makes somebody open it on the day there
            is something in it, and its absence is what lets them leave it alone on the days there is not. */}
        {waiting > 0 && <span className="shrink-0 text-xs font-semibold text-ink-muted tabular-nums">{waiting}</span>}
      </Link>
      {item.below.length > 0 && (
        <ul className="mt-0.5 ml-5 space-y-0.5 border-l border-line pl-3">
          {item.below.map((under) => {
            const UnderIcon = under.icon;
            const onIt = isHere(under, pathname, search);
            return (
              <li key={under.to}>
                <Link
                  to={under.to}
                  aria-current={onIt ? "page" : undefined}
                  className={cn(ENTRY_CLASS, onIt ? HERE_CLASS : IDLE_CLASS)}
                >
                  <UnderIcon className="size-4 shrink-0" aria-hidden="true" />
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

/**
 * The edge of the sidebar, which is also the handle for how wide it is.
 *
 * <p>The menu's longest labels — Post onboarding notice, KYC document review — wrapped onto two lines at
 * the width the sidebar has always been, and a reader on a wide screen had no way to give them the room
 * that was sitting unused beside them. A width is a reading preference, like density or the date format,
 * so it is kept with those rather than guessed at per screen.
 *
 * <p>Dragging is not the only way in. A handle reachable only by pointer is a setting somebody on a
 * keyboard does not have, so the arrow keys move it a step at a time and Home returns it to where it
 * started — which also gives a reader who has dragged it somewhere unusable a way back.
 */
function SidebarEdge({
  width,
  onDrag,
  onNudge,
  onSettled,
}: {
  width: number;
  onDrag: (to: number) => void;
  /** A step from wherever it is now, which is not the same as a step from where it was last drawn. */
  onNudge: (by: number) => void;
  onSettled: (to: number) => void;
}) {
  const dragging = useRef(false);
  // The width as the release handler will find it. Kept in a ref because that handler is bound once, and
  // bound to the width it was created with it would write down the width the drag started from.
  const latest = useRef(width);
  useEffect(() => {
    latest.current = width;
  }, [width]);

  useEffect(() => {
    const moved = (event: PointerEvent) => {
      if (!dragging.current) {
        return;
      }
      // The sidebar's left edge is the window's, so the pointer's own x is the width being asked for.
      event.preventDefault();
      onDrag(event.clientX);
    };
    const released = () => {
      if (!dragging.current) {
        return;
      }
      dragging.current = false;
      // Written down once, on release. Writing on every pointer move would put a hundred values through
      // storage to keep the last one.
      onSettled(latest.current);
      document.body.style.removeProperty("cursor");
      document.body.style.removeProperty("user-select");
    };
    window.addEventListener("pointermove", moved);
    window.addEventListener("pointerup", released);
    window.addEventListener("pointercancel", released);
    return () => {
      window.removeEventListener("pointermove", moved);
      window.removeEventListener("pointerup", released);
      window.removeEventListener("pointercancel", released);
    };
  }, [onDrag, onSettled]);

  const byKey = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Home") {
      event.preventDefault();
      onDrag(SIDEBAR_DEFAULT);
      onSettled(SIDEBAR_DEFAULT);
      return;
    }
    const step = event.shiftKey ? 48 : 16;
    const by = event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0;
    if (by === 0) {
      return;
    }
    event.preventDefault();
    // Asked for as a step rather than as a width. Worked out here from the width this render was drawn
    // with, a key held down would move it once and then stop: every repeat before the next paint reads
    // the same starting figure and asks for the same destination.
    onNudge(by);
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="How wide the menu is"
      aria-valuenow={width}
      aria-valuemin={SIDEBAR_NARROWEST}
      aria-valuemax={SIDEBAR_WIDEST}
      tabIndex={0}
      onKeyDown={byKey}
      onDoubleClick={() => {
        onDrag(SIDEBAR_DEFAULT);
        onSettled(SIDEBAR_DEFAULT);
      }}
      onPointerDown={(event) => {
        event.preventDefault();
        dragging.current = true;
        // Held on the body rather than the handle: the pointer leaves the handle the moment it moves,
        // and a cursor that changes back mid-drag reads as the drag having stopped.
        document.body.style.setProperty("cursor", "col-resize");
        document.body.style.setProperty("user-select", "none");
      }}
      className="absolute top-0 -right-1 z-10 h-full w-2 cursor-col-resize
        before:absolute before:inset-y-0 before:left-1/2 before:w-px before:-translate-x-1/2
        before:bg-transparent hover:before:bg-line focus-visible:before:bg-line
        focus-visible:outline-none"
    />
  );
}

export function AppLayout() {
  const user = useStaffUser();
  const { pathname, search } = useLocation();
  const { signOut } = useSession();
  const items = menuFor(user);
  // Where somebody was before Report an issue, so a ticket can say which page the problem was on.
  useEffect(() => {
    if (!pathname.startsWith("/my-tickets") && !pathname.startsWith("/support")) {
      rememberPage(window.location.href);
    }
  }, [pathname, search]);
  const { preferences, change } = usePreferences();
  // Live while a drag is in flight; what is on file otherwise. Reading straight from preferences would
  // mean a storage write per pointer move, and holding only local state would forget it on the next screen.
  const [dragged, setDragged] = useState<number | null>(null);
  const width = dragged ?? preferences.sidebarWidth;
  /** The width as it is this instant, which between a key repeat and a paint is not the drawn one. */
  const liveWidth = useRef(width);
  useEffect(() => {
    liveWidth.current = width;
  }, [width]);
  // Stored under its old name, which meant put away; folded to the rail is what it means now.
  const rail = preferences.sidebarAway;

  const held = useCallback(
    (to: number) => Math.min(Math.max(Math.round(to), SIDEBAR_NARROWEST), SIDEBAR_WIDEST),
    [],
  );
  const onDrag = useCallback((to: number) => setDragged(held(to)), [held]);
  /**
   * A step from where it is, taken from the live value rather than the drawn one.
   *
   * <p>Settled on the same press. A key repeat is a run of presses, not a drag with an end to it, so
   * there is no release to write it down on.
   */
  const onNudge = useCallback(
    (by: number) => {
      // Stepped off the ref rather than off state, and the ref is moved on in the same breath: a key
      // repeat fires again before React has painted, and a step worked out from the drawn width would
      // ask for the same destination every time.
      const next = held(liveWidth.current + by);
      liveWidth.current = next;
      setDragged(next);
      change("sidebarWidth", next);
    },
    [change, held],
  );
  const onSettled = useCallback(
    (to: number) => {
      change("sidebarWidth", held(to));
      setDragged(null);
    },
    [change, held],
  );

  // ⌘K on a Mac, Ctrl+K elsewhere: the top bar's client search, from wherever somebody is.
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "k") {
        event.preventDefault();
        focusSearch();
      }
    };
    document.addEventListener("keydown", shortcut);
    return () => document.removeEventListener("keydown", shortcut);
  }, []);

  /**
   * The workspace this person calls home — the Admin's choice, or their own from Settings. Their declarations
   * are shown there and nowhere else: they are owed once by the person, not once by each desk they sit at.
   */
  const home = user.opensIn ?? (user.roles.length === 1 ? user.roles[0] : null);
  const shown = items.filter((item) => item.to !== MY_DECLARATIONS || user.roles.length < 2 || user.activeRole === home);
  const { list, footer } = arrangeMenu(shown, user.activeRole as StaffRole | null);
  // Workspace headings where there is more than one workspace and room to name them.
  const sections = !rail && user.roles.length > 1 && user.activeRole !== null;
  const enter = useEnterRole();

  const view = currentSupportView();

  return (
    <>
    {view && <SupportViewBanner view={view} onEnd={() => void signOut()} />}
    <div className="flex min-h-screen bg-canvas font-sans text-ink">
      {/* Folded to a rail of icons rather than put away, so every screen is still one press from anywhere. The
          width it had is kept, so unfolding it brings it back as the reader left it. */}
      <aside
        style={{ width: rail ? RAIL : width }}
        // Held to the window: sticky at the top and exactly the window's height, so however long the page
        // runs the sidebar runs beside it. (It was also marked relative, which overrode sticky, so on a long
        // page it scrolled away and its background ended a window's height down.) Sticky is already a
        // containing block for the resize handle.
        className={cn("sticky top-0 flex h-screen shrink-0 flex-col self-start border-r border-line bg-sidebar py-4",
          rail ? "px-2" : "px-3")}
      >
        {!rail && <SidebarEdge width={width} onDrag={onDrag} onNudge={onNudge} onSettled={onSettled} />}
        <WorkspaceHeader user={user} rail={rail} onFold={() => change("sidebarAway", !rail)} />
        {/* The open workspace's heading is held above its screens and the others at the foot, so however long a
            desk's list runs, both the desk you are at and the way to every other one stay on screen. Only the
            screens between them scroll. Somebody holding one role has no headings at all, and on the rail the
            mark opens the workspaces instead. */}
        {sections && <div className="mt-4 shrink-0"><RoleHeader role={user.activeRole as StaffRole} here enter={enter} /></div>}
        <nav aria-label="Back-office"
          // Never squeezed to nothing: on a short window the other workspaces' headings give way first.
          className={cn("min-h-24 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain",
            sections ? "mt-1 ml-[1.0625rem] border-l border-line pl-2" : "mt-4")}>
          <MenuList items={list} rail={rail} pathname={pathname} search={search} />
        </nav>
        {sections && (
          <div className="mt-2 min-h-0 space-y-0.5 overflow-y-auto border-t border-line/50 pt-2">
            {user.roles.filter((role) => role !== user.activeRole).map((role) => (
              <RoleHeader key={role} role={role as StaffRole} here={false} enter={enter} />
            ))}
          </div>
        )}
        <div className="mt-3 shrink-0 space-y-0.5 border-t border-line pt-3">
          <ul className="space-y-0.5">
            {footer.map((item) => (
              <NavEntry key={item.to} item={item} pathname={pathname} search={search} rail={rail} />
            ))}
          </ul>
          <AccountMenu rail={rail} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-20 items-center justify-between gap-4 px-8">
          <p className="min-w-0 truncate text-2xl font-bold">{user.activeRole ? roleLabels[user.activeRole] : ""}</p>
          <div className="flex items-center gap-3">
            <TopSearch />
            <div className="flex items-center gap-1">
              <AssistantButton />
              <ThemeToggle />
              <NotificationBell />
            </div>
          </div>
        </header>
        <main className="flex-1 px-8 pb-10">
          <Outlet />
        </main>
      </div>
    </div>
    </>
  );
}

/** The person at the foot of the sidebar: who they are, and their own account's two actions. */
function AccountMenu({ rail }: { rail: boolean }) {
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
    <div ref={menuRef} className="relative pt-2">
      <RailTip label={user.fullName} show={rail && !open}>
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={rail ? `${user.fullName}, account` : undefined}
          onClick={() => setOpen((current) => !current)}
          className={cn("flex w-full items-center gap-2.5 rounded-xl text-left hover:bg-white",
            rail ? "justify-center p-1" : "px-2 py-1.5")}
        >
          <StaffAvatar name={user.fullName} photo={user.photo} className="size-8 shrink-0" />
          {!rail && (
            <>
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block truncate text-sm font-semibold">{user.fullName}</span>
                <span className="block truncate text-xs text-ink-muted">{user.email}</span>
              </span>
              <ChevronsUpDown className="size-4 shrink-0 text-ink-muted" aria-hidden="true" />
            </>
          )}
        </button>
      </RailTip>
      {open && (
        <div role="menu"
          className={cn("absolute bottom-full z-30 mb-2 w-52 rounded-xl border border-line bg-white p-1.5 shadow-lg", rail ? "left-0" : "left-0 right-0 w-auto")}>
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
