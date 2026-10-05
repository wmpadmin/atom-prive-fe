import { Boxes, Tick, Written } from "../../components/form-boxes";
import { ClientSignsThis } from "../../components/client-signs-this";
import { FormSection as FieldGroup, TextField, type FieldFor } from "../../components/form-fields";
import {
  BY_SIGNING,
  familyTies,
  primaryConfirmations,
  secondaryConfirmations,
  type FamilyTie,
  type ProfessionalClientConfirmation,
} from "./professional-client-confirmation";

/** One of the form's numbered confirmations, printed as it reads. */
function Confirmation({ number, text, blank }: { number: string; text: string; blank?: Parameters<typeof Written>[0]["blank"] }) {
  return (
    <li className="flex gap-3 text-sm leading-relaxed text-ink">
      <span className="shrink-0 font-semibold">{number}</span>
      <span className="min-w-0 flex-1">
        <Written text={text} blank={blank} />
      </span>
    </li>
  );
}

/** Who the account belongs to and where the firm writes to them. */
export function HoldersStep({
  holders,
  onChange,
  field,
}: {
  holders: ProfessionalClientConfirmation["holders"];
  onChange: (patch: Partial<ProfessionalClientConfirmation["holders"]>) => void;
  field: FieldFor;
}) {
  return (
    <FieldGroup>
      <TextField id="holders.primaryName" label="Name of Primary Joint Account Holder" value={holders.primaryName} onChange={(primaryName) => onChange({ primaryName })} field={field} className="sm:col-span-2" />
      <TextField id="holders.secondaryName" label="Name of Secondary Joint Account Holder" value={holders.secondaryName} onChange={(secondaryName) => onChange({ secondaryName })} field={field} className="sm:col-span-2" />
      {/* The form rules three lines here, so it is one address written over as many as it takes. */}
      <TextField id="holders.address" label="Address of Account Holder" value={holders.address} onChange={(address) => onChange({ address })} field={field} multiline className="sm:col-span-2" />
    </FieldGroup>
  );
}

/** A. Confirmation from Primary Joint Account Holder. */
export function PrimaryStep({
  primary,
  onChange,
  field,
}: {
  primary: ProfessionalClientConfirmation["primary"];
  onChange: (patch: Partial<ProfessionalClientConfirmation["primary"]>) => void;
  field: FieldFor;
}) {
  const agreed = field("primary.agreed");
  const blank = field("primary.confirmedBy");
  return (
    <div className="space-y-6">
      <div className="space-y-3 rounded-2xl border border-line bg-slate-50/70 px-5 py-5">
        <p className="text-sm font-semibold text-ink">{BY_SIGNING}</p>
        <ol className="space-y-3">
          {primaryConfirmations.map((text, at) => (
            <Confirmation
              key={at}
              number={`${at + 1}.`}
              text={text}
              blank={
                at === 0
                  ? {
                      id: "primary.confirmedBy",
                      label: "Name of the Primary Joint Account Holder",
                      value: primary.confirmedBy,
                      onChange: (confirmedBy) => onChange({ confirmedBy }),
                      field,
                    }
                  : undefined
              }
            />
          ))}
        </ol>
        {blank.error && <p className="text-xs text-red-600">{blank.error}</p>}
      </div>

      <div>
        <Tick
          kind="checkbox"
          name="primary.agreed"
          id="primary.agreed"
          checked={primary.agreed}
          onChange={(on) => {
            onChange({ agreed: on });
            agreed.onBlur();
          }}
          text="The Primary Joint Account Holder confirms the above."
        />
        {agreed.error && <p className="mt-1.5 text-xs text-red-600">{agreed.error}</p>}
      </div>
    </div>
  );
}

/** B. Confirmation from Secondary Joint Account Holder. */
export function SecondaryStep({
  secondary,
  onChange,
  field,
}: {
  secondary: ProfessionalClientConfirmation["secondary"];
  onChange: (patch: Partial<ProfessionalClientConfirmation["secondary"]>) => void;
  field: FieldFor;
}) {
  const agreed = field("secondary.agreed");
  const blank = field("secondary.confirmedBy");
  const tie = field("secondary.familyTie");
  return (
    <div className="space-y-6">
      <div className="space-y-3 rounded-2xl border border-line bg-slate-50/70 px-5 py-5">
        <p className="text-sm font-semibold text-ink">{BY_SIGNING}</p>
        <ol className="space-y-3">
          {secondaryConfirmations.map((text, at) => (
            <Confirmation
              key={at}
              number={`${at + 1}.`}
              text={text}
              blank={
                at === 0
                  ? {
                      id: "secondary.confirmedBy",
                      label: "Name of the Secondary Joint Account Holder",
                      value: secondary.confirmedBy,
                      onChange: (confirmedBy) => onChange({ confirmedBy }),
                      field,
                    }
                  : undefined
              }
            />
          ))}
        </ol>
        {blank.error && <p className="text-xs text-red-600">{blank.error}</p>}
      </div>

      {/* The second confirmation ends in a colon and letters what it means; that is what is chosen here. */}
      <Boxes legend={secondaryConfirmations[1]!} required error={tie.error}>
        {familyTies.map((one) => (
          <Tick
            key={one.value}
            kind="radio"
            name="secondary.familyTie"
            id={`secondary.familyTie.${one.value}`}
            checked={secondary.familyTie === one.value}
            onChange={() => {
              onChange({ familyTie: one.value as FamilyTie });
              tie.onBlur();
            }}
            text={`${one.letter}. ${one.text}`}
          />
        ))}
      </Boxes>

      <div>
        <Tick
          kind="checkbox"
          name="secondary.agreed"
          id="secondary.agreed"
          checked={secondary.agreed}
          onChange={(on) => {
            onChange({ agreed: on });
            agreed.onBlur();
          }}
          text="The Secondary Joint Account Holder confirms the above."
        />
        {agreed.error && <p className="mt-1.5 text-xs text-red-600">{agreed.error}</p>}
      </div>
    </div>
  );
}

/** The two blocks the form rules at its foot. Both are the account holders' own to sign. */
export function SignaturesStep() {
  return (
    <div className="space-y-6">
      <SignatureBlock title="Name of the Primary Account Holder" />
      <SignatureBlock title="Name of the Secondary Account Holder" />
    </div>
  );
}

/** Where the paper rules a signature block. Nothing in one is the firm's to fill in. */
function SignatureBlock({ title }: { title: string }) {
  return <ClientSignsThis what={`${title}: name, signature and date`} />;
}
