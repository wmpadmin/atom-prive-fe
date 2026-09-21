import { ApiError } from "@atomprive/api-client";
import {
  exportStaffUser,
  getGetStaffUserQueryKey,
  useGetStaffUser,
  useResetStaffUserAuthenticator,
  type StaffUserDetail,
} from "@atomprive/api-client/backoffice";
import { Alert, Avatar, Badge, Button, cn, Pagination } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, Download, FileText, PencilLine, ScrollText, Search } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link, useParams } from "react-router";
import { useStaffUser } from "../../auth/session";
import { downloadTextFile } from "../../lib/download";
import { PAGE_SIZES } from "../../lib/page-sizes";
import { usePagedRows } from "../../lib/use-paged-rows";
import { formatDateTime, formatRelative, roleList, statusLabels } from "../../lib/labels";
import { countryName } from "../../lib/countries";
import { formatMobileNumber } from "../../lib/mobile-numbers";
import { ConfirmDialog } from "../config/confirm-dialog";
import { DeactivateUserDialog } from "./deactivate-user-dialog";
import { EditStaffDialog } from "./edit-staff-dialog";
import { ResetPasswordDialog } from "./reset-password-dialog";

type Notice = { tone: "success" | "danger"; message: string };
type Tab = "overview" | "declarations" | "documents" | "activity";

const tabs: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "declarations", label: "Declarations" },
  { id: "documents", label: "Documents" },
  { id: "activity", label: "Activity" },
];

/** Dates without a time, such as an employment start, are shown as stored rather than shifted by time zone. */
const calendarDate = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });

