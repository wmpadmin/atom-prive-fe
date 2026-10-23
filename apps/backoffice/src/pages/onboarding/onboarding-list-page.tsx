import { ApiError } from "@atomprive/api-client";
import { useListOnboardingCases, type CasePage, type CaseSummary } from "@atomprive/api-client/backoffice";
import { Alert, Avatar, Button, cn, SelectInput } from "@atomprive/ui";
import { keepPreviousData } from "@tanstack/react-query";
import { BellRing, ChevronRight, Plus } from "lucide-react";
import { Link, Navigate, useLocation, useNavigate } from "react-router";
import { type ReactNode } from "react";
import { useStaffUser } from "../../auth/session";
import { ColumnPicker } from "../../components/column-picker";
import { ClearFiltersLink, ListPageHeader, RecordList } from "../../components/record-list";
import { ViewTabs } from "../../components/view-tabs";
import { useColumnDrag } from "../../lib/column-drag";
import { formatDate, formatRelative } from "../../lib/labels";
import { hasAnyAuthority, ONBOARDS_CLIENTS_CHANGE } from "../../lib/permissions";
import { PAGE_SIZES } from "../../lib/page-sizes";
import { useTableView } from "../../lib/table-view";
import { useListAddress, useTypedSearch } from "../../lib/use-list-address";
import { caseStatusLabels, caseStatuses, caseSubtitle, type CaseStatus } from "./case-labels";
import { CaseStatusBadge, ClientMark, ProgressMeter } from "./case-parts";
import { CaseSearch } from "./case-search";


/**
 * The columns a reader may move and take off, in the order the firm wrote them.
 *
 * <p>The client is not among them, and neither is the way in at the end: a case with nobody's name on it
 * names nothing, and an action with no heading cannot be dragged or found in a list.
 */
const MOVABLE: {
  id: string;
  label: string;
  nowrap?: boolean;
  tone?: string;
  cell: (item: CaseSummary) => ReactNode;
}[] = [
  {
    id: "manager",
    label: "Relationship manager",
    cell: (item) => (item.relationshipManager ? (
      <span className="flex items-center gap-2 whitespace-nowrap text-ink-soft">
        <Avatar name={item.relationshipManager.fullName} className="size-7 text-3xs" />
        {item.relationshipManager.fullName}
      </span>
    ) : (
      <span className="text-ink-muted">Not chosen yet</span>
    )),
  },
  {
    id: "started",
    label: "Started",
    nowrap: true,
    tone: "text-ink-soft",
    cell: (item) => formatDate(item.startedAt),
  },
  {
    id: "stage",
    label: "Current stage",
    cell: (item) => (
      <>
        <p className="font-medium whitespace-nowrap text-ink">{item.currentStage}</p>
        {!item.submitted && <p className="text-xs whitespace-nowrap text-ink-muted">Draft · {formatRelative(item.updatedAt)}</p>}
      </>
    ),
  },
  {
    id: "progress",
    label: "Progress",
    cell: (item) => <ProgressMeter done={item.completedSteps} total={item.totalSteps} />,
  },
  {
    id: "status",
    label: "Status",
    cell: (item) => <CaseStatusBadge status={item.status} />,
  },
];

/** The search, filter and page live in the address (?q=kapoor&status=IN_PROCESS&page=2), so they survive opening a case. */
function readFilters(params: URLSearchParams): { query: string; status: CaseStatus | ""; size: number; page: number } {
  const status = params.get("status") as CaseStatus | null;
  const size = Number(params.get("size"));
  const page = Number(params.get("page"));
  return {
    query: params.get("q")?.trim() ?? "",
    status: status && caseStatuses.includes(status) ? status : "",
    size: PAGE_SIZES.includes(size) ? size : PAGE_SIZES[0]!,
    page: Number.isInteger(page) && page > 1 ? page - 1 : 0,
  };
}

