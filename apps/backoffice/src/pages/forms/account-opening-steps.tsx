import { Button, cn, describedBy, Field, IconButton } from "@atomprive/ui";
import { Plus, X } from "lucide-react";
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
import { Boxes, Tick } from "../../components/form-boxes";
import { Documents, type FormDocuments } from "../../components/form-documents";
import { MobileNumberInput } from "../../components/mobile-number-input";
import {
  CORPORATE_SIGNATORY_DOCUMENTS,
  MANDATORY_DOCUMENTS,
  UNDERLINE_SURNAME,
  declarationWording,
  documentField,
  emptyPerson,
  emptySigner,
  organisationTypeLabels,
  personBlocks,
  personTitles,
  phoneLabels,
  signingMandateLabels,
  type AccountOpeningEntity,
  type FormPerson,
  type OrganisationType,
  type Signer,
  type SigningMandate,
} from "./account-opening-entity";

const MAX_PEOPLE = 6;

function daysFromToday(days: number, years = 0) {
  const today = new Date();
  return new Date(today.getFullYear() + years, today.getMonth(), today.getDate() + days);
}

type Entity = AccountOpeningEntity["entity"];

/** Section A: who the entity is. */
export function EntityDetailsStep({ entity, onChange, field }: { entity: Entity; onChange: (patch: Partial<Entity>) => void; field: FieldFor }) {
  const regulated = field("entity.regulated");
  const organisation = field("entity.organisationType");
  return (
    <div className="space-y-6">
      {/* The part is headed with this group’s name and the words the form opens it with, so it is not said again. */}
      <FieldGroup>
        <TextField id="entity.legalName" label="Full Legal Name:" value={entity.legalName} onChange={(legalName) => onChange({ legalName })} field={field} className="sm:col-span-2" />
        <CountryField id="entity.countryOfIncorporation" label="Country of Incorporation:" value={entity.countryOfIncorporation} onChange={(countryOfIncorporation) => onChange({ countryOfIncorporation })} field={field} />
        <DateField id="entity.dateOfIncorporation" label="Date of Incorporation (DD/MM/YYYY):" value={entity.dateOfIncorporation} onChange={(dateOfIncorporation) => onChange({ dateOfIncorporation })} field={field} min={daysFromToday(0, -200)} max={daysFromToday(0)} />
        <TextField id="entity.registrationNumber" label="Business Registration Number:" value={entity.registrationNumber} onChange={(registrationNumber) => onChange({ registrationNumber })} field={field} />
        <TextField id="entity.natureOfBusiness" label="Nature of Business" value={entity.natureOfBusiness} onChange={(natureOfBusiness) => onChange({ natureOfBusiness })} field={field} multiline className="sm:col-span-2" />
        <CountriesField id="entity.businessLinkCountries" label="Countries the entity does business with or has business links to:" value={entity.businessLinkCountries} onChange={(businessLinkCountries) => onChange({ businessLinkCountries })} field={field} className="sm:col-span-2" />
      </FieldGroup>

      <Field id="entity.organisationType" label="Type of Organisation" required error={organisation.error}>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(organisationTypeLabels) as OrganisationType[]).map((type) => (
            <Tick
              key={type}
              kind="radio"
              name="entity.organisationType"
              id={`entity.organisationType.${type}`}
              checked={entity.organisationType === type}
              onChange={() => onChange({ organisationType: type, organisationTypeOther: "" })}
              text={organisationTypeLabels[type]}
              blank={
                // The form rules a line beside Others.
                type === "OTHER"
                  ? {
                      id: "entity.organisationTypeOther",
                      label: "Others",
                      // The rule the form prints beside Others is where the answer goes.
                      value: entity.organisationTypeOther,
                      onChange: (organisationTypeOther) => onChange({ organisationTypeOther }),
                      field,
                    }
                  : undefined
              }
            />
          ))}
        </div>
      </Field>

      {/* The form prints this as two boxes on the line, the same as the types above it, and it reads as those do. */}
      <Field id="entity.regulated" label="Is the entity regulated:" required error={regulated.error}>
        <div className="flex flex-wrap gap-2">
          <Tick
            kind="radio"
            name="entity.regulated"
            id="entity.regulated.yes"
            checked={entity.regulated === true}
            onChange={() => onChange({ regulated: true })}
            text="Yes"
          />
          <Tick
            kind="radio"
            name="entity.regulated"
            id="entity.regulated.no"
            checked={entity.regulated === false}
            // The regulator's name is only asked for where the answer is Yes, so it goes back with a No.
            onChange={() => onChange({ regulated: false, regulatorName: "" })}
            text="No"
          />
        </div>
      </Field>
      {entity.regulated === true && (
        <FollowUp title="If Yes">
          <TextField id="entity.regulatorName" label="If Yes, Name of Regulator:" value={entity.regulatorName} onChange={(regulatorName) => onChange({ regulatorName })} field={field} className="sm:col-span-2" />
        </FollowUp>
      )}
    </div>
  );
}

