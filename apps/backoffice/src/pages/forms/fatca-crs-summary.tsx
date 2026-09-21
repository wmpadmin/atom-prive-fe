import type { AttachedFile } from "@atomprive/api-client/backoffice";
import { Button } from "@atomprive/ui";
import { PencilLine } from "lucide-react";
import type { ReactNode } from "react";
import { countryName } from "../../lib/countries";
import { formatDate, formatFileSize } from "../../lib/labels";
import {
  BLANK,
  CERTIFIED_COPY,
  controlRoles,
  controllingPersonsBecause,
  crsGroups,
  crsStatusOf,
  fatcaGroups,
  fatcaStatusOf,
  noTinReasons,
  registrationOptions,
  residenceDeclarations,
  type ControllingPerson,
  type FatcaCrsEntity,
  type StatusGroup,
  type TaxResidence,
} from "./fatca-crs";

const MISSING = "—";

function shown(value: string | null | undefined) {
  return value?.trim() ? value : MISSING;
}

function shownDate(value: string) {
  return value ? formatDate(value) : MISSING;
}

function shownCountry(code: string) {
  return code ? countryName(code) : MISSING;
}

/** A line as the form prints it, with whatever was written on its blank put in place of the rule. */
function written(text: string, filled: string) {
  return text.replace(BLANK, ` ${filled.trim() || MISSING} `).replace(/\s*\{|\}\s*/g, " ").trim();
}

function headingOf(groups: StatusGroup[], value: string | null) {
  return groups.find((group) => group.value === value)?.heading.replace(/\s*\{[^}]*\}/, "") ?? MISSING;
}

/** A TIN, or the reason the form asks for in its place. */
function taxNumber(held: Pick<TaxResidence, "tin" | "noTinReason" | "otherReason">) {
  if (held.tin.trim()) return held.tin;
  const reason = noTinReasons.find((one) => one.value === held.noTinReason);
  if (!reason) return MISSING;
  return written(reason.text, held.otherReason);
}

/** The type of controlling person, in the form's own two-part wording. */
function typeOfPerson(person: ControllingPerson) {
  if (!person.controlOf) return MISSING;
  const kind = controlRoles[person.controlOf];
  const role = kind.roles.find((one) => one.value === person.controlRole);
  return role ? `${kind.heading} ${role.text}` : kind.heading;
}

