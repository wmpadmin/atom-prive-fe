import type { ApiError } from "@atomprive/api-client";
import { useAddIncomingField, type MappedField } from "@atomprive/api-client/backoffice";
import { Alert, Button, describedBy, Dialog, Field, TextInput } from "@atomprive/ui";
import { useState, type FormEvent } from "react";
import { noErrors, toFormErrors, type FormErrors } from "../../lib/api-errors";

interface AddFieldDialogProps {
  open: boolean;
  bankId: string;
  bankName: string;
  onClose: () => void;
  onAdded: (field: MappedField) => void;
}

/** Adds a field from a bank's file specification before its data starts arriving. */
export function AddFieldDialog({ open, bankId, bankName, onClose, onAdded }: AddFieldDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Add incoming field"
      description={`A field ${bankName} sends, named exactly as it appears in their file or API response.`}
    >
      {open && <AddFieldForm bankId={bankId} onCancel={onClose} onAdded={onAdded} />}
    </Dialog>
  );
}

function AddFieldForm({ bankId, onCancel, onAdded }: { bankId: string; onCancel: () => void; onAdded: (field: MappedField) => void }) {
  const [errors, setErrors] = useState<FormErrors>(noErrors);
  const add = useAddIncomingField<ApiError>({
    mutation: { onSuccess: onAdded, onError: (error) => setErrors(toFormErrors(error)) },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setErrors(noErrors);
    add.mutate({
      bankId,
      data: { incomingField: String(form.get("incomingField")), sampleValue: String(form.get("sampleValue")) || null },
    });
  }

  const { fields } = errors;
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {errors.form && <Alert tone="danger">{errors.form}</Alert>}
      <Field id="incomingField" label="Field name" error={fields.incomingField}>
        <TextInput {...describedBy("incomingField", fields.incomingField)} name="incomingField" placeholder="ACCT_NO" className="font-mono" required />
      </Field>
      <Field id="sampleValue" label="Sample value (optional)" hint="An example value helps recognise the field later." error={fields.sampleValue}>
        <TextInput {...describedBy("sampleValue", fields.sampleValue)} name="sampleValue" placeholder="0021-889-4410" className="font-mono" />
      </Field>
      <div className="flex justify-end gap-3">
        <Button variant="ghost" onClick={onCancel} disabled={add.isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={add.isPending}>
          {add.isPending ? "Adding…" : "Add field"}
        </Button>
      </div>
    </form>
  );
}
