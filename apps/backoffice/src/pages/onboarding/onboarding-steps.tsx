import type { StaffMember } from "@atomprive/api-client/backoffice";
import { describedBy, Field, SelectInput } from "@atomprive/ui";
import { Armchair, Briefcase, Building2, GraduationCap, House, Landmark, Plus, Shapes, Store, User, X } from "lucide-react";
import { ChoiceCards } from "../../components/choice-cards";
import { MobileNumberInput } from "../../components/mobile-number-input";
import {
  emptyAddress,
  occupationLabels,
  organisationTypeLabels,
  relationshipLabels,
  type ClientType,
  type FormApplication,
  type FormEntity,
  type FormHolder,
  type Occupation,
  type OrganisationType,
  type Relationship,
} from "./application";
import { AddressFields, CountriesField, CountryField, DateField, FollowUp, FormSection, TextField, type FieldFor } from "../../components/form-fields";

const yesNo = [
  { value: "yes" as const, label: "Yes" },
  { value: "no" as const, label: "No" },
];

function toYesNo(value: boolean | null) {
  return value === null ? null : value ? "yes" : "no";
}

function daysFromToday(days: number, years = 0) {
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
        hint={managers?.length === 0 ? "There are no advisors yet. An Admin can add staff with the Advisor role." : "The advisor who will look after this client."}
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
            {managers ? "Choose a relationship manager" : "Loading advisors…"}
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
  holder: FormHolder;
  onChange: (patch: Partial<FormHolder>) => void;
  field: FieldFor;
}

export function PersonalDetailsStep({ index, holder, onChange, field }: HolderStepProps) {
  const at = `holders[${index}].`;
  const relationship = field(`${at}relationshipToPrimary`);
  return (
    <div className="space-y-8">
      <FormSection title="Name" description="Exactly as it appears on their NRIC or passport.">
        <TextField id={`${at}fullName`} label="Full name" value={holder.fullName} onChange={(fullName) => onChange({ fullName })} field={field} placeholder="e.g. Rahul Kumar Sharma" className="sm:col-span-2" />
        <TextField id={`${at}forenames`} label="Forenames" value={holder.forenames} onChange={(forenames) => onChange({ forenames })} field={field} placeholder="e.g. Rahul Kumar" />
        <TextField id={`${at}surname`} label="Surname" value={holder.surname} onChange={(surname) => onChange({ surname })} field={field} placeholder="e.g. Sharma" />
        {index > 0 && (
          <Field id={`${at}relationshipToPrimary`} label="Relationship to the primary account holder" required error={relationship.error}>
            <SelectInput
              {...describedBy(`${at}relationshipToPrimary`, relationship.error)}
              value={holder.relationshipToPrimary ?? ""}
              onChange={(event) => onChange({ relationshipToPrimary: event.target.value as Relationship })}
              onBlur={relationship.onBlur}
              required
            >
              <option value="" disabled>
                Choose a relationship
              </option>
              {(Object.keys(relationshipLabels) as Relationship[]).map((option) => (
                <option key={option} value={option}>
                  {relationshipLabels[option]}
                </option>
              ))}
            </SelectInput>
          </Field>
        )}
      </FormSection>

      <FormSection title="Identity document">
        <TextField id={`${at}idNumber`} label="NRIC or passport number" value={holder.idNumber} onChange={(idNumber) => onChange({ idNumber: idNumber.toUpperCase() })} field={field} placeholder="e.g. K1234567A" />
        <DateField id={`${at}idExpiry`} label="Expiry date" value={holder.idExpiry} onChange={(idExpiry) => onChange({ idExpiry })} field={field} min={daysFromToday(1)} max={daysFromToday(0, 30)} />
        <DateField id={`${at}dateOfBirth`} label="Date of birth" value={holder.dateOfBirth} onChange={(dateOfBirth) => onChange({ dateOfBirth })} field={field} min={new Date(1900, 0, 1)} max={daysFromToday(-1)} />
      </FormSection>

      <FormSection title="Nationality">
        <CountryField id={`${at}nationality`} label="Nationality" value={holder.nationality} onChange={(nationality) => onChange({ nationality })} field={field} />
        <CountryField id={`${at}countryOfBirth`} label="Country of birth" value={holder.countryOfBirth} onChange={(countryOfBirth) => onChange({ countryOfBirth })} field={field} />
        <div className="sm:col-span-2 sm:max-w-sm">
          <ChoiceCards
            name={`${at}otherNationality`}
            legend="Holds another nationality"
            required
            compact
            columns="grid-cols-2"
            value={toYesNo(holder.otherNationality)}
            onChange={(answer) => onChange({ otherNationality: answer === "yes" })}
            choices={yesNo}
          />
        </div>
        {holder.otherNationality && (
          <FollowUp title="Other nationality">
            <CountryField id={`${at}otherNationalityCountry`} label="Country" value={holder.otherNationalityCountry} onChange={(otherNationalityCountry) => onChange({ otherNationalityCountry })} field={field} />
          </FollowUp>
        )}
      </FormSection>
    </div>
  );
}

