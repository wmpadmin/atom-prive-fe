import type { StaffReference, StaffUserDetail } from "@atomprive/api-client/backoffice";
import { Alert, Button, DateInput, describedBy, Field, SelectInput, TextArea, TextInput } from "@atomprive/ui";
import type { ReactNode } from "react";
import { countries, officeCountries } from "../../lib/countries";
import { roleLabels, type StaffRole } from "../../lib/labels";
import { MobileNumberField } from "./mobile-number-field";
import { PhotoField } from "../../components/photo-field";
import { RolePicker } from "./role-picker";

/** The API accepts employment start dates from 1950 up to a year ahead. */
const earliestEmploymentStart = new Date(1950, 0, 1);

interface StaffProfileFieldsProps {
  /** Saved details, when editing someone. */
  user?: StaffUserDetail;
  errors: Record<string, string>;
  /** Shows or clears one field's message, for checks made as someone leaves a field. */
  onFieldError: (field: string, message: string | undefined) => void;
  /** For fields that change without a change event, such as the date picker. */
  onFieldChange: (field: string) => void;
  roles: StaffRole[];
  onRolesChange: (roles: StaffRole[]) => void;
  rolesHint?: string;
  reportsToId: string;
  onReportsToChange: (id: string) => void;
  /** The role they land in at sign-in. Null where they hold one, or where nobody has chosen. */
  defaultRole: StaffRole | null;
  onDefaultRoleChange: (role: StaffRole | null) => void;
  /** A photograph just chosen, as a squared data URI; null means nothing new has been picked. */
  photo: string | null;
  onPhotoChange: (dataUri: string) => void;
  /** People who can be chosen under "Reporting to". */
  managers: StaffReference[];
}

