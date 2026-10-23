import type { StaffMember } from "@atomprive/api-client/backoffice";

/**
 * A desk's people on one row, or a word in their place where the client has nobody from it yet.
 *
 * <p>One component for both desks rather than one each. These were the advisors' own chips, and the
 * portfolio managers' column beside them is the same list of names doing the same job — a second copy
 * would have been the same twenty lines, and the copy is the one that drifts.
 *
 * @param nobody what the chip says when the list is empty, which is not the same word for both desks:
 * a client with no advisor falls to the default desk, and a client with no portfolio manager has none
 * @param nobodyTitle the whole of it, for a hover, since the chip has room for a word
 */
export function StaffChips({ people, nobody, nobodyTitle }: { people: StaffMember[]; nobody: string; nobodyTitle: string }) {
  if (people.length === 0) {
    return (
      <span title={nobodyTitle} className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-ink-muted">
        {nobody}
      </span>
    );
  }
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {people.map((person) => (
        <span key={person.id} className="inline-flex items-center rounded-full bg-primary-50 px-2.5 py-1 text-xs font-medium whitespace-nowrap text-primary-700">
          {person.fullName}
        </span>
      ))}
    </span>
  );
}
