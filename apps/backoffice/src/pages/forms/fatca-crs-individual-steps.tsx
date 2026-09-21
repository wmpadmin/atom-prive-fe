import { Alert, Button, IconButton } from "@atomprive/ui";
import { Plus, X } from "lucide-react";
import type { ReactNode } from "react";
import { Boxes, Tick } from "../../components/form-boxes";
import {
  CountryField,
  DateField,
  FollowUp,
  FormSection as FieldGroup,
  TextField,
  type FieldFor,
} from "../../components/form-fields";
import {
  CAPACITY_NOTE,
  COMPLETE_ALL_PARTS,
  FORM_TITLE,
  JOINT_HOLDERS_NOTE,
  NOT_FOR_ENTITIES,
  ONLY_TAX_RESIDENT,
  preamble,
  REASON_B_EXPLANATION,
  TABLE_A_HEADINGS,
  WHY_NOT_ONLY_RESIDENT,
  declarationWording,
  emptyJurisdiction,
  holderTitles,
  noTinReasons,
  usPersonStatements,
  type FatcaCrsIndividual,
  type HolderAddress,
  type HolderTitle,
  type Jurisdiction,
  type NoTinReason,
} from "./fatca-crs-individual";
import { useFirmName } from "./firm-name";

/** The form rules four rows in Table A and says to use a separate sheet beyond three countries. */
const MAX_ROWS = 4;

function yearsFromToday(years: number) {
  const today = new Date();
  return new Date(today.getFullYear() + years, today.getMonth(), today.getDate());
}

/** The firm's own name, which the form prints through its declaration and its CRS residence statement. */
function withFirm(text: string, firmName: string | null) {
  return firmName ? text.replaceAll("{{firmName}}", firmName) : text;
}

/** Something the portal keeps against one of the form's lines, set apart from the line itself. */
function Aside({ children }: { children: ReactNode }) {
  return <div className="space-y-2 border-t border-primary-100 px-3.5 py-3">{children}</div>;
}

/** One of the form's notes, set apart the way the rest of the pack sets a note apart. */
function Note({ children }: { children: ReactNode }) {
  return <Alert tone="info">{children}</Alert>;
}

/** The four address lines this form rules, wherever it rules them. */
function AddressLines({
  at,
  value,
  onChange,
  field,
  optional,
}: {
  at: string;
  value: HolderAddress;
  onChange: (address: HolderAddress) => void;
  field: FieldFor;
  optional?: boolean;
}) {
  const set = (patch: Partial<HolderAddress>) => onChange({ ...value, ...patch });
  return (
    <>
      <TextField
        id={`${at}.street`}
        label="House/Apartment, Number, Street"
        value={value.street}
        onChange={(street) => set({ street })}
        field={field}
        optional={optional}
        className="sm:col-span-2"
      />
      <TextField id={`${at}.town`} label="Town/City" value={value.town} onChange={(town) => set({ town })} field={field} optional={optional} />
      <CountryField id={`${at}.country`} label="Country" value={value.country} onChange={(country) => set({ country })} field={field} optional={optional} />
      {/* The paper rules the line; not every jurisdiction issues something to write on it. */}
      <TextField id={`${at}.postalCode`} label="Postal/ Zip Code" value={value.postalCode} onChange={(postalCode) => set({ postalCode })} field={field} optional />
    </>
  );
}

/**
 * What the form says about itself before PART 1: the shaded box it opens with, which says who this form is not
 * for, and the two questions it asks and answers. It is the first thing on the paper, so it is the first thing
 * here.
 */
function Preamble() {
  return (
    <div className="space-y-4">
      <div className="space-y-2 rounded-2xl bg-slate-100 px-5 py-4 text-center">
        <p className="text-sm font-bold text-ink">{FORM_TITLE}</p>
        <p className="text-sm leading-relaxed text-ink">{NOT_FOR_ENTITIES}</p>
      </div>
      {preamble.map((part) => (
        <div key={part.heading} className="space-y-2">
          <p className="text-sm font-bold text-ink">{part.heading}</p>
          {part.paragraphs.map((paragraph, at) => (
            <p key={at} className="text-sm leading-relaxed text-ink-muted">
              {paragraph}
            </p>
          ))}
        </div>
      ))}
      <p className="text-sm leading-relaxed font-semibold text-ink italic">{COMPLETE_ALL_PARTS}</p>
    </div>
  );
}

