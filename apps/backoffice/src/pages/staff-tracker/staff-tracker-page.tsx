import { ListPageHeader } from "../../components/record-list";

/**
 * Where an Admin follows what the firm's own staff owe it.
 *
 * <p>Deliberately empty. What it holds is reached from under it: the declarations register sits beneath it in
 * the menu, and whatever else the firm wants tracked will sit there too. A screen filled with this platform's
 * idea of a staff tracker would have to be taken apart again before it could hold the real thing.
 */
export function StaffTrackerPage() {
  return (
    <div className="space-y-6">
      <ListPageHeader
        title="Staff tracker"
        lead="What the firm's staff owe it, in one place."
      />

      <section className="rounded-2xl border border-dashed border-line bg-white px-5 py-16 text-center">
        <p className="text-sm text-ink-muted">Nothing is on this screen yet.</p>
      </section>
    </div>
  );
}
