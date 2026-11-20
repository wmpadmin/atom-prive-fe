import { useNavigate, useParams, useSearchParams } from "react-router";
import { PortfolioSetupDialog } from "./portfolio-setup-dialog";

/**
 * Working a client's Net AUM out, at its own address.
 *
 * <p>It was a dialog over the Clients list, which was removed on 20 Nov 2026. The calculator is switched off
 * (THE_CALCULATOR_IS_OFFERED in set-up.ts), but turning it back on should still be the whole of putting it back,
 * so it keeps its address and opens on its own: closed, it puts somebody back on the client's portfolio when that
 * is where they came from, and on the Client Directory otherwise.
 */
export function NetAumSetupPage() {
  const navigate = useNavigate();
  const { customerId = "" } = useParams();
  const address = useSearchParams()[0];
  const openAt = (["1", "2", "3", "4"].includes(address.get("at") ?? "")
    ? Number(address.get("at")) : undefined) as 1 | 2 | 3 | 4 | undefined;
  const backTo = address.get("from") === "portfolio" ? `/portfolio-clients/${customerId}` : "/client-directory";
  return (
    <PortfolioSetupDialog
      customerId={customerId}
      openAt={openAt}
      onClose={() => void navigate(backTo)}
      onFinish={() => void navigate(`/portfolio-clients/${customerId}`)}
    />
  );
}
