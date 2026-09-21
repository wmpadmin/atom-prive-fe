import type { ApiError } from "@atomprive/api-client";
import {
  getGetCustomerQueryKey,
  getListCustomersQueryKey,
  useUpdateClient,
  type CustomerDetail,
  type CustomerRowKycStatus,
} from "@atomprive/api-client/backoffice";
import { Alert, Button, describedBy, Dialog, Field, SelectInput, TextInput } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { noErrors, toFormErrors, type FormErrors } from "../../lib/api-errors";
import { kycStatuses, kycStatusLabels } from "./client-labels";

interface EditClientDialogProps {
  client: CustomerDetail["client"] | null;
  onClose: () => void;
  onSaved: (saved: CustomerDetail) => void;
}

/** Corrects a client's details. Admins only: everyone else sees the file as it stands. */
export function EditClientDialog({ client, onClose, onSaved }: EditClientDialogProps) {
  const queryClient = useQueryClient();
  const [errors, setErrors] = useState<FormErrors>(noErrors);
  const save = useUpdateClient<ApiError>({
    mutation: {
      onSuccess: async (saved) => {
        queryClient.setQueryData(getGetCustomerQueryKey(saved.client.id), saved);
        await queryClient.invalidateQueries({ queryKey: getListCustomersQueryKey() });
        setErrors(noErrors);
        onSaved(saved);
      },
      onError: (caught) => setErrors(toFormErrors(caught)),
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!client) return;
    const form = new FormData(event.currentTarget);
    setErrors(noErrors);
    save.mutate({
      id: client.id,
      data: {
        fullName: String(form.get("fullName")),
        email: String(form.get("email")).trim() || null,
        kycStatus: String(form.get("kycStatus")) as CustomerRowKycStatus,
      },
    });
  }

  return (
    <Dialog
      open={client !== null}
      onClose={close}
      title="Edit client"
      description="Corrections are recorded on the client's timeline with your name."
    >
      {client && (
        <form onSubmit={handleSubmit} className="space-y-4">
          {errors.form && <Alert tone="danger">{errors.form}</Alert>}
          <Field id="fullName" label="Full name" error={errors.fields.fullName}>
            <TextInput {...describedBy("fullName", errors.fields.fullName)} name="fullName" defaultValue={client.fullName} required autoFocus />
          </Field>
          <Field id="email" label="Email" error={errors.fields.email} hint="How the client signs in to the portal.">
            <TextInput {...describedBy("email", errors.fields.email)} name="email" type="email" defaultValue={client.email ?? ""} />
          </Field>
          <Field id="kycStatus" label="KYC status" error={errors.fields.kycStatus} hint="Moved by hand until KYC review is built.">
            <SelectInput {...describedBy("kycStatus", errors.fields.kycStatus)} name="kycStatus" defaultValue={client.kycStatus}>
              {kycStatuses.map((status) => (
                <option key={status} value={status}>
                  {kycStatusLabels[status]}
                </option>
              ))}
            </SelectInput>
          </Field>
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={close} disabled={save.isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  );

  function close() {
    setErrors(noErrors);
    onClose();
  }
}
