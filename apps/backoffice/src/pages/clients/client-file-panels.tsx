import type { ClientEvent, CustomerDetail, FamilyMember } from "@atomprive/api-client/backoffice";
import { Avatar, Badge } from "@atomprive/ui";
import { Banknote, FileSignature, ReceiptText, ScrollText, Wallet } from "lucide-react";
import type { ReactNode } from "react";
import { Link, useLocation } from "react-router";
import { formatDateTime } from "../../lib/labels";
import { clientsHref, kycStatusLabels, kycStatusTones } from "./client-labels";

/** What each still-to-come section is waiting for, said plainly rather than left blank. */
export function WaitingPanel({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="grid place-items-center rounded-2xl border border-dashed border-line bg-white px-6 py-14 text-center">
      <span className="grid size-11 place-items-center rounded-xl bg-primary-50 text-primary-600 [&_svg]:size-5" aria-hidden="true">
        {icon}
      </span>
      <p className="mt-3 font-semibold">{title}</p>
      <p className="mt-1 max-w-md text-sm text-ink-muted">{children}</p>
    </section>
  );
}

export function BankAccountsPanel() {
  return (
    <WaitingPanel icon={<Banknote />} title="No linked bank accounts yet">
      Accounts and their connection status appear here once the bank connections are built. That work is waiting on API
      or file access from each bank.
    </WaitingPanel>
  );
}

export function HoldingsPanel() {
  return (
    <WaitingPanel icon={<Wallet />} title="No holdings yet">
      Positions across every linked bank, with the allocation chart, are filled in once bank data is flowing.
    </WaitingPanel>
  );
}

export function TransactionsPanel() {
  return (
    <WaitingPanel icon={<ReceiptText />} title="No transactions yet">
      Transaction history comes from the banks, alongside holdings.
    </WaitingPanel>
  );
}

export function ProposalsPanel() {
  return (
    <WaitingPanel icon={<FileSignature />} title="No proposals yet">
      Pending and past proposals appear here once proposals are built.
    </WaitingPanel>
  );
}

export function DocumentsPanel() {
  return (
    <WaitingPanel icon={<ScrollText />} title="No KYC documents yet">
      Uploaded identity and address documents appear here once KYC review is built.
    </WaitingPanel>
  );
}

/** Everyone onboarded on the same application, this client included. */
export function FamilyPanel({ client, family }: { client: CustomerDetail["client"]; family: FamilyMember[] }) {
  const location = useLocation();
  const backTo = clientsHref(location.state);
  if (family.length === 0) {
    return (
      <WaitingPanel icon={<Wallet />} title="Onboarded on their own">
        This client came in on their own application, so there is no family group. Joint holders onboarded together
        appear here.
      </WaitingPanel>
    );
  }
  return (
    <section aria-labelledby="family-title" className="rounded-2xl border border-line bg-white">
      <div className="border-b border-line px-6 py-5">
        <h2 id="family-title" className="text-base font-bold">
          Family group
        </h2>
        <p className="mt-0.5 text-xs text-ink-muted">Everyone onboarded on the same application.</p>
      </div>
      <ul className="divide-y divide-line">
        {family.map((member) => (
          <li key={member.id} className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
            <div className="flex min-w-0 items-center gap-3">
              <Avatar name={member.fullName} />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">
                  {member.id === client.id ? (
                    <>
                      {member.fullName} <span className="text-xs font-normal text-ink-muted">· this client</span>
                    </>
                  ) : (
                    <Link to={`/clients/${member.id}`} state={{ from: backTo }} className="hover:text-primary-700">
                      {member.fullName}
                    </Link>
                  )}
                </p>
                <p className="truncate text-xs text-ink-muted">
                  {member.code}
                  {member.email && ` · ${member.email}`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {member.relationship && <Badge>{relationshipLabels[member.relationship] ?? member.relationship}</Badge>}
              <Badge tone={kycStatusTones[member.kycStatus]}>{kycStatusLabels[member.kycStatus]}</Badge>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

const relationshipLabels: Record<string, string> = {
  SPOUSE: "Spouse",
  CHILD: "Child",
  PARENT: "Parent",
  SIBLING: "Sibling",
  OTHER: "Other relative",
};

/** Everything that has happened to this client, newest first, from the same trail the Audit log reads. */
export function ActivityPanel({ activity }: { activity: ClientEvent[] }) {
  if (activity.length === 0) {
    return (
      <WaitingPanel icon={<ScrollText />} title="Nothing recorded yet">
        Registration, advisor changes and every time someone opens this file are recorded here.
      </WaitingPanel>
    );
  }
  return (
    <section aria-labelledby="activity-title" className="rounded-2xl border border-line bg-white">
      <div className="border-b border-line px-6 py-5">
        <h2 id="activity-title" className="text-base font-bold">
          Activity
        </h2>
        <p className="mt-0.5 text-xs text-ink-muted">
          From the audit trail, which cannot be changed. The Audit log screen has the full history.
        </p>
      </div>
      <ol className="divide-y divide-line">
        {activity.map((event, index) => (
          <li key={`${event.occurredAt}-${index}`} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-6 py-3">
            <p className="text-sm font-medium">
              {event.description}
              {event.byWhom && <span className="font-normal text-ink-muted"> · {event.byWhom}</span>}
              {event.theirRole && <span className="font-normal text-ink-muted"> ({roleLabel(event.theirRole)})</span>}
              {/* Done for the client rather than to them, which is most of what the back office does here. */}
              {event.onBehalfOf && (
                <span className="font-normal text-ink-muted"> on behalf of {event.onBehalfOf}</span>
              )}
            </p>
            <p className="text-xs whitespace-nowrap text-ink-muted tabular-nums">{formatDateTime(event.occurredAt)}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function roleLabel(code: string) {
  return code.charAt(0) + code.slice(1).toLowerCase().replaceAll("_", " ");
}
