import type { AttachedFile } from "@atomprive/api-client/backoffice";
import { Button } from "@atomprive/ui";
import { PencilLine } from "lucide-react";
import type { ReactNode } from "react";
import { AttachedFiles } from "../../components/attached-files";
import { countryName } from "../../lib/countries";
import { formatDate } from "../../lib/labels";
import type { FormAddress } from "./account-opening-entity";
import {
  MANDATORY_DOCUMENTS,
  documentField,
  holderTitles,
  occupations,
  signingMandateLabels,
  type AccountHolder,
  type AccountOpeningIndividual,
} from "./account-opening-individual";
import { signatureText } from "./made-signature";

const MISSING = "—";

function shown(value: string | null | undefined) {
  return value?.trim() ? value : MISSING;
}

function place(code: string | null) {
  return code ? countryName(code) : MISSING;
}

function wholeAddress(address: FormAddress) {
  const parts = [address.line1, address.line2, address.city, address.state, address.postalCode, address.country ? countryName(address.country) : null];
  const said = parts.filter((part) => part?.trim()).join(", ");
  return said || MISSING;
}

/** Everything the individual account opening form asks for, as it was answered. */
export function AccountOpeningIndividualSummary({
  value,
  attachments,
  formId,
  onEdit,
}: {
  value: AccountOpeningIndividual;
  attachments: AttachedFile[];
  formId: string;
  onEdit?: (stepId: string) => void;
}) {
  const declarations = value.declarations;
  return (
    <div className="space-y-5">
      {value.holders.map((holder, at) => (
        <Part key={at} title={`Account holder ${at + 1}`} stepId={at === 0 ? "holder1" : "holder2"} onEdit={onEdit}>
          <Holder holder={holder} at={at} attachments={attachments} formId={formId} />
        </Part>
      ))}

      <Part title="Mailing instructions" stepId="mailing" onEdit={onEdit}>
        <dl className="grid gap-3 sm:grid-cols-2">
          <Fact label="Mailing address" value={wholeAddress(value.mailing.address)} wide />
          <Fact label="Secondary mailing address" value={wholeAddress(value.mailing.secondary)} wide />
        </dl>
      </Part>

      <Part title="Request to open account" stepId="declarations" onEdit={onEdit}>
        <dl className="grid gap-3 sm:grid-cols-2">
          <Fact
            label="Signing mandate"
            value={
              declarations.signingMandate === "OTHER"
                ? shown(declarations.signingMandateOther)
                : declarations.signingMandate
                  ? signingMandateLabels[declarations.signingMandate]
                  : MISSING
            }
          />
          <Fact label="Date of application" value={declarations.appliedOn ? formatDate(declarations.appliedOn) : MISSING} />
          {declarations.signers.map((signer, at) => (
            <Fact
              key={at}
              label={at === 0 ? "First account holder" : "Second account holder"}
              value={`${shown(signer.fullName)} · ${signatureText(shown(signer.signature))}`}
              wide
            />
          ))}
        </dl>
      </Part>
    </div>
  );
}

function Holder({ holder, at, attachments, formId }: { holder: AccountHolder; at: number; attachments: AttachedFile[]; formId: string }) {
  const title = holderTitles.find((one) => one.value === holder.title);
  const occupation = occupations.find((one) => one.value === holder.occupation);
  return (
    <>
      <dl className="grid gap-3 sm:grid-cols-2">
        <Fact label="Name in full" value={`${title ? `${title.text} ` : ""}${shown(holder.fullName)}`} wide />
        <Fact label="Forename(s)" value={shown(holder.forenames)} />
        <Fact label="Surname" value={shown(holder.surname)} />
        {at > 0 && <Fact label="Relationship with A/c Holder 1" value={shown(holder.relationshipToFirst)} wide />}
        <Fact label="NRIC / Passport number" value={shown(holder.passportNumber)} />
        <Fact label="Nationality" value={place(holder.nationality)} />
        <Fact label="Country of birth" value={place(holder.countryOfBirth)} />
        <Fact
          label="Other nationality held"
          value={
            holder.otherNationalityHeld === null
              ? MISSING
              : holder.otherNationalityHeld
                ? `Yes · ${place(holder.otherNationalityCountry)} · ${shown(holder.otherPassportNumber)}`
                : "No"
          }
        />
        <Fact
          label="Occupation"
          value={holder.occupation === "OTHER" ? shown(holder.occupationOther) : (occupation?.text ?? MISSING)}
          wide
        />
        {holder.occupation === "SALARIED" && (
          <Fact label="Employer" value={`${shown(holder.employerName)} · ${place(holder.employerCountry)} · ${shown(holder.positionHeld)}`} wide />
        )}
        {holder.occupation === "BUSINESS_OWNER" && (
          <Fact
            label="Business"
            value={`${shown(holder.companyName)} · ${place(holder.companyCountry)} · ${shown(holder.entityType)} · ${shown(holder.natureOfBusiness)}`}
            wide
          />
        )}
        <Fact label="Phone" value={shown(holder.phone)} />
        <Fact label="Email" value={shown(holder.email)} />
        <Fact label="Residential address" value={wholeAddress(holder.address)} wide />
      </dl>
      <ul className="mt-3 space-y-1">
        {MANDATORY_DOCUMENTS.map((document) => {
          const held = attachments.filter((file) => file.field === documentField(`holders[${at}]`, document));
          return (
            <li key={document} className="text-sm text-ink-muted">
              {document}: <AttachedFiles formId={formId} files={held} nothing="not attached yet" />
            </li>
          );
        })}
      </ul>
    </>
  );
}

function Part({ title, stepId, onEdit, children }: { title: string; stepId: string; onEdit?: (stepId: string) => void; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-white p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold text-ink">{title}</h3>
        {onEdit && (
          <Button variant="ghost" size="sm" onClick={() => onEdit(stepId)}>
            <PencilLine aria-hidden="true" />
            Edit
          </Button>
        )}
      </div>
      {children}
    </section>
  );
}

function Fact({ label, value, wide }: { label: string; value: ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <dt className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">{label}</dt>
      <dd className="mt-0.5 text-sm text-ink">{value}</dd>
    </div>
  );
}
