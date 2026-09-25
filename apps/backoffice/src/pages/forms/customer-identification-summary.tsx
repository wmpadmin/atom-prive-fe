import type { AttachedFile } from "@atomprive/api-client/backoffice";
import { Button } from "@atomprive/ui";
import { PencilLine } from "lucide-react";
import type { ReactNode } from "react";
import { countryName } from "../../lib/countries";
import { formatDate, formatFileSize } from "../../lib/labels";
import {
  assetLines,
  checklistDocuments,
  documentField,
  experienceQuestions,
  intentionsPart,
  liabilityLines,
  personalPart,
  wealthQuestions,
  type CustomerIdentification,
  type Question,
} from "./customer-identification";
import { signatureText } from "./made-signature";

const MISSING = "—";

/** What was answered on a line, read back in the form's own words rather than the value behind them. */
function answerTo(question: Question, value: CustomerIdentification) {
  if (question.kind === "many") {
    const chosen = question.options.filter((one) => (value.chose[question.id] ?? []).includes(one.value));
    const other = question.other ? value.said[question.other.id]?.trim() : "";
    const said = [...chosen.map((one) => one.text), ...(other ? [other] : [])];
    return said.length > 0 ? said.join(", ") : MISSING;
  }
  const said = value.said[question.id]?.trim();
  if (!said) return MISSING;
  if (question.kind === "one") return question.options.find((one) => one.value === said)?.text ?? said;
  if (question.kind === "date") return formatDate(said);
  if (question.kind === "country") return countryName(said);
  return said;
}

/** Everything the customer identification form asks for, as it was answered. */
export function CustomerIdentificationSummary({
  value,
  attachments,
  onEdit,
}: {
  value: CustomerIdentification;
  attachments: AttachedFile[];
  onEdit?: (stepId: string) => void;
}) {
  const said = (id: string) => value.said[id]?.trim() || MISSING;
  const onDate = (id: string) => (value.said[id]?.trim() ? formatDate(value.said[id]!) : MISSING);
  return (
    <div className="space-y-5">
      <Part title="Your personal details" stepId="personal" onEdit={onEdit}>
        <Answers questions={personalPart} value={value} />
        {value.said["personal.pep"] === "YES" &&
          value.pep
            .filter((one) => one.name.trim())
            .map((one, at) => <Fact key={at} label="Politically Exposed Person" value={`${one.name} · ${one.role || MISSING}`} wide />)}
      </Part>

      <Part title="About your business intentions with us" stepId="intentions" onEdit={onEdit}>
        <Answers questions={intentionsPart} value={value} />
      </Part>

      <Part title="About your wealth and origin of funds" stepId="wealth" onEdit={onEdit}>
        <Answers questions={wealthQuestions} value={value} />
      </Part>

      <Part title="Assets and liabilities" stepId="assets" onEdit={onEdit}>
        {[...assetLines, ...liabilityLines, { id: "netAssets", label: "Net Assets" }].map((line) => (
          <Fact
            key={line.id}
            label={line.label}
            value={`${said(`assets.${line.id}.usd`)}${value.said[`assets.${line.id}.description`]?.trim() ? ` · ${value.said[`assets.${line.id}.description`]}` : ""}`}
            wide
          />
        ))}
      </Part>

      <Part title="Your experience and understanding of financial markets and instruments" stepId="experience" onEdit={onEdit}>
        <Answers questions={experienceQuestions} value={value} />
      </Part>

      <Part title="Declaration" stepId="declaration" onEdit={onEdit}>
        <Fact label="Declaration" value={value.confirmed["declaration.agreed"] ? "Made" : "Not yet made"} />
        <Fact label="Name" value={said("declaration.name")} />
        <Fact label="Date" value={onDate("declaration.date")} />
        <Fact label="Signature" value={signatureText(said("declaration.signature"))} />
      </Part>

      <Part title="Checklist of required identification documents" stepId="documents" onEdit={onEdit}>
        {checklistDocuments.map((document) => {
          const held = attachments.filter((file) => file.field === documentField(document.id));
          return (
            <Fact
              key={document.id}
              label={`${document.number}.`}
              wide
              value={
                held.length === 0
                  ? "not attached yet"
                  : held.map((file) => `${file.fileName} (${formatFileSize(file.sizeBytes)})`).join(", ")
              }
            />
          );
        })}
      </Part>

      <Part title="Internal sign-off" stepId="signoff" onEdit={onEdit}>
        <Fact label="Contact with the customer" value={`${said("signoff.contactWay")} · ${onDate("signoff.contactOn")} · ${said("signoff.contactPlace")}`} wide />
        <Fact label="Relationship manager" value={`${said("signoff.name")} · ${onDate("signoff.date")} · ${signatureText(said("signoff.signature"))}`} wide />
        <Fact label="Compliance Officer and MLRO" value={`${said("compliance.name")} · ${onDate("compliance.date")} · ${signatureText(said("compliance.signature"))}`} wide />
      </Part>

      <Part title="Screening Results" stepId="screening" onEdit={onEdit}>
        <Fact
          label="Included on Ongoing Screening?"
          value={value.said["screening.included"] === "YES" ? `YES, since ${onDate("screening.since")}` : value.said["screening.included"] === "NO" ? "NO" : MISSING}
          wide
        />
        {value.screening
          .filter((row) => row.screenedOn.trim() || row.names.trim() || row.result.trim())
          .map((row, at) => (
            <Fact key={at} label={`Screening ${at + 1}`} value={`${row.screenedOn ? formatDate(row.screenedOn) : MISSING} · ${row.names || MISSING} · ${row.result || MISSING}`} wide />
          ))}
      </Part>
    </div>
  );
}

function Answers({ questions, value }: { questions: Question[]; value: CustomerIdentification }) {
  return (
    <>
      {questions.map((question) => (
        <Fact key={question.id} label={question.label} value={answerTo(question, value)} wide />
      ))}
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
    <section className="overflow-hidden rounded-2xl border border-line">
      <div className="flex items-center justify-between gap-3 border-b border-line bg-slate-50/70 px-5 py-3">
        <h3 className="text-sm font-bold text-ink">{title}</h3>
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
