import { ApiError } from "@atomprive/api-client";
import {
  useListCustomerAdvisors,
  useListCustomers,
  useListMyClients,
  useListProposals,
  type CustomerPage,
  type CustomerRow,
  type ProposalPage,
  type ProposalRow,
  type StaffMember,
} from "@atomprive/api-client/backoffice";
import { Alert, Avatar, Badge, Button, cn, DateInput, SelectInput } from "@atomprive/ui";
import { keepPreviousData } from "@tanstack/react-query";
import { Download, UserRoundCog } from "lucide-react";
import { useMemo, useState, type MouseEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router";
import { useStaffUser } from "../../auth/session";
import { ColumnPicker } from "../../components/column-picker";
import { ClearFiltersLink, ListPageHeader, RecordList } from "../../components/record-list";
import { formatDate, formatRelative } from "../../lib/labels";
import { hasAuthority } from "../../lib/permissions";
import { PAGE_SIZES } from "../../lib/page-sizes";
import { useListAddress, useTypedSearch } from "../../lib/use-list-address";
import { proposalStatusLabels, proposalStatusTones } from "../advisor/proposal-labels";
import { AdvisorChips } from "./advisor-chips";
import { AssignAdvisorDialog, type ClientToAssign } from "./assign-advisor-dialog";
import { assignmentNotice, clientKindLabels, clientTypeLabels } from "./client-labels";
import { ClientSearch } from "./client-search";


const EARLIEST_REGISTRATION = new Date(2000, 0, 1);

/**
 * Whoever else holds this client's account. Read through here rather than off the row, so a list served by an
 * API that predates joint accounts being grouped reads as nobody else rather than bringing the screen down.
 */
function heldWith(customer: CustomerRow): CustomerRow["heldWith"] {
  return customer.heldWith ?? [];
}

/**
 * Everyone on the account this row is for. A joint account is one row, so giving that row an advisor means
 * giving the account one — the holder it happens to open on is not the only person on it.
 */
function everyHolderOf(customer: CustomerRow): ClientToAssign[] {
  return [
    { id: customer.id, fullName: customer.fullName, advisors: customer.advisors },
    ...heldWith(customer).map((held) => ({ id: held.id, fullName: held.fullName, advisors: held.advisors })),
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

const LINKED_BANKS_LATER = "Filled in once bank linking is built";

const PORTFOLIO_LATER = "Available once bank data is connected";

/** The columns beside the client's name, which always shows. */
const COLUMNS = [
  { id: "code", label: "Client code" },
  { id: "clientType", label: "Client type" },
  { id: "registered", label: "Registered" },
  { id: "banks", label: "Linked banks" },
  { id: "advisors", label: "Advisors" },
  { id: "proposal", label: "Proposal" },
  { id: "lastLogin", label: "Last login" },
  { id: "action", label: "Action" },
  { id: "portfolio", label: "Portfolio" },
] as const;

type ColumnId = (typeof COLUMNS)[number]["id"];

/**
 * What this person turned off, kept in their own browser. Turned-off columns are remembered rather than turned-on
 * ones, so a column added to the list later is shown to everybody instead of staying hidden behind an old choice.
 */
const HIDDEN_COLUMNS = "atomprive.clients.hiddenColumns";

/** What earlier versions saved: the columns that were on. Read once, then replaced by the list above. */
const COLUMN_CHOICE = "atomprive.clients.columns";

function readColumns(): ReadonlySet<ColumnId> {
  const all = COLUMNS.map((column) => column.id);
  try {
    const hidden: unknown = JSON.parse(localStorage.getItem(HIDDEN_COLUMNS) ?? "null");
    if (Array.isArray(hidden)) {
      return new Set(all.filter((id) => !hidden.includes(id)));
    }
    // Nothing saved in the new shape: anyone upgrading starts with every column, including any just added.
    localStorage.removeItem(COLUMN_CHOICE);
  } catch {
    // A browser that blocks storage just gets every column.
  }
  return new Set(all);
}

function rememberColumns(shown: ReadonlySet<string>) {
  try {
    localStorage.setItem(HIDDEN_COLUMNS, JSON.stringify(COLUMNS.map((column) => column.id).filter((id) => !shown.has(id))));
  } catch {
    // Nothing to do: the choice then lasts for this visit only.
  }
}

interface Filters {
  query: string;
  advisorId: string;
  /** Registered on or after this day, yyyy-mm-dd. */
  from: string;
  /** Registered on or before this day, yyyy-mm-dd. */
  to: string;
  size: number;
  page: number;
}

/** The search, filters and page live in the address (?q=kapoor&advisor=…&from=2026-09-01), so they can be shared. */
function readFilters(params: URLSearchParams): Filters {
  const size = Number(params.get("size"));
  const page = Number(params.get("page"));
  return {
    query: params.get("q")?.trim() ?? "",
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
 * The client list. Admins and Compliance see every client registered with the firm; an advisor sees the same
 * list, showing only the clients assigned to them. It is one screen either way: the same columns, the same
 * search and the same filters, so nobody has to learn two of them.
 */
export function ClientsPage({ mine = false }: { mine?: boolean }) {
  const user = useStaffUser();
  const canAssign = !mine && hasAuthority(user, "ASSIGN_ADVISORS:CHANGE");
  // An advisor's list is their own, so a client of theirs opens under their own part of the app.
  const opensAt = mine ? "/my-clients" : "/clients";
  const location = useLocation();
  const navigate = useNavigate();
  const { params, update } = useListAddress();
  const { query, advisorId, from, to, size, page } = readFilters(params);
  const typed = useTypedSearch(query, update);

  // Clients ticked for assigning an advisor, on the page shown; changing the page or a filter starts afresh.
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());
  const [selectionFor, setSelectionFor] = useState(params.toString());
  if (selectionFor !== params.toString()) {
    setSelectionFor(params.toString());
    setSelected(new Set());
  }
  const [assigning, setAssigning] = useState<ClientToAssign[] | null>(null);
  const [notice, setNotice] = useState<string>();
  const [columns, setColumns] = useState<ReadonlySet<string>>(readColumns);

  const filters = {
    advisorId: advisorId || undefined,
    registeredFrom: from ? localDay(from).toISOString() : undefined,
    registeredTo: to ? localDay(to, 1).toISOString() : undefined,
  };
  const everyClient = useListCustomers<CustomerPage, ApiError>(
    { ...filters, query: query || undefined, page, size },
    { query: { enabled: !mine, placeholderData: keepPreviousData } },
  );
  // The advisor's own list is the same list, narrowed by the API to the clients assigned to them.
  const myClients = useListMyClients<CustomerPage, ApiError>(
    { registeredFrom: filters.registeredFrom, registeredTo: filters.registeredTo,
      query: query || undefined, page, size },
    { query: { enabled: mine, placeholderData: keepPreviousData } },
  );
  const customers = mine ? myClients : everyClient;
  // Filtering by advisor is for somebody choosing between advisors; an advisor's own list has only them.
  const advisors = useListCustomerAdvisors<StaffMember[], ApiError>({
    query: { enabled: !mine, staleTime: 5 * 60_000 },
  });
  // Where each of their clients' advice stands. An advisor's own proposals, newest first, so the first one for
  // a client is where that client has got to. Proposals and clients are separate parts of the platform and
  // neither owns the other's list, so they are put together here rather than in the API.
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
    update({ q: null, advisor: null, from: null, to: null });
  }

  const rows = customers.data?.items ?? [];
  const total = customers.data?.totalItems ?? 0;
  const lastPage = Math.max(0, Math.ceil(total / size) - 1);
  const filtered = query !== "" || advisorId !== "" || from !== "" || to !== "";
  const today = new Date();
  // Assigning is the only action there is, so people who can't assign aren't offered that column.
  // The proposal a client is considering is their advisor's business; the firm-wide list has its own screen for it.
  const offeredHere = (id: ColumnId) => (id === "action" ? canAssign : id === "proposal" ? mine : true);
  const offered = COLUMNS.filter((column) => offeredHere(column.id));
  const shows = (id: ColumnId) => columns.has(id) && offeredHere(id);
  const columnCount = 1 + (canAssign ? 1 : 0) + offered.filter((column) => columns.has(column.id)).length;

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
            ? "The clients assigned to you, with their code, advisors and last login."
            : "Every client registered with the firm, with their code, advisors and last login."
        }
      >
        <ColumnPicker
          columns={offered.map((column) => ({ id: column.id, label: column.label }))}
          shown={new Set(offered.filter((column) => columns.has(column.id)).map((column) => column.id))}
          onChange={(shown) => {
            setColumns(shown);
            rememberColumns(shown);
          }}
        />
      </ListPageHeader>

      {notice && <Alert tone="success">{notice}</Alert>}
      {customers.isError && <Alert tone="danger">{customers.error.message}</Alert>}

      <RecordList
        caption="Clients"
        filters={
          <>
            <ClientSearch value={typed.search} filters={filters} onChange={typed.change} onSearch={typed.apply} />
            {!mine && (
              <label>
                <span className="sr-only">Advisor</span>
                <SelectInput id="client-advisor" value={advisorId} onChange={(event) => update({ advisor: event.target.value })} className="w-auto">
                  <option value="">All advisors</option>
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
        banner={canAssign && selected.size > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary-100 bg-primary-50 px-4 py-2.5">
              <p className="text-sm font-semibold text-primary-700" role="status">
                {selected.size === 1 ? "1 client selected" : `${selected.size} clients selected`}
              </p>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
                  Clear selection
                </Button>
                <Button size="sm" onClick={() => setAssigning(rows.filter((row) => selected.has(row.id)).flatMap(everyHolderOf))}>
                  <UserRoundCog aria-hidden="true" />
                  Assign advisor
                </Button>
              </div>
            </div>
          )}
        filtered={filtered}
        onClear={clearFilters}
        head={
          <>
                {canAssign && (
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
                <th scope="col" className={cn("py-3 pr-4", canAssign ? "pl-3" : "pl-5")}>Client</th>
                {shows("code") && <th scope="col" className="px-4 py-3">Client code</th>}
                {shows("clientType") && <th scope="col" className="px-4 py-3">Client type</th>}
                {shows("registered") && <th scope="col" className="px-4 py-3">Registered</th>}
                {shows("banks") && (
                  <th scope="col" className="px-4 py-3" title={LINKED_BANKS_LATER}>
                    Linked banks
                  </th>
                )}
                {shows("advisors") && <th scope="col" className="px-4 py-3">Advisors</th>}
                {shows("proposal") && <th scope="col" className="px-4 py-3">Proposal</th>}
                {shows("lastLogin") && <th scope="col" className="px-4 py-3">Last login</th>}
                {shows("action") && <th scope="col" className="px-4 py-3">Action</th>}
                {shows("portfolio") && (
                  <th scope="col" className="px-4 py-3" title={PORTFOLIO_LATER}>
                    Portfolio
                  </th>
                )}
          </>
        }
        columns={columnCount}
        loading={customers.isPending}
        loadingLabel="Loading clients…"
        empty={
          rows.length > 0 ? undefined : filtered ? (
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
                  {canAssign && (
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
                  <td className={cn("py-3 pr-4", canAssign ? "pl-3" : "pl-5")}>
                    <div className="flex items-center gap-3">
                      <Avatar name={customer.fullName} className="size-10" />
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
                  {shows("code") && (
                    <td className="px-4 py-3 font-mono text-xs whitespace-nowrap text-ink-soft">{customer.code}</td>
                  )}
                  {shows("clientType") && (
                    <td className="px-4 py-3 whitespace-nowrap text-ink-soft">{clientKindLabels[customer.clientType]}</td>
                  )}
                  {shows("registered") && <td className="px-4 py-3 whitespace-nowrap text-ink-soft">{formatDate(customer.registeredAt)}</td>}
                  {shows("banks") && (
                    <td className="px-4 py-3 text-ink-muted" title={LINKED_BANKS_LATER}>
                      —
                    </td>
                  )}
                  {shows("advisors") && (
                    <td className="px-4 py-3">
                      {/* The row is the account, so it shows whoever advises anybody holding it. */}
                      <AdvisorChips advisors={advisorsOn(customer)} />
                    </td>
                  )}
                  {shows("proposal") && (
                    <td className="px-4 py-3">
                      <LatestProposal proposal={newestProposal.get(customer.id)} />
                    </td>
                  )}
                  {shows("lastLogin") && <td className="px-4 py-3 whitespace-nowrap text-ink-soft">{formatRelative(customer.lastLoginAt, "Never")}</td>}
                  {shows("action") && (
                    <td className="px-4 py-3">
                      <Button variant="secondary" size="sm" onClick={(event) => { event.stopPropagation(); setAssigning(everyHolderOf(customer)); }}>
                        <UserRoundCog aria-hidden="true" />
                        Assign advisor
                      </Button>
                    </td>
                  )}
                  {shows("portfolio") && (
                    <td className="px-4 py-3">
                      <span title={PORTFOLIO_LATER}>
                        <Button size="sm" disabled>
                          <Download aria-hidden="true" />
                          Download
                        </Button>
                      </span>
                    </td>
                  )}
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

/** Where a client's advice stands: the newest proposal their advisor has put to them. */
function LatestProposal({ proposal }: { proposal: ProposalRow | undefined }) {
  if (!proposal) return <span className="text-ink-muted">None yet</span>;
  return (
    <>
      <Badge tone={proposalStatusTones[proposal.status]}>{proposalStatusLabels[proposal.status]}</Badge>
      <span className="mt-1 block font-mono text-2xs text-ink-muted">{proposal.reference}</span>
    </>
  );
}
