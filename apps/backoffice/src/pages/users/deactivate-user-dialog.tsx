import type { ApiError } from "@atomprive/api-client";
import {
  getGetStaffUserQueryKey,
  getListStaffUsersQueryKey,
  useDeactivateStaffUser,
} from "@atomprive/api-client/backoffice";
import { Alert, Button, Dialog } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

interface DeactivateUserDialogProps {
  /** The user to deactivate; the dialog is closed while this is null. */
  user: { id: string; fullName: string } | null;
  onClose: () => void;
  onDeactivated: () => void;
}

export function DeactivateUserDialog({ user, onClose, onDeactivated }: DeactivateUserDialogProps) {
  return (
    <Dialog
      open={user !== null}
      onClose={onClose}
      title={user ? `Deactivate ${user.fullName}?` : "Deactivate user"}
      description="They'll be signed out of every device straight away and won't be able to sign in. Their audit history is kept."
    >
      {user && <Confirm user={user} onClose={onClose} onDeactivated={onDeactivated} />}
    </Dialog>
  );
}

function Confirm({ user, onClose, onDeactivated }: DeactivateUserDialogProps & { user: { id: string } }) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string>();
  const deactivate = useDeactivateStaffUser<ApiError>({
    mutation: {
      onSuccess: async () => {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: getListStaffUsersQueryKey() }),
          queryClient.invalidateQueries({ queryKey: getGetStaffUserQueryKey(user.id) }),
        ]);
        onDeactivated();
      },
      onError: (caught) => setError(caught.message),
    },
  });

  return (
    <div className="space-y-4">
      {error && <Alert tone="danger">{error}</Alert>}
      <div className="flex justify-end gap-3">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="danger" disabled={deactivate.isPending} onClick={() => deactivate.mutate({ id: user.id })}>
          {deactivate.isPending ? "Deactivating…" : "Deactivate"}
        </Button>
      </div>
    </div>
  );
}
