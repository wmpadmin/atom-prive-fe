import type { ApiError } from "@atomprive/api-client";
import {
  getGetStaffUserQueryKey,
  getListStaffUsersQueryKey,
  useGetStaffUser,
  useUpdateStaffUser,
  type StaffUserDetail,
} from "@atomprive/api-client/backoffice";
import { Alert, Avatar, Badge, Button, Card, describedBy, Field, SelectInput, TextInput } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, KeyRound, Power } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router";
import { useStaffUser } from "../../auth/session";
import { noErrors, toFormErrors, type FormErrors } from "../../lib/api-errors";
import { formatDateTime, formatRelative, roleLabels, roles, type StaffRole } from "../../lib/labels";
import { DeactivateUserDialog } from "./deactivate-user-dialog";
import { ResetPasswordDialog } from "./reset-password-dialog";
import { StatusBadge } from "./status-badge";

type Notice = { tone: "success" | "danger"; message: string };

export function UserDetailPage() {
  const { userId = "" } = useParams();
  const currentUser = useStaffUser();
  const detail = useGetStaffUser<StaffUserDetail, ApiError>(userId);
  const [notice, setNotice] = useState<Notice>();

  if (detail.isPending) {
    return <p className="text-sm text-ink-muted">Loading user…</p>;
  }
  if (detail.isError) {
    return <Alert tone="danger">{detail.error.message}</Alert>;
  }

  const user = detail.data;
  const isSelf = user.id === currentUser.id;

  return (
    <div className="space-y-6">
      <Link to="/users" className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink">
        <ChevronLeft className="size-4" aria-hidden="true" />
        Manage staff users
      </Link>

      <header className="flex flex-wrap items-center gap-4">
        <Avatar name={user.fullName} className="size-14 text-base" />
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[26px] font-bold">{user.fullName}</h1>
            <StatusBadge status={user.status} />
          </div>
          <p className="text-sm text-ink-muted">
            {roleLabels[user.role]} · {user.email}
            {isSelf && " · You"}
          </p>
        </div>
      </header>

      {notice && <Alert tone={notice.tone}>{notice.message}</Alert>}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Remounts after each save so the form shows what the server stored. */}
          <DetailsForm key={user.updatedAt} user={user} isSelf={isSelf} onNotice={setNotice} />
          <RecentActivity user={user} />
        </div>
        <AccessCard user={user} isSelf={isSelf} onNotice={setNotice} />
      </div>
    </div>
  );
}

interface SectionProps {
  user: StaffUserDetail;
  isSelf: boolean;
  onNotice: (notice: Notice | undefined) => void;
}

