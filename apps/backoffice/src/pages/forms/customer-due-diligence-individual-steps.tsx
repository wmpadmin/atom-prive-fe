import { Written } from "../../components/form-boxes";
import { FormSection as FieldGroup, TextField, type FieldFor } from "../../components/form-fields";
import { NAME_OF_THE_FIRM } from "./customer-due-diligence";
import {
  customerLines,
  type CustomerDetails,
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

export { DueDiligenceIndividualSummary } from "@atomprive/forms/customer-due-diligence-individual-summary";
