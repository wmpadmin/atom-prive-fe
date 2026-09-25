import { Button, cn, describedBy, Field, IconButton } from "@atomprive/ui";
import { Plus, X } from "lucide-react";
import { Boxes, Tick } from "../../components/form-boxes";
import { Documents, type FormDocuments } from "../../components/form-documents";
import {
  AddressFields,
  CountriesField,
  CountryField,
  DateField,
  FollowUp,
  FormSection as FieldGroup,
  SignatureField, TextField,
  type FieldFor,
} from "../../components/form-fields";
import { MobileNumberInput } from "../../components/mobile-number-input";
import { emptySigner, type Signer } from "./account-opening-entity";
import {
  MANDATORY_DOCUMENTS,
  addressStarted,
  declarationWording,
  documentField,
  holderBlocks,
  holderNotes,
  holderTitles,
  occupations,
  signingMandateLabels,
  type AccountHolder,
  type AccountOpeningIndividual,
  type HolderTitle,
  type Occupation,
  type SigningMandate,
} from "./account-opening-individual";

const MAX_SIGNERS = 4;

/** The one phone line the form rules, with the country code picked rather than typed. */
function PhoneField({ id, label, value, onChange, field }: { id: string; label: string; value: string; onChange: (value: string) => void; field: FieldFor }) {
  const { error, onBlur } = field(id);
  return (
    <Field id={id} label={label} required error={error}>
      <MobileNumberInput {...describedBy(id, error)} id={id} value={value} onChange={onChange} onBlur={onBlur} />
    </Field>
  );
}

function daysFromToday(days: number, years = 0) {
  const today = new Date();
  return new Date(today.getFullYear() + years, today.getMonth(), today.getDate() + days);
}

