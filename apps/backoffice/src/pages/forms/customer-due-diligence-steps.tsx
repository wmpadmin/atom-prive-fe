import { Alert, Button, IconButton, cn } from "@atomprive/ui";
import { Plus, X } from "lucide-react";
import { Boxes, Tick, Written } from "../../components/form-boxes";
import { Documents, type FormDocuments } from "../../components/form-documents";
import {
  CountriesField,
  DateField,
  FollowUp,
  FormSection as FieldGroup,
  SignatureField, TextField,
  type FieldFor,
} from "../../components/form-fields";
import {
  EVIDENCE_ON_FILE,
  RISK_MATRIX_SHEET,
  cddLevelLabels,
  classifiedLabels,
  emptyEmployment,
  emptyEvidence,
  emptyOwnedEntity,
  emptyScreened,
  evidenceField,
  NAME_OF_THE_FIRM,
  netWorthRows,
  pepRows,
  ratingLabels,
  screenedAsLabels,
  screeningResultLabels,
  sowGuidance,
  type CddLevel,
  type Classified,
  type DueDiligenceEntity,
  type Evidence,
  type Rating,
  type ScreenedAs,
  type ScreeningResult,
} from "./customer-due-diligence";

const MAX_ROWS = 10;

function yearsFromToday(years: number) {
  const today = new Date();
  return new Date(today.getFullYear() + years, today.getMonth(), today.getDate());
}

const yesNo = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
];

const ratings = (Object.keys(ratingLabels) as Rating[]).map((rating) => ({
  value: rating,
  label: ratingLabels[rating],
}));

