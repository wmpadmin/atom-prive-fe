import { useFirmName } from "./firm-name";
import { Alert, Button, IconButton, TextArea, cn } from "@atomprive/ui";
import { Plus, X } from "lucide-react";
import { Boxes, Tick } from "../../components/form-boxes";
import { DateField, FollowUp, FormSection as FieldGroup, TextField, type FieldFor } from "../../components/form-fields";
import {
  allProducts,
  assessmentMatters,
  emptySignOff,
  derivedProfile,
  experienceHeading,
  experienceLabels,
  knowledgeHeading,
  knowledgeLabels,
  noMoreThan,
  productTypes,
  profiles,
  riskProfileNotes,
  riskQuestions,
  riskScenarios,
  riskToleranceQuestion,
  scenarioRows,
  scoreOf,
  type Experience,
  type InvestmentRiskProfileEntity,
  type Knowledge,
  type Profile,
  type RiskQuestion,
  type SignOff,
} from "./investment-risk-profile";

const MAX_ROWS = 6;

function yearsFromToday(years: number) {
  const today = new Date();
  return new Date(today.getFullYear() + years, today.getMonth(), today.getDate());
}

/** One numbered question, with the answers the form prints under it and the score it carries. */
function Question({
  question,
  chosen,
  onChange,
  field,
}: {
  question: RiskQuestion;
  chosen: string | undefined;
  onChange: (value: string) => void;
  field: FieldFor;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-sm font-bold text-ink">
          {question.number} {question.heading}
        </h3>
        {question.ask && <p className="mt-0.5 text-sm text-ink-muted">{question.ask}</p>}
      </div>
      <div className="flex items-end justify-between gap-3">
        <p className="text-sm font-bold text-ink">Description</p>
        {question.options.some((option) => option.score !== undefined) && (
          <p className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">Score</p>
        )}
      </div>
      <Boxes legend="Description" hideLegend error={field(`answers.${question.id}`).error}>
        {question.options.map((option) => (
          <Tick
            key={option.value}
            kind="radio"
            name={`answers.${question.id}`}
            id={`answers.${question.id}.${option.value}`}
            checked={chosen === option.value}
            onChange={() => onChange(option.value)}
            text={option.text}
            // The form prints a Score column beside every answer; it is kept with the answer it belongs to.
            aside={option.score === undefined ? undefined : <Score value={option.score} />}
          />
        ))}
      </Boxes>
      {question.notes?.map((note) => (
        <p key={note} className="text-xs leading-relaxed text-ink-muted">
          {note}
        </p>
      ))}
    </section>
  );
}

/** Who the Investment Risk Profile is for. */
export function RiskCustomerStep({
  value,
  onChange,
  field,
}: {
  value: InvestmentRiskProfileEntity;
  onChange: (patch: Partial<InvestmentRiskProfileEntity>) => void;
  field: FieldFor;
}) {
  const firmName = useFirmName();
  return (
    <div className="space-y-6">
      <Alert tone="info">{riskProfileNotes.intro}</Alert>
      <FieldGroup title="Investment Risk Profile Form (IRP)">
        <TextField id="customerName" label="Customer Name" value={value.customerName} onChange={(customerName) => onChange({ customerName })} field={field} multiline className="sm:col-span-2" />
      </FieldGroup>
      {firmName && <p className="text-xs text-ink-muted">Completed for {firmName}.</p>}
    </div>
  );
}

/** Whichever of the numbered questions this part of the form asks. */
export function RiskQuestionsStep({
  ids,
  value,
  onChange,
  field,
}: {
  ids: string[];
  value: InvestmentRiskProfileEntity;
  onChange: (patch: Partial<InvestmentRiskProfileEntity>) => void;
  field: FieldFor;
}) {
  const answer = (id: string, picked: string) => onChange({ answers: { ...value.answers, [id]: picked } });
  return (
    <div className="space-y-8">
      {ids.map((id) => {
        if (id === "q5") {
          return <ScenarioQuestion key={id} value={value} onChange={answer} field={field} />;
        }
        const question = riskQuestions.find((one) => one.id === id);
        return question ? (
          <Question
            key={id}
            question={question}
            chosen={value.answers[id]}
            onChange={(picked) => answer(id, picked)}
            field={field}
          />
        ) : null;
      })}
    </div>
  );
}

