import { ApiError } from "@atomprive/api-client";
import {
  getGetCustomerQueryKey,
  getListCustomersQueryKey,
  useGetCustomer,
  useRemoveAdvisor,
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
import { hasAuthority } from "../../lib/permissions";
import { ConfirmDialog } from "../config/confirm-dialog";
import { AssignAdvisorDialog } from "./assign-advisor-dialog";
import { EditClientDialog } from "./edit-client-dialog";
import {
  ActivityPanel,
  BankAccountsPanel,
  DocumentsPanel,
  FamilyPanel,
  HoldingsPanel,
  ProposalsPanel,
  TransactionsPanel,
} from "./client-file-panels";
import { assignmentNotice, clientsHref, clientTypeLabels, kycStatusLabels, kycStatusTones } from "./client-labels";

type Tab = "overview" | "family" | "banks" | "holdings" | "transactions" | "proposals" | "documents" | "activity";

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "family", label: "Family group" },
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
  // Everyone with access reads the file; only full access to every client can correct it.
  const canEdit = hasAuthority(user, "VIEW_ALL_CLIENTS:CHANGE");
  const location = useLocation();
  // The same file opens from All clients and from My clients. Back goes where they came from: an advisor has no
  // All clients screen to return to.
  const mine = location.pathname.startsWith("/my-clients");
  const backTo = mine ? "/my-clients" : clientsHref(location.state);
  const backLabel = mine ? "My clients" : "All clients";
  const queryClient = useQueryClient();
  const detail = useGetCustomer<CustomerDetail, ApiError>(clientId);
  const [tab, setTab] = useState<Tab>("overview");
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

  const { client, advisors, family, activity } = detail.data;
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
            <Badge tone={kycStatusTones[client.kycStatus]}>KYC: {kycStatusLabels[client.kycStatus]}</Badge>
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
          <Fact label="KYC status">{kycStatusLabels[client.kycStatus]}</Fact>
          <Fact label="Linked banks">
            <span className="text-ink-muted" title="Filled in once bank linking is built">
              —
            </span>
          </Fact>
          <Fact label="Last login">{formatRelative(client.lastLoginAt, "Never")}</Fact>
        </dl>

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
        </>
      )}

      {tab === "family" && <FamilyPanel client={client} family={family} />}
      {tab === "banks" && <BankAccountsPanel />}
      {tab === "holdings" && <HoldingsPanel />}
      {tab === "transactions" && <TransactionsPanel />}
      {tab === "proposals" && <ProposalsPanel />}
      {tab === "documents" && <DocumentsPanel />}
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

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="bg-white px-5 py-4">
      <dt className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-ink">{children}</dd>
    </div>
  );
}
