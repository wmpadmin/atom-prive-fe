import { useSwitchSpace, type StaffProfileSpace } from "@atomprive/api-client/backoffice";
import { cn } from "@atomprive/ui";
import { Check, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useSession, useStaffUser } from "../auth/session";
import { forgetAssistantConversation } from "../lib/assistant-conversation";

/**
 * The firm's two workspaces: Demo, every screen with dummy data for showing the platform, and Real, the same
 * screens with only what the banks send. Which one a session is in is the server's (the token carries it); this
 * only shows it and lets anyone on the staff move across, at their own desk (21 Nov 2026).
 */
const SPACES: Record<StaffProfileSpace, { name: string; detail: string; strip: string; dot: string; stripTone: string }> = {
  DEMO: {
    name: "Demo workspace",
    detail: "All screens with dummy data, for showing the firm",
    strip: "You are in the Demo workspace. Every figure here is dummy data.",
    dot: "#BA7517",
    stripTone: "border-amber-200 bg-amber-50 text-amber-900",
  },
  REAL: {
    name: "Real workspace",
    detail: "Same screens, empty; only what the EFG SFTP sends",
    strip: "You are in the Real workspace. Only data from the EFG SFTP feed.",
    dot: "#1D9E75",
    stripTone: "border-emerald-200 bg-emerald-50 text-emerald-800",
  },
};

/** The switch in the top bar, for everyone the server says may move between the workspaces. */
export function WorkspaceSwitch() {
  const user = useStaffUser();
  const { applySignIn } = useSession();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const move = useSwitchSpace();

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

  if (!user.canSwitchSpace) return null;
  const here = SPACES[user.space];

  function goTo(space: StaffProfileSpace) {
    setOpen(false);
    if (space === user.space) return;
    setFailed(false);
    move.mutate(undefined, {
      onSuccess: (signedIn) => {
        // Nothing read in one workspace is good in the other: drop it all and start from the dashboard.
        forgetAssistantConversation();
        queryClient.clear();
        applySignIn(signedIn);
        void navigate("/");
      },
      onError: () => setFailed(true),
    });
  }

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Workspace: ${here.name}. Switch workspace`}
        disabled={move.isPending}
        onClick={() => setOpen((current) => !current)}
        className="inline-flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-2 text-sm font-semibold text-ink hover:border-primary-300"
      >
        <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ backgroundColor: here.dot }} />
        {move.isPending ? "Switching…" : here.name}
        <ChevronDown className="size-4 text-ink-muted" aria-hidden="true" />
      </button>
      {failed && (
        <p role="alert" className="absolute left-0 mt-2 w-64 rounded-lg border border-rose-400/40 bg-rose-400/10 px-3 py-2 text-xs text-rose-700">
          Couldn&apos;t switch workspace. Try again.
        </p>
      )}
      {open && (
        <div role="menu" className="absolute left-0 z-20 mt-2 w-80 rounded-xl border border-line bg-white p-1.5 shadow-lg">
          <p className="px-3 pt-1.5 pb-1 text-xs text-ink-muted">Switch workspace</p>
          {(Object.keys(SPACES) as StaffProfileSpace[]).map((space) => {
            const choice = SPACES[space];
            const chosen = space === user.space;
            return (
              <button
                key={space}
                type="button"
                role="menuitemradio"
                aria-checked={chosen}
                onClick={() => goTo(space)}
                className={cn(
                  "flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left",
                  chosen ? "bg-primary-50" : "hover:bg-slate-50",
                )}
              >
                <span aria-hidden="true" className="mt-1.5 size-2 shrink-0 rounded-full" style={{ backgroundColor: choice.dot }} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-ink">{choice.name}</span>
                  <span className="block text-xs text-ink-muted">{choice.detail}</span>
                </span>
                {chosen && <Check className="mt-0.5 size-4 shrink-0 text-ink" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** The line under the top bar that always says which workspace this is, for whoever can be in either. */
export function WorkspaceStrip() {
  const user = useStaffUser();
  if (!user.canSwitchSpace) return null;
  const here = SPACES[user.space];
  return (
    <p role="status" className={cn("mx-8 mb-4 rounded-lg border px-4 py-2 text-sm font-medium", here.stripTone)}>
      {here.strip}
    </p>
  );
}
