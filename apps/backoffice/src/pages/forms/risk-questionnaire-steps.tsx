import { Alert, SelectInput, cn } from "@atomprive/ui";
import { X } from "lucide-react";
import {
  BANDS,
  abilityQuestions,
  abilityRanges,
  allClasses,
  bandLabels,
  knowledgeNote,
  leveragePurposes,
  levelLabels,
  LEVELS,
  needsLeverageNotice,
  noRiskierThan,
  PROFILES,
  productClasses,
  profileFrom,
  profileLabels,
  profileMeans,
  questionnaireText,
  scored,
  sectors,
  settled,
  toleranceQuestions,
  toleranceRanges,
  type Band,
  type RiskQuestionnaire,
  type ScoredQuestion,
  type ThreeProfile,
} from "@atomprive/forms/risk-questionnaire";
import { Boxes, Tick } from "../../components/form-boxes";
import { CountriesField, FormSection as FieldGroup, TextField, type FieldFor } from "../../components/form-fields";

type Change = (patch: Partial<RiskQuestionnaire>) => void;

/**
 * Every change goes through `settled`, so the profile that counts is always the one worked out (where the client
 * agrees) or the one they prefer, and what is saved says so.
 */
function useChange(value: RiskQuestionnaire, onChange: Change): Change {
  return (patch) => onChange(settled({ ...value, ...patch }));
}

/** The matrix's own colours — green, yellow, orange — in the theme's pairs, so they read in light and dark alike. */
const PROFILE_TONE: Record<ThreeProfile, string> = {
  CONSERVATIVE: "bg-access-full-soft text-access-full-ink",
  BALANCED: "bg-access-view-soft text-access-view-ink",
  AGGRESSIVE: "bg-access-none-soft text-access-none-ink",
};

/** Who the questionnaire is for. */
export function QuestionnaireCustomerStep({ value, onChange, field }: { value: RiskQuestionnaire; onChange: Change; field: FieldFor }) {
  const change = useChange(value, onChange);
  return (
    <FieldGroup title="Risk Profile Questionnaire">
      <TextField id="customerName" label="Customer name" value={value.customerName} onChange={(customerName) => change({ customerName })} field={field} className="sm:col-span-2" />
    </FieldGroup>
  );
}

/** I. Each product class on one of the form's four levels. */
export function KnowledgeStep({ value, onChange, field }: { value: RiskQuestionnaire; onChange: Change; field: FieldFor }) {
  const change = useChange(value, onChange);
  return (
    <div className="space-y-5">
      <dl className="grid gap-3 rounded-2xl border border-line bg-slate-50/70 px-5 py-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="font-semibold">Knowledge</dt>
          <dd className="text-ink-muted">{knowledgeNote.knowledge}</dd>
        </div>
        <div>
          <dt className="font-semibold">Experience</dt>
          <dd className="text-ink-muted">{knowledgeNote.experience}</dd>
        </div>
      </dl>
      {productClasses.map((group) => (
        <section key={group.group} className="space-y-3">
          <h3 className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">{group.group}</h3>
          {group.classes.map((one) => (
            <div key={one.key} className="rounded-xl border border-line bg-white p-3.5">
              <p className="mb-2 text-sm font-semibold text-ink">{one.name}</p>
              <Boxes legend={one.name} hideLegend inline error={field(`knowledge.${one.key}`).error}>
                {LEVELS.map((level) => (
                  <Tick
                    key={level}
                    kind="radio"
                    name={`knowledge.${one.key}`}
                    id={`knowledge.${one.key}.${level}`}
                    checked={value.knowledge[one.key] === level}
                    onChange={() => change({ knowledge: { ...value.knowledge, [one.key]: level } })}
                    text={levelLabels[level]}
                  />
                ))}
              </Boxes>
            </div>
          ))}
        </section>
      ))}
      <p className="text-xs text-ink-muted">
        {allClasses.filter((one) => value.knowledge[one.key]).length} of {allClasses.length} answered. Part I is not scored.
      </p>
    </div>
  );
}