/** 5. The form draws five scenarios across the page; here each one is a card showing both its figures. */
function ScenarioQuestion({
  value,
  onChange,
  field,
}: {
  value: InvestmentRiskProfileEntity;
  onChange: (id: string, picked: string) => void;
  field: FieldFor;
}) {
  const chosen = value.answers["q5"];
  const problem = field("answers.q5").error;
  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-sm font-bold text-ink">
          {riskToleranceQuestion.number} {riskToleranceQuestion.heading}
        </h3>
        <p className="mt-0.5 text-sm text-ink-muted">{riskToleranceQuestion.ask}</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        {riskScenarios.map((scenario) => {
          const on = chosen === scenario.value;
          return (
            <label
              key={scenario.value}
              className={cn(
                "flex cursor-pointer flex-col gap-2 rounded-xl border p-3.5 transition-colors",
                on ? "border-primary-600 bg-primary-50/70" : "border-line bg-white hover:border-primary-100",
              )}
            >
              <span className="flex items-center gap-2">
                <input
                  type="radio"
                  name="answers.q5"
                  checked={on}
                  onChange={() => onChange("q5", scenario.value)}
                  className="size-4 accent-primary-600"
                />
                <span className="text-sm font-semibold text-ink">{scenario.label}</span>
              </span>
              <span className="block">
                <span className="block text-2xs tracking-wider text-ink-muted uppercase">{scenarioRows.target}</span>
                <span className="block text-sm font-semibold text-ink">{scenario.targetReturn}</span>
              </span>
              <span className="block">
                <span className="block text-2xs tracking-wider text-ink-muted uppercase">{scenarioRows.range}</span>
                <span className="block text-sm font-semibold text-ink">{scenario.rangeOfReturns}</span>
              </span>
              <span className="block">
                <span className="block text-2xs tracking-wider text-ink-muted uppercase">Score</span>
                <span className="block text-sm font-semibold text-ink">{scenario.score}</span>
              </span>
            </label>
          );
        })}
      </div>
      {problem && <p className="text-xs text-red-600">{problem}</p>}
      {riskToleranceQuestion.notes.map((note) => (
        <p key={note} className="text-xs leading-relaxed text-ink-muted">
          {note}
        </p>
      ))}
    </section>
  );
}

/**
 * 3. Product knowledge and experience. The form asks this twice over — one table for experience, another for
 * knowledge, both listing the same twenty products in the same order — so here each product is asked once.
 */
