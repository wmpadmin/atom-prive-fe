import { ApiError } from "@atomprive/api-client";
import { useReadClearance, type RequestClearances } from "@atomprive/api-client/backoffice";
import { Alert, cn } from "@atomprive/ui";
import { useState } from "react";
import { useStaffUser } from "../../auth/session";
import { hasAnyAuthority, hasAuthority, ONBOARDS_CLIENTS_CHANGE } from "../../lib/permissions";
import { ClearancePanel } from "./clearance-panel";
import { DeactivationActivity, DeactivationDocuments } from "./deactivation-activity";
import { DeactivationOverview } from "./deactivation-overview";
import { DeactivationStepper } from "./deactivation-stepper";
import { SayClearancePanel } from "./say-clearance-panel";
import { StartClearancePanel } from "./start-clearance-panel";

const VIEWS = [
  { id: "overview", label: "Overview" },
  { id: "clearances", label: "Role clearances" },
  { id: "activity", label: "Activity log" },
  { id: "documents", label: "Documents" },
] as const;

type View = (typeof VIEWS)[number]["id"];

/**
 * The whole of a client's deactivation, on the client's own file.
 *
 * <p>One tab rather than a screen per role. The desks are looking at the same client and the same
 * question; what changes between them is which panel they are offered, not where they have to go to
 * find it. A reader who holds two desks sees both, which is the case a screen per role handles worst.
 *
 * <p>The stepper sits above the views rather than inside one, because where the request has got to is
 * the first thing every reader wants and it should not depend on which view they last left open.
 */
export function DeactivationTab({ customerId, clientName }: { customerId: string; clientName: string }) {
  const user = useStaffUser();
  const [view, setView] = useState<View>("overview");
  const clearance = useReadClearance<RequestClearances, ApiError>(customerId, {
    query: { retry: false },
  });

  // 404 is the ordinary case, not a fault: nobody has asked for this client to go.
  if (clearance.isError && clearance.error.status === 404) {
    return (
      <Alert tone="info">
        Nobody has asked for this client to be deactivated. A relationship manager raises it from the
        client's own file.
      </Alert>
    );
  }
  if (clearance.isError) {
    return <Alert tone="danger">{clearance.error.message}</Alert>;
  }
  if (!clearance.data) {
    return <p className="py-10 text-center text-sm text-ink-muted">Reading where it stands…</p>;
  }

  const standing = clearance.data;
  const operations = hasAnyAuthority(user, ...ONBOARDS_CLIENTS_CHANGE);
  // The same authority the endpoints behind the panels ask for, so no screen offers a control the
  // server would refuse.
  const admin = hasAuthority(user, "MANAGE_USERS_AND_ROLES:CHANGE");
  const owesAnswer = standing.roles.some((row) => row.mine && row.standing !== "GO_AHEAD");

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-line bg-white px-6 py-5">
        <DeactivationStepper standing={standing} />
      </section>

      <div role="tablist" aria-label="Deactivation" className="flex gap-1 overflow-x-auto border-b border-line">
        {VIEWS.map((option) => (
          <button
            key={option.id}
            type="button"
            role="tab"
            id={`deactivation-view-${option.id}`}
            aria-selected={view === option.id}
            onClick={() => setView(option.id)}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-semibold whitespace-nowrap transition-colors",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600",
              view === option.id ? "border-primary-600 text-primary-700" : "border-transparent text-ink-muted hover:text-ink",
            )}
          >
            {option.label}
            {option.id === "documents" && standing.roles.some((row) => row.hasAttachment) && (
              <span className="ml-1.5 text-xs text-ink-muted">
                {standing.roles.filter((row) => row.hasAttachment).length}
              </span>
            )}
          </button>
        ))}
      </div>

      <div role="tabpanel" aria-labelledby={`deactivation-view-${view}`} className="space-y-4">
        {view === "overview" && (
          <DeactivationOverview
            customerId={customerId}
            clientName={clientName}
            standing={standing}
            admin={admin}
            owesAnswer={owesAnswer}
            onAnswer={() => setView("clearances")}
          />
        )}
        {view === "clearances" && (
          <>
            <ClearancePanel standing={standing} />
            {/* The desk's own answer first, because somebody who holds a desk came here to give one. */}
            <SayClearancePanel customerId={customerId} standing={standing} />
            {(operations || admin) && <StartClearancePanel customerId={customerId} standing={standing} />}
          </>
        )}
        {view === "activity" && <DeactivationActivity standing={standing} />}
        {view === "documents" && <DeactivationDocuments standing={standing} />}
      </div>
    </div>
  );
}
