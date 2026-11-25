import type { Address } from "@atomprive/api-client/backoffice";
import { cn, describedBy, Field, TextArea, TextInput } from "@atomprive/ui";
import type { ReactNode } from "react";
import { CountriesField, CountryField, DateField, TextField, type FieldFor } from "../../components/form-fields";
import { MobileNumberInput } from "../../components/mobile-number-input";
import {
  activityLabels,
  asksControllingPersons,
  capitalSourceLabels,
  classificationLabels,
  companyActiveForLabels,
  companyAddressGiven,
  companyManagedByLabels,
  companyProductLabels,
  companyWealthSourceLabels,
  controllerTypeGroups,
  emptyControllingPerson,
  legalFormLabels,
  listedAsLabels,
  MAX_OPERATION_COUNTRIES,
  netWealthLabels,
  noTinReasonText,
  serviceLabels,
  TITLES,
  turnoverLabels,
  type Activity,
  type ActiveFor,
  type CapitalSource,
  type Classification,
  type CompanyProduct,
  type CompanyWealthSource,
  type ControllerType,
  type FormCompany,
  type FormControllingPerson,
  type FormEntity,
  type FormHolder,
  type FormSelfCertification,
  type LegalForm,
  type ListedAs,
  type ManagedBy,
  type NamedLine,
  type NetWealth,
  type NoTinReason,
  type Service,
  type ShareholderLine,
  type TaxLine,
  type Turnover,
} from "./application";
import { choicesOf } from "./choices";
import { CheckPills, daysFromToday, EmirateField, Fields, OtherLine, RadioPills } from "./onboarding-steps";
import { PEP_NOTE } from "./print-wording";

/**
 * The firm's Client Details form for an entity, Schedule 2(A) (25 Nov 2026, the user's approved mockup), a section at
 * a time, in the paper's words and order; then the CRS / FATCA Self-Certification Form for an entity (v. Oct 2025)
 * and an Annex for each controlling person. Only what the papers ask. The API checks the same lines
 * (OnboardingReview.java).
 */

export interface EntityStepProps {
  entity: FormEntity;
  onChange: (patch: Partial<FormEntity>) => void;
  field: FieldFor;
  /** The beneficial owners entered, whose details a controlling person of the same name starts from. */
  owners?: FormHolder[];
}

const asked = "entity.company.";
const yesNo = (value: boolean | null) => (value === null ? null : value ? "YES" : "NO");
const YES_NO = [{ value: "YES" as const, label: "Yes" }, { value: "NO" as const, label: "No" }];

function setCompany(entity: FormEntity, onChange: EntityStepProps["onChange"]) {
  return (patch: Partial<FormCompany>) => onChange({ company: { ...entity.company, ...patch } });
}

/** A heading inside a section, as the paper sets its sub-headings off. */
function Sub({ children }: { children: ReactNode }) {
  return <p className="border-t border-line pt-4 text-xs font-semibold tracking-wider text-ink-muted uppercase sm:col-span-2">{children}</p>;
}

/** "Identification Details of your Company/Legal Entity/Corporate Structure", the first lines. */
function Identification({ entity, onChange, field }: EntityStepProps) {
  const company = entity.company;
  const set = setCompany(entity, onChange);
  return (
    <Fields>
      <TextField id="entity.legalName" autoComplete="organization" label="Registered name" value={entity.legalName} onChange={(legalName) => onChange({ legalName })} field={field} className="sm:col-span-2" />
      <RadioPills<LegalForm> name={`${asked}form`} legend="Legal form" note="(Corporate-Private/Corporate-Listed/Trust)" required columns="grid-cols-1 sm:grid-cols-3" className="sm:col-span-2"
        value={company.form} onChange={(form) => set({ form })} error={field(`${asked}form`).error} choices={choicesOf(legalFormLabels)} />
      <TextField id={`${asked}tradingNames`} label="Other used trading name(s)" value={company.tradingNames} onChange={(tradingNames) => set({ tradingNames })} field={field} optional className="sm:col-span-2" />
      <DateField id="entity.dateOfIncorporation" label="Date of incorporation" value={entity.dateOfIncorporation} onChange={(dateOfIncorporation) => onChange({ dateOfIncorporation })} field={field} min={new Date(1800, 0, 1)} max={daysFromToday(-1)} />
      <TextField id={`${asked}placeOfIncorporation`} label="Place/Emirate of incorporation" value={company.placeOfIncorporation} onChange={(placeOfIncorporation) => set({ placeOfIncorporation })} field={field} />
      <TextField id="entity.registrationNumber" label="License number of the Company" value={entity.registrationNumber} onChange={(registrationNumber) => onChange({ registrationNumber })} field={field} />
    </Fields>
  );
}

/** An address as Schedule 2(A) asks it: the building name, the address, the postal code, the country and the emirate. */
function CompanyAddress({ at, value, onChange, emirateId, emirate, onEmirate, field, optional }: {
  at: string;
  value: Address;
  onChange: (address: Address) => void;
  emirateId: string;
  emirate: string | null;
  onEmirate: (emirate: string | null) => void;
  field: FieldFor;
  optional?: boolean;
}) {
  const set = (patch: Partial<Address>) => onChange({ ...value, ...patch });
  return (
    <>
      <TextField id={`${at}line1`} label="Building name" value={value.line1} onChange={(line1) => set({ line1 })} field={field} optional={optional} />
      <TextField id={`${at}line2`} label="Address" value={value.line2} onChange={(line2) => set({ line2 })} field={field} optional={optional} />
      <div className="grid gap-x-6 gap-y-4 sm:col-span-2 sm:grid-cols-3">
        <TextField id={`${at}postalCode`} label="Postal Code" value={value.postalCode} onChange={(postalCode) => set({ postalCode })} field={field} optional={optional} />
        <CountryField id={`${at}country`} label="Country" value={value.country} onChange={(country) => set({ country })} field={field} optional={optional} />
        <EmirateField id={emirateId} value={emirate} onChange={onEmirate} applies={value.country === "AE"} />
      </div>
    </>
  );
}

