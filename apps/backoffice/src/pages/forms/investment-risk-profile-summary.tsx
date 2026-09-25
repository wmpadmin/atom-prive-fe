import { Button } from "@atomprive/ui";
import { PencilLine } from "lucide-react";
import type { ReactNode } from "react";
import { formatDate } from "../../lib/labels";
import {
  allProducts,
  assessmentMatters,
  derivedProfile,
  experienceLabels,
  knowledgeLabels,
  profiles,
  riskQuestions,
  riskScenarios,
  riskToleranceQuestion,
  scoreOf,
  type InvestmentRiskProfileEntity,
} from "./investment-risk-profile";
import { signatureText } from "./made-signature";

const MISSING = "—";

function shown(value: string | null | undefined) {
  return value?.trim() ? value : MISSING;
}

/** A sign-off block as the form rules it: the name, the date and the sign off beside it. */
function signedBy(rows: { name: string; signedOn: string; signOff: string }[]) {
  const named = rows.filter((row) => row.name.trim());
  if (named.length === 0) return MISSING;
  return named
    .map((row) => `${row.name} · ${row.signedOn ? formatDate(row.signedOn) : MISSING} · ${signatureText(shown(row.signOff))}`)
    .join("\n");
}

function profileName(value: string | null) {
  return profiles.find((one) => one.value === value)?.label ?? MISSING;
}

/** Everything answered, part by part, for the last look before submitting and for a finished form. */
export function RiskProfileSummary({
  value,
  onEdit,
}: {
  value: InvestmentRiskProfileEntity;
  onEdit?: (stepId: string) => void;
}) {
  const derived = derivedProfile(value);
  const answered = allProducts.filter(
    (product) => value.products[product]?.experience && value.products[product]?.knowledge,
  );

  return (
    <div className="space-y-5">
      <Part title="Investment Risk Profile Form (IRP)" stepId="customer" onEdit={onEdit}>
        <Fact label="Customer Name" value={shown(value.customerName)} wide />
      </Part>

      <Part title="Risk Profiling Questionnaire" stepId="objectives" onEdit={onEdit}>
        {riskQuestions.map((question) => {
          const option = question.options.find((one) => one.value === value.answers[question.id]);
          return (
            <Fact
              key={question.id}
              label={`${question.number} ${question.heading}`}
              value={option ? option.text : MISSING}
              wide
            />
          );
        })}
        <Fact
          label={`${riskToleranceQuestion.number} ${riskToleranceQuestion.heading}`}
          wide
          value={
            riskScenarios
              .filter((one) => one.value === value.answers["q5"])
              .map((one) => `${one.label}: ${one.targetReturn}, ${one.rangeOfReturns}`)[0] ?? MISSING
          }
        />
      </Part>

      <Part title="3. Product knowledge and experience" stepId="knowledge" onEdit={onEdit}>
        <Fact label="Products answered" value={`${answered.length} of ${allProducts.length}`} wide />
        {answered.map((product) => {
          const held = value.products[product]!;
          return (
            <Fact
              key={product}
              label={product}
              value={`${held.experience ? experienceLabels[held.experience] : MISSING} · ${held.knowledge ? knowledgeLabels[held.knowledge] : MISSING}`}
            />
          );
        })}
      </Part>

      <Part title="Investment Risk Rating" stepId="rating" onEdit={onEdit}>
        <Fact label="Score" value={String(scoreOf(value))} />
        <Fact label="Derived from the answers" value={profileName(derived)} />
        <Fact label="Profile recorded" value={profileName(value.chosenProfile)} wide />
        {assessmentMatters.map((matter) => (
          <Fact key={matter.value} label={matter.text} value={shown(value.assessment[matter.value])} wide />
        ))}
      </Part>

      <Part title="Acknowledgement for Investment Risk Profiling" stepId="acknowledgement" onEdit={onEdit}>
        <Fact label="Confirmation made" value={value.acknowledgement.confirmed ? "Yes" : "Not yet"} wide />
        <Fact label="For Individual / Joint Accounts:" value={signedBy(value.acknowledgement.accountHolders)} wide />
        <Fact label="For Companies:" value={signedBy(value.acknowledgement.authorisedIndividuals)} wide />
        <Fact
          label="Relationship Manager Name"
          value={signedBy([value.acknowledgement.relationshipManager])}
          wide
        />
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
      <dd className="mt-0.5 text-sm break-words whitespace-pre-line text-ink">{value}</dd>
    </div>
  );
}