/** One of the two account holders the form rules, asked for as the form asks for it. */
export function HolderStep({
  at,
  holder,
  formId,
  documents,
  onChange,
  field,
}: {
  at: number;
  holder: AccountHolder;
  formId: string;
  documents: FormDocuments;
  onChange: (patch: Partial<AccountHolder>) => void;
  field: FieldFor;
}) {
  const where = `holders[${at}]`;
  const otherNationality = field(`${where}.otherNationalityHeld`);
  const occupation = field(`${where}.occupation`);
  return (
    <div className="space-y-6">
      <FieldGroup title={holderBlocks.personal}>
        <div className="sm:col-span-2">
          <Boxes legend={holderNotes.name} required inline error={field(`${where}.title`).error}>
            {holderTitles.map((option) => (
              <Tick
                key={option.value}
                kind="radio"
                name={`${where}.title`}
                id={`${where}.title.${option.value}`}
                checked={holder.title === option.value}
                onChange={() => onChange({ title: option.value as HolderTitle })}
                text={option.text}
              />
            ))}
          </Boxes>
        </div>
        <TextField id={`${where}.fullName`} label="Name in full as in NRIC/ Passport" value={holder.fullName} onChange={(fullName) => onChange({ fullName })} field={field} className="sm:col-span-2" />
        <TextField id={`${where}.forenames`} label="Forename(s)" value={holder.forenames} onChange={(forenames) => onChange({ forenames })} field={field} />
        <TextField id={`${where}.surname`} label="Surname" value={holder.surname} onChange={(surname) => onChange({ surname })} field={field} />
        {at > 0 && (
          <TextField id={`${where}.relationshipToFirst`} label="Relationship with A/c Holder 1" value={holder.relationshipToFirst} onChange={(relationshipToFirst) => onChange({ relationshipToFirst })} field={field} className="sm:col-span-2" />
        )}
        <TextField id={`${where}.passportNumber`} label="NRIC/ Passport Number" value={holder.passportNumber} onChange={(passportNumber) => onChange({ passportNumber })} field={field} />
        <CountryField id={`${where}.nationality`} label="Nationality" value={holder.nationality} onChange={(nationality) => onChange({ nationality })} field={field} />
        <CountryField id={`${where}.countryOfBirth`} label="Country of Birth" value={holder.countryOfBirth} onChange={(countryOfBirth) => onChange({ countryOfBirth })} field={field} />
        <div className="sm:col-span-2">
          {/* The form prints this as two boxes on the line, and it reads as two boxes on the line. */}
          <Boxes legend="Other Nationality Held" required inline error={otherNationality.error}>
            <Tick
              kind="radio"
              name={`${where}.otherNationalityHeld`}
              id={`${where}.otherNationalityHeld.yes`}
              checked={holder.otherNationalityHeld === true}
              onChange={() => onChange({ otherNationalityHeld: true })}
              text="Yes"
            />
            <Tick
              kind="radio"
              name={`${where}.otherNationalityHeld`}
              id={`${where}.otherNationalityHeld.no`}
              checked={holder.otherNationalityHeld === false}
              // The form only asks about the other passport where there is one, so a No takes those back.
              onChange={() =>
                onChange({
                  otherNationalityHeld: false,
                  otherNationalityCountry: null,
                  otherPassportNumber: "",
                  otherPassportExpiry: "",
                })
              }
              text="No"
            />
          </Boxes>
        </div>
        {holder.otherNationalityHeld === true && (
          <FollowUp title="If Yes">
            <CountryField id={`${where}.otherNationalityCountry`} label="Country" value={holder.otherNationalityCountry} onChange={(otherNationalityCountry) => onChange({ otherNationalityCountry })} field={field} />
            <TextField id={`${where}.otherPassportNumber`} label="Passport Number" value={holder.otherPassportNumber} onChange={(otherPassportNumber) => onChange({ otherPassportNumber })} field={field} />
            <DateField id={`${where}.otherPassportExpiry`} label="Date of Expiry" value={holder.otherPassportExpiry} onChange={(otherPassportExpiry) => onChange({ otherPassportExpiry })} field={field} min={daysFromToday(0)} max={daysFromToday(0, 30)} />
          </FollowUp>
        )}
      </FieldGroup>

      <Field id={`${where}.occupation`} label="Occupation / Employment Details Occupation Details" required error={occupation.error}>
        <div className="flex flex-wrap gap-2">
          {occupations.map((option) => (
            <Tick
              key={option.value}
              kind="radio"
              name={`${where}.occupation`}
              id={`${where}.occupation.${option.value}`}
              checked={holder.occupation === option.value}
              onChange={() => onChange({ occupation: option.value as Occupation })}
              text={option.text}
              blank={
                // The form rules a line beside Other.
                option.value === "OTHER"
                  ? {
                      id: `${where}.occupationOther`,
                      label: "Other occupation, please specify",
                      value: holder.occupationOther,
                      onChange: (occupationOther) => onChange({ occupationOther }),
                      field,
                    }
                  : undefined
              }
            />
          ))}
        </div>
      </Field>

      {holder.occupation === "SALARIED" && (
        <FieldGroup title={holderBlocks.salaried}>
          <TextField id={`${where}.employerName`} label="Name of Company" value={holder.employerName} onChange={(employerName) => onChange({ employerName })} field={field} />
          <CountryField id={`${where}.employerCountry`} label="Country" value={holder.employerCountry} onChange={(employerCountry) => onChange({ employerCountry })} field={field} />
          <TextField id={`${where}.positionHeld`} label="Position Held" value={holder.positionHeld} onChange={(positionHeld) => onChange({ positionHeld })} field={field} className="sm:col-span-2" />
        </FieldGroup>
      )}

      {holder.occupation === "BUSINESS_OWNER" && (
        <FieldGroup title={holderBlocks.businessOwner}>
          <TextField id={`${where}.companyName`} label="Name of Company" value={holder.companyName} onChange={(companyName) => onChange({ companyName })} field={field} />
          <CountryField id={`${where}.companyCountry`} label="Country" value={holder.companyCountry} onChange={(companyCountry) => onChange({ companyCountry })} field={field} />
          <TextField id={`${where}.entityType`} label="Entity Type" value={holder.entityType} onChange={(entityType) => onChange({ entityType })} field={field} />
          <TextField id={`${where}.natureOfBusiness`} label="Nature of Business" value={holder.natureOfBusiness} onChange={(natureOfBusiness) => onChange({ natureOfBusiness })} field={field} />
          <CountriesField id={`${where}.businessLinkCountries`} label="Countries the entity does business with or has business links to" value={holder.businessLinkCountries} onChange={(businessLinkCountries) => onChange({ businessLinkCountries })} field={field} className="sm:col-span-2" />
        </FieldGroup>
      )}

      <FieldGroup title={holderBlocks.contact} description={holderNotes.contact}>
        <PhoneField id={`${where}.phone`} label="Phone Number" value={holder.phone} onChange={(phone) => onChange({ phone })} field={field} />
        <TextField id={`${where}.email`} label="Email Address" type="email" value={holder.email} onChange={(email) => onChange({ email })} field={field} />
      </FieldGroup>

      <FieldGroup title={holderBlocks.address} description={holderNotes.address}>
        <AddressFields at={`${where}.address.`} value={holder.address} onChange={(address) => onChange({ address })} field={field} />
      </FieldGroup>

      <div className="rounded-2xl border border-line p-5">
        <p className="text-sm font-bold text-ink">{holderNotes.documents}</p>
        <ul className="mt-3 space-y-3">
          {MANDATORY_DOCUMENTS.map((document) => (
            <li key={document}>
              <p className="text-sm text-ink">{document}</p>
              <div className="mt-1.5">
                <Documents formId={formId} field={documentField(where, document)} documents={documents} label="Attach a copy" />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** Where the firm writes to: the address the form asks for, and the second one it marks Optional. */
export function MailingStep({
  mailing,
  onChange,
  field,
}: {
  mailing: AccountOpeningIndividual["mailing"];
  onChange: (patch: Partial<AccountOpeningIndividual["mailing"]>) => void;
  field: FieldFor;
}) {
  return (
    <div className="space-y-6">
      <FieldGroup title="Mailing address">
        <AddressFields at="mailing.address." value={mailing.address} onChange={(address) => onChange({ address })} field={field} />
      </FieldGroup>
      <FieldGroup title="Secondary Mailing address (Optional)" description="Leave this blank unless the client wants a second address. Once you start it, the form needs the whole address.">
        <AddressFields
          at="mailing.secondary."
          value={mailing.secondary}
          onChange={(secondary) => onChange({ secondary })}
          field={field}
          optional={!addressStarted(mailing.secondary)}
        />
      </FieldGroup>
    </div>
  );
}

/** What is being agreed to, how many holders have to sign, and the signatures the form rules at its foot. */
export function DeclarationsStep({
  declarations,
  firmName,
  onChange,
  field,
}: {
  declarations: AccountOpeningIndividual["declarations"];
  firmName: string | null;
  onChange: (patch: Partial<AccountOpeningIndividual["declarations"]>) => void;
  field: FieldFor;
}) {
  const mandate = field("declarations.signingMandate");
  const setSigner = (at: number, patch: Partial<Signer>) =>
    onChange({ signers: declarations.signers.map((row, which) => (which === at ? { ...row, ...patch } : row)) });

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        {declarationWording.map((declaration) => {
          const { error, onBlur } = field(`declarations.${declaration.id}`);
          return (
            <div key={declaration.id}>
              {"heading" in declaration && (
                <h3 className="mt-4 mb-2 text-sm font-bold first:mt-0">{declaration.heading}</h3>
              )}
              <label
                className={cn(
                  "flex gap-3 rounded-xl border p-4 text-sm leading-relaxed",
                  error ? "border-red-300 bg-red-50/40" : "border-line",
                )}
              >
                <input
                  type="checkbox"
                  className="mt-0.5 size-4 shrink-0 rounded-[3px] accent-primary-600"
                  checked={declarations[declaration.id]}
                  onBlur={onBlur}
                  onChange={(event) => onChange({ [declaration.id]: event.target.checked })}
                />
                <span>{declaration.text.replaceAll("{{firmName}}", firmName ?? "the Firm")}</span>
              </label>
            </div>
          );
        })}
      </section>

      {/* The form prints these three along one line, so they are read along one line. */}
      <Boxes legend="Signing mandate (if applicable):" required inline error={mandate.error}>
        {(Object.keys(signingMandateLabels) as SigningMandate[]).map((option) => (
          <Tick
            key={option}
            kind="radio"
            name="declarations.signingMandate"
            id={`declarations.signingMandate.${option}`}
            checked={declarations.signingMandate === option}
            onChange={() => onChange({ signingMandate: option })}
            text={signingMandateLabels[option]}
            blank={
              option === "OTHER"
                ? {
                    id: "declarations.signingMandateOther",
                    label: "Others (please specify)",
                    value: declarations.signingMandateOther,
                    onChange: (signingMandateOther) => onChange({ signingMandateOther }),
                    field,
                  }
                : undefined
            }
          />
        ))}
      </Boxes>

      <FieldGroup title="Date of Account Opening Application Form">
        <DateField id="declarations.appliedOn" label="Date of Account Opening Application Form" value={declarations.appliedOn} onChange={(appliedOn) => onChange({ appliedOn })} field={field} min={daysFromToday(-2 * 365)} max={daysFromToday(365)} />
      </FieldGroup>

      {/* The form rules a block for the first account holder and one for the second, if applicable. */}
      <FieldGroup
        title="Account holders"
        action={
          <Button variant="secondary" size="sm" disabled={declarations.signers.length >= MAX_SIGNERS} onClick={() => onChange({ signers: [...declarations.signers, emptySigner()] })}>
            <Plus aria-hidden="true" />
            Add an account holder
          </Button>
        }
      >
        {declarations.signers.map((signer, at) => (
          <FollowUp key={at} title={at === 0 ? "First account holder" : "Second account holder (if applicable)"}>
            <TextField id={`declarations.signers[${at}].fullName`} label="Full name" value={signer.fullName} onChange={(fullName) => setSigner(at, { fullName })} field={field} />
            <SignatureField id={`declarations.signers[${at}].signature`} label="Signature" value={signer.signature} onChange={(signature) => setSigner(at, { signature })} field={field} />
            {declarations.signers.length > 1 && (
              <div className="sm:col-span-2">
                <IconButton label={`Remove account holder ${at + 1}`} tone="danger" onClick={() => onChange({ signers: declarations.signers.filter((_, which) => which !== at) })}>
                  <X />
                </IconButton>
              </div>
            )}
          </FollowUp>
        ))}
      </FieldGroup>
    </div>
  );
}
