import { Alert, Button, IconButton, cn } from "@atomprive/ui";
import { Plus, X } from "lucide-react";
import type { ReactNode } from "react";
import { Boxes, Tick } from "../../components/form-boxes";
import { Documents, type FormDocuments } from "../../components/form-documents";
import {
  CountryField,
  DateField,
  FormSection as FieldGroup,
  SignatureField, TextField,
  type FieldFor,
} from "../../components/form-fields";
import {
  CERTIFIED_COPY_HEADING,
  CHECKLIST_NOTE,
  COMPLIANCE_HEADING,
  CONTACT_LINE,
  DATA_PROTECTION,
  DATA_PROTECTION_HEADING,
  NET_ASSETS,
  ONGOING_SCREENING,
  ON_BEHALF_OF_FIRM,
  PEP_DEFINITION,
  PRIVATE_BANKING_ONLY,
  SENSITIVE_DEFINITION,
  SIGNOFF_HEADING,
  appendixA,
  assetLines,
  certifiedCopyRules,
  checklistDocuments,
  contactDetails,
  contactWays,
  declarationWording,
  documentField,
  emptyScreeningRow,
  experienceQuestions,
  intentionsQuestions,
  liabilityLines,
  mailingAddress,
  permanentAddress,
  pepQuestion,
  sensitiveDetails,
  sensitiveQuestion,
  personalQuestions,
  privateBankingQuestions,
  professionalDetails,
  signoffConfirmations,
  wealthQuestions,
  type FirmAnswers,
  type HolderAnswers,
  type Lines,
  type PepPerson,
  type Question,
  type ScreeningRow,
} from "./customer-identification";
import { useFirmName, useFirmShortName } from "./firm-name";

const MAX_SCREENING_ROWS = 15;

function yearsFromToday(years: number) {
  const today = new Date();
  return new Date(today.getFullYear() + years, today.getMonth(), today.getDate());
}

/** The firm's own name and its short form, which the form prints through its checklist and its note. */
function withFirm(text: string, firmName: string | null, shortName: string | null) {
  return text
    .replaceAll("{{firmName}}", firmName ?? "the firm")
    .replaceAll("{{firmShortName}}", shortName ?? firmName ?? "the firm");
}

/** What every part of this form is handed: the lines of the page it is on, and how to change one of them. */
export interface AskProps {
  value: Lines;
  onChange: (patch: Partial<Lines>) => void;
  field: FieldFor;
}

/** A part that one account holder answers about themselves. */
export interface HolderAskProps extends AskProps {
  value: HolderAnswers;
  onChange: (patch: Partial<HolderAnswers>) => void;
}

/** A part the firm fills in once for the account, whoever holds it. */
export interface FirmAskProps extends AskProps {
  value: FirmAnswers;
  onChange: (patch: Partial<FirmAnswers>) => void;
}

function writing({ value, onChange }: AskProps) {
  return {
    say: (id: string, said: string) => onChange({ said: { ...value.said, [id]: said } }),
    /** Several lines at once. Saying them one after another would each start from the answers as they were. */
    sayAll: (said: Record<string, string>) => onChange({ said: { ...value.said, ...said } }),
    pick: (id: string, chosen: string[]) => onChange({ chose: { ...value.chose, [id]: chosen } }),
    confirm: (id: string, on: boolean) => onChange({ confirmed: { ...value.confirmed, [id]: on } }),
  };
}

type ChoiceQuestion = Extract<Question, { kind: "one" | "many" }>;

function printsBoxes(question: Question): question is ChoiceQuestion {
  return question.kind === "one" || question.kind === "many";
}

