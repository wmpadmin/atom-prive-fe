import type { AttachedFile } from "@atomprive/api-client/backoffice";
import { Button } from "@atomprive/ui";
import { PencilLine } from "lucide-react";
import type { ReactNode } from "react";
import { AttachedFiles } from "../../components/attached-files";
import { countryName } from "../../lib/countries";
import { formatDate } from "../../lib/labels";
import {
  assetLines,
  checklistDocuments,
  documentField,
  experienceQuestions,
  intentionsPart,
  liabilityLines,
  namedHolder,
  personalPart,
  wealthQuestions,
  type CustomerIdentification,
  type FirmAnswers,
  type HolderAnswers,
  type Lines,
  type Question,
} from "./customer-identification";
import { signatureText } from "./made-signature";

const MISSING = "—";

/** What was answered on a line, read back in the form's own words rather than the value behind them. */
function answerTo(question: Question, value: Lines) {
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
  formId,
  onEdit,
}: {
  value: CustomerIdentification;
  attachments: AttachedFile[];
  formId: string;
  onEdit?: (stepId: string) => void;
}) {
  const alone = value.holders.length === 1;
  return (
    <div className="space-y-8">
      {value.holders.map((holder, at) => (
        <div key={at} className="space-y-5">
          {!alone && (
            <h2 className="text-sm font-bold tracking-wider text-ink-muted uppercase">
              Account holder {at + 1} — {namedHolder(holder, at)}
            </h2>
          )}
          <OneHolder holder={holder} where={`holders[${at}]`} attachments={attachments} formId={formId} onEdit={onEdit} />
        </div>
      ))}
      <FirmSide firm={value.firm} onEdit={onEdit} />
    </div>
  );
}

/** One account holder's own pages, as they answered them. */
function OneHolder({
  holder,
  where,
  attachments,
  formId,
  onEdit,
}: {
  holder: HolderAnswers;
  where: string;
  attachments: AttachedFile[];
  formId: string;
  onEdit?: (stepId: string) => void;
}) {
  const said = (id: string) => holder.said[id]?.trim() || MISSING;
  const onDate = (id: string) => (holder.said[id]?.trim() ? formatDate(holder.said[id]!) : MISSING);
  return (
    <div className="space-y-5">
      <Part title="Personal details" stepId={`${where}.personal`} onEdit={onEdit}>
        <Answers questions={personalPart} value={holder} />
        {holder.said["personal.pep"] === "YES" &&
          holder.pep
            .filter((one) => one.name.trim())
            .map((one, at) => <Fact key={at} label="Politically Exposed Person" value={`${one.name} · ${one.role || MISSING}`} wide />)}
      </Part>

      <Part title="About your business intentions with us" stepId={`${where}.intentions`} onEdit={onEdit}>
        <Answers questions={intentionsPart} value={holder} />
      </Part>

      <Part title="About your wealth and origin of funds" stepId={`${where}.wealth`} onEdit={onEdit}>
        <Answers questions={wealthQuestions} value={holder} />
      </Part>

      <Part title="Assets and liabilities" stepId={`${where}.assets`} onEdit={onEdit}>
        {[...assetLines, ...liabilityLines, { id: "netAssets", label: "Net Assets" }].map((line) => (
          <Fact
            key={line.id}
            label={line.label}
            value={`${said(`assets.${line.id}.usd`)}${holder.said[`assets.${line.id}.description`]?.trim() ? ` · ${holder.said[`assets.${line.id}.description`]}` : ""}`}
            wide
          />
        ))}
      </Part>

      <Part title="Your experience and understanding of financial markets and instruments" stepId={`${where}.experience`} onEdit={onEdit}>
        <Answers questions={experienceQuestions} value={holder} />
      </Part>

      <Part title="Declaration" stepId={`${where}.declaration`} onEdit={onEdit}>
        <Fact label="Declaration" value={holder.confirmed["declaration.agreed"] ? "Made" : "Not yet made"} />
        <Fact label="Name" value={said("declaration.name")} />
        <Fact label="Date" value={onDate("declaration.date")} />
        <Fact label="Signature" value={signatureText(said("declaration.signature"))} />
      </Part>

      <Part title="Checklist of required identification documents" stepId={`${where}.documents`} onEdit={onEdit}>
        {checklistDocuments.map((document) => {
          const held = attachments.filter((file) => file.field === documentField(where, document.id));
          return (
            <Fact
              key={document.id}
              label={`${document.number}.`}
              wide
              value={<AttachedFiles formId={formId} files={held} nothing="not attached yet" />}
            />
          );
        })}
      </Part>
    </div>
  );
}

/** The firm's own page: signed once for the account, whoever holds it. */
function FirmSide({ firm, onEdit }: { firm: FirmAnswers; onEdit?: (stepId: string) => void }) {
  const said = (id: string) => firm.said[id]?.trim() || MISSING;
  const onDate = (id: string) => (firm.said[id]?.trim() ? formatDate(firm.said[id]!) : MISSING);
  return (
    <div className="space-y-5">
      <Part title="Internal sign-off" stepId="firm.signoff" onEdit={onEdit}>
        <Fact label="Contact with the customer" value={`${said("signoff.contactWay")} · ${onDate("signoff.contactOn")} · ${said("signoff.contactPlace")}`} wide />
        <Fact label="Relationship manager" value={`${said("signoff.name")} · ${onDate("signoff.date")} · ${signatureText(said("signoff.signature"))}`} wide />
        <Fact label="Compliance Officer and MLRO" value={`${said("compliance.name")} · ${onDate("compliance.date")} · ${signatureText(said("compliance.signature"))}`} wide />
      </Part>

      <Part title="Screening Results" stepId="firm.screening" onEdit={onEdit}>
        <Fact
          label="Included on Ongoing Screening?"
          value={firm.said["screening.included"] === "YES" ? `YES, since ${onDate("screening.since")}` : firm.said["screening.included"] === "NO" ? "NO" : MISSING}
          wide
        />
        {firm.screening
          .filter((row) => row.screenedOn.trim() || row.names.trim() || row.result.trim())
          .map((row, at) => (
            <Fact key={at} label={`Screening ${at + 1}`} value={`${row.screenedOn ? formatDate(row.screenedOn) : MISSING} · ${row.names || MISSING} · ${row.result || MISSING}`} wide />
          ))}
      </Part>
    </div>
  );
}

function Answers({ questions, value }: { questions: Question[]; value: Lines }) {
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
    <section className="overflow-hidden rounded-2xl border border-line bg-white">
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

function Fact({ label, value, wide }: { label: string; value: ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <dt className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">{label}</dt>
      <dd className="mt-0.5 text-sm break-words text-ink">{value}</dd>
    </div>
  );
}
