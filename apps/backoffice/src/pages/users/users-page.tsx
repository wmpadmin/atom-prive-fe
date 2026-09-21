import { ApiError } from "@atomprive/api-client";
import { exportStaffUsers, useListStaffUsers, type StaffUserPage } from "@atomprive/api-client/backoffice";
import { Alert, Avatar, Button, IconButton, Pagination, SelectInput, StatCard, TextInput } from "@atomprive/ui";
import { keepPreviousData } from "@tanstack/react-query";
import { Ban, CircleCheck, Download, Mail, Pencil, Plus, Power, Search, Users } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { DEFAULT_PAGE_SIZE, PAGE_SIZES } from "../../lib/page-sizes";
import { useStaffUser } from "../../auth/session";
import { downloadTextFile } from "../../lib/download";
import { formatRelative, roleLabels, roleList, roles, statusLabels, statuses, type StaffRole, type StaffStatus } from "../../lib/labels";
import { formatMobileNumber } from "../../lib/mobile-numbers";
import { useDebouncedValue } from "../../lib/use-debounced-value";
import { AddUserDialog } from "./add-user-dialog";
import { DeactivateUserDialog } from "./deactivate-user-dialog";
import { StatusBadge } from "./status-badge";


export function UsersPage() {
  const currentUser = useStaffUser();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<StaffRole | "">("");
  const [status, setStatus] = useState<StaffStatus | "">("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);

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
            <Plus aria-hidden="true" />
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
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-y border-line text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                <th scope="col" className="py-3 pr-4 pl-5">User</th>
                <th scope="col" className="px-4 py-3">Phone</th>
                <th scope="col" className="px-4 py-3">Role</th>
                <th scope="col" className="px-4 py-3" title="Filled in once advisor-to-customer assignment (#80) is built">
                  Assigned customers
                </th>
                <th scope="col" className="px-4 py-3">Status</th>
                <th scope="col" className="px-4 py-3" title="Filled in once staff declarations are built">
                  Declarations
                </th>
                <th scope="col" className="px-4 py-3">Last active</th>
                <th scope="col" className="py-3 pr-5 pl-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {staff.isPending && (
                <tr>
                  <td colSpan={8} className="px-5 py-8 text-center text-ink-muted">Loading staff…</td>
                </tr>
              )}
              {!staff.isPending && rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-8 text-center text-ink-muted">
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
                      <Avatar name={user.fullName} />
                      <div className="min-w-0">
                        <Link to={`/users/${user.id}`} onClick={(event) => event.stopPropagation()} className="block truncate font-semibold hover:text-primary-600">
                          {user.fullName}
                        </Link>
                        <p className="truncate text-xs text-ink-muted">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-ink-soft">{formatMobileNumber(user.phone) ?? "—"}</td>
                  <td className="px-4 py-3 text-ink-soft">{roleList(user.roles)}</td>
                  <td className="px-4 py-3 text-ink-muted">—</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={user.status} />
                  </td>
                  <td className="px-4 py-3 text-ink-muted">—</td>
                  <td className="px-4 py-3 whitespace-nowrap text-ink-soft">{formatRelative(user.lastActiveAt)}</td>
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