/** Section A: where the entity is registered. A physical address, not just a PO box. */
export function RegisteredAddressStep({ value, onChange, field }: { value: AccountOpeningEntity["registeredAddress"]; onChange: (address: AccountOpeningEntity["registeredAddress"]) => void; field: FieldFor }) {
  // The part is headed "Address", with this line under it, so the group does not repeat it.
  return (
    <FieldGroup>
      <AddressFields at="registeredAddress." value={value} onChange={onChange} field={field}insistOnState={false} />
    </FieldGroup>
  );
}

interface PeopleStepProps {
  at: "signatories" | "beneficialOwners" | "directors";
  noun: string;
  people: FormPerson[];
  formId: string;
  documents: FormDocuments;
  onChange: (people: FormPerson[]) => void;
  field: FieldFor;
}

/** Sections B, C and D: the same details for each authorised signatory, beneficial owner and director. */
export function PeopleStep({ at, noun, people, formId, documents, onChange, field }: PeopleStepProps) {
  const change = (index: number, patch: Partial<FormPerson>) =>
    onChange(people.map((person, i) => (i === index ? { ...person, ...patch } : person)));

  return (
    <div className="space-y-6">
      {people.map((person, index) => (
        <div key={index} className="space-y-4 rounded-2xl border border-line p-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-bold">
              {noun} {index + 1}
            </h3>
            {people.length > 1 && (
              <IconButton label={`Remove ${noun.toLowerCase()} ${index + 1}`} tone="danger" onClick={() => onChange(people.filter((_, i) => i !== index))}>
                <X />
              </IconButton>
            )}
          </div>
          <FieldGroup title={personBlocks.personal}>
            <div className="sm:col-span-2">
              <Boxes legend="Name in full as in NR/C/Passport" required error={field(`${at}[${index}].title`).error}>
                <div className="flex flex-wrap gap-2">
                  {personTitles.map((option) => (
                    <Tick
                      key={option.value}
                      kind="radio"
                      name={`${at}[${index}].title`}
                      id={`${at}[${index}].title.${option.value}`}
                      checked={person.title === option.value}
                      onChange={() => change(index, { title: option.value })}
                      text={option.text}
                    />
                  ))}
                </div>
              </Boxes>
            </div>
            <TextField id={`${at}[${index}].fullName`} label="Name in full as in NR/C/Passport" value={person.fullName} onChange={(fullName) => change(index, { fullName })} field={field} className="sm:col-span-2" />
            {/* The form asks for the surname to be underlined, which is how it tells the family name apart. */}
            <p className="-mt-2 text-xs text-ink-muted sm:col-span-2">{UNDERLINE_SURNAME}</p>
            <TextField id={`${at}[${index}].passportNumber`} label="NRIC/ Passport number" value={person.passportNumber} onChange={(passportNumber) => change(index, { passportNumber })} field={field} />
            <CountryField id={`${at}[${index}].nationality`} label="Nationality" value={person.nationality} onChange={(nationality) => change(index, { nationality })} field={field} />
            <DateField id={`${at}[${index}].dateOfBirth`} label="Date of birth DD/MM/YYYY" value={person.dateOfBirth} onChange={(dateOfBirth) => change(index, { dateOfBirth })} field={field} min={daysFromToday(0, -120)} max={daysFromToday(0, -18)} />
            <CountryField id={`${at}[${index}].countryOfBirth`} label="Country of birth" value={person.countryOfBirth} onChange={(countryOfBirth) => change(index, { countryOfBirth })} field={field} />
            <TextField id={`${at}[${index}].occupation`} label="Occupation/ Employment details" value={person.occupation} onChange={(occupation) => change(index, { occupation })} field={field} className="sm:col-span-2" />
          </FieldGroup>

          <FieldGroup title={personBlocks.contact}>
            {/* The form rules two lines for numbers, one under the other, and one for an email address. */}
            <PhoneField id={`${at}[${index}].phone`} label={phoneLabels[at][0]} value={person.phone} onChange={(phone) => change(index, { phone })} field={field} />
            <PhoneField id={`${at}[${index}].secondPhone`} label={phoneLabels[at][1]} value={person.secondPhone} onChange={(secondPhone) => change(index, { secondPhone })} field={field} optional />
            <TextField id={`${at}[${index}].email`} label="Email address" type="email" value={person.email} onChange={(email) => change(index, { email })} field={field} className="sm:col-span-2" />
          </FieldGroup>

          <FieldGroup title={personBlocks.address}>
            <div className="sm:col-span-2">
              <p className="mb-3 text-2xs font-semibold tracking-wider text-ink-muted uppercase">Residential address (Physical address, not just PO Box)</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <AddressFields at={`${at}[${index}].address.`} value={person.address} onChange={(address) => change(index, { address })} field={field}insistOnState={false} />
              </div>
            </div>
          </FieldGroup>

          <Copies
            lead="Please provide copies of the mandatory documents below."
            wanted={MANDATORY_DOCUMENTS}
            at={at}
            index={index}
            formId={formId}
            documents={documents}
            field={field}
          />
          {/* The form asks for these further copies only where the signatory is itself a company. */}
          {at === "signatories" && (
            <Copies
              lead="For an authorised signatory who is a corporate entity"
              wanted={CORPORATE_SIGNATORY_DOCUMENTS}
              at={at}
              index={index}
              formId={formId}
              documents={documents}
              field={field}
            />
          )}
        </div>
      ))}
      {people.length < MAX_PEOPLE && (
        <Button variant="secondary" onClick={() => onChange([...people, emptyPerson()])}>
          <Plus aria-hidden="true" />
          Add another {noun.toLowerCase()}
        </Button>
      )}

    </div>
  );
}