/** The registered address, the trading and mailing addresses "only if different", and other countries of operations. */
function Addresses({ entity, onChange, field }: EntityStepProps) {
  const company = entity.company;
  const set = setCompany(entity, onChange);
  return (
    <Fields>
      <Sub>Registered address</Sub>
      <CompanyAddress at="entity.registeredAddress." value={entity.registeredAddress} onChange={(registeredAddress) => onChange({ registeredAddress })}
        emirateId={`${asked}registeredEmirate`} emirate={company.registeredEmirate} onEmirate={(registeredEmirate) => set({ registeredEmirate })} field={field} />
      <Sub>Trading address (only if different from above)</Sub>
      <CompanyAddress at={`${asked}tradingAddress.`} value={company.tradingAddress} onChange={(tradingAddress) => set({ tradingAddress })} optional={!companyAddressGiven(company.tradingAddress)}
        emirateId={`${asked}tradingEmirate`} emirate={company.tradingEmirate} onEmirate={(tradingEmirate) => set({ tradingEmirate })} field={field} />
      <Sub>Other countries of operations / business</Sub>
      <CountriesField id="entity.countriesOfBusiness" label={`Other countries of operations / business, up to ${MAX_OPERATION_COUNTRIES}`} value={entity.countriesOfBusiness}
        onChange={(countriesOfBusiness) => onChange({ countriesOfBusiness })} field={field} optional className="sm:col-span-2" />
      <Sub>Mailing address (if different from Registered address)</Sub>
      <CompanyAddress at={`${asked}mailingAddress.`} value={company.mailingAddress} onChange={(mailingAddress) => set({ mailingAddress })} optional={!companyAddressGiven(company.mailingAddress)}
        emirateId={`${asked}mailingEmirate`} emirate={company.mailingEmirate} onEmirate={(mailingEmirate) => set({ mailingEmirate })} field={field} />
    </Fields>
  );
}

/** The contact name, two of each contact line, the website, and the country of fiscal residence. */
function Contact({ entity, onChange, field }: EntityStepProps) {
  const company = entity.company;
  const set = setCompany(entity, onChange);
  const phone = field(`${asked}phone`);
  const secondPhone = field(`${asked}secondPhone`);
  return (
    <Fields>
      <TextField id={`${asked}contactName`} label="Contact Name" value={company.contactName} onChange={(contactName) => set({ contactName })} field={field} className="sm:col-span-2" />
      <Field id={`${asked}phone`} label="Telephone" required error={phone.error}>
        <MobileNumberInput {...describedBy(`${asked}phone`, phone.error)} value={company.phone ?? ""} onChange={(value) => set({ phone: value || null })} onBlur={phone.onBlur} />
      </Field>
      <Field id={`${asked}secondPhone`} label="Second telephone" error={secondPhone.error}>
        <MobileNumberInput {...describedBy(`${asked}secondPhone`, secondPhone.error)} value={company.secondPhone ?? ""} onChange={(value) => set({ secondPhone: value || null })} onBlur={secondPhone.onBlur} />
      </Field>
      <TextField id={`${asked}fax`} label="Fax" value={company.fax} onChange={(fax) => set({ fax })} field={field} optional />
      <TextField id={`${asked}secondFax`} label="Second fax" value={company.secondFax} onChange={(secondFax) => set({ secondFax })} field={field} optional />
      <TextField id={`${asked}email`} label="Email" type="email" value={company.email} onChange={(email) => set({ email })} field={field} placeholder="name@company.com" />
      <TextField id={`${asked}secondEmail`} label="Second email" type="email" value={company.secondEmail} onChange={(secondEmail) => set({ secondEmail })} field={field} optional placeholder="name@company.com" />
      <TextField id={`${asked}website`} label="Website" value={company.website} onChange={(website) => set({ website })} field={field} optional />
      <CountryField id="entity.taxResidency" label="Country of fiscal residence" value={entity.taxResidency} onChange={(taxResidency) => onChange({ taxResidency })} field={field} />
    </Fields>
  );
}

/** "Business activity(ies)" and "Is the Company part of a Group?" */
function Activity({ entity, onChange, field }: EntityStepProps) {
  const company = entity.company;
  const set = setCompany(entity, onChange);
  return (
    <Fields>
      <CheckPills<Activity> name={`${asked}activities`} legend="Business activity(ies)" required columns="grid-cols-1 sm:grid-cols-2" className="sm:col-span-2"
        value={company.activities} onChange={(activities) => set({ activities })} error={field(`${asked}activities`).error} choices={choicesOf(activityLabels)} />
      <TextField id={`${asked}activitiesDetail`} label="Business activity(ies) – the lines under the boxes" value={company.activitiesDetail} onChange={(activitiesDetail) => set({ activitiesDetail })} field={field} optional multiline className="sm:col-span-2" />
      <RadioPills name={`${asked}partOfGroup`} legend="Is the Company part of a Group?" required columns="grid-cols-2 sm:grid-cols-4" className="sm:col-span-2"
        value={yesNo(company.partOfGroup)} onChange={(answer) => set({ partOfGroup: answer === "YES" })} error={field(`${asked}partOfGroup`).error} choices={YES_NO} />
      <TextField id={`${asked}groupName`} label="Group Name" value={company.groupName} onChange={(groupName) => set({ groupName })} field={field} disabled={!company.partOfGroup} />
      <CountryField id={`${asked}groupCountry`} label="Country" value={company.groupCountry} onChange={(groupCountry) => set({ groupCountry })} field={field} disabled={!company.partOfGroup} />
    </Fields>
  );
}

