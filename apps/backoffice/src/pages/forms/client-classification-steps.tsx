import { useFirmName } from "./firm-name";
import { Alert, Button, IconButton, cn } from "@atomprive/ui";
import { Plus, X } from "lucide-react";
import { ChoiceCards } from "../../components/choice-cards";
import { Boxes } from "../../components/form-boxes";
import { Documents, type FormDocuments } from "../../components/form-documents";
import { DateField, FollowUp, FormSection as FieldGroup, SignatureField, TextField, type FieldFor } from "../../components/form-fields";
import {
  CLIENT_AGREEMENT,
  PROOF_PROVIDED,
  accountTypes,
  assessedFootnotes,
  assessedOptions,
  classificationDeclaration,
  classificationNotes,
  clientAgreementNote,
  deemedOptions,
  emptyClassificationSigner,
  serviceBasedOptions,
  type AccountType,
  type ClassificationOption,
  type ClientClassificationEntity,
} from "./client-classification";

const MAX_ROWS = 10;

/** The firm's own name, which the form prints throughout its criteria and its declaration. */
function withFirm(text: string, firmName: string | null) {
  return firmName ? text.replaceAll("{{firmName}}", firmName) : text;
}

/**
 * One box of a classification route, with the criteria the form sets out under it. The paper keeps the letter
 * in a narrow margin column and the criteria in the wide one; here the letter stays with the line it marks.
 */
