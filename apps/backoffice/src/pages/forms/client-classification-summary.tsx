import { Button } from "@atomprive/ui";
import { PencilLine } from "lucide-react";
import { formatDate } from "../../lib/labels";
import type { ReactNode } from "react";
import {
  accountTypes,
  assessedOptions,
  deemedOptions,
  serviceBasedOptions,
  type ClientClassificationEntity,
} from "./client-classification";

const MISSING = "—";

function shown(value: string | null | undefined) {
  return value?.trim() ? value : MISSING;
}

function markedAs(options: { value: string; mark: string; text: string }[], ticked: string[]) {
  const held = options.filter((option) => ticked.includes(option.value));
  return held.length > 0 ? held.map((option) => `${option.mark}. ${option.text}`).join("\n\n") : "Nothing ticked";
}

/** Everything ticked, part by part, for the last look before submitting and for a finished form. */
export function ClientClassificationSummary({
  value,
  onEdit,
}: {
  value: ClientClassificationEntity;
  onEdit?: (stepId: string) => void;
}) {
  const { client, declaration } = value;
  return (
    <div className="space-y-5">
      <Part title="Client Classification Form" stepId="client" onEdit={onEdit}>
        <Fact label="Primary Client’s full name" value={shown(client.primaryName)} wide />
        <Fact label="Joint Holder’s full name, if applicable" value={shown(client.jointName)} wide />
        <Fact
          label="Account Type (please delete or circle, as relevant):"
          value={accountTypes.find((one) => one.value === client.accountType)?.label ?? MISSING}
        />
      </Part>

      <Part title="Professional Client" stepId="classification" onEdit={onEdit}>
        <Fact
          label="1. Assessed Professional Client"
          value={markedAs(assessedOptions, value.assessed ? [value.assessed] : [])}
          wide
        />
        <Fact label="2. A Deemed Professional Client" value={markedAs(deemedOptions, value.deemed)} wide />
        <Fact
          label="3. Service-based Professional Client"
          value={markedAs(serviceBasedOptions, value.serviceBased ? [value.serviceBased] : [])}
          wide
        />
      </Part>

      <Part title="SIGNATURES" stepId="declaration" onEdit={onEdit}>
        <Fact label="Declaration made" value={declaration.confirmed ? "Yes" : "Not yet"} wide />
        {declaration.signers.map((signer, at) => (
          <Fact key={at} label={`Signed for the CLIENT ${at + 1}`} wide value={`${shown(signer.signature)} · ${shown(signer.name)} · ${shown(signer.title)} · ${signer.signedOn ? formatDate(signer.signedOn) : MISSING}`} />
        ))}
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