const occupationIcons: Record<Occupation, React.ReactNode> = {
  SALARIED: <Briefcase />,
  BUSINESS_OWNER: <Store />,
  HOMEMAKER: <House />,
  RETIRED: <Armchair />,
  STUDENT: <GraduationCap />,
  OTHER: <Shapes />,
};

export function OccupationStep({ index, holder, onChange, field }: HolderStepProps) {
  const at = `holders[${index}].`;
  const employer = holder.employer;
  const business = holder.business;
  return (
    <div className="space-y-6">
      <ChoiceCards<Occupation>
        name={`${at}occupation`}
        legend="Occupation"
        required
        columns="grid-cols-1 sm:grid-cols-2 xl:grid-cols-3"
        value={holder.occupation}
        onChange={(occupation) => onChange({ occupation })}
        choices={(Object.keys(occupationLabels) as Occupation[]).map((option) => ({
          value: option,
          label: occupationLabels[option],
          icon: occupationIcons[option],
        }))}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        {holder.occupation === "OTHER" && (
          <FollowUp title="Their occupation">
            <TextField id={`${at}occupationOther`} label="Occupation" value={holder.occupationOther} onChange={(occupationOther) => onChange({ occupationOther })} field={field} placeholder="e.g. Freelance consultant" className="sm:col-span-2" />
          </FollowUp>
        )}
        {holder.occupation === "SALARIED" && (
          <FollowUp title="Employer">
            <TextField id={`${at}employer.companyName`} label="Company name" value={employer.companyName} onChange={(companyName) => onChange({ employer: { ...employer, companyName } })} field={field} placeholder="e.g. Global Pvt Ltd" />
            <CountryField id={`${at}employer.country`} label="Country" value={employer.country} onChange={(country) => onChange({ employer: { ...employer, country } })} field={field} />
            <TextField id={`${at}employer.position`} label="Position held" value={employer.position} onChange={(position) => onChange({ employer: { ...employer, position } })} field={field} placeholder="e.g. Senior Manager" />
          </FollowUp>
        )}
        {holder.occupation === "BUSINESS_OWNER" && (
          <FollowUp title="Their business">
            <TextField id={`${at}business.companyName`} label="Company name" value={business.companyName} onChange={(companyName) => onChange({ business: { ...business, companyName } })} field={field} placeholder="e.g. Sharma Exports Pvt Ltd" />
            <CountryField id={`${at}business.country`} label="Country" value={business.country} onChange={(country) => onChange({ business: { ...business, country } })} field={field} />
            <TextField id={`${at}business.entityType`} label="Entity type" value={business.entityType} onChange={(entityType) => onChange({ business: { ...business, entityType } })} field={field} placeholder="e.g. Private limited company" />
            <TextField id={`${at}business.natureOfBusiness`} label="Nature of business" value={business.natureOfBusiness} onChange={(natureOfBusiness) => onChange({ business: { ...business, natureOfBusiness } })} field={field} placeholder="e.g. Textile exports" />
            <CountriesField
              id={`${at}business.countriesOfBusiness`}
              label="Countries the business works with"
              value={business.countriesOfBusiness}
              onChange={(countriesOfBusiness) => onChange({ business: { ...business, countriesOfBusiness } })}
              field={field}
              className="sm:col-span-2"
            />
          </FollowUp>
        )}
      </div>
    </div>
  );
}