/** The regulator, the external auditor, and whether anyone behind the company is a politically exposed person. */
function Regulation({ entity, onChange, field }: EntityStepProps) {
  const company = entity.company;
  const set = setCompany(entity, onChange);
  return (
    <Fields>
      <RadioPills name="entity.regulated" legend="Is the company supervised by a Financial Services Regulator?" required columns="grid-cols-2 sm:grid-cols-4" className="sm:col-span-2"
        value={yesNo(entity.regulated)} onChange={(answer) => onChange({ regulated: answer === "YES" })} error={field("entity.regulated").error} choices={YES_NO} />
      <TextField id="entity.regulatorName" label="If yes, Name of Regulator" value={entity.regulatorName} onChange={(regulatorName) => onChange({ regulatorName })} field={field} disabled={!entity.regulated} className="sm:col-span-2" />
      <TextField id={`${asked}externalAuditor`} label="Name of External Auditor" value={company.externalAuditor} onChange={(externalAuditor) => set({ externalAuditor })} field={field} className="sm:col-span-2" />
      <div className="sm:col-span-2">
        <RadioPills name={`${asked}pep`} legend="Are any of the directors / signatories / shareholders or a member of their family / a close associate, a Politically Exposed Person?" required
          columns="grid-cols-2 sm:grid-cols-4" value={yesNo(company.pep)} onChange={(answer) => set({ pep: answer === "YES" })} error={field(`${asked}pep`).error}
          choices={[YES_NO[1]!, YES_NO[0]!]} />
        <p className="mt-2 text-xs text-ink-muted">{PEP_NOTE}</p>
      </div>
      <TextField id={`${asked}pepPerson.name`} label="Name" value={company.pepPerson.name} onChange={(name) => set({ pepPerson: { ...company.pepPerson, name } })} field={field} disabled={!company.pep} />
      <TextField id={`${asked}pepPerson.function`} label="Function" value={company.pepPerson.function} onChange={(fn) => set({ pepPerson: { ...company.pepPerson, function: fn } })} field={field} disabled={!company.pep} />
    </Fields>
  );
}