/** Section 1: the entity, line by line as the form asks for it. */
export function BusinessStep({
  business,
  onChange,
  field,
}: {
  business: DueDiligenceEntity["business"];
  onChange: (patch: Partial<DueDiligenceEntity["business"]>) => void;
  field: FieldFor;
}) {
  return (
    <div className="space-y-6">
      {/* The form rules a line for the firm's own name at its head; every line below calls it "the Firm". */}
      <div className="text-sm leading-relaxed font-semibold text-ink">
        <Written
          text={NAME_OF_THE_FIRM}
          blank={{
            id: "business.firmName",
            label: "Name of the Firm",
            value: business.firmName,
            onChange: (firmName) => onChange({ firmName }),
            field,
          }}
        />
      </div>
      {field("business.firmName").error && (
        <p className="-mt-4 text-xs text-red-600">{field("business.firmName").error}</p>
      )}

      {/* The part is headed "The entity", with the form’s own opening line under it, so it is not said again. */}
      <FieldGroup>
        <TextField id="business.legalName" label="Full name of legal entity:" value={business.legalName} onChange={(legalName) => onChange({ legalName })} field={field} className="sm:col-span-2" />
        <TextField id="business.tradingName" label="Trading name:" value={business.tradingName} onChange={(tradingName) => onChange({ tradingName })} field={field} optional />
        <TextField id="business.fiscalResidence" label="Fiscal residence:" value={business.fiscalResidence} onChange={(fiscalResidence) => onChange({ fiscalResidence })} field={field} />
        <TextField id="business.principalPlaceOfBusiness" label="Principal place of business:" value={business.principalPlaceOfBusiness} onChange={(principalPlaceOfBusiness) => onChange({ principalPlaceOfBusiness })} field={field} multiline className="sm:col-span-2" />
        <TextField id="business.registeredOffice" label="Registered office (if different to the above):" value={business.registeredOffice} onChange={(registeredOffice) => onChange({ registeredOffice })} field={field} multiline optional className="sm:col-span-2" />
        <TextField id="business.telephone" label="Telephone:" value={business.telephone} onChange={(telephone) => onChange({ telephone })} field={field} />
        <TextField id="business.contactPerson" label="Name of contact person:" value={business.contactPerson} onChange={(contactPerson) => onChange({ contactPerson })} field={field} />
        <TextField id="business.website" label="Website:" value={business.website} onChange={(website) => onChange({ website })} field={field} optional />
        <TextField id="business.legalStructure" label="Legal structure:" value={business.legalStructure} onChange={(legalStructure) => onChange({ legalStructure })} field={field} />
        <div className="sm:col-span-2">
          <p className="mb-3 text-2xs font-semibold tracking-wider text-ink-muted uppercase">
            Date and place of incorporation
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <DateField id="business.incorporatedOn" label="Date" value={business.incorporatedOn} onChange={(incorporatedOn) => onChange({ incorporatedOn })} field={field} min={yearsFromToday(-200)} max={yearsFromToday(0)} />
            <TextField id="business.incorporatedIn" label="Place" value={business.incorporatedIn} onChange={(incorporatedIn) => onChange({ incorporatedIn })} field={field} />
          </div>
        </div>
        <TextField id="business.registrationNumber" label="Corporate registration number:" value={business.registrationNumber} onChange={(registrationNumber) => onChange({ registrationNumber })} field={field} />
        <TextField id="business.relationshipManager" label="Name of relationship manager:" value={business.relationshipManager} onChange={(relationshipManager) => onChange({ relationshipManager })} field={field} />
        <TextField id="business.businessActivities" label="Describe the Customer’s business activities:" value={business.businessActivities} onChange={(businessActivities) => onChange({ businessActivities })} field={field} multiline className="sm:col-span-2" />
        <CountriesField id="business.countriesOfBusiness" label="Countries with which business is conducted" value={business.countriesOfBusiness} onChange={(countriesOfBusiness) => onChange({ countriesOfBusiness })} field={field} className="sm:col-span-2" />
        <TextField id="business.initialInvestment" label="Estimated amount of initial investment (specify currency):" value={business.initialInvestment} onChange={(initialInvestment) => onChange({ initialInvestment })} field={field} />
        <TextField id="business.expectedValuePerYear" label="Expected investment value to be transacted each year" value={business.expectedValuePerYear} onChange={(expectedValuePerYear) => onChange({ expectedValuePerYear })} field={field} />
        <TextField id="business.howIntroduced" label="How was the entity introduced to the Firm" value={business.howIntroduced} onChange={(howIntroduced) => onChange({ howIntroduced })} field={field} className="sm:col-span-2" />
        <TextField id="business.purposeOfRelationship" label="Information regarding the purpose, intended nature and level of business to be conducted with the Firm:" value={business.purposeOfRelationship} onChange={(purposeOfRelationship) => onChange({ purposeOfRelationship })} field={field} multiline className="sm:col-span-2" />
        <TextField id="business.regulatorName" label="Name of the regulator if entity is regulated:" value={business.regulatorName} onChange={(regulatorName) => onChange({ regulatorName })} field={field} optional />
        <TextField id="business.exchangeName" label="Name of the exchange if the entity is listed:" value={business.exchangeName} onChange={(exchangeName) => onChange({ exchangeName })} field={field} optional />
        <TextField id="business.otherListedEntities" label="Details of any other listed entities that are shareholders or beneficial owners:" value={business.otherListedEntities} onChange={(otherListedEntities) => onChange({ otherListedEntities })} field={field} multiline optional className="sm:col-span-2" />
        <TextField id="business.externalAuditor" label="Name of external auditor:" value={business.externalAuditor} onChange={(externalAuditor) => onChange({ externalAuditor })} field={field} optional className="sm:col-span-2" />
      </FieldGroup>
    </div>
  );
}

