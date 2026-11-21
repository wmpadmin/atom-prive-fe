import { ApiError } from "@atomprive/api-client";
import {
  useGetClientDirectory,
  useListCustomers,
  useListMine,
  useListMyClients,
  useListOnboardingCases,
  useListPacksToSign,
  useListProspects,
  useListSyncRuns,
  type CasePage,
  type CaseSummary,
  type ClientDirectory,
  type CustomerPage,
  type CustomerRow,
  type ListCustomersKycStatus,
  type ListOnboardingCasesSignOff,
  type ListOnboardingCasesStatus,
  type ListProspectsStatusItem,
  type ListSyncRunsOutcome,
  type MyDeclarationRow,
  type ProspectPage,
  type SignaturePackPage,
  type SyncRunPage,
} from "@atomprive/api-client/backoffice";
import { formatDate, formatDateTime } from "../../lib/labels";
import { FigureBody } from "../client-workspace/figure-panel";
import { money } from "./dashboard-kit";

/**
 * The lists the Compliance, Operations and relationship manager dashboards' side panels read when they open: the
 * clients, cases, prospects, feed runs, packs and declarations behind a count, each read with the screen's own
 * generated hook. Nothing here is worked out by hand; where no list answers a figure, the panel says so (NoListYet).
 */

/** Where a line opens, by the id it carries, or null where the reader may not open it. */
export type LineLink = (id: string) => string | null;

const SIZE = 100;

function Quiet({ children }: { children: string }) {
  return <p className="text-sm text-ink-muted">{children}</p>;
}

/** Said where a figure is counted on the server but no list of what it counts can be read yet. */
export function NoListYet({ what }: { what: string }) {
  return (
    <p className="rounded-xl border border-dashed border-line px-4 py-3 text-sm text-ink-muted">
      {`The list of ${what} isn't available yet; only the count is.`}
    </p>
  );
}

function firstOf(rows: number, total: number) {
  return total > rows ? `The first ${rows} of ${total}.` : undefined;
}

const KYC_LABEL: Record<string, string> = {
  NOT_SUBMITTED: "Not submitted", PENDING: "In review", APPROVED: "Approved", REJECTED: "Rejected", EXPIRED: "Expired",
};

/**
 * Clients in one KYC status — the firm's, or only the reader's own with mine — read from the clients list; with
 * registeredFrom, only those who joined since. activeOnly keeps the active ones, as the figure counts them.
 */
export function ClientsInKyc({ status, mine = false, registeredFrom, activeOnly = false, title, linkFor }: {
  status?: ListCustomersKycStatus;
  mine?: boolean;
  registeredFrom?: string;
  activeOnly?: boolean;
  title: string;
  linkFor: LineLink;
}) {
  const params = { kycStatus: status, registeredFrom, page: 0, size: SIZE };
  const firm = useListCustomers<CustomerPage, ApiError>(params, { query: { enabled: !mine } });
  const own = useListMyClients<CustomerPage, ApiError>(params, { query: { enabled: mine } });
  const read = mine ? own : firm;
  if (read.isError) return <Quiet>{`These clients could not be read: ${read.error.message}`}</Quiet>;
  if (!read.data) return <Quiet>Reading the clients…</Quiet>;
  const rows: CustomerRow[] = activeOnly ? read.data.items.filter((one) => one.status === "ACTIVE") : read.data.items;
  if (rows.length === 0) return <Quiet>{`${title}: none.`}</Quiet>;
  return (
    <FigureBody wide={false} figure={{
      label: "",
      note: firstOf(read.data.items.length, read.data.totalItems),
      table: {
        title,
        columns: ["Client", "Code", "KYC", "Joined"],
        rows: rows.map((one) => [one.fullName, one.code, KYC_LABEL[one.kycStatus] ?? one.kycStatus, formatDate(one.registeredAt)]),
        links: rows.map((one) => linkFor(one.id)),
      },
    }} />
  );
}

