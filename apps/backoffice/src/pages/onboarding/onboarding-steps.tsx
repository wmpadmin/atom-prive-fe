import type { Address, StaffMember } from "@atomprive/api-client/backoffice";
import { cn, describedBy, Field, RequiredMark, SelectInput } from "@atomprive/ui";
import { Building2, Check, User } from "lucide-react";
import { Fragment, type ReactNode } from "react";
import { ChoiceCards } from "../../components/choice-cards";
import { choicesOf, pillClasses } from "./choices";
import { PEP_NOTE } from "./print-wording";
import { MobileNumberInput } from "../../components/mobile-number-input";
import {
  EMIRATES,
  employmentStatusLabels,
  genderLabels,
  holderName,
  maritalStatusLabels,
  MAX_CITIZENSHIP,
  MAX_NATIONALITIES,
  MAX_WEALTH_COUNTRIES,
  activeForLabels,
  decisionLabels,
  incomeLabels,
  incomeSourceLabels,
  knowledgeLabels,
  managedByLabels,
  netWealthLabels,
  productLabels,
  serviceLabels,
  turnoverLabels,
  wealthSourceLabels,
  type ActiveFor,
  type Decision,
  type FormProfile,
  type Income,
  type IncomeSource,
  type Knowledge,
  type ManagedBy,
  type NetWealth,
  type PepLine,
  type Product,
  type Service,
  type Turnover,
  type WealthSource,
  signingAuthorityText,
  signingModeLabels,
  works,
  type SigningMode,
  type ClientType,
  type EmploymentStatus,
  type FormApplication,
  type FormHolder,
  type Gender,
  type HolderDetails,
  type MaritalStatus,
} from "./application";
import { CountriesField, CountryField, DateField, TextField, type FieldFor } from "../../components/form-fields";
import { useRelationshipTypes } from "../../lib/relationship-types";

export function daysFromToday(days: number, years = 0) {
  const today = new Date();
  return new Date(today.getFullYear() + years, today.getMonth(), today.getDate() + days);
}

export function ClientTypeStep({
  application,
  managers,
  onChange,
  field,
}: {
  application: FormApplication;
  managers: StaffMember[] | undefined;
  onChange: (patch: Partial<FormApplication>) => void;
  field: FieldFor;
}) {
  const manager = field("relationshipManagerId");
  return (
    <div className="space-y-6">
      <ChoiceCards<ClientType>
        name="clientType"
        legend="Client type"
        required
        value={application.clientType}
        onChange={(clientType) => onChange({ clientType })}
        error={field("clientType").error}
        choices={[
          { value: "INDIVIDUAL", label: "Individual", description: "A person, or people holding a joint account", icon: <User /> },
          { value: "ENTITY", label: "Entity", description: "A company, trust or foundation", icon: <Building2 /> },
        ]}
      />
      <Field
        id="relationshipManagerId"
        label="Relationship manager"
        required
        error={manager.error}
        hint={managers?.length === 0 ? "There are no relationship managers yet. An Admin can add staff with the Relationship manager role." : "The relationship manager who will look after this client."}
        className="sm:max-w-sm"
      >
        <SelectInput
          {...describedBy("relationshipManagerId", manager.error)}
          value={application.relationshipManagerId ?? ""}
          onChange={(event) => onChange({ relationshipManagerId: event.target.value })}
          onBlur={manager.onBlur}
          required
        >
          <option value="" disabled>
            {managers ? "Choose a relationship manager" : "Loading relationship managers…"}
          </option>
          {(managers ?? []).map((person) => (
            <option key={person.id} value={person.id}>
              {person.fullName}
            </option>
          ))}
        </SelectInput>
      </Field>
    </div>
  );
}

interface HolderStepProps {
  index: number;
  /** Whose sections these are: an account holder's, or an entity's beneficial owner's (25 Nov 2026), asked the same. */
  list?: "holders" | "beneficialOwners";
  holder: FormHolder;
  onChange: (patch: Partial<FormHolder>) => void;
  field: FieldFor;
}

/** A change to the holder's Client Details answers, keeping the rest of them. */
function changeDetails(holder: FormHolder, onChange: (patch: Partial<FormHolder>) => void) {
  return (patch: Partial<HolderDetails>) => onChange({ details: { ...holder.details, ...patch } });
}

