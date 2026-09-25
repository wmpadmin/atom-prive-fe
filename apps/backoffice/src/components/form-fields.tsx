import type { Address } from "@atomprive/api-client/backoffice";
import { cn, DateInput, describedBy, Field, TextArea, TextInput } from "@atomprive/ui";
import { useState, type ReactNode } from "react";
import { madeSignature } from "../pages/forms/made-signature";
import { CountriesPicker, CountrySelect } from "./country-select";
import { SignHereDialog } from "./sign-here-dialog";
import { SignatureMark } from "./signature-mark";

/** A field's message, shown once someone has been to the field, and the handler that marks the visit. */
export interface FieldState {
  error?: string;
  onBlur: () => void;
}

/** Looks up a field by its path, such as "holders[0].surname", which is also its id. */
export type FieldFor = (id: string) => FieldState;

interface TextFieldProps {
  id: string;
  label: string;
  value: string | null;
  onChange: (value: string) => void;
  field: FieldFor;
  placeholder?: string;
  type?: "text" | "email";
  multiline?: boolean;
  /** A field the form does not insist on, such as a postal code the jurisdiction may not issue. */
  optional?: boolean;
  /**
   * The form prints this line but the answer above it has not opened the line yet, as with a box that is only
   * written on if the question before it was answered one way. The rule is shown; it cannot be written on.
   */
  disabled?: boolean;
  className?: string;
}

export function TextField({ id, label, value, onChange, field, placeholder, type = "text", multiline, optional, disabled, className }: TextFieldProps) {
  const { error, onBlur } = field(id);
  const control = { ...describedBy(id, error), value: value ?? "", onBlur, placeholder, autoComplete: "off", required: !optional && !disabled, disabled };
  return (
    <Field id={id} label={label} required={!optional && !disabled} error={error} className={className}>
      {multiline ? (
        <TextArea {...control} rows={2} onChange={(event) => onChange(event.target.value)} />
      ) : (
        <TextInput {...control} type={type} onChange={(event) => onChange(event.target.value)} />
      )}
    </Field>
  );
}

interface DateFieldProps {
  id: string;
  label: string;
  value: string | null;
  onChange: (value: string) => void;
  field: FieldFor;
  min: Date;
  max: Date;
  /** A date the form does not insist on. */
  optional?: boolean;
  /** The form prints this line but the answer above it has not opened it yet. */
  disabled?: boolean;
  className?: string;
}

export function DateField({ id, label, value, onChange, field, min, max, optional, disabled, className }: DateFieldProps) {
  const { error, onBlur } = field(id);
  const asked = !optional && !disabled;
  return (
    <Field id={id} label={label} required={asked} error={error} className={className}>
      <DateInput
        {...describedBy(id, error)}
        name={id}
        defaultValue={value}
        min={min}
        max={max}
        onChange={(chosen) => {
          onChange(chosen);
          onBlur();
        }}
        required={asked}
        disabled={disabled}
      />
    </Field>
  );
}

interface CountryFieldProps {
  id: string;
  label: string;
  value: string | null;
  onChange: (code: string) => void;
  field: FieldFor;
  /** A country the form does not insist on, such as the one in an address only given if it differs. */
  optional?: boolean;
  className?: string;
}

export function CountryField({ id, label, value, onChange, field, optional, className }: CountryFieldProps) {
  const { error, onBlur } = field(id);
  return (
    <Field id={id} label={label} required={!optional} error={error} className={className}>
      <CountrySelect {...describedBy(id, error)} value={value} onChange={onChange} onBlur={onBlur} />
    </Field>
  );
}

interface CountriesFieldProps {
  id: string;
  label: string;
  value: string[];
  onChange: (codes: string[]) => void;
  field: FieldFor;
  className?: string;
}

export function CountriesField({ id, label, value, onChange, field, className }: CountriesFieldProps) {
  const { error, onBlur } = field(id);
  return (
    <Field id={id} label={label} required error={error} className={className}>
      <CountriesPicker
        {...describedBy(id, error)}
        value={value}
        onChange={(codes) => {
          onChange(codes);
          onBlur();
        }}
      />
    </Field>
  );
}

