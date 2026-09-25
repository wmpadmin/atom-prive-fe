import { Button } from "@atomprive/ui";
import { PencilLine } from "lucide-react";
import type { ReactNode } from "react";
import { countryName } from "../../lib/countries";
import { formatDate } from "../../lib/labels";
import {
  holderTitles,
  named,
  type FatcaCrsIndividual,
  type HolderAddress,
  type HolderDeclaration,
} from "./fatca-crs-individual";
import { signatureText } from "./made-signature";

const MISSING = "—";

function shown(value: string | null | undefined) {
  return value?.trim() ? value : MISSING;
}

function place(code: string) {
  return code ? countryName(code) : MISSING;
}

function wholeAddress(address: HolderAddress) {
  const said = [address.street, address.town, address.postalCode, address.country ? countryName(address.country) : null]
    .filter((part) => part?.trim())
    .join(", ");
  return said || MISSING;
}

/** Everything the individual self-certification asks for, as it was answered. */
export function FatcaCrsIndividualSummary({
  value,
  onEdit,
}: {
  value: FatcaCrsIndividual;
  onEdit?: (stepId: string) => void;
}) {
  const alone = value.holders.length === 1;
  return (
    <div className="space-y-8">
      {value.holders.map((held, at) => (
        <div key={at} className="space-y-5">
          {!alone && (
            <h2 className="text-sm font-bold tracking-wider text-ink-muted uppercase">
              Account holder {at + 1} — {named(held.holder, at)}
            </h2>
          )}
          <OneHolder held={held} where={`holders[${at}]`} onEdit={onEdit} />
        </div>
      ))}
    </div>
  );
}

function OneHolder({
  held,
  where,
  onEdit,
}: {
  held: HolderDeclaration;
  where: string;
  onEdit?: (stepId: string) => void;
}) {
  const { holder, residence, fatca, declaration } = held;
  const title = holderTitles.find((one) => one.value === holder.title);
  return (
    <div className="space-y-5">
      <Part title="PART 1 – Identification of Account Holder" stepId={`${where}.holder`} onEdit={onEdit}>
        <dl className="grid gap-3 sm:grid-cols-2">
          <Fact label="Family Name/ Surname" value={`${title ? `${title.text} ` : ""}${shown(holder.surname)}`} />
          <Fact label="First Name" value={shown(holder.firstName)} />
          <Fact label="Middle Name" value={shown(holder.middleName)} />
          <Fact label="Date of Birth" value={holder.dateOfBirth ? formatDate(holder.dateOfBirth) : MISSING} />
          <Fact label="Place of Birth" value={shown(holder.placeOfBirth)} />
          <Fact label="Current Residential Address" value={wholeAddress(holder.residential)} wide />
          <Fact label="Mailing Address" value={wholeAddress(holder.mailing)} wide />
        </dl>
      </Part>

      <Part title="PART 2 – Jurisdiction of Residency for Tax Purposes" stepId={`${where}.residence`} onEdit={onEdit}>
        <ul className="mb-3 space-y-1">
          {residence.jurisdictions.map((row, at) => (
            <li key={at} className="text-sm text-ink">
              {at + 1}. {place(row.country)} ·{" "}
              {row.tin.trim() ? row.tin : row.noTinReason ? `No TIN — Reason ${row.noTinReason}` : MISSING}
              {row.noTinReason === "B" && row.explanation.trim() ? ` · ${row.explanation}` : ""}
            </li>
          ))}
        </ul>
        <dl className="grid gap-3 sm:grid-cols-2">
          <Fact
            label="Tax resident ONLY in the jurisdictions listed above"
            value={residence.onlyTaxResidentListed === null ? MISSING : residence.onlyTaxResidentListed ? "Yes" : "No"}
          />
          {residence.onlyTaxResidentListed === false && (
            <Fact label="Reason given" value={shown(residence.otherResidenceReason)} />
          )}
        </dl>
      </Part>

      <Part title="PART 3 – Jurisdiction of Citizenship" stepId={`${where}.fatca`} onEdit={onEdit}>
        <dl className="grid gap-3 sm:grid-cols-2">
          <Fact
            label="U.S. Person for tax purposes"
            value={fatca.usPerson === null ? MISSING : fatca.usPerson ? "Yes" : "No"}
          />
          {fatca.usPerson === true && <Fact label="U.S. Taxpayer Identification Number" value={shown(fatca.usTin)} />}
        </dl>
      </Part>

      <Part title="PART 4 – Declaration and Signature" stepId={`${where}.declaration`} onEdit={onEdit}>
        <dl className="grid gap-3 sm:grid-cols-2">
          <Fact label="Declaration" value={declaration.confirmed ? "Made" : "Not yet made"} />
          <Fact label="Print Name" value={shown(declaration.printName)} />
          <Fact label="Signature" value={signatureText(shown(declaration.signature))} />
          <Fact label="Date" value={declaration.signedOn ? formatDate(declaration.signedOn) : MISSING} />
          <Fact label="Capacity" value={shown(declaration.capacity)} wide />
        </dl>
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
    <section className="rounded-2xl border border-line p-5">
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

function Fact({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <dt className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">{label}</dt>
      <dd className="mt-0.5 text-sm text-ink">{value}</dd>
    </div>
  );
}
