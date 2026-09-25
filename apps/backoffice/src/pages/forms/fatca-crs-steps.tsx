import { useFirmName } from "./firm-name";
import { Alert, Button, IconButton, RequiredMark, cn } from "@atomprive/ui";
import { CircleCheck, Plus, X } from "lucide-react";
import type { ReactNode } from "react";
import { Boxes, Tick, type Blank } from "../../components/form-boxes";
import { Documents, type FormDocuments } from "../../components/form-documents";
import {
  CountryField,
  DateField,
  FollowUp,
  FormSection as FieldGroup,
  SignatureField, TextField,
  type FieldFor,
} from "../../components/form-fields";
import {
  BLANK,
  CERTIFIED_COPY,
  controlRoles,
  controllingPersonsBecause,
  crsGroups,
  crsStatusOf,
  declarationWording,
  emptyControllingPerson,
  emptySigner,
  emptyTaxResidence,
  fatcaGroups,
  fatcaStatusOf,
  giinFootnotes,
  importantNotes,
  noTinReasons,
  NO_TIN_HEADING,
  NO_TIN_HEADING_CONTROLLING_PERSON,
  registrationOptions,
  residenceDeclarations,
  TITLE_QUALIFIER,
  usPersonOptions,
  type ControlOf,
  type ControllingPerson,
  type FatcaCrsEntity,
  type FatcaRegistration,
  type NoTinReason,
  type StatusGroup,
  type StatusOption,
  type TaxResidence,
} from "./fatca-crs";

const MAX_ROWS = 10;

function yearsFromToday(years: number) {
  const today = new Date();
  return new Date(today.getFullYear() + years, today.getMonth(), today.getDate());
}

/** Something the portal keeps against one of the form's lines, set apart from the line itself. */
function Aside({ children }: { children: ReactNode }) {
  return <div className="space-y-2 border-t border-primary-100 px-3.5 py-3">{children}</div>;
}

/** The box the footnote asks to be filled in, on its own rule. */
function FootnoteBlank({ id, label, value, onChange, field }: Blank) {
  const { error, onBlur } = field(id);
  return (
    <>
      <input
        id={id}
        type="text"
        aria-label={label}
        aria-invalid={error ? true : undefined}
        autoComplete="off"
        value={value}
        onBlur={onBlur}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          "block h-10 w-full max-w-sm rounded-lg border bg-white px-3 text-sm text-ink focus:outline-none",
          error ? "border-red-500" : "border-line focus:border-primary-600",
        )}
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </>
  );
}

interface StatusPickerProps {
  /** Where the answer lives, so the boxes carry the ids the API uses: "fatca" or "crs". */
  at: string;
  legend: string;
  /** The part is already headed with these words, so the legend is there only for whoever is listening. */
  hideLegend?: boolean;
  groups: StatusGroup[];
  status: string | null;
  onChange: (patch: { group?: string | null; status?: string | null }) => void;
  field: FieldFor;
  /** What goes on the blank a line rules, for the line that rules one. */
  blankFor?: (option: StatusOption) => Blank | undefined;
  /** What the form prints at the foot of the boxes, such as the footnotes its starred statuses point at. */
  footer?: ReactNode;
}

/**
 * Every status the form prints, under the heading the form prints it under, with one box ticked across the lot
 * — which is how the paper asks it. Ticking a box answers the heading too, because the box is printed under it.
 * What the screen changes is the footnote: the paper stars a status and puts its note at the foot of the page,
 * and here the note is shown against the box that stars it.
 */
function StatusPicker({ at, legend, hideLegend, groups, status, onChange, field, blankFor, footer }: StatusPickerProps) {
  const error = field(`${at}.status`).error;
  return (
    <fieldset>
      <legend className={hideLegend ? "sr-only" : "mb-3 text-sm font-bold text-ink"}>
        {legend}
        {!hideLegend && <RequiredMark />}
      </legend>
      <div className="space-y-4">
        {groups.map((one) => (
          <div key={one.value} className="rounded-2xl border border-line bg-slate-50/70 p-4 sm:p-5">
            <Boxes legend={one.heading}>
              {one.options.map((option) => (
                <Tick
                  key={option.value}
                  kind="radio"
                  name={`${at}.status`}
                  id={`${at}.status.${option.value}`}
                  checked={status === option.value}
                  onChange={() => onChange({ group: one.value, status: option.value })}
                  text={option.text}
                  blank={blankFor?.(option)}
                />
              ))}
            </Boxes>
          </div>
        ))}
        {footer}
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </fieldset>
  );
}