/** One of the form's lines, set out the way the kind of answer it asks for wants. */
function Ask({ question, at }: { question: Question; at: AskProps }) {
  const { value, field } = at;
  const { say, pick } = writing(at);
  const said = value.said[question.id] ?? "";
  const state = field(question.id);

  if (!printsBoxes(question)) {
    const note = question.note ? <p className="mt-1 text-xs text-ink-muted">{question.note}</p> : null;
    if (question.kind === "date") {
      return (
        <div>
          <DateField
            id={question.id}
            label={question.label}
            value={said}
            onChange={(next) => say(question.id, next)}
            field={field}
            min={yearsFromToday(-120)}
            max={yearsFromToday(1)}
          />
          {note}
        </div>
      );
    }
    if (question.kind === "country") {
      return (
        <div>
          <CountryField
            id={question.id}
            label={question.label}
            value={said || null}
            onChange={(next) => say(question.id, next)}
            field={field}
            optional={question.optional}
          />
          {note}
        </div>
      );
    }
    return (
      <div className="sm:col-span-2">
        <TextField
          id={question.id}
          label={question.label}
          value={said}
          onChange={(next) => say(question.id, next)}
          field={field}
          multiline={question.kind === "long"}
          optional={question.optional}
        />
        {note}
      </div>
    );
  }

  const many = question.kind === "many";
  const chosen = value.chose[question.id] ?? [];
  return (
    <div className="sm:col-span-2">
      {/* A short run of boxes the paper prints along one line stays on one line. */}
      <Boxes legend={question.label} required error={state.error} inline={!many && question.options.length <= 4}>
        {question.options.map((option) => (
          <Tick
            key={option.value}
            kind={many ? "checkbox" : "radio"}
            name={question.id}
            id={`${question.id}.${option.value}`}
            checked={many ? chosen.includes(option.value) : said === option.value}
            onChange={(on) => {
              if (many) {
                pick(question.id, on ? [...chosen, option.value] : chosen.filter((one) => one !== option.value));
              } else {
                say(question.id, option.value);
              }
              state.onBlur();
            }}
            text={option.text}
            aside={option.note ? <span className="max-w-sm text-xs text-ink-muted">{option.note}</span> : undefined}
          />
        ))}
      </Boxes>
      {/* The line the paper ends the boxes with, for something it printed no box for. */}
      {question.other && (
        <div className="mt-3">
          <TextField
            id={question.other.id}
            label={question.other.label}
            value={value.said[question.other.id] ?? ""}
            onChange={(next) => say(question.other!.id, next)}
            field={field}
            optional
          />
        </div>
      )}
    </div>
  );
}

function Questions({ questions, at, title, description }: { questions: Question[]; at: AskProps; title?: string; description?: string }) {
  return (
    <FieldGroup title={title} description={description}>
      {questions.map((question) => (
        <Ask key={question.id} question={question} at={at} />
      ))}
    </FieldGroup>
  );
}

/** "Your personal details", and the two questions the form prints under that table. */
export function PersonalStep(at: HolderAskProps) {
  return (
    <div className="space-y-6">
      <Questions questions={personalQuestions} at={at} title="Your personal details" />
      <Questions questions={permanentAddress} at={at} title="Permanent address" />
      <Questions questions={mailingAddress} at={at} title="Mailing address" />
      <Questions questions={contactDetails} at={at} title="Contact details" />
      <Questions questions={professionalDetails} at={at} title="Professional details" />

      <section className="space-y-3">
        <Ask question={pepQuestion} at={at} />
        <PepBlock at={at} />
      </section>

      <section className="space-y-3">
        <Ask question={sensitiveQuestion} at={at} />
        <SensitiveNote />
        {at.value.said["personal.sensitive"] === "YES" && (
          <div className="grid gap-4 sm:grid-cols-2">
            {/* The Details line is only asked for once the answer above it is Yes. */}
            <Ask question={{ ...sensitiveDetails, optional: false }} at={at} />
          </div>
        )}
      </section>
    </div>
  );
}

/** "About your business intentions with us". */
export function IntentionsStep(at: AskProps) {
  return (
    <div className="space-y-6">
      <Questions questions={intentionsQuestions} at={at} />
      <Questions questions={privateBankingQuestions} at={at} title={PRIVATE_BANKING_ONLY} />
    </div>
  );
}

/** "About your wealth and origin of funds". */
export function WealthStep(at: AskProps) {
  return <Questions questions={wealthQuestions} at={at} />;
}

/** The assets and liabilities table, and the net assets it comes to. */
export function AssetsStep(at: AskProps) {
  const { value, field } = at;
  const { say } = writing(at);
  const line = (id: string, label: string) => (
    <div key={id} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem_minmax(0,1fr)] sm:items-end">
      <p className="text-sm font-medium text-ink">{label}</p>
      <TextField id={`assets.${id}.usd`} label="USD" value={value.said[`assets.${id}.usd`] ?? ""} onChange={(said) => say(`assets.${id}.usd`, said)} field={field} />
      <TextField id={`assets.${id}.description`} label="Brief Description" value={value.said[`assets.${id}.description`] ?? ""} onChange={(said) => say(`assets.${id}.description`, said)} field={field} optional />
    </div>
  );
  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h3 className="text-sm font-bold text-ink">Assets</h3>
        {assetLines.map((one) => line(one.id, one.label))}
      </section>
      <section className="space-y-3">
        <h3 className="text-sm font-bold text-ink">Liabilities</h3>
        {liabilityLines.map((one) => line(one.id, one.label))}
      </section>
      <section className="space-y-3">
        <h3 className="text-sm font-bold text-ink">{NET_ASSETS}</h3>
        {line("netAssets", NET_ASSETS)}
      </section>
    </div>
  );
}

