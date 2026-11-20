import { Alert } from "@atomprive/ui";
import { Eye, Lock } from "lucide-react";
import type { ReactNode } from "react";
import { Link, useLocation } from "react-router";
import { useStaffUser } from "../auth/session";

/**
 * The level the person's role has for the screen at an address, as the permission matrix's Screens tab sets it: the
 * screen whose address is the longest start of it. Null where no screen claims the address.
 */
function screenLevel(screens: Record<string, string> | undefined, path: string): string | null {
  if (!screens) return null;
  let best: string | null = null;
  for (const start of Object.keys(screens)) {
    if ((path === start || path.startsWith(`${start}/`)) && (best == null || start.length > best.length)) best = start;
  }
  return best == null ? null : (screens[best] ?? null);
}

/**
 * Holds the page to its screen's level: at No access it is not drawn, at View only it says so above the page. The
 * server holds the same line on every request the page sends, so this is the reader's warning rather than the lock.
 */
export function ScreenGate({ children }: { children: ReactNode }) {
  const user = useStaffUser();
  const { pathname } = useLocation();
  const level = screenLevel((user as { screens?: Record<string, string> }).screens, pathname);
  if (level === "NONE") {
    return (
      <div className="mx-auto mt-16 max-w-md rounded-2xl border border-line bg-white p-8 text-center">
        <Lock aria-hidden="true" className="mx-auto size-8 text-ink-muted" />
        <h1 className="mt-3 text-lg font-bold">Your role can't open this screen</h1>
        <p className="mt-1 text-sm text-ink-muted">An Admin sets which screens each role can open, in the permission matrix.</p>
        <Link to="/" className="mt-4 inline-block text-sm font-semibold text-primary-600 hover:text-primary-700">Go to your home screen</Link>
      </div>
    );
  }
  return (
    <>
      {level === "VIEW_ONLY" && (
        <div className="mb-4">
          <Alert tone="info">
            <span className="inline-flex items-center gap-2">
              <Eye aria-hidden="true" className="size-4" />
              This screen is view only for your role. You can read everything on it, but nothing on it can be changed.
            </span>
          </Alert>
        </div>
      )}
      {children}
    </>
  );
}