/** PART 1: Identification of Account Holder (in BLOCK CAPITALS). */
export function HolderStep({
  holder,
  onChange,
  field,
}: {
  holder: FatcaCrsIndividual["holder"];
  onChange: (patch: Partial<FatcaCrsIndividual["holder"]>) => void;
  field: FieldFor;
}) {
  const title = field("holder.title");
  return (
    <div className="space-y-6">
      <Preamble />

      <Boxes legend="Title" required error={title.error} inline>
        {holderTitles.map((one) => (
          <Tick
            key={one.value}
            kind="radio"
            name="holder.title"
            id={`holder.title.${one.value}`}
            checked={holder.title === one.value}
            onChange={() => {
              onChange({ title: one.value as HolderTitle });
              title.onBlur();
            }}
            text={one.text}
          />
        ))}
      </Boxes>

      <FieldGroup>
        <TextField id="holder.surname" label="Family Name/ Surname" value={holder.surname} onChange={(surname) => onChange({ surname })} field={field} />
        <TextField id="holder.firstName" label="First Name" value={holder.firstName} onChange={(firstName) => onChange({ firstName })} field={field} />
        {/* Only those who have one give one. */}
        <TextField id="holder.middleName" label="Middle Name" value={holder.middleName} onChange={(middleName) => onChange({ middleName })} field={field} optional />
        <DateField
          id="holder.dateOfBirth"
          label="Date of Birth"
          value={holder.dateOfBirth}
          onChange={(dateOfBirth) => onChange({ dateOfBirth })}
          field={field}
          min={yearsFromToday(-120)}
          max={yearsFromToday(0)}
        />
        <TextField id="holder.placeOfBirth" label="Place of Birth" value={holder.placeOfBirth} onChange={(placeOfBirth) => onChange({ placeOfBirth })} field={field} className="sm:col-span-2" />
      </FieldGroup>

      <FieldGroup title="Current Residential Address">
        <AddressLines at="holder.residential" value={holder.residential} onChange={(residential) => onChange({ residential })} field={field} />
      </FieldGroup>

      <FieldGroup
        title="Mailing Address"
        description="Please complete only if different from Residential Address"
      >
        <AddressLines at="holder.mailing" value={holder.mailing} onChange={(mailing) => onChange({ mailing })} field={field} optional />
      </FieldGroup>
    </div>
  );
}

/** PART 2: Jurisdiction of Residency for Tax Purposes (CRS) (in BLOCK CAPITALS). */
export function ResidenceStep({
  residence,
  onChange,
  field,
}: {
  residence: FatcaCrsIndividual["residence"];
  onChange: (patch: Partial<FatcaCrsIndividual["residence"]>) => void;
  field: FieldFor;
}) {
  const firmName = useFirmName();
  const rows = residence.jurisdictions;
  const only = field("residence.onlyTaxResidentListed");
  const change = (at: number, patch: Partial<Jurisdiction>) =>
    onChange({ jurisdictions: rows.map((row, which) => (which === at ? { ...row, ...patch } : row)) });

  return (
    <div className="space-y-6">
      {/* The three reasons the form sets out under Table A, as it prints them. The table's last column asks for
          the letter, so each country below is given the letter rather than the sentence again. */}
      <div className="space-y-2 rounded-2xl border border-line bg-slate-50/70 px-5 py-4">
        <p className="text-sm leading-relaxed text-ink">
          If the Account Holder is tax resident in more than three countries/jurisdictions, please use a separate
          sheet. If a TIN is unavailable please provide the appropriate reason A, B or C:
        </p>
        <ul className="space-y-1.5">
          {noTinReasons.map((reason) => (
            <li key={reason.value} className="text-sm leading-relaxed text-ink-muted">
              {reason.text}
            </li>
          ))}
        </ul>
      </div>

      <section className="space-y-4">
        <div className="flex items-end justify-between gap-2">
          <h3 className="text-sm font-bold text-ink">Table A</h3>
          <Button
            variant="secondary"
            size="sm"
            disabled={rows.length >= MAX_ROWS}
            onClick={() => onChange({ jurisdictions: [...rows, emptyJurisdiction()] })}
          >
            <Plus aria-hidden="true" />
            Add a country
          </Button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {rows.map((row, at) => {
            const reason = field(`residence.jurisdictions[${at}].noTinReason`);
            return (
              <FollowUp key={at} title={`${at + 1}`}>
                <CountryField
                  id={`residence.jurisdictions[${at}].country`}
                  label={TABLE_A_HEADINGS.country}
                  value={row.country}
                  onChange={(country) => change(at, { country })}
                  field={field}
                  className="sm:col-span-2"
                />
                <TextField
                  id={`residence.jurisdictions[${at}].tin`}
                  label={TABLE_A_HEADINGS.tin}
                  value={row.tin}
                  onChange={(tin) => change(at, { tin })}
                  field={field}
                  optional
                  className="sm:col-span-2"
                />
                <div className="sm:col-span-2">
                  <Boxes legend={TABLE_A_HEADINGS.reason} error={reason.error} inline>
                    {noTinReasons.map((one) => (
                      <Tick
                        key={one.value}
                        kind="radio"
                        name={`residence.jurisdictions[${at}].noTinReason`}
                        id={`residence.jurisdictions[${at}].noTinReason.${one.value}`}
                        checked={row.noTinReason === one.value}
                        onChange={() => {
                          change(at, { noTinReason: one.value as NoTinReason });
                          reason.onBlur();
                        }}
                        text={`Reason ${one.value}`}
                      />
                    ))}
                  </Boxes>
                </div>
                {row.noTinReason === "B" && (
                  <TextField
                    id={`residence.jurisdictions[${at}].explanation`}
                    label={REASON_B_EXPLANATION}
                    value={row.explanation}
                    onChange={(explanation) => change(at, { explanation })}
                    field={field}
                    multiline
                    className="sm:col-span-2"
                  />
                )}
                {rows.length > 1 && (
                  <div className="sm:col-span-2">
                    <IconButton
                      label={`Remove country ${at + 1}`}
                      tone="danger"
                      onClick={() => onChange({ jurisdictions: rows.filter((_, which) => which !== at) })}
                    >
                      <X />
                    </IconButton>
                  </div>
                )}
              </FollowUp>
            );
          })}
        </div>
      </section>

      <Boxes legend={withFirm(ONLY_TAX_RESIDENT, firmName)} required error={only.error} inline>
        {[
          { value: true, text: "Yes" },
          { value: false, text: "No" },
        ].map((one) => (
          <Tick
            key={String(one.value)}
            kind="radio"
            name="residence.onlyTaxResidentListed"
            id={`residence.onlyTaxResidentListed.${one.value}`}
            checked={residence.onlyTaxResidentListed === one.value}
            onChange={() => {
              onChange(
                one.value
                  ? { onlyTaxResidentListed: true, otherResidenceReason: "" }
                  : { onlyTaxResidentListed: false },
              );
              only.onBlur();
            }}
            text={one.text}
          />
        ))}
      </Boxes>

      <FieldGroup>
        <TextField
          id="residence.otherResidenceReason"
          label={WHY_NOT_ONLY_RESIDENT}
          value={residence.otherResidenceReason}
          onChange={(otherResidenceReason) => onChange({ otherResidenceReason })}
          field={field}
          multiline
          disabled={residence.onlyTaxResidentListed !== false}
          className="sm:col-span-2"
        />
      </FieldGroup>
    </div>
  );
}

