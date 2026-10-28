import { ApiError } from "@atomprive/api-client";
import { exportStaffUsers, useListStaffUsers, type StaffUserPage, type StaffUserSummary } from "@atomprive/api-client/backoffice";
import { Alert, Button, cn, IconButton, Pagination, SelectInput, StaffAvatar, StatCard, TextInput } from "@atomprive/ui";
import { keepPreviousData } from "@tanstack/react-query";
import { Ban, CircleCheck, Download, Mail, Pencil, Power, Search, Users } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router";
import { ColumnPicker } from "../../components/column-picker";
import { ViewTabs } from "../../components/view-tabs";
import { useColumnDrag } from "../../lib/column-drag";
import { useTableView } from "../../lib/table-view";
import { PAGE_SIZES, defaultPageSize } from "../../lib/page-sizes";
import { useStaffUser } from "../../auth/session";
import { downloadTextFile } from "../../lib/download";
import { roleLabels, roleList, roles, statusLabels, statuses, type StaffRole, type StaffStatus } from "../../lib/labels";
import { formatMobileNumber } from "../../lib/mobile-numbers";
import { useDebouncedValue } from "../../lib/use-debounced-value";
import { AddUserDialog } from "./add-user-dialog";
import { DeactivateUserDialog } from "./deactivate-user-dialog";
import { StatusBadge } from "./status-badge";


/**
 * The columns a reader may move and take off, in the order the firm wrote them.
 *
 * <p>The staff member themselves is not among them, and neither is the pair of buttons at the end. A row
 * with nobody named on it is a telephone number belonging to no one; and the pencil and the power switch
 * are the only way to edit or deactivate anybody from this screen, so a column that could be taken off
 * would be a way of losing them.
 */
const MOVABLE: {
  id: string;
  label: string;
  align: "left" | "right";
  nowrap?: boolean;
  tone?: string;
  /** What a column is waiting on, where the firm has not built the thing that fills it yet. */
  note?: string;
  cell: (user: StaffUserSummary) => ReactNode;
}[] = [
  {
    id: "phone",
    label: "Phone",
    align: "left",
    nowrap: true,
    tone: "text-ink-soft",
    cell: (user) => formatMobileNumber(user.phone) ?? "—",
  },
  {
    id: "role",
    label: "Role",
    align: "left",
    tone: "text-ink-soft",
    cell: (user) => roleList(user.roles),
  },
  {
    id: "assignedCustomers",
    label: "Assigned customers",
    align: "left",
    tone: "text-ink-muted",
    note: "Filled in once relationship-manager-to-customer assignment (#80) is built",
    cell: () => "—",
  },
  {
    id: "status",
    label: "Status",
    align: "left",
    cell: (user) => <StatusBadge status={user.status} />,
  },
  {
    id: "declarations",
    label: "Declarations",
    align: "left",
    tone: "text-ink-muted",
    note: "Filled in once staff declarations are built",
    cell: () => "—",
  },
  {
    id: "lastActive",
    label: "Last active",
    align: "left",
    nowrap: true,
    tone: "text-ink-soft",
    // The day it was, and where they were working from. "5 days ago" answers how long and nothing else;
    // somebody reading this column wants to know when somebody was last at work and whether that was from
    // the office. The place is blank where their newest session recorded none.
    cell: (user) => (
      <>
        <span className="block font-semibold text-ink">{lastActiveDay(user.lastActiveAt)}</span>
        <span className="block text-xs text-ink-muted">{user.lastActiveFrom ?? "—"}</span>
      </>
    ),
  },
];

/** Named day and date, or a dash where somebody has never signed in. */
const dayAndDate = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "2-digit",
  month: "short",
  year: "numeric",
});

function lastActiveDay(at: string | null) {
  return at ? dayAndDate.format(new Date(at)) : "Never";
}

