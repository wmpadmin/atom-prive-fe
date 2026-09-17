import type { Address } from "@atomprive/api-client/backoffice";
import { cn, DateInput, describedBy, Field, TextArea, TextInput } from "@atomprive/ui";
import type { ReactNode } from "react";
import { CountriesPicker, CountrySelect } from "../../components/country-select";

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
  className?: string;
}

export function TextField({ id, label, value, onChange, field, placeholder, type = "text", multiline, className }: TextFieldProps) {
  const { error, onBlur } = field(id);
  const control = { ...describedBy(id, error), value: value ?? "", onBlur, placeholder, autoComplete: "off", required: true };
  return (
    <Field id={id} label={label} required error={error} className={className}>
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
  className?: string;
}

export function DateField({ id, label, value, onChange, field, min, max, className }: DateFieldProps) {
  const { error, onBlur } = field(id);
  return (
    <Field id={id} label={label} required error={error} className={className}>
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
        required
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
  className?: string;
}

export function CountryField({ id, label, value, onChange, field, className }: CountryFieldProps) {
  const { error, onBlur } = field(id);
  return (
    <Field id={id} label={label} required error={error} className={className}>
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

/** Address line 1 and 2, city, state, postal code and country; every one is required. */
export function AddressFields({ at, value, onChange, field }: { at: string; value: Address; onChange: (address: Address) => void; field: FieldFor }) {
  const set = (patch: Partial<Address>) => onChange({ ...value, ...patch });
  return (
    <>
      <TextField id={`${at}line1`} label="Address line 1" value={value.line1} onChange={(line1) => set({ line1 })} field={field} placeholder="House or flat number and street" className="sm:col-span-2" />
      <TextField id={`${at}line2`} label="Address line 2" value={value.line2} onChange={(line2) => set({ line2 })} field={field} placeholder="Building, area or district" className="sm:col-span-2" />
      <TextField id={`${at}city`} label="City" value={value.city} onChange={(city) => set({ city })} field={field} />
      <TextField id={`${at}state`} label="State" value={value.state} onChange={(state) => set({ state })} field={field} />
      <TextField id={`${at}postalCode`} label="Postal code" value={value.postalCode} onChange={(postalCode) => set({ postalCode })} field={field} />
      <CountryField id={`${at}country`} label="Country" value={value.country} onChange={(country) => set({ country })} field={field} />
    </>
  );
}

/** A titled group of fields within a step. */
export function FormSection({ title, description, action, children }: { title: string; description?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-ink">{title}</h3>
          {description && <p className="mt-0.5 text-xs text-ink-muted">{description}</p>}
        </div>
        {action}
      </div>
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