/** A change to the holder's answers on the paper's second page, keeping the rest of them. */
function changeProfile(holder: FormHolder, onChange: (patch: Partial<FormHolder>) => void) {
  return (patch: Partial<FormProfile>) => onChange({ details: { ...holder.details, profile: { ...holder.details.profile, ...patch } } });
}

/**
 * One section's fields in two even columns (24 Nov 2026, from the user's design). Every gap in a step is the same,
 * gap-x-6, so a row of choices lines up with the columns above and below it.
 */
export function Fields({ children }: { children: ReactNode }) {
  return <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">{children}</div>;
}

/** The box a choice button carries: round for one answer, square for tick-all-that-apply. */
export function Mark({ checked, square }: { checked: boolean; square?: boolean }) {
  return square ? (
    <span aria-hidden="true" className={cn("grid size-4.5 shrink-0 place-items-center rounded-md border-2", checked ? "border-primary-600 bg-primary-600 text-on-accent" : "border-slate-300")}>
      {checked && <Check className="size-3" strokeWidth={3} />}
    </span>
  ) : (
    <span aria-hidden="true" className={cn("grid size-4.5 shrink-0 place-items-center rounded-full border-2", checked ? "border-primary-600" : "border-slate-300")}>
      {checked && <span className="size-2 rounded-full bg-primary-600" />}
    </span>
  );
}


/**
 * A choice of one answer as round-dotted buttons (24 Nov 2026, from the user's design). `columns` sets how many sit
 * in a row; with the same gap as the section, two of them fill exactly one column of it.
 */
export function RadioPills<T extends string>({ name, legend, note, required, value, onChange, choices, error, columns, className, legendClassName, disabled }: {
  name: string;
  legend: string;
  /** Said after the question in plain type, such as when it is asked. */
  note?: string;
  required?: boolean;
  value: T | null;
  onChange: (value: T) => void;
  choices: { value: T; label: string }[];
  error?: string;
  columns: string;
  className?: string;
  legendClassName?: string;
  /** The paper prints the question but an answer above it has not opened it yet: shown greyed, not hidden. */
  disabled?: boolean;
}) {
  return (
    <fieldset disabled={disabled} aria-describedby={error ? `${name}-error` : undefined} aria-invalid={error ? true : undefined} className={cn("min-w-0", disabled && "opacity-50", className)}>
      <legend className={cn("mb-1.5 text-sm font-semibold text-ink", legendClassName)}>
        {legend}
        {required && !disabled && <RequiredMark />}
        {note && <span className="font-normal text-ink-muted"> {note}</span>}
      </legend>
      <div className={cn("grid gap-x-6 gap-y-2", columns)}>
        {choices.map((choice) => (
          <label key={choice.value} className={cn(pillClasses(value === choice.value), disabled && "cursor-not-allowed hover:border-line")}>
            <input type="radio" name={name} value={choice.value} checked={value === choice.value} onChange={() => onChange(choice.value)} className="sr-only" />
            <Mark checked={value === choice.value} />
            {choice.label}
          </label>
        ))}
      </div>
      {error && <p id={`${name}-error`} className="mt-1.5 text-xs text-red-600">{error}</p>}
    </fieldset>
  );
}

/** "Tick all that apply" as square-boxed buttons (24 Nov 2026): the paper's questions where several answers fit. */
export function CheckPills<T extends string>({ name, legend, note = "(tick all that apply)", required, value, onChange, choices, error, columns, className }: {
  name: string;
  legend: string;
  /** Said after the question in plain type. */
  note?: string;
  required?: boolean;
  value: T[];
  onChange: (value: T[]) => void;
  choices: { value: T; label: string }[];
  error?: string;
  columns: string;
  className?: string;
}) {
  return (
    <fieldset aria-describedby={error ? `${name}-error` : undefined} aria-invalid={error ? true : undefined} className={cn("min-w-0", className)}>
      <legend className="mb-1.5 text-sm font-semibold text-ink">
        {legend} <span className="font-normal text-ink-muted">{note}</span>
        {required && <RequiredMark />}
      </legend>
      <div className={cn("grid gap-x-6 gap-y-2", columns)}>
        {choices.map((choice) => {
          const checked = value.includes(choice.value);
          return (
            <label key={choice.value} className={pillClasses(checked)}>
              <input type="checkbox" name={name} value={choice.value} checked={checked} className="sr-only"
                onChange={() => onChange(checked ? value.filter((one) => one !== choice.value) : [...value, choice.value])} />
              <Mark checked={checked} square />
              {choice.label}
            </label>
          );
        })}
      </div>
      {error && <p id={`${name}-error`} className="mt-1.5 text-xs text-red-600">{error}</p>}
    </fieldset>
  );
}


