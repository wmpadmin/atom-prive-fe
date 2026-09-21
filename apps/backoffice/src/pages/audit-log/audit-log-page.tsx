import { ApiError } from "@atomprive/api-client";
import {
  exportAuditEvents,
  getListAuditEventsQueryKey,
  useListAuditEvents,
  type AuditLogEntry,
  type AuditLogPage as AuditEventPage,
  type ListAuditEventsOutcome,
  type ListAuditEventsParams,
} from "@atomprive/api-client/backoffice";
import { Alert, Avatar, Badge, Button, Pagination, SelectInput, TextInput } from "@atomprive/ui";
import { keepPreviousData, useQueryClient } from "@tanstack/react-query";
import { Download, Search } from "lucide-react";
import { useState } from "react";
import { downloadTextFile } from "../../lib/download";
import { formatDateTime, formatRelative, roleLabel, roleLabels, roles, type StaffRole } from "../../lib/labels";
import { DEFAULT_PAGE_SIZE, PAGE_SIZES } from "../../lib/page-sizes";
import { useDebouncedValue } from "../../lib/use-debounced-value";


type Period = "24h" | "7d" | "30d" | "90d" | "all" | "custom";

const periods: Record<Period, { label: string; hours?: number; summary?: string }> = {
  "24h": { label: "Last 24 hours", hours: 24, summary: "in the last 24 hours" },
  "7d": { label: "Last 7 days", hours: 24 * 7, summary: "in the last 7 days" },
  "30d": { label: "Last 30 days", hours: 24 * 30, summary: "in the last 30 days" },
  "90d": { label: "Last 90 days", hours: 24 * 90, summary: "in the last 90 days" },
  all: { label: "All time", summary: "in total" },
  custom: { label: "Custom dates" },
};

const outcomeLabels: Record<ListAuditEventsOutcome, string> = { SUCCESS: "Success", FAILURE: "Failed" };

const dateOnly = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" });

/** Who logged in, what changed and what was exported (#82). Admin and Compliance by default. */
interface AuditLogPageProps {
  /** Narrows the log to one kind of event, e.g. "access." for the family access trail. */
  actionPrefix?: string;
  title?: string;
  description?: string;
}

/**
 * The audit trail, whole or narrowed. The family access and proposal trails are this same screen pointed at their
 * own actions, so searching, filtering and the CSV export work the same way on all three.
 */
export function AuditLogPage({
  actionPrefix,
  title = "Audit log",
  description = "Who logged in, viewed which customer and exported what. Searchable by user, action and date.",
}: AuditLogPageProps = {}) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<StaffRole | "">("");
  const [outcome, setOutcome] = useState<ListAuditEventsOutcome | "">("");
  const [period, setPeriod] = useState<Period>("24h");
  // yyyy-mm-dd values from the date inputs, used when the period is "Custom dates"
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);

  // A different page size starts again at the first page, so the rows on screen always match the summary.
  function changePageSize(size: number) {
    setPageSize(size);
    setPage(0);
  }
  const [notice, setNotice] = useState<string>();
  const [exporting, setExporting] = useState(false);
  const query = useDebouncedValue(search.trim());

  const filters: ListAuditEventsParams = {
    actionPrefix,
    query: query || undefined,
    role: role || undefined,
    outcome: outcome || undefined,
    ...timeRange(period, fromDate, toDate),
  };
  const events = useListAuditEvents<AuditEventPage, ApiError>(
    { ...filters, page, size: pageSize },
    { query: { placeholderData: keepPreviousData } },
  );

  function changeFilter(apply: () => void) {
    apply();
    setPage(0);
  }

  async function exportCsv() {
    setExporting(true);
    setNotice(undefined);
    try {
      const csv = await exportAuditEvents(filters);
      downloadTextFile(`audit-log-${new Date().toISOString().slice(0, 10)}.csv`, csv, "text/csv;charset=utf-8");
      // The export is itself recorded, so show it.
      await queryClient.invalidateQueries({ queryKey: getListAuditEventsQueryKey() });
    } catch (caught) {
      setNotice(caught instanceof ApiError ? caught.message : "Couldn't export. Try again.");
    } finally {
      setExporting(false);
    }
  }

  const rows = events.data?.items ?? [];
  const total = events.data?.totalItems ?? 0;
  const filtered = Boolean(query || role || outcome);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[1.625rem] font-bold">{title}</h1>
          <p className="mt-1 text-sm text-ink-muted">{description}</p>
        </div>
        <Button variant="secondary" onClick={() => void exportCsv()} disabled={exporting}>
          <Download aria-hidden="true" />
          {exporting ? "Exporting…" : "Export"}
        </Button>
      </header>

      {notice && <Alert tone="danger">{notice}</Alert>}
      {events.isError && <Alert tone="danger">{events.error.message}</Alert>}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="relative w-full max-w-md">
          <span className="sr-only">Search the audit log</span>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <TextInput
            id="audit-search"
            type="search"
            placeholder="Search by person, action or target"
            value={search}
            onChange={(event) => changeFilter(() => setSearch(event.target.value))}
            className="pl-9"
          />
        </label>
        <div className="flex flex-wrap items-center gap-2">
          {period === "custom" && (
            <>
              <label className="flex items-center gap-2 text-xs text-ink-muted">
                From
                <TextInput
                  id="audit-from"
                  type="date"
                  value={fromDate}
                  max={toDate || undefined}
                  onChange={(event) => changeFilter(() => setFromDate(event.target.value))}
                  className="w-auto"
                />
              </label>
              <label className="flex items-center gap-2 text-xs text-ink-muted">
                To
                <TextInput
                  id="audit-to"
                  type="date"
                  value={toDate}
                  min={fromDate || undefined}
                  onChange={(event) => changeFilter(() => setToDate(event.target.value))}
                  className="w-auto"
                />
              </label>
            </>
          )}
          <label>
            <span className="sr-only">Time period</span>
            <SelectInput
              id="audit-period"
              value={period}
              onChange={(event) => changeFilter(() => setPeriod(event.target.value as Period))}
              className="w-auto"
            >
              {Object.entries(periods).map(([value, option]) => (
                <option key={value} value={value}>
                  {option.label}
                </option>
              ))}
            </SelectInput>
          </label>
          <label>
            <span className="sr-only">Role</span>
            <SelectInput
              id="audit-role"
              value={role}
              onChange={(event) => changeFilter(() => setRole(event.target.value as StaffRole | ""))}
              className="w-auto"
            >
              <option value="">All roles</option>
              {roles.map((option) => (
                <option key={option} value={option}>
                  {roleLabels[option]}
                </option>
              ))}
            </SelectInput>
          </label>
          <label>
            <span className="sr-only">Result</span>
            <SelectInput
              id="audit-outcome"
              value={outcome}
              onChange={(event) => changeFilter(() => setOutcome(event.target.value as ListAuditEventsOutcome | ""))}
              className="w-auto"
            >
              <option value="">Status</option>
              {Object.entries(outcomeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </SelectInput>
          </label>
        </div>
      </div>

      <section aria-labelledby="audit-events-title" className="rounded-2xl border border-line bg-white">
        <div className="px-5 pt-5 pb-4">
          <h2 id="audit-events-title" className="text-base font-bold">
            Recent events
          </h2>
          <p className="text-xs text-ink-muted">
            {events.data
              ? `${total.toLocaleString("en-GB")} ${total === 1 ? "event" : "events"} ${periodSummary(period, fromDate, toDate)}`
              : "Loading…"}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-y border-line text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                <th scope="col" className="py-3 pr-4 pl-5">Actor</th>
                <th scope="col" className="px-4 py-3">Action</th>
                <th scope="col" className="px-4 py-3">Target</th>
                <th scope="col" className="px-4 py-3">Time</th>
                <th scope="col" className="py-3 pr-5 pl-4">Result</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {events.isPending && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-ink-muted">Loading events…</td>
                </tr>
              )}
              {!events.isPending && rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-ink-muted">
                    {filtered ? "No events match these filters." : "Nothing was recorded in this period."}
                  </td>
                </tr>
              )}
              {rows.map((event) => (
                <EventRow key={event.id} event={event} />
              ))}
            </tbody>
          </table>
        </div>

        {total > 0 && (
          <div className="border-t border-line px-5 py-3">
            <Pagination
              page={page}
              pageSize={pageSize}
              totalItems={total}
              onPageChange={setPage}
              pageSizes={PAGE_SIZES}
              onPageSizeChange={changePageSize}
              noun={["event", "events"]}
            />
          </div>
        )}
      </section>
    </div>
  );
}

