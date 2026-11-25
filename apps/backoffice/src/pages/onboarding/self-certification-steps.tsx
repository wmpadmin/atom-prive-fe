import { CountryField, DateField, TextField, type FieldFor } from "../../components/form-fields";
import { TITLES, type FormHolder, type HolderDetails } from "./application";
import { CertAddress, TaxTable } from "./entity-steps";
import { daysFromToday, Fields, RadioPills } from "./onboarding-steps";

/**
 * The CRS / FATCA Self-Certification Form for an individual (v. Oct 2025), one for each account holder whose details
 * are taken (25 Nov 2026), after the risk questionnaires. Its own paper, in the same look as the entity's: Part 1 box by
 * box, a line the Client Details form already asked coming filled in (it is the same answer), then Part 2. Part 3,
 * the declaration, is signed on the printed form. The API checks the same lines (OnboardingReview.java).
 */

interface HolderCertProps {
  index: number;
  holder: FormHolder;
  onChange: (patch: Partial<FormHolder>) => void;
  field: FieldFor;
}

/** A sub-heading as the paper sets its lettered parts off. */
function Sub({ children }: { children: string }) {
  return <p className="border-t border-line pt-4 text-xs font-semibold tracking-wider text-ink-muted uppercase sm:col-span-2">{children}</p>;
}

/** Part 1, Identification of Account Holder. */
function HolderCertIdentification({ index, holder, onChange, field }: HolderCertProps) {
  const at = `holders[${index}].`;
  const details = holder.details;
  const setDetails = (patch: Partial<HolderDetails>) => onChange({ details: { ...details, ...patch } });
  return (
    <Fields>
      <Sub>A) Name of the Individual Account Holder</Sub>
      <RadioPills name={`${at}details.title`} legend="Title" required columns="grid-cols-3 sm:grid-cols-5" className="sm:col-span-2" value={details.title}
        onChange={(title) => setDetails({ title })} error={field(`${at}details.title`).error} choices={TITLES.map((title) => ({ value: title, label: title }))} />
      <TextField id={`${at}surname`} label="Surname" value={holder.surname} onChange={(surname) => onChange({ surname })} field={field} />
      <TextField id={`${at}forenames`} label="First or Given Name" value={holder.forenames} onChange={(forenames) => onChange({ forenames })} field={field} />
      <TextField id={`${at}details.middleNames`} label="Middle Name(s)" value={details.middleNames} onChange={(middleNames) => setDetails({ middleNames })} field={field} optional />
      <DateField id={`${at}dateOfBirth`} label="B) Date of Birth" value={holder.dateOfBirth} onChange={(dateOfBirth) => onChange({ dateOfBirth })} field={field} min={new Date(1900, 0, 1)} max={daysFromToday(-1)} />
      <Sub>C) Place of Birth</Sub>
      <TextField id={`${at}details.placeOfBirth`} label="Town or City of Birth" value={details.placeOfBirth} onChange={(placeOfBirth) => setDetails({ placeOfBirth })} field={field} />
      <CountryField id={`${at}countryOfBirth`} label="Country/Jurisdiction of Birth" value={holder.countryOfBirth} onChange={(countryOfBirth) => onChange({ countryOfBirth })} field={field} />
      <Sub>D) Current Residence Address</Sub>
      <CertAddress at={`${at}residentialAddress.`} value={holder.residentialAddress} onChange={(residentialAddress) => onChange({ residentialAddress })} field={field} />
      <Sub>E) Mailing Address (complete only if different from Section D)</Sub>
      <CertAddress at={`${at}mailingAddress.`} value={holder.mailingAddress} onChange={(mailingAddress) => onChange({ mailingAddress })} field={field} optional />
    </Fields>
  );
}

/** Part 2, Tax Residence Information. */
function HolderCertTax({ index, holder, onChange, field }: HolderCertProps) {
  const details = holder.details;
  return (
    <TaxTable at={`holders[${index}].details.`} who="Account Holder" rows={details.taxResidences} explanation={details.noTinExplanation} field={field}
      onRows={(taxResidences) => onChange({ details: { ...details, taxResidences } })}
      onExplanation={(noTinExplanation) => onChange({ details: { ...details, noTinExplanation } })} />
  );
}

export const holderCertSteps = { identification: HolderCertIdentification, tax: HolderCertTax } as const;
