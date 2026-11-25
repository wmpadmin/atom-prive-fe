import { cn, RequiredMark } from "@atomprive/ui";
import { Fragment } from "react";
import { TextField, type FieldFor } from "../../components/form-fields";
import { choicesOf, pillClasses } from "./choices";
import { CheckPills, Fields, Mark, RadioPills } from "./onboarding-steps";
import {
  abilityIntro,
  abilityQuestions,
  abilityRanges,
  agreeQuestion,
  BAND_ORDER,
  bandNames,
  custodianNote,
  declarationHeading,
  educationLabels,
  entityAbilityQuestions,
  entityDeclarationHeading,
  entityLeverageHeading,
  entityLeverageNotice,
  exclusionsWording,
  knowledgeDefinitions,
  OWNER_NUMERALS,
  LEVELS,
  levelLabels,
  leverageHeading,
  leverageNotice,
  leverageOtherLabel,
  leveragePurposeLabels,
  leverageQuestion,
  preferredQuestion,
  productGroups,
  profileDefinitions,
  profileFrom,
  profileNames,
  PROFILE_ORDER,
  riskScores,
  toleranceIntro,
  toleranceQuestions,
  toleranceRanges,
  totalLine,
  type Band,
  type Education,
  type FormRiskProfile,
  type LeveragePurpose,
  type OwnerEducation,
  type RiskQuestion,
  type ThreeProfile,
} from "./risk-profiling";

interface RiskStepProps {
  index: number;
  profile: FormRiskProfile;
  onChange: (patch: Partial<FormRiskProfile>) => void;
  field: FieldFor;
}

/** I. Knowledge and Experience: education, any qualification, and the product-class table. */
export function RiskKnowledgeStep({ index, profile, onChange, field, owners }: RiskStepProps & {
  /** An entity's questionnaire (25 Nov 2026): Part A asks each beneficial owner, by name, instead of "you". */
  owners?: string[];
}) {
  const at = `riskProfiles[${index}].`;
  if (owners) {
    const setOwner = (place: number, patch: Partial<OwnerEducation>) => onChange({
      owners: owners.map((name, i) => ({ ...(profile.owners[i] ?? { education: null, qualification: null }), owner: name, ...(i === place ? patch : {}) })),
    });
    return (
      <Fields>
        <div className="sm:col-span-2">
          <p className="text-xs font-semibold tracking-wider text-primary-600 uppercase">Part A <span className="font-normal tracking-normal normal-case text-ink-muted">(to be filled by the Beneficial Owner(s) of the Client)</span></p>
          <p className="mt-1 text-sm text-ink-muted">
            1. What is the highest level of education of the Beneficial Owner(s) of the Client? · 2. Please provide details if the Beneficial Owner(s) hold a qualification related to financial markets.
          </p>
        </div>
        {owners.map((name, place) => (
          <Fragment key={place}>
            <p className="border-t border-dashed border-line pt-3 text-sm font-semibold text-primary-700 sm:col-span-2">
              {String.fromCharCode(97 + place)}) Beneficial Owner {OWNER_NUMERALS[place]}{place > 0 && " (if any)"} · {name}
            </p>
            <RadioPills<Education> name={`${at}owners[${place}].education`} legend="1. Highest level of education" required
              columns="grid-cols-1 sm:grid-cols-3" className="sm:col-span-2" value={profile.owners[place]?.education ?? null}
              onChange={(education) => setOwner(place, { education })} error={field(`${at}owners[${place}].education`).error} choices={choicesOf(educationLabels)} />
            <TextField id={`${at}owners[${place}].qualification`} label="2. Qualification related to financial markets (if any)"
              value={profile.owners[place]?.qualification ?? null} onChange={(qualification) => setOwner(place, { qualification })} field={field} optional className="sm:col-span-2" />
          </Fragment>
        ))}
        <p className="border-t border-line pt-3 text-xs font-semibold tracking-wider text-primary-600 uppercase sm:col-span-2">
          Part B <span className="font-normal tracking-normal normal-case text-ink-muted">(to be filled on behalf of the Client/ entity)</span>
        </p>
        <ProductTable index={index} profile={profile} onChange={onChange} field={field} />
      </Fields>
    );
  }
  return (
    <Fields>
      <RadioPills<Education> name={`${at}education`} legend="What is your highest level of education? Please pick one that applies:" required
        columns="grid-cols-1 sm:grid-cols-3" className="sm:col-span-2" value={profile.education} onChange={(education) => onChange({ education })}
        error={field(`${at}education`).error} choices={choicesOf(educationLabels)} />
      <TextField id={`${at}qualification`} label="Please provide details if you hold a qualification related to financial markets:"
        value={profile.qualification} onChange={(qualification) => onChange({ qualification })} field={field} optional className="sm:col-span-2" />
      <ProductTable index={index} profile={profile} onChange={onChange} field={field} />
    </Fields>
  );
}