/** Who the holder is: Schedule 2's name lines (24 Nov 2026), and only those. */
export function NameStep({ index, list = "holders", holder, onChange, field }: HolderStepProps) {
  const at = `${list}[${index}].`;
  const details = holder.details;
  const setDetails = changeDetails(holder, onChange);
  return (
    <Fields>
      <TextField id={`${at}fullName`} label="Full name (as on passport)" value={holder.fullName} onChange={(fullName) => onChange({ fullName })} field={field} className="sm:col-span-2" />
      <TextField id={`${at}details.previousNames`} label="Previous name(s)" value={details.previousNames} onChange={(previousNames) => setDetails({ previousNames })} field={field} optional />
      <TextField id={`${at}details.otherNames`} label="Other name(s) (including any alias)" value={details.otherNames} onChange={(otherNames) => setDetails({ otherNames })} field={field} optional />
    </Fields>
  );
}

/** Schedule 2's gender, birth and marital lines (24 Nov 2026). */
export function BirthStep({ index, list = "holders", holder, onChange, field }: HolderStepProps) {
  const at = `${list}[${index}].`;
  const details = holder.details;
  const setDetails = changeDetails(holder, onChange);
  return (
    <Fields>
      <RadioPills<Gender> name={`${at}details.gender`} legend="Gender" required columns="grid-cols-2" value={details.gender}
        onChange={(gender) => setDetails({ gender })} error={field(`${at}details.gender`).error} choices={choicesOf(genderLabels)} />
      <DateField id={`${at}dateOfBirth`} label="Date of birth" value={holder.dateOfBirth} onChange={(dateOfBirth) => onChange({ dateOfBirth })} field={field} min={new Date(1900, 0, 1)} max={daysFromToday(-1)} />
      <TextField id={`${at}details.placeOfBirth`} label="Place of birth" value={details.placeOfBirth} onChange={(placeOfBirth) => setDetails({ placeOfBirth })} field={field} />
      <CountryField id={`${at}countryOfBirth`} label="Country of birth" value={holder.countryOfBirth} onChange={(countryOfBirth) => onChange({ countryOfBirth })} field={field} />
      <RadioPills<MaritalStatus> name={`${at}details.maritalStatus`} legend="Marital status" required columns="grid-cols-2 sm:grid-cols-4" className="sm:col-span-2"
        value={details.maritalStatus} onChange={(maritalStatus) => setDetails({ maritalStatus })} error={field(`${at}details.maritalStatus`).error} choices={choicesOf(maritalStatusLabels)} />
      {/* On the paper always; written on only for someone married. */}
      <TextField id={`${at}details.spouseName`} label="Spouse name" value={details.spouseName} onChange={(spouseName) => setDetails({ spouseName })} field={field} disabled={details.maritalStatus !== "MARRIED"} className="sm:col-span-2" />
    </Fields>
  );
}

/** Schedule 2's nationality, citizenship, domicile and fiscal residence lines (24 Nov 2026). */
export function NationalityStep({ index, list = "holders", holder, onChange, field }: HolderStepProps) {
  const at = `${list}[${index}].`;
  const details = holder.details;
  const setDetails = changeDetails(holder, onChange);
  // "Nationality (Nationalities)": one line of up to four on the paper; the first is the holder's nationality.
  const nationalities = [holder.nationality, ...details.otherNationalities].filter((code): code is string => Boolean(code));
  return (
    <Fields>
      <CountriesField id={`${at}nationality`} label={`Nationality (Nationalities), up to ${MAX_NATIONALITIES}`} value={nationalities}
        onChange={(codes) => onChange({ nationality: codes[0] ?? null, details: { ...details, otherNationalities: codes.slice(1) } })} field={field} className="sm:col-span-2" />
      <CountriesField id={`${at}details.citizenship`} label={`Country of citizenship / residency, up to ${MAX_CITIZENSHIP}`} value={details.citizenship}
        onChange={(citizenship) => setDetails({ citizenship })} field={field} className="sm:col-span-2" />
      <CountryField id={`${at}details.legalDomicile`} label="Country of legal domicile (only if different from above)" value={details.legalDomicile} onChange={(legalDomicile) => setDetails({ legalDomicile })} field={field} optional />
      <CountryField id={`${at}details.fiscalResidence`} label="Country of fiscal residence (only if different from above)" value={details.fiscalResidence} onChange={(fiscalResidence) => setDetails({ fiscalResidence })} field={field} optional />
    </Fields>
  );
}

