import { Button } from "@atomprive/ui";
import { PencilLine } from "lucide-react";
import type { ReactNode } from "react";
import { countryName } from "../../lib/countries";
import { formatDate } from "../../lib/labels";
import {
  cddLevelLabels,
  classifiedLabels,
  netWorthRows,
  pepRows,
  ratingLabels,
  screenedAsLabels,
  screeningResultLabels,
  type DueDiligenceEntity,
  type DueDiligenceShared,
} from "./customer-due-diligence";
import { signatureText } from "./made-signature";

const MISSING = "—";

function shown(value: string | null | undefined) {
  return value?.trim() ? value : MISSING;
}

function shownDate(value: string) {
  return value ? formatDate(value) : MISSING;
}

function yesNo(value: boolean | null) {
  return value === null ? MISSING : value ? "Yes" : "No";
}

/** Everything entered, part by part, for the last look before submitting and for a finished form. */
export function DueDiligenceSummary({
  value,
  onEdit,
}: {
  value: DueDiligenceEntity;
  onEdit?: (stepId: string) => void;
}) {
  const { business } = value;
  return (
    <div className="space-y-5">
      <Part title="Business background" stepId="business" onEdit={onEdit}>
        <Fact label="Full name of legal entity:" value={shown(business.legalName)} wide />
        <Fact label="Trading name:" value={shown(business.tradingName)} />
        <Fact label="Corporate registration number:" value={shown(business.registrationNumber)} />
        <Fact label="Incorporated" value={`${shownDate(business.incorporatedOn)} · ${shown(business.incorporatedIn)}`} />
        <Fact label="Legal structure:" value={shown(business.legalStructure)} />
        <Fact label="Fiscal residence:" value={shown(business.fiscalResidence)} />
        <Fact label="Contact" value={`${shown(business.contactPerson)} · ${shown(business.telephone)}`} />
        <Fact label="Principal place of business:" value={shown(business.principalPlaceOfBusiness)} wide />
        <Fact label="Business activities" value={shown(business.businessActivities)} wide />
        <Fact
          label="Countries business is conducted with"
          value={business.countriesOfBusiness.length > 0 ? business.countriesOfBusiness.map(countryName).join(", ") : MISSING}
          wide
        />
        <Fact label="Initial investment" value={shown(business.initialInvestment)} />
        <Fact label="Expected investment value to be transacted each year" value={shown(business.expectedValuePerYear)} />
        <Fact label="How it was introduced" value={shown(business.howIntroduced)} />
        <Fact label="Relationship manager" value={shown(business.relationshipManager)} />
        <Fact label="Purpose of the relationship" value={shown(business.purposeOfRelationship)} wide />
      </Part>
      <SharedDueDiligenceSummary value={value} onEdit={onEdit} />
    </div>
  );
}

/**
 * Everything the two copies of the form have in common, which is all of it below the details table SECTION 1
 * opens with.
 */
export function SharedDueDiligenceSummary({
  value,
  onEdit,
}: {
  value: DueDiligenceShared;
  onEdit?: (stepId: string) => void;
}) {
  const { classification, suitability, wealth, risk, review } = value;
  return (
    <>
      <Part title="Client classification" stepId="classification" onEdit={onEdit}>
        <Fact
          label="Classified as"
          value={classification.classified ? classifiedLabels[classification.classified] : MISSING}
          wide
        />
        {classification.classified === "ASSESSED" &&
          classification.evidence.map((held, at) => (
            <Fact
              key={at}
              label={shown(held.document)}
              wide
              value={`${shown(held.netAssetAmount)}${held.knowledgeAndExperience ? " · knowledge and experience evidenced" : ""}`}
            />
          ))}
      </Part>

      <Part title="Suitability & screening" stepId="suitability" onEdit={onEdit}>
        <Fact label="Investment risk profile completed" value={yesNo(suitability.riskProfileCompleted)} />
        <Fact label="Client risk profile" value={shown(suitability.clientRiskProfile)} />
        <Fact label="Comments" value={shown(suitability.comments)} wide />
        {value.screening.map((checked, at) => (
          <Fact
            key={at}
            label={`${shown(checked.name)} · ${screenedAsLabels[checked.screenedAs]}`}
            wide
            value={`${shownDate(checked.screenedOn)} · ${checked.result ? screeningResultLabels[checked.result] : MISSING}${checked.remarks.trim() ? ` · ${checked.remarks}` : ""}`}
          />
        ))}
      </Part>

      <Part title="Source of Wealth (SOW) / Source of Funds (SOF) Information" stepId="wealth" onEdit={onEdit}>
        <Fact label="Employment Details (salaried individuals)" value={`${wealth.employment.length} entered`} />
        <Fact label="Entity Details (self-employed individuals)" value={`${wealth.entities.length} entered`} />
        <Fact label="Source of Funds and Source of Income Information — Personal details" value={shown(wealth.personalDetails)} wide />
        {netWorthRows.map((row) => (
          <Fact
            key={row.id}
            label={`${row.group} — ${row.label}`}
            value={`${shown(wealth.netWorth[row.id]?.details)} · ${shown(wealth.netWorth[row.id]?.usd)}`}
            wide
          />
        ))}
        <Fact label="TOTAL Net Worth - (Assets Less Liabilities)" value={shown(wealth.totalNetWorth)} wide />
      </Part>

      <Part title="MONEY LAUNDERING RISK RATING (MLRR)" stepId="risk" onEdit={onEdit}>
        <Fact label="OVERALL MLRR RISK ASSESSMENT" value={shown(risk.overallMlrr)} wide />
        <Fact label="PEP risk (if applicable):" value={yesNo(risk.politicallyExposed)} />
        <Fact label="Relationship Manager Name" value={`${shown(risk.relationshipManagerName)} · ${shown(risk.dateAndPlace)} · ${signatureText(shown(risk.signature))}`} />
        {risk.politicallyExposed === true &&
          pepRows.map((row) => (
            <Fact
              key={row.id}
              label={row.label}
              value={`${risk.pep[row.id]?.rating ? ratingLabels[risk.pep[row.id]!.rating!] : MISSING} · ${shown(risk.pep[row.id]?.details)}`}
              wide
            />
          ))}
      </Part>

      <Part title="To be completed by the MLRO" stepId="compliance" onEdit={onEdit}>
        <Fact label="AMENDED OVERALL RISK ASSESSEMENT" value={shown(review.amendedOverallRiskAssessment)} wide />
        <Fact label="Overall MLRR:" value={shown(review.overallMlrr)} />
        <Fact label="Next review date:" value={shownDate(review.nextReviewOn)} />
        <Fact label="Comments on how MLRR has been calculated:" value={shown(review.comments)} wide />
        <Fact label="Levels of CDD required" value={review.level ? cddLevelLabels[review.level] : MISSING} wide />
        <Fact label="Any other matters not previously covered in this form:" value={shown(review.otherMatters)} wide />
        <Fact label="MLRO" value={`${shown(review.mlro)} · ${shownDate(review.mlroDate)} · ${shown(review.mlroSignature)}`} wide />
        <Fact label="SEO" value={`${shown(review.seo)} · ${shownDate(review.seoDate)} · ${shown(review.seoSignature)}`} wide />
      </Part>
    </>
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
    <section className="rounded-2xl border border-line bg-white">
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