export function OnboardingListPage() {
  const user = useStaffUser();
  const canChange = hasAnyAuthority(user, ...ONBOARDS_CLIENTS_CHANGE);
  const navigate = useNavigate();
  const location = useLocation();
  const { params, update } = useListAddress();
  const { query, status, size, page } = readFilters(params);
  const typed = useTypedSearch(query, update);

  const cases = useListOnboardingCases<CasePage, ApiError>(
    { query: query || undefined, status: status || undefined, page, size },
    { query: { placeholderData: keepPreviousData } },
  );

  /** Opens a suggested case; going back returns to the list filtered by what was typed. */
  function openCase(id: string) {
    typed.cancel();
    const next = new URLSearchParams(params);
    if (typed.search.trim() !== query) {
      next.delete("page");
      if (typed.search.trim()) next.set("q", typed.search.trim());
      else next.delete("q");
    }
    const list = next.toString();
    navigate(`/onboarding/${id}`, { state: { list: list ? `?${list}` : "" } });
  }

  function clearFilters() {
    typed.clear();
    update({ q: null, status: null });
  }

  const rows = cases.data?.items ?? [];
  const total = cases.data?.totalItems ?? 0;
  const lastPage = Math.max(0, Math.ceil(total / size) - 1);
  const filtered = query !== "" || status !== "";

  // Read above the redirect below. How this reader has arranged the table is a thing about them rather
  // than about which page they asked for, and a hook React sees on one render and not the next is a hook
  // it cannot keep in order.
  const view = useTableView("onboarding-cases", MOVABLE.map((one) => one.id));
  const drag = useColumnDrag(view);
  const byId = new Map(MOVABLE.map((one) => [one.id, one]));
  const shownColumns = view.shown.map((id) => byId.get(id)).filter((one) => one !== undefined);

  // A page that no longer exists, say after cases were completed, shows the last page instead.
  if (cases.data && !cases.isPlaceholderData && page > lastPage) {
    const next = new URLSearchParams(params);
    if (lastPage > 0) next.set("page", String(lastPage + 1));
    else next.delete("page");
    return <Navigate to={{ search: next.toString() }} replace />;
  }

  // Opening a case remembers this view, so its back link returns to the same search and page.
  const fromList = { list: location.search };

  return (
    <div className="space-y-6">
      <ListPageHeader
        title="Client onboarding"
        lead="Enter new clients' details and follow each case until the client is onboarded."
      >
        <div className="flex gap-3">
          <span title="Available once the reminder email's wording is agreed">
            <Button variant="secondary" disabled>
              <BellRing aria-hidden="true" />
              Send reminder
            </Button>
          </span>
          {canChange && (
            <Button onClick={() => navigate("/onboarding/new", { state: fromList })}>
              <Plus aria-hidden="true" />
              Start onboarding
            </Button>
          )}
        </div>
      </ListPageHeader>

      {cases.isError && <Alert tone="danger">{cases.error.message}</Alert>}

      {/* Above the list: which of their arrangements a reader is in is read before anything in it. */}
      <ViewTabs
        views={view.views}
        current={view.current}
        edited={view.current === null ? view.arranged : view.changed}
        onPick={(name) => (name === null ? view.reset() : view.apply(name))}
        onSave={view.saveAs}
        onDelete={view.remove}
        firstLabel="Every case"
      />

      <RecordList
        caption="Onboarding cases"
        search={
          <CaseSearch value={typed.search} status={status} onChange={typed.change} onSearch={typed.apply} onOpenCase={openCase} />
        }
        filters={
          <>
            <label>
              <span className="sr-only">Status</span>
              <SelectInput id="onboarding-status" value={status} onChange={(event) => update({ status: event.target.value })} className="w-auto">
                <option value="">All statuses</option>
                {caseStatuses.map((option) => (
                  <option key={option} value={option}>
                    {caseStatusLabels[option]}
                  </option>
                ))}
              </SelectInput>
            </label>
            <ColumnPicker
              columns={MOVABLE.map((one) => ({ id: one.id, label: one.label }))}
              shown={new Set(view.shown)}
              order={view.order}
              arranged={view.arranged}
              onChange={(next) => {
                for (const one of MOVABLE) {
                  if (next.has(one.id) === view.hidden.includes(one.id)) view.toggle(one.id);
                }
              }}
              onMove={view.move}
              onReset={view.reset}
            />
          </>
        }
        filtered={filtered}
        onClear={clearFilters}
        head={
          <>
            <th scope="col" className="py-3 pr-4 pl-5">Client</th>
            {shownColumns.map((column, at) => (
              <th
                key={column.id}
                scope="col"
                {...drag.headingProps(column.id)}
                className={cn(
                  "cursor-grab touch-none px-4 py-3 select-none",
                  drag.dragging === column.id && "cursor-grabbing opacity-40",
                  drag.over === column.id && "bg-primary-50",
                )}
                title={`Drag to move ${column.label}`}
              >
                {column.label}
                <span className="sr-only">
                  , column {at + 1} of {shownColumns.length}. Use the Columns button to move or hide it.
                </span>
              </th>
            ))}
            <th scope="col" className="py-3 pr-5 pl-4 text-right">
              <span className="sr-only">Open</span>
            </th>
          </>
        }
        columns={shownColumns.length + 2}
        loading={cases.isPending}
        loadingLabel="Loading cases…"
        empty={
          rows.length > 0 ? undefined : filtered ? (
            <ClearFiltersLink onClear={clearFilters}>{emptyMessage(query, status)}</ClearFiltersLink>
          ) : canChange ? (
            "No onboarding cases yet. Start the first one with Start onboarding."
          ) : (
            "No onboarding cases yet."
          )
        }
        stale={cases.isPlaceholderData}
        busy={cases.isFetching}
        page={page}
        size={size}
        total={total}
        noun={["case", "cases"]}
        onPage={(next) => update({ page: next > 0 ? next + 1 : null })}
        onSize={(next) => update({ size: next === PAGE_SIZES[0] ? null : next })}
      >
              {rows.map((item) => (
                // The row opens the case, the same as its name and its Open button do.
                <tr
                  key={item.id}
                  onClick={() => openCase(item.id)}
                  className="cursor-pointer hover:bg-slate-50/60"
                >
                  <td className="py-3 pr-4 pl-5">
                    <div className="flex items-center gap-3">
                      <ClientMark name={item.clientName} />
                      <div className="min-w-0">
                        <Link to={`/onboarding/${item.id}`} state={fromList} onClick={(event) => event.stopPropagation()} className="block truncate font-semibold hover:text-primary-600">
                          {item.clientName}
                        </Link>
                        <p className="truncate text-xs text-ink-muted">{caseSubtitle(item)}</p>
                      </div>
                    </div>
                  </td>
                  {/* The cells in the order the headings are in, out of the one list that holds both. */}
                  {shownColumns.map((column) => (
                    <td
                      key={column.id}
                      className={cn("px-4 py-3", column.nowrap && "whitespace-nowrap", column.tone)}
                    >
                      {column.cell(item)}
                    </td>
                  ))}
                  <td className="py-3 pr-5 pl-4 text-right">
                    <Link
                      to={`/onboarding/${item.id}`}
                      state={fromList}
                      onClick={(event) => event.stopPropagation()}
                      aria-label={`Open ${item.clientName}`}
                      className="inline-flex h-8 items-center gap-1 rounded-lg border border-line bg-white px-3 text-xs font-semibold text-ink shadow-xs transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
                    >
                      Open
                      <ChevronRight aria-hidden="true" className="size-3.5" />
                    </Link>
                  </td>
                </tr>
              ))}
      </RecordList>
    </div>
  );
}

function emptyMessage(query: string, status: CaseStatus | "") {
  const among = status ? ` among ${caseStatusLabels[status].toLowerCase()} cases` : "";
  return query ? `No cases match “${query}”${among}.` : `No cases are ${caseStatusLabels[status as CaseStatus].toLowerCase()}.`;
}
