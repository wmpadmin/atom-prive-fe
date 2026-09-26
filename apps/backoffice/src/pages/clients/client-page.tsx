import { ApiError } from "@atomprive/api-client";
import {
  getGetCustomerQueryKey,
  getListCustomersQueryKey,
  useGetCustomer,
  useRemoveAdvisor,
  type ClientOnboardingStage,
  type CustomerDetail,
  type StaffMember,
} from "@atomprive/api-client/backoffice";
import { Alert, Avatar, Badge, Button, cn, IconButton } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, PencilLine, UserRoundCog, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link, useLocation, useParams } from "react-router";
import { useStaffUser } from "../../auth/session";
import { formatDate, formatRelative } from "../../lib/labels";
import { hasAnyAuthority, hasAuthority } from "../../lib/permissions";
import { ConfirmDialog } from "../config/confirm-dialog";
import { toForm } from "../onboarding/application";
import { ApplicationSummary } from "../onboarding/application-summary";
import { ProgressMeter } from "../onboarding/case-parts";
import { BankAccountsPanel } from "./bank-accounts-panel";
import { AssignAdvisorDialog } from "./assign-advisor-dialog";
import { EditClientDialog } from "./edit-client-dialog";
import {
  ActivityPanel,
  FamilyPanel,
  HoldingsPanel,
  ProposalsPanel,
  TransactionsPanel,
} from "./client-file-panels";
import { assignmentNotice, clientsHref, clientTypeLabels, kycStatusLabels, kycStatusTones } from "./client-labels";
import { ClientAccessPanel } from "./client-access-panel";
import { ClientFormsPanel } from "./client-forms-panel";

type Tab = "overview" | "family" | "advisors" | "banks" | "holdings" | "transactions" | "proposals" | "documents" | "activity";

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "family", label: "Family group" },
  { id: "advisors", label: "Advisors" },
  { id: "banks", label: "Bank accounts" },
  { id: "holdings", label: "Holdings" },
  { id: "transactions", label: "Transactions" },
  { id: "proposals", label: "Proposals" },
  { id: "documents", label: "Documents" },
  { id: "activity", label: "Activity" },
];