/** "Your experience and understanding of financial markets and instruments". */
export function ExperienceStep(at: AskProps) {
  return <Questions questions={experienceQuestions} at={at} />;
}

/** The Declaration, the data protection statement, and APPENDIX A the declaration sends the reader to. */
export function DeclarationStep(at: AskProps) {
  const { value, field } = at;
  const { say, confirm } = writing(at);
  const firmName = useFirmName();
  const agreed = field("declaration.agreed");
  return (
    <div className="space-y-6">
      <div className="space-y-3 rounded-2xl border border-line bg-slate-50/70 px-5 py-5 text-sm leading-relaxed text-ink">
        {declarationWording.map((paragraph, index) => (
          <p key={index}>{paragraph}</p>
        ))}
      </div>

      <div>
        <Tick
          kind="checkbox"
          name="declaration.agreed"
          id="declaration.agreed"
          checked={Boolean(value.confirmed["declaration.agreed"])}
          onChange={(on) => {
            confirm("declaration.agreed", on);
            agreed.onBlur();
          }}
          text="The declaration above is made."
        />
        {agreed.error && <p className="mt-1.5 text-xs text-red-600">{agreed.error}</p>}
      </div>

      <FieldGroup>
        <TextField id="declaration.name" label="Name:" value={value.said["declaration.name"] ?? ""} onChange={(said) => say("declaration.name", said)} field={field} />
        <DateField id="declaration.date" label="Date:" value={value.said["declaration.date"] ?? ""} onChange={(said) => say("declaration.date", said)} field={field} min={yearsFromToday(-2)} max={yearsFromToday(1)} />
        <SignatureField id="declaration.signature" label="Signature:" value={value.said["declaration.signature"] ?? ""} onChange={(said) => say("declaration.signature", said)} field={field} className="sm:col-span-2" />
      </FieldGroup>

      <section className="space-y-3">
        <h3 className="text-sm font-bold text-ink">{DATA_PROTECTION_HEADING}</h3>
        <p className="text-sm leading-relaxed text-ink-muted">{DATA_PROTECTION}</p>
      </section>

      <FieldGroup title={withFirm(ON_BEHALF_OF_FIRM, firmName, null)}>
        <TextField id="firmSide.name" label="Name:" value={value.said["firmSide.name"] ?? ""} onChange={(said) => say("firmSide.name", said)} field={field} optional />
        <TextField id="firmSide.designation" label="Designation:" value={value.said["firmSide.designation"] ?? ""} onChange={(said) => say("firmSide.designation", said)} field={field} optional />
        <DateField id="firmSide.date" label="Date:" value={value.said["firmSide.date"] ?? ""} onChange={(said) => say("firmSide.date", said)} field={field} min={yearsFromToday(-2)} max={yearsFromToday(1)} />
        <SignatureField who="the firm" id="firmSide.signature" label="Signature:" value={value.said["firmSide.signature"] ?? ""} onChange={(said) => say("firmSide.signature", said)} field={field} optional />
      </FieldGroup>

      <details className="rounded-2xl border border-line px-5 py-4">
        <summary className="cursor-pointer text-sm font-bold text-ink">
          APPENDIX A — Definition of Client Classification
        </summary>
        <div className="mt-3 space-y-2">
          {appendixA.map((block, index) => (
            <p
              key={index}
              className={cn(
                "text-sm leading-relaxed",
                block.strong ? "font-bold text-ink" : "text-ink-muted",
                block.kind === "BULLET" && "pl-6",
                block.kind === "CLAUSE" && "pl-4",
              )}
            >
              {block.number ? `${block.number} ` : block.kind === "BULLET" ? "• " : ""}
              {block.text}
            </p>
          ))}
        </div>
      </details>
    </div>
  );
}

