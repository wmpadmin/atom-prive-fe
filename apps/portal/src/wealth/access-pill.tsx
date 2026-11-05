/** Full Access for the client's own, View Only for a relative's, as a pill that reads before the words do. */
export function AccessPill({ mine }: { mine: boolean }) {
  return mine ? (
    <span className="inline-flex rounded-full bg-access-full-soft px-2.5 py-0.5 text-xs font-semibold text-access-full-ink">Full Access</span>
  ) : (
    <span className="inline-flex rounded-full bg-access-view-soft px-2.5 py-0.5 text-xs font-semibold text-access-view-ink">View Only</span>
  );
}