/** The firm's own name, which the form prints throughout its notices and its declaration. */
function withFirm(text: string, firmName: string) {
  return text.replaceAll("{{firmName}}", firmName);
}

/** PART A – Entity Account Holder: General Information, and the two addresses. */
export function EntityStep({
  entity,
  onChange,
  field,
}: {
  entity: FatcaCrsEntity["entity"];
  onChange: (patch: Partial<FatcaCrsEntity["entity"]>) => void;
  field: FieldFor;
}) {
  const firmName = useFirmName();
  return (
    <div className="space-y-6">
      <p className="text-sm text-ink-muted">{TITLE_QUALIFIER}</p>

      <Alert tone="info">
        <p className="font-semibold">Important:</p>
        {firmName ? (
          <ul className="mt-1 list-disc space-y-2 pl-5">
            {importantNotes.map((note, at) => (
              <li key={at}>{withFirm(note, firmName)}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-1">Reading what the form says…</p>
        )}
      </Alert>

      <FieldGroup title="General Information">
        <TextField id="entity.name" label="Entity Name" value={entity.name} onChange={(name) => onChange({ name })} field={field} className="sm:col-span-2" />
      </FieldGroup>

      <FieldGroup title="Registered Address">
        <TextField id="entity.street" label="Street, No." value={entity.street} onChange={(street) => onChange({ street })} field={field} className="sm:col-span-2" />
        <TextField id="entity.town" label="Town/City" value={entity.town} onChange={(town) => onChange({ town })} field={field} />
        <CountryField id="entity.country" label="Country" value={entity.country} onChange={(country) => onChange({ country })} field={field} />
        <TextField id="entity.postalCode" label="Postal Code/ZIP Code (if any)" value={entity.postalCode} onChange={(postalCode) => onChange({ postalCode })} field={field} optional />
      </FieldGroup>

      {/* The form heads this block "if different from the Registered Address", so nothing in it is asked for. */}
      <FieldGroup title="Mailing Address (if different from the Registered Address)">
        <TextField id="entity.mailingStreet" label="Street, No." value={entity.mailingStreet} onChange={(mailingStreet) => onChange({ mailingStreet })} field={field} optional className="sm:col-span-2" />
        <TextField id="entity.mailingTown" label="Town/City" value={entity.mailingTown} onChange={(mailingTown) => onChange({ mailingTown })} field={field} optional />
        <CountryField id="entity.mailingCountry" label="Country" value={entity.mailingCountry} onChange={(mailingCountry) => onChange({ mailingCountry })} field={field} optional />
        <TextField id="entity.mailingPostalCode" label="Postal Code/ZIP Code (if any)" value={entity.mailingPostalCode} onChange={(mailingPostalCode) => onChange({ mailingPostalCode })} field={field} optional />
      </FieldGroup>

      {/* The form asks these two last, under General Information, after both addresses. */}
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField id="entity.placeOfIncorporation" label="Place of Incorporation" value={entity.placeOfIncorporation} onChange={(placeOfIncorporation) => onChange({ placeOfIncorporation })} field={field} />
        <TextField id="entity.registrationNumber" label="Business Registration No/local equivalent" value={entity.registrationNumber} onChange={(registrationNumber) => onChange({ registrationNumber })} field={field} />
      </div>
    </div>
  );
}

/** The three reasons the form prints for choosing "no TIN", which it asks for only where there is no TIN. */
function NoTinReasons({
  at,
  legend,
  held,
  onChange,
  field,
}: {
  at: string;
  /** The heading the form prints over these boxes, which reads differently in PART A and in PART D. */
  legend: string;
  held: Pick<TaxResidence, "tin" | "noTinReason" | "otherReason">;
  onChange: (patch: { noTinReason?: NoTinReason; otherReason?: string }) => void;
  field: FieldFor;
}) {
  if (held.tin.trim()) return null;
  return (
    <div className="sm:col-span-2">
      <Boxes legend={legend} error={field(`${at}.tin`).error}>
        {noTinReasons.map((reason) => (
          <Tick
            key={reason.value}
            kind="radio"
            name={`${at}.noTinReason`}
            id={`${at}.noTinReason.${reason.value}`}
            checked={held.noTinReason === reason.value}
            onChange={() => onChange({ noTinReason: reason.value })}
            text={reason.text}
            blank={
              reason.value === "OTHER"
                ? {
                    id: `${at}.otherReason`,
                    label: "Other reason, please specify",
                    value: held.otherReason,
                    onChange: (otherReason) => onChange({ otherReason }),
                    field,
                  }
                : undefined
            }
          />
        ))}
      </Boxes>
    </div>
  );
}

/** PART A – Tax Residence, and the three boxes the form prints under it. */
export function ResidenceStep({
  residence,
  formId,
  documents,
  onChange,
  field,
}: {
  residence: FatcaCrsEntity["residence"];
  formId: string;
  documents: FormDocuments;
  onChange: (patch: Partial<FatcaCrsEntity["residence"]>) => void;
  field: FieldFor;
}) {
  const rows = residence.jurisdictions;
  const provided = documents.files.filter((file) => file.field === CERTIFIED_COPY);
  const change = (at: number, patch: Partial<TaxResidence>) =>
    onChange({ jurisdictions: rows.map((row, which) => (which === at ? { ...row, ...patch } : row)) });

  return (
    <div className="space-y-6">
      {/* The form rules three rows here; a country is added as it is needed instead. */}
      <section className="space-y-4">
          <div className="flex justify-end">
            <Button variant="secondary" size="sm" disabled={rows.length >= MAX_ROWS} onClick={() => onChange({ jurisdictions: [...rows, emptyTaxResidence()] })}>
              <Plus aria-hidden="true" />
              Add a country
            </Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
          {rows.map((row, at) => (
            <FollowUp key={at} title={`Country ${at + 1}`}>
              <CountryField id={`residence.jurisdictions[${at}].country`} label="Country of residence for tax purposes" value={row.country} onChange={(country) => change(at, { country })} field={field} />
              <TextField id={`residence.jurisdictions[${at}].tin`} label="Tax Identification Number (TIN) or functional equivalent" value={row.tin} onChange={(tin) => change(at, { tin })} field={field} optional />
              <NoTinReasons at={`residence.jurisdictions[${at}]`} legend={NO_TIN_HEADING} held={row} onChange={(patch) => change(at, patch)} field={field} />
              {rows.length > 1 && (
                <div className="sm:col-span-2">
                  <IconButton label={`Remove country ${at + 1}`} tone="danger" onClick={() => onChange({ jurisdictions: rows.filter((_, which) => which !== at) })}>
                    <X />
                  </IconButton>
                </div>
              )}
            </FollowUp>
          ))}
          </div>
      </section>

      <div className="space-y-2">
        {residenceDeclarations.map((line) => (
          <Tick
            key={line.value}
            kind="checkbox"
            name={`residence.${line.value}`}
            id={`residence.${line.value}`}
            checked={residence[line.value]}
            onChange={(on) => onChange(line.value === "certifiedCopyProvided" ? { certifiedCopyProvided: on } : line.value === "notTaxResidentAnywhere" ? { notTaxResidentAnywhere: on } : { branchOfHeadOffice: on })}
            text={line.text}
            blank={
              // The form rules the place of effective management on this line, so that is where it is written.
              line.value === "notTaxResidentAnywhere"
                ? {
                    id: "residence.placeOfEffectiveManagement",
                    label: "Place of effective management",
                    value: residence.placeOfEffectiveManagement,
                    onChange: (placeOfEffectiveManagement) => onChange({ placeOfEffectiveManagement }),
                    field,
                  }
                : undefined
            }
          >
            {/* The line asks for the copy, so the copy itself is what answers it. */}
            {line.value === "certifiedCopyProvided" && residence.certifiedCopyProvided && (
              <Aside>
                <Documents
                  formId={formId}
                  field={CERTIFIED_COPY}
                  documents={documents}
                  label="Attach the certified true copy"
                />
                {field(CERTIFIED_COPY).error && provided.length === 0 && (
                  <p className="text-xs text-red-600">{field(CERTIFIED_COPY).error}</p>
                )}
              </Aside>
            )}
          </Tick>
        ))}
        {field("residence.placeOfEffectiveManagement").error && (
          <p className="text-xs text-red-600">{field("residence.placeOfEffectiveManagement").error}</p>
        )}
      </div>
    </div>
  );
}

/** PART B – Declaration of US FATCA. */
export function FatcaStep({
  value,
  onChange,
  field,
}: {
  value: FatcaCrsEntity;
  onChange: (patch: Partial<FatcaCrsEntity["fatca"]>) => void;
  field: FieldFor;
}) {
  const { fatca } = value;
  const chosen = fatcaStatusOf(value);
  return (
    <div className="space-y-6">
      <Boxes legend="1. US Person" required error={field("fatca.usPerson").error}>
        {usPersonOptions.map((option) => (
          <Tick
            key={option.value}
            kind="radio"
            name="fatca.usPerson"
            id={`fatca.usPerson.${option.value}`}
            checked={fatca.usPerson === (option.value === "yes")}
            onChange={() => onChange({ usPerson: option.value === "yes" })}
            text={option.text}
          />
        ))}
      </Boxes>

      {/* A US Person is sent straight to PART C by the line they tick, so nothing below it is asked of them. */}
      {fatca.usPerson === false && (
        <>
          <Boxes legend="2. Classification {Please tick appropriate option}">
            {registrationOptions.map((option) => (
              <Tick
                key={option.value}
                kind="checkbox"
                name={`fatca.registration.${option.value}`}
                id={`fatca.registration.${option.value}`}
                checked={fatca.registration === option.value}
                // The form prints two boxes and one entity; ticking one puts the other back.
                onChange={(on) => onChange({ registration: on ? (option.value as FatcaRegistration) : null, registeredGiin: "" })}
                text={option.text}
                blank={
                  option.value === "REGISTERED"
                    ? {
                        id: "fatca.registeredGiin",
                        label: "Global Intermediary Identification Number (GIIN)",
                        value: fatca.registeredGiin,
                        onChange: (registeredGiin) => onChange({ registeredGiin }),
                        field,
                      }
                    : undefined
                }
              />
            ))}
            {field("fatca.registeredGiin").error && (
              <p className="text-xs text-red-600">{field("fatca.registeredGiin").error}</p>
            )}
          </Boxes>

          <StatusPicker
            at="fatca"
            legend="2.1. FATCA Status"
            groups={fatcaGroups}
            status={fatca.status}
            onChange={(patch) => onChange({ ...patch, statusGiin: "" })}
            field={field}
            footer={
              <div className="space-y-3 rounded-2xl border border-line bg-white p-4 sm:p-5">
                <div>
                  <p className="text-sm font-semibold text-ink">{giinFootnotes.starred}</p>
                  <div className="mt-2">
                    <FootnoteBlank
                      id="fatca.statusGiin"
                      label={chosen?.footnote ?? giinFootnotes.starred}
                      value={fatca.statusGiin}
                      onChange={(statusGiin) => onChange({ statusGiin })}
                      field={field}
                    />
                  </div>
                </div>
                <div className="space-y-1 border-t border-line pt-3 text-sm leading-relaxed font-semibold text-ink">
                  {giinFootnotes.doubleStarred.map((note) => (
                    <p key={note}>{note}</p>
                  ))}
                </div>
              </div>
            }
          />
        </>
      )}
    </div>
  );
}

/** PART C – Declaration of CRS Classification. */
export function CrsStep({
  value,
  onChange,
  field,
}: {
  value: FatcaCrsEntity;
  onChange: (patch: Partial<FatcaCrsEntity["crs"]>) => void;
  field: FieldFor;
}) {
  const { crs } = value;
  const chosen = crsStatusOf(value);
  return (
    <div className="space-y-6">
      <StatusPicker
        at="crs"
        legend="Declaration of CRS Classification"
        hideLegend
        groups={crsGroups}
        status={crs.status}
        onChange={(patch) => onChange({ ...patch, specify: "" })}
        field={field}
        blankFor={(option) =>
          BLANK.test(option.text)
            ? {
                id: "crs.specify",
                label: "Please specify",
                value: crs.specify,
                onChange: (specify) => onChange({ specify }),
                field,
              }
            : undefined
        }
        footer={
          chosen && BLANK.test(chosen.text) && field("crs.specify").error ? (
            <p className="text-xs text-red-600">{field("crs.specify").error}</p>
          ) : undefined
        }
      />
    </div>
  );
}

/** PART D – Controlling Person, completed only where PART B or PART C says to complete it. */
export function ControllingPersonsStep({
  value,
  onChange,
  field,
}: {
  value: FatcaCrsEntity;
  onChange: (patch: Partial<Pick<FatcaCrsEntity, "controllingPersons">>) => void;
  field: FieldFor;
}) {
  const because = controllingPersonsBecause(value);
  const people = value.controllingPersons;
  const change = (at: number, patch: Partial<ControllingPerson>) =>
    onChange({ controllingPersons: people.map((row, which) => (which === at ? { ...row, ...patch } : row)) });
  const changeResidence = (at: number, row: number, patch: Partial<TaxResidence>) =>
    change(at, {
      taxResidences: people[at].taxResidences.map((held, which) => (which === row ? { ...held, ...patch } : held)),
    });

  if (!because) {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-line bg-slate-50/70 px-5 py-5">
        <CircleCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-emerald-600" />
        <div>
          <p className="text-sm font-semibold text-ink">Nothing to complete here</p>
          <p className="mt-1 text-sm text-ink-muted">
            Only complete this part if you are required under PART C. No box ticked in PART B or PART C says to
            complete it, so it opens by itself if one is.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Alert tone="info">A box ticked in {because} says to complete this part for the Controlling Person.</Alert>

      <FieldGroup
        title="1. Controlling Person Details"
        action={
          <Button variant="secondary" size="sm" disabled={people.length >= MAX_ROWS} onClick={() => onChange({ controllingPersons: [...people, emptyControllingPerson()] })}>
            <Plus aria-hidden="true" />
            Add a Controlling Person
          </Button>
        }
      >
        {people.map((person, at) => (
          <FollowUp key={at} title={`Controlling Person #${at + 1}`}>
            <TextField id={`controllingPersons[${at}].name`} label="Name" value={person.name} onChange={(name) => change(at, { name })} field={field} className="sm:col-span-2" />
            <TextField id={`controllingPersons[${at}].registeredAddress`} label="Registered Address" value={person.registeredAddress} onChange={(registeredAddress) => change(at, { registeredAddress })} field={field} multiline className="sm:col-span-2" />
            <TextField id={`controllingPersons[${at}].mailingAddress`} label="Mailing Address (if different from the above)" value={person.mailingAddress} onChange={(mailingAddress) => change(at, { mailingAddress })} field={field} multiline optional className="sm:col-span-2" />
            <DateField id={`controllingPersons[${at}].dateOfBirth`} label="Date of Birth" value={person.dateOfBirth} onChange={(dateOfBirth) => change(at, { dateOfBirth })} field={field} min={yearsFromToday(-120)} max={yearsFromToday(-18)} />
            <TextField id={`controllingPersons[${at}].placeOfBirth`} label="Place of Birth (City/Town and Country)" value={person.placeOfBirth} onChange={(placeOfBirth) => change(at, { placeOfBirth })} field={field} />

            {/* The form asks every Controlling Person for this in a table of its own; it is asked here instead. */}
            <div className="sm:col-span-2 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-ink">2. Tax Residence</p>
                  <p className="mt-0.5 text-xs text-ink-muted">All Controlling Persons have to complete this section</p>
                  <p className="text-xs text-ink-muted">
                    If you have multiple countries of tax residency, please list out all the relevant information below.
                  </p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={person.taxResidences.length >= MAX_ROWS}
                  onClick={() => change(at, { taxResidences: [...person.taxResidences, emptyTaxResidence()] })}
                >
                  <Plus aria-hidden="true" />
                  Add a country
                </Button>
              </div>
              {person.taxResidences.map((held, row) => (
                <FollowUp key={row} title={`Country ${row + 1}`}>
                  <CountryField id={`controllingPersons[${at}].taxResidences[${row}].country`} label="Country of residence for tax purposed" value={held.country} onChange={(country) => changeResidence(at, row, { country })} field={field} />
                  <TextField id={`controllingPersons[${at}].taxResidences[${row}].tin`} label="TIN" value={held.tin} onChange={(tin) => changeResidence(at, row, { tin })} field={field} optional />
                  <NoTinReasons at={`controllingPersons[${at}].taxResidences[${row}]`} legend={NO_TIN_HEADING_CONTROLLING_PERSON} held={held} onChange={(patch) => changeResidence(at, row, patch)} field={field} />
                  {person.taxResidences.length > 1 && (
                    <div className="sm:col-span-2">
                      <IconButton
                        label={`Remove country ${row + 1}`}
                        tone="danger"
                        onClick={() => change(at, { taxResidences: person.taxResidences.filter((_, which) => which !== row) })}
                      >
                        <X />
                      </IconButton>
                    </div>
                  )}
                </FollowUp>
              ))}
            </div>

            <div className="space-y-3 sm:col-span-2">
              <Boxes legend="Types of Controlling Person" required error={field(`controllingPersons[${at}].controlRole`).error}>
                {(Object.keys(controlRoles) as ControlOf[]).map((held) => (
                  <div key={held} className="rounded-xl border border-line bg-white p-3.5 sm:flex sm:items-start sm:gap-4">
                    <p className="text-sm font-semibold text-ink sm:w-44 sm:shrink-0">{controlRoles[held].heading}</p>
                    <div className="mt-2 flex flex-wrap gap-2 sm:mt-0">
                      {controlRoles[held].roles.map((role) => (
                        <label
                          key={role.value}
                          className={cn(
                            "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
                            person.controlRole === role.value
                              ? "border-primary-600 bg-primary-50/70 font-semibold text-ink"
                              : "border-line bg-white text-ink hover:border-primary-100",
                          )}
                        >
                          <input
                            type="radio"
                            name={`controllingPersons[${at}].controlRole`}
                            checked={person.controlRole === role.value}
                            // The box carries the row it is printed in, so ticking it answers both.
                            onChange={() => change(at, { controlOf: held, controlRole: role.value })}
                            className="size-3.5 accent-primary-600"
                          />
                          {role.text}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </Boxes>
            </div>

            {people.length > 1 && (
              <div className="sm:col-span-2">
                <IconButton label={`Remove Controlling Person #${at + 1}`} tone="danger" onClick={() => onChange({ controllingPersons: people.filter((_, which) => which !== at) })}>
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

/** PART E – Declaration & Signature. */
export function DeclarationStep({
  declaration,
  onChange,
  field,
}: {
  declaration: FatcaCrsEntity["declaration"];
  onChange: (patch: Partial<FatcaCrsEntity["declaration"]>) => void;
  field: FieldFor;
}) {
  const firmName = useFirmName();
  const signers = declaration.signers;
  const change = (at: number, patch: Partial<(typeof signers)[number]>) =>
    onChange({ signers: signers.map((row, which) => (which === at ? { ...row, ...patch } : row)) });
  const confirmed = field("declaration.confirmed");

  return (
    <div className="space-y-6">
      <div className="space-y-3 rounded-2xl border border-line bg-slate-50/70 px-5 py-5 text-sm leading-relaxed text-ink">
        {firmName ? (
          declarationWording.map((paragraph, at) => <p key={at}>{withFirm(paragraph, firmName)}</p>)
        ) : (
          <p className="text-ink-muted">Reading the declaration…</p>
        )}
      </div>

      <div>
        <Tick
          kind="checkbox"
          name="declaration.confirmed"
          id="declaration.confirmed"
          checked={declaration.confirmed}
          onChange={(on) => {
            onChange({ confirmed: on });
            confirmed.onBlur();
          }}
          text="The declaration above is made."
        />
        {confirmed.error && <p className="mt-1.5 text-xs text-red-600">{confirmed.error}</p>}
      </div>

      {/* The form rules this block three times over, for the Entity Account Holder and ALL Controlling Person(s). */}
      <FieldGroup
        title="The Entity Account Holder/ Controlling Person"
        action={
          <Button variant="secondary" size="sm" disabled={signers.length >= MAX_ROWS} onClick={() => onChange({ signers: [...signers, emptySigner()] })}>
            <Plus aria-hidden="true" />
            Add a signatory
          </Button>
        }
      >
        {signers.map((signer, at) => (
          <FollowUp key={at} title={`Signatory ${at + 1}`}>
            <TextField id={`declaration.signers[${at}].name`} label="Name" value={signer.name} onChange={(name) => change(at, { name })} field={field} />
            <TextField id={`declaration.signers[${at}].capacity`} label="Capacity" value={signer.capacity} onChange={(capacity) => change(at, { capacity })} field={field} />
            <SignatureField id={`declaration.signers[${at}].signature`} label="Signature" value={signer.signature} onChange={(signature) => change(at, { signature })} field={field} />
            <DateField id={`declaration.signers[${at}].signedOn`} label="Date" value={signer.signedOn} onChange={(signedOn) => change(at, { signedOn })} field={field} min={yearsFromToday(-2)} max={yearsFromToday(1)} />
            {signers.length > 1 && (
              <div className="sm:col-span-2">
                <IconButton label={`Remove signatory ${at + 1}`} tone="danger" onClick={() => onChange({ signers: signers.filter((_, which) => which !== at) })}>
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
