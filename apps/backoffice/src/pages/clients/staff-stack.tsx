import type { StaffMember } from "@atomprive/api-client/backoffice";
import { Avatar, cn } from "@atomprive/ui";
import { useEffect, useId, useRef, useState } from "react";

/** How many faces the stack draws before it starts counting instead. */
const FACES = 2;

/**
 * A client's people from one desk in one column's width: a few faces, one name, and the rest a press away.
 *
 * <p>One component for advisors and for portfolio managers both. They are two desks and two columns, but
 * a row of people in a column's width is the same problem twice, and the second copy is the one that
 * drifts.
 *
 * <p>Named chips wrapped. A client with five advisors took three lines of the row and set the whole table
 * to the width of whoever had the most, so a column somebody reads down for one name was the widest thing
 * on the screen. This holds the same width whatever the count.
 *
 * @param desk what these people are to the client, for a reader who cannot see the faces — "advisors",
 * "portfolio managers". Without it the managers' column announced itself as advisors.
 *
 * <p>Faces only, and no name. A name beside them read as a title the firm has not given anybody — the
 * list arrives longest-held first, which is an order, not a rank — and it set the column's width to
 * whoever happened to be first in it. Two faces and a count hold the same width whatever the number, and
 * every name is a press away.
 */
export function StaffStack({ people: advisors, desk = "people" }: { people: StaffMember[]; desk?: string }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const id = useId();

  // Closed by the two things that mean "not this": a press somewhere else and Escape. Listened for only
  // while it is open, so a table full of these costs nothing until one is being read.
  useEffect(() => {
    if (!open) {
      return;
    }
    function away(event: MouseEvent) {
      if (box.current && !box.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function key(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", key);
    };
  }, [open]);

  if (advisors.length === 0) {
    return (
      <span title="No advisor yet" className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-ink-muted">
        Default
      </span>
    );
  }

  const faces = advisors.slice(0, FACES);
  const counted = advisors.length - faces.length;
  // One advisor is the whole answer already, so there is nothing to open and nothing to press.
  const more = advisors.length > 1;

  const stack = (
    <span className="flex shrink-0 -space-x-2">
      {faces.map((advisor) => (
        // Ringed in the surface colour so overlapping faces read as separate people rather than as one
        // smudged shape.
        <Avatar key={advisor.id} name={advisor.fullName} className="size-7 text-2xs ring-2 ring-white" />
      ))}
      {counted > 0 && (
        <span
          aria-hidden="true"
          className="grid size-7 shrink-0 place-items-center rounded-full bg-slate-200 text-2xs font-bold text-ink-soft ring-2 ring-white"
        >
          +{counted}
        </span>
      )}
    </span>
  );

  return (
    <div ref={box} className="relative">
      {more ? (
        <button
          type="button"
          id={`${id}-button`}
          aria-haspopup="true"
          aria-expanded={open}
          aria-label={`${advisors.length} ${desk}: ${advisors.map((one) => one.fullName).join(", ")}`}
          // The row underneath opens the client. Pressing the faces is asking who they are, not asking
          // to go there, so this press stops here — and only this one: with a single advisor there is
          // nothing to open, and the cell stays part of the row the way every other cell is.
          onClick={(event) => {
            event.stopPropagation();
            setOpen((was) => !was);
          }}
          className={cn(
            "flex items-center rounded-full py-0.5 text-left",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600",
          )}
        >
          {stack}
        </button>
      ) : (
        // One person is the whole answer: their face, titled with their name, and nothing to open.
        <span title={faces[0]!.fullName} className="flex items-center py-0.5">
          {stack}
        </span>
      )}

      {open && (
        // Below the faces, hanging from the left edge where the eye already is. z-20 clears the card the
        // table sits in, the same as every other thing on these screens that opens over one.
        <div
          aria-labelledby={`${id}-button`}
          onClick={(event) => event.stopPropagation()}
          className="absolute top-full left-0 z-20 mt-1 min-w-64 rounded-xl border border-line bg-white py-2 shadow-lg"
        >
          <p className="px-3 pb-1 text-2xs font-semibold tracking-wider text-ink-muted uppercase">
            {advisors.length} advisors
          </p>
          <ul>
            {advisors.map((advisor) => (
              <li key={advisor.id} className="flex items-center gap-2 px-3 py-1.5">
                <Avatar name={advisor.fullName} className="size-7 text-2xs" />
                <span className="text-sm whitespace-nowrap text-ink">{advisor.fullName}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
