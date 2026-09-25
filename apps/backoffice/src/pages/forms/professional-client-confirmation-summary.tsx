import { Button } from "@atomprive/ui";
import { PencilLine } from "lucide-react";
import type { ReactNode } from "react";
import { formatDate } from "../../lib/labels";
import { familyTies, type ProfessionalClientConfirmation, type Signature } from "./professional-client-confirmation";
import { signatureText } from "./made-signature";

const MISSING = "—";

function shown(value: string | null | undefined) {
  return value?.trim() ? value : MISSING;
}

function signed(block: Signature) {
  const when = block.signedOn ? formatDate(block.signedOn) : MISSING;
  return `${shown(block.name)} · ${signatureText(shown(block.signature))} · ${when}`;
}

/** Everything the joint account holders' confirmation asks for, as it was answered. */
export function ProfessionalClientConfirmationSummary({
  value,
  onEdit,
}: {
  value: ProfessionalClientConfirmation;
  onEdit?: (stepId: string) => void;
}) {
  const { holders, primary, secondary, signatures } = value;
  const tie = familyTies.find((one) => one.value === secondary.familyTie);
  return (
    <div className="space-y-5">
      <Part title="The joint account holders" stepId="holders" onEdit={onEdit}>
        <dl className="grid gap-3 sm:grid-cols-2">
          <Fact label="Name of Primary Joint Account Holder" value={shown(holders.primaryName)} />
          <Fact label="Name of Secondary Joint Account Holder" value={shown(holders.secondaryName)} />
          <Fact label="Address of Account Holder" value={shown(holders.address)} wide />
        </dl>
      </Part>

      <Part title="A – Confirmation from Primary Joint Account Holder" stepId="primary" onEdit={onEdit}>
        <dl className="grid gap-3 sm:grid-cols-2">
          <Fact label="Confirmed by" value={shown(primary.confirmedBy)} />
          <Fact label="Confirmation" value={primary.agreed ? "Given" : "Not yet given"} />
        </dl>
      </Part>

      <Part title="B – Confirmation from Secondary Joint Account Holder" stepId="secondary" onEdit={onEdit}>
        <dl className="grid gap-3 sm:grid-cols-2">
          <Fact label="Confirmed by" value={shown(secondary.confirmedBy)} />
          <Fact label="Confirmation" value={secondary.agreed ? "Given" : "Not yet given"} />
          <Fact label="Family member of the Primary Joint Account Holder" value={tie ? `${tie.letter}. ${tie.text}` : MISSING} wide />
        </dl>
      </Part>

      <Part title="Signatures" stepId="signatures" onEdit={onEdit}>
        <dl className="grid gap-3 sm:grid-cols-2">
          <Fact label="Primary Account Holder" value={signed(signatures.primary)} wide />
          <Fact label="Secondary Account Holder" value={signed(signatures.secondary)} wide />
        </dl>
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
    <section className="rounded-2xl border border-line p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold text-ink">{title}</h3>
        {onEdit && (
          <Button variant="ghost" size="sm" onClick={() => onEdit(stepId)}>
            <PencilLine aria-hidden="true" />
            Edit
          </Button>
        )}
      </div>
      {children}
    </section>
  );
}

function Fact({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <dt className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">{label}</dt>
      <dd className="mt-0.5 text-sm text-ink">{value}</dd>
    </div>
  );
}