/** The emirate of an address, which the paper asks "if applicable": open only for an address in the UAE. */
export function EmirateField({ id, value, onChange, applies }: { id: string; value: string | null; onChange: (emirate: string | null) => void; applies: boolean }) {
  return (
    <Field id={id} label="Emirate (if applicable)">
      <SelectInput id={id} value={applies ? value ?? "" : ""} onChange={(event) => onChange(event.target.value || null)} disabled={!applies}>
        <option value="">{applies ? "Not given" : "Not applicable"}</option>
        {EMIRATES.map((one) => (
          <option key={one} value={one}>
            {one}
          </option>
        ))}
      </SelectInput>
    </Field>
  );
}

/**
 * An address as Schedule 2 asks it (24 Nov 2026): the address on one line, then the postal code or P.O. box, the
 * country and the emirate if applicable. No second line, city or state, which the paper does not have.
 */
function PaperAddress({ at, label, value, onChange, emirateId, emirate, onEmirate, field, optional }: {
  at: string;
  label: string;
  emirateId: string;
  value: Address;
  onChange: (address: Address) => void;
  emirate: string | null;
  onEmirate: (emirate: string | null) => void;
  field: FieldFor;
  optional?: boolean;
}) {
  const set = (patch: Partial<Address>) => onChange({ ...value, ...patch });
  return (
    <>
      <TextField id={`${at}line1`} label={label} value={value.line1} onChange={(line1) => set({ line1 })} field={field} optional={optional} className="sm:col-span-2" />
      <div className="grid gap-x-6 gap-y-4 sm:col-span-2 sm:grid-cols-3">
        <TextField id={`${at}postalCode`} label="Postal code / P.O. box" value={value.postalCode} onChange={(postalCode) => set({ postalCode })} field={field} optional={optional} />
        <CountryField id={`${at}country`} label="Country" value={value.country} onChange={(country) => set({ country })} field={field} optional={optional} />
        <EmirateField id={emirateId} value={emirate} onChange={onEmirate} applies={value.country === "AE"} />
      </div>
    </>
  );
}

/** Schedule 2's permanent address, and the mailing address if it is different (24 Nov 2026). */
export function AddressStep({ index, list = "holders", holder, onChange, field }: HolderStepProps) {
  const at = `${list}[${index}].`;
  const details = holder.details;
  const setDetails = changeDetails(holder, onChange);
  return (
    <Fields>
      <PaperAddress at={`${at}residentialAddress.`} label="Permanent address" value={holder.residentialAddress} emirateId={`${at}details.emirate`}
        onChange={(residentialAddress) => onChange({ residentialAddress })} emirate={details.emirate} onEmirate={(emirate) => setDetails({ emirate })} field={field} />
      <PaperAddress at={`${at}mailingAddress.`} label="Mailing address (if different to the address stated above)" value={holder.mailingAddress} emirateId={`${at}details.mailingEmirate`}
        onChange={(mailingAddress) => onChange({ mailingAddress })} emirate={details.mailingEmirate} onEmirate={(mailingEmirate) => setDetails({ mailingEmirate })} field={field} optional />
    </Fields>
  );
}

