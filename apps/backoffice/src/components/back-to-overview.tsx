import { ChevronLeft } from "lucide-react";
import { Link, useSearchParams } from "react-router";

/**
 * The way back to the Client Management overview, on a list opened from it. The overview marks its links with
 * from=overview; a list reached from the menu has no such mark and shows nothing here.
 */
export function BackToOverview() {
  const [params] = useSearchParams();
  if (params.get("from") !== "overview") return null;
  return (
    <Link
      to="/client-management/overview"
      className="inline-flex items-center gap-1 text-sm font-medium text-ink-muted hover:text-primary-700"
    >
      <ChevronLeft aria-hidden="true" className="size-4" />
      Back to Overview
    </Link>
  );
}
