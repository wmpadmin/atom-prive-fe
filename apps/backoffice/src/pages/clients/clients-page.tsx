import { ApiError } from "@atomprive/api-client";
import {
  exportCustomers,
  useListCustomerAdvisors,
  useListCustomers,
  useListMyClients,
  useListProposals,
  type CustomerPage,
  type CustomerRow,
  type DraftRow,
  type ProposalPage,
  type ProposalRow,
  type StaffMember,
} from "@atomprive/api-client/backoffice";
import { Alert, Avatar, Badge, Button, cn, DateInput, SelectInput } from "@atomprive/ui";
import { keepPreviousData } from "@tanstack/react-query";
import { Briefcase, Download, UserRoundCog } from "lucide-react";
import { useMemo, useState, type MouseEvent, type ReactNode } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router";
import { useStaffUser } from "../../auth/session";
import { ColumnPicker } from "../../components/column-picker";
import { ClearFiltersLink, ListPageHeader, RecordList } from "../../components/record-list";
import { ViewTabs } from "../../components/view-tabs";
import { useColumnDrag } from "../../lib/column-drag";
import { useTableView } from "../../lib/table-view";
import { formatDate, formatRelative } from "../../lib/labels";
import { downloadTextFile } from "../../lib/download";
import { hasAnyAuthority, hasAuthority, ONBOARDS_CLIENTS_CHANGE } from "../../lib/permissions";
import { PAGE_SIZES } from "../../lib/page-sizes";
import { useListAddress, useTypedSearch } from "../../lib/use-list-address";
import { proposalStatusLabels, proposalStatusTones } from "../advisor/proposal-labels";
import { AssignAdvisorDialog, type ClientToAssign } from "./assign-advisor-dialog";
import { AssignPortfolioManagerDialog } from "./assign-portfolio-manager-dialog";
import { assignmentNotice, clientKindLabels, clientTypeLabels, kycStatuses, kycStatusLabels,
  kycStatusTones, managerAssignmentNotice, type KycStatus } from "./client-labels";
import { ClientSearch } from "./client-search";
import { StaffStack } from "./staff-stack";


const EARLIEST_REGISTRATION = new Date(2000, 0, 1);

/**
 * Whoever else holds this client's account. Read through here rather than off the row, so a list served by an
 * API that predates joint accounts being grouped reads as nobody else rather than bringing the screen down.
 */
function heldWith(customer: CustomerRow): CustomerRow["heldWith"] {
  return customer.heldWith ?? [];
}

/**
 * Everyone on the account this row is for. A joint account is one row, so giving that row a relationship
 * manager means giving the account one — the holder it happens to open on is not the only person on it. The
 * same holds for a portfolio manager: it is the account's portfolio, not one holder's.
 */
function everyHolderOf(customer: CustomerRow): ClientToAssign[] {
  return [
    { id: customer.id, fullName: customer.fullName, advisors: customer.advisors,
      portfolioManagers: customer.portfolioManagers },
    ...heldWith(customer).map((held) => ({ id: held.id, fullName: held.fullName, advisors: held.advisors,
      portfolioManagers: held.portfolioManagers })),
  ];
}

/** Whoever advises anybody on the account, named once however many holders they look after. */
function advisorsOn(customer: CustomerRow): StaffMember[] {
  const byId = new Map(customer.advisors.map((advisor) => [advisor.id, advisor]));
  for (const held of heldWith(customer)) {
    for (const advisor of held.advisors ?? []) byId.set(advisor.id, advisor);
  }
  return [...byId.values()].sort((one, other) => one.fullName.localeCompare(other.fullName));
}

/** The same reading of the account for the other desk: whoever manages anybody holding it, named once. */
function managersOn(customer: CustomerRow): StaffMember[] {
  const byId = new Map(customer.portfolioManagers.map((manager) => [manager.id, manager]));
  for (const held of heldWith(customer)) {
    for (const manager of held.portfolioManagers ?? []) byId.set(manager.id, manager);
  }
  return [...byId.values()].sort((one, other) => one.fullName.localeCompare(other.fullName));
}


/** One column beside the client's name: its heading, and what it draws on a row. */
/**
 * What a case still being entered puts in a client's column.
 *
 * <p>A dash wherever the answer is "nobody has been registered yet". That is most of them, and it is
 * the honest reading: there is no client code because no code has been issued, no KYC because nothing
 * has been asked for, and no last login because there is nobody to log in.
 */