/** A client's whole file: who they are, their family group, their advisors and what has happened to them (#78). */
export function ClientPage() {
  const { clientId = "" } = useParams();
  const user = useStaffUser();
  const canAssign = hasAuthority(user, "ASSIGN_ADVISORS:CHANGE");
  // Whoever runs a team decides who on it sees this client, and so who reads their documents.
  const setsAccess = hasAuthority(user, "ASSIGN_WORK:CHANGE");
  // Everyone with access reads the file. Correcting it belongs to whoever manages the client's record:
  // an Admin, a head, or Compliance — not an officer who is there to fill the forms in.
  const canEdit = hasAnyAuthority(user, "MANAGE_USERS_AND_ROLES:CHANGE", "ASSIGN_WORK:CHANGE",
    "APPROVE_ONBOARDING:CHANGE");
  const location = useLocation();
  // The same file opens from All clients and from My clients. Back goes where they came from: an advisor has no
  // All clients screen to return to.
  const mine = location.pathname.startsWith("/my-clients");
  const backTo = mine ? "/my-clients" : clientsHref(location.state);
  const backLabel = mine ? "My clients" : "All clients";
  const queryClient = useQueryClient();
  const detail = useGetCustomer<CustomerDetail, ApiError>(clientId);
  // Coming back from one of the client's forms opens the tab it was reached from, rather than the top of
  // the file: whoever went into a document is on their way back to the rest of them.
  const [tab, setTab] = useState<Tab>(() => {
    const asked = (location.state as { tab?: string } | null)?.tab;
    return TABS.some((option) => option.id === asked) ? (asked as Tab) : "overview";
  });
  const [editing, setEditing] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [removing, setRemoving] = useState<StaffMember | null>(null);
  const [notice, setNotice] = useState<string>();
  const removeAdvisor = useRemoveAdvisor<ApiError>({
    mutation: {
      onSuccess: (updated) => {
        queryClient.setQueryData(getGetCustomerQueryKey(clientId), updated);
        void queryClient.invalidateQueries({ queryKey: getListCustomersQueryKey() });
        setNotice(`${removing?.fullName ?? "The advisor"} no longer looks after ${updated.client.fullName}.`);
        setRemoving(null);
      },
    },
  });

  if (!detail.data) {
    return (
      <div className="space-y-4">
        <BackLink to={backTo} label={backLabel} />
        {detail.isError ? (
          <Alert tone="danger">{detail.error.status === 404 ? "This client doesn't exist." : detail.error.message}</Alert>
        ) : (
          <p className="text-sm text-ink-muted">Loading the client…</p>
        )}
      </div>
    );
  }

  const { client, advisors, family, activity, application, onboarding } = detail.data;
  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <BackLink to={backTo} label={backLabel} />
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <Avatar name={client.fullName} className="size-14 text-base" />
            <div className="min-w-0">
              <h1 className="truncate text-[1.625rem] leading-tight font-bold">{client.fullName}</h1>
              <p className="mt-0.5 truncate text-sm text-ink-muted">
                {client.code} · {clientTypeLabels[client.type]}
                {client.email && ` · ${client.email}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* The papers on the client's file — their passport and proof of address — not the forms in
                their pack, which have statuses of their own. */}
            <Badge tone={kycStatusTones[client.kycStatus]}>
              KYC documents: {kycStatusLabels[client.kycStatus]}
            </Badge>
            {canEdit && (
              <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
                <PencilLine aria-hidden="true" />
                Edit client
              </Button>
            )}
          </div>
        </div>
        {/* Scrolls rather than wraps: a second row would break the line the tabs sit on. */}
        <div role="tablist" aria-label="Client file" className="flex gap-1 overflow-x-auto border-b border-line">
          {TABS.map((option) => (
            <button
              key={option.id}
              type="button"
              role="tab"
              aria-selected={tab === option.id}
              onClick={() => setTab(option.id)}
              className={cn(
                "-mb-px border-b-2 px-3 py-2 text-sm font-semibold whitespace-nowrap transition-colors",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600",
                tab === option.id ? "border-primary-600 text-primary-700" : "border-transparent text-ink-muted hover:text-ink",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </header>

      {notice && <Alert tone="success">{notice}</Alert>}

      {tab === "overview" && (
        <>
        <dl className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 xl:grid-cols-4">
          <Fact label="Client code">
            <span className="font-mono text-xs">{client.code}</span>
          </Fact>
          <Fact label="Registered">{formatDate(client.registeredAt)}</Fact>
          <Fact label="KYC documents">{kycStatusLabels[client.kycStatus]}</Fact>
          <Fact label="Linked banks">
            <span className="text-ink-muted" title="Filled in once bank linking is built">
              —
            </span>
          </Fact>
          <Fact label="Last login">{formatRelative(client.lastLoginAt, "Never")}</Fact>
        </dl>

        {setsAccess && <ClientAccessPanel clientId={clientId} />}

        {/* Where their onboarding stands, and what they were onboarded with: the same the case shows, on
            the client's own file, for whoever can open the client but not the case. */}
        {onboarding && <OnboardingStage stage={onboarding} />}

        {application && (
          <section aria-labelledby="application-title" className="space-y-4 rounded-2xl border border-line bg-white px-6 py-6">
            <div>
              <h2 id="application-title" className="text-base font-bold">
                Application
              </h2>
              <p className="mt-0.5 text-xs text-ink-muted">
                The details this client was onboarded with.
              </p>
            </div>
            <ApplicationSummary
              application={toForm(application)}
              managers={advisors.map(({ advisor }) => advisor)}
            />
          </section>
        )}

        </>
      )}

      {tab === "family" && <FamilyPanel client={client} family={family} />}
      {tab === "advisors" && (
        <section aria-labelledby="advisors-title" className="rounded-2xl border border-line bg-white">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-6 py-5">
            <div>
              <h2 id="advisors-title" className="text-base font-bold">
                Advisors
              </h2>
              <p className="mt-0.5 text-xs text-ink-muted">
                A client can have several advisors. Only they, and staff who see every client, can open this client.
              </p>
            </div>
            {canAssign && (
              <Button variant="secondary" size="sm" onClick={() => setAssigning(true)}>
                <UserRoundCog aria-hidden="true" />
                Assign advisor
              </Button>
            )}
          </div>
          {advisors.length === 0 ? (
            <p className="px-6 py-5 text-sm text-ink-muted">No advisor yet.</p>
          ) : (
            <ul className="divide-y divide-line">
              {advisors.map(({ advisor, since }) => (
                <li key={advisor.id} className="flex items-center justify-between gap-3 px-6 py-4">
                  <div className="flex items-center gap-3">
                    <Avatar name={advisor.fullName} className="size-10" />
                    <div>
                      <p className="text-sm font-semibold">{advisor.fullName}</p>
                      <p className="text-xs text-ink-muted">Advisor since {formatDate(since)}</p>
                    </div>
                  </div>
                  {canAssign && (
                    <IconButton
                      label={`Take ${advisor.fullName} off this client`}
                      tone="danger"
                      disabled={removeAdvisor.isPending}
                      onClick={() => setRemoving(advisor)}
                    >
                      <X />
                    </IconButton>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      {tab === "banks" && <BankAccountsPanel client={client} />}
      {tab === "holdings" && <HoldingsPanel />}
      {tab === "transactions" && <TransactionsPanel />}
      {tab === "proposals" && <ProposalsPanel />}
      {tab === "documents" && <ClientFormsPanel client={client} />}
      {tab === "activity" && <ActivityPanel activity={activity} />}

      <EditClientDialog
        client={editing ? client : null}
        onClose={() => setEditing(false)}
        onSaved={(saved) => {
          setEditing(false);
          setNotice(`Saved. ${saved.client.fullName}'s details are up to date.`);
        }}
      />
      <AssignAdvisorDialog
        open={assigning}
        clients={[client]}
        onClose={() => setAssigning(false)}
        onAssigned={(result) => {
          setAssigning(false);
          setNotice(assignmentNotice(result));
        }}
      />
      <ConfirmDialog
        open={removing !== null}
        title={`Take ${removing?.fullName ?? "this advisor"} off ${client.fullName}?`}
        description="They stop seeing this client straight away. You can give the client back to them later."
        confirmLabel="Take them off"
        tone="danger"
        busy={removeAdvisor.isPending}
        onConfirm={() => removing && removeAdvisor.mutate({ id: client.id, advisorId: removing.id })}
        onClose={() => setRemoving(null)}
      />
    </div>
  );
}