/** PART 3: Jurisdiction of Citizenship (U.S.FATCA) ( in Block Capitals). */
export function CitizenshipStep({
  fatca,
  onChange,
  field,
}: {
  fatca: FatcaCrsIndividual["fatca"];
  onChange: (patch: Partial<FatcaCrsIndividual["fatca"]>) => void;
  field: FieldFor;
}) {
  const chosen = field("fatca.usPerson");
  return (
    <Boxes legend="Jurisdiction of Citizenship (U.S.FATCA)" hideLegend required error={chosen.error}>
      {usPersonStatements.map((statement) => (
        <Tick
          key={String(statement.value)}
          kind="radio"
          name="fatca.usPerson"
          id={`fatca.usPerson.${statement.value}`}
          checked={fatca.usPerson === statement.value}
          onChange={() => {
            // The number belongs to the first statement, so it is taken back when the other one is ticked.
            onChange(statement.value ? { usPerson: true } : { usPerson: false, usTin: "" });
            chosen.onBlur();
          }}
          text={statement.text}
        >
          {statement.value === true && fatca.usPerson === true && (
            <Aside>
              <TextField
                id="fatca.usTin"
                label="U.S. Taxpayer Identification Number"
                value={fatca.usTin}
                onChange={(usTin) => onChange({ usTin })}
                field={field}
              />
            </Aside>
          )}
        </Tick>
      ))}
    </Boxes>
  );
}

/** PART 4: Declaration and Signature (in BLOCK CAPITALS). */
export function DeclarationStep({
  declaration,
  onChange,
  field,
}: {
  declaration: FatcaCrsIndividual["declaration"];
  onChange: (patch: Partial<FatcaCrsIndividual["declaration"]>) => void;
  field: FieldFor;
}) {
  const firmName = useFirmName();
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

      <Note>{JOINT_HOLDERS_NOTE}</Note>

      <FieldGroup>
        <TextField id="declaration.printName" label="Print Name" value={declaration.printName} onChange={(printName) => onChange({ printName })} field={field} />
        <TextField id="declaration.signature" label="Signature" value={declaration.signature} onChange={(signature) => onChange({ signature })} field={field} placeholder="Type the full name" />
        <DateField
          id="declaration.signedOn"
          label="Date"
          value={declaration.signedOn}
          onChange={(signedOn) => onChange({ signedOn })}
          field={field}
          min={yearsFromToday(-2)}
          max={yearsFromToday(1)}
        />
      </FieldGroup>

      <Note>{CAPACITY_NOTE}</Note>

      <FieldGroup>
        {/* The line below the note, which only someone signing for the Account Holder fills in. */}
        <TextField id="declaration.capacity" label="Capacity" value={declaration.capacity} onChange={(capacity) => onChange({ capacity })} field={field} optional />
      </FieldGroup>
    </div>
  );
}