/** Address line 1 and 2, city, state, postal code and country; every one is required unless the block itself is optional. */
export function AddressFields({
  at,
  value,
  onChange,
  field,
  optional,
  insistOnLine2,
  insistOnState = true,
}: {
  at: string;
  value: Address;
  onChange: (address: Address) => void;
  field: FieldFor;
  /** An address the form does not insist on, such as the second mailing address it heads Optional. */
  optional?: boolean;
  /** The client documents never ask for a second address line; the onboarding application does. */
  insistOnLine2?: boolean;
  /**
   * Whether a state is asked for. The entity account opening form prints it against the entity's registered
   * address and not against a person's, and asks for neither; the onboarding application asks for both.
   */
  insistOnState?: boolean;
}) {
  const set = (patch: Partial<Address>) => onChange({ ...value, ...patch });
  return (
    <>
      <TextField id={`${at}line1`} label="Address Line 1" value={value.line1} onChange={(line1) => set({ line1 })} field={field} optional={optional} placeholder="House or flat number and street" className="sm:col-span-2" />
      <TextField id={`${at}line2`} label="Address Line 2" value={value.line2} onChange={(line2) => set({ line2 })} field={field} optional={optional || !insistOnLine2} placeholder="Building, area or district" className="sm:col-span-2" />
      <TextField id={`${at}city`} label="City" value={value.city} onChange={(city) => set({ city })} field={field} optional={optional} />
      <TextField id={`${at}state`} label="State" value={value.state} onChange={(state) => set({ state })} field={field} optional={optional || !insistOnState} />
      <TextField id={`${at}postalCode`} label="Postal Code" value={value.postalCode} onChange={(postalCode) => set({ postalCode })} field={field} optional={optional} />
      <CountryField id={`${at}country`} label="Country" value={value.country} onChange={(country) => set({ country })} field={field} optional={optional} />
    </>
  );
}

/** A titled group of fields within a step. */
export function FormSection({ title, description, action, children }: { title?: string; description?: string; action?: ReactNode; children: ReactNode }) {
  // A group the part is already named after says it once, at the head of the part, and not again here.
  const named = Boolean(title || description || action);
  return (
    <section className="space-y-4">
      {named && (
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            {title && <h3 className="text-sm font-bold text-ink">{title}</h3>}
            {description && <p className="mt-0.5 text-xs text-ink-muted">{description}</p>}
          </div>
          {action}
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

/** Follow-up fields that only apply because of an answer above, such as the employer of a salaried client. */
export function FollowUp({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("space-y-4 rounded-xl border border-line bg-slate-50/70 p-4 sm:col-span-2", className)}>
      <p className="text-2xs font-semibold tracking-wider text-primary-600 uppercase">{title}</p>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </div>
  );
}

interface SignatureFieldProps {
  id: string;
  label: string;
  value: string | null;
  onChange: (value: string) => void;
  field: FieldFor;
  /** Whose signature the form asks for here, in its own words: "the client", "the firm". */
  who?: string;
  /** Who that is by name, where the form knows it. */
  forName?: string;
  /** A signature the form does not insist on. */
  optional?: boolean;
  disabled?: boolean;
  className?: string;
}

/**
 * A signature on a form. The same e-signature the documents take: typed or drawn, made on the client's behalf
 * and recorded as such. It is kept as a string like every other answer, so nothing about saving changes.
 */
export function SignatureField({ id, label, value, onChange, field, who = "the client", forName, optional, disabled, className }: SignatureFieldProps) {
  const { error } = field(id);
  const [signing, setSigning] = useState(false);
  const made = madeSignature(value ?? undefined);
  return (
    <Field id={id} label={label} required={!optional && !disabled} error={error} className={className}>
      <div {...describedBy(id, error)}>
        <SignatureMark
          made={made}
          who={who}
          shape="field"
          disabled={disabled}
          onOpen={() => setSigning(true)}
          // A signature typed in before this was an e-signature is left readable rather than thrown away.
          written={!made && value ? value : undefined}
        />
      </div>
      <SignHereDialog
        spot={signing ? id : null}
        who={who}
        forName={forName}
        made={made}
        onClose={() => setSigning(false)}
        onSigned={(signature) => {
          onChange(signature ? JSON.stringify(signature) : "");
          setSigning(false);
        }}
      />
    </Field>
  );
}