/** Everything entered, part by part, for the last look before submitting and for a finished form. */
export function FatcaCrsSummary({
  value,
  attachments,
  onEdit,
}: {
  value: FatcaCrsEntity;
  attachments: AttachedFile[];
  onEdit?: (stepId: string) => void;
}) {
  const { entity, residence, fatca, crs, declaration } = value;
  const fatcaChosen = fatcaStatusOf(value);
  const crsChosen = crsStatusOf(value);
  const because = controllingPersonsBecause(value);
  const registration = registrationOptions.find((one) => one.value === fatca.registration);
  const ticked = residenceDeclarations.filter((line) => residence[line.value]);

  return (
    <div className="space-y-5">
      <Part title="PART A – Entity Account Holder" stepId="entity" onEdit={onEdit}>
        <Fact label="Entity Name" value={shown(entity.name)} wide />
        <Fact label="Place of Incorporation" value={shown(entity.placeOfIncorporation)} />
        <Fact label="Business Registration No/local equivalent" value={shown(entity.registrationNumber)} />
        <Fact
          label="Registered Address"
          value={[entity.street, entity.town, entity.postalCode, shownCountry(entity.country)].filter(Boolean).join(", ")}
          wide
        />
        <Fact
          label="Mailing Address (if different from the Registered Address)"
          value={
            [entity.mailingStreet, entity.mailingTown, entity.mailingPostalCode, entity.mailingCountry && countryName(entity.mailingCountry)]
              .filter(Boolean)
              .join(", ") || MISSING
          }
          wide
        />
      </Part>

      <Part title="Tax Residence" stepId="residence" onEdit={onEdit}>
        {residence.notTaxResidentAnywhere ? (
          <Fact label="Place of effective management" value={shown(residence.placeOfEffectiveManagement)} wide />
        ) : (
          residence.jurisdictions.map((held, at) => (
            <Fact key={at} label={`Country ${at + 1}`} value={`${shownCountry(held.country)} · ${taxNumber(held)}`} wide />
          ))
        )}
        {ticked.map((line) => (
          <Fact
            key={line.value}
            label="Also ticked"
            wide
            value={
              line.value === "notTaxResidentAnywhere"
                ? written(line.text, residence.placeOfEffectiveManagement)
                : line.text
            }
          />
        ))}
        {residence.certifiedCopyProvided && (
          <Fact
            label="Certified true copy provided"
            wide
            value={
              attachments
                .filter((file) => file.field === CERTIFIED_COPY)
                .map((file) => `${file.fileName} (${formatFileSize(file.sizeBytes)})`)
                .join(" · ") || "Not attached yet"
            }
          />
        )}
      </Part>

      <Part title="PART B – Declaration of US FATCA" stepId="fatca" onEdit={onEdit}>
        <Fact
          label="1. US Person"
          value={
            fatca.usPerson === null
              ? MISSING
              : fatca.usPerson
                ? "The entity is a US Person pursuant to the FATCA regulation"
                : "The entity is NOT a US Person pursuant to the FATCA Regulation"
          }
          wide
        />
        {fatca.usPerson === false && (
          <>
            <Fact
              label="2. Classification"
              value={registration ? written(registration.text, fatca.registeredGiin) : "Neither box ticked"}
              wide
            />
            <Fact label="2.1. FATCA Status" value={headingOf(fatcaGroups, fatca.group)} />
            <Fact label="Ticked" value={fatcaChosen?.text ?? MISSING} />
            {fatcaChosen?.footnote && <Fact label={fatcaChosen.footnote} value={shown(fatca.statusGiin)} wide />}
          </>
        )}
      </Part>

      <Part title="PART C – Declaration of CRS Classification" stepId="crs" onEdit={onEdit}>
        <Fact label="Entity type" value={headingOf(crsGroups, crs.group)} />
        <Fact label="Ticked" value={crsChosen ? written(crsChosen.text, crs.specify) : MISSING} />
      </Part>

      <Part title="PART D – Controlling Person" stepId="controlling" onEdit={onEdit}>
        {because ? (
          <>
            <Fact label="Required by" value={`A box ticked in ${because}`} wide />
            {value.controllingPersons.map((person, at) => (
              <Fact
                key={at}
                label={`Controlling Person #${at + 1}`}
                wide
                value={[
                  shown(person.name),
                  `Born ${shownDate(person.dateOfBirth)}, ${shown(person.placeOfBirth)}`,
                  // Every country of tax residency the form says to list out, each with what stands for its TIN.
                  person.taxResidences.map((held) => `${shownCountry(held.country)} · ${taxNumber(held)}`).join("; "),
                  typeOfPerson(person),
                ].join(" · ")}
              />
            ))}
          </>
        ) : (
          <Fact label="Not required" value="No box ticked in PART B or PART C says to complete this part." wide />
        )}
      </Part>

      <Part title="PART E – Declaration & Signature" stepId="declaration" onEdit={onEdit}>
        <Fact label="Declaration made" value={declaration.confirmed ? "Yes" : "Not yet"} wide />
        {declaration.signers.map((signer, at) => (
          <Fact
            key={at}
            label={`The Entity Account Holder/ Controlling Person ${at + 1}`}
            wide
            value={[shown(signer.name), shown(signer.capacity), shown(signer.signature), shownDate(signer.signedOn)].join(" · ")}
          />
        ))}
      </Part>
    </div>
  );
}

function Part({
  title,
  stepId,
  onEdit,
  children,
}: {
  title: string;
  stepId: string;
  onEdit?: (stepId: string) => void;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-line">
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
        <h3 className="text-sm font-bold">{title}</h3>
        {onEdit && (
          <Button variant="ghost" size="sm" onClick={() => onEdit(stepId)}>
            <PencilLine aria-hidden="true" />
            Edit
          </Button>
        )}
      </div>
      <dl className="grid gap-4 px-5 py-4 sm:grid-cols-2">{children}</dl>
    </section>
  );
}

function Fact({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <dt className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">{label}</dt>
      <dd className="mt-0.5 text-sm break-words text-ink">{value}</dd>
    </div>
  );
}
