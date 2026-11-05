import { Button } from "@atomprive/ui";
import { PencilLine } from "lucide-react";
import { Written } from "../../components/form-boxes";
import { FormSection as FieldGroup, TextField, type FieldFor } from "../../components/form-fields";
import { NAME_OF_THE_FIRM } from "./customer-due-diligence";
import { SharedDueDiligenceSummary } from "./customer-due-diligence-summary";
import {
  customerLines,
  type CustomerDetails,
  type DueDiligenceIndividual,
} from "./customer-due-diligence-individual";

/** SECTION 1's details table, which asks about a person where the entity's copy asks about a company. */
export function CustomerDetailsStep({
  customer,
  onChange,
  field,
}: {
  customer: CustomerDetails;
  onChange: (patch: Partial<CustomerDetails>) => void;
  field: FieldFor;
}) {
  return (
    <div className="space-y-6">
      {/* The form rules a line for the firm's own name at its head; every line below calls it "the Firm". */}
      <div className="text-sm leading-relaxed font-semibold text-ink">
        <Written
          text={NAME_OF_THE_FIRM}
          blank={{
            id: "customer.firmName",
            label: "Name of the Firm",
            value: customer.firmName,
            onChange: (firmName) => onChange({ firmName }),
            field,
          }}
        />
        {field("customer.firmName").error && (
          <p className="mt-1.5 text-xs text-red-600">{field("customer.firmName").error}</p>
        )}
      </div>

      <FieldGroup>
        {customerLines.map((line) => (
          <TextField
            key={line.id}
            id={`customer.${line.id}`}
            label={line.label}
            value={customer[line.id]}
            onChange={(said) => onChange({ [line.id]: said } as Partial<CustomerDetails>)}
            field={field}
            multiline={"multiline" in line && line.multiline}
            optional={"optional" in line && line.optional}
            className="sm:col-span-2"
          />
        ))}
      </FieldGroup>
    </div>
  );
}

/** Everything the individual's copy of the form asks for, as it was answered. */
export function DueDiligenceIndividualSummary({
  value,
  onEdit,
}: {
  value: DueDiligenceIndividual;
  onEdit?: (stepId: string) => void;
}) {
  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-2xl border border-line">
        <div className="flex items-center justify-between gap-3 border-b border-line bg-slate-50/70 px-5 py-3">
          <h3 className="text-sm font-bold text-ink">The customer</h3>
          {onEdit && (
            <Button variant="ghost" size="sm" onClick={() => onEdit("customer")}>
              <PencilLine aria-hidden="true" />
              Edit
            </Button>
          )}
        </div>
        <dl className="grid gap-4 px-5 py-4 sm:grid-cols-2">
          {customerLines.map((line) => (
            <div key={line.id} className="sm:col-span-2">
              <dt className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">{line.label}</dt>
              <dd className="mt-0.5 text-sm break-words text-ink">{value.customer[line.id].trim() || "—"}</dd>
            </div>
          ))}
        </dl>
      </section>
      <SharedDueDiligenceSummary value={value} onEdit={onEdit} />
    </div>
  );
}
