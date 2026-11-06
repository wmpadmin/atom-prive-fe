import { Link } from "react-router";

/**
 * Said under a screen's heading whenever its figures are shown in a currency other than the one they are held
 * in. A client who chose dirhams a month ago and forgot should not read their portfolio as if it were held in
 * dirhams, nor think the firm's statements will be.
 */
export function RestatedNote({ heldIn, shownIn }: { heldIn: string | undefined; shownIn: string | undefined }) {
  if (!heldIn || !shownIn || heldIn === shownIn) return null;
  return (
    <p className="mt-1 text-xs text-ink-muted">
      Shown in {shownIn} at today's rate, as you chose in{" "}
      <Link to="/new/settings" className="font-semibold text-primary-700 hover:underline">
        Settings
      </Link>
      . Your portfolio is held and reported in {heldIn}; returns are worked out in {heldIn}.
    </p>
  );
}
