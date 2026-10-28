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
import { Alert, Avatar, Badge, Button, cn, Pagination, SelectInput, StaffAvatar, TextInput } from "@atomprive/ui";
import { keepPreviousData, useQueryClient } from "@tanstack/react-query";
import { Cog, Download, Search } from "lucide-react";
import { useState, type ReactNode } from "react";
import { ColumnPicker } from "../../components/column-picker";
import { ViewTabs } from "../../components/view-tabs";
import { useColumnDrag } from "../../lib/column-drag";
import { downloadTextFile } from "../../lib/download";
import { formatDateTime, formatRelative, roleLabel, roleLabels, roles, type StaffRole } from "../../lib/labels";
import { DEFAULT_PAGE_SIZE, PAGE_SIZES } from "../../lib/page-sizes";
import { useTableView } from "../../lib/table-view";
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

/**
 * What the saved file is called, by the trail it was saved from.
 *
 * <p>Worked out here rather than read off the response, because the CSV arrives as a string and the name is
 * this page's to choose. The API says the same thing in its own Content-Disposition; if that is ever read
 * instead, these have to agree.
 */
const FILE_NAMES: Record<string, string> = {
  "proposal.": "proposal-trail",
  "access.": "family-access-trail",
};

const dateOnly = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" });

interface MovableColumn {
  id: string;
  label: string;
  align: "left" | "right";
  nowrap?: boolean;
  /** Ink the column always has, so a cell reads the same wherever a reader puts it. */
  tone?: string;
  cell: (event: AuditLogEntry) => ReactNode;
}

/**
 * The columns a reader may move or take off, in the order the firm wrote them.
 *
 * The actor stays where it is: a recorded event with nobody on it names no one, and there is no second
 * column that says who did it. The ids are what a saved arrangement is written down as, so they stay.
 */
const MOVABLE: MovableColumn[] = [
  {
    id: "action",
    label: "Action",
    align: "left",
    tone: "text-ink-soft",
    cell: (event) => event.actionLabel,
  },
  {
    id: "target",
    label: "Target",
    align: "left",
    tone: "text-ink-soft",
    cell: (event) => (
      <>
        {event.targetLabel ?? "—"}
        {event.onBehalfOf && (
          <span className="block text-xs text-ink-muted">on behalf of {event.onBehalfOf}</span>
        )}
      </>
    ),
  },
  {
    id: "time",
    label: "Time",
    align: "left",
    nowrap: true,
    tone: "text-ink-soft",
    cell: (event) => {
      const when = formatDateTime(event.occurredAt);
      return (
        <time dateTime={event.occurredAt} title={event.ipAddress ? `${when} from ${event.ipAddress}` : when}>
          {formatRelative(event.occurredAt)}
        </time>
      );
    },
  },
  {
    id: "outcome",
    label: "Result",
    align: "left",
    cell: (event) => (
      <Badge tone={event.outcome === "SUCCESS" ? "success" : "danger"}>{outcomeLabels[event.outcome]}</Badge>
    ),
  },
];

/** Who logged in, what changed and what was exported (#82). Admin and Compliance by default. */
interface AuditLogPageProps {
  /** Narrows the log to one kind of event, e.g. "proposal." for the proposal trail. */
  actionPrefix?: string;
  /**
   * Narrows it to these exact events, where a prefix cannot say it.
   *
   * <p>The trade trail is a rebalance, the agreement to it and each placing under it: two prefixes, and
   * one of them shared letter for letter with a client's own asking, which belongs to a different trail.
   */
  actions?: string[];
  /** What the saved file is called, where the trail has a name of its own. */
  fileName?: string;
  /**
   * What period it opens on.
   *
   * <p>The audit log opens on the last day, which is the right question for it: who signed in, what was
   * exported, what changed today. A trail is read backwards — somebody is asking what happened to a
   * proposal in March — and opening it on the last day showed four empty tables over a log holding
   * hundreds of rows, which reads as a screen that does not work rather than as a filter.
   */
  defaultPeriod?: Period;
  /** One client's rows only, for a trail read client by client. */
  customerId?: string;
  title?: string;
  description?: string;
  /**
   * Drawn inside somebody else's screen, under their heading.
   *
   * <p>The proposal trail is a tab on Approvals rather than a screen of its own, so the page's own
   * heading and lede would be a second title under the first. Export stays — it belongs to this table
   * and to no other tab on that screen — and moves in beside the filters, where the tab's own row of
   * controls is.
   */
  embedded?: boolean;
}

/**
 * The audit trail, whole or narrowed. The family access and proposal trails are this same screen pointed at their
 * own actions, so searching, filtering and the CSV export work the same way on all three.
 */