/** Onboarding cases in one status or sign-off, as the case list returns them; keep narrows them as the figure counts. */
export function Cases({ status, signOff, keep, title, linkFor }: {
  status?: ListOnboardingCasesStatus;
  signOff?: ListOnboardingCasesSignOff;
  keep?: (one: CaseSummary) => boolean;
  title: string;
  linkFor: LineLink;
}) {
  const read = useListOnboardingCases<CasePage, ApiError>({ status, signOff, page: 0, size: SIZE });
  if (read.isError) return <Quiet>{`The cases could not be read: ${read.error.message}`}</Quiet>;
  if (!read.data) return <Quiet>Reading the cases…</Quiet>;
  const rows = keep ? read.data.items.filter(keep) : read.data.items;
  const partial = read.data.totalItems > read.data.items.length;
  if (rows.length === 0) {
    return <Quiet>{partial ? `None among the first ${read.data.items.length} cases read.` : `${title}: none.`}</Quiet>;
  }
  return (
    <FigureBody wide={false} figure={{
      label: "",
      note: partial ? `Read from the first ${read.data.items.length} of ${read.data.totalItems} cases.` : undefined,
      table: {
        title,
        columns: ["Client", "Stage", "Steps", "Started", "Updated"],
        rows: rows.map((one) => [one.clientName, readable(one.currentStage), `${one.completedSteps}/${one.totalSteps}`,
          formatDate(one.startedAt), formatDateTime(one.updatedAt)]),
        links: rows.map((one) => linkFor(one.id)),
      },
    }} />
  );
}

const PROSPECT_LABEL: Record<string, string> = {
  NEW: "New", IN_DISCUSSION: "In discussion", FOLLOW_UP: "Follow-up", QUALIFIED: "Qualified", CONVERTED: "Converted", LOST: "Lost",
};

/** Prospects at one stage of the pipeline. */
export function Prospects({ status, title, linkFor }: { status: ListProspectsStatusItem; title: string; linkFor: LineLink }) {
  const read = useListProspects<ProspectPage, ApiError>({ status: [status], page: 0, size: SIZE });
  if (read.isError) return <Quiet>{`The prospects could not be read: ${read.error.message}`}</Quiet>;
  if (!read.data) return <Quiet>Reading the prospects…</Quiet>;
  const rows = read.data.items;
  if (rows.length === 0) return <Quiet>{`${title}: none.`}</Quiet>;
  return (
    <FigureBody wide={false} figure={{
      label: "",
      note: firstOf(rows.length, read.data.total),
      table: {
        title,
        columns: ["Prospect", "Stage", "Assigned to", "Next follow-up"],
        rows: rows.map((one) => [one.fullName, PROSPECT_LABEL[one.status] ?? one.status, one.assignedTo?.fullName ?? null,
          one.nextFollowUp ? `${formatDate(one.nextFollowUp)}${one.overdue ? " (overdue)" : ""}` : null]),
        links: rows.map((one) => linkFor(one.id)),
      },
    }} />
  );
}

/** Bank feed runs since a moment, of one outcome or all; each line opens its bank's feed. */
export function FeedRuns({ outcome, from, title, linkFor }: { outcome?: ListSyncRunsOutcome; from: string; title: string; linkFor: LineLink }) {
  const read = useListSyncRuns<SyncRunPage, ApiError>({ outcome, from, page: 0, size: SIZE });
  if (read.isError) return <Quiet>{`The feed runs could not be read: ${read.error.message}`}</Quiet>;
  if (!read.data) return <Quiet>Reading the feed runs…</Quiet>;
  const rows = read.data.items;
  if (rows.length === 0) return <Quiet>{`${title}: none.`}</Quiet>;
  return (
    <FigureBody wide={false} figure={{
      label: "",
      note: firstOf(rows.length, read.data.totalItems),
      table: {
        title,
        columns: ["Bank", "Account", "Started", "Outcome", "Fetched", "Errors"],
        rows: rows.map((one) => [one.bankName, one.accountLabel, formatDateTime(one.startedAt), one.outcome.toLowerCase(),
          one.fetched, one.validationErrors]),
        links: rows.map((one) => linkFor(one.bankId)),
      },
    }} />
  );
}