/** A list the paper gives numbered lines for: a table of plain inputs, one row a line. */
function Lines<T>({ id, legend, rows, columns, onChange, field }: {
  id: string;
  legend: string;
  rows: T[];
  columns: { key: keyof T & string; label: string; kind?: "percent" | "lines" }[];
  onChange: (rows: T[]) => void;
  field: FieldFor;
}) {
  const whole = field(id);
  const set = (place: number, key: keyof T, value: unknown) => onChange(rows.map((row, at) => (at === place ? { ...row, [key]: value } : row)));
  return (
    <div className="sm:col-span-2">
      <p className="mb-1.5 text-sm font-semibold text-ink">
        {legend} <span className="font-normal text-ink-muted">({rows.length} lines on the paper; at least the first one)</span>
        <span className="text-red-600"> *</span>
      </p>
      <div className="overflow-x-auto rounded-xl border border-line" aria-invalid={whole.error ? true : undefined} aria-describedby={whole.error ? `${id}-error` : undefined}>
        <table className="w-full min-w-[36rem] border-collapse text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th scope="col" className="w-12 px-3 py-2 text-left text-xs font-semibold text-ink-soft">No</th>
              {columns.map((column) => <th key={column.key} scope="col" className="px-3 py-2 text-left text-xs font-semibold text-ink-soft">{column.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, place) => (
              <tr key={place} className="border-t border-line align-top">
                <td className="px-3 py-3 text-center font-semibold text-ink-muted">{place + 1}</td>
                {columns.map((column) => {
                  const cell = `${id}[${place}].${column.key === "sharePercent" ? "sharePercent" : column.key}`;
                  const error = field(cell).error;
                  const value = row[column.key] as unknown;
                  const label = `${column.label}, line ${place + 1}`;
                  return (
                    <td key={column.key} className={cn("px-2 py-2", column.kind === "percent" && "w-28")}>
                      {column.kind === "lines" ? (
                        <TextArea aria-label={label} rows={2} value={(value as string | null) ?? ""} placeholder="One name a line"
                          onChange={(event) => set(place, column.key, event.target.value || null)} />
                      ) : (
                        <TextInput aria-label={label} aria-invalid={error ? true : undefined} type={column.kind === "percent" ? "number" : "text"} min={0} max={100} step="any"
                          value={value === null || value === undefined ? "" : String(value)} placeholder={column.kind === "percent" ? "%" : undefined}
                          onChange={(event) => set(place, column.key, column.kind === "percent" ? (event.target.value === "" ? null : Number(event.target.value)) : event.target.value || null)} />
                      )}
                      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {whole.error && <p id={`${id}-error`} className="mt-1.5 text-xs text-red-600">{whole.error}</p>}
    </div>
  );
}

function Directors({ entity, onChange, field }: EntityStepProps) {
  const set = setCompany(entity, onChange);
  return (
    <Fields>
      <Lines<NamedLine> id={`${asked}directors`} legend="List of Directors / Partners of the Company" rows={entity.company.directors} field={field}
        columns={[{ key: "name", label: "Name of Director/ Partner" }, { key: "position", label: "Position" }]} onChange={(directors) => set({ directors })} />
    </Fields>
  );
}

function Shareholders({ entity, onChange, field }: EntityStepProps) {
  const company = entity.company;
  const set = setCompany(entity, onChange);
  return (
    <Fields>
      <RadioPills name={`${asked}listed`} legend="Is the Company publicly listed?" required columns="grid-cols-2 sm:grid-cols-4" className="sm:col-span-2"
        value={yesNo(company.listed)} onChange={(answer) => set({ listed: answer === "YES" })} error={field(`${asked}listed`).error} choices={YES_NO} />
      <TextField id={`${asked}exchange`} label="Exchange, Country" value={company.exchange} onChange={(exchange) => set({ exchange })} field={field} disabled={!company.listed} />
      <TextField id={`${asked}ticker`} label="Ticker/Code" value={company.ticker} onChange={(ticker) => set({ ticker })} field={field} disabled={!company.listed} />
      <Lines<ShareholderLine> id={`${asked}shareholders`} legend="List of Shareholders of the Company" rows={company.shareholders} field={field}
        columns={[{ key: "name", label: "Name of Shareholder(s)" }, { key: "sharePercent", label: "% Shares", kind: "percent" }, { key: "controllers", label: "Name of individual(s) controlling the Shareholder", kind: "lines" }]}
        onChange={(shareholders) => set({ shareholders })} />
    </Fields>
  );
}

function Signatories({ entity, onChange, field }: EntityStepProps) {
  const set = setCompany(entity, onChange);
  return (
    <Fields>
      <Lines<NamedLine> id={`${asked}signatories`} legend="Please list the names of the persons who will interact with us" rows={entity.company.signatories} field={field}
        columns={[{ key: "name", label: "Name of Authorised Signatory" }, { key: "position", label: "Position" }]} onChange={(signatories) => set({ signatories })} />
    </Fields>
  );
}

/** "About your Business Intentions with us". */
function Intentions({ entity, onChange, field }: EntityStepProps) {
  const company = entity.company;
  const set = setCompany(entity, onChange);
  return (
    <Fields>
      <CheckPills<Service> name={`${asked}services`} legend="What are the services or products you are interested in?" required columns="grid-cols-1 sm:grid-cols-3" className="sm:col-span-2"
        value={company.services} onChange={(services) => set({ services })} error={field(`${asked}services`).error} choices={choicesOf(serviceLabels)} />
      <OtherLine id={`${asked}servicesOther`} value={company.servicesOther} onChange={(servicesOther) => set({ servicesOther })} field={field} />
      <RadioPills<Turnover> name={`${asked}turnover`} legend="What is the expected annual in/out flow turnover of assets?" required columns="grid-cols-1 sm:grid-cols-3" className="sm:col-span-2"
        value={company.turnover} onChange={(turnover) => set({ turnover })} error={field(`${asked}turnover`).error} choices={choicesOf(turnoverLabels)} />
    </Fields>
  );
}

/** "About the Company's Wealth". */
function Wealth({ entity, onChange, field }: EntityStepProps) {
  const company = entity.company;
  const set = setCompany(entity, onChange);
  return (
    <Fields>
      <RadioPills<NetWealth> name={`${asked}netWealth`} legend="What is the estimated global net wealth of your company?" required columns="grid-cols-1 sm:grid-cols-3" className="sm:col-span-2"
        value={company.netWealth} onChange={(netWealth) => set({ netWealth })} error={field(`${asked}netWealth`).error} choices={choicesOf(netWealthLabels)} />
      <OtherLine id={`${asked}netWealthOther`} label="Other (please specify in USD)" value={company.netWealthOther} onChange={(netWealthOther) => set({ netWealthOther })} field={field} />
      <CheckPills<CompanyWealthSource> name={`${asked}wealthSources`} legend="How has this been built up?" required columns="grid-cols-1 sm:grid-cols-3" className="sm:col-span-2"
        value={company.wealthSources} onChange={(wealthSources) => set({ wealthSources })} error={field(`${asked}wealthSources`).error} choices={choicesOf(companyWealthSourceLabels)} />
      <OtherLine id={`${asked}wealthSourcesOther`} value={company.wealthSourcesOther} onChange={(wealthSourcesOther) => set({ wealthSourcesOther })} field={field} />
      <RadioPills name={`${asked}personalInvestmentVehicle`} legend="Is the Company a Personal Investment Vehicle?" required columns="grid-cols-2 sm:grid-cols-4" className="sm:col-span-2"
        value={yesNo(company.personalInvestmentVehicle)} onChange={(answer) => set({ personalInvestmentVehicle: answer === "YES" })}
        error={field(`${asked}personalInvestmentVehicle`).error} choices={YES_NO} />
      <div className={cn("sm:col-span-2", !company.personalInvestmentVehicle && "pointer-events-none opacity-50")} aria-disabled={!company.personalInvestmentVehicle}>
        <CheckPills<CapitalSource> name={`${asked}capitalSources`} legend="What is the source of the Vehicle's capital?" required={Boolean(company.personalInvestmentVehicle)} columns="grid-cols-1 sm:grid-cols-3"
          value={company.capitalSources} onChange={(capitalSources) => set({ capitalSources })} error={field(`${asked}capitalSources`).error} choices={choicesOf(capitalSourceLabels)} />
      </div>
      <TextField id={`${asked}capitalSourcesOther`} label="Other (please specify)" value={company.capitalSourcesOther} onChange={(capitalSourcesOther) => set({ capitalSourcesOther })}
        field={field} optional disabled={!company.personalInvestmentVehicle} className="sm:col-span-2" />
    </Fields>
  );
}

/** "About the Company's Experience and Understanding of Financial Markets and Instruments". */
function Experience({ entity, onChange, field }: EntityStepProps) {
  const company = entity.company;
  const set = setCompany(entity, onChange);
  return (
    <Fields>
      <RadioPills<ActiveFor> name={`${asked}activeFor`} legend="For how long the company has been active on the financial markets / investing in financial products?" required columns="grid-cols-2 sm:grid-cols-4" className="sm:col-span-2"
        value={company.activeFor} onChange={(activeFor) => set({ activeFor })} error={field(`${asked}activeFor`).error} choices={choicesOf(companyActiveForLabels)} />
      <OtherLine id={`${asked}activeForOther`} value={company.activeForOther} onChange={(activeForOther) => set({ activeForOther })} field={field} />
      <RadioPills<ManagedBy> name={`${asked}managedBy`} legend="How have the company's assets been managed before?" required columns="grid-cols-2 sm:grid-cols-4" className="sm:col-span-2"
        value={company.managedBy} onChange={(managedBy) => set({ managedBy })} error={field(`${asked}managedBy`).error} choices={choicesOf(companyManagedByLabels)} />
      <OtherLine id={`${asked}managedByOther`} value={company.managedByOther} onChange={(managedByOther) => set({ managedByOther })} field={field} />
      <CheckPills<CompanyProduct> name={`${asked}products`} legend="In which financial products has the company already invested on a regular basis?" required columns="grid-cols-1 sm:grid-cols-3" className="sm:col-span-2"
        value={company.products} onChange={(products) => set({ products })} error={field(`${asked}products`).error} choices={choicesOf(companyProductLabels)} />
      <OtherLine id={`${asked}productsOther`} value={company.productsOther} onChange={(productsOther) => set({ productsOther })} field={field} />
    </Fields>
  );
}

/** The company's sections, by the last part of the step's id. */
export const companySteps = {
  identification: Identification,
  addresses: Addresses,
  contact: Contact,
  activity: Activity,
  regulation: Regulation,
  directors: Directors,
  shareholders: Shareholders,
  signatories: Signatories,
  intentions: Intentions,
  wealth: Wealth,
  experience: Experience,
} as const;

/* ============================== The CRS / FATCA Self-Certification Form – Entity ============================== */

const certified = "entity.selfCertification.";

function setCertification(entity: FormEntity, onChange: EntityStepProps["onChange"]) {
  return (patch: Partial<FormSelfCertification>) => onChange({ selfCertification: { ...entity.selfCertification, ...patch } });
}

/**
 * Part 1, Identification of Account Holder, box by box as the paper has it (25 Nov 2026: "har chiz ka box rkho, bus
 * vo fill krdo agar already fill"). A line the Client Details form already asked is the same answer, so its box comes
 * filled in and changing it here changes it there too.
 */
function CertIdentification({ entity, onChange, field }: EntityStepProps) {
  const company = entity.company;
  const set = setCertification(entity, onChange);
  const setCo = setCompany(entity, onChange);
  return (
    <Fields>
      <Sub>A) Name of the Company/Legal Entity/Corporate Structure</Sub>
      <TextField id="entity.legalName" label="Registered Name" value={entity.legalName} onChange={(legalName) => onChange({ legalName })} field={field} className="sm:col-span-2" />
      <RadioPills<LegalForm> name={`${asked}form`} legend="Legal Form" note="(Corporate-Private/Corporate-Listed/Trust)" required columns="grid-cols-1 sm:grid-cols-3" className="sm:col-span-2"
        value={company.form} onChange={(form) => setCo({ form })} error={field(`${asked}form`).error} choices={choicesOf(legalFormLabels)} />
      <TextField id={`${asked}tradingNames`} label="Other Trading Name(s)" value={company.tradingNames} onChange={(tradingNames) => setCo({ tradingNames })} field={field} optional className="sm:col-span-2" />
      <Sub>B) Date of Incorporation · C) Place of Incorporation</Sub>
      <DateField id="entity.dateOfIncorporation" label="B) Date of Incorporation" value={entity.dateOfIncorporation} onChange={(dateOfIncorporation) => onChange({ dateOfIncorporation })} field={field} min={new Date(1800, 0, 1)} max={daysFromToday(-1)} />
      <CountryField id="entity.countryOfIncorporation" label="C) Place of Incorporation – Country/Jurisdiction" value={entity.countryOfIncorporation}
        onChange={(countryOfIncorporation) => onChange({ countryOfIncorporation })} field={field} />
      <Sub>D) Registered Address</Sub>
      <CertAddress at="entity.registeredAddress." value={entity.registeredAddress} onChange={(registeredAddress) => onChange({ registeredAddress })} field={field} />
      <Sub>E) Mailing Address (complete only if different from Section D)</Sub>
      <CertAddress at={`${asked}mailingAddress.`} value={company.mailingAddress} onChange={(mailingAddress) => setCo({ mailingAddress })} field={field} optional={!companyAddressGiven(company.mailingAddress)} />
      <Sub>F) Contact Details</Sub>
      <TextField id={`${asked}phone`} label="Telephone" value={company.phone} onChange={(phone) => setCo({ phone })} field={field} />
      <TextField id={`${asked}fax`} label="Fax" value={company.fax} onChange={(fax) => setCo({ fax })} field={field} optional />
      <TextField id={`${asked}email`} label="Email" type="email" value={company.email} onChange={(email) => setCo({ email })} field={field} />
      <TextField id={`${asked}website`} label="Website" value={company.website} onChange={(website) => setCo({ website })} field={field} optional />
      <Sub>G) Place of Operations · H) Company Registration Number</Sub>
      <CountryField id={`${certified}placeOfOperations`} label="G) Place of Operations – Country/Jurisdiction" value={entity.selfCertification.placeOfOperations}
        onChange={(placeOfOperations) => set({ placeOfOperations })} field={field} />
      <TextField id="entity.registrationNumber" label="H) Company Registration Number" value={entity.registrationNumber} onChange={(registrationNumber) => onChange({ registrationNumber })} field={field} />
    </Fields>
  );
}