export function ProductKnowledgeStep({
  value,
  onChange,
  field,
}: {
  value: InvestmentRiskProfileEntity;
  onChange: (patch: Partial<InvestmentRiskProfileEntity>) => void;
  field: FieldFor;
}) {
  const set = (product: string, patch: { experience?: Experience; knowledge?: Knowledge }) => {
    const held = value.products[product] ?? { experience: null, knowledge: null };
    onChange({ products: { ...value.products, [product]: { ...held, ...patch } } });
  };
  const missing = allProducts.filter((product) => !value.products[product]?.experience || !value.products[product]?.knowledge);

  return (
    <div className="space-y-6">
      <p className="text-sm text-ink-muted">Provide details of the knowledge and experience.</p>
      {missing.length > 0 && (
        <p className="text-xs text-amber-700">
          {missing.length} of {allProducts.length} products still to answer.
        </p>
      )}

      <div className="sticky top-0 z-10 hidden gap-3 rounded-lg bg-canvas/95 px-3.5 py-2 backdrop-blur lg:grid lg:grid-cols-[minmax(16rem,1fr)_10rem_15rem]">
        <span className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">Investment products</span>
        <span className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">{experienceHeading}</span>
        <span className="text-2xs font-semibold tracking-wider whitespace-pre-line text-ink-muted uppercase">
          {knowledgeHeading}
        </span>
      </div>

      {productTypes.map((group) => (
        <section key={group.type} className="space-y-2">
          <h3 className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">Product type {group.type}</h3>
          <ul className="space-y-2">
            {group.products.map((product) => {
              const held = value.products[product];
              const wanting = !held?.experience || !held?.knowledge;
              return (
                <li
                  key={product}
                  className={cn(
                    "grid gap-3 rounded-xl border p-3.5 lg:grid-cols-[minmax(16rem,1fr)_10rem_15rem] lg:items-center",
                    wanting ? "border-line bg-white" : "border-primary-100 bg-primary-50/40",
                  )}
                >
                  <span className="text-sm font-medium text-ink">{product}</span>
                  <Pick
                    legend={experienceHeading}
                    name={`products.${product}.experience`}
                    options={(Object.keys(experienceLabels) as Experience[]).map((held) => ({
                      value: held,
                      label: experienceLabels[held],
                    }))}
                    chosen={held?.experience ?? null}
                    onChange={(picked) => set(product, { experience: picked as Experience })}
                    error={field(`products.${product}.experience`).error}
                  />
                  <Pick
                    legend={knowledgeHeading}
                    name={`products.${product}.knowledge`}
                    options={(Object.keys(knowledgeLabels) as Knowledge[]).map((held) => ({
                      value: held,
                      label: knowledgeLabels[held],
                    }))}
                    chosen={held?.knowledge ?? null}
                    onChange={(picked) => set(product, { knowledge: picked as Knowledge })}
                    error={field(`products.${product}.knowledge`).error}
                  />
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** A short row of choices, for a question the form asks of every product in a list. */
function Pick({
  legend,
  name,
  options,
  chosen,
  onChange,
  error,
}: {
  legend: string;
  name: string;
  options: { value: string; label: string }[];
  chosen: string | null;
  onChange: (value: string) => void;
  error?: string;
}) {
  return (
    <fieldset>
      <legend className="mb-1 text-2xs tracking-wider whitespace-pre-line text-ink-muted uppercase lg:sr-only">
        {legend}
      </legend>
      <div className="flex gap-1.5">
        {options.map((option) => (
          <label
            key={option.value}
            className={cn(
              "cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
              chosen === option.value
                ? "border-primary-600 bg-primary-600 text-white"
                : "border-line bg-white text-ink hover:border-primary-100",
              error && !chosen && "border-red-300",
            )}
          >
            <input
              type="radio"
              name={name}
              checked={chosen === option.value}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** The rating the answers come to, and what the firm makes of the client's knowledge and experience. */
export function RiskRatingStep({
  value,
  onChange,
  field,
}: {
  value: InvestmentRiskProfileEntity;
  onChange: (patch: Partial<InvestmentRiskProfileEntity>) => void;
  field: FieldFor;
}) {
  const score = scoreOf(value);
  const derived = derivedProfile(value);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-line bg-white px-5 py-5">
        <h3 className="text-sm font-bold text-ink">Investment Risk Rating</h3>
        <p className="mt-4 text-3xl font-bold text-ink">
          {score}
          <span className="ml-2 align-middle text-sm font-medium text-ink-muted">
            {derived ? "Score, from the answers given" : "Score so far — some questions are still to be answered"}
          </span>
        </p>
        {/* The form prints its bands across the page with a box under each; the score points at one of them. */}
        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          {profiles.map((profile) => {
            const isDerived = derived === profile.value;
            const ticked = value.ratingProfile === profile.value;
            return (
              <label
                key={profile.value}
                className={cn(
                  "flex cursor-pointer flex-col gap-1 rounded-xl border p-3.5 transition-colors",
                  ticked ? "border-primary-600 bg-primary-50/70" : "border-line bg-white hover:border-primary-100",
                )}
              >
                <span className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="ratingProfile"
                    checked={ticked}
                    onChange={() => onChange({ ratingProfile: profile.value as Profile })}
                    className="size-4 accent-primary-600"
                  />
                  <span className="text-sm font-semibold text-ink">{profile.label}</span>
                </span>
                <span className="font-mono text-xs text-ink-muted">Score {profile.band}</span>
                {isDerived && (
                  <span className="text-2xs font-semibold tracking-wider text-primary-600 uppercase">
                    The score these answers come to
                  </span>
                )}
              </label>
            );
          })}
        </div>
        {field("ratingProfile").error && <p className="mt-2 text-xs text-red-600">{field("ratingProfile").error}</p>}
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-bold text-ink">14. Assessment of knowledge and experience</h3>
        {/* The form rules two columns here, Description and Assessment, and prints each matter as a sentence. */}
        <div className="hidden gap-4 px-3.5 sm:grid sm:grid-cols-[1fr_18rem]">
          <p className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">Description</p>
          <p className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">Assessment</p>
        </div>
        <ul className="space-y-2">
          {assessmentMatters.map((matter) => (
            <Assessed
              key={matter.value}
              id={`assessment.${matter.value}`}
              text={matter.text}
              value={value.assessment[matter.value] ?? ""}
              onChange={(written) => onChange({ assessment: { ...value.assessment, [matter.value]: written } })}
              field={field}
            />
          ))}
        </ul>
      </section>
    </div>
  );
}

/** Acknowledgement for Investment Risk Profiling, and who signs off. */
export function RiskAcknowledgementStep({
  value,
  onChange,
  field,
}: {
  value: InvestmentRiskProfileEntity;
  onChange: (patch: Partial<InvestmentRiskProfileEntity>) => void;
  field: FieldFor;
}) {
  const firmName = useFirmName();
  const held = value.acknowledgement;
  const allowed = noMoreThan(value.ratingProfile ?? derivedProfile(value));
  const set = (patch: Partial<InvestmentRiskProfileEntity["acknowledgement"]>) =>
    onChange({ acknowledgement: { ...held, ...patch } });
  const confirmed = field("acknowledgement.confirmed");

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h3 className="text-sm font-bold text-ink">Investment Risk Profile Derived from Your Answers</h3>
        <p className="text-sm text-ink-muted">{riskProfileNotes.derived}</p>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          {profiles.map((profile) => {
            const chosen = value.chosenProfile === profile.value;
            const open = allowed.includes(profile.value);
            return (
              <label
                key={profile.value}
                className={cn(
                  "flex flex-col gap-1.5 rounded-xl border p-3.5 transition-colors",
                  open ? "cursor-pointer" : "cursor-not-allowed opacity-50",
                  chosen ? "border-primary-600 bg-primary-50/70" : "border-line bg-white",
                )}
              >
                <span className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="chosenProfile"
                    checked={chosen}
                    disabled={!open}
                    onChange={() => onChange({ chosenProfile: profile.value as Profile })}
                    className="size-4 accent-primary-600"
                  />
                  <span className="text-sm font-semibold text-ink">{profile.label}</span>
                </span>
                <span className="text-xs leading-relaxed whitespace-pre-line text-ink-muted">{profile.means}</span>
              </label>
            );
          })}
        </div>
        {field("chosenProfile").error && <p className="text-xs text-red-600">{field("chosenProfile").error}</p>}
        <p className="text-xs leading-relaxed text-ink-muted">{riskProfileNotes.lower}</p>
      </section>

      <div className="space-y-3 rounded-2xl border border-line bg-slate-50/70 px-5 py-5 text-sm leading-relaxed text-ink">
        <p className="font-semibold">Confirmation of Your Investment Profile</p>
        {riskProfileNotes.confirmation.map((line, at) => (
          <p key={at}>{firmName ? line.replaceAll("{{firmName}}", firmName) : line}</p>
        ))}
      </div>

      <div>
        <Tick
          kind="checkbox"
          name="acknowledgement.confirmed"
          id="acknowledgement.confirmed"
          checked={held.confirmed}
          onChange={(on) => {
            set({ confirmed: on });
            confirmed.onBlur();
          }}
          text="The confirmation above is made."
        />
        {confirmed.error && <p className="mt-1.5 text-xs text-red-600">{confirmed.error}</p>}
      </div>

      <section className="space-y-4">
        <h3 className="text-sm font-bold text-ink">Customer Profiling Acknowledgement</h3>
        <p className="text-sm font-semibold text-ink-muted">Customer Sign off</p>
        <SignOffs
          title="For Individual / Joint Accounts:"
          label="Account holder Name"
          at="accountHolders"
          rows={held.accountHolders}
          onChange={(accountHolders) => set({ accountHolders })}
          field={field}
        />
        <SignOffs
          title="For Companies:"
          label="Authorised Individual Name"
          at="authorisedIndividuals"
          rows={held.authorisedIndividuals}
          onChange={(authorisedIndividuals) => set({ authorisedIndividuals })}
          field={field}
        />
        {field("acknowledgement.signOff").error && (
          <p className="text-xs text-red-600">{field("acknowledgement.signOff").error}</p>
        )}
      </section>

      <section className="space-y-3 rounded-2xl border border-line bg-white px-5 py-5">
        <h3 className="text-sm font-bold text-ink">RM Sign off</h3>
        <p className="text-sm leading-relaxed text-ink-muted">{riskProfileNotes.relationshipManager}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField id="acknowledgement.relationshipManager.name" label="Relationship Manager Name" value={held.relationshipManager.name} onChange={(name) => set({ relationshipManager: { ...held.relationshipManager, name } })} field={field} />
          <DateField id="acknowledgement.relationshipManager.signedOn" label="Date:" value={held.relationshipManager.signedOn} onChange={(signedOn) => set({ relationshipManager: { ...held.relationshipManager, signedOn } })} field={field} min={yearsFromToday(-5)} max={yearsFromToday(1)} />
          <TextField id="acknowledgement.relationshipManager.signOff" label="Sign off:" value={held.relationshipManager.signOff} onChange={(signOff) => set({ relationshipManager: { ...held.relationshipManager, signOff } })} field={field} placeholder="Type the full name" className="sm:col-span-2" />
        </div>
      </section>
    </div>
  );
}

/** One of the form's sign-off blocks: a name, and the Date and Sign off it rules beside each one. */
function SignOffs({
  title,
  label,
  at,
  rows,
  onChange,
  field,
}: {
  title: string;
  label: string;
  at: string;
  rows: SignOff[];
  onChange: (rows: SignOff[]) => void;
  field: FieldFor;
}) {
  const set = (index: number, patch: Partial<SignOff>) =>
    onChange(rows.map((held, which) => (which === index ? { ...held, ...patch } : held)));
  return (
    <FieldGroup
      title={title}
      action={
        <Button variant="secondary" size="sm" disabled={rows.length >= MAX_ROWS} onClick={() => onChange([...rows, emptySignOff()])}>
          <Plus aria-hidden="true" />
          Add a name
        </Button>
      }
    >
      {rows.length === 0 ? (
        <p className="text-sm text-ink-muted sm:col-span-2">Nobody added — this block does not apply.</p>
      ) : (
        rows.map((row, index) => (
          <FollowUp key={index} title={`${label} ${index + 1}`}>
            <TextField id={`acknowledgement.${at}[${index}].name`} label={label} value={row.name} onChange={(name) => set(index, { name })} field={field} optional />
            <DateField id={`acknowledgement.${at}[${index}].signedOn`} label="Date:" value={row.signedOn} onChange={(signedOn) => set(index, { signedOn })} field={field} min={yearsFromToday(-5)} max={yearsFromToday(1)} />
            <TextField id={`acknowledgement.${at}[${index}].signOff`} label="Sign off:" value={row.signOff} onChange={(signOff) => set(index, { signOff })} field={field} placeholder="Type the full name" optional />
            <div className="self-end pb-1">
              <IconButton label={`Remove ${label} ${index + 1}`} tone="danger" onClick={() => onChange(rows.filter((_, which) => which !== index))}>
                <X />
              </IconButton>
            </div>
          </FollowUp>
        ))
      )}
    </FieldGroup>
  );
}

/** One row of the form's Description and Assessment table: the matter as it reads, and the box beside it. */
function Assessed({
  id,
  text,
  value,
  onChange,
  field,
}: {
  id: string;
  text: string;
  value: string;
  onChange: (written: string) => void;
  field: FieldFor;
}) {
  const { error, onBlur } = field(id);
  return (
    <li className="grid gap-3 rounded-xl border border-line bg-white p-3.5 sm:grid-cols-[1fr_18rem] sm:items-start sm:gap-4">
      <label htmlFor={id} className="text-sm leading-relaxed text-ink">
        {text}
      </label>
      <div>
        <TextArea
          id={id}
          value={value}
          rows={3}
          required
          autoComplete="off"
          aria-invalid={error ? true : undefined}
          onBlur={onBlur}
          onChange={(event) => onChange(event.target.value)}
        />
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      </div>
    </li>
  );
}

/** The figure the form prints in its Score column, beside the answer it belongs to. */
function Score({ value }: { value: number }) {
  return (
    <span className="mt-0.5 w-8 shrink-0 text-right font-mono text-sm font-semibold text-ink-muted">{value}</span>
  );
}
