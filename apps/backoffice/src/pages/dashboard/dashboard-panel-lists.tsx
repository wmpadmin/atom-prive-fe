import { ApiError } from "@atomprive/api-client";
import {
  useClientsWithSessions,
  useGetClientDirectory,
  useListAuditEvents,
  useListCustomers,
  useListSyncRuns,
  useStaffWithSessions,
  useSupportQueue,
  type AuditLogPage,
  type ClientDirectory,
  type ClientWhoSignedIn,
  type CustomerPage,
  type CustomerRow,
  type DirectoryClient,
  type ListCustomersParams,
  type ListSyncRunsOutcome,
  type SyncRunPage,
  type TicketRow,
  type WhoSignedIn,
} from "@atomprive/api-client/backoffice";
import { statusLabel } from "@atomprive/support/ticket-status-label";
import { formatRelative } from "../../lib/labels";
import { FigureBody } from "../client-workspace/figure-panel";
import { money } from "./dashboard-kit";

/**
 * The lists a dashboard figure's side panel reads when it opens: the clients, tickets, sessions, bank syncs or
 * audit events behind it. Each is read with the screen's own generated hook; nothing is counted by hand here.
 */

function Quiet({ children }: { children: string }) {
  return <p className="text-sm text-ink-muted">{children}</p>;
}

const clientLink = (customerId: string) => `/client-workspace/${customerId}`;

/** A first-of-many note where a list holds more than one read brings back. */
function firstOf(shown: number, total: number) {
  return total > shown ? `The first ${shown} of ${total}.` : undefined;
}

/**
 * The firm's clients from the client directory, biggest first: what each holds now, or at one month end of their
 * own AUM trend where a month is named. Narrowed by keep where only some belong.
 */
export function DirectoryClients({ currency, title, on, keep, empty = "No client is listed here." }: {
  currency: string;
  title: string;
  /** A month end (yyyy-mm-dd): each client's AUM on that day of their trend, in place of today's. */
  on?: string;
  keep?: (client: DirectoryClient) => boolean;
  empty?: string;
}) {
  const read = useGetClientDirectory<ClientDirectory, ApiError>({ currency });
  if (read.isError) return <Quiet>{`The clients could not be read: ${read.error.message}`}</Quiet>;
  if (!read.data) return <Quiet>Reading the clients…</Quiet>;
  const amountOf = (client: DirectoryClient) => {
    if (!on) return client.aum;
    const point = client.trend.find((one) => one.on === on) ?? client.trend.find((one) => one.on.slice(0, 7) === on.slice(0, 7));
    return point ? point.amount : null;
  };
  const clients = read.data.clients
    .filter((one) => !keep || keep(one))
    .map((one) => ({ one, amount: amountOf(one) }))
    .sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0));
  if (clients.length === 0) return <Quiet>{empty}</Quiet>;
  return (
    <FigureBody wide={false} figure={{
      label: "",
      note: on ? "Each client's figure is read from their own AUM trend at that month end; — where the trend has no point for it." : undefined,
      table: {
        title,
        columns: ["Client", `AUM (${read.data.currency})`, "Relationship manager"],
        rows: clients.map(({ one, amount }) => [one.name, amount == null ? null : money(amount, read.data.currency), one.relationshipManager]),
        links: clients.map(({ one }) => clientLink(one.customerId)),
      },
    }} />
  );
}

const KYC_WORDS: Record<string, string> = {
  NOT_SUBMITTED: "Not submitted", PENDING: "Pending", APPROVED: "Approved", REJECTED: "Rejected", EXPIRED: "Expired",
};

/** Clients from the client list, as its filters read them, narrowed by keep where the filters cannot say it all. */
export function CustomerList({ params, keep, title, empty = "No client is listed here." }: {
  params: ListCustomersParams;
  keep?: (row: CustomerRow) => boolean;
  title: string;
  empty?: string;
}) {
  const read = useListCustomers<CustomerPage, ApiError>({ ...params, size: 100 });
  if (read.isError) return <Quiet>{`The clients could not be read: ${read.error.message}`}</Quiet>;
  if (!read.data) return <Quiet>Reading the clients…</Quiet>;
  const rows = read.data.items.filter((one) => !keep || keep(one));
  if (rows.length === 0) return <Quiet>{empty}</Quiet>;
  return (
    <FigureBody wide={false} figure={{
      label: "",
      note: firstOf(read.data.items.length, read.data.totalItems),
      table: {
        title,
        columns: ["Client", "Code", "KYC", "Relationship manager"],
        rows: rows.map((one) => [one.fullName, one.code, KYC_WORDS[one.kycStatus] ?? one.kycStatus,
          one.advisors.map((who) => who.fullName).join(", ") || null]),
        links: rows.map((one) => clientLink(one.id)),
      },
    }} />
  );
}

const OUTCOME_WORDS: Record<string, string> = { RUNNING: "Running", SUCCEEDED: "Succeeded", FAILED: "Failed" };

