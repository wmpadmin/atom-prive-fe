import { cn } from "@atomprive/ui";
import type { ReactNode } from "react";
import { Link } from "react-router";

/**
 * How a row whose client the firm has deactivated is drawn, everywhere one appears.
 *
 * <p>The row stays. Taking it off the queue would mean a deactivation could empty somebody's tray — ask
 * for a client to be deactivated and the document you were supposed to review is gone — and a firm whose
 * records can be removed by removing a client has no records.
 *
 * <p>So it is kept and killed instead: grey, with the name still readable and the way in closed. The name
 * stays because the row has to say which record this was; everything behind it is the Admin's alone, and
 * the link that used to lead there now leads nowhere, because for everybody but the Admin there is no
 * longer a client to open.
 *
 * <p>One place rather than a class list copied into each queue: these rows are rare, nobody will see two
 * of them side by side, and a treatment that drifted between screens would read as a rendering fault
 * rather than as a client who has gone.
 */

/** The ink a dead row is written in. Put on the row itself, so every cell in it goes quiet together. */
export const archivedRow = "bg-slate-50/40 text-ink-muted [&_*]:text-ink-muted";

/**
 * A client's name on a row: a link while they are the firm's, plain grey text once they are not.
 *
 * <p>Not a disabled link. A link that looks like a link and does nothing is a thing somebody presses
 * twice and then reports; text that is plainly not a link is read once and understood.
 */
export function ClientOnARow({
  id,
  name,
  archived,
  to,
  className,
  children,
}: {
  id?: string;
  name: string;
  archived: boolean;
  /** Where the name leads while the client is still the firm's. Defaults to their file. */
  to?: string;
  className?: string;
  /** Anything to sit under the name, such as the client's code. */
  children?: ReactNode;
}) {
  if (archived) {
    return (
      <span className={cn("block", className)}>
        <span className="block text-sm font-semibold text-ink-muted">{name}</span>
        <ArchivedMark />
        {children}
      </span>
    );
  }
  return (
    <span className={cn("block", className)}>
      <Link
        to={to ?? `/clients/${id ?? ""}`}
        className="block text-sm font-semibold text-ink hover:text-primary-700 hover:underline"
      >
        {name}
      </Link>
      {children}
    </span>
  );
}

/**
 * The words that say why the row is dead.
 *
 * <p>Said rather than left to the grey. Grey alone is how a disabled control looks, how a loading row
 * looks, and how a rendering fault looks; somebody meeting one of these rows for the first time needs to
 * be told, not left to work it out from a colour.
 */
export function ArchivedMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "mt-0.5 inline-flex items-center rounded-md bg-slate-200 px-1.5 py-0.5 text-2xs font-semibold text-ink-soft",
        className,
      )}
    >
      Client deactivated
    </span>
  );
}
