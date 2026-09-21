import type { ApiError } from "@atomprive/api-client";
import {
  getListStaffUsersQueryKey,
  useCreateStaffUser,
  useListStaffDirectory,
  type StaffReference,
  type StaffUserCreated,
  type StaffUserDetail,
} from "@atomprive/api-client/backoffice";
import { Button, Dialog } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { noErrors, toFormErrors } from "../../lib/api-errors";
import type { StaffRole } from "../../lib/labels";
import { errorsToShow, focusFirstError, readStaffProfile, useStaffProfileForm } from "./staff-profile";
import { StaffFormFooter, StaffProfileFields } from "./staff-profile-fields";
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
      size={created ? "md" : "lg"}
      onClose={close}
      title={created ? "User added" : "Add Staff User"}
      description={
        created
          ? `${created.user.fullName} can sign in now with this temporary password.`
          : "Fields marked * are required. They sign in with a temporary password and choose their own straight away. Every change is written to the audit trail."
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
  const [roles, setRoles] = useState<StaffRole[]>(["ADVISOR"]);
  const [reportsToId, setReportsToId] = useState("");
  const { formRef, errors, setErrors, setFieldError, fieldChanged, incomplete, handleChange, showIncomplete } = useStaffProfileForm(roles, reportsToId);
  const directory = useListStaffDirectory<StaffReference[], ApiError>();

  const createUser = useCreateStaffUser<ApiError>({
    mutation: {
      onSuccess: async (created) => {
        await queryClient.invalidateQueries({ queryKey: getListStaffUsersQueryKey() });
        onCreated(created);
      },
      onError: (error) => {
        const failed = errorsToShow(formRef.current, toFormErrors(error));
        setErrors(failed);
        focusFirstError(formRef.current, failed.fields);
      },
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const { data, missing } = readStaffProfile(event.currentTarget, roles, reportsToId);
    if (Object.keys(missing).length > 0) {
      showIncomplete();
      return;
    }
    setErrors(noErrors);
    createUser.mutate({ data });
  }

  return (
    // Checked here rather than by the browser, so every message can show at once.
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      onChange={handleChange}
      noValidate
      className="max-h-[70vh] space-y-6 overflow-y-auto pr-1"
    >
      <StaffProfileFields
        errors={errors.fields}
        onFieldError={setFieldError}
        onFieldChange={fieldChanged}
        roles={roles}
        onRolesChange={setRoles}
        reportsToId={reportsToId}
        onReportsToChange={setReportsToId}
        managers={directory.data ?? []}
      />
      <StaffFormFooter
        incomplete={incomplete}
        error={errors.form}
        pending={createUser.isPending}
        submitLabel="Create user"
        pendingLabel="Creating…"
        onCancel={onCancel}
      />
    </form>
  );
}