/** Schedule 2's telephone, fax and email lines, two of each (24 Nov 2026). */
export function ContactStep({ index, list = "holders", holder, onChange, field }: HolderStepProps) {
  const at = `${list}[${index}].`;
  const details = holder.details;
  const setDetails = changeDetails(holder, onChange);
  const phone = field(`${at}phone`);
  const secondPhone = field(`${at}details.secondPhone`);
  return (
    <Fields>
      <Field id={`${at}phone`} label="Telephone" required error={phone.error}>
        <MobileNumberInput {...describedBy(`${at}phone`, phone.error)} value={holder.phone ?? ""} onChange={(value) => onChange({ phone: value })} onBlur={phone.onBlur} />
      </Field>
      <Field id={`${at}details.secondPhone`} label="Second telephone" error={secondPhone.error}>
        <MobileNumberInput {...describedBy(`${at}details.secondPhone`, secondPhone.error)} value={details.secondPhone ?? ""} onChange={(value) => setDetails({ secondPhone: value || null })} onBlur={secondPhone.onBlur} />
      </Field>
      <TextField id={`${at}details.fax`} label="Fax" value={details.fax} onChange={(fax) => setDetails({ fax })} field={field} optional />
      <TextField id={`${at}details.secondFax`} label="Second fax" value={details.secondFax} onChange={(secondFax) => setDetails({ secondFax })} field={field} optional />
      <TextField id={`${at}email`} label="Email" type="email" value={holder.email} onChange={(email) => onChange({ email })} field={field} placeholder="name@example.com" />
      <TextField id={`${at}details.secondEmail`} label="Second email" type="email" value={details.secondEmail} onChange={(secondEmail) => setDetails({ secondEmail })} field={field} optional placeholder="name@example.com" />
    </Fields>
  );
}

/**
 * Schedule 2's professional details (24 Nov 2026), every line the paper prints: the status always, and the job
 * title, sector, employer and country of business written on for someone employed or self employed.
 */
export function WorkStep({ index, list = "holders", holder, onChange, field }: HolderStepProps) {
  const at = `${list}[${index}].`;
  const details = holder.details;
  const setDetails = changeDetails(holder, onChange);
  const employer = holder.employer;
  const working = works(details);
  return (
    <Fields>
      <RadioPills<EmploymentStatus> name={`${at}details.employmentStatus`} legend="Status" required columns="grid-cols-2 sm:grid-cols-4" className="sm:col-span-2"
        value={details.employmentStatus} onChange={(employmentStatus) => setDetails({ employmentStatus })} error={field(`${at}details.employmentStatus`).error} choices={choicesOf(employmentStatusLabels)} />
      <TextField id={`${at}employer.position`} autoComplete="organization-title" label="Job title / function" value={employer.position} onChange={(position) => onChange({ employer: { ...employer, position } })} field={field} disabled={!working} />
      <TextField id={`${at}details.sector`} label="Sector / industry" value={details.sector} onChange={(sector) => setDetails({ sector })} field={field} disabled={!working} />
      <TextField id={`${at}employer.companyName`} autoComplete="organization" label="Name of employer" value={employer.companyName} onChange={(companyName) => onChange({ employer: { ...employer, companyName } })} field={field} disabled={!working} />
      <CountryField id={`${at}employer.country`} label="Country of business" value={employer.country} onChange={(country) => onChange({ employer: { ...employer, country } })} field={field} disabled={!working} />
    </Fields>
  );
}

// The paper's own note on who is politically exposed, shared with the printed copy.

/** Schedule 2's politically exposed person question and its two Name and Function lines (24 Nov 2026). */
export function PepStep({ index, list = "holders", holder, onChange, field }: HolderStepProps) {
  const asked = `${list}[${index}].details.profile.`;
  const profile = holder.details.profile;
  const setProfile = changeProfile(holder, onChange);
  const answer = profile.pep === null ? null : profile.pep ? "YES" : "NO";
  const setPerson = (at: number, patch: Partial<PepLine>) =>
    setProfile({ pepPeople: profile.pepPeople.map((one, i) => (i === at ? { ...one, ...patch } : one)) });
  return (
    <Fields>
      <div className="sm:col-span-2">
        <RadioPills<"NO" | "YES"> name={`${asked}pep`} legend="Are you / is a member of your family / a close associate a Politically Exposed Person?" required
          columns="grid-cols-2 sm:grid-cols-4" value={answer} onChange={(chosen) => setProfile({ pep: chosen === "YES" })} error={field(`${asked}pep`).error}
          choices={[{ value: "NO", label: "No" }, { value: "YES", label: "Yes" }]} />
        <p className="mt-2 text-xs text-ink-muted">{PEP_NOTE}</p>
      </div>
      {profile.pepPeople.map((person, at) => (
        <Fragment key={at}>
          <TextField id={`${asked}pepPeople[${at}].name`} label="Name" value={person.name} onChange={(name) => setPerson(at, { name })} field={field} disabled={!profile.pep} optional={at > 0} />
          <TextField id={`${asked}pepPeople[${at}].function`} label="Function" value={person.function} onChange={(fn) => setPerson(at, { function: fn })} field={field} disabled={!profile.pep} optional={at > 0} />
        </Fragment>
      ))}
    </Fields>
  );
}

