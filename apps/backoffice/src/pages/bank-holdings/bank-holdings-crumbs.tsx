import { ChevronRight, Home } from "lucide-react";
import { Link } from "react-router";
import { useStaffUser } from "../../auth/session";

/** One step after Bank holdings: a client, then one of their banks. The last step is the page itself. */
export type Crumb = { label: string; to?: string };

/**
 * Where Bank holdings sits, as the reader's own menu places it: under Portfolio management for the portfolio
 * manager; straight under Home for the Admin, whose menu has no Portfolio management. Below it come the client
 * and the bank the reader has opened.
 */
export function BankHoldingsCrumbs({ trail = [] }: { trail?: Crumb[] }) {
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
      {trail.length === 0 ? (
        <span aria-current="page" className="font-semibold text-ink">Bank holdings</span>
      ) : (
        <>
          <Link to="/bank-holdings" className="hover:text-ink">Bank holdings</Link>
          {trail.map((step, index) => {
            const last = index === trail.length - 1;
            return (
              <span key={`${index}-${step.label}`} className="flex items-center gap-2">
                <ChevronRight aria-hidden="true" className="size-3.5" />
                {last || !step.to ? (
                  <span aria-current={last ? "page" : undefined} className={last ? "font-semibold text-ink" : undefined}>{step.label}</span>
                ) : (
                  <Link to={step.to} className="hover:text-ink">{step.label}</Link>
                )}
              </span>
            );
          })}
        </>
      )}
    </nav>
  );
}
