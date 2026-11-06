import type { AttachedFile, FormDetailAnswers } from "@atomprive/api-client/backoffice";
import type { ReactNode } from "react";
import { toAccountOpening } from "./account-opening-entity";
import { toAccountOpeningIndividual } from "./account-opening-individual";
import { AccountOpeningIndividualSummary } from "./account-opening-individual-summary";
import { AccountOpeningSummary } from "./account-opening-summary";
import { toClientClassification } from "./client-classification";
import { ClientClassificationSummary } from "./client-classification-summary";
import { toDueDiligence } from "./customer-due-diligence";
import { toDueDiligenceIndividual } from "./customer-due-diligence-individual";
import { DueDiligenceIndividualSummary } from "./customer-due-diligence-individual-summary";
import { DueDiligenceSummary } from "./customer-due-diligence-summary";
import { toCustomerIdentification } from "./customer-identification";
import { CustomerIdentificationSummary } from "./customer-identification-summary";
import { entityChecklistGroups, individualChecklistGroups, toDfsaChecklist } from "./dfsa-checklist";
import { DfsaChecklistSummary } from "./dfsa-checklist-summary";
import { toFatcaCrs } from "./fatca-crs";
import { toFatcaCrsIndividual } from "./fatca-crs-individual";
import { FatcaCrsIndividualSummary } from "./fatca-crs-individual-summary";
import { FatcaCrsSummary } from "./fatca-crs-summary";
import { toRiskProfile } from "./investment-risk-profile";
import { RiskProfileSummary } from "./investment-risk-profile-summary";
import { isQuestionnaire, toQuestionnaire } from "./risk-questionnaire";
import { RiskQuestionnaireSummary } from "./risk-questionnaire-summary";
import { toProfessionalClientConfirmation } from "./professional-client-confirmation";
import { ProfessionalClientConfirmationSummary } from "./professional-client-confirmation-summary";

/**
 * A form read back as it was answered, by its kind: the same summary the firm's own form screen shows when a form is
 * finished, with nothing to edit. Nothing where the kind is a document rather than a form of questions.
 */
export function readBack(kind: string, answers: FormDetailAnswers | undefined, attachments: AttachedFile[], formId: string): ReactNode {
  switch (kind) {
    case "ACCOUNT_OPENING_ENTITY":
      return <AccountOpeningSummary value={toAccountOpening(answers)} />;
    case "ACCOUNT_OPENING_INDIVIDUAL":
      return <AccountOpeningIndividualSummary value={toAccountOpeningIndividual(answers)} attachments={attachments} formId={formId} />;
    case "CUSTOMER_DUE_DILIGENCE_ENTITY":
      return <DueDiligenceSummary value={toDueDiligence(answers)} />;
    case "CUSTOMER_DUE_DILIGENCE_INDIVIDUAL":
      return <DueDiligenceIndividualSummary value={toDueDiligenceIndividual(answers)} />;
    case "FATCA_CRS_ENTITY":
      return <FatcaCrsSummary value={toFatcaCrs(answers)} attachments={attachments} formId={formId} />;
    case "FATCA_CRS_INDIVIDUAL":
      return <FatcaCrsIndividualSummary value={toFatcaCrsIndividual(answers)} />;
    case "CUSTOMER_IDENTIFICATION_INDIVIDUAL":
      return <CustomerIdentificationSummary value={toCustomerIdentification(answers)} attachments={attachments} formId={formId} />;
    case "PROFESSIONAL_CLIENT_CONFIRMATION_JOINT":
      return <ProfessionalClientConfirmationSummary value={toProfessionalClientConfirmation(answers)} />;
    case "INVESTMENT_RISK_PROFILE":
      // The firm's own questionnaire, or the platform's earlier one for a form sent or signed on it.
      return isQuestionnaire(answers) ? <RiskQuestionnaireSummary value={toQuestionnaire(answers)} /> : <RiskProfileSummary value={toRiskProfile(answers)} />;
    case "CLIENT_CLASSIFICATION":
      return <ClientClassificationSummary value={toClientClassification(answers)} />;
    case "DFSA_ONBOARDING_CHECKLIST_ENTITY":
      return <DfsaChecklistSummary groups={entityChecklistGroups} value={toDfsaChecklist(answers)} attachments={attachments} formId={formId} />;
    case "DFSA_ONBOARDING_CHECKLIST_INDIVIDUAL":
      return <DfsaChecklistSummary groups={individualChecklistGroups} value={toDfsaChecklist(answers)} attachments={attachments} formId={formId} />;
    default:
      return null;
  }
}