/** "1) Checklist of required identification documents:" — the lines that ask for a copy, and the copy itself. */
export function DocumentsStep({
  at,
  where,
  formId,
  documents,
}: {
  at: HolderAskProps;
  /** Whose pages these are: each account holder provides their own identification documents. */
  where: string;
  formId: string;
  documents: FormDocuments;
}) {
  const firmName = useFirmName();
  const shortName = useFirmShortName();
  return (
    <div className="space-y-6">
      <ol className="space-y-3">
        {checklistDocuments.map((document) => {
          const state = at.field(`documents.${document.id}`);
          const held = documents.files.filter((file) => file.field === documentField(where, document.id));
          return (
            <li key={document.id} className="rounded-xl border border-line p-4">
              <div className="flex gap-3">
                <span className="text-sm font-semibold text-ink-muted">{document.number}</span>
                <div className="min-w-0 flex-1 space-y-3">
                  <p className="text-sm leading-relaxed text-ink">{withFirm(document.label, firmName, shortName)}</p>
                  <Documents formId={formId} field={documentField(where, document.id)} documents={documents} label="Attach the document" />
                  {state.error && held.length === 0 && <p className="text-xs text-red-600">{state.error}</p>}
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      <Alert tone="info">{withFirm(CHECKLIST_NOTE, firmName, shortName)}</Alert>

      <section className="space-y-2">
        <h3 className="text-sm font-bold text-ink">{CERTIFIED_COPY_HEADING}</h3>
        <ul className="list-disc space-y-2 pl-5">
          {certifiedCopyRules.map((rule, index) => (
            <li key={index} className="text-sm leading-relaxed text-ink-muted">
              {rule}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/** "2) Internal sign-off by the relationship manager", and the compliance sign-off under it. */
export function SignoffStep(at: FirmAskProps) {
  const { value, field } = at;
  const { say, confirm } = writing(at);
  const agreed = field("signoff.agreed");
  const way = field("signoff.contactWay");
  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h3 className="text-sm font-bold text-ink">{SIGNOFF_HEADING}</h3>
        <p className="text-sm leading-relaxed text-ink">{CONTACT_LINE}</p>
      </section>

      <Boxes legend="Which of them it was" required error={way.error} inline>
        {contactWays.map((one) => (
          <Tick
            key={one.value}
            kind="radio"
            name="signoff.contactWay"
            id={`signoff.contactWay.${one.value}`}
            checked={value.said["signoff.contactWay"] === one.value}
            onChange={() => {
              say("signoff.contactWay", one.value);
              way.onBlur();
            }}
            text={one.text}
          />
        ))}
      </Boxes>

      <FieldGroup>
        <DateField id="signoff.contactOn" label="on" value={value.said["signoff.contactOn"] ?? ""} onChange={(said) => say("signoff.contactOn", said)} field={field} min={yearsFromToday(-5)} max={yearsFromToday(0)} />
        <TextField id="signoff.contactPlace" label="in (place)." value={value.said["signoff.contactPlace"] ?? ""} onChange={(said) => say("signoff.contactPlace", said)} field={field} />
      </FieldGroup>

      <div className="space-y-3 rounded-2xl border border-line bg-slate-50/70 px-5 py-5 text-sm leading-relaxed text-ink">
        {signoffConfirmations.map((paragraph, index) => (
          <p key={index}>{paragraph}</p>
        ))}
      </div>

      <div>
        <Tick
          kind="checkbox"
          name="signoff.agreed"
          id="signoff.agreed"
          checked={Boolean(value.confirmed["signoff.agreed"])}
          onChange={(on) => {
            confirm("signoff.agreed", on);
            agreed.onBlur();
          }}
          text="The relationship manager confirms the above."
        />
        {agreed.error && <p className="mt-1.5 text-xs text-red-600">{agreed.error}</p>}
      </div>

      <SignatureBlock at={at} prefix="signoff" title="Relationship manager" />
      <SignatureBlock at={at} prefix="compliance" title={COMPLIANCE_HEADING} />
    </div>
  );
}

function SignatureBlock({ at, prefix, title }: { at: AskProps; prefix: string; title: string }) {
  const { value, field } = at;
  const { say } = writing(at);
  return (
    <FieldGroup title={title}>
      <TextField id={`${prefix}.name`} label="Name:" value={value.said[`${prefix}.name`] ?? ""} onChange={(said) => say(`${prefix}.name`, said)} field={field} />
      <DateField id={`${prefix}.date`} label="Date:" value={value.said[`${prefix}.date`] ?? ""} onChange={(said) => say(`${prefix}.date`, said)} field={field} min={yearsFromToday(-2)} max={yearsFromToday(1)} />
      <SignatureField who="the firm" id={`${prefix}.signature`} label="Signature:" value={value.said[`${prefix}.signature`] ?? ""} onChange={(said) => say(`${prefix}.signature`, said)} field={field} className="sm:col-span-2" />
    </FieldGroup>
  );
}

/** "Screening Results:" — whether the customer is screened on, and what each screening found. */
export function ScreeningStep(at: FirmAskProps) {
  const { value, field } = at;
  const { say, sayAll } = writing(at);
  const included = field("screening.included");
  const rows = value.screening;
  const change = (which: number, patch: Partial<ScreeningRow>) =>
    at.onChange({ screening: rows.map((row, index) => (index === which ? { ...row, ...patch } : row)) });

  return (
    <div className="space-y-6">
      <Boxes legend={ONGOING_SCREENING} required error={included.error} inline>
        {[
          { value: "YES", text: "YES, since" },
          { value: "NO", text: "NO" },
        ].map((one) => (
          <Tick
            key={one.value}
            kind="radio"
            name="screening.included"
            id={`screening.included.${one.value}`}
            checked={value.said["screening.included"] === one.value}
            onChange={() => {
              // The date belongs to the YES line, so answering NO takes back what was written on it.
              sayAll(
                one.value === "NO"
                  ? { "screening.included": "NO", "screening.since": "" }
                  : { "screening.included": one.value },
              );
              included.onBlur();
            }}
            text={one.text}
          />
        ))}
      </Boxes>

      <FieldGroup>
        {/* The paper rules the date on the YES line, so it is only open to write on once YES is the answer. */}
        <DateField
          id="screening.since"
          label="since"
          value={value.said["screening.since"] ?? ""}
          onChange={(said) => say("screening.since", said)}
          field={field}
          min={yearsFromToday(-20)}
          max={yearsFromToday(0)}
          disabled={value.said["screening.included"] !== "YES"}
        />
      </FieldGroup>

      <section className="space-y-3">
        <div className="flex items-end justify-between gap-2">
          <h3 className="text-sm font-bold text-ink">Screening Results</h3>
          <Button
            variant="secondary"
            size="sm"
            disabled={rows.length >= MAX_SCREENING_ROWS}
            onClick={() => at.onChange({ screening: [...rows, emptyScreeningRow()] })}
          >
            <Plus aria-hidden="true" />
            Add a screening
          </Button>
        </div>
        {rows.map((row, index) => (
          <div key={index} className="grid gap-3 rounded-xl border border-line p-4 sm:grid-cols-[3rem_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
            <p className="text-sm font-semibold text-ink-muted">{index + 1}</p>
            <DateField id={`screening.rows[${index}].screenedOn`} label="Date latest screening" value={row.screenedOn} onChange={(screenedOn) => change(index, { screenedOn })} field={field} min={yearsFromToday(-20)} max={yearsFromToday(0)} />
            <TextField id={`screening.rows[${index}].names`} label="Screened Names" value={row.names} onChange={(names) => change(index, { names })} field={field} optional />
            <TextField id={`screening.rows[${index}].result`} label="RESULT" value={row.result} onChange={(result) => change(index, { result })} field={field} optional />
            {rows.length > 1 && (
              <IconButton label={`Remove screening ${index + 1}`} tone="danger" onClick={() => at.onChange({ screening: rows.filter((_, which) => which !== index) })}>
                <X />
              </IconButton>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}

/** The definition the PEP question prints under itself, and the two lines it rules once the answer is Yes. */
export function PepBlock({ at }: { at: HolderAskProps }) {
  const { value, field } = at;
  const isPep = value.said["personal.pep"] === "YES";
  const change = (which: number, patch: Partial<PepPerson>) =>
    at.onChange({ pep: value.pep.map((one, index) => (index === which ? { ...one, ...patch } : one)) });
  return (
    <div className="space-y-3">
      <p className="text-xs leading-relaxed text-ink-muted">{PEP_DEFINITION}</p>
      {isPep && (
        <div className="space-y-3">
          {value.pep.map((person, index) => (
            <div key={index} className="grid gap-3 sm:grid-cols-2">
              <TextField id={`pep[${index}].name`} label="Name:" value={person.name} onChange={(name) => change(index, { name })} field={field} optional />
              <TextField id={`pep[${index}].role`} label="Function:" value={person.role} onChange={(role) => change(index, { role })} field={field} optional />
            </div>
          ))}
          {field("pep").error && <p className="text-xs text-red-600">{field("pep").error}</p>}
        </div>
      )}
    </div>
  );
}

/** The definition the sensitive industries question prints under itself. */
export function SensitiveNote(): ReactNode {
  return <p className="text-xs leading-relaxed text-ink-muted">{SENSITIVE_DEFINITION}</p>;
}
