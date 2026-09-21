import type { ApiError } from "@atomprive/api-client";
import {
  getListStaffUsersQueryKey,
  useListStaffDirectory,
  useUpdateStaffUser,
  type StaffReference,
  type StaffUserDetail,
} from "@atomprive/api-client/backoffice";
import { Dialog } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { noErrors, toFormErrors } from "../../lib/api-errors";
import type { StaffRole } from "../../lib/labels";
import { errorsToShow, focusFirstError, readStaffProfile, useStaffProfileForm } from "./staff-profile";
import { StaffFormFooter, StaffProfileFields } from "./staff-profile-fields";

interface EditStaffDialogProps {
  /** The staff member to edit; the dialog is closed while this is null. */
  user: StaffUserDetail | null;
  isSelf: boolean;
  onClose: () => void;
  onSaved: (user: StaffUserDetail, rolesChanged: boolean) => void;
}

export function EditStaffDialog({ user, isSelf, onClose, onSaved }: EditStaffDialogProps) {
  return (
    <Dialog
      open={user !== null}
      size="lg"
      onClose={onClose}
      title={user ? `Edit ${user.fullName}` : "Edit staff member"}
      description="Fields marked * are required. Every change is written to the audit trail. PAN ID / EID and passport numbers are stored encrypted."
    >
      {/* Mounted only while open, so every opening starts from the saved details. */}
      {user && <EditStaffForm user={user} isSelf={isSelf} onCancel={onClose} onSaved={onSaved} />}
    </Dialog>
  );
}

function EditStaffForm({ user, isSelf, onCancel, onSaved }: { user: StaffUserDetail; isSelf: boolean; onCancel: () => void; onSaved: EditStaffDialogProps["onSaved"] }) {
  const queryClient = useQueryClient();
  const [roles, setRoles] = useState<StaffRole[]>(user.roles);
  // Controlled, so the saved manager stays selected while the staff list is still loading.
  const [reportsToId, setReportsToId] = useState(user.reportsTo?.id ?? "");
  const { formRef, errors, setErrors, setFieldError, fieldChanged, incomplete, handleChange, showIncomplete } = useStaffProfileForm(roles, reportsToId);
  const directory = useListStaffDirectory<StaffReference[], ApiError>();

  const update = useUpdateStaffUser<ApiError>({
    mutation: {
      onSuccess: async (updated) => {
        await queryClient.invalidateQueries({ queryKey: getListStaffUsersQueryKey() });
        onSaved(updated, updated.roles.join() !== user.roles.join());
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
    update.mutate({ id: user.id, data });
  }

  const loaded = (directory.data ?? []).filter((person) => person.id !== user.id);
  // The current manager is listed even if they've since been deactivated and left out of the directory.
  const managers =
    user.reportsTo && !loaded.some((person) => person.id === user.reportsTo?.id) ? [user.reportsTo, ...loaded] : loaded;
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
        user={user}
        errors={errors.fields}
        onFieldError={setFieldError}
        onFieldChange={fieldChanged}
        roles={roles}
        onRolesChange={setRoles}
        rolesHint={isSelf ? "Changing your own roles signs you out of every device." : "Changing roles signs the user out of every device."}
        reportsToId={reportsToId}
        onReportsToChange={setReportsToId}
        managers={managers}
      />
      <StaffFormFooter
        incomplete={incomplete}
        error={errors.form}
        pending={update.isPending}
        submitLabel="Save changes"
        pendingLabel="Saving…"
        onCancel={onCancel}
      />
    </form>
  );
}