/** II. One part's questions, with the points beside each answer and the running total beside them all. */
export function ScoredStep({
  part,
  value,
  onChange,
  field,
}: {
  part: "ability" | "tolerance";
  value: RiskQuestionnaire;
  onChange: Change;
  field: FieldFor;
}) {
  const change = useChange(value, onChange);
  const questions = part === "ability" ? abilityQuestions : toleranceQuestions;
  const result = scored(value);
  const total = part === "ability" ? result.ability : result.tolerance;
  const answered = part === "ability" ? result.abilityAnswered : result.toleranceAnswered;
  const band = part === "ability" ? result.bands.ability : result.bands.tolerance;
  const ranges = part === "ability" ? abilityRanges : toleranceRanges;
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_17rem] xl:items-start">
      <div className="space-y-8">
        {questions.map((question) => (
          <Question key={question.id} question={question} chosen={value.answers[question.id]} field={field}
            onChange={(picked) => change({ answers: { ...value.answers, [question.id]: picked } })} />
        ))}
      </div>
      <aside className="rounded-2xl border border-line bg-white p-4 xl:sticky xl:top-4">
        <p className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">{part === "ability" ? "Risk Ability" : "Risk Tolerance"} so far</p>
        <p className="mt-1 text-3xl font-bold tabular-nums">
          {total} <span className="text-sm font-semibold text-ink-muted">of {part === "ability" ? 50 : 25}</span>
        </p>
        {/* The bands as the form prints them, one to a line, with the one the total falls in ticked. */}
        <ul className="mt-3 space-y-1">
          {BANDS.map((one, at) => (
            <li key={one} className={cn("flex justify-between rounded-md px-2.5 py-1 text-xs", band === one ? "bg-primary-600 font-bold text-on-accent" : "bg-slate-100 text-ink-muted")}>
              <span>{bandLabels[one]}</span>
              <span className="tabular-nums">{ranges[at]}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-ink-muted">
          {answered} of {questions.length} answered.{band ? "" : " The band is ticked once every question is."}
        </p>
      </aside>
    </div>
  );
}

function Question({ question, chosen, onChange, field }: { question: ScoredQuestion; chosen: string | undefined; onChange: (value: string) => void; field: FieldFor }) {
  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-sm font-bold text-ink">{question.title}</h3>
        <p className="mt-0.5 text-sm text-ink-muted">{question.ask}</p>
      </div>
      <Boxes legend={question.title} hideLegend error={field(`answers.${question.id}`).error}>
        {question.options.map((option) => (
          <Tick
            key={option.value}
            kind="radio"
            name={`answers.${question.id}`}
            id={`answers.${question.id}.${option.value}`}
            checked={chosen === option.value}
            onChange={() => onChange(option.value)}
            text={option.text}
            aside={<span className="mt-0.5 w-8 shrink-0 text-right font-mono text-sm font-semibold text-ink-muted">{option.score}</span>}
          />
        ))}
      </Boxes>
    </section>
  );
}