/** The reader's own declarations, outstanding first. */
export function OwnDeclarationList({ linkFor }: { linkFor: LineLink }) {
  const read = useListMine<MyDeclarationRow[], ApiError>();
  if (read.isError) return <Quiet>{`Your declarations could not be read: ${read.error.message}`}</Quiet>;
  if (!read.data) return <Quiet>Reading your declarations…</Quiet>;
  const rows = [...read.data].sort((a, b) => Number(a.signed) - Number(b.signed));
  if (rows.length === 0) return <Quiet>No declaration is asked of you.</Quiet>;
  return (
    <FigureBody wide={false} figure={{
      label: "",
      table: {
        title: "Your declarations",
        columns: ["Declaration", "Schedule", "Status", "Due"],
        rows: rows.map((one) => [one.title, one.schedule,
          one.signed ? `Signed${one.signedOn ? ` ${formatDate(one.signedOn)}` : ""}` : one.overdue ? "Overdue" : "Outstanding",
          one.dueOn ? formatDate(one.dueOn) : null]),
        links: rows.map((one) => linkFor(one.kind)),
      },
    }} />
  );
}

/** Onboarding packs waiting on the reader's signature; each line opens the client. */
export function PacksToSign({ linkFor }: { linkFor: LineLink }) {
  const read = useListPacksToSign<SignaturePackPage, ApiError>({ page: 0, size: SIZE });
  if (read.isError) return <Quiet>{`The packs could not be read: ${read.error.message}`}</Quiet>;
  if (!read.data) return <Quiet>Reading the packs…</Quiet>;
  const rows = read.data.items;
  if (rows.length === 0) return <Quiet>No pack is waiting on your signature.</Quiet>;
  return (
    <FigureBody wide={false} figure={{
      label: "",
      note: firstOf(rows.length, read.data.totalItems),
      table: {
        title: "Packs to sign",
        columns: ["Client", "Pack", "Status", "Forms to sign", "Due"],
        rows: rows.map((one) => [one.clientName, one.reference, one.statusLabel, one.formsToSign,
          one.dueOn ? `${formatDate(one.dueOn)}${one.overdue ? " (overdue)" : ""}` : null]),
        links: rows.map((one) => linkFor(one.customerId)),
      },
    }} />
  );
}

/** The reader's clients by AUM, biggest first, as the client directory reads them. */
export function ClientsByAum({ currency, linkFor }: { currency: string; linkFor: LineLink }) {
  const read = useGetClientDirectory<ClientDirectory, ApiError>({ currency });
  if (read.isError) return <Quiet>{`The clients could not be read: ${read.error.message}`}</Quiet>;
  if (!read.data) return <Quiet>Reading the clients…</Quiet>;
  const rows = [...read.data.clients].sort((a, b) => (b.aum ?? 0) - (a.aum ?? 0));
  if (rows.length === 0) return <Quiet>No client to list.</Quiet>;
  return (
    <FigureBody wide={false} figure={{
      label: "",
      note: `As of ${formatDate(read.data.asOf)}.`,
      table: {
        title: "Clients by AUM",
        columns: ["Client", `AUM (${read.data.currency})`, "Mandate", "Status"],
        rows: rows.map((one) => [one.name, one.aum == null ? null : money(one.aum, read.data.currency), one.mandate, readable(one.status)]),
        links: rows.map((one) => linkFor(one.customerId)),
      },
    }} />
  );
}

/** A code as the API sends it ("KYC_REVIEW", "NEAR_EDGE") written as words ("KYC review", "Near edge"). */
function readable(code: string | null | undefined) {
  if (!code) return null;
  const words = code.toLowerCase().replace(/_/g, " ").replace(/\b(kyc|aml|ips|crs|rm|pm)\b/g, (short) => short.toUpperCase());
  return words.charAt(0).toUpperCase() + words.slice(1);
}