export function ContactStep({ index, holder, onChange, field }: HolderStepProps) {
  const at = `holders[${index}].`;
  const phone = field(`${at}phone`);
  return (
    <div className="space-y-8">
      <FormSection title="Contact">
        <Field id={`${at}phone`} label="Mobile" required error={phone.error}>
          <MobileNumberInput {...describedBy(`${at}phone`, phone.error)} value={holder.phone ?? ""} onChange={(value) => onChange({ phone: value })} onBlur={phone.onBlur} />
        </Field>
        <TextField id={`${at}email`} label="Email address" type="email" value={holder.email} onChange={(email) => onChange({ email })} field={field} placeholder="name@example.com" />
      </FormSection>

      <FormSection title="Residential address" description="The address where they live now.">
        <AddressFields at={`${at}residentialAddress.`} value={holder.residentialAddress} onChange={(residentialAddress) => onChange({ residentialAddress })} field={field} insistOnLine2 />
      </FormSection>

      <FormSection title="Mailing address">
        <label className="flex cursor-pointer items-center gap-2.5 text-sm sm:col-span-2">
          <input
            type="checkbox"
            className="size-4 accent-primary-600"
            checked={holder.mailingSameAsResidential ?? false}
            onChange={(event) => onChange({ mailingSameAsResidential: event.target.checked })}
          />
          Same as the residential address
        </label>
        {!holder.mailingSameAsResidential && (
          <AddressFields at={`${at}mailingAddress.`} value={holder.mailingAddress} onChange={(mailingAddress) => onChange({ mailingAddress })} field={field} insistOnLine2 />
        )}
      </FormSection>

      {holder.secondaryMailingAddress ? (
        <FormSection
          title="Secondary mailing address"
          action={
            <button type="button" onClick={() => onChange({ secondaryMailingAddress: null })} className="inline-flex items-center gap-1 text-xs font-semibold text-ink-muted hover:text-red-600">
              <X aria-hidden="true" className="size-3.5" />
              Remove
            </button>
          }
        >
          <AddressFields at={`${at}secondaryMailingAddress.`} value={holder.secondaryMailingAddress} onChange={(secondaryMailingAddress) => onChange({ secondaryMailingAddress })} field={field} insistOnLine2 />
        </FormSection>
      ) : (
        <button
          type="button"
          onClick={() => onChange({ secondaryMailingAddress: emptyAddress() })}
          className="inline-flex items-center gap-1.5 rounded-lg px-1 text-sm font-semibold text-primary-600 hover:text-primary-700"
        >
          <Plus aria-hidden="true" className="size-4" />
          Add a secondary mailing address
        </button>
      )}
    </div>
  );
}

interface EntityStepProps {
  entity: FormEntity;
  onChange: (patch: Partial<FormEntity>) => void;
  field: FieldFor;
}