function draftCell(columnId: string, draft: DraftRow) {
  if (columnId === "onboarding") {
    return (
      <span className="font-medium text-ink">
        {draft.stage}
        <span className="text-ink-muted">
          {" · "}
          {draft.stepsDone}/{draft.stepsInAll}
        </span>
      </span>
    );
  }
  if (columnId === "clientType") {
    return clientTypeOfDraft(draft.clientType);
  }
  if (columnId === "advisors") {
    return <StaffStack people={draft.relationshipManager ? [draft.relationshipManager] : []} desk="relationship managers" />;
  }
  return <span className="text-ink-muted">—</span>;
}

/** The case's own word for what kind of client this will be, said the way the list says it. */
function clientTypeOfDraft(clientType: string) {
  const known = clientKindLabels[clientType as keyof typeof clientKindLabels];
  return known ?? clientType.charAt(0) + clientType.slice(1).toLowerCase();
}

type Column = {
  id: string;
  label: string;
  nowrap?: boolean;
  tone?: string;
  /** Why the column is empty, where it waits on something the firm has not built yet. */
  note?: string;
  cell: (customer: CustomerRow) => ReactNode;
};

/**
 * The columns beside the client's name, in the order the firm wrote them.
 *
 * <p>Built rather than written out, because one of these cells needs what only the screen knows: the
 * proposals read for this reader.
 *
 * <p>Two columns are not here. The client is the row — a line with no client on it names nothing — and
 * the tick box has no heading, so there is nothing to drag and nothing to find in a list.
 *
 * <p>Which columns there are at all is the firm's rule and not the reader's, so the ones this reader does
 * not get are left out rather than listed and turned off: the proposal a client is considering is their
 * relationship manager's business, which the firm-wide list has its own screen for.
 *
 * <p>Assigning is not among them. Putting a relationship manager or a portfolio manager on a client is
 * done on the client's own page, where the people already there are listed with the date each was given
 * them — a row in a list has room for the button but not for what the button is about, and two buttons on
 * every row of ten made the widest column on the screen the one nobody reads down.
 */
function movableFor({ mine, newestProposal }: {
  mine: boolean;
  newestProposal: Map<string, ProposalRow>;
}): Column[] {
  return [
    {
      id: "code",
      label: "Client code",
      nowrap: true,
      tone: "font-mono text-xs text-ink-soft",
      cell: (customer) => customer.code,
    },
    {
      id: "clientType",
      label: "Client type",
      nowrap: true,
      tone: "text-ink-soft",
      cell: (customer) => clientKindLabels[customer.clientType],
    },
    {
      id: "onboarding",
      label: "Onboarding",
      nowrap: true,
      // Where their case got to, which used to be a list of its own. Stage and count in one cell: the
      // old list had a Status column beside them reading In process or Completed, and the stage already
      // says which — "Signed off · 9/9" is not in process.
      cell: (customer) =>
        customer.onboarding ? (
          <Link
            to={`/onboarding/${customer.onboarding.caseId}`}
            className="font-medium text-ink hover:text-primary-700 hover:underline"
          >
            {customer.onboarding.stage}
            <span className="text-ink-muted">
              {" · "}
              {customer.onboarding.stepsDone}/{customer.onboarding.stepsInAll}
            </span>
          </Link>
        ) : (
          <span className="text-ink-muted">—</span>
        ),
    },
    {
      id: "registered",
      label: "Registered",
      nowrap: true,
      tone: "text-ink-soft",
      cell: (customer) => formatDate(customer.registeredAt),
    },
    {
      id: "kyc",
      label: "KYC status",
      // This client's own, and nobody else's. A row on this list is one client; stacking every other
      // holder's KYC into their cell made a joint account four badges tall and pushed the rows it was
      // trying to inform off the screen. Each holder has a row and a file of their own to be read in.
      cell: (customer) => (
        <Badge tone={kycStatusTones[customer.kycStatus]}>{kycStatusLabels[customer.kycStatus]}</Badge>
      ),
    },
    {
      id: "banks",
      label: "Linked banks",
      tone: "tabular-nums",
      // How many, not which. Names turned one cell into three badges and made every row as tall as the
      // client who banks in the most places.
      cell: (customer) => customer.linkedAccounts,
    },
    {
      id: "advisors",
      label: "Relationship managers",
      // The row is the account, so it shows whoever advises anybody holding it.
      cell: (customer) => <StaffStack people={advisorsOn(customer)} desk="relationship managers" />,
    },
    {
      id: "portfolioManagers",
      label: "Portfolio managers",
      // Beside the relationship managers and never folded in with them: they are two desks doing two
      // jobs, and a name in one column is not a name in the other. Everyone sees the column, because
      // recording who manages a client narrows nothing — it is only the assigning that Operations hold.
      cell: (customer) => <StaffStack people={managersOn(customer)} desk="portfolio managers" />,
    },
    ...(mine
      ? [{
          id: "proposal",
          label: "Proposal",
          cell: (customer: CustomerRow) => <LatestProposal proposal={newestProposal.get(customer.id)} />,
        }]
      : []),
    {
      id: "lastLogin",
      label: "Last login",
      nowrap: true,
      tone: "text-ink-soft",
      cell: (customer) => formatRelative(customer.lastLoginAt, "Never"),
    },
  ];
}

