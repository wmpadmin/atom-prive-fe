import { ChevronRight, Home } from "lucide-react";
import { Link } from "react-router";
import { useStaffUser } from "../../auth/session";

/**
 * Where Bank holdings sits, as the reader's own menu places it: under Portfolio management for the portfolio
 * manager; straight under Home for the Admin, whose menu has no Portfolio management.
 */
export function BankHoldingsCrumbs({ bank }: { bank?: string }) {
  const user = useStaffUser();
  const underPortfolio = user.activeRole === "PORTFOLIO_MANAGER";
  return (
    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-sm text-ink-muted">
      <Link to="/" aria-label="Home" className="hover:text-ink"><Home aria-hidden="true" className="size-4" /></Link>
      {underPortfolio && (
        <>
          <ChevronRight aria-hidden="true" className="size-3.5" />
          <span>Portfolio management</span>
        </>
      )}
      <ChevronRight aria-hidden="true" className="size-3.5" />
      {bank === undefined ? (
        <span aria-current="page" className="font-semibold text-ink">Bank holdings</span>
      ) : (
        <>
          <Link to="/bank-holdings" className="hover:text-ink">Bank holdings</Link>
          <ChevronRight aria-hidden="true" className="size-3.5" />
          <span aria-current="page" className="font-semibold text-ink">{bank}</span>
        </>
      )}
    </nav>
  );
}