export function AuditLogPage({
  actionPrefix,
  title = "Audit log",
  description = "Who logged in, viewed which customer and exported what. Searchable by user, action and date.",
  embedded = false,
  actions,
  fileName: namedFile,
  defaultPeriod = "24h",
  customerId,
}: AuditLogPageProps = {}) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<StaffRole | "">("");
  const [outcome, setOutcome] = useState<ListAuditEventsOutcome | "">("");
  const [period, setPeriod] = useState<Period>(defaultPeriod);
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
  // Three screens, one table, three files. Named after the whole audit log they were indistinguishable in a
  // downloads folder, and the two narrowed ones were the misnamed pair.
  const fileName = namedFile ?? ((actionPrefix && FILE_NAMES[actionPrefix]) || "audit-log");

  const filters: ListAuditEventsParams = {
    actionPrefix,
    actions,
    customerId,
    query: query || undefined,
    role: role || undefined,
    outcome: outcome || undefined,
    ...timeRange(period, fromDate, toDate),
  };
  const events = useListAuditEvents<AuditEventPage, ApiError>(
    { ...filters, page, size: pageSize },
    { query: { placeholderData: keepPreviousData } },
  );

  // One arrangement for all three trails: the family access and proposal screens are this same log
  // narrowed to their own actions, so a column somebody moved here is the one they meant to move there.
  const view = useTableView("audit-log", MOVABLE.map((one) => one.id));
  const drag = useColumnDrag(view);
  const byId = new Map(MOVABLE.map((one) => [one.id, one]));
  const shownColumns = view.shown.map((id) => byId.get(id)).filter((one) => one !== undefined);

  function changeFilter(apply: () => void) {
    apply();
    setPage(0);
  }

  async function exportCsv() {
    setExporting(true);
    setNotice(undefined);
    try {
      const csv = await exportAuditEvents(filters);
      downloadTextFile(`${fileName}-${new Date().toISOString().slice(0, 10)}.csv`, csv, "text/csv;charset=utf-8");
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

  const exportButton = (
    <Button variant="secondary" onClick={() => void exportCsv()} disabled={exporting}>
      <Download aria-hidden="true" />
      {exporting ? "Exporting…" : "Export"}
    </Button>
  );

  return (
    <div className={embedded ? "space-y-4" : "space-y-6"}>
      {!embedded && (
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-[1.625rem] font-bold">{title}</h1>
            <p className="mt-1 text-sm text-ink-muted">{description}</p>
          </div>
          {exportButton}
        </header>
      )}

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
        <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5 pb-4">
          <div>
            <h2 id="audit-events-title" className="text-base font-bold">
              Recent events
            </h2>
            <p className="text-xs text-ink-muted">
              {events.data
                ? `${total.toLocaleString("en-GB")} ${total === 1 ? "event" : "events"} ${periodSummary(period, fromDate, toDate)}`
                : "Loading…"}
            </p>
          </div>
          {/* Beside the count rather than up with the filters: the filters say which events are listed,
              these say how the ones on screen are read. */}
          <div className="flex flex-wrap items-center gap-2">
            <ViewTabs
              views={view.views}
              current={view.current}
              edited={view.current === null ? view.arranged : view.changed}
              onPick={(name) => (name === null ? view.reset() : view.apply(name))}
              onSave={view.saveAs}
              onDelete={view.remove}
              firstLabel="Everything recorded"
            />
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
            {/* Where there is no page header to hold it. It belongs to this table, not to the screen. */}
            {embedded && exportButton}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-y border-line text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                <th scope="col" className="py-3 pr-4 pl-5">Actor</th>
                {shownColumns.map((column, at) => (
                  <th
                    key={column.id}
                    scope="col"
                    {...drag.headingProps(column.id)}
                    className={cn(
                      "cursor-grab touch-none px-4 py-3 select-none",
                      column.align === "right" ? "text-right" : "text-left",
                      at === shownColumns.length - 1 && "pr-5",
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
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {events.isPending && (
                <tr>
                  <td colSpan={shownColumns.length + 1} className="px-5 py-8 text-center text-ink-muted">Loading events…</td>
                </tr>
              )}
              {!events.isPending && rows.length === 0 && (
                <tr>
                  <td colSpan={shownColumns.length + 1} className="px-5 py-8 text-center text-ink-muted">
                    {filtered ? "No events match these filters." : "Nothing was recorded in this period."}
                  </td>
                </tr>
              )}
              {rows.map((event) => (
                <EventRow key={event.id} event={event} columns={shownColumns} />
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

function EventRow({ event, columns }: { event: AuditLogEntry; columns: MovableColumn[] }) {
  const actor = event.actorName ?? "Unknown";
  return (
    <tr className="hover:bg-slate-50/60">
      <td className="py-3 pr-4 pl-5">
        <div className="flex items-center gap-3">
          {/* Who did it, drawn as what they are. This one row can carry three different subjects: a
              member of the firm, a client acting in their own portal, or the platform itself. The same
              component is the Family access trail, where a client actor is the ordinary case rather
              than the odd one. */}
          {event.actorType === "SYSTEM" ? (
            <span
              aria-hidden="true"
              className="grid size-9 shrink-0 place-items-center rounded-lg bg-canvas text-ink-muted [&_svg]:size-4"
            >
              <Cog />
            </span>
          ) : event.actorType === "STAFF" ? (
            <StaffAvatar name={actor} />
          ) : (
            <Avatar name={actor} />
          )}
          <div className="min-w-0">
            <p className="truncate font-semibold">{actor}</p>
            <p className="truncate text-xs text-ink-muted">{actorDescription(event)}</p>
          </div>
        </div>
      </td>
      {/* The cells out of the same list the headings came from, so the two cannot drift apart. */}
      {columns.map((column, at) => (
        <td
          key={column.id}
          className={cn(
            "px-4 py-3",
            column.align === "right" && "text-right",
            column.nowrap && "whitespace-nowrap",
            at === columns.length - 1 && "pr-5",
            column.tone,
          )}
        >
          {column.cell(event)}
        </td>
      ))}
    </tr>
  );
}

function actorDescription(event: AuditLogEntry) {
  if (event.actorType === "SYSTEM") return "Automatic";
  if (event.actorRole) return roleLabel(event.actorRole);
  // A client has no role to name, and saying "Staff" because they had a name was how every client
  // acting in their own portal came to be described as an employee of the firm. On the Family access
  // trail, where the actor is routinely a client, that was most of the screen.
  if (event.actorType === "CUSTOMER") return "Client";
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