interface Filters {
  query: string;
  kycStatus: KycStatus | "";
  advisorId: string;
  /** Registered on or after this day, yyyy-mm-dd. */
  from: string;
  /** Registered on or before this day, yyyy-mm-dd. */
  to: string;
  size: number;
  page: number;
}

/** The search, filters and page live in the address (?q=kapoor&kyc=PENDING&from=2026-09-01), so they can be shared. */
function readFilters(params: URLSearchParams): Filters {
  const size = Number(params.get("size"));
  const page = Number(params.get("page"));
  const kycStatus = params.get("kyc") as KycStatus | null;
  return {
    query: params.get("q")?.trim() ?? "",
    kycStatus: kycStatus && kycStatuses.includes(kycStatus) ? kycStatus : "",
    advisorId: params.get("advisor") ?? "",
    from: dayParam(params.get("from")),
    to: dayParam(params.get("to")),
    size: PAGE_SIZES.includes(size) ? size : PAGE_SIZES[0]!,
    page: Number.isInteger(page) && page > 1 ? page - 1 : 0,
  };
}

function dayParam(value: string | null) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
}

/** Midnight here at the start of the day, or of a later day, as a local date. */
function localDay(day: string, addDays = 0) {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(year!, month! - 1, date! + addDays);
}

/**
 * The client list. Admins and Compliance see every client registered with the firm; a relationship manager
 * sees the same list, showing only the clients assigned to them. It is one screen either way: the same
 * columns, the same search and the same filters, so nobody has to learn two of them.
 */