function PhoneField({ id, label, value, onChange, field, optional }: { id: string; label: string; value: string; onChange: (value: string) => void; field: FieldFor; optional?: boolean }) {
  const { error, onBlur } = field(id);
  return (
    <Field id={id} label={label} required={!optional} error={error}>
      <MobileNumberInput {...describedBy(id, error)} id={id} value={value} onChange={onChange} onBlur={onBlur} />
    </Field>
  );
}

type Declarations = AccountOpeningEntity["declarations"];

/** Section E: what is being agreed to, and how many signatories have to sign. The client signs the paper. */
export function DeclarationsStep({
  declarations,
  firmName,
  onChange,
  field,
}: {
  declarations: Declarations;
  firmName: string | null;
  onChange: (patch: Partial<Declarations>) => void;
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
                  className="mt-0.5 size-4 shrink-0 accent-primary-600"
                  checked={declarations[declaration.id] === true}
                  onBlur={onBlur}
                  onChange={(event) => onChange({ [declaration.id]: event.target.checked })}
                  aria-label={declaration.text.slice(0, 80)}
                />
                <span className="text-ink">{withFirm(declaration.text, firmName)}</span>
              </label>
            </div>
          );
        })}
      </section>

      {/* The form prints these four along one line, so they are read along one line. */}
      <Boxes legend="Signing mandate (if applicable)" required inline error={mandate.error}>
        {(Object.keys(signingMandateLabels) as SigningMandate[]).map((option) => (
          <Tick
            key={option}
            kind="radio"
            name="declarations.signingMandate"
            id={`declarations.signingMandate.${option}`}
            checked={declarations.signingMandate === option}
            onChange={() => onChange({ signingMandate: option, signingMandateOther: "" })}
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

      {/* Section E rules two of these at its foot, one under the other. */}
      <FieldGroup
        title="Authorised Signatory"
        action={
          <Button variant="secondary" size="sm" disabled={declarations.signers.length >= MAX_PEOPLE} onClick={() => onChange({ signers: [...declarations.signers, emptySigner()] })}>
            <Plus aria-hidden="true" />
            Add a signatory
          </Button>
        }
      >
        {declarations.signers.map((signer, at) => (
          <FollowUp key={at} title={`Authorised Signatory ${at + 1}`}>
            <TextField id={`declarations.signers[${at}].fullName`} label="Full name:" value={signer.fullName} onChange={(fullName) => setSigner(at, { fullName })} field={field} className="sm:col-span-2" />
            <SignatureField id={`declarations.signers[${at}].signature`} label="Signature:" value={signer.signature} onChange={(signature) => setSigner(at, { signature })} field={field} />
            <DateField id={`declarations.signers[${at}].signedOn`} label="Date (DD/MM/YYYY):" value={signer.signedOn} onChange={(signedOn) => setSigner(at, { signedOn })} field={field} min={daysFromToday(-2 * 365)} max={daysFromToday(365)} />
            {declarations.signers.length > 1 && (
              <div className="sm:col-span-2">
                <IconButton label={`Remove Authorised Signatory ${at + 1}`} tone="danger" onClick={() => onChange({ signers: declarations.signers.filter((_, which) => which !== at) })}>
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

/**
 * The copies the form asks for, each on the line that asks for it. The form asks for them in its own words, so
 * the line is the label and what goes against it is the file itself.
 */
function Copies({
  lead,
  wanted,
  at,
  index,
  formId,
  documents,
  field,
}: {
  lead: string;
  wanted: string[];
  at: string;
  index: number;
  formId: string;
  documents: FormDocuments;
  field: FieldFor;
}) {
  return (
    <div className="space-y-3 rounded-xl border border-line bg-slate-50/70 p-4">
      <p className="text-sm font-semibold text-ink">{lead}</p>
      <ul className="space-y-3">
        {wanted.map((document) => {
          const held = documentField(at, index, document);
          const problem = field(held).error;
          return (
            <li key={document} className="rounded-lg border border-line bg-white p-3">
              <p className="text-sm text-ink">{document}</p>
              <div className="mt-2">
                <Documents formId={formId} field={held} documents={documents} label="Attach a copy" />
              </div>
              {problem && <p className="mt-1 text-xs text-amber-700">{problem}</p>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** The form names the firm throughout its declarations. */
function withFirm(text: string, firmName: string | null) {
  return firmName ? text.replaceAll("{{firmName}}", firmName) : text;
}