/** Contact, employment and identity fields, shared by the Add and Edit staff dialogs (#74). */
export function StaffProfileFields({
  user,
  errors: fields,
  onFieldError,
  onFieldChange,
  roles,
  onRolesChange,
  defaultRole,
  onDefaultRoleChange,
  photo,
  onPhotoChange,
  rolesHint,
  reportsToId,
  onReportsToChange,
  managers,
}: StaffProfileFieldsProps) {
  const today = new Date();
  const latestEmploymentStart = new Date(today.getFullYear() + 1, today.getMonth(), today.getDate());
  // Nationality used to be typed in; anything that isn't a country code has to be chosen again from the list.
  const savedNationality = countries.find((country) => country.code === user?.nationality)?.code ?? "";

  return (
    <>
      <Section title="Contact">
        <Field id="fullName" label="Full name" required error={fields.fullName}>
          <TextInput {...describedBy("fullName", fields.fullName)} name="fullName" placeholder="e.g. Asha Rao" autoComplete="off" defaultValue={user?.fullName} required />
        </Field>
        <Field id="email" label="Work email" required error={fields.email}>
          <TextInput {...describedBy("email", fields.email)} name="email" type="email" placeholder="name@company.com" autoComplete="off" defaultValue={user?.email} required />
        </Field>
        <MobileNumberField defaultValue={user?.phone} error={fields.phone} onCheck={(message) => onFieldError("phone", message)} />
        <Field id="nationality" label="Nationality" required error={fields.nationality}>
          <SelectInput {...describedBy("nationality", fields.nationality)} name="nationality" defaultValue={savedNationality} required>
            <option value="" disabled>
              Choose a country
            </option>
            {officeCountries.map((country) => (
              <option key={`office-${country.code}`} value={country.code}>
                {country.name}
              </option>
            ))}
            <option disabled>──────────</option>
            {countries.map((country) => (
              <option key={country.code} value={country.code}>
                {country.name}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field id="residentialAddress" label="Residential address" required error={fields.residentialAddress} className="sm:col-span-2">
          <TextArea {...describedBy("residentialAddress", fields.residentialAddress)} name="residentialAddress" rows={2} defaultValue={user?.residentialAddress ?? ""} required />
        </Field>
      </Section>

      <Section title="Employment">
        <Field id="designation" label="Designation" required error={fields.designation}>
          <TextInput {...describedBy("designation", fields.designation)} name="designation" placeholder="Senior Relationship Manager" defaultValue={user?.designation ?? ""} required />
        </Field>
        <Field id="employmentStart" label="Employment start" required error={fields.employmentStart}>
          <DateInput
            {...describedBy("employmentStart", fields.employmentStart)}
            name="employmentStart"
            defaultValue={user?.employmentStart}
            min={earliestEmploymentStart}
            max={latestEmploymentStart}
            onChange={() => onFieldChange("employmentStart")}
            required
          />
        </Field>
        {/* Admins run the firm, so they report to nobody. */}
        {!roles.includes("ADMIN") && (
          <Field id="reportsToId" label="Reporting to" required error={fields.reportsToId}>
            <SelectInput
              {...describedBy("reportsToId", fields.reportsToId)}
              name="reportsToId"
              value={reportsToId}
              onChange={(event) => onReportsToChange(event.target.value)}
              required
            >
              <option value="" disabled>
                Choose a person
              </option>
              {managers.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.fullName}
                </option>
              ))}
            </SelectInput>
          </Field>
        )}
        <Field id="licenceNumber" label="Licence number" required error={fields.licenceNumber}>
          <TextInput {...describedBy("licenceNumber", fields.licenceNumber)} name="licenceNumber" placeholder="CMS-FA-204" defaultValue={user?.licenceNumber ?? ""} required />
        </Field>
      </Section>

      <Section title="Access & identity">
        {/* Optional, and replaced rather than removed. Carried in the form body because somebody being
            added has no account yet to upload a photograph against. */}
        <div className="sm:col-span-2">
          {/* Nobody's initials until somebody has a name. "New member of staff" put NM in the circle,
              which reads as a person whose initials are N.M. */}
          <PhotoField
            kind="staff"
            name={user?.fullName ?? ""}
            photo={photo ?? user?.photo ?? null}
            onChoose={onPhotoChange}
            hint="Optional. JPG, PNG or WebP, up to 5MB. They can change it themselves in Settings."
          />
        </div>
        <div className="sm:col-span-2">
          <RolePicker
            required
            value={roles}
            onChange={onRolesChange}
            hint={rolesHint}
            error={fields.roles}
          />
        </div>
        {/* Only where there is a choice. One role is the answer when there is only one, and a dropdown
            offering it would be a decision nobody has to make. */}
        {roles.length > 1 && (
          <Field
            id="defaultRole"
            label="Workspace they open in"
            required
            error={fields.defaultRole}
            hint="Where they land after signing in. They can change their own on their Settings."
            className="sm:col-span-2"
          >
            <SelectInput
              id="defaultRole"
              value={defaultRole ?? ""}
              onChange={(event) => {
                onFieldError("defaultRole", undefined);
                onDefaultRoleChange((event.target.value || null) as StaffRole | null);
              }}
            >
              <option value="">They choose for themselves</option>
              {roles.map((role) => (
                <option key={role} value={role}>
                  {roleLabels[role]}
                </option>
              ))}
            </SelectInput>
          </Field>
        )}
        <Field id="nationalId" label="PAN ID / EID" required error={fields.nationalId}>
          <TextInput {...describedBy("nationalId", fields.nationalId)} name="nationalId" autoComplete="off" defaultValue={user?.nationalId ?? ""} className="uppercase" required />
        </Field>
        <Field id="passportNumber" label="Passport number" required error={fields.passportNumber}>
          <TextInput {...describedBy("passportNumber", fields.passportNumber)} name="passportNumber" autoComplete="off" defaultValue={user?.passportNumber ?? ""} className="uppercase" required />
        </Field>
      </Section>
    </>
  );
}

interface StaffFormFooterProps {
  /** Required fields still to complete; saving stays off until there are none. */
  incomplete: Record<string, string>;
  /** A problem with the whole form, such as the email already being in use. */
  error?: string;
  pending: boolean;
  submitLabel: string;
  pendingLabel: string;
  onCancel: () => void;
}

/** Cancel and save for the staff forms. Saving stays off until every required field is complete. */
export function StaffFormFooter({ incomplete, error, pending, submitLabel, pendingLabel, onCancel }: StaffFormFooterProps) {
  return (
    <div className="sticky bottom-0 space-y-3 border-t border-line bg-white pt-4">
      {error && <Alert tone="danger">{error}</Alert>}
      <div className="flex justify-end gap-3">
        <Button variant="ghost" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending || Object.keys(incomplete).length > 0}>
          {pending ? pendingLabel : submitLabel}
        </Button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-3">
      <legend className="text-xs font-semibold tracking-wider text-primary-600 uppercase">{title}</legend>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}
