import { NavLink } from "react-router";

/**
 * The two halves of Bank feeds, one menu entry since 21 Nov 2026: the feeds themselves, and what the banks say
 * each client holds beside the firm's file. Both read the same feeds and are kept by the same desk.
 */
export function FeedTabs() {
  return (
    <nav aria-label="Bank feeds" className="flex gap-1 border-b border-line">
      {[
        { to: "/ingestion", label: "Feeds" },
        { to: "/holdings-check", label: "Holdings check" },
      ].map((one) => (
        <NavLink key={one.to} to={one.to} end
          className={({ isActive }) => isActive
            ? "-mb-px border-b-2 border-primary-600 px-3 py-2 text-sm font-semibold text-primary-700"
            : "-mb-px border-b-2 border-transparent px-3 py-2 text-sm font-semibold text-ink-muted hover:text-ink"}>
          {one.label}
        </NavLink>
      ))}
    </nav>
  );
}
