import { Button, Dialog } from "@atomprive/ui";
import { useEffect, useState } from "react";
import { useBlocker } from "react-router";

/**
 * Asks what to do with changes somebody is walking away from.
 *
 * <p>Two ways out of a screen and both are covered: closing or reloading the tab, which the browser asks
 * about on its own, and moving to another screen inside the app, which it does not — that one leaves
 * without a word and the typing is simply gone.
 *
 * <p>Three ways out of the question, because all three are things people mean: keep it and go, throw it
 * away and go, or stay where they are. A dialog that only offered to lose the work would be answered by
 * habit.
 */
export function LeaveWithoutSaving({
  when,
  what,
  saving,
  onSave,
  onDiscard,
}: {
  when: boolean;
  /** What has been changed, named so the question is about something rather than about nothing. */
  what: string;
  saving: boolean;
  onSave: () => void;
  /**
   * Puts the changes back. Awaited before the page goes: throwing the work away takes writes of its own,
   * and leaving while they were still going meant leaving without them.
   */
  onDiscard: () => void | Promise<void>;
}) {
  const [putting, setPutting] = useState(false);
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) => when && currentLocation.pathname !== nextLocation.pathname,
  );

  useEffect(() => {
    if (!when) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [when]);

  // Saving is what unblocks it: once there is nothing unkept, the way out is clear and it goes on.
  useEffect(() => {
    if (blocker.state === "blocked" && !when) blocker.proceed?.();
  }, [blocker, when]);

  return (
    <Dialog open={blocker.state === "blocked"} title="Save your changes?" onClose={() => blocker.reset?.()}>
      <div className="space-y-4">
        <p className="text-sm text-ink-muted">
          {what} has been changed and not saved yet. Leaving without saving loses it.
        </p>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" disabled={saving || putting} onClick={() => blocker.reset?.()}>
            Stay here
          </Button>
          {/* Gone when it is done, not when it is asked. Putting the work back is a string of writes, and
              leaving the moment they were started left the page before any of them landed — so the button
              said it had put everything back and nothing had been. */}
          <Button
            variant="secondary"
            disabled={saving || putting}
            onClick={async () => {
              setPutting(true);
              try {
                await onDiscard();
              }
              finally {
                setPutting(false);
              }
              blocker.proceed?.();
            }}
          >
            {putting ? "Putting it back…" : "Discard changes"}
          </Button>
          <Button disabled={saving || putting} onClick={onSave}>
            {saving ? "Saving…" : "Save and leave"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