/** Client classification, and the evidence the form asks to be obtained for an assessed Professional Client. */
export function ClassificationStep({
  classification,
  formId,
  documents,
  onChange,
  field,
}: {
  classification: DueDiligenceEntity["classification"];
  formId: string;
  documents: FormDocuments;
  onChange: (patch: Partial<DueDiligenceEntity["classification"]>) => void;
  field: FieldFor;
}) {
  const evidence = classification.evidence;
  const change = (at: number, patch: Partial<Evidence>) =>
    onChange({ evidence: evidence.map((row, which) => (which === at ? { ...row, ...patch } : row)) });

  return (
    <div className="space-y-6">
      <Boxes legend="Client classification:" required error={field("classification.classified").error}>
        {(Object.keys(classifiedLabels) as Classified[]).map((held) => (
          <Tick
            key={held}
            kind="radio"
            name="classification.classified"
            id={`classification.classified.${held}`}
            checked={classification.classified === held}
            onChange={() =>
              onChange(held === "ASSESSED" ? { classified: held } : { classified: held, evidenceOnFile: false })
            }
            text={classifiedLabels[held]}
          >
            {/* The form joins this second box to the assessed criteria with its own "and", and prints both
                whichever is ticked; only the assessed criteria open the second one. */}
            {held === "ASSESSED" && (
              <div className="border-t border-line px-3.5 py-3">
                <p className="mb-2 text-xs font-semibold text-ink-muted">and</p>
                <Tick
                  kind="checkbox"
                  name="classification.evidenceOnFile"
                  id="classification.evidenceOnFile"
                  checked={classification.evidenceOnFile}
                  onChange={(on) => onChange({ evidenceOnFile: on })}
                  text={EVIDENCE_ON_FILE}
                  disabled={classification.classified !== "ASSESSED"}
                />
                {field("classification.evidenceOnFile").error && (
                  <p className="mt-1.5 text-xs text-red-600">{field("classification.evidenceOnFile").error}</p>
                )}
              </div>
            )}
          </Tick>
        ))}
      </Boxes>

      <FieldGroup
          title="Evidence of documents obtained for Assessment as Professional Client"
          action={
            <Button variant="secondary" size="sm" disabled={evidence.length >= MAX_ROWS} onClick={() => onChange({ evidence: [...evidence, emptyEvidence()] })}>
              <Plus aria-hidden="true" />
              Add a row
            </Button>
          }
        >
          {evidence.map((held, at) => (
            <FollowUp key={at} title={`Sr. No. ${at + 1}`}>
              <TextField id={`classification.evidence[${at}].document`} label="Description of document obtained" value={held.document} onChange={(document) => change(at, { document })} field={field} className="sm:col-span-2" />
              <TextField id={`classification.evidence[${at}].netAssetAmount`} label="Net Asset Amount" value={held.netAssetAmount} onChange={(netAssetAmount) => change(at, { netAssetAmount })} field={field} />
              <label className="flex items-center gap-3 self-end pb-2.5 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={held.knowledgeAndExperience}
                  onChange={(event) => change(at, { knowledgeAndExperience: event.target.checked })}
                  className="size-4 rounded-[3px] border-ink-muted accent-primary-600"
                />
                Knowledge and Experience Evidence
              </label>
              {/* The document obtained is what the row is evidence of, so the document itself goes here. */}
              <div className="sm:col-span-2">
                <Documents formId={formId} field={evidenceField(at)} documents={documents} label="Attach the document obtained" />
                {field(evidenceField(at)).error && (
                  <p className="mt-1 text-xs text-amber-700">{field(evidenceField(at)).error}</p>
                )}
              </div>
              {evidence.length > 1 && (
                <div className="sm:col-span-2">
                  <IconButton label={`Remove row ${at + 1}`} tone="danger" onClick={() => onChange({ evidence: evidence.filter((_, which) => which !== at) })}>
                    <X />
                  </IconButton>
                </div>
              )}
            </FollowUp>
          ))}
          <TextField id="classification.total" label="Total" value={classification.total} onChange={(total) => onChange({ total })} field={field} />
      </FieldGroup>
    </div>
  );
}