/** Both scores, their bands, the firm's matrix with the client's cell marked, and what the profile means. */
export function ResultStep({ value }: { value: RiskQuestionnaire }) {
  const result = scored(value);
  if (!result.profile || !result.bands.ability || !result.bands.tolerance) {
    return <Alert tone="info">The profile is worked out once every question in Risk Ability and Risk Tolerance is answered.</Alert>;
  }
  const means = profileMeans[result.profile];
  return (
    <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_18rem] 2xl:items-start">
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Total label="Risk Ability" score={result.ability} of={50} band={result.bands.ability} />
          <Total label="Risk Tolerance" score={result.tolerance} of={25} band={result.bands.tolerance} />
        </div>
        <div className="overflow-x-auto rounded-2xl border border-line bg-white p-3">
          <table className="w-full border-separate border-spacing-1 text-xs">
            <caption className="sr-only">The firm's matrix: Risk Tolerance down the side, Risk Ability across the top.</caption>
            <thead>
              <tr>
                <th className="text-left font-semibold text-ink-muted">Tolerance ↓ · Ability →</th>
                {BANDS.map((one, at) => (
                  <th key={one} className="font-semibold text-ink-muted">
                    {bandLabels[one]}
                    <br />
                    <span className="font-normal">{abilityRanges[at]}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {BANDS.map((tolerance, row) => (
                <tr key={tolerance}>
                  <th className="text-left font-semibold whitespace-nowrap text-ink-muted">
                    {bandLabels[tolerance]} {toleranceRanges[row]}
                  </th>
                  {BANDS.map((ability) => {
                    const cell = profileFrom(ability, tolerance);
                    const here = ability === result.bands.ability && tolerance === result.bands.tolerance;
                    return (
                      <td key={ability} className={cn("rounded-md px-1 py-2 text-center font-semibold", PROFILE_TONE[cell], here && "outline-2 outline-ink")}>
                        {profileLabels[cell]}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <aside className={cn("space-y-2 rounded-2xl p-4 text-sm", PROFILE_TONE[result.profile])}>
        <p className="text-2xs font-semibold tracking-wider uppercase opacity-80">Profile</p>
        <p className="text-xl font-bold">{profileLabels[result.profile]}</p>
        <p>{means.investor}</p>
        <p><b>Return objective.</b> {means.returns}</p>
        <p><b>Risk tolerance.</b> {means.tolerance}</p>
        <p><b>Leverage.</b> {means.leverage}</p>
        <p><b>Asset allocation.</b> {means.allocation}</p>
      </aside>
    </div>
  );
}

function Total({ label, score, of, band }: { label: string; score: number; of: number; band: Band }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-4">
      <p className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">{label}</p>
      <p className="mt-1 text-3xl font-bold tabular-nums">
        {score} <span className="text-sm font-semibold text-ink-muted">of {of}</span>
      </p>
      <span className="mt-1 inline-block rounded-full bg-primary-50 px-2.5 py-0.5 text-xs font-bold text-primary-700">{bandLabels[band]}</span>
    </div>
  );
}

/** III to V: countries and sectors picked from lists, and anything else in the client's own words. */
export function ExclusionsStep({ value, onChange, field }: { value: RiskQuestionnaire; onChange: Change; field: FieldFor }) {
  const change = useChange(value, onChange);
  const left = sectors.filter((one) => !value.excludedSectors.includes(one));
  return (
    <div className="space-y-6">
      <Alert tone="info">{questionnaireText.exclusionsNote}</Alert>
      <FieldGroup title="III. Excluded jurisdictions">
        <CountriesField id="excludedCountries" label="Countries" value={value.excludedCountries} onChange={(excludedCountries) => change({ excludedCountries })} field={field} optional className="sm:col-span-2" />
      </FieldGroup>
      <FieldGroup title="IV. Excluded sectors / industries">
        <div className="space-y-2 sm:col-span-2">
          {value.excludedSectors.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {value.excludedSectors.map((one) => (
                <li key={one} className="flex items-center gap-1 rounded-full bg-primary-50 py-0.5 pr-1 pl-3 text-sm font-semibold text-primary-700">
                  {one}
                  <button type="button" aria-label={`Remove ${one}`} onClick={() => change({ excludedSectors: value.excludedSectors.filter((held) => held !== one) })} className="rounded-full p-0.5 hover:bg-primary-100">
                    <X aria-hidden="true" className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <SelectInput id="excludedSectors" aria-label="Add a sector" value="" onChange={(event) => event.target.value && change({ excludedSectors: [...value.excludedSectors, event.target.value] })}>
            <option value="">Add a sector…</option>
            {left.map((one) => (
              <option key={one} value={one}>{one}</option>
            ))}
          </SelectInput>
        </div>
        <TextField id="otherSectors" label="Other sectors, in the client's own words" value={value.otherSectors} onChange={(otherSectors) => change({ otherSectors })} field={field} optional className="sm:col-span-2" />
      </FieldGroup>
      <FieldGroup title="V. Extenuating circumstances" description={questionnaireText.circumstances}>
        <TextField id="circumstances" label="Details" value={value.circumstances} onChange={(circumstances) => change({ circumstances })} field={field} multiline optional className="sm:col-span-2" />
      </FieldGroup>
    </div>
  );
}

/** VI. Agreeing the profile worked out, or preferring a more conservative one, and the declaration. */
export function AgreementStep({ value, onChange, field }: { value: RiskQuestionnaire; onChange: Change; field: FieldFor }) {
  const change = useChange(value, onChange);
  const worked = scored(value).profile;
  if (!worked) {
    return <Alert tone="info">Answer every question in Risk Ability and Risk Tolerance first; the client agrees with the profile they give.</Alert>;
  }
  const allowed = noRiskierThan(worked);
  const counts = value.chosenProfile ? profileLabels[value.chosenProfile] : "[the profile agreed]";
  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h3 className="text-sm font-bold text-ink">Do you agree with this risk profile? ({profileLabels[worked]})</h3>
        <Boxes legend="Agrees with the profile" hideLegend error={field("agrees").error}>
          <Tick kind="radio" name="agrees" id="agrees.yes" checked={value.agrees === true} onChange={() => change({ agrees: true })} text="Yes" />
          <Tick kind="radio" name="agrees" id="agrees.no" checked={value.agrees === false} onChange={() => change({ agrees: false })} text="No, the client prefers another profile" />
        </Boxes>
        {value.agrees === false && (
          <div className="space-y-2">
            <div className="grid gap-2 sm:grid-cols-3">
              {PROFILES.map((profile) => {
                const open = allowed.includes(profile);
                const chosen = value.preferredProfile === profile;
                return (
                  <label key={profile} className={cn("flex items-center gap-2 rounded-xl border p-3 text-sm font-semibold", open ? "cursor-pointer" : "cursor-not-allowed opacity-50", chosen ? "border-primary-600 bg-primary-50/70" : "border-line bg-white")}>
                    <input type="radio" name="preferredProfile" checked={chosen} disabled={!open} onChange={() => change({ preferredProfile: profile })} className="size-4 accent-primary-600" />
                    {profileLabels[profile]}
                    {profile === worked ? " (worked out)" : !open ? " — not allowed" : ""}
                  </label>
                );
              })}
            </div>
            {field("preferredProfile").error && <p className="text-xs text-red-600">{field("preferredProfile").error}</p>}
            <p className="text-xs text-ink-muted">A client may prefer a more conservative profile than the one worked out, never a riskier one.</p>
          </div>
        )}
      </section>
      <div className="space-y-3 rounded-2xl border border-line bg-slate-50/70 px-5 py-5 text-sm leading-relaxed text-ink">
        <p className="font-semibold">Client declaration on understanding and accepting the risk profile</p>
        {questionnaireText.declaration.map((line) => (
          <p key={line}>{line.replace("{{profile}}", counts)}</p>
        ))}
      </div>
      <div>
        <Tick kind="checkbox" name="declarationConfirmed" id="declarationConfirmed" checked={value.declarationConfirmed} onChange={(on) => change({ declarationConfirmed: on })} text="The declaration above is made." />
        {field("declarationConfirmed").error && <p className="mt-1.5 text-xs text-red-600">{field("declarationConfirmed").error}</p>}
        <p className="mt-2 text-xs text-ink-muted">The client signs in the portal: an individual in their own name, each joint holder, or an entity's authorised signatories.</p>
      </div>
    </div>
  );
}

/** VII. Whether the client intends to leverage, and the notice for one who is not Aggressive. */
export function LeverageStep({ value, onChange, field }: { value: RiskQuestionnaire; onChange: Change; field: FieldFor }) {
  const change = useChange(value, onChange);
  const notice = needsLeverageNotice(value);
  const toggle = (purpose: string, on: boolean) =>
    change({ leveragePurposes: on ? [...value.leveragePurposes, purpose] : value.leveragePurposes.filter((one) => one !== purpose) });
  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h3 className="text-sm font-bold text-ink">Does the client intend to leverage against their portfolio?</h3>
        <Boxes legend="Intends to use leverage" hideLegend inline error={field("intendsLeverage").error}>
          <Tick kind="radio" name="intendsLeverage" id="intendsLeverage.yes" checked={value.intendsLeverage === true} onChange={() => change({ intendsLeverage: true })} text="Yes" />
          <Tick kind="radio" name="intendsLeverage" id="intendsLeverage.no" checked={value.intendsLeverage === false} onChange={() => change({ intendsLeverage: false })} text="No" />
        </Boxes>
      </section>
      {value.intendsLeverage === true && !notice && (
        <Alert tone="info">An Aggressive client is the one the questionnaire says may use leverage; no acknowledgement is asked of them.</Alert>
      )}
      {notice && (
        <>
          <div className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-5 text-sm leading-relaxed text-ink">
            <p className="font-semibold">Important notice for clients who intend to leverage against their portfolio</p>
            {questionnaireText.leverageNotice.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
          <section className="space-y-3">
            <h3 className="text-sm font-bold text-ink">The client will employ leverage only for</h3>
            <Boxes legend="Leverage purposes" hideLegend error={field("leveragePurposes").error}>
              {leveragePurposes.map((purpose) => (
                <Tick key={purpose.value} kind="checkbox" name="leveragePurposes" id={`leveragePurposes.${purpose.value}`} checked={value.leveragePurposes.includes(purpose.value)} onChange={(on) => toggle(purpose.value, on)} text={purpose.text} />
              ))}
            </Boxes>
            {value.leveragePurposes.includes("OTHER") && (
              <TextField id="leverageOther" label="Other needs" value={value.leverageOther} onChange={(leverageOther) => change({ leverageOther })} field={field} />
            )}
          </section>
          <div>
            <Tick kind="checkbox" name="leverageAcknowledged" id="leverageAcknowledged" checked={value.leverageAcknowledged} onChange={(on) => change({ leverageAcknowledged: on })} text="The client acknowledges they have been told the risks of leverage." />
            {field("leverageAcknowledged").error && <p className="mt-1.5 text-xs text-red-600">{field("leverageAcknowledged").error}</p>}
          </div>
        </>
      )}
    </div>
  );
}