export function EntityDetailsStep({ entity, onChange, field }: EntityStepProps) {
  return (
    <div className="space-y-8">
      <FormSection title="Entity" description="As shown on the certificate of incorporation.">
        <TextField id="entity.legalName" label="Full legal name" value={entity.legalName} onChange={(legalName) => onChange({ legalName })} field={field} placeholder="e.g. The Tan Family Office Pte Ltd" className="sm:col-span-2" />
        <TextField id="entity.legalForm" label="Legal form" value={entity.legalForm} onChange={(legalForm) => onChange({ legalForm })} field={field} placeholder="e.g. Private company limited by shares" optional />
        <CountryField id="entity.countryOfIncorporation" label="Country of incorporation" value={entity.countryOfIncorporation} onChange={(countryOfIncorporation) => onChange({ countryOfIncorporation })} field={field} />
        <DateField id="entity.dateOfIncorporation" label="Date of incorporation" value={entity.dateOfIncorporation} onChange={(dateOfIncorporation) => onChange({ dateOfIncorporation })} field={field} min={new Date(1900, 0, 1)} max={daysFromToday(-1)} />
        <TextField id="entity.registrationNumber" label="Business registration number" value={entity.registrationNumber} onChange={(registrationNumber) => onChange({ registrationNumber })} field={field} placeholder="e.g. 201512345K" />
        <TextField id="entity.natureOfBusiness" label="Nature of the business" value={entity.natureOfBusiness} onChange={(natureOfBusiness) => onChange({ natureOfBusiness })} field={field} placeholder="e.g. Family investment holding" />
        <CountryField id="entity.taxResidency" label="Tax residency" value={entity.taxResidency} onChange={(taxResidency) => onChange({ taxResidency })} field={field} optional />
        <TextField id="entity.giin" label="GIIN" value={entity.giin} onChange={(giin) => onChange({ giin })} field={field} placeholder="e.g. S9K3L2.00000.LE.702" optional />
      </FormSection>
    </div>
  );
}

const organisationIcons: Record<OrganisationType, React.ReactNode> = {
  PIC: <Briefcase />,
  TRUST_OR_FOUNDATION: <Landmark />,
  TRADING_COMPANY: <Store />,
  OTHER: <Shapes />,
};

export function BusinessRegulationStep({ entity, onChange, field }: EntityStepProps) {
  return (
    <div className="space-y-8">
      <FormSection title="Regulation">
        <div className="sm:col-span-2 sm:max-w-sm">
          <ChoiceCards
            name="entity.regulated"
            legend="Is the entity regulated"
            required
            compact
            columns="grid-cols-2"
            value={toYesNo(entity.regulated)}
            onChange={(answer) => onChange({ regulated: answer === "yes" })}
            choices={yesNo}
          />
        </div>
        {entity.regulated && (
          <FollowUp title="Regulator">
            <TextField id="entity.regulatorName" label="Name of the regulator" value={entity.regulatorName} onChange={(regulatorName) => onChange({ regulatorName })} field={field} placeholder="e.g. Monetary Authority of Singapore" className="sm:col-span-2" />
          </FollowUp>
        )}
      </FormSection>

      <FormSection title="Business">
        <CountriesField
          id="entity.countriesOfBusiness"
          label="Countries the entity does business with or has links to"
          value={entity.countriesOfBusiness}
          onChange={(countriesOfBusiness) => onChange({ countriesOfBusiness })}
          field={field}
          className="sm:col-span-2"
        />
        <div className="sm:col-span-2">
          <ChoiceCards<OrganisationType>
            name="entity.organisationType"
            legend="Type of organisation"
            required
            value={entity.organisationType}
            onChange={(organisationType) => onChange({ organisationType })}
            choices={(Object.keys(organisationTypeLabels) as OrganisationType[]).map((option) => ({
              value: option,
              label: organisationTypeLabels[option],
              icon: organisationIcons[option],
            }))}
          />
        </div>
        {entity.organisationType === "OTHER" && (
          <FollowUp title="Type of organisation">
            <TextField id="entity.organisationTypeOther" label="Type" value={entity.organisationTypeOther} onChange={(organisationTypeOther) => onChange({ organisationTypeOther })} field={field} placeholder="e.g. Partnership" className="sm:col-span-2" />
          </FollowUp>
        )}
      </FormSection>
    </div>
  );
}

export function RegisteredAddressStep({ entity, onChange, field }: EntityStepProps) {
  return (
    <FormSection title="Registered address" description="The entity's registered office.">
      <AddressFields at="entity.registeredAddress." value={entity.registeredAddress} onChange={(registeredAddress) => onChange({ registeredAddress })} field={field} insistOnLine2 />
    </FormSection>
  );
}
