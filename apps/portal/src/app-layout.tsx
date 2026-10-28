import { ApiError } from "@atomprive/api-client";
import {
  useLogout,
  useMe,
  useReceived,
  useRequests,
  type FamilyRequest,
  type Me,
  type RequestRow,
} from "@atomprive/api-client/portal";
import { NavLink, Outlet } from "react-router";
import { MyPhoto } from "./pages/my-photo";
import { useSession } from "./auth/session-context";

/**
 * The portal's frame: who is signed in, and the handful of places they can go.
 *
 * <p>Only the screens that exist are on it. The firm's own sketch had a dashboard, a portfolio and a
 * documents section; none of those is built, and a navigation item that leads to an empty page is a
 * promise the screen behind it cannot keep.
 */
const WHERE = [
  { to: "/family", label: "Your family" },
  { to: "/accounts", label: "Accounts" },
  { to: "/access", label: "Access requests" },
  { to: "/permissions", label: "Permissions" },
  { to: "/reports", label: "Reports" },
  { to: "/requests", label: "Requests" },
  { to: "/settings", label: "Settings" },
];

/**
 * What is waiting on this client, and nothing else.
 *
 * <p>Two sorts of thing end up here — somebody asking to see their accounts, and somebody asking them to
 * join a family — and they are counted together because the client does not think of them as two queues.
 * Pressing it goes to whichever has something in it, because a bell that leads to an empty page is worse
 * than no bell.
 *
 * <p>Silent when there is nothing. A bell drawn at nought is a thing people learn to stop looking at.
 */
function Bell() {
  const access = useReceived<RequestRow[], ApiError>();
  const joins = useRequests<FamilyRequest[], ApiError>();
  const waitingOnAccess = (access.data ?? []).filter((one) => one.status === "ASKED").length;
  const waitingOnJoins = (joins.data ?? []).length;
  const total = waitingOnAccess + waitingOnJoins;

  if (total === 0) {
    return null;
  }
  return (
    <NavLink
      to={waitingOnAccess > 0 ? "/access" : "/requests"}
      aria-label={`${total} waiting on you`}
      className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
    >
      Waiting on you
      <span className="ml-1.5 inline-flex min-w-5 justify-center rounded-full bg-blue-600 px-1.5 py-0.5 text-2xs font-bold text-white">
        {total}
      </span>
    </NavLink>
  );
}

export function AppLayout() {
  const { ended } = useSession();
  const me = useMe<Me, ApiError>();
  const signOut = useLogout<ApiError>({ mutation: { onSettled: () => ended() } });

  return (
    <div className="flex min-h-screen bg-slate-100 text-slate-900">
      {/* Held still while the page scrolls, the way the back office holds its own menu. A menu that
          slides off the top is a menu you have to scroll back up to before you can leave the page. */}
      <nav
        aria-label="Your account"
        className="sticky top-0 h-screen w-56 shrink-0 overflow-y-auto border-r border-slate-200 bg-white px-3 py-5"
      >
        <p className="px-3 pb-4 text-sm font-bold text-blue-800">Atom Privé</p>
        <ul className="space-y-1">
          {WHERE.map((one) => (
            <li key={one.to}>
              <NavLink
                to={one.to}
                className={({ isActive }) =>
                  `block rounded-lg px-3 py-2 text-sm font-semibold ${
                    isActive ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-50"
                  }`
                }
              >
                {one.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="min-w-0 flex-1">
        {/* Stays with the menu. Sign out and whatever is waiting on the client are the two things on
            this screen that should never need scrolling back for. */}
        <header className="sticky top-0 z-20 flex items-center gap-4 border-b border-slate-200 bg-white px-6 py-3">
          <Bell />
          <div className="ml-auto flex items-center gap-3">
            <MyPhoto me={me.data} />
            <span className="hidden min-w-0 sm:block">
              <span className="block truncate text-sm font-semibold text-slate-900">
                {me.data?.fullName ?? " "}
              </span>
              <span className="block truncate text-xs text-slate-500">Client</span>
            </span>
            <button
              type="button"
              onClick={() => signOut.mutate()}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Sign out
            </button>
          </div>
        </header>
        {/* Wide enough for a table beside a rail. At max-w-5xl the two together had to share 1024px, which
            left the accounts table too narrow for its own columns and a dead strip down the right of every
            screen on anything bigger than a laptop. */}
        <main className="mx-auto max-w-[1600px] px-6 py-7">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