/** Part 2 of the form or of an Annex: up to three countries of tax residence, each with its TIN or Reason A, B or C. */
export function TaxTable({ at, who, rows, explanation, onRows, onExplanation, field }: {
  at: string;
  who: string;
  rows: TaxLine[];
  explanation: string | null;
  onRows: (rows: TaxLine[]) => void;
  onExplanation: (text: string) => void;
  field: FieldFor;
}) {
  const set = (place: number, patch: Partial<TaxLine>) => onRows(rows.map((row, i) => (i === place ? { ...row, ...patch } : row)));
  const explain = rows.some((row) => !row.tin?.trim() && (row.reason === "B" || row.reason === "C"));
  const whole = field(`${at}taxResidences`);
  return (
    <Fields>
      <p className="text-sm text-ink-muted sm:col-span-2">
        Please complete the following table indicating the country(ies)/jurisdiction(s) where the {who} is resident for tax purposes and the {who}'s Taxpayer
        Identification Number or functional equivalent ('TIN') for each country/jurisdiction indicated. If no TIN is available, please indicate Reason A, B or C.
      </p>
      <div className="rounded-xl bg-slate-50 px-4 py-3 text-xs leading-relaxed text-ink-soft sm:col-span-2">
        {(Object.keys(noTinReasonText) as NoTinReason[]).map((reason) => <p key={reason}>{noTinReasonText[reason].replaceAll("{who}", who)}</p>)}
      </div>
      <div className="space-y-3 sm:col-span-2">
        {rows.map((row, place) => {
          const line = `${at}taxResidences[${place}].`;
          return (
            <div key={place} className="grid gap-x-4 gap-y-3 rounded-xl border border-line px-4 py-3 sm:grid-cols-[2rem_1fr_1fr_auto] sm:items-start">
              <p className="pt-8 font-semibold text-ink-muted max-sm:pt-0">{place + 1}</p>
              <CountryField id={`${line}country`} label="Country/Jurisdiction of tax residence" value={row.country} onChange={(country) => set(place, { country })} field={field} optional={place > 0} />
              <TextField id={`${line}tin`} label="TIN" value={row.tin} onChange={(tin) => set(place, { tin, reason: tin.trim() ? null : row.reason })} field={field} optional={place > 0} />
              <RadioPills<NoTinReason> name={`${line}reason`} legend="If no TIN, Reason" columns="grid-cols-3" value={row.tin?.trim() ? null : row.reason}
                disabled={Boolean(row.tin?.trim())} onChange={(reason) => set(place, { reason })} choices={[{ value: "A", label: "A" }, { value: "B", label: "B" }, { value: "C", label: "C" }]} />
            </div>
          );
        })}
        {whole.error && <p className="text-xs text-red-600">{whole.error}</p>}
      </div>
      <TextField id={`${at}noTinExplanation`} label={`If Reason B or C is selected, please explain below the reason(s) the ${who} is unable or not required to obtain a TIN, or the reason(s) a TIN is not available.`}
        value={explanation} onChange={onExplanation} field={field} multiline disabled={!explain} className="sm:col-span-2" />
    </Fields>
  );
}

