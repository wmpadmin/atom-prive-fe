import type { ApiError } from "@atomprive/api-client";
import {
  getListStaffUsersQueryKey,
  useCreateStaffUser,
  type StaffUserCreated,
  type StaffUserDetail,
} from "@atomprive/api-client/backoffice";
import { Alert, Button, describedBy, Dialog, Field, SelectInput, TextInput } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { noErrors, toFormErrors, type FormErrors } from "../../lib/api-errors";
import { roleLabels, roles, type StaffRole } from "../../lib/labels";
import { TemporaryPasswordBox } from "./temporary-password-box";

interface AddUserDialogProps {
  open: boolean;
  onClose: () => void;
  onAdded: (user: StaffUserDetail) => void;
}

export function AddUserDialog({ open, onClose, onAdded }: AddUserDialogProps) {
  const [created, setCreated] = useState<StaffUserCreated | null>(null);

  function close() {
    if (created) {
      onAdded(created.user);
    }
    setCreated(null);
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      title={created ? "User added" : "Add Staff User"}
      description={
        created
          ? `${created.user.fullName} can sign in now with this temporary password.`
          : "They sign in with a temporary password and choose their own straight away. Every change is written to the audit trail."
      }
    >
      {/* Mounted only while open, so every opening starts with a blank form. */}
      {open &&
        (created ? (
          <div className="space-y-5">
            <TemporaryPasswordBox email={created.user.email} password={created.temporaryPassword} />
            <div className="flex justify-end">
              <Button onClick={close}>Done</Button>
            </div>
          </div>
        ) : (
          <AddUserForm onCancel={close} onCreated={setCreated} />
        ))}
    </Dialog>
  );
}

function AddUserForm({ onCancel, onCreated }: { onCancel: () => void; onCreated: (created: StaffUserCreated) => void }) {
  const queryClient = useQueryClient();
  const [errors, setErrors] = useState<FormErrors>(noErrors);

  const createUser = useCreateStaffUser<ApiError>({
    mutation: {
      onSuccess: async (created) => {
        await queryClient.invalidateQueries({ queryKey: getListStaffUsersQueryKey() });
        onCreated(created);
      },
      onError: (error) => setErrors(toFormErrors(error)),
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setErrors(noErrors);
    createUser.mutate({
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
    <form onSubmit={handleSubmit} className="space-y-4">
      {errors.form && <Alert tone="danger">{errors.form}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="fullName" label="Full name" error={fields.fullName}>
          <TextInput {...describedBy("fullName", fields.fullName)} name="fullName" placeholder="e.g. Asha Rao" autoComplete="off" required />
        </Field>
        <Field id="phone" label="Phone" error={fields.phone}>
          <TextInput {...describedBy("phone", fields.phone)} name="phone" type="tel" placeholder="+65 9123 4567" autoComplete="off" />
        </Field>
      </div>
      <Field id="email" label="Work email" error={fields.email}>
        <TextInput {...describedBy("email", fields.email)} name="email" type="email" placeholder="name@atomprive.com" autoComplete="off" required />
      </Field>
      <Field id="role" label="Role" error={fields.role} className="sm:w-1/2">
        <SelectInput {...describedBy("role", fields.role)} name="role" defaultValue="ADVISOR" required>
          {roles.map((role) => (
            <option key={role} value={role}>
              {roleLabels[role]}
            </option>
          ))}
        </SelectInput>
      </Field>
      <div className="flex justify-end gap-3 pt-2">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={createUser.isPending}>
          {createUser.isPending ? "Creating…" : "Create user"}
        </Button>
      </div>
    </form>
  );
}