/** A question's "Other (please specify)" line, as the paper has under its boxes. */
export function OtherLine({ id, value, onChange, field, label = "Other (please specify)" }: { id: string; value: string | null; onChange: (value: string) => void; field: FieldFor; label?: string }) {
  return <TextField id={id} label={label} value={value} onChange={onChange} field={field} optional className="sm:col-span-2" />;
}

/** "About your Business Intentions with us" (24 Nov 2026). */
export function BusinessStep({ index, list = "holders", holder, onChange, field }: HolderStepProps) {
  const asked = `${list}[${index}].details.profile.`;
  const profile = holder.details.profile;
  const setProfile = changeProfile(holder, onChange);
  return (
    <Fields>
      <CheckPills<Service> name={`${asked}services`} legend="What are the services or products you are interested in?" required columns="grid-cols-1 sm:grid-cols-3" className="sm:col-span-2"
        value={profile.services} onChange={(services) => setProfile({ services })} error={field(`${asked}services`).error} choices={choicesOf(serviceLabels)} />
      <OtherLine id={`${asked}servicesOther`} value={profile.servicesOther} onChange={(servicesOther) => setProfile({ servicesOther })} field={field} />
      <RadioPills<Turnover> name={`${asked}turnover`} legend="What is the expected annual in/out flow turnover of assets?" required columns="grid-cols-1 sm:grid-cols-3" className="sm:col-span-2"
        value={profile.turnover} onChange={(turnover) => setProfile({ turnover })} error={field(`${asked}turnover`).error} choices={choicesOf(turnoverLabels)} />
    </Fields>
  );
}

/** "About your Wealth and Income" (24 Nov 2026). */
export function WealthStep({ index, list = "holders", holder, onChange, field }: HolderStepProps) {
  const asked = `${list}[${index}].details.profile.`;
  const profile = holder.details.profile;
  const setProfile = changeProfile(holder, onChange);
  return (
    <Fields>
      <RadioPills<NetWealth> name={`${asked}netWealth`} legend="What is your estimated global net wealth?" required columns="grid-cols-1 sm:grid-cols-3" className="sm:col-span-2"
        value={profile.netWealth} onChange={(netWealth) => setProfile({ netWealth })} error={field(`${asked}netWealth`).error} choices={choicesOf(netWealthLabels)} />
      <OtherLine id={`${asked}netWealthOther`} label="Other (please specify in USD)" value={profile.netWealthOther} onChange={(netWealthOther) => setProfile({ netWealthOther })} field={field} />
      <CheckPills<WealthSource> name={`${asked}wealthSources`} legend="How have you built up your global net wealth?" required columns="grid-cols-1 sm:grid-cols-3" className="sm:col-span-2"
        value={profile.wealthSources} onChange={(wealthSources) => setProfile({ wealthSources })} error={field(`${asked}wealthSources`).error} choices={choicesOf(wealthSourceLabels)} />
      <OtherLine id={`${asked}wealthSourcesOther`} value={profile.wealthSourcesOther} onChange={(wealthSourcesOther) => setProfile({ wealthSourcesOther })} field={field} />
      <CountriesField id={`${asked}wealthCountries`} label={`In which countries do you have or built up your wealth? Up to ${MAX_WEALTH_COUNTRIES}`} value={profile.wealthCountries}
        onChange={(wealthCountries) => setProfile({ wealthCountries })} field={field} className="sm:col-span-2" />
      <RadioPills<Income> name={`${asked}income`} legend="How much is your annual regular income?" required columns="grid-cols-1 sm:grid-cols-3" className="sm:col-span-2"
        value={profile.income} onChange={(income) => setProfile({ income })} error={field(`${asked}income`).error} choices={choicesOf(incomeLabels)} />
      <CheckPills<IncomeSource> name={`${asked}incomeSources`} legend="How do you earn your regular income?" required columns="grid-cols-2 sm:grid-cols-4" className="sm:col-span-2"
        value={profile.incomeSources} onChange={(incomeSources) => setProfile({ incomeSources })} error={field(`${asked}incomeSources`).error} choices={choicesOf(incomeSourceLabels)} />
      <OtherLine id={`${asked}incomeSourcesOther`} value={profile.incomeSourcesOther} onChange={(incomeSourcesOther) => setProfile({ incomeSourcesOther })} field={field} />
      <CountriesField id={`${asked}incomeCountries`} label={`In which countries do you earn your regular income? Up to ${MAX_WEALTH_COUNTRIES}`} value={profile.incomeCountries}
        onChange={(incomeCountries) => setProfile({ incomeCountries })} field={field} className="sm:col-span-2" />
    </Fields>
  );
}

