import type { ReactNode } from "react";
import { formatDateTime, formatRelative } from "../../lib/labels";

/**
 * Who put a paper on file, and when.
 *
 * <p>A document on a client's file is evidence, and evidence with nobody's name against it is worth less
 * than evidence with one. The name was recorded from the first upload; it was simply never shown.
 */
export function PutOnFileBy({
  at,
  by,
}: {
  at: string;
  /** Nothing where the staff member who uploaded it has since left. */
  by?: string | null;
}) {
  return (
    <span className="block">
      <span className="block whitespace-nowrap">{formatRelative(at)}</span>
      <span className="block text-2xs text-ink-muted">{by ? `by ${by}` : "by somebody no longer on staff"}</span>
    </span>
  );
}

/**
 * Who decided on a paper, when, and what they said.
 *
 * <p>Said whether or not they gave a reason. It used to appear only alongside a reason, so an approval —
 * which needs none — showed a green badge and nobody's name, and the one decision the firm most needs to
 * stand behind was the one nobody was named for.
 */
export function DecidedBy({
  by,
  at,
  reason,
  children,
}: {
  by?: string | null;
  at?: string | null;
  reason?: string | null;
  /** Said instead where nobody has decided yet. */
  children?: ReactNode;
}) {
  if (!by && !at) {
    return children ? <>{children}</> : null;
  }
  return (
    <>
      <span className="block">
        {by ?? "Somebody no longer on staff"}
        {at ? ` · ${formatDateTime(at)}` : ""}
      </span>
      {reason && <span className="block">{reason}</span>}
    </>
  );
}