/** SUITABILITY ASSESSMENT, and SCREENING. */
export function SuitabilityStep({
  suitability,
  screening,
  onChange,
  field,
}: {
  suitability: DueDiligenceEntity["suitability"];
  screening: DueDiligenceEntity["screening"];
  onChange: (patch: Partial<Pick<DueDiligenceEntity, "suitability" | "screening">>) => void;
  field: FieldFor;
}) {
  const profiled = field("suitability.riskProfileCompleted");
  const change = (at: number, patch: Partial<DueDiligenceEntity["screening"][number]>) =>
    onChange({ screening: screening.map((row, which) => (which === at ? { ...row, ...patch } : row)) });

  return (
    <div className="space-y-6">
      <FieldGroup title="SUITABILITY ASSESSMENT:">
        <div className="sm:col-span-2">
          {/* The form prints this as two boxes on the line, and it reads as two boxes on the line. */}
          <Boxes legend="Investment Risk Profile completed" required inline error={profiled.error}>
            {yesNo.map((answer) => (
              <Tick
                key={answer.value}
                kind="radio"
                name="suitability.riskProfileCompleted"
                id={`suitability.riskProfileCompleted.${answer.value}`}
                checked={suitability.riskProfileCompleted === (answer.value === "yes")}
                onChange={() => onChange({ suitability: { ...suitability, riskProfileCompleted: answer.value === "yes" } })}
                text={answer.label}
              />
            ))}
          </Boxes>
        </div>
        <TextField id="suitability.clientRiskProfile" label="Client Risk Profile" value={suitability.clientRiskProfile} onChange={(clientRiskProfile) => onChange({ suitability: { ...suitability, clientRiskProfile } })} field={field} />
        <TextField id="suitability.comments" label="Comments" value={suitability.comments} onChange={(comments) => onChange({ suitability: { ...suitability, comments } })} field={field} multiline optional className="sm:col-span-2" />
      </FieldGroup>

      <section className="space-y-4">
        <h3 className="text-sm font-bold text-ink">SCREENING:</h3>
        <p className="text-xs leading-relaxed whitespace-pre-line text-ink-muted">
          {"(NOTES: 1. To be completed by OPS Support / Designated Screening Staff;\n        2. Add rows as needed)"}
        </p>

        {(Object.keys(screenedAsLabels) as ScreenedAs[]).map((list) => {
          const rows = screening
            .map((row, at) => ({ row, at }))
            .filter(({ row }) => row.screenedAs === list);
          return (
            <FieldGroup
              key={list}
              title={screenedAsLabels[list]}
              action={
                <Button variant="secondary" size="sm" disabled={screening.length >= MAX_ROWS} onClick={() => onChange({ screening: [...screening, emptyScreened(list)] })}>
                  <Plus aria-hidden="true" />
                  Add a row
                </Button>
              }
            >
              {rows.length === 0 ? (
                <p className="text-sm text-ink-muted sm:col-span-2">No rows yet.</p>
              ) : (
                rows.map(({ row, at }, position) => (
                  <FollowUp key={at} title={`Row ${position + 1}`}>
                    <TextField id={`screening[${at}].name`} label="Name as per Passport" value={row.name} onChange={(name) => change(at, { name })} field={field} />
                    <DateField id={`screening[${at}].screenedOn`} label="Screening date" value={row.screenedOn} onChange={(screenedOn) => change(at, { screenedOn })} field={field} min={yearsFromToday(-5)} max={yearsFromToday(0)} />
                    <div className="sm:col-span-2">
                      {/* The form heads this column with its three answers on one line, as they are set here. */}
                      <Boxes
                        legend="Result: (No match / PEP / Other)"
                        required
                        inline
                        error={field(`screening[${at}].result`).error}
                      >
                        {(Object.keys(screeningResultLabels) as ScreeningResult[]).map((held) => (
                          <Tick
                            key={held}
                            kind="radio"
                            name={`screening[${at}].result`}
                            id={`screening[${at}].result.${held}`}
                            checked={row.result === held}
                            onChange={() => change(at, { result: held })}
                            text={screeningResultLabels[held]}
                          />
                        ))}
                      </Boxes>
                    </div>
                    {row.result && row.result !== "NO_MATCH" && (
                      <TextField id={`screening[${at}].remarks`} label="Remarks for Hits" value={row.remarks} onChange={(remarks) => change(at, { remarks })} field={field} multiline className="sm:col-span-2" />
                    )}
                    {screening.length > 1 && (
                      <div className="sm:col-span-2">
                        <IconButton label={`Remove row ${position + 1}`} tone="danger" onClick={() => onChange({ screening: screening.filter((_, which) => which !== at) })}>
                          <X />
                        </IconButton>
                      </div>
                    )}
                  </FollowUp>
                ))
              )}
            </FieldGroup>
          );
        })}
      </section>
    </div>
  );
}