/** "Your Experience and Understanding of Financial Markets and Instruments" (24 Nov 2026). */
export function ExperienceStep({ index, list = "holders", holder, onChange, field }: HolderStepProps) {
  const asked = `${list}[${index}].details.profile.`;
  const profile = holder.details.profile;
  const setProfile = changeProfile(holder, onChange);
  return (
    <Fields>
      <RadioPills<Knowledge> name={`${asked}knowledge`} legend="How is your knowledge and understanding of financial markets and products?" required columns="grid-cols-2 sm:grid-cols-4" className="sm:col-span-2"
        value={profile.knowledge} onChange={(knowledge) => setProfile({ knowledge })} error={field(`${asked}knowledge`).error} choices={choicesOf(knowledgeLabels)} />
      <OtherLine id={`${asked}knowledgeOther`} value={profile.knowledgeOther} onChange={(knowledgeOther) => setProfile({ knowledgeOther })} field={field} />
      <RadioPills<ActiveFor> name={`${asked}activeFor`} legend="For how long have you been active on the financial markets / investing in financial products?" required columns="grid-cols-2 sm:grid-cols-4" className="sm:col-span-2"
        value={profile.activeFor} onChange={(activeFor) => setProfile({ activeFor })} error={field(`${asked}activeFor`).error} choices={choicesOf(activeForLabels)} />
      <OtherLine id={`${asked}activeForOther`} value={profile.activeForOther} onChange={(activeForOther) => setProfile({ activeForOther })} field={field} />
      <RadioPills<ManagedBy> name={`${asked}managedBy`} legend="How have your assets been managed before?" required columns="grid-cols-2 sm:grid-cols-4" className="sm:col-span-2"
        value={profile.managedBy} onChange={(managedBy) => setProfile({ managedBy })} error={field(`${asked}managedBy`).error} choices={choicesOf(managedByLabels)} />
      <OtherLine id={`${asked}managedByOther`} value={profile.managedByOther} onChange={(managedByOther) => setProfile({ managedByOther })} field={field} />
      <CheckPills<Product> name={`${asked}products`} legend="In which financial products have you already invested on a regular basis?" required columns="grid-cols-1 sm:grid-cols-3" className="sm:col-span-2"
        value={profile.products} onChange={(products) => setProfile({ products })} error={field(`${asked}products`).error} choices={choicesOf(productLabels)} />
      <OtherLine id={`${asked}productsOther`} value={profile.productsOther} onChange={(productsOther) => setProfile({ productsOther })} field={field} />
      <RadioPills<Decision> name={`${asked}decisions`} legend="How often do you take investments decisions (buy/sell)?" required columns="grid-cols-2 sm:grid-cols-4" className="sm:col-span-2"
        value={profile.decisions} onChange={(decisions) => setProfile({ decisions })} error={field(`${asked}decisions`).error} choices={choicesOf(decisionLabels)} />
      <OtherLine id={`${asked}decisionsOther`} value={profile.decisionsOther} onChange={(decisionsOther) => setProfile({ decisionsOther })} field={field} />
    </Fields>
  );
}

/**
 * Who may sign for a joint account (23 Nov 2026): any one of the holders alone, all of them together, a number of the
 * holders ticked here, or an arrangement in words. Fills the account opening form's signing mandate.
 */
