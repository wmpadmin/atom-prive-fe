import type { ApiError } from "@atomprive/api-client";
import {
  getGetStaffUserQueryKey,
  getListStaffUsersQueryKey,
  useResetStaffUserPassword,
  type StaffUserDetail,
} from "@atomprive/api-client/backoffice";
import { Alert, Button, Dialog } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { TemporaryPasswordBox } from "./temporary-password-box";

interface ResetPasswordDialogProps {
  user: StaffUserDetail;
  open: boolean;
  onClose: () => void;
}

export function ResetPasswordDialog({ user, open, onClose }: ResetPasswordDialogProps) {
  const queryClient = useQueryClient();
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);
  const [error, setError] = useState<string>();

  const resetPassword = useResetStaffUserPassword<ApiError>({
    mutation: {
      onSuccess: async (result) => {
        setTemporaryPassword(result.temporaryPassword);
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: getGetStaffUserQueryKey(user.id) }),
          queryClient.invalidateQueries({ queryKey: getListStaffUsersQueryKey() }),
        ]);
      },
      onError: (caught) => setError(caught.message),
    },
  });

  function close() {
    setTemporaryPassword(null);
    setError(undefined);
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      title={temporaryPassword ? "Password reset" : `Reset password for ${user.fullName}?`}
      description={
        temporaryPassword
          ? "Give them this temporary password. They'll choose a new one when they sign in."
          : "They'll be signed out of every device straight away and will need the temporary password shown next to sign in."
      }
    >
      {open &&
        (temporaryPassword ? (
          <div className="space-y-5">
            <TemporaryPasswordBox email={user.email} password={temporaryPassword} />
            <div className="flex justify-end">
              <Button onClick={close}>Done</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {error && <Alert tone="danger">{error}</Alert>}
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={close}>
                Cancel
              </Button>
              <Button disabled={resetPassword.isPending} onClick={() => resetPassword.mutate({ id: user.id })}>
                {resetPassword.isPending ? "Resetting…" : "Reset password"}
              </Button>
            </div>
          </div>
        ))}
    </Dialog>
  );
}
