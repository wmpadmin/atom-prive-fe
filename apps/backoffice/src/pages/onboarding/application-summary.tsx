import type { Address, StaffMember } from "@atomprive/api-client/backoffice";
import { Badge, Button } from "@atomprive/ui";
import { FileText, PencilLine } from "lucide-react";
import type { ReactNode } from "react";
import { countryName } from "../../lib/countries";
import { formatMobileNumber } from "../../lib/mobile-numbers";
import {
  holderGroup,
  occupationLabels,
  organisationTypeLabels,
  relationshipLabels,
  reviewApplication,
  type FormApplication,
} from "./application";

const shownDate = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });

function date(value: string | null) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? "");
  return match ? shownDate.format(new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))) : null;
}

function country(code: string | null) {
  return code ? countryName(code) : null;
}

function address(value: Address | null) {
  if (!value) return null;
  const parts = [value.line1, value.line2, [value.city, value.state, value.postalCode].filter(Boolean).join(", "), country(value.country)];
  const text = parts.filter((part) => part && part.trim() !== "").join("\n");
  return text || null;
}

type Row = [label: string, value: ReactNode];

interface SummaryProps {
  application: FormApplication;
  managers: StaffMember[] | undefined;
  /** When given, each section offers Edit, which opens that step. */
  onEdit?: (stepId: string) => void;
}

/** Everything entered, section by section, as the last step of the form and for cases already submitted. */
export function ApplicationSummary({ application, managers, onEdit }: SummaryProps) {
  const { steps } = reviewApplication(application, managers);
  const complete = (id: string) => steps.find((step) => step.id === id)?.complete ?? false;
  const managerName = managers?.find((person) => person.id === application.relationshipManagerId)?.fullName ?? null;

  const sections: { id: string; title: string; rows: Row[] }[] = [
    {
      id: "client",
      title: "Client type",
      rows: [
        ["Client type", application.clientType === "ENTITY" ? "Entity" : "Individual"],
        ["Relationship manager", managerName],
      ],
    },
  ];

  if (application.clientType === "ENTITY") {
    const { entity } = application;
    sections.push(
      {
        id: "entity-details",
        title: "Entity details",
        rows: [
          ["Full legal name", entity.legalName],
          ["Country of incorporation", country(entity.countryOfIncorporation)],
          ["Date of incorporation", date(entity.dateOfIncorporation)],
          ["Business registration number", entity.registrationNumber],
          ["Nature of the business", entity.natureOfBusiness],
        ],
      },
      {
        id: "entity-business",
        title: "Business & regulation",
        rows: [
          ["Regulated", entity.regulated === null ? null : entity.regulated ? `Yes, by ${entity.regulatorName ?? "—"}` : "No"],
          ["Countries of business", entity.countriesOfBusiness.map(countryName).join(", ") || null],
          [
            "Type of organisation",
            entity.organisationType === "OTHER" ? `Other: ${entity.organisationTypeOther ?? "—"}` : entity.organisationType && organisationTypeLabels[entity.organisationType],
          ],
        ],
      },
      { id: "entity-address", title: "Registered address", rows: [["Registered address", address(entity.registeredAddress)]] },
    );
  } else {
    application.holders.forEach((holder, index) => {
      const group = holderGroup(index);
      const occupationRows: Row[] = [
        ["Occupation", holder.occupation === "OTHER" ? `Other: ${holder.occupationOther ?? "—"}` : holder.occupation && occupationLabels[holder.occupation]],
      ];
      if (holder.occupation === "SALARIED") {
        occupationRows.push(
          ["Employer", holder.employer.companyName],
          ["Employer's country", country(holder.employer.country)],
          ["Position", holder.employer.position],
        );
      }
      if (holder.occupation === "BUSINESS_OWNER") {
        occupationRows.push(
          ["Company", holder.business.companyName],
          ["Company's country", country(holder.business.country)],
          ["Entity type", holder.business.entityType],
          ["Nature of business", holder.business.natureOfBusiness],
          ["Countries of business", holder.business.countriesOfBusiness.map(countryName).join(", ") || null],
        );
      }
      sections.push(
        {
          id: `holder-${index}-personal`,
          title: `${group} · Personal details`,
          rows: [
            ["Full name", holder.fullName],
            ["Forenames", holder.forenames],
            ["Surname", holder.surname],
            ...(index > 0 ? ([["Relationship", holder.relationshipToPrimary && relationshipLabels[holder.relationshipToPrimary]]] as Row[]) : []),
            ["Date of birth", date(holder.dateOfBirth)],
            ["NRIC or passport", holder.idNumber],
            ["Expires", date(holder.idExpiry)],
            ["Nationality", country(holder.nationality)],
            ["Country of birth", country(holder.countryOfBirth)],
            [
              "Other nationality",
              holder.otherNationality === null ? null : holder.otherNationality ? (country(holder.otherNationalityCountry) ?? "Yes") : "None",
            ],
          ],
        },
        { id: `holder-${index}-occupation`, title: `${group} · Occupation`, rows: occupationRows },
        {
          id: `holder-${index}-contact`,
          title: `${group} · Contact & address`,
          rows: [
            ["Mobile", formatMobileNumber(holder.phone)],
            ["Email", holder.email],
            ["Residential address", address(holder.residentialAddress)],
            ["Mailing address", holder.mailingSameAsResidential ? "Same as residential address" : address(holder.mailingAddress)],
            ...(holder.secondaryMailingAddress ? ([["Secondary mailing address", address(holder.secondaryMailingAddress)]] as Row[]) : []),
          ],
        },
      );
    });
  }

  return (
    <div className="space-y-4">
      {sections.map((section) => (
        <section key={section.id} className="rounded-xl border border-line">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-slate-50/60 px-4 py-2.5">
            <h3 className="text-sm font-bold">{section.title}</h3>
            <div className="flex items-center gap-2">
              {onEdit && !complete(section.id) && <Badge tone="warning">Needs details</Badge>}
              {onEdit && (
                <Button size="sm" variant="ghost" onClick={() => onEdit(section.id)}>
                  <PencilLine aria-hidden="true" />
                  Edit
                </Button>
              )}
            </div>
          </div>
          <dl className="grid gap-x-6 gap-y-3 px-4 py-4 sm:grid-cols-2 xl:grid-cols-3">
            {section.rows.map(([label, value]) => (
              <div key={label} className="min-w-0">
                <dt className="text-2xs font-medium tracking-wide text-ink-muted uppercase">{label}</dt>
                <dd className={value ? "mt-0.5 text-sm font-medium break-words whitespace-pre-line" : "mt-0.5 text-sm text-ink-muted"}>{value || "—"}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}

      <div className="flex gap-3 rounded-xl border border-primary-100 bg-primary-50 px-4 py-3 text-sm text-primary-700">
        <FileText aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        <div>
          <p className="font-semibold">Documents to collect</p>
          <p className="mt-0.5 text-primary-700/90">
            {application.clientType === "ENTITY"
              ? "A copy of the certificate of incorporation and proof of the registered address."
              : "A copy of each account holder's NRIC or passport, and proof of their residential address."}
          </p>
        </div>
      </div>
    </div>
  );
}