/** Bank syncs from the ingestion monitor, newest first, each opening its bank's feed. */
export function SyncRuns({ outcome, from, title, empty = "No bank sync is listed here." }: {
  outcome?: ListSyncRunsOutcome;
  from?: string;
  title: string;
  empty?: string;
}) {
  const read = useListSyncRuns<SyncRunPage, ApiError>({ outcome, from, size: 25 });
  if (read.isError) return <Quiet>{`The bank syncs could not be read: ${read.error.message}`}</Quiet>;
  if (!read.data) return <Quiet>Reading the bank syncs…</Quiet>;
  const rows = read.data.items;
  if (rows.length === 0) return <Quiet>{empty}</Quiet>;
  return (
    <FigureBody wide={false} figure={{
      label: "",
      note: firstOf(rows.length, read.data.totalItems),
      table: {
        title,
        columns: ["Bank", "Account", "Started", "Outcome", "Fetched"],
        rows: rows.map((one) => [one.bankName, one.accountLabel, formatRelative(one.startedAt), OUTCOME_WORDS[one.outcome] ?? one.outcome, one.fetched]),
        links: rows.map((one) => `/ingestion/${one.bankId}`),
      },
    }} />
  );
}

/** Support tickets from the support queue, narrowed to those that make up the figure, each opening its ticket. */
export function TicketList({ keep, title, empty = "No ticket is listed here." }: {
  keep: (ticket: TicketRow) => boolean;
  title: string;
  empty?: string;
}) {
  const read = useSupportQueue<TicketRow[], ApiError>();
  if (read.isError) return <Quiet>{`The tickets could not be read: ${read.error.message}`}</Quiet>;
  if (!read.data) return <Quiet>Reading the tickets…</Quiet>;
  const rows = read.data.filter(keep).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  if (rows.length === 0) return <Quiet>{empty}</Quiet>;
  return (
    <FigureBody wide={false} figure={{
      label: "",
      table: {
        title,
        columns: ["Ticket", "Subject", "Status", "Raised by", "Updated"],
        rows: rows.map((one) => [one.reference, one.subject, statusLabel(one.status, "support"), one.raisedByName, formatRelative(one.updatedAt)]),
        links: rows.map((one) => `/support/${one.id}`),
      },
    }} />
  );
}

/** Staff with a session still live, from the sessions screen's list, each opening their account. */
export function StaffSessionList() {
  const read = useStaffWithSessions<WhoSignedIn[], ApiError>();
  if (read.isError) return <Quiet>{`The staff sessions could not be read: ${read.error.message}`}</Quiet>;
  if (!read.data) return <Quiet>Reading who is signed in…</Quiet>;
  const rows = read.data.filter((one) => one.latest?.live);
  if (rows.length === 0) return <Quiet>No member of staff has a live session.</Quiet>;
  return (
    <FigureBody wide={false} figure={{
      label: "",
      note: "One line per person, by their latest session; someone signed in on two devices is listed once.",
      table: {
        title: "Staff signed in",
        columns: ["Staff", "Device", "Signed in", "Last active"],
        rows: rows.map((one) => [one.fullName, one.latest?.device ?? null, formatRelative(one.latest?.signedInAt),
          formatRelative(one.latest?.lastActiveAt)]),
        links: rows.map((one) => `/users/${one.personId}`),
      },
    }} />
  );
}

/** Clients with a way into the portal, from the sessions screen's list: every one, or only those signed in now. */
export function ClientSessionList({ live }: { live: boolean }) {
  const read = useClientsWithSessions<ClientWhoSignedIn[], ApiError>();
  if (read.isError) return <Quiet>{`The client logins could not be read: ${read.error.message}`}</Quiet>;
  if (!read.data) return <Quiet>Reading the client logins…</Quiet>;
  const rows = live ? read.data.filter((one) => one.latest?.live) : read.data;
  if (rows.length === 0) return <Quiet>{live ? "No client has a live session." : "No client has a portal login yet."}</Quiet>;
  return (
    <FigureBody wide={false} figure={{
      label: "",
      note: live ? "One line per client, by their latest session; a client signed in on two devices is listed once." : undefined,
      table: {
        title: live ? "Clients signed in" : "Client portal logins",
        columns: ["Client", "Last signed in", "Last active"],
        rows: rows.map((one) => [one.fullName, formatRelative(one.latest?.signedInAt), formatRelative(one.latest?.lastActiveAt)]),
        links: rows.map((one) => clientLink(one.customerId)),
      },
    }} />
  );
}

/** Audit events of the named actions since a moment, as the audit log reads them; a client's line opens them. */
export function AuditEventList({ actions, from, title }: { actions: string[]; from: string; title: string }) {
  const read = useListAuditEvents<AuditLogPage, ApiError>({ actions, from, size: 100 });
  if (read.isError) return <Quiet>{`The audit events could not be read: ${read.error.message}`}</Quiet>;
  if (!read.data) return <Quiet>Reading the audit log…</Quiet>;
  const rows = read.data.items;
  if (rows.length === 0) return <Quiet>No such event in the period.</Quiet>;
  return (
    <FigureBody wide={false} figure={{
      label: "",
      note: firstOf(rows.length, read.data.totalItems),
      table: {
        title,
        columns: ["When", "Event", "By", "About"],
        rows: rows.map((one) => [formatRelative(one.occurredAt), one.actionLabel, one.actorName ?? "System", one.targetLabel]),
        links: rows.map((one) => (one.clientId ? clientLink(one.clientId) : null)),
      },
    }} />
  );
}
