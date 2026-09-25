import { Button } from "@atomprive/ui";
import { PencilLine } from "lucide-react";
import type { ReactNode } from "react";
import { countryName } from "../../lib/countries";
import { formatDate } from "../../lib/labels";
import {
  declarationWording,
  organisationTypeLabels,
  BLANK,
  personTitles,
  signingMandateLabels,
  type AccountOpeningEntity,
  type FormAddress,
  type FormPerson,
  type PersonTitle,
} from "./account-opening-entity";
import { signatureText } from "./made-signature";

const MISSING = "—";

/** A line the form rules a blank in, printed back with what was written on it. */
function written(text: string, filled: string) {
  return text.replace(BLANK, ` ${filled.trim() || MISSING} `).replace(/\s+/g, " ").trim();
}

/** The title the form prints beside the name, as the form prints it. */
function titleOf(value: PersonTitle) {
  return personTitles.find((option) => option.value === value)?.text ?? "";
}

function shown(value: string | null | undefined) {
  return value?.trim() ? value : MISSING;
}

function shownDate(value: string) {
  return value ? formatDate(value) : MISSING;
}

function shownCountry(code: string | null) {
  return code ? countryName(code) : MISSING;
}

function oneLine(address: FormAddress) {
  const parts = [address.line1, address.line2, address.city, address.state, address.postalCode, address.country ? countryName(address.country) : null];
  const written = parts.filter((part) => part?.trim());
  return written.length > 0 ? written.join(", ") : MISSING;
}

/** Everything entered, section by section, for the last look before submitting and for a finished form. */
export function AccountOpeningSummary({ value, onEdit }: { value: AccountOpeningEntity; onEdit?: (stepId: string) => void }) {
  const { entity, declarations } = value;
  return (
    <div className="space-y-5">
      <Part title="Entity details" stepId="entity" onEdit={onEdit}>
        <Fact label="Full legal name" value={shown(entity.legalName)} />
        <Fact label="Country of incorporation" value={shownCountry(entity.countryOfIncorporation)} />
        <Fact label="Date of incorporation" value={shownDate(entity.dateOfIncorporation)} />
        <Fact label="Registration number" value={shown(entity.registrationNumber)} />
        <Fact label="Nature of business" value={shown(entity.natureOfBusiness)} wide />
        <Fact
          label="Countries it does business with"
          value={entity.businessLinkCountries.length > 0 ? entity.businessLinkCountries.map(countryName).join(", ") : MISSING}
          wide
        />
        <Fact
          label="Type of Organisation"
          value={
            entity.organisationType
              ? written(organisationTypeLabels[entity.organisationType], entity.organisationTypeOther)
              : MISSING
          }
        />
        {entity.organisationType === "OTHER" && <Fact label="Which kind" value={shown(entity.organisationTypeOther)} />}
        <Fact label="Regulated" value={entity.regulated === null ? MISSING : entity.regulated ? "Yes" : "No"} />
        {entity.regulated === true && <Fact label="Regulator" value={shown(entity.regulatorName)} />}
      </Part>

      <Part title="Registered address" stepId="address" onEdit={onEdit}>
        <Fact label="Address" value={oneLine(value.registeredAddress)} wide />
      </Part>

      <People title="Authorised signatories" stepId="signatories" people={value.signatories} onEdit={onEdit} />
      <People title="Beneficial owners" stepId="owners" people={value.beneficialOwners} onEdit={onEdit} />
      <People title="Directors" stepId="directors" people={value.directors} onEdit={onEdit} />

      <Part title="Declarations & signing mandate" stepId="declarations" onEdit={onEdit}>
        {declarationWording.map((declaration) => (
          <Fact key={declaration.id} label={declaration.text} value={declarations[declaration.id] === true ? "Agreed" : "Not agreed"} />
        ))}
        <Fact
          label="Signing mandate (if applicable)"
          value={
            declarations.signingMandate
              ? written(signingMandateLabels[declarations.signingMandate], declarations.signingMandateOther)
              : MISSING
          }
        />
        {declarations.signers.map((signer, at) => (
          <Fact
            key={at}
            label={`Authorised Signatory ${at + 1}`}
            wide
            value={`${shown(signer.fullName)} · ${signatureText(shown(signer.signature))} · ${shownDate(signer.signedOn)}`}
          />
        ))}
      </Part>
    </div>
  );
}

function People({ title, stepId, people, onEdit }: { title: string; stepId: string; people: FormPerson[]; onEdit?: (stepId: string) => void }) {
  return (
    <Part title={title} stepId={stepId} onEdit={onEdit}>
      {people.map((person, at) => (
        <Fact
          key={at}
          label={[person.title ? titleOf(person.title) : "", shown(person.fullName)].filter(Boolean).join(" ")}
          wide
          value={`${shown(person.passportNumber)} · ${shownCountry(person.nationality)} · born ${shownDate(person.dateOfBirth)} · ${shown(person.occupation)} · ${shown(person.email)} · ${oneLine(person.address)}`}
        />
      ))}
    </Part>
  );
}

function Part({ title, stepId, onEdit, children }: { title: string; stepId: string; onEdit?: (stepId: string) => void; children: ReactNode }) {
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