export function SigningAuthorityStep({ application, onChange, onHolder, field }: {
  application: FormApplication;
  onChange: (patch: Partial<FormApplication["signingAuthority"]>) => void;
  onHolder: (index: number, patch: Partial<FormHolder>) => void;
  field: FieldFor;
}) {
  const { mode, howMany, other } = application.signingAuthority;
  const ticked = application.holders.filter((holder) => holder.signatory).length;
  const named = mode === "ANY_OF_NAMED" || mode === "OTHER";
  const signatories = field("signingAuthority.signatories");
  const count = field("signingAuthority.howMany");
  const { labelFor } = useRelationshipTypes();
  const summary = signingAuthorityText(application);
  return (
    <div className="space-y-6">
      <ChoiceCards<SigningMode>
        name="signingAuthority.mode"
        legend="Who can sign and give instructions on this account"
        required
        value={mode}
        onChange={(next) => onChange({ mode: next, howMany: next === "ANY_OF_NAMED" ? (howMany ?? 1) : howMany })}
        error={field("signingAuthority.mode").error}
        choices={(Object.keys(signingModeLabels) as SigningMode[]).map((value) => ({
          value,
          label: signingModeLabels[value],
          description: value === "ANY_ONE" ? "Every holder can sign alone"
            : value === "ALL_JOINTLY" ? "Every holder signs together"
            : value === "ANY_OF_NAMED" ? "A number of the holders ticked below"
            : "Say the arrangement in words",
        }))}
      />
      {mode === "ANY_OF_NAMED" && (
        <Field id="signingAuthority.howMany" label="How many of the ticked holders must sign together" required error={count.error} className="sm:max-w-xs">
          <SelectInput
            {...describedBy("signingAuthority.howMany", count.error)}
            value={howMany ?? ""}
            onChange={(event) => onChange({ howMany: Number(event.target.value) })}
            onBlur={count.onBlur}
          >
            {Array.from({ length: Math.max(1, ticked) }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>{n === 1 ? "Any one of them" : n === ticked ? `All ${n} of them` : `Any ${n} of them`}</option>
            ))}
          </SelectInput>
        </Field>
      )}
      {mode === "OTHER" && (
        <TextField id="signingAuthority.other" label="Who can sign" value={other} onChange={(next) => onChange({ other: next })} field={field}
          placeholder="e.g. Rahul alone up to USD 100,000; above that, Rahul and Anita together" className="sm:max-w-2xl" />
      )}
      {named && (
        <fieldset aria-describedby={signatories.error ? "signingAuthority.signatories-error" : undefined}>
          <legend className="text-sm font-semibold">
            Authorised signatories{mode === "ANY_OF_NAMED" && <span className="text-red-600"> *</span>}
          </legend>
          <p className="text-xs text-ink-muted">Tick every holder who may sign. The others hold the account but may not sign for it.</p>
          <ul className="mt-2 divide-y divide-line rounded-xl border border-line">
            {application.holders.map((holder, index) => (
              <li key={index}>
                <label className="flex cursor-pointer items-center gap-3 px-4 py-2.5 text-sm">
                  <input
                    id={`holders[${index}].signatory`}
                    type="checkbox"
                    className="size-4"
                    checked={Boolean(holder.signatory)}
                    onChange={(event) => {
                      onHolder(index, { signatory: event.target.checked });
                      signatories.onBlur();
                    }}
                  />
                  <span className="font-medium">{holderName(holder, index)}</span>
                  <span className="text-xs text-ink-muted">
                    {index === 0 ? "Primary holder" : holder.relationshipToPrimary ? labelFor(holder.relationshipToPrimary) : "Joint holder"}
                  </span>
                  {holder.signatory === false && <span className="ml-auto text-xs text-ink-muted">May not sign</span>}
                </label>
              </li>
            ))}
          </ul>
          {signatories.error && <p id="signingAuthority.signatories-error" className="mt-1 text-xs text-red-600">{signatories.error}</p>}
        </fieldset>
      )}
      {summary && mode && (mode !== "ANY_OF_NAMED" || ticked > 0) && (
        <p className="rounded-lg bg-canvas px-3 py-2 text-xs text-ink-muted">
          The account opening form's signing mandate will say: <span className="font-semibold text-ink">{summary}</span>
        </p>
      )}
    </div>
  );
}
