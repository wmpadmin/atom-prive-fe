import type { StaffMember } from "@atomprive/api-client/backoffice";
import { Avatar, Button, IconButton } from "@atomprive/ui";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { formatDate } from "../../lib/labels";

/** One of a desk's people on a client, and when the client was given to them. */
export interface AssignedStaff {
  person: StaffMember;
  since: string;
}

interface AssignedStaffPanelProps {
  /** What the heading is written under, so the section says what it is to a screen reader too. */
  id: string;
  title: string;
  lead: string;
  people: AssignedStaff[];
  /** The words under each name, such as "Advisor since" or "Managing since". */
  sinceLabel: string;
  /** What the panel says where the client has nobody from this desk. */
  empty: string;
  assignLabel: string;
  assignIcon: ReactNode;
  /** Whether this reader may change who is on the client. Reading who is on them is everyone's. */
  canAssign: boolean;
  onAssign: () => void;
  onRemove: (person: StaffMember) => void;
  busy?: boolean;
}

/**
 * A desk's people on one client, with the assigning and the taking off.
 *
 * <p>Written once for both desks. The advisors had the only panel of this shape, and the portfolio
 * managers' is that panel with other words in it: who is on the client, since when, and the two
 * buttons. Each desk keeps its own panel on the screen — they are two jobs and the firm has not
 * merged them — but there is one of these, so the second desk cannot quietly end up with a worse
 * copy of the first.
 */
export function AssignedStaffPanel({
  id, title, lead, people, sinceLabel, empty, assignLabel, assignIcon, canAssign, onAssign, onRemove, busy,
}: AssignedStaffPanelProps) {
  return (
    <section aria-labelledby={`${id}-title`} className="rounded-2xl border border-line bg-white">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-6 py-5">
        <div>
          <h2 id={`${id}-title`} className="text-base font-bold">
            {title}
          </h2>
          <p className="mt-0.5 text-xs text-ink-muted">{lead}</p>
        </div>
        {canAssign && (
          <Button variant="secondary" size="sm" onClick={onAssign}>
            {assignIcon}
            {assignLabel}
          </Button>
        )}
      </div>
      {people.length === 0 ? (
        <p className="px-6 py-5 text-sm text-ink-muted">{empty}</p>
      ) : (
        <ul className="divide-y divide-line">
          {people.map(({ person, since }) => (
            <li key={person.id} className="flex items-center justify-between gap-3 px-6 py-4">
              <div className="flex items-center gap-3">
                <Avatar name={person.fullName} className="size-10" />
                <div>
                  <p className="text-sm font-semibold">{person.fullName}</p>
                  <p className="text-xs text-ink-muted">
                    {sinceLabel} {formatDate(since)}
                  </p>
                </div>
              </div>
              {canAssign && (
                <IconButton
                  label={`Take ${person.fullName} off this client`}
                  tone="danger"
                  disabled={busy}
                  onClick={() => onRemove(person)}
                >
                  <X />
                </IconButton>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