/** I. The thirteen product classes, one of the four columns each, laid out as the paper's table. */
function ProductTable({ index, profile, onChange, field }: RiskStepProps) {
  const at = `riskProfiles[${index}].knowledge.`;
  const choose = (key: string, level: (typeof LEVELS)[number]) => onChange({ knowledge: { ...profile.knowledge, [key]: level } });
  return (
    <div className="sm:col-span-2">
      <p className="mb-1.5 text-sm font-semibold text-ink">
        Product classes <span className="font-normal text-ink-muted">(one answer a row)</span>
        <RequiredMark />
      </p>
      <div className="mb-2 grid gap-x-6 gap-y-1 rounded-xl bg-slate-50 px-4 py-2.5 text-xs text-ink-soft sm:grid-cols-2">
        <p><span className="font-semibold text-ink">Knowledge</span> — {knowledgeDefinitions.knowledge}</p>
        <p><span className="font-semibold text-ink">Experience</span> — {knowledgeDefinitions.experience}</p>
      </div>
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full min-w-[44rem] border-collapse">
          <thead className="bg-slate-50">
            <tr>
              <th scope="col" colSpan={2} className="px-3 py-2 text-left text-xs font-semibold text-ink-soft">Product Classes</th>
              {LEVELS.map((level) => (
                <th key={level} scope="col" className="w-32 px-2 py-2 text-center text-xs font-semibold text-ink-soft">{levelLabels[level]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {productGroups.map((group) => group.classes.map((one, row) => {
              const { error } = field(`${at}${one.key}`);
              const chosen = profile.knowledge[one.key] ?? null;
              const name = one.name || group.group;
              return (
                <tr key={one.key} className={cn(error && "bg-red-50/70")}>
                  {row === 0 && (
                    <th scope="rowgroup" rowSpan={one.name ? group.classes.length : 1} colSpan={one.name ? 1 : 2}
                      className={cn("border-t border-line px-3 py-2 text-left text-sm font-semibold text-ink", one.name ? "align-top" : "align-middle")}>
                      {group.group}
                    </th>
                  )}
                  {one.name && <td className="border-t border-line px-3 py-2 align-middle text-sm text-ink">{one.name}</td>}
                  {LEVELS.map((level, column) => (
                    <td key={level} className="border-t border-line px-2 py-2 align-middle">
                      <label className="flex cursor-pointer justify-center py-1 has-focus-visible:rounded-md has-focus-visible:ring-2 has-focus-visible:ring-primary-600/30">
                        <input type="radio" name={`${at}${one.key}`} value={level} checked={chosen === level} onChange={() => choose(one.key, level)}
                          aria-label={`${name}: ${levelLabels[level]}`} aria-invalid={error && column === 0 ? true : undefined} className="sr-only" />
                        <Mark checked={chosen === level} />
                      </label>
                    </td>
                  ))}
                </tr>
              );
            }))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** II. Risk Ability's or Risk Tolerance's questions, two to a row, the score of each answer beside it as printed. */
function ScoredQuestions({ index, profile, onChange, field, intro, questions, part }: RiskStepProps & {
  intro: string;
  questions: RiskQuestion[];
  part: "ability" | "tolerance";
}) {
  const at = `riskProfiles[${index}].answers.`;
  const scores = riskScores(profile);
  // An odd number of questions leaves room beside the last one for the total.
  const besideLast = questions.length % 2 === 1;
  return (
    <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
      <p className="text-sm text-ink-soft sm:col-span-2">{intro}</p>
      {questions.map((question) => {
        const { error } = field(`${at}${question.id}`);
        const answer = profile.answers[question.id] ?? null;
        const headingId = `${at}${question.id}-question`;
        return (
          <div key={question.id} role="radiogroup" aria-labelledby={headingId} aria-describedby={error ? `${at}${question.id}-error` : undefined}
            aria-invalid={error ? true : undefined} className="row-span-2 grid grid-rows-subgrid gap-y-1.5">
            <p id={headingId} className="self-end text-sm font-semibold text-ink">
              <span className="text-primary-700">{question.title}</span> — {question.ask}
              <RequiredMark />
            </p>
            <div className="grid content-start gap-y-2">
              {question.options.map((option) => (
                <label key={option.value} className={pillClasses(answer === option.value)}>
                  <input type="radio" name={`${at}${question.id}`} value={option.value} checked={answer === option.value} className="sr-only"
                    onChange={() => onChange({ answers: { ...profile.answers, [question.id]: option.value } })} />
                  <Mark checked={answer === option.value} />
                  <span>{option.text}</span>
                  <span className="ml-auto min-w-6 rounded-md bg-slate-100 px-1.5 py-0.5 text-center text-xs font-semibold text-ink-soft tabular-nums">
                    {option.score}
                  </span>
                </label>
              ))}
              {error && <p id={`${at}${question.id}-error`} className="text-xs text-red-600">{error}</p>}
            </div>
          </div>
        );
      })}
      <TotalScore part={part} total={part === "ability" ? scores.ability : scores.tolerance}
        band={part === "ability" ? scores.abilityBand : scores.toleranceBand} besideLast={besideLast} />
    </div>
  );
}

/** The paper's "add up the values" line, worked out, with the five bands and the one the total lands in. */
function TotalScore({ part, total, band, besideLast }: { part: "ability" | "tolerance"; total: number; band: Band | null; besideLast: boolean }) {
  const ranges = part === "ability" ? abilityRanges : toleranceRanges;
  const title = part === "ability" ? "Your Risk Ability" : "Your Risk Tolerance";
  const card = (
    <div className={cn("flex flex-col justify-between gap-3 rounded-2xl border border-primary-600/40 bg-primary-50/60 px-5 py-4", besideLast ? "h-full" : "sm:col-span-2")}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <p className="text-sm text-ink-soft">
          {totalLine} <span className="ml-1 text-xl font-bold text-ink tabular-nums">{total}</span>
        </p>
        <p className="text-sm font-semibold text-ink">
          {title}: <span className="text-primary-700">{band ? bandNames[band] : "answer every question"}</span>
        </p>
      </div>
      <div className="grid grid-cols-5 gap-1.5">
        {BAND_ORDER.map((one) => (
          <div key={one} className={cn("rounded-lg px-2 py-1.5 text-center text-xs", one === band ? "bg-primary-600 font-semibold text-on-accent" : "bg-white text-ink-muted")}>
            {bandNames[one]}
            <br />
            <span className="tabular-nums">{besideLast ? "" : "Score of "}{ranges[one]}</span>
          </div>
        ))}
      </div>
      <p className="text-xs text-ink-muted">Worked out from the answers above; it changes as they change.</p>
    </div>
  );
  // Beside the last question, the card runs from its first answer to its last, the same size as the answers beside it.
  return besideLast ? (
    <div className="row-span-2 grid grid-rows-subgrid gap-y-1.5">
      <div aria-hidden="true" />
      {card}
    </div>
  ) : card;
}

export function RiskAbilityStep({ entity, ...props }: RiskStepProps & { entity?: boolean }) {
  // The entity paper asks its third question about future growth instead of retirement (25 Nov 2026).
  return <ScoredQuestions {...props} intro={abilityIntro} questions={entity ? entityAbilityQuestions : abilityQuestions} part="ability" />;
}

export function RiskToleranceStep(props: RiskStepProps) {
  return <ScoredQuestions {...props} intro={toleranceIntro} questions={toleranceQuestions} part="tolerance" />;
}

const matrixAbility = ["Low (10 - 14)", "Moderate (15 - 24)", "Medium (25 - 34)", "Enhanced (35 - 44)", "High (45 - 50)"];
const matrixTolerance = ["Low (5 - 7)", "Moderate (8 - 12)", "Medium (13 - 17)", "Enhanced (18 - 22)", "High (23 - 25)"];

/**
 * The two totals, the matrix with the profile they land on, what it means, and VI. Client Declaration. The entity's
 * questionnaire asks the declaration on a step of its own, after the exclusions, as its paper does (25 Nov 2026).
 */
export function RiskResultStep({ index, profile, onChange, field, withDeclaration = true }: RiskStepProps & { withDeclaration?: boolean }) {
  const scores = riskScores(profile);
  const worked = scores.profile;
  return (
    <Fields>
      <div className="grid gap-3 sm:col-span-2 sm:grid-cols-3">
        <ScoreCard label="Your Risk Ability" band={scores.abilityBand} total={scores.ability} />
        <ScoreCard label="Your Risk Tolerance" band={scores.toleranceBand} total={scores.tolerance} />
        <div className="rounded-2xl border border-primary-600/40 bg-primary-50 px-4 py-3">
          <p className="text-xs text-primary-700">Risk profile from the matrix</p>
          <p className="mt-0.5 text-lg font-bold text-primary-700">{worked ? profileNames[worked] : "—"}</p>
        </div>
      </div>
      {!worked && (
        <p className="rounded-xl border border-dashed border-line px-4 py-2.5 text-sm text-ink-muted sm:col-span-2">
          Answer every question of Your risk ability and Your risk tolerance first; the matrix then gives the profile.
        </p>
      )}
      <div className="sm:col-span-2">
        <p className="mb-1.5 text-sm font-semibold text-ink">
          Risk Profile Definitions <span className="font-normal text-ink-muted">— the matrix maps Risk Ability against Risk Tolerance</span>
        </p>
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[40rem] border-collapse text-xs">
            <thead className="bg-slate-50">
              <tr>
                <th scope="col" className="px-2 py-2 text-left font-semibold text-ink-soft">Ability → / Tolerance ↓</th>
                {BAND_ORDER.map((band, column) => (
                  <th key={band} scope="col" className={cn("px-2 py-2 font-semibold", band === scores.abilityBand ? "text-primary-700" : "text-ink-soft")}>
                    {matrixAbility[column]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {BAND_ORDER.map((tolerance, row) => (
                <tr key={tolerance}>
                  <th scope="row" className={cn("border-t border-line px-2 py-1.5 text-left font-semibold", tolerance === scores.toleranceBand ? "text-primary-700" : "text-ink-soft")}>
                    {matrixTolerance[row]}
                  </th>
                  {BAND_ORDER.map((ability) => {
                    const hit = ability === scores.abilityBand && tolerance === scores.toleranceBand;
                    return (
                      <td key={ability} className={cn("border-t border-line px-2 py-1.5 text-center", hit ? "bg-primary-600 font-bold text-on-accent" : "text-ink-muted")}>
                        {/* Each cell read from the firm's one matrix rule, the one the Forms tab reads, never written out again. */}
                        {profileNames[profileFrom(ability, tolerance)].toUpperCase()}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {worked && (
        <div className="rounded-xl bg-slate-50 px-4 py-3 sm:col-span-2">
          <p className="mb-1.5 text-xs font-semibold tracking-wider text-ink-muted uppercase">{profileNames[worked]}</p>
          <dl className="grid gap-x-6 gap-y-1.5 text-xs sm:grid-cols-[11rem_1fr]">
            {profileDefinitions.map((definition) => (
              <Fragment key={definition.row}>
                <dt className="font-semibold text-ink">{definition.row}</dt>
                <dd className="text-ink-soft">{definition.text[worked]}</dd>
              </Fragment>
            ))}
          </dl>
        </div>
      )}
      {withDeclaration && <Declaration index={index} profile={profile} onChange={onChange} field={field} heading={declarationHeading} />}
    </Fields>
  );
}

/** VI. (an entity's v.) The declaration's question, and the preferred profile after a No. */
function Declaration({ index, profile, onChange, field, heading, entity }: RiskStepProps & { heading: string; entity?: boolean }) {
  const at = `riskProfiles[${index}].`;
  const agrees = profile.agrees === null ? null : profile.agrees ? "yes" : "no";
  return (
    <>
      <div aria-hidden="true" className="border-t border-line sm:col-span-2" />
      <p className="text-xs font-semibold tracking-wider text-primary-600 uppercase sm:col-span-2">{heading}</p>
      <RadioPills name={`${at}agrees`} legend={agreeQuestion} required columns="grid-cols-2" legendClassName="sm:min-h-10"
        value={agrees} onChange={(answer) => onChange({ agrees: answer === "yes" })} error={field(`${at}agrees`).error}
        choices={[{ value: "yes", label: "Yes" }, { value: "no", label: "No" }]} />
      <RadioPills<ThreeProfile> name={`${at}preferredProfile`} legend={preferredQuestion} note="(asked only after a No)" required
        columns="grid-cols-3" legendClassName="sm:min-h-10" disabled={profile.agrees !== false}
        value={profile.agrees === false ? profile.preferredProfile : null} onChange={(preferredProfile) => onChange({ preferredProfile })}
        error={field(`${at}preferredProfile`).error} choices={PROFILE_ORDER.map((value) => ({ value, label: profileNames[value] }))} />
      <p className="rounded-xl border border-dashed border-line px-4 py-2.5 text-xs text-ink-muted sm:col-span-2">
        {entity
          ? "The declaration (\"I/We, hereby confirm, that the information furnished in the above questionnaire is materially correct and is a true reflection of the risk attitude of the legal entity that I/we represent…\") and the two signatures are on the printed form; nothing to fill in here."
          : "The client's declaration (\"I/We, hereby confirm, that the information furnished…\") and signature are on the printed form; nothing to fill in here."}
      </p>
    </>
  );
}

/** The entity's declaration, v., on its own step (25 Nov 2026), with the profile the matrix gave beside it. */
export function RiskDeclarationStep({ index, profile, onChange, field }: RiskStepProps) {
  const worked = riskScores(profile).profile;
  return (
    <Fields>
      <div className="rounded-2xl border border-primary-600/40 bg-primary-50 px-4 py-3 sm:col-span-2 sm:max-w-xs">
        <p className="text-xs text-primary-700">Risk profile from the matrix</p>
        <p className="mt-0.5 text-lg font-bold text-primary-700">{worked ? profileNames[worked] : "—"}</p>
      </div>
      <Declaration index={index} profile={profile} onChange={onChange} field={field} heading={entityDeclarationHeading} entity />
    </Fields>
  );
}

/** Page 14 of the entity paper (25 Nov 2026): the excluded jurisdictions and sectors and extenuating circumstances, each "if any". */
export function RiskExclusionsStep({ index, profile, onChange, field }: RiskStepProps) {
  const at = `riskProfiles[${index}].`;
  const words = exclusionsWording;
  const part = (heading: string, ask: string | null, id: string, label: string, value: string | null, set: (text: string) => void, first: boolean) => (
    <div className={cn("sm:col-span-2", !first && "border-t border-line pt-4")}>
      <p className="text-xs font-semibold tracking-wider text-ink-muted uppercase">{heading}</p>
      {ask && <p className="mt-1 mb-2 text-sm text-ink-muted">{ask}</p>}
      <TextField id={id} label={label} value={value} onChange={set} field={field} optional multiline />
    </div>
  );
  return (
    <Fields>
      {part(words.countriesHeading, words.countriesAsk, `${at}excludedCountries`, words.countriesLabel, profile.excludedCountries, (excludedCountries) => onChange({ excludedCountries }), true)}
      {part(words.sectorsHeading, words.sectorsAsk, `${at}excludedSectors`, words.sectorsLabel, profile.excludedSectors, (excludedSectors) => onChange({ excludedSectors }), false)}
      {part(words.circumstancesHeading, null, `${at}circumstances`, words.circumstancesLabel, profile.circumstances, (circumstances) => onChange({ circumstances }), false)}
    </Fields>
  );
}

function ScoreCard({ label, band, total }: { label: string; band: Band | null; total: number }) {
  return (
    <div className="rounded-2xl border border-line px-4 py-3">
      <p className="text-xs text-ink-muted">{label}</p>
      <p className="mt-0.5 text-lg font-bold">
        {band ? bandNames[band] : "—"} <span className="text-sm font-medium text-ink-muted tabular-nums">· score {total}</span>
      </p>
    </div>
  );
}

/** Risk Variation, VII: the paper's notice and what leverage may be used for, only if the client means to use it. */
export function RiskLeverageStep({ index, profile, onChange, field, entity }: RiskStepProps & { entity?: boolean }) {
  const at = `riskProfiles[${index}].`;
  return (
    <Fields>
      <div className="rounded-xl bg-slate-50 px-4 py-3 text-xs leading-relaxed text-ink-soft sm:col-span-2">
        <p className="mb-1 font-semibold text-ink">{entity ? entityLeverageHeading : leverageHeading}</p>
        {(entity ? entityLeverageNotice : leverageNotice).map((line) => <p key={line} className="mt-1">{line}</p>)}
      </div>
      <CheckPills<LeveragePurpose> name={`${at}leveragePurposes`} legend={leverageQuestion}
        note="(tick all that apply — leave empty if the client won't leverage)" columns="grid-cols-1 sm:grid-cols-2" className="sm:col-span-2"
        value={profile.leveragePurposes} onChange={(leveragePurposes) => onChange({ leveragePurposes })}
        error={field(`${at}leveragePurposes`).error} choices={choicesOf(leveragePurposeLabels)} />
      <TextField id={`${at}leverageOther`} label={leverageOtherLabel} value={profile.leverageOther}
        onChange={(leverageOther) => onChange({ leverageOther })} field={field} optional className="sm:col-span-2" />
      <p className="text-xs text-ink-muted sm:col-span-2">{custodianNote}</p>
    </Fields>
  );
}