function Criterion({
  name,
  kind,
  option,
  firmName,
  checked,
  onChange,
}: {
  name: string;
  kind: "radio" | "checkbox";
  option: ClassificationOption;
  firmName: string | null;
  checked: boolean;
  onChange: (on: boolean) => void;
}) {
  const id = `${name}.${option.value}`;
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border p-3.5 transition-colors",
        checked ? "border-primary-600 bg-primary-50/70" : "border-line bg-white hover:border-primary-100",
      )}
    >
      <input
        type={kind}
        name={name}
        id={id}
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className={cn("mt-0.5 size-4 shrink-0 accent-primary-600", kind === "checkbox" && "rounded-[3px]")}
      />
      <span
        aria-hidden="true"
        className="w-7 shrink-0 font-mono text-sm leading-relaxed font-semibold text-ink-muted"
      >
        {option.mark}
      </span>
      <div className="min-w-0 flex-1">
        <label htmlFor={id} className="cursor-pointer text-sm leading-relaxed font-medium whitespace-pre-line text-ink">
          {withFirm(option.text, firmName)}
        </label>
        {option.criteria && (
          <div className="mt-1.5 space-y-1 text-sm leading-relaxed whitespace-pre-line text-ink-muted">
            {option.criteria.map((line) => (
              <p key={line}>{withFirm(line, firmName)}</p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** Who the form is for, and the type of account. */
export function ClassificationClientStep({
  client,
  onChange,
  field,
}: {
  client: ClientClassificationEntity["client"];
  onChange: (patch: Partial<ClientClassificationEntity["client"]>) => void;
  field: FieldFor;
}) {
  const firmName = useFirmName();
  return (
    <div className="space-y-6">
      {firmName && (
        <Alert tone="info">
          <div className="space-y-2">
            {classificationNotes.map((note, at) => (
              <p key={at}>{withFirm(note, firmName)}</p>
            ))}
          </div>
        </Alert>
      )}

      <FieldGroup title="Client Classification Form">
        <TextField id="client.primaryName" label="Primary Client’s full name" value={client.primaryName} onChange={(primaryName) => onChange({ primaryName })} field={field} className="sm:col-span-2" />
        <TextField id="client.jointName" label="Joint Holder’s full name, if applicable" value={client.jointName} onChange={(jointName) => onChange({ jointName })} field={field} optional className="sm:col-span-2" />
      </FieldGroup>

      <ChoiceCards
        name="client.accountType"
        legend="Account Type (please delete or circle, as relevant):"
        required
        compact
        value={client.accountType}
        onChange={(picked) => onChange({ accountType: picked as AccountType })}
        choices={accountTypes}
        columns="sm:grid-cols-3 lg:grid-cols-5"
        error={field("client.accountType").error}
      />
    </div>
  );
}

/** The form heads the narrow column of boxes down the side of each of its three tables. */
function TickColumn() {
  return (
    <p className="text-right text-2xs font-semibold tracking-wider text-ink-muted uppercase">Tick approp box</p>
  );
}

/** The three routes to a Professional Client, each with the form's own criteria under its boxes. */
export function ProfessionalClientStep({
  value,
  formId,
  documents,
  onChange,
  field,
}: {
  value: ClientClassificationEntity;
  formId: string;
  documents: FormDocuments;
  onChange: (patch: Partial<ClientClassificationEntity>) => void;
  field: FieldFor;
}) {
  const firmName = useFirmName();
  const problem = field("classification").error;
  const route = assessedOptions.find((one) => one.value === value.assessed);

  return (
    <div className="space-y-7">
      {problem && <Alert tone="danger">{problem}</Alert>}

      <section className="space-y-3">
        <Boxes legend="1. Assessed Professional Client:">
          <p className="text-sm text-ink-muted">Please choose the description that fits you:</p>
          <TickColumn />
          {assessedOptions.map((option) => (
            <Criterion
              key={option.value}
              name="assessed"
              kind="radio"
              option={option}
              firmName={firmName}
              checked={value.assessed === option.value}
              // The form says to choose one description, so choosing another puts the last one back.
              onChange={() => onChange({ assessed: value.assessed === option.value ? null : option.value })}
            />
          ))}
        </Boxes>
        {/* The criteria above say the firm has been provided with sufficient proof, so it goes here. */}
        {route?.needsProof && (
          <div className="space-y-2 rounded-xl border border-primary-100 bg-primary-50/50 p-4">
            <p className="text-sm font-semibold text-ink">
              Sufficient proof thereof, as {route.mark} requires
            </p>
            <Documents formId={formId} field={PROOF_PROVIDED} documents={documents} label="Attach the proof" />
            {field(PROOF_PROVIDED).error && <p className="text-xs text-amber-700">{field(PROOF_PROVIDED).error}</p>}
          </div>
        )}
        <Footnotes />
      </section>

      <Boxes legend="2. A Deemed Professional Client:">
        <p className="text-sm text-ink-muted">An undertaking that satisfies any of the following conditions:</p>
        <TickColumn />
        {deemedOptions.map((option) => (
          <Criterion
            key={option.value}
            name="deemed"
            kind="checkbox"
            option={option}
            firmName={firmName}
            checked={value.deemed.includes(option.value)}
            onChange={(on) =>
              onChange({
                deemed: on
                  ? [...value.deemed, option.value]
                  : value.deemed.filter((held) => held !== option.value),
              })
            }
          />
        ))}
      </Boxes>

      <Boxes legend="3. Service-based Professional Client:">
        <TickColumn />
        {serviceBasedOptions.map((option) => (
          <Criterion
            key={option.value}
            name="serviceBased"
            kind="radio"
            option={option}
            firmName={firmName}
            checked={value.serviceBased === option.value}
            onChange={() => onChange({ serviceBased: value.serviceBased === option.value ? null : option.value })}
          />
        ))}
      </Boxes>
    </div>
  );
}

/** The five footnotes the form prints under the assessed criteria, kept with the criteria that use them. */
function Footnotes() {
  return (
    <div className="space-y-1.5 rounded-xl border border-line bg-slate-50/70 px-4 py-3">
      {assessedFootnotes.map((note) => (
        <div key={note.mark} className="flex gap-2.5 text-sm leading-relaxed text-ink-muted">
          {/* The mark is set on the line here rather than above it, so every note's text starts together. */}
          <span aria-hidden="true" className="w-3.5 shrink-0 text-right font-semibold text-ink">
            {onTheLine(note.mark)}
          </span>
          <div className="min-w-0 flex-1">
            <p>{note.text}</p>
            {note.clauses && (
              <ul className="mt-1 space-y-1 pl-5">
                {note.clauses.map((clause) => (
                  <li key={clause}>{clause}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/** What the client acknowledges by signing, a) to l), and who signs. */
export function ClassificationDeclarationStep({
  declaration,
  formId,
  documents,
  onChange,
  field,
}: {
  declaration: ClientClassificationEntity["declaration"];
  formId: string;
  documents: FormDocuments;
  onChange: (patch: Partial<ClientClassificationEntity["declaration"]>) => void;
  field: FieldFor;
}) {
  const firmName = useFirmName();
  const signers = declaration.signers;
  const change = (at: number, patch: Partial<(typeof signers)[number]>) =>
    onChange({ signers: signers.map((row, which) => (which === at ? { ...row, ...patch } : row)) });
  const confirmed = field("declaration.confirmed");

  return (
    <div className="space-y-6">
      <div className="space-y-3 rounded-2xl border border-line bg-slate-50/70 px-5 py-5 text-sm leading-relaxed text-ink">
        {firmName ? (
          <>
            {classificationDeclaration.map((clause) => (
              <div key={clause.mark} className="flex gap-3">
                <span aria-hidden="true" className="w-6 shrink-0 font-mono text-xs text-ink-muted">
                  {clause.mark}
                </span>
                <div className="min-w-0 flex-1">
                  <p>{withFirm(clause.text, firmName)}</p>
                  {clause.bullets && (
                    <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-ink-muted">
                      {clause.bullets.map((bullet) => (
                        <li key={bullet}>{bullet}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ))}
            <p className="border-t border-line pt-3">{withFirm(clientAgreementNote, firmName)}</p>
          </>
        ) : (
          <p className="text-ink-muted">Reading the declaration…</p>
        )}
      </div>

      <div>
        <label
          className={cn(
            "flex cursor-pointer items-start gap-3 rounded-xl border p-4 text-sm transition-colors",
            declaration.confirmed ? "border-primary-600 bg-primary-50/70" : "border-line bg-white hover:border-primary-100",
          )}
        >
          <input
            type="checkbox"
            checked={declaration.confirmed}
            onBlur={confirmed.onBlur}
            onChange={(event) => onChange({ confirmed: event.target.checked })}
            className="mt-0.5 size-4 rounded-[3px] accent-primary-600"
          />
          <span className="font-semibold text-ink">The declaration above is made.</span>
        </label>
        {confirmed.error && <p className="mt-1.5 text-xs text-red-600">{confirmed.error}</p>}
      </div>

      <div className="space-y-2 rounded-xl border border-line bg-slate-50/70 p-4">
        <p className="text-sm font-semibold text-ink">Schedule a — the client agreement</p>
        <p className="text-xs leading-relaxed text-ink-muted">
          {withFirm(
            "{{firmName}}’s client agreement (attached as schedule a to this form) will govern the relationship between us and will take effect from the date you sign this form.",
            firmName,
          )}{" "}
          The copy attached here is the one that goes to the client with this form, so the record shows which
          agreement they signed against.
        </p>
        <Documents formId={formId} field={CLIENT_AGREEMENT} documents={documents} label="Attach the client agreement" />
        {field(CLIENT_AGREEMENT).error && <p className="text-xs text-amber-700">{field(CLIENT_AGREEMENT).error}</p>}
      </div>

      <FieldGroup
        title="SIGNATURES"
        description="Signed for the CLIENT"
        action={
          <Button variant="secondary" size="sm" disabled={signers.length >= MAX_ROWS} onClick={() => onChange({ signers: [...signers, emptyClassificationSigner()] })}>
            <Plus aria-hidden="true" />
            Add a signatory
          </Button>
        }
      >
        {signers.map((signer, at) => (
          <FollowUp key={at} title={`Signed for the CLIENT ${at + 1}`}>
            <SignatureField id={`declaration.signers[${at}].signature`} label="By" value={signer.signature} onChange={(signature) => change(at, { signature })} field={field} className="sm:col-span-2" />
            <TextField id={`declaration.signers[${at}].name`} label="(Name)" value={signer.name} onChange={(name) => change(at, { name })} field={field} />
            <TextField id={`declaration.signers[${at}].title`} label="(Title)" value={signer.title} onChange={(title) => change(at, { title })} field={field} />
            <DateField id={`declaration.signers[${at}].signedOn`} label="(Date)" value={signer.signedOn} onChange={(signedOn) => change(at, { signedOn })} field={field} min={yearsFromToday(-2)} max={yearsFromToday(1)} className="sm:col-span-2" />
            {signers.length > 1 && (
              <div className="sm:col-span-2">
                <IconButton label={`Remove signatory ${at + 1}`} tone="danger" onClick={() => onChange({ signers: signers.filter((_, which) => which !== at) })}>
                  <X />
                </IconButton>
              </div>
            )}
          </FollowUp>
        ))}
      </FieldGroup>
    </div>
  );
}

/** The form's raised footnote mark, as the plain figure a footnote list sets it on the line. */
const ON_THE_LINE: Record<string, string> = {
  "\u00B9": "1",
  "\u00B2": "2",
  "\u00B3": "3",
  "\u2074": "4",
  "\u2075": "5",
};

function onTheLine(mark: string) {
  return ON_THE_LINE[mark] ?? mark;
}

function yearsFromToday(years: number) {
  const today = new Date();
  return new Date(today.getFullYear() + years, today.getMonth(), today.getDate());
}