/** Everything about one staff member: profile, access, clients and activity (#74). */
export function UserDetailPage() {
  const { userId = "" } = useParams();
  const currentUser = useStaffUser();
  const queryClient = useQueryClient();
  const detail = useGetStaffUser<StaffUserDetail, ApiError>(userId);
  const [tab, setTab] = useState<Tab>("overview");
  const [dialog, setDialog] = useState<"edit" | "reset" | "reset-authenticator" | "deactivate" | null>(null);
  const [notice, setNotice] = useState<Notice>();
  const [exporting, setExporting] = useState(false);
  const resetAuthenticator = useResetStaffUserAuthenticator<ApiError>({
    mutation: {
      onSuccess: () => {
        setDialog(null);
        setNotice({ tone: "success", message: "Authenticator reset. They scan a new QR code at their next sign-in." });
      },
      onError: (caught) => {
        setDialog(null);
        setNotice({ tone: "danger", message: caught.message });
      },
    },
  });

  if (detail.isPending) {
    return <p className="text-sm text-ink-muted">Loading staff member…</p>;
  }
  if (detail.isError) {
    return <Alert tone="danger">{detail.error.message}</Alert>;
  }

  const user = detail.data;
  const isSelf = user.id === currentUser.id;
  const deactivated = user.status === "DEACTIVATED";

  async function exportProfile() {
    setExporting(true);
    setNotice(undefined);
    try {
      const csv = await exportStaffUser(user.id);
      const name = user.fullName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      downloadTextFile(`staff-${name}-${new Date().toISOString().slice(0, 10)}.csv`, csv, "text/csv;charset=utf-8");
    } catch (caught) {
      setNotice({ tone: "danger", message: caught instanceof ApiError ? caught.message : "Couldn't export. Try again." });
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-5">
      <Link to="/users" className="inline-flex items-center gap-2 text-[1.625rem] font-bold hover:text-primary-700">
        <ChevronLeft className="size-6" aria-hidden="true" />
        Staff detail view
      </Link>

      {notice && <Alert tone={notice.tone}>{notice.message}</Alert>}

      <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-white px-6 py-5">
        <div className="flex min-w-0 items-center gap-4">
          <Avatar name={user.fullName} className="size-16 rounded-2xl text-xl" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[1.625rem] font-bold">{user.fullName}</h1>
              {isSelf && <Badge tone="info">You</Badge>}
              {deactivated && <Badge>Deactivated</Badge>}
            </div>
            <p className="truncate text-ink-soft">{user.email}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={() => void exportProfile()} disabled={exporting}>
            <Download aria-hidden="true" />
            {exporting ? "Exporting…" : "Export"}
          </Button>
          {!deactivated && (
            <Button
              variant="danger-soft"
              disabled={isSelf}
              title={isSelf ? "You can't deactivate your own account" : undefined}
              onClick={() => setDialog("deactivate")}
            >
              Deactivate
            </Button>
          )}
          <Button onClick={() => setDialog("edit")} disabled={deactivated}>
            <PencilLine aria-hidden="true" />
            Edit
          </Button>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Assigned clients">
          {user.assignedClients} {user.assignedClients === 1 ? "client" : "clients"}
        </Stat>
        <Stat label="Tracker completeness">
          {user.completeness.filled}/{user.completeness.total} fields
        </Stat>
        <Stat label="All declarations" muted>
          None yet
        </Stat>
        <Stat label="Last active">{formatRelative(user.lastActiveAt)}</Stat>
      </div>

      <div role="tablist" aria-label="Staff details" className="inline-flex max-w-full flex-wrap gap-1 rounded-xl border border-line bg-white p-1">
        {tabs.map((option) => (
          <button
            key={option.id}
            id={`staff-tab-${option.id}`}
            type="button"
            role="tab"
            aria-selected={tab === option.id}
            aria-controls="staff-panel"
            onClick={() => setTab(option.id)}
            className={cn(
              "rounded-lg px-7 py-2 text-sm font-medium transition-colors",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600",
              tab === option.id ? "bg-primary-600 text-white" : "text-ink-soft hover:bg-slate-50",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div id="staff-panel" role="tabpanel" aria-labelledby={`staff-tab-${tab}`} className="space-y-5">
        {tab === "overview" && (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <InfoCard title="Contact">
                <Info label="Work email" value={user.email} />
                <Info label="Mobile" value={formatMobileNumber(user.phone)} />
                <Info label="Nationality" value={user.nationality && countryName(user.nationality)} />
                <Info label="Residential address" value={user.residentialAddress} />
              </InfoCard>
              <InfoCard title="Employment">
                <Info label="Designation" value={user.designation} />
                <Info label="Employment start" value={user.employmentStart && calendarDate.format(new Date(user.employmentStart))} />
                <Info
                  label="Reporting to"
                  value={
                    user.reportsTo && (
                      <Link to={`/users/${user.reportsTo.id}`} className="hover:text-primary-700">
                        {user.reportsTo.fullName}
                      </Link>
                    )
                  }
                />
                <Info label="Licence number" value={user.licenceNumber} />
              </InfoCard>
              <InfoCard title="Access & identity">
                <Info label="Role" value={roleList(user.roles)} />
                <Info
                  label="Account status"
                  value={`${statusLabels[user.status]}${user.mustChangePassword && !deactivated ? " · temporary password" : ""}`}
                />
                <Info label="PAN ID / EID" value={user.nationalId} />
                <Info label="Passport number" value={user.passportNumber} />
                {!isSelf && !deactivated && (
                  <div className="flex flex-wrap gap-x-5 gap-y-1">
                    <button type="button" onClick={() => setDialog("reset")} className="text-sm font-semibold text-primary-600 hover:text-primary-700">
                      Reset password
                    </button>
                    <button
                      type="button"
                      onClick={() => setDialog("reset-authenticator")}
                      className="text-sm font-semibold text-primary-600 hover:text-primary-700"
                    >
                      Reset authenticator
                    </button>
                  </div>
                )}
              </InfoCard>
            </div>
            <AssignedClients />
          </>
        )}
        {tab === "declarations" && (
          <EmptyPanel icon={<ScrollText />} title="No declarations yet">
            Declarations this person signs, such as conflicts of interest, will appear here.
          </EmptyPanel>
        )}
        {tab === "documents" && (
          <EmptyPanel icon={<FileText />} title="No documents yet">
            Documents kept for this person, such as their licence and ID copies, will appear here.
          </EmptyPanel>
        )}
        {tab === "activity" && <RecentActivity user={user} />}
      </div>

      <EditStaffDialog
        user={dialog === "edit" ? user : null}
        isSelf={isSelf}
        onClose={() => setDialog(null)}
        onSaved={(updated, rolesChanged) => {
          queryClient.setQueryData(getGetStaffUserQueryKey(user.id), updated);
          setDialog(null);
          setNotice({ tone: "success", message: rolesChanged ? "Saved. The role change signed them out of every device." : "Saved." });
        }}
      />
      <ResetPasswordDialog user={user} open={dialog === "reset"} onClose={() => setDialog(null)} />
      <ConfirmDialog
        open={dialog === "reset-authenticator"}
        title={`Reset the authenticator for ${user.fullName}?`}
        description="For a lost or replaced phone. They scan a new QR code the next time they sign in, and any hour-long lock is lifted."
        confirmLabel={resetAuthenticator.isPending ? "Resetting…" : "Reset authenticator"}
        busy={resetAuthenticator.isPending}
        onConfirm={() => resetAuthenticator.mutate({ id: user.id })}
        onClose={() => setDialog(null)}
      />
      <DeactivateUserDialog
        user={dialog === "deactivate" ? user : null}
        onClose={() => setDialog(null)}
        onDeactivated={() => {
          setDialog(null);
          setNotice({ tone: "success", message: `${user.fullName} is deactivated and signed out everywhere.` });
        }}
      />
    </div>
  );
}

function Stat({ label, muted, children }: { label: string; muted?: boolean; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-white px-6 py-5">
      <p className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">{label}</p>
      <p className={cn("mt-1 text-2xl font-bold", muted && "text-ink-muted")}>{children}</p>
    </div>
  );
}

function InfoCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-4 rounded-2xl border border-line bg-white px-6 py-5">
      <h2 className="text-xs font-semibold tracking-wider text-primary-600 uppercase">{title}</h2>
      {children}
    </section>
  );
}

function Info({ label, value }: { label: string; value: ReactNode }) {
  const missing = value === null || value === undefined || value === "";
  return (
    <div>
      <p className="text-2xs font-medium tracking-wide text-ink-muted uppercase">{label}</p>
      <p className={cn("mt-0.5 font-medium break-words whitespace-pre-line", missing && "text-ink-muted")}>{missing ? "—" : value}</p>
    </div>
  );
}

/** Clients come with the customer module; until then the table shows how it will look, with nothing in it. */
function AssignedClients() {
  return (
    <section aria-labelledby="assigned-clients-title" className="rounded-2xl border border-line bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 pt-5 pb-4">
        <div>
          <h2 id="assigned-clients-title" className="text-base font-bold">
            Assigned Clients
          </h2>
          <p className="text-xs text-ink-muted">Clients this person looks after.</p>
        </div>
        <label className="relative w-full max-w-sm">
          <span className="sr-only">Search clients</span>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input
            type="search"
            disabled
            placeholder="Search clients"
            className="block h-10 w-full rounded-lg border border-line bg-white pr-3 pl-9 text-sm placeholder:text-slate-400 disabled:bg-slate-50"
          />
        </label>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-y border-line text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
              <th scope="col" className="py-3 pr-4 pl-6">Client name</th>
              <th scope="col" className="px-4 py-3">Phone</th>
              <th scope="col" className="px-4 py-3">Geography</th>
              <th scope="col" className="px-4 py-3">Top allocation</th>
              <th scope="col" className="px-4 py-3">KYC</th>
              <th scope="col" className="py-3 pr-6 pl-4 text-right">Net worth</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={6} className="px-6 py-10 text-center text-ink-muted">
                No clients assigned yet. Clients can be assigned once client accounts are in the platform.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

function EmptyPanel({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="grid place-items-center rounded-2xl border border-dashed border-line bg-white px-6 py-14 text-center">
      <span className="grid size-11 place-items-center rounded-xl bg-primary-50 text-primary-600 [&_svg]:size-5" aria-hidden="true">
        {icon}
      </span>
      <p className="mt-3 font-semibold">{title}</p>
      <p className="mt-1 max-w-md text-sm text-ink-muted">{children}</p>
    </section>
  );
}

function RecentActivity({ user }: { user: StaffUserDetail }) {
  const paged = usePagedRows(user.recentActivity, 10);
  return (
    <section aria-labelledby="activity-title" className="rounded-2xl border border-line bg-white">
      <div className="flex flex-wrap items-end justify-between gap-3 px-6 pt-5 pb-4">
        <div>
          <h2 id="activity-title" className="text-base font-bold">
            Recent activity
          </h2>
          <p className="text-xs text-ink-muted">What this person did, newest first (up to 20 entries).</p>
        </div>
        <p className="text-xs text-ink-muted">
          Last sign-in {formatDateTime(user.lastLoginAt)} · Added {formatDateTime(user.createdAt)}
        </p>
      </div>
      {user.recentActivity.length === 0 ? (
        <p className="px-6 pb-6 text-sm text-ink-muted">No activity yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-y border-line text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                <th scope="col" className="px-6 py-3">When</th>
                <th scope="col" className="px-6 py-3">Activity</th>
                <th scope="col" className="px-6 py-3">IP address</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {paged.shown.map((entry, index) => (
                <tr key={`${entry.occurredAt}-${index}`}>
                  <td className="px-6 py-3 whitespace-nowrap text-ink-soft">{formatDateTime(entry.occurredAt)}</td>
                  <td className="px-6 py-3">
                    {entry.actionLabel}
                    {entry.targetLabel && <span className="text-ink-muted"> · {entry.targetLabel}</span>}
                    {entry.outcome === "FAILURE" && (
                      <span className="ml-2">
                        <Badge tone="danger">Failed</Badge>
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-3 font-mono text-xs text-ink-muted">{entry.ipAddress ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {paged.totalItems > 0 && (
        <div className="border-t border-line px-6 py-3">
          <Pagination
            page={paged.page}
            pageSize={paged.pageSize}
            totalItems={paged.totalItems}
            onPageChange={paged.setPage}
            pageSizes={PAGE_SIZES}
            onPageSizeChange={paged.setPageSize}
            noun={["entry", "entries"]}
          />
        </div>
      )}
    </section>
  );
}