function CertTax({ entity, onChange, field }: EntityStepProps) {
  const form = entity.selfCertification;
  const set = setCertification(entity, onChange);
  return (
    <TaxTable at={certified} who="Account Holder" rows={form.taxResidences} explanation={form.noTinExplanation} field={field}
      onRows={(taxResidences) => set({ taxResidences })} onExplanation={(noTinExplanation) => set({ noTinExplanation })} />
  );
}

/**
 * Part 3, Entity Classification, and the names of the controlling persons where it asks for them. Choosing such a
 * classification with none named yet starts them from the beneficial owners entered, each Annex with what their
 * details already hold; nothing is split, so their surname and first name are asked on the Annex (25 Nov 2026).
 */
function CertClassification({ entity, onChange, field, owners = [] }: EntityStepProps) {
  const form = entity.selfCertification;
  const set = setCertification(entity, onChange);
  const listed = form.classification === "ACTIVE_NFE_LISTED";
  const choose = (classification: Classification) => {
    const next = { ...form, classification };
    const named = form.controllingPersons.some((one) => one.fullName?.trim());
    if (asksControllingPersons(next) && !named && owners.length > 0) {
      next.controllingPersons = form.controllingPersons.map((one, at) => {
        const owner = owners[at];
        if (!owner?.fullName?.trim()) return one;
        return {
          ...emptyControllingPerson(),
          fullName: owner.fullName.trim(),
          dateOfBirth: owner.dateOfBirth,
          townOfBirth: owner.details.placeOfBirth,
          countryOfBirth: owner.countryOfBirth,
          residenceAddress: { ...emptyControllingPerson().residenceAddress, line1: owner.residentialAddress.line1, postalCode: owner.residentialAddress.postalCode, country: owner.residentialAddress.country },
        };
      });
    }
    onChange({ selfCertification: next });
  };
  const box = (value: Classification, note?: string) => (
    <label key={value} className={cn("flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 text-sm", form.classification === value ? "border-primary-600/40 bg-primary-50" : "border-line bg-white hover:border-primary-600/40")}>
      <input type="radio" name={`${certified}classification`} className="sr-only" checked={form.classification === value} onChange={() => choose(value)} />
      <span aria-hidden="true" className={cn("mt-0.5 grid size-4.5 shrink-0 place-items-center rounded-full border-2", form.classification === value ? "border-primary-600" : "border-slate-300")}>
        {form.classification === value && <span className="size-2 rounded-full bg-primary-600" />}
      </span>
      <span>{classificationLabels[value]}{note && <span className="text-ink-muted"> {note}</span>}</span>
    </label>
  );
  const error = field(`${certified}classification`).error;
  const cpError = field(`${certified}controllingPersons`).error;
  const asking = asksControllingPersons(form);
  const setName = (place: number, fullName: string) =>
    set({ controllingPersons: form.controllingPersons.map((one, at) => (at === place ? { ...one, fullName } : one)) });
  return (
    <Fields>
      <fieldset className="space-y-2 sm:col-span-2" aria-invalid={error ? true : undefined}>
        <legend className="mb-1.5 text-sm font-semibold text-ink">Please tick the appropriate box to declare the Company/Legal Entity/Corporate Structure's CRS Classification.<span className="text-red-600"> *</span></legend>
        <p className="pt-1 text-xs font-semibold tracking-wider text-primary-600 uppercase">Financial Institution (FI)</p>
        {box("INVESTMENT_ENTITY_NON_PARTICIPATING", "(Complete the Controlling Person(s) section below if this box is ticked)")}
        {box("OTHER_FINANCIAL_INSTITUTION")}
        <p className="pt-2 text-xs font-semibold tracking-wider text-primary-600 uppercase">Non-Financial Entity (NFE)</p>
        {box("ACTIVE_NFE_LISTED", "(Please indicate which of the following applies)")}
        {box("ACTIVE_NFE_GOVERNMENT")}
        {box("ACTIVE_NFE_OTHER", "(Please refer to the Definitions section and state below which category the Account Holder falls under)")}
        {box("PASSIVE_NFE", "(Complete the Controlling Person(s) section below if this box is ticked)")}
        {error && <p className="text-xs text-red-600">{error}</p>}
      </fieldset>
      <RadioPills<ListedAs> name={`${certified}listedAs`} legend="Which of the following applies" required columns="grid-cols-1" className="sm:col-span-2" disabled={!listed}
        value={listed ? form.listedAs : null} onChange={(listedAs) => set({ listedAs })} error={field(`${certified}listedAs`).error} choices={choicesOf(listedAsLabels)} />
      <TextField id={`${certified}relatedEntity`} label="Related Entity of (the corporation)" value={form.relatedEntity} onChange={(relatedEntity) => set({ relatedEntity })} field={field}
        disabled={!listed || form.listedAs !== "RELATED_ENTITY"} />
      <TextField id={`${certified}securitiesMarket`} label="Established securities market the shares are regularly traded on" value={form.securitiesMarket}
        onChange={(securitiesMarket) => set({ securitiesMarket })} field={field} disabled={!listed} />
      <TextField id={`${certified}activeCategory`} label="Active NFE – Other: the category the Account Holder falls under" value={form.activeCategory}
        onChange={(activeCategory) => set({ activeCategory })} field={field} disabled={form.classification !== "ACTIVE_NFE_OTHER"} className="sm:col-span-2" />
      <Sub>Controlling Person(s) of Company/Legal Entity/Corporate Structure</Sub>
      <p className="text-sm text-ink-muted sm:col-span-2">
        Please indicate below the Full Name of the Controlling Person(s); an Annex – Controlling Person(s) follows for each. Asked only for a Passive NFE or an Investment Entity in a
        Non-Participating Jurisdiction.
      </p>
      {form.controllingPersons.slice(0, 4).map((one, place) => (
        <TextField key={place} id={`${certified}controllingPersons[${place}].fullName`} label={`(${place + 1}) Name of the Controlling Person`} value={one.fullName}
          onChange={(fullName) => setName(place, fullName)} field={field} optional={place > 0} disabled={!asking} />
      ))}
      {cpError && <p className="text-xs text-red-600 sm:col-span-2">{cpError}</p>}
      <p className="rounded-xl border border-dashed border-line px-4 py-2.5 text-xs text-ink-muted sm:col-span-2">
        Part 4 – Declaration and Signature: signed on the printed form by an authorised representative, with their name and capacity; nothing to fill in here.
      </p>
    </Fields>
  );
}

