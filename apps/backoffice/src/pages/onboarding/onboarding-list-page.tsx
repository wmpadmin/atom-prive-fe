import { ApiError } from "@atomprive/api-client";
import { useListOnboardingCases, type CasePage } from "@atomprive/api-client/backoffice";
import { Alert, Avatar, Button, cn, Pagination, SelectInput } from "@atomprive/ui";
import { keepPreviousData } from "@tanstack/react-query";
import { BellRing, ChevronRight, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from "react-router";
import { useStaffUser } from "../../auth/session";
import { formatRelative } from "../../lib/labels";
import { hasAuthority } from "../../lib/permissions";
import { caseStatusLabels, caseStatuses, caseSubtitle, formatDay, type CaseStatus } from "./case-labels";
import { CaseStatusBadge, ClientMark, ProgressMeter } from "./case-parts";
import { CaseSearch } from "./case-search";

const PAGE_SIZES = [10, 25, 50];

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
  const canChange = hasAuthority(user, "ONBOARD_CLIENTS:CHANGE");
  const navigate = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const { query, status, size, page } = readFilters(params);

  // What's typed shows straight away; the address, and so the results, follow once typing pauses.
  const [search, setSearch] = useState(query);
  const [shownQuery, setShownQuery] = useState(query);
  if (query !== shownQuery) {
    // The address changed some other way, such as the menu link clearing the search.
    setShownQuery(query);
    if (query !== search.trim()) setSearch(query);
  }
  const typingTimer = useRef<number>(undefined);
  useEffect(() => () => window.clearTimeout(typingTimer.current), []);

  const cases = useListOnboardingCases<CasePage, ApiError>(
    { query: query || undefined, status: status || undefined, page, size },
    { query: { placeholderData: keepPreviousData } },
  );

  /** Changes the address; any change other than the page starts again from the first page. */
  function update(changes: Record<string, string | number | null>) {
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (!("page" in changes)) next.delete("page");
        for (const [key, value] of Object.entries(changes)) {
          if (value === null || value === "") next.delete(key);
          else next.set(key, String(value));
        }
        return next;
      },
      { replace: true },
    );
  }

  function changeSearch(value: string) {
    setSearch(value);
    window.clearTimeout(typingTimer.current);
    typingTimer.current = window.setTimeout(() => update({ q: value.trim() }), 300);
  }

  /** Filters by the text straight away, such as when Enter is pressed or a relationship manager is picked. */
  function applySearch(value: string) {
    window.clearTimeout(typingTimer.current);
    setSearch(value);
    update({ q: value.trim() });
  }

  /** Opens a suggested case; going back returns to the list filtered by what was typed. */
  function openCase(id: string) {
    window.clearTimeout(typingTimer.current);
    const next = new URLSearchParams(params);
    if (search.trim() !== query) {
      next.delete("page");
      if (search.trim()) next.set("q", search.trim());
      else next.delete("q");
    }
    const list = next.toString();
    navigate(`/onboarding/${id}`, { state: { list: list ? `?${list}` : "" } });
  }

  function clearFilters() {
    window.clearTimeout(typingTimer.current);
    setSearch("");
    update({ q: null, status: null });
  }

  const rows = cases.data?.items ?? [];
  const total = cases.data?.totalItems ?? 0;
  const lastPage = Math.max(0, Math.ceil(total / size) - 1);
  const filtered = query !== "" || status !== "";

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
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[1.625rem] font-bold">Client onboarding</h1>
          <p className="mt-1 text-sm text-ink-muted">Enter new clients' details and follow each case until the client is onboarded.</p>
        </div>
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
      </header>

      {cases.isError && <Alert tone="danger">{cases.error.message}</Alert>}

      <section className="rounded-2xl border border-line bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 pb-4">
          <div>
            <h2 className="text-base font-bold">Onboarding cases</h2>
            <p className="text-xs text-ink-muted">Newest first</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <CaseSearch value={search} status={status} onChange={changeSearch} onSearch={applySearch} onOpenCase={openCase} />
            <label>
              <span className="sr-only">Status</span>
              <SelectInput id="onboarding-status" value={status} onChange={(event) => update({ status: event.target.value })} className="w-40">
                <option value="">All statuses</option>
                {caseStatuses.map((option) => (
                  <option key={option} value={option}>
                    {caseStatusLabels[option]}
                  </option>
                ))}
              </SelectInput>
            </label>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className={cn("min-w-full text-sm transition-opacity", cases.isPlaceholderData && "opacity-60")} aria-busy={cases.isFetching}>
            <thead>
              <tr className="border-y border-line text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                <th scope="col" className="py-3 pr-4 pl-5">Client</th>
                <th scope="col" className="px-4 py-3">Relationship manager</th>
                <th scope="col" className="px-4 py-3">Started</th>
                <th scope="col" className="px-4 py-3">Current stage</th>
                <th scope="col" className="px-4 py-3">Progress</th>
                <th scope="col" className="px-4 py-3">Status</th>
                <th scope="col" className="py-3 pr-5 pl-4 text-right">
                  <span className="sr-only">Open</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {cases.isPending && (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-ink-muted">Loading cases…</td>
                </tr>
              )}
              {!cases.isPending && rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-ink-muted">
                    {filtered ? (
                      <>
                        {emptyMessage(query, status)}{" "}
                        <button type="button" onClick={clearFilters} className="font-semibold text-primary-600 hover:text-primary-700">
                          Clear search and filter
                        </button>
                      </>
                    ) : canChange ? (
                      "No onboarding cases yet. Start the first one with Start onboarding."
                    ) : (
                      "No onboarding cases yet."
                    )}
                  </td>
                </tr>
              )}
              {rows.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/60">
                  <td className="py-3 pr-4 pl-5">
                    <div className="flex items-center gap-3">
                      <ClientMark name={item.clientName} />
                      <div className="min-w-0">
                        <Link to={`/onboarding/${item.id}`} state={fromList} className="block truncate font-semibold hover:text-primary-600">
                          {item.clientName}
                        </Link>
                        <p className="truncate text-xs text-ink-muted">{caseSubtitle(item)}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {item.relationshipManager ? (
                      <span className="flex items-center gap-2 whitespace-nowrap text-ink-soft">
                        <Avatar name={item.relationshipManager.fullName} className="size-7 text-3xs" />
                        {item.relationshipManager.fullName}
                      </span>
                    ) : (
                      <span className="text-ink-muted">Not chosen yet</span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-ink-soft">{formatDay(item.startedAt)}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium whitespace-nowrap text-ink">{item.currentStage}</p>
                    {!item.submitted && <p className="text-xs whitespace-nowrap text-ink-muted">Draft · {formatRelative(item.updatedAt)}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <ProgressMeter done={item.completedSteps} total={item.totalSteps} />
                  </td>
                  <td className="px-4 py-3">
                    <CaseStatusBadge status={item.status} />
                  </td>
                  <td className="py-3 pr-5 pl-4 text-right">
                    <Link
                      to={`/onboarding/${item.id}`}
                      state={fromList}
                      aria-label={`Open ${item.clientName}`}
                      className="inline-flex h-8 items-center gap-1 rounded-lg border border-line bg-white px-3 text-xs font-semibold text-ink shadow-xs transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
                    >
                      Open
                      <ChevronRight aria-hidden="true" className="size-3.5" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {total > 0 && (
          <div className="border-t border-line px-5 py-3">
            <Pagination
              page={page}
              pageSize={size}
              totalItems={total}
              noun={["case", "cases"]}
              onPageChange={(next) => {
                update({ page: next > 0 ? next + 1 : null });
                window.scrollTo({ top: 0 });
              }}
              pageSizes={PAGE_SIZES}
              onPageSizeChange={(next) => update({ size: next === PAGE_SIZES[0] ? null : next })}
            />
          </div>
        )}
      </section>
    </div>
  );
}

function emptyMessage(query: string, status: CaseStatus | "") {
  const among = status ? ` among ${caseStatusLabels[status].toLowerCase()} cases` : "";
  return query ? `No cases match “${query}”${among}.` : `No cases are ${caseStatusLabels[status as CaseStatus].toLowerCase()}.`;
}