/** Source of Wealth (SOW) / Source of Funds (SOF) Information, with the tables the form sets out under it. */
export function WealthStep({
  wealth,
  onChange,
  field,
}: {
  wealth: DueDiligenceEntity["wealth"];
  onChange: (patch: Partial<DueDiligenceEntity["wealth"]>) => void;
  field: FieldFor;
}) {
  const setLine = (id: string, patch: { details?: string; usd?: string }) =>
    onChange({ netWorth: { ...wealth.netWorth, [id]: { ...wealth.netWorth[id]!, ...patch } } });

  return (
    <div className="space-y-6">
      <Alert tone="info">
        Note: Where the account has a joint applicant who is also an Assessed Professional Client, details below
        are also to be completed separately for the joint applicant.
      </Alert>


      <FieldGroup
        title="Employment Details (salaried individuals)"
        action={
          <Button variant="secondary" size="sm" disabled={wealth.employment.length >= MAX_ROWS} onClick={() => onChange({ employment: [...wealth.employment, emptyEmployment()] })}>
            <Plus aria-hidden="true" />
            Add a column
          </Button>
        }
      >
        {wealth.employment.length === 0 ? (
          <p className="text-sm text-ink-muted sm:col-span-2">Nothing added — the client is not salaried.</p>
        ) : (
          wealth.employment.map((row, at) => {
            const set = (patch: Partial<typeof row>) =>
              onChange({ employment: wealth.employment.map((held, which) => (which === at ? { ...held, ...patch } : held)) });
            return (
              <FollowUp key={at} title={`Employment ${at + 1}`}>
                <TextField id={`wealth.employment[${at}].companyName`} label="Company name" value={row.companyName} onChange={(companyName) => set({ companyName })} field={field} optional />
                <TextField id={`wealth.employment[${at}].industry`} label="Industry" value={row.industry} onChange={(industry) => set({ industry })} field={field} optional />
                <TextField id={`wealth.employment[${at}].periodOfEmployment`} label="Period of employment" value={row.periodOfEmployment} onChange={(periodOfEmployment) => set({ periodOfEmployment })} field={field} optional />
                <TextField id={`wealth.employment[${at}].averageAnnualSalary`} label="Average Annual Salary (USD)" value={row.averageAnnualSalary} onChange={(averageAnnualSalary) => set({ averageAnnualSalary })} field={field} optional />
                <TextField id={`wealth.employment[${at}].totalSalaryEarned`} label="Total salary earned" value={row.totalSalaryEarned} onChange={(totalSalaryEarned) => set({ totalSalaryEarned })} field={field} optional />
                <TextField id={`wealth.employment[${at}].otherIncomeEarned`} label="Other Income earned" value={row.otherIncomeEarned} onChange={(otherIncomeEarned) => set({ otherIncomeEarned })} field={field} optional />
                <TextField id={`wealth.employment[${at}].countryOfEmployment`} label="Country of employment" value={row.countryOfEmployment} onChange={(countryOfEmployment) => set({ countryOfEmployment })} field={field} optional />
                <div className="self-end pb-1">
                  <IconButton label={`Remove employment ${at + 1}`} tone="danger" onClick={() => onChange({ employment: wealth.employment.filter((_, which) => which !== at) })}>
                    <X />
                  </IconButton>
                </div>
              </FollowUp>
            );
          })
        )}
      </FieldGroup>

      <FieldGroup
        title="Entity Details (self-employed individuals)"
        action={
          <Button variant="secondary" size="sm" disabled={wealth.entities.length >= MAX_ROWS} onClick={() => onChange({ entities: [...wealth.entities, emptyOwnedEntity()] })}>
            <Plus aria-hidden="true" />
            Add a column
          </Button>
        }
      >
        {wealth.entities.length === 0 ? (
          <p className="text-sm text-ink-muted sm:col-span-2">Nothing added — the client is not self-employed.</p>
        ) : (
          wealth.entities.map((row, at) => {
            const set = (patch: Partial<typeof row>) =>
              onChange({ entities: wealth.entities.map((held, which) => (which === at ? { ...held, ...patch } : held)) });
            return (
              <FollowUp key={at} title={`Entity ${at + 1}`}>
                <TextField id={`wealth.entities[${at}].companyName`} label="Company name" value={row.companyName} onChange={(companyName) => set({ companyName })} field={field} optional />
                <TextField id={`wealth.entities[${at}].industry`} label="Industry" value={row.industry} onChange={(industry) => set({ industry })} field={field} optional />
                <TextField id={`wealth.entities[${at}].periodOfOwnership`} label="Period of ownership" value={row.periodOfOwnership} onChange={(periodOfOwnership) => set({ periodOfOwnership })} field={field} optional />
                <TextField id={`wealth.entities[${at}].annualRevenues`} label="Annual Revenues" value={row.annualRevenues} onChange={(annualRevenues) => set({ annualRevenues })} field={field} optional />
                <TextField id={`wealth.entities[${at}].annualProfits`} label="Annual Profits" value={row.annualProfits} onChange={(annualProfits) => set({ annualProfits })} field={field} optional />
                <TextField id={`wealth.entities[${at}].otherIncomeEarned`} label="Other Income earned" value={row.otherIncomeEarned} onChange={(otherIncomeEarned) => set({ otherIncomeEarned })} field={field} optional />
                <TextField id={`wealth.entities[${at}].ownershipPercent`} label="% of ownership" value={row.ownershipPercent} onChange={(ownershipPercent) => set({ ownershipPercent })} field={field} optional />
                <TextField id={`wealth.entities[${at}].country`} label="Country" value={row.country} onChange={(country) => set({ country })} field={field} optional />
                <TextField id={`wealth.entities[${at}].natureOfBusiness`} label="Nature of business" value={row.natureOfBusiness} onChange={(natureOfBusiness) => set({ natureOfBusiness })} field={field} optional className="sm:col-span-2" />
                <div className="self-end pb-1">
                  <IconButton label={`Remove entity ${at + 1}`} tone="danger" onClick={() => onChange({ entities: wealth.entities.filter((_, which) => which !== at) })}>
                    <X />
                  </IconButton>
                </div>
              </FollowUp>
            );
          })
        )}
      </FieldGroup>

      <FieldGroup title="Source of Funds and Source of Income Information">
        <TextField id="wealth.personalDetails" label="Personal details (Self and family background, education, employment / business, directorships memberships, interests in Companies or any other relevant details)" value={wealth.personalDetails} onChange={(personalDetails) => onChange({ personalDetails })} field={field} multiline className="sm:col-span-2" />
        <details className="rounded-xl border border-line bg-slate-50/70 sm:col-span-2">
          <summary className="cursor-pointer px-4 py-3 text-xs font-semibold text-ink-muted">
            Guidance for filling the SOW/SOF/SOI Section
          </summary>
          <p className="border-t border-line px-4 py-3 text-xs leading-relaxed whitespace-pre-line text-ink-muted">
            {sowGuidance}
          </p>
        </details>
      </FieldGroup>

      <FieldGroup title="Net worth Calculation:">
        {netWorthRows.map((row) => (
          <FollowUp key={row.id} title={`${row.group} — ${row.label}`}>
            <TextField id={`wealth.netWorth.${row.id}.details`} label="Details" value={wealth.netWorth[row.id]?.details ?? ""} onChange={(details) => setLine(row.id, { details })} field={field} multiline optional />
            <TextField id={`wealth.netWorth.${row.id}.usd`} label="USD" value={wealth.netWorth[row.id]?.usd ?? ""} onChange={(usd) => setLine(row.id, { usd })} field={field} optional />
          </FollowUp>
        ))}
        <TextField id="wealth.totalNetWorth" label="TOTAL Net Worth - (Assets Less Liabilities)" value={wealth.totalNetWorth} onChange={(totalNetWorth) => onChange({ totalNetWorth })} field={field} className="sm:col-span-2" />
      </FieldGroup>
    </div>
  );
}