function BackLink({ to, label }: { to: string; label: string }) {
  return (
    <Link to={to} className="inline-flex items-center gap-1 text-sm font-medium text-ink-muted hover:text-primary-700">
      <ChevronLeft aria-hidden="true" className="size-4" />
      {label}
    </Link>
  );
}

/** Where the client's onboarding got to, read the way the onboarding case reads it. */
function OnboardingStage({ stage }: { stage: ClientOnboardingStage }) {
  return (
    <>
      {stage.signOff === "AWAITING" && <Alert tone="info">This case is with Compliance for KYC sign-off.</Alert>}
      {stage.signOff === "RETURNED" && (
        <Alert tone="warning">
          Compliance sent this back{stage.signOffComment ? `: ${stage.signOffComment}` : "."}
        </Alert>
      )}
      {stage.signOff === "APPROVED" && <Alert tone="success">Compliance have signed the KYC off.</Alert>}
      {!stage.submitted && <Alert tone="info">This application is still a draft.</Alert>}

      <dl className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 xl:grid-cols-4">
        <Fact label="Relationship manager">
          {stage.relationshipManager ? (
            <span className="flex items-center gap-2">
              <Avatar name={stage.relationshipManager.fullName} className="size-6 text-3xs" />
              {stage.relationshipManager.fullName}
            </span>
          ) : (
            "Not chosen yet"
          )}
        </Fact>
        <Fact label="Started">{formatDate(stage.startedAt)}</Fact>
        <Fact label="Submitted">{stage.submittedAt ? formatDate(stage.submittedAt) : "Not yet"}</Fact>
        <Fact label="Current stage">
          <span className="block">{stage.currentStage}</span>
          <ProgressMeter done={stage.completedSteps} total={stage.totalSteps} className="mt-2" />
        </Fact>
      </dl>
    </>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="bg-white px-5 py-4">
      <dt className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-ink">{children}</dd>
    </div>
  );
}
