import { Button } from "@atomprive/ui";
import { PencilLine } from "lucide-react";
import type { ReactNode } from "react";
import { countryName } from "./countries";
import {
  abilityQuestions,
  allClasses,
  bandLabels,
  leveragePurposes,
  levelLabels,
  needsLeverageNotice,
  profileLabels,
  scored,
  toleranceQuestions,
  type RiskQuestionnaire,
  type ScoredQuestion,
} from "./risk-questionnaire";

const MISSING = "—";

/** The firm's questionnaire read back part by part: for the last look before submitting, and for the client to sign. */
export function RiskQuestionnaireSummary({ value, onEdit }: { value: RiskQuestionnaire; onEdit?: (stepId: string) => void }) {
  const result = scored(value);
  const sectors = [...value.excludedSectors, ...(value.otherSectors.trim() ? [value.otherSectors.trim()] : [])];
  const purposes = value.leveragePurposes.map((one) =>
    one === "OTHER" ? `Other: ${value.leverageOther.trim() || MISSING}` : (leveragePurposes.find((purpose) => purpose.value === one)?.text ?? one),
  );

  return (
    <div className="space-y-5">
      <Part title="Risk Profile" stepId="result" onEdit={onEdit}>
        <Fact label="Customer" value={value.customerName.trim() || MISSING} wide />
        <Fact label="Risk Ability" value={result.bands.ability ? `${result.ability} · ${bandLabels[result.bands.ability]}` : MISSING} />
        <Fact label="Risk Tolerance" value={result.bands.tolerance ? `${result.tolerance} · ${bandLabels[result.bands.tolerance]}` : MISSING} />
        <Fact label="Worked out from the answers" value={result.profile ? profileLabels[result.profile] : MISSING} />
        <Fact label="Profile that counts" value={value.chosenProfile ? profileLabels[value.chosenProfile] : MISSING} />
      </Part>

      <Answers title="II. Your Risk Ability" stepId="ability" questions={abilityQuestions} value={value} onEdit={onEdit} />
      <Answers title="II. Your Risk Tolerance" stepId="tolerance" questions={toleranceQuestions} value={value} onEdit={onEdit} />

      <Part title="I. Knowledge and experience" stepId="knowledge" onEdit={onEdit}>
        {allClasses.map((one) => {
          const level = value.knowledge[one.key];
          return <Fact key={one.key} label={one.name} value={level ? levelLabels[level] : MISSING} />;
        })}
      </Part>

      <Part title="III–V. Exclusions and circumstances" stepId="exclusions" onEdit={onEdit}>
        <Fact label="III. Excluded jurisdictions" value={value.excludedCountries.length ? value.excludedCountries.map(countryName).join(", ") : "None"} wide />
        <Fact label="IV. Excluded sectors / industries" value={sectors.length ? sectors.join(", ") : "None"} wide />
        <Fact label="V. Extenuating circumstances" value={value.circumstances.trim() || "None"} wide />
      </Part>

      <Part title="VI. Agreeing the profile" stepId="agreement" onEdit={onEdit}>
        <Fact
          label="Agrees with the profile worked out"
          value={value.agrees === null ? MISSING : value.agrees ? "Yes" : `No — prefers ${value.preferredProfile ? profileLabels[value.preferredProfile] : MISSING}`}
          wide
        />
        <Fact label="Declaration confirmed" value={value.declarationConfirmed ? "Yes" : "Not yet"} wide />
      </Part>

      <Part title="VII. Leverage" stepId="leverage" onEdit={onEdit}>
        <Fact label="Intends to use leverage" value={value.intendsLeverage === null ? MISSING : value.intendsLeverage ? "Yes" : "No"} wide />
        {needsLeverageNotice(value) && (
          <>
            <Fact label="Only for" value={purposes.length ? purposes.join("\n") : MISSING} wide />
            <Fact label="Notice acknowledged" value={value.leverageAcknowledged ? "Yes" : "Not yet"} wide />
          </>
        )}
      </Part>
    </div>
  );
}

/** One part's questions, each with the answer given and the points it carries. */
function Answers({
  title,
  stepId,
  questions,
  value,
  onEdit,
}: {
  title: string;
  stepId: string;
  questions: ScoredQuestion[];
  value: RiskQuestionnaire;
  onEdit?: (stepId: string) => void;
}) {
  return (
    <Part title={title} stepId={stepId} onEdit={onEdit}>
      {questions.map((question) => {
        const option = question.options.find((one) => one.value === value.answers[question.id]);
        return <Fact key={question.id} label={question.title} value={option ? `${option.text} · ${option.score} points` : MISSING} wide />;
      })}
    </Part>
  );
}

function Part({ title, stepId, onEdit, children }: { title: string; stepId: string; onEdit?: (stepId: string) => void; children: ReactNode }) {
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
      <dd className="mt-0.5 text-sm break-words whitespace-pre-line text-ink">{value}</dd>
    </div>
  );
}