/** SECTION 2: the money laundering risk rating the relationship manager carries over from the matrix. */
export function RiskStep({
  risk,
  formId,
  documents,
  onChange,
  field,
}: {
  risk: DueDiligenceEntity["risk"];
  formId: string;
  documents: FormDocuments;
  onChange: (patch: Partial<DueDiligenceEntity["risk"]>) => void;
  field: FieldFor;
}) {
  const pep = field("risk.politicallyExposed");
  // The PEP table is printed whichever way the line above it is answered; only a Yes opens it.
  const pepAsked = risk.politicallyExposed === true;
  const setPep = (id: string, patch: { details?: string; rating?: Rating }) =>
    onChange({ pep: { ...risk.pep, [id]: { ...risk.pep[id]!, ...patch } } });

  return (
    <div className="space-y-6">
      <FieldGroup title="1) OVERALL MLRR RISK ASSESSMENT">
        <TextField id="risk.overallMlrr" label="OVERALL MLRR RISK ASSESSMENT" value={risk.overallMlrr} onChange={(overallMlrr) => onChange({ overallMlrr })} field={field} className="sm:col-span-2" />
      </FieldGroup>

      {/* The form says Sheet 1 must be signed by the RM and attached at the end of this form. */}
      <Alert tone="info">
        <p>
          Note: The AML Risk Rating Matrix Sheet to be completed by the RM and Sheet 1 that has the MLRR Risk
          rating must be signed by the RM and attached at the end of this form.
        </p>
        <div className="mt-3 space-y-2">
          <Documents formId={formId} field={RISK_MATRIX_SHEET} documents={documents} label="Attach the signed Sheet 1" />
          {field(RISK_MATRIX_SHEET).error && <p className="text-xs text-amber-700">{field(RISK_MATRIX_SHEET).error}</p>}
        </div>
      </Alert>

      <div className="space-y-4">
        <h3 className="text-sm font-bold text-ink">2) PEP RISK ASSESSMENT</h3>
        {/* Answered with boxes on the line, as the other two on this form are. */}
        <Boxes
          legend="PEP risk (if applicable): Complete this section only if the control/ownership risk identified above is medium or high."
          required
          inline
          error={pep.error}
        >
          {yesNo.map((answer) => (
            <Tick
              key={answer.value}
              kind="radio"
              name="risk.politicallyExposed"
              id={`risk.politicallyExposed.${answer.value}`}
              checked={risk.politicallyExposed === (answer.value === "yes")}
              onChange={() =>
                onChange(
                  answer.value === "yes"
                    ? { politicallyExposed: true }
                    : {
                        politicallyExposed: false,
                        // A No takes back whatever the table above was filled in with.
                        pep: Object.fromEntries(pepRows.map((row) => [row.id, { details: "", rating: null }])),
                      },
                )
              }
              text={answer.label}
            />
          ))}
        </Boxes>
        {/* The table the paper prints under that heading, read whether or not it applies. */}
        <ul className="space-y-2">
            {pepRows.map((row) => (
              <li key={row.id} className="grid items-center gap-3 rounded-xl border border-line bg-white px-3.5 py-2.5 lg:grid-cols-[12rem_1fr_auto]">
                <span className={cn("text-sm font-semibold", pepAsked ? "text-ink" : "text-ink-muted")}>{row.label}</span>
                <input
                  id={`risk.pep.${row.id}.details`}
                  type="text"
                  aria-label={`${row.label} — details`}
                  value={risk.pep[row.id]?.details ?? ""}
                  disabled={!pepAsked}
                  onChange={(event) => setPep(row.id, { details: event.target.value })}
                  className="block h-10 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink focus:border-primary-600 focus:outline-none disabled:bg-slate-50 disabled:text-ink-muted"
                />
                <div className="flex items-center gap-1.5">
                  {ratings.map((rating) => (
                    <label
                      key={rating.value}
                      className={cn(
                        "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                        pepAsked ? "cursor-pointer" : "cursor-not-allowed",
                        risk.pep[row.id]?.rating === rating.value
                          ? "border-primary-600 bg-primary-600 text-white"
                          : pepAsked
                            ? "border-line bg-white text-ink hover:border-primary-100"
                            : "border-line bg-slate-50 text-ink-muted",
                      )}
                    >
                      <input
                        type="radio"
                        name={`risk.pep.${row.id}`}
                        checked={risk.pep[row.id]?.rating === rating.value}
                        disabled={!pepAsked}
                        onChange={() => setPep(row.id, { rating: rating.value })}
                        className="sr-only"
                      />
                      {rating.label}
                    </label>
                  ))}
                </div>
                {field(`risk.pep.${row.id}`).error && (
                  <p className="text-xs text-red-600 lg:col-span-3">{field(`risk.pep.${row.id}`).error}</p>
                )}
              </li>
            ))}
        </ul>
      </div>

      <FieldGroup title="Relationship Manager">
        <TextField id="risk.relationshipManagerName" label="Relationship Manager Name" value={risk.relationshipManagerName} onChange={(relationshipManagerName) => onChange({ relationshipManagerName })} field={field} />
        <TextField id="risk.dateAndPlace" label="Date &amp; Place" value={risk.dateAndPlace} onChange={(dateAndPlace) => onChange({ dateAndPlace })} field={field} />
        <SignatureField who="the firm" id="risk.signature" label="Signature" value={risk.signature} onChange={(signature) => onChange({ signature })} field={field} className="sm:col-span-2" />
      </FieldGroup>
    </div>
  );
}