export function ClientsPage({ mine = false }: { mine?: boolean }) {
  const user = useStaffUser();
  const canAssignAdvisors = !mine && hasAuthority(user, "ASSIGN_ADVISORS:CHANGE");
  // Asked separately, because it is its own permission and not a level of the relationship manager one.
  // The same people hold both today; reading one off the other would mean that the day they stop, this
  // screen is wrong in a way nobody changed.
  const canAssignManagers = !mine && hasAuthority(user, "ASSIGN_PORTFOLIO_MANAGERS:CHANGE");
  // The tick boxes and the bar above the table are for whichever of the two assignings the reader does, so
  // either one keeps them.
  const canSelect = canAssignAdvisors || canAssignManagers;
  // A relationship manager's list is their own, so a client of theirs opens under their own part of the app.
  const opensAt = mine ? "/my-clients" : "/clients";
  const location = useLocation();
  const navigate = useNavigate();
  const { params, update } = useListAddress();
  const { query, kycStatus, advisorId, from, to, size, page } = readFilters(params);
  const typed = useTypedSearch(query, update);

  // Clients ticked for assigning a relationship manager or a portfolio manager, on the page shown;
  // changing the page or a filter starts afresh.
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());
  const [selectionFor, setSelectionFor] = useState(params.toString());
  if (selectionFor !== params.toString()) {
    setSelectionFor(params.toString());
    setSelected(new Set());
  }
  const [assigning, setAssigning] = useState<ClientToAssign[] | null>(null);
  // Kept apart from the relationship manager one, so neither dialog can be opened holding the other's answer.
  const [assigningManager, setAssigningManager] = useState<ClientToAssign[] | null>(null);
  const [notice, setNotice] = useState<string>();

  const filters = {
    kycStatus: kycStatus || undefined,
    advisorId: advisorId || undefined,
    registeredFrom: from ? localDay(from).toISOString() : undefined,
    registeredTo: to ? localDay(to, 1).toISOString() : undefined,
  };
  const everyClient = useListCustomers<CustomerPage, ApiError>(
    { ...filters, query: query || undefined, page, size },
    { query: { enabled: !mine, placeholderData: keepPreviousData } },
  );
  // The relationship manager's own list is the same list, narrowed by the API to the clients assigned to them.
  const myClients = useListMyClients<CustomerPage, ApiError>(
    { kycStatus: filters.kycStatus, registeredFrom: filters.registeredFrom,
      registeredTo: filters.registeredTo, query: query || undefined, page, size },
    { query: { enabled: mine, placeholderData: keepPreviousData } },
  );
  const customers = mine ? myClients : everyClient;
  // Filtering by relationship manager is for somebody choosing between them; a relationship manager's own
  // list has only themselves.
  const advisors = useListCustomerAdvisors<StaffMember[], ApiError>({
    query: { enabled: !mine, staleTime: 5 * 60_000 },
  });
  // Where each of their clients' advice stands. A relationship manager's own proposals, newest first, so
  // the first one for a client is where that client has got to. Proposals and clients are separate parts of
  // the platform and neither owns the other's list, so they are put together here rather than in the API.
  const proposals = useListProposals<ProposalPage, ApiError>(
    { page: 0, size: 200 },
    { query: { enabled: mine, staleTime: 60_000 } },
  );
  const newestProposal = useMemo(() => {
    const byClient = new Map<string, ProposalRow>();
    for (const proposal of proposals.data?.items ?? []) {
      if (!byClient.has(proposal.customerId)) byClient.set(proposal.customerId, proposal);
    }
    return byClient;
  }, [proposals.data]);

  function clearFilters() {
    typed.clear();
    update({ q: null, kyc: null, advisor: null, from: null, to: null });
  }

  const rows = customers.data?.items ?? [];
  const total = customers.data?.totalItems ?? 0;
  const lastPage = Math.max(0, Math.ceil(total / size) - 1);
  const filtered = query !== "" || kycStatus !== "" || advisorId !== "" || from !== "" || to !== "";
  const canExport = hasAuthority(user, "EXPORT_CUSTOMER_DATA:CHANGE");
  const canOnboard = hasAnyAuthority(user, ...ONBOARDS_CLIENTS_CHANGE);
  const [exporting, setExporting] = useState(false);
  const [exportFailed, setExportFailed] = useState<string>();

  /** The clients the filters turned up, as a spreadsheet — what is on screen, not more. */
  async function exportTheList() {
    setExportFailed(undefined);
    setExporting(true);
    try {
      const csv = await exportCustomers({
        ...filters,
        query: query || undefined,
      });
      downloadTextFile(`clients-${new Date().toISOString().slice(0, 10)}.csv`, csv, "text/csv");
    }
    catch (caught) {
      setExportFailed(caught instanceof Error ? caught.message : "The export didn't run.");
    }
    finally {
      setExporting(false);
    }
  }
  const today = new Date();
  const movable = movableFor({ mine, newestProposal });
  // Cases still being entered. The server decides whether to send any — first page, nothing filtered —
  // so the screen only has to draw what it is given.
  const drafts = customers.data?.drafts ?? [];
  // Read before the page can send itself anywhere else: how this reader has arranged the table is a thing
  // about them and not about which page they landed on, and a hook that is skipped on one render is a hook
  // React cannot keep in order. Kept apart for the two screens this component is, because they are not
  // offered the same columns and one arrangement saved over both would fit neither.
  // Off until somebody asks for them. Who looks after a client is a question asked about one client at a
  // time, on their file; carrying two columns of avatars down every row of the whole book answered it for
  // nobody and took the width the columns people do read were short of.
  const view = useTableView(
    mine ? "my-clients" : "all-clients",
    movable.map((one) => one.id),
    ["advisors", "portfolioManagers"],
  );
  const drag = useColumnDrag(view);
  const byId = new Map(movable.map((one) => [one.id, one]));
  const shownColumns = view.shown.map((id) => byId.get(id)).filter((one) => one !== undefined);
  // The tick box and the client's name are drawn either side of the movable ones, and neither moves.
  const columnCount = shownColumns.length + 1 + (canSelect ? 1 : 0);

  // A page that no longer exists shows the last page instead.
  if (customers.data && !customers.isPlaceholderData && page > lastPage) {
    const next = new URLSearchParams(params);
    if (lastPage > 0) next.set("page", String(lastPage + 1));
    else next.delete("page");
    return <Navigate to={{ search: next.toString() }} replace />;
  }

  return (
    <div className="space-y-6">
      <ListPageHeader
        title={mine ? "My clients" : "All clients"}
        lead={
          mine
            ? "The clients assigned to you, with their code, KYC status, relationship managers and last login."
            : "Every client registered with the firm, with their code, where their onboarding stands, KYC status and last login."
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <ColumnPicker
            columns={movable.map((one) => ({ id: one.id, label: one.label }))}
            shown={new Set(view.shown)}
            order={view.order}
            arranged={view.arranged}
            onChange={(next) => {
              for (const one of movable) {
                if (next.has(one.id) === view.hidden.includes(one.id)) view.toggle(one.id);
              }
            }}
            onMove={view.move}
            onReset={view.reset}
          />
          {/* Carrying the list out of the building is its own permission, so the button follows it. */}
          {canExport && (
            <Button variant="secondary" disabled={exporting} onClick={exportTheList}>
              <Download aria-hidden="true" />
              {exporting ? "Exporting…" : "Export"}
            </Button>
          )}
        </div>
      </ListPageHeader>

      {notice && <Alert tone="success">{notice}</Alert>}
      {exportFailed && <Alert tone="danger">{exportFailed}</Alert>}
      {customers.isError && <Alert tone="danger">{customers.error.message}</Alert>}

      {/* Above the table: which of their arrangements a reader is in is read before anything in it. */}
      <ViewTabs
        views={view.views}
        current={view.current}
        edited={view.current === null ? view.arranged : view.changed}
        onPick={(name) => (name === null ? view.reset() : view.apply(name))}
        onSave={view.saveAs}
        onDelete={view.remove}
        firstLabel={mine ? "Everyone of mine" : "Every client"}
      />

      <RecordList
        caption="Clients"
        search={
          <ClientSearch value={typed.search} filters={filters} onChange={typed.change} onSearch={typed.apply} />
        }
        action={
          // Starting a client is done from here now: the list of cases it used to sit above is gone,
          // and a case begins with a client whether or not the firm has a record of them yet. Beside
          // the search box rather than up in the heading — it is the work, not a way of reading it.
          canOnboard ? <Button onClick={() => navigate("/onboarding/new")}>Start onboarding</Button> : undefined
        }
        filters={
          <>
            {/* On both lists. A relationship manager narrowing to their own clients still wants the ones
                whose papers are outstanding, and that is the same question Compliance asks of the firm. */}
            <label>
              <span className="sr-only">KYC status</span>
              <SelectInput id="client-kyc" value={kycStatus} onChange={(event) => update({ kyc: event.target.value })} className="w-auto">
                <option value="">All KYC statuses</option>
                {kycStatuses.map((status) => (
                  <option key={status} value={status}>
                    {kycStatusLabels[status]}
                  </option>
                ))}
              </SelectInput>
            </label>
            {!mine && (
              <label>
                <span className="sr-only">Relationship manager</span>
                <SelectInput id="client-advisor" value={advisorId} onChange={(event) => update({ advisor: event.target.value })} className="w-auto">
                  <option value="">All relationship managers</option>
                  {(advisors.data ?? []).map((advisor) => (
                    <option key={advisor.id} value={advisor.id}>
                      {advisor.fullName}
                    </option>
                  ))}
                </SelectInput>
              </label>
            )}
            <div role="group" aria-label="Registration date" className="flex items-center gap-2">
              <span className="text-sm text-ink-muted" aria-hidden="true">
                Registered
              </span>
              <label htmlFor="client-registered-from" className="sr-only">
                Registered from
              </label>
              <div className="w-40">
                <DateInput
                  id="client-registered-from"
                  name="registeredFrom"
                  value={from}
                  clearable
                  min={EARLIEST_REGISTRATION}
                  max={to ? localDay(to) : today}
                  placeholder="From"
                  onChange={(day) => update({ from: day })}
                />
              </div>
              <span className="text-sm text-ink-muted" aria-hidden="true">
                to
              </span>
              <label htmlFor="client-registered-to" className="sr-only">
                Registered to
              </label>
              <div className="w-40">
                <DateInput
                  id="client-registered-to"
                  name="registeredTo"
                  value={to}
                  clearable
                  min={from ? localDay(from) : EARLIEST_REGISTRATION}
                  max={today}
                  placeholder="To"
                  onChange={(day) => update({ to: day })}
                />
              </div>
            </div>
          </>
        }
        banner={canSelect && selected.size > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary-100 bg-primary-50 px-4 py-2.5">
              <p className="text-sm font-semibold text-primary-700" role="status">
                {selected.size === 1 ? "1 client selected" : `${selected.size} clients selected`}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
                  Clear selection
                </Button>
                {canAssignAdvisors && (
                  <Button size="sm" onClick={() => setAssigning(rows.filter((row) => selected.has(row.id)).flatMap(everyHolderOf))}>
                    <UserRoundCog aria-hidden="true" />
                    Assign relationship manager
                  </Button>
                )}
                {canAssignManagers && (
                  <Button size="sm" onClick={() => setAssigningManager(rows.filter((row) => selected.has(row.id)).flatMap(everyHolderOf))}>
                    <Briefcase aria-hidden="true" />
                    Assign portfolio manager
                  </Button>
                )}
              </div>
            </div>
          )}
        filtered={filtered}
        onClear={clearFilters}
        head={
          <>
                {canSelect && (
                  <th scope="col" className="w-10 py-3 pl-5">
                    <Checkbox
                      label="Select every client on this page"
                      checked={rows.length > 0 && rows.every((row) => selected.has(row.id))}
                      indeterminate={rows.some((row) => selected.has(row.id)) && !rows.every((row) => selected.has(row.id))}
                      disabled={rows.length === 0}
                      onChange={(checked) => setSelected(checked ? new Set(rows.map((row) => row.id)) : new Set())}
                    />
                  </th>
                )}
                <th scope="col" className={cn("py-3 pr-4", canSelect ? "pl-3" : "pl-5")}>Client</th>
                {/* A column still waiting on something the firm has not built yet keeps saying so here.
                    The note was all this heading hovered before it could be dragged, and an empty column
                    with no reason given is the one thing a reader cannot work out for themselves. */}
                {shownColumns.map((column, at) => (
                  <th
                    key={column.id}
                    scope="col"
                    {...drag.headingProps(column.id)}
                    className={cn(
                      "cursor-grab touch-none px-4 py-3 select-none",
                      column.nowrap && "whitespace-nowrap",
                      drag.dragging === column.id && "cursor-grabbing opacity-40",
                      drag.over === column.id && "bg-primary-50",
                    )}
                    title={column.note
                      ? `${column.note}. Drag to move ${column.label}.`
                      : `Drag to move ${column.label}`}
                  >
                    {column.label}
                    <span className="sr-only">
                      , column {at + 1} of {shownColumns.length}. Use the Columns button to move or hide it.
                    </span>
                  </th>
                ))}
          </>
        }
        columns={columnCount}
        loading={customers.isPending}
        loadingLabel="Loading clients…"
        empty={
          rows.length > 0 || drafts.length > 0 ? undefined : filtered ? (
            <ClearFiltersLink onClear={clearFilters}>No clients match your search and filters.</ClearFiltersLink>
          ) : (
            "No clients yet. Clients appear here once Operations submit their onboarding details."
          )
        }
        stale={customers.isPlaceholderData}
        busy={customers.isFetching}
        page={page}
        size={size}
        total={total}
        noun={["client", "clients"]}
        onPage={(next) => update({ page: next > 0 ? next + 1 : null })}
        onSize={(next) => update({ size: next === PAGE_SIZES[0] ? null : next })}
      >
              {/* Cases still being entered, above the clients they are on their way to becoming. They
                  come back from the server on the first page only and never under a filter: a draft has
                  no KYC standing, no registered date and no code to match a search against, so one
                  surviving a filter would be the screen stating something about it that is not true. */}
              {drafts.map((draft) => (
                <tr
                  key={draft.caseId}
                  onClick={() => void navigate(`/onboarding/${draft.caseId}`)}
                  className="cursor-pointer bg-amber-50/40 hover:bg-amber-50/70"
                >
                  {canSelect && <td className="py-3 pl-5" />}
                  <td className={cn("py-3 pr-4", canSelect ? "pl-3" : "pl-5")}>
                    <span className="flex items-center gap-3">
                      <Avatar name={draft.clientName ?? "?"} photo={draft.clientPhoto} />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-bold text-ink">
                          {draft.clientName?.trim() || "Not named yet"}
                        </span>
                        <span className="block text-xs text-amber-700">Being entered</span>
                      </span>
                    </span>
                  </td>
                  {shownColumns.map((column) => (
                    <td key={column.id} className={cn("px-4 py-3 text-sm", column.nowrap && "whitespace-nowrap")}>
                      {draftCell(column.id, draft)}
                    </td>
                  ))}
                </tr>
              ))}
              {rows.map((customer) => (
                // The row opens the client, the same as their name does; what is in the row keeps its own job.
                <tr
                  key={customer.id}
                  onClick={() => void navigate(`${opensAt}/${customer.id}`, { state: { list: location.search } })}
                  className={cn(
                    "cursor-pointer hover:bg-slate-50/60",
                    selected.has(customer.id) && "bg-primary-50/40",
                  )}
                >
                  {canSelect && (
                    <td className="w-10 py-3 pl-5">
                      <Checkbox
                        onClick={(event) => event.stopPropagation()}
                        label={`Select ${customer.fullName}`}
                        checked={selected.has(customer.id)}
                        onChange={(checked) =>
                          setSelected((current) => {
                            const next = new Set(current);
                            if (checked) next.add(customer.id);
                            else next.delete(customer.id);
                            return next;
                          })
                        }
                      />
                    </td>
                  )}
                  <td className={cn("py-3 pr-4", canSelect ? "pl-3" : "pl-5")}>
                    <div className="flex items-center gap-3">
                      <Avatar name={customer.fullName} photo={customer.photo} className="size-10" />
                      <div className="min-w-0">
                        <Link to={`${opensAt}/${customer.id}`} state={{ list: location.search }} onClick={(event) => event.stopPropagation()} className="block truncate font-semibold hover:text-primary-600">
                          {customer.fullName}
                        </Link>
                        {/* A joint account is one row, so the row says who else holds it. Entities have no
                            email of their own, so they say what they are instead. */}
                        <p className="truncate text-xs text-ink-muted">
                          {heldWith(customer).length > 0
                            ? `with ${heldWith(customer).map((held) => held.fullName).join(", ")}`
                            : (customer.email ?? clientTypeLabels[customer.type])}
                        </p>
                      </div>
                    </div>
                  </td>
                  {/* The cells in the order the headings are in, out of the one list that holds both. */}
                  {shownColumns.map((column) => (
                    <td
                      key={column.id}
                      className={cn("px-4 py-3", column.nowrap && "whitespace-nowrap", column.tone)}
                    >
                      {column.cell(customer)}
                    </td>
                  ))}
                </tr>
              ))}
      </RecordList>

      <AssignAdvisorDialog
        open={assigning !== null}
        clients={assigning ?? []}
        onClose={() => setAssigning(null)}
        onAssigned={(result) => {
          setAssigning(null);
          setSelected(new Set());
          setNotice(assignmentNotice(result));
        }}
      />

      <AssignPortfolioManagerDialog
        open={assigningManager !== null}
        clients={assigningManager ?? []}
        onClose={() => setAssigningManager(null)}
        onAssigned={(result) => {
          setAssigningManager(null);
          setSelected(new Set());
          setNotice(managerAssignmentNotice(result));
        }}
      />
    </div>
  );
}