export function UsersPage() {
  const currentUser = useStaffUser();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<StaffRole | "">("");
  const [status, setStatus] = useState<StaffStatus | "">("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number>(defaultPageSize);

  // A different page size starts again at the first page, so the rows on screen always match the summary.
  function changePageSize(size: number) {
    setPageSize(size);
    setPage(0);
  }
  const query = useDebouncedValue(search.trim());

  const filters = { query: query || undefined, role: role || undefined, status: status || undefined };
  const staff = useListStaffUsers<StaffUserPage, ApiError>(
    { ...filters, page, size: pageSize },
    { query: { placeholderData: keepPreviousData } },
  );

  const [adding, setAdding] = useState(false);
  const [deactivating, setDeactivating] = useState<{ id: string; fullName: string } | null>(null);
  const [notice, setNotice] = useState<{ tone: "success" | "danger"; message: string }>();
  const [exporting, setExporting] = useState(false);
  // How this reader has arranged the table, read with the rest of the state and above anything that could
  // return early: it is a thing about their own screen rather than about the staff, and a hook React sees
  // on one render and not the next is a hook it cannot keep in order.
  const view = useTableView("staff-users", MOVABLE.map((one) => one.id));
  const drag = useColumnDrag(view);

  function changeFilter(apply: () => void) {
    apply();
    setPage(0);
  }

  async function exportCsv() {
    setExporting(true);
    setNotice(undefined);
    try {
      const csv = await exportStaffUsers(filters);
      downloadTextFile(`staff-users-${new Date().toISOString().slice(0, 10)}.csv`, csv, "text/csv;charset=utf-8");
    } catch (caught) {
      setNotice({ tone: "danger", message: caught instanceof ApiError ? caught.message : "Couldn't export. Try again." });
    } finally {
      setExporting(false);
    }
  }

  const counts = staff.data?.counts;
  const rows = staff.data?.items ?? [];
  const total = staff.data?.totalItems ?? 0;
  const byId = new Map(MOVABLE.map((one) => [one.id, one]));
  const shownColumns = view.shown.map((id) => byId.get(id)).filter((one) => one !== undefined);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[1.625rem] font-bold">Manage staff users</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Create, edit and deactivate accounts. Every change is written to the audit trail.
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => void exportCsv()} disabled={exporting}>
            <Download aria-hidden="true" />
            {exporting ? "Exporting…" : "Export"}
          </Button>
          <Button onClick={() => setAdding(true)}>
            New user
          </Button>
        </div>
      </header>

      {notice && <Alert tone={notice.tone}>{notice.message}</Alert>}
      {staff.isError && <Alert tone="danger">{staff.error.message}</Alert>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={<Users />} value={counts?.total ?? "–"} label="Staff users" />
        <StatCard icon={<CircleCheck />} value={counts?.active ?? "–"} label="Active" />
        <StatCard icon={<Mail />} value={counts?.invited ?? "–"} label="Invited" />
        <StatCard icon={<Ban />} value={counts?.deactivated ?? "–"} label="Deactivated" />
      </div>

      {/* Above the table: which of their arrangements a reader is in is read before anything in it. */}
      <ViewTabs
        views={view.views}
        current={view.current}
        edited={view.current === null ? view.arranged : view.changed}
        onPick={(name) => (name === null ? view.reset() : view.apply(name))}
        onSave={view.saveAs}
        onDelete={view.remove}
        firstLabel="Everyone on staff"
      />

      <section className="rounded-2xl border border-line bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 pb-4">
          <div>
            <h2 className="text-base font-bold">All staff</h2>
            <p className="text-xs text-ink-muted">Create, edit, deactivate</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <label className="relative">
              <span className="sr-only">Search staff</span>
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <TextInput
                id="staff-search"
                type="search"
                placeholder="Search staff"
                value={search}
                onChange={(event) => changeFilter(() => setSearch(event.target.value))}
                className="w-56 pl-9"
              />
            </label>
            <label>
              <span className="sr-only">Role</span>
              <SelectInput id="staff-role" value={role} onChange={(event) => changeFilter(() => setRole(event.target.value as StaffRole | ""))} className="w-auto">
                <option value="">All roles</option>
                {roles.map((option) => (
                  <option key={option} value={option}>
                    {roleLabels[option]}
                  </option>
                ))}
              </SelectInput>
            </label>
            <label>
              <span className="sr-only">Status</span>
              <SelectInput id="staff-status" value={status} onChange={(event) => changeFilter(() => setStatus(event.target.value as StaffStatus | ""))} className="w-auto">
                <option value="">Status</option>
                {statuses.map((option) => (
                  <option key={option} value={option}>
                    {statusLabels[option]}
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
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-y border-line text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                <th scope="col" className="py-3 pr-4 pl-5">User</th>
                {shownColumns.map((column, at) => (
                  <th
                    key={column.id}
                    scope="col"
                    {...drag.headingProps(column.id)}
                    className={cn(
                      "cursor-grab touch-none px-4 py-3 select-none",
                      column.align === "right" ? "text-right" : "text-left",
                      column.nowrap && "whitespace-nowrap",
                      drag.dragging === column.id && "cursor-grabbing opacity-40",
                      drag.over === column.id && "bg-primary-50",
                    )}
                    // Two of these columns are empty until the firm builds what fills them, and the
                    // heading is the only place that says so — kept in front of how to move it.
                    title={column.note === undefined
                      ? `Drag to move ${column.label}`
                      : `${column.note} · Drag to move ${column.label}`}
                  >
                    {column.label}
                    <span className="sr-only">
                      , column {at + 1} of {shownColumns.length}. Use the Columns button to move or hide it.
                    </span>
                  </th>
                ))}
                <th scope="col" className="py-3 pr-5 pl-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {staff.isPending && (
                <tr>
                  <td colSpan={shownColumns.length + 2} className="px-5 py-8 text-center text-ink-muted">Loading staff…</td>
                </tr>
              )}
              {!staff.isPending && rows.length === 0 && (
                <tr>
                  <td colSpan={shownColumns.length + 2} className="px-5 py-8 text-center text-ink-muted">
                    {query || role || status ? "No staff match these filters." : "No staff yet. Add the first one with New user."}
                  </td>
                </tr>
              )}
              {rows.map((user) => (
                // The row opens the staff member, the same as their name and the pencil beside it do.
                <tr
                  key={user.id}
                  onClick={() => void navigate(`/users/${user.id}`)}
                  className="cursor-pointer hover:bg-slate-50/60"
                >
                  <td className="py-3 pr-4 pl-5">
                    <div className="flex items-center gap-3">
                      <StaffAvatar name={user.fullName} photo={user.photo} />
                      <div className="min-w-0">
                        <Link to={`/users/${user.id}`} onClick={(event) => event.stopPropagation()} className="block truncate font-semibold hover:text-primary-600">
                          {user.fullName}
                        </Link>
                        <p className="truncate text-xs text-ink-muted">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  {/* The cells in the order the headings are in, out of the one list that holds both. */}
                  {shownColumns.map((column) => (
                    <td
                      key={column.id}
                      className={cn(
                        "px-4 py-3",
                        column.align === "right" && "text-right tabular-nums",
                        column.nowrap && "whitespace-nowrap",
                        column.tone,
                      )}
                    >
                      {column.cell(user)}
                    </td>
                  ))}
                  <td className="py-3 pr-5 pl-4">
                    <div className="flex justify-end gap-2">
                      <IconButton label={`Edit ${user.fullName}`} onClick={(event) => { event.stopPropagation(); void navigate(`/users/${user.id}`); }}>
                        <Pencil />
                      </IconButton>
                      <IconButton
                        label={`Deactivate ${user.fullName}`}
                        tone="danger"
                        disabled={user.status === "DEACTIVATED" || user.id === currentUser.id}
                        onClick={(event) => {
                          // Deactivating is its own thing to do, not a way into the staff member's page.
                          event.stopPropagation();
                          setDeactivating({ id: user.id, fullName: user.fullName });
                        }}
                      >
                        <Power />
                      </IconButton>
                    </div>
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
              pageSize={pageSize}
              totalItems={total}
              onPageChange={setPage}
              pageSizes={PAGE_SIZES}
              onPageSizeChange={changePageSize}
              noun={["account", "accounts"]}
            />
          </div>
        )}
      </section>

      <AddUserDialog
        open={adding}
        onClose={() => setAdding(false)}
        onAdded={(user) =>
          setNotice({ tone: "success", message: `${user.fullName} added. They'll choose their own password when they first sign in.` })
        }
      />
      <DeactivateUserDialog
        user={deactivating}
        onClose={() => setDeactivating(null)}
        onDeactivated={() => {
          setNotice({ tone: "success", message: `${deactivating?.fullName} is deactivated and signed out everywhere.` });
          setDeactivating(null);
        }}
      />
    </div>
  );
}