function DetailsForm({ user, isSelf, onNotice }: SectionProps) {
  const queryClient = useQueryClient();
  const [errors, setErrors] = useState<FormErrors>(noErrors);

  const updateUser = useUpdateStaffUser<ApiError>({
    mutation: {
      onSuccess: async (updated) => {
        const roleChanged = updated.role !== user.role;
        queryClient.setQueryData(getGetStaffUserQueryKey(user.id), updated);
        await queryClient.invalidateQueries({ queryKey: getListStaffUsersQueryKey() });
        onNotice({
          tone: "success",
          message: roleChanged ? "Saved. The role change signed them out of every device." : "Saved.",
        });
      },
      onError: (error) => setErrors(toFormErrors(error)),
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setErrors(noErrors);
    onNotice(undefined);
    updateUser.mutate({
      id: user.id,
      data: {
        fullName: String(form.get("fullName")),
        email: String(form.get("email")),
        phone: String(form.get("phone")).replace(/\s+/g, "") || null,
        role: String(form.get("role")) as StaffRole,
      },
    });
  }

  const { fields } = errors;
  return (
    <Card title="Details" description="Changing the role signs the user out of every device.">
      <form onSubmit={handleSubmit} className="space-y-4">
        {errors.form && <Alert tone="danger">{errors.form}</Alert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="fullName" label="Full name" error={fields.fullName}>
            <TextInput {...describedBy("fullName", fields.fullName)} name="fullName" defaultValue={user.fullName} required />
          </Field>
          <Field id="phone" label="Phone" error={fields.phone}>
            <TextInput {...describedBy("phone", fields.phone)} name="phone" type="tel" placeholder="+65 9123 4567" defaultValue={user.phone ?? ""} />
          </Field>
          <Field id="email" label="Work email" error={fields.email}>
            <TextInput {...describedBy("email", fields.email)} name="email" type="email" defaultValue={user.email} required />
          </Field>
          <Field id="role" label="Role" hint={isSelf ? "You can't change your own role." : undefined} error={fields.role}>
            <SelectInput {...describedBy("role", fields.role)} name="role" defaultValue={user.role} disabled={isSelf}>
              {roles.map((role) => (
                <option key={role} value={role}>
                  {roleLabels[role]}
                </option>
              ))}
            </SelectInput>
            {/* A disabled select isn't submitted, so send the current role explicitly. */}
            {isSelf && <input type="hidden" name="role" value={user.role} />}
          </Field>
        </div>
        <div className="flex justify-end">
          <Button type="submit" disabled={updateUser.isPending || user.status === "DEACTIVATED"}>
            {updateUser.isPending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </form>
    </Card>
  );
}

function AccessCard({ user, isSelf, onNotice }: SectionProps) {
  const [dialog, setDialog] = useState<"reset" | "deactivate" | null>(null);

  return (
    <Card title="Access">
      <dl className="space-y-3 text-sm">
        <Row label="Last active" value={formatRelative(user.lastActiveAt)} />
        <Row label="Last sign-in" value={formatDateTime(user.lastLoginAt)} />
        <Row label="Password" value={user.mustChangePassword ? "Temporary, change at next sign-in" : "Set by the user"} />
        <Row label="Added" value={formatDateTime(user.createdAt)} />
        {user.deactivatedAt && <Row label="Deactivated" value={formatDateTime(user.deactivatedAt)} />}
      </dl>

      {!isSelf && user.status !== "DEACTIVATED" && (
        <div className="mt-5 flex flex-col gap-2 border-t border-line pt-4">
          <Button variant="secondary" onClick={() => setDialog("reset")}>
            <KeyRound aria-hidden="true" />
            Reset password
          </Button>
          <Button variant="danger" onClick={() => setDialog("deactivate")}>
            <Power aria-hidden="true" />
            Deactivate user
          </Button>
        </div>
      )}

      <ResetPasswordDialog user={user} open={dialog === "reset"} onClose={() => setDialog(null)} />
      <DeactivateUserDialog
        user={dialog === "deactivate" ? user : null}
        onClose={() => setDialog(null)}
        onDeactivated={() => {
          setDialog(null);
          onNotice({ tone: "success", message: "User deactivated and signed out everywhere." });
        }}
      />
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}

function RecentActivity({ user }: { user: StaffUserDetail }) {
  return (
    <Card title="Recent activity" description="What this user did, newest first (up to 20 entries).">
      {user.recentActivity.length === 0 ? (
        <p className="text-sm text-ink-muted">No activity yet.</p>
      ) : (
        <div className="-mx-5 -mb-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-y border-line text-left text-[11px] font-semibold tracking-wider text-ink-muted uppercase">
                <th scope="col" className="px-5 py-3">When</th>
                <th scope="col" className="px-5 py-3">Activity</th>
                <th scope="col" className="px-5 py-3">IP address</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {user.recentActivity.map((entry, index) => (
                <tr key={`${entry.occurredAt}-${index}`}>
                  <td className="px-5 py-3 whitespace-nowrap text-ink-soft">{formatDateTime(entry.occurredAt)}</td>
                  <td className="px-5 py-3">
                    {entry.actionLabel}
                    {entry.targetLabel && <span className="text-ink-muted"> · {entry.targetLabel}</span>}
                    {entry.outcome === "FAILURE" && (
                      <span className="ml-2">
                        <Badge tone="danger">Failed</Badge>
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3 font-mono text-xs text-ink-muted">{entry.ipAddress ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