interface CheckboxProps {
  label: string;
  checked: boolean;
  indeterminate?: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
  /** Selecting a client is its own job, so a box inside a row the page opens keeps the click to itself. */
  onClick?: (event: MouseEvent<HTMLInputElement>) => void;
}

function Checkbox({ label, checked, indeterminate = false, disabled, onChange, onClick }: CheckboxProps) {
  return (
    <input
      type="checkbox"
      aria-label={label}
      onClick={onClick}
      checked={checked}
      disabled={disabled}
      // Partly ticked, when only some of the clients on the page are selected.
      ref={(element) => {
        if (element) element.indeterminate = indeterminate;
      }}
      onChange={(event) => onChange(event.target.checked)}
      className="size-4 cursor-pointer rounded border-line accent-primary-600 disabled:cursor-default"
    />
  );
}

/** Where a client's advice stands: the newest proposal their relationship manager has put to them. */
function LatestProposal({ proposal }: { proposal: ProposalRow | undefined }) {
  if (!proposal) return <span className="text-ink-muted">None yet</span>;
  return (
    <>
      <Badge tone={proposalStatusTones[proposal.status]}>{proposalStatusLabels[proposal.status]}</Badge>
      <span className="mt-1 block font-mono text-2xs text-ink-muted">{proposal.reference}</span>
    </>
  );
}