/** SECTION 3, to be completed by the MLRO. */
export function ComplianceReviewStep({
  review,
  onChange,
  field,
}: {
  review: DueDiligenceEntity["review"];
  onChange: (patch: Partial<DueDiligenceEntity["review"]>) => void;
  field: FieldFor;
}) {
  return (
    <div className="space-y-6">
      <FieldGroup title="AMENDED OVERALL RISK ASSESSEMENT if applicable (MLRO TO PROVIDE RATIONALE)">
        <TextField id="review.amendedOverallRiskAssessment" label="AMENDED OVERALL RISK ASSESSEMENT" value={review.amendedOverallRiskAssessment} onChange={(amendedOverallRiskAssessment) => onChange({ amendedOverallRiskAssessment })} field={field} multiline optional className="sm:col-span-2" />
      </FieldGroup>

      <FieldGroup title="Overall MLRR">
        <TextField id="review.overallMlrr" label="Overall MLRR:" value={review.overallMlrr} onChange={(overallMlrr) => onChange({ overallMlrr })} field={field} />
        <DateField id="review.nextReviewOn" label="Next review date:" value={review.nextReviewOn} onChange={(nextReviewOn) => onChange({ nextReviewOn })} field={field} min={yearsFromToday(0)} max={yearsFromToday(10)} />
        <TextField id="review.comments" label="Comments on how MLRR has been calculated:" value={review.comments} onChange={(comments) => onChange({ comments })} field={field} multiline className="sm:col-span-2" />
      </FieldGroup>

      <Boxes legend="CUSTOMER DUE DILIGENCE: Levels of CDD required — Select One" required error={field("review.level").error}>
        {(Object.keys(cddLevelLabels) as CddLevel[]).map((held) => (
          <Tick
            key={held}
            kind="radio"
            name="review.level"
            id={`review.level.${held}`}
            checked={review.level === held}
            onChange={() => onChange({ level: held })}
            text={cddLevelLabels[held]}
          />
        ))}
      </Boxes>

      <FieldGroup title="Any other matters not previously covered in this form:">
        <TextField id="review.otherMatters" label="Any other matters not previously covered in this form:" value={review.otherMatters} onChange={(otherMatters) => onChange({ otherMatters })} field={field} multiline optional className="sm:col-span-2" />
      </FieldGroup>

      <div className="space-y-4">
        <h3 className="text-sm font-bold text-ink">Approvals:</h3>
        <FieldGroup title="MLRO">
          <TextField id="review.mlro" label="MLRO" value={review.mlro} onChange={(mlro) => onChange({ mlro })} field={field} />
          <DateField id="review.mlroDate" label="Date" value={review.mlroDate} onChange={(mlroDate) => onChange({ mlroDate })} field={field} min={yearsFromToday(0)} max={yearsFromToday(1)} />
          <SignatureField who="the firm" id="review.mlroSignature" label="Signature" value={review.mlroSignature} onChange={(mlroSignature) => onChange({ mlroSignature })} field={field} className="sm:col-span-2" />
        </FieldGroup>
        <FieldGroup title="SEO">
          <TextField id="review.seo" label="SEO" value={review.seo} onChange={(seo) => onChange({ seo })} field={field} />
          <DateField id="review.seoDate" label="Date" value={review.seoDate} onChange={(seoDate) => onChange({ seoDate })} field={field} min={yearsFromToday(0)} max={yearsFromToday(1)} />
          <SignatureField who="the firm" id="review.seoSignature" label="Signature" value={review.seoSignature} onChange={(seoSignature) => onChange({ seoSignature })} field={field} className="sm:col-span-2" />
        </FieldGroup>
      </div>
    </div>
  );
}