export const selfCertSteps = { identification: CertIdentification, tax: CertTax, classification: CertClassification } as const;

/* ============================== Annex – Controlling Person(s) ============================== */

interface AnnexProps extends EntityStepProps {
  place: number;
}

function setPerson(entity: FormEntity, onChange: EntityStepProps["onChange"], place: number) {
  return (patch: Partial<FormControllingPerson>) => onChange({
    selfCertification: {
      ...entity.selfCertification,
      controllingPersons: entity.selfCertification.controllingPersons.map((one, at) => (at === place ? { ...one, ...patch } : one)),
    },
  });
}

/** An address as the self-certification asks it: two lines, the city or town, the province, the postal code and the country. */
export function CertAddress({ at, value, onChange, field, optional }: { at: string; value: Address; onChange: (address: Address) => void; field: FieldFor; optional?: boolean }) {
  const set = (patch: Partial<Address>) => onChange({ ...value, ...patch });
  return (
    <>
      <TextField id={`${at}line1`} label="Address Line 1" value={value.line1} onChange={(line1) => set({ line1 })} field={field} optional={optional} />
      <TextField id={`${at}line2`} label="Address Line 2" value={value.line2} onChange={(line2) => set({ line2 })} field={field} optional />
      <TextField id={`${at}city`} label="City/Town" value={value.city} onChange={(city) => set({ city })} field={field} optional={optional} />
      <TextField id={`${at}state`} label="Province/State/County" value={value.state} onChange={(state) => set({ state })} field={field} optional />
      <TextField id={`${at}postalCode`} label="Postal Code/ZIP Code" value={value.postalCode} onChange={(postalCode) => set({ postalCode })} field={field} optional={optional} />
      <CountryField id={`${at}country`} label="Country/Jurisdiction" value={value.country} onChange={(country) => set({ country })} field={field} optional={optional} />
    </>
  );
}