function EventRow({ event }: { event: AuditLogEntry }) {
  const actor = event.actorName ?? "Unknown";
  const when = formatDateTime(event.occurredAt);
  return (
    <tr className="hover:bg-slate-50/60">
      <td className="py-3 pr-4 pl-5">
        <div className="flex items-center gap-3">
          <Avatar name={actor} />
          <div className="min-w-0">
            <p className="truncate font-semibold">{actor}</p>
            <p className="truncate text-xs text-ink-muted">{actorDescription(event)}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-ink-soft">{event.actionLabel}</td>
      <td className="px-4 py-3 text-ink-soft">{event.targetLabel ?? "—"}</td>
      <td className="px-4 py-3 whitespace-nowrap text-ink-soft">
        <time dateTime={event.occurredAt} title={event.ipAddress ? `${when} from ${event.ipAddress}` : when}>
          {formatRelative(event.occurredAt)}
        </time>
      </td>
      <td className="py-3 pr-5 pl-4">
        <Badge tone={event.outcome === "SUCCESS" ? "success" : "danger"}>{outcomeLabels[event.outcome]}</Badge>
      </td>
    </tr>
  );
}

function actorDescription(event: AuditLogEntry) {
  if (event.actorType === "SYSTEM") return "Automatic";
  if (event.actorRole) return roleLabel(event.actorRole);
  // Staff holding several roles haven't picked one yet when they sign in.
  return event.actorName ? "Staff" : "No matching account";
}

/**
 * The period as the API's from/to times. Rolling periods are rounded to the minute, so the request (and its cache
 * entry) stays the same between renders.
 */
function timeRange(period: Period, fromDate: string, toDate: string): Pick<ListAuditEventsParams, "from" | "to"> {
  const { hours } = periods[period];
  if (hours) {
    const thisMinute = Math.floor(Date.now() / 60_000) * 60_000;
    return { from: new Date(thisMinute - hours * 3_600_000).toISOString() };
  }
  if (period === "custom") {
    return {
      from: fromDate ? startOfDay(fromDate).toISOString() : undefined,
      // The end date is included, so the range runs to the start of the next day.
      to: toDate ? startOfDay(toDate, 1).toISOString() : undefined,
    };
  }
  return {};
}

function periodSummary(period: Period, fromDate: string, toDate: string) {
  if (period !== "custom") return periods[period].summary;
  if (fromDate && toDate) return `from ${dateOnly.format(startOfDay(fromDate))} to ${dateOnly.format(startOfDay(toDate))}`;
  if (fromDate) return `since ${dateOnly.format(startOfDay(fromDate))}`;
  if (toDate) return `up to ${dateOnly.format(startOfDay(toDate))}`;
  return "in total";
}

/** Midnight in the viewer's time zone at the start of a yyyy-mm-dd date, plus any whole days. */
function startOfDay(date: string, addDays = 0) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day + addDays);
}
