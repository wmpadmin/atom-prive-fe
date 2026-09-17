import type { ApiError } from "@atomprive/api-client";
import {
  useAddSupportedBank,
  useUpdateSupportedBank,
  type BankRequest,
  type BankRequestConnectionType,
  type BankRequestSchedule,
  type BankView,
} from "@atomprive/api-client/backoffice";
import { Alert, Button, describedBy, Dialog, Field, SelectInput, TextInput } from "@atomprive/ui";
import { useState, type FormEvent } from "react";
import { noErrors, toFormErrors, type FormErrors } from "../../lib/api-errors";
import { countries } from "../../lib/countries";
import { connectionLabels, scheduleLabels } from "./config-labels";

interface BankDialogProps {
  /** The bank to edit, "new" to add one, or null when closed. */
  bank: BankView | "new" | null;
  onClose: () => void;
  onSaved: (bank: BankView, added: boolean) => void;
}

export function BankDialog({ bank, onClose, onSaved }: BankDialogProps) {
  const adding = bank === "new";
  return (
    <Dialog
      open={bank !== null}
      onClose={onClose}
      title={adding ? "Add bank" : `Edit ${bank?.name ?? "bank"}`}
      description="Where the bank's data comes from and how often it's fetched. Every change is written to the audit log."
    >
      {/* Mounted only while open, so every opening starts from the bank's saved details. */}
      {bank !== null && <BankForm bank={adding ? null : bank} onCancel={onClose} onSaved={onSaved} />}
    </Dialog>
  );
}

const connectionTypes = Object.keys(connectionLabels) as BankRequestConnectionType[];
const fetchSchedules = (Object.keys(scheduleLabels) as BankRequestSchedule[]).filter((schedule) => schedule !== "ON_UPLOAD");

function BankForm({ bank, onCancel, onSaved }: { bank: BankView | null; onCancel: () => void; onSaved: BankDialogProps["onSaved"] }) {
  const [errors, setErrors] = useState<FormErrors>(noErrors);
  const [connection, setConnection] = useState<BankRequestConnectionType>(bank?.connectionType ?? "SFTP");
  const onError = (error: ApiError) => setErrors(toFormErrors(error));
  const add = useAddSupportedBank<ApiError>({ mutation: { onSuccess: (saved) => onSaved(saved, true), onError } });
  const update = useUpdateSupportedBank<ApiError>({ mutation: { onSuccess: (saved) => onSaved(saved, false), onError } });
  const saving = add.isPending || update.isPending;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setErrors(noErrors);
    const manual = connection === "MANUAL_UPLOAD";
    const data: BankRequest = {
      name: String(form.get("name")),
      bic: String(form.get("bic")),
      countryCode: String(form.get("countryCode")),
      connectionType: connection,
      endpoint: manual ? null : String(form.get("endpoint")),
      schedule: manual ? "ON_UPLOAD" : (String(form.get("schedule")) as BankRequestSchedule),
    };
    if (bank) {
      update.mutate({ id: bank.id, data });
    } else {
      add.mutate({ data });
    }
  }

  const { fields } = errors;
  const endpointLabel = connection === "SFTP" ? "SFTP server and folder" : "API address";
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {errors.form && <Alert tone="danger">{errors.form}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="name" label="Bank name" error={fields.name} className="sm:col-span-2">
          <TextInput {...describedBy("name", fields.name)} name="name" defaultValue={bank?.name} placeholder="DBS Bank" required />
        </Field>
        <Field id="bic" label="BIC / SWIFT code" error={fields.bic}>
          <TextInput {...describedBy("bic", fields.bic)} name="bic" defaultValue={bank?.bic} placeholder="DBSSSGSG" className="font-mono uppercase" required />
        </Field>
        <Field id="countryCode" label="Country" error={fields.countryCode}>
          <SelectInput {...describedBy("countryCode", fields.countryCode)} name="countryCode" defaultValue={bank?.countryCode ?? ""} required>
            <option value="" disabled>
              Choose a country
            </option>
            {countries.map((country) => (
              <option key={country.code} value={country.code}>
                {country.name}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field id="connectionType" label="Connection" error={fields.connectionType}>
          <SelectInput
            {...describedBy("connectionType", fields.connectionType)}
            name="connectionType"
            value={connection}
            onChange={(event) => setConnection(event.target.value as BankRequestConnectionType)}
          >
            {connectionTypes.map((type) => (
              <option key={type} value={type}>
                {connectionLabels[type]}
              </option>
            ))}
          </SelectInput>
        </Field>
        {connection === "MANUAL_UPLOAD" ? (
          <Field id="schedule" label="Schedule" hint="Syncs whenever Operations upload a file.">
            <TextInput id="schedule" value={scheduleLabels.ON_UPLOAD} disabled aria-describedby="schedule-hint" />
          </Field>
        ) : (
          <Field id="schedule" label="Schedule" error={fields.schedule}>
            <SelectInput
              {...describedBy("schedule", fields.schedule)}
              name="schedule"
              defaultValue={bank && bank.schedule !== "ON_UPLOAD" ? bank.schedule : "ONCE_A_DAY"}
            >
              {fetchSchedules.map((schedule) => (
                <option key={schedule} value={schedule}>
                  {scheduleLabels[schedule]}
                </option>
              ))}
            </SelectInput>
          </Field>
        )}
        {connection !== "MANUAL_UPLOAD" && (
          <Field id="endpoint" label={endpointLabel} error={fields.endpoint} className="sm:col-span-2">
            <TextInput
              {...describedBy("endpoint", fields.endpoint)}
              name="endpoint"
              defaultValue={bank?.endpoint ?? ""}
              placeholder={connection === "SFTP" ? "sftp.bank.com/atomprive/out" : "api.bank.com/v1/custody/positions"}
              className="font-mono"
              required
            />
          </Field>
        )}
      </div>
      <div className="flex justify-end gap-3">
        <Button variant="ghost" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : bank ? "Save changes" : "Add bank"}
        </Button>
      </div>
    </form>
  );
}