/** Part 1 of the Annex: who the controlling person is, where and when they were born, and where they live. */
function AnnexIdentification({ entity, onChange, field, place }: AnnexProps) {
  const person = entity.selfCertification.controllingPersons[place]!;
  const set = setPerson(entity, onChange, place);
  const at = `${certified}controllingPersons[${place}].`;
  return (
    <Fields>
      <RadioPills name={`${at}title`} legend="A) Title" required columns="grid-cols-3 sm:grid-cols-5" className="sm:col-span-2" value={person.title}
        onChange={(title) => set({ title })} error={field(`${at}title`).error} choices={TITLES.map((title) => ({ value: title, label: title }))} />
      <TextField id={`${at}surname`} label="Surname(s)" value={person.surname} onChange={(surname) => set({ surname })} field={field} />
      <TextField id={`${at}firstName`} label="First or Given Name" value={person.firstName} onChange={(firstName) => set({ firstName })} field={field} />
      <TextField id={`${at}middleNames`} label="Middle Name(s)" value={person.middleNames} onChange={(middleNames) => set({ middleNames })} field={field} optional />
      <DateField id={`${at}dateOfBirth`} label="B) Date of Birth" value={person.dateOfBirth} onChange={(dateOfBirth) => set({ dateOfBirth })} field={field} min={new Date(1900, 0, 1)} max={daysFromToday(-1)} />
      <TextField id={`${at}townOfBirth`} label="C) Town or City of Birth" value={person.townOfBirth} onChange={(townOfBirth) => set({ townOfBirth })} field={field} />
      <CountryField id={`${at}countryOfBirth`} label="Country/Jurisdiction of Birth" value={person.countryOfBirth} onChange={(countryOfBirth) => set({ countryOfBirth })} field={field} />
      <Sub>D) Current Residence Address</Sub>
      <CertAddress at={`${at}residenceAddress.`} value={person.residenceAddress} onChange={(residenceAddress) => set({ residenceAddress })} field={field} />
      <Sub>E) Mailing Address (complete only if different from Section D)</Sub>
      <CertAddress at={`${at}mailingAddress.`} value={person.mailingAddress} onChange={(mailingAddress) => set({ mailingAddress })} field={field} optional />
    </Fields>
  );
}

function AnnexTax({ entity, onChange, field, place }: AnnexProps) {
  const person = entity.selfCertification.controllingPersons[place]!;
  const set = setPerson(entity, onChange, place);
  return (
    <TaxTable at={`${certified}controllingPersons[${place}].`} who="Controlling Person" rows={person.taxResidences} explanation={person.noTinExplanation} field={field}
      onRows={(taxResidences) => set({ taxResidences })} onExplanation={(noTinExplanation) => set({ noTinExplanation })} />
  );
}

/** Part 3 of the Annex: the type of controlling person, of a legal person, a trust, or another legal arrangement. */
function AnnexType({ entity, onChange, field, place }: AnnexProps) {
  const person = entity.selfCertification.controllingPersons[place]!;
  const set = setPerson(entity, onChange, place);
  const at = `${certified}controllingPersons[${place}].`;
  const error = field(`${at}type`).error;
  const other = person.type === "TRUST_OTHER" || person.type === "OTHER_EQUIVALENT";
  return (
    <Fields>
      <p className="text-sm text-ink-muted sm:col-span-2">Please provide the Controlling Person's status by ticking the appropriate box.<span className="text-red-600"> *</span></p>
      {controllerTypeGroups.map((group) => (
        <RadioPills<ControllerType> key={group.group} name={`${at}type`} legend={group.group} columns="grid-cols-1 sm:grid-cols-3" className="sm:col-span-2"
          value={Object.keys(group.types).includes(person.type ?? "") ? person.type : null} onChange={(type) => set({ type })}
          choices={Object.entries(group.types).map(([value, label]) => ({ value: value as ControllerType, label }))} />
      ))}
      {error && <p className="text-xs text-red-600 sm:col-span-2">{error}</p>}
      <TextField id={`${at}typeOther`} label="Other (please specify)" value={person.typeOther} onChange={(typeOther) => set({ typeOther })} field={field} disabled={!other} className="sm:col-span-2" />
      <p className="rounded-xl border border-dashed border-line px-4 py-2.5 text-xs text-ink-muted sm:col-span-2">
        Part 4 – Declaration and Signature of Controlling Person: signed on the printed form; nothing to fill in here.
      </p>
    </Fields>
  );
}

export const annexSteps = { identification: AnnexIdentification, tax: AnnexTax, type: AnnexType } as const;
