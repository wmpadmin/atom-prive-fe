import type { AttachedFile, FormDetailAnswers } from "@atomprive/api-client/backoffice";
import type { ReactNode } from "react";
import type { FormDocuments } from "../../components/form-documents";
import type { FieldFor } from "../../components/form-fields";
import {
  reviewAccountOpening,
  sectionGuidance,
  stepOfField,
  toAccountOpening,
  type AccountOpeningEntity,
  type FormReview,
} from "./account-opening-entity";
import { DeclarationsStep, EntityDetailsStep, PeopleStep, RegisteredAddressStep } from "./account-opening-steps";
import { AccountOpeningSummary } from "./account-opening-summary";
import {
  accountOpeningIndividualDescriptions,
  accountOpeningIndividualGuidance,
  emptyHolder,
  reviewAccountOpeningIndividual,
  stepOfAccountOpeningIndividualField,
  toAccountOpeningIndividual,
  type AccountOpeningIndividual,
} from "./account-opening-individual";
import {
  DeclarationsStep as IndividualDeclarationsStep,
  HolderStep,
  MailingStep,
} from "./account-opening-individual-steps";
import { AccountOpeningIndividualSummary } from "./account-opening-individual-summary";
import {
  customerIdentificationDescriptions,
  customerIdentificationGuidance,
  reviewCustomerIdentification,
  stepOfCustomerIdentificationField,
  toCustomerIdentification,
  type CustomerIdentification,
} from "./customer-identification";
import {
  AssetsStep,
  DeclarationStep as IdentificationDeclarationStep,
  DocumentsStep,
  ExperienceStep,
  IntentionsStep,
  PersonalStep,
  ScreeningStep,
  SignoffStep,
  WealthStep as IdentificationWealthStep,
} from "./customer-identification-steps";
import { CustomerIdentificationSummary } from "./customer-identification-summary";
import {
  dueDiligenceIndividualDescriptions,
  reviewDueDiligenceIndividual,
  stepOfDueDiligenceIndividualField,
  toDueDiligenceIndividual,
  type DueDiligenceIndividual,
} from "./customer-due-diligence-individual";
import { CustomerDetailsStep, DueDiligenceIndividualSummary } from "./customer-due-diligence-individual-steps";
import {
  professionalClientConfirmationDescriptions,
  professionalClientConfirmationGuidance,
  reviewProfessionalClientConfirmation,
  stepOfProfessionalClientConfirmationField,
  toProfessionalClientConfirmation,
  type ProfessionalClientConfirmation,
} from "./professional-client-confirmation";
import {
  HoldersStep,
  PrimaryStep,
  SecondaryStep,
  SignaturesStep,
} from "./professional-client-confirmation-steps";
import { ProfessionalClientConfirmationSummary } from "./professional-client-confirmation-summary";
import {
  fatcaCrsIndividualDescriptions,
  fatcaCrsIndividualGuidance,
  reviewFatcaCrsIndividual,
  stepOfFatcaCrsIndividualField,
  toFatcaCrsIndividual,
  type FatcaCrsIndividual,
} from "./fatca-crs-individual";
import {
  CitizenshipStep,
  DeclarationStep as IndividualSelfCertificationStep,
  HolderStep as FatcaHolderStep,
  ResidenceStep as IndividualResidenceStep,
} from "./fatca-crs-individual-steps";
import { FatcaCrsIndividualSummary } from "./fatca-crs-individual-summary";
import {
  dueDiligenceDescriptions,
  dueDiligenceGuidance,
  reviewDueDiligence,
  stepOfDueDiligenceField,
  toDueDiligence,
  type DueDiligenceEntity,
} from "./customer-due-diligence";
import {
  BusinessStep,
  ClassificationStep,
  ComplianceReviewStep,
  RiskStep,
  SuitabilityStep,
  WealthStep,
} from "./customer-due-diligence-steps";
import { DueDiligenceSummary } from "./customer-due-diligence-summary";
import {
  reviewRiskProfile,
  riskProfileDescriptions,
  riskProfileGuidance,
  stepOfRiskProfileField,
  toRiskProfile,
  type InvestmentRiskProfileEntity,
} from "./investment-risk-profile";
import {
  ProductKnowledgeStep,
  RiskAcknowledgementStep,
  RiskCustomerStep,
  RiskQuestionsStep,
  RiskRatingStep,
} from "./investment-risk-profile-steps";
import { RiskProfileSummary } from "./investment-risk-profile-summary";
import {
  classificationDescriptions,
  classificationGuidance,
  reviewClientClassification,
  stepOfClassificationField,
  toClientClassification,
  type ClientClassificationEntity,
} from "./client-classification";
import {
  ClassificationClientStep,
  ClassificationDeclarationStep,
  ProfessionalClientStep,
} from "./client-classification-steps";
import { ClientClassificationSummary } from "./client-classification-summary";
import {
  entityChecklistGroups,
  individualChecklistGroups,
  type ChecklistGroup,
  dfsaChecklistDescriptions,
  dfsaChecklistGuidance,
  reviewDfsaChecklist,
  stepOfDfsaChecklistField,
  toDfsaChecklist,
  type DfsaChecklistEntity,
} from "./dfsa-checklist";
import { ChecklistStep } from "./dfsa-checklist-steps";
import { DfsaChecklistSummary } from "./dfsa-checklist-summary";
import {
  fatcaCrsDescriptions,
  fatcaCrsGuidance,
  reviewFatcaCrs,
  stepOfFatcaCrsField,
  toFatcaCrs,
  type FatcaCrsEntity,
} from "./fatca-crs";
import {
  ControllingPersonsStep,
  CrsStep,
  DeclarationStep,
  EntityStep,
  FatcaStep,
  ResidenceStep,
} from "./fatca-crs-steps";
import { FatcaCrsSummary } from "./fatca-crs-summary";

/**
 * Everything that differs between one form of the pack and the next. The wizard itself — the rail, the saving,
 * the sending — is the same whichever form is being filled in; this is the part that isn't.
 */
export interface FormKit<T> {
  /** What the API holds, filled out to the whole form. */
  toValue: (answers: FormDetailAnswers | undefined) => T;
  /**
   * What is still missing, and which parts that leaves incomplete.
   *
   * @param provided the lines a document has been attached for, since some of them ask for one
   */
  review: (value: T, provided: ReadonlySet<string>) => FormReview;
  /** The part a field belongs to, so a message from the API opens the part that holds it. */
  stepOfField: (field: string) => string;
  /** A line under each part's heading saying what it asks for. */
  descriptions: Record<string, string>;
  /** What the paper says at the top of each part, shown before it is filled in. */
  guidance: Record<string, string>;
  step: (at: {
    id: string;
    value: T;
    change: (patch: Partial<T>) => void;
    field: FieldFor;
    goTo: (id: string) => void;
    /** The client the form is about, for a part that reads the firm's own wording alongside it. */
    customerId: string;
    /** The form itself, for a part that attaches a document to one of its lines. */
    formId: string;
    /** What has been attached, and how to attach more or take one back. */
    documents: FormDocuments;
    /** The firm's own name, for the lines of a form that print it. */
    firmName: string | null;
  }) => ReactNode;
  summary: (value: T, attachments: AttachedFile[]) => ReactNode;
}

const accountOpeningDescriptions: Record<string, string> = {
  entity: "In this section, please provide details of the entity. All Account Holders\u2019 details fields are mandatory, unless otherwise stated.",
  address: "Registered Address of the Entity (Physical address, not just PO Box)",
  signatories: "Please provide copies of the mandatory documents below.",
  owners: "Please provide copies of the mandatory documents below.",
  directors: "(In case of multiple Directors, please use the same form for each Director)",
  declarations: "Request to open account, the tax declaration, and the signing mandate.",
};

export const accountOpeningKit: FormKit<AccountOpeningEntity> = {
  toValue: toAccountOpening,
  review: reviewAccountOpening,
  stepOfField,
  descriptions: accountOpeningDescriptions,
  guidance: sectionGuidance,
  summary: (value) => <AccountOpeningSummary value={value} />,
  step: ({ id, value, change, field, goTo, formId, documents, firmName }) => {
    switch (id) {
      case "entity":
        return <EntityDetailsStep entity={value.entity} onChange={(patch) => change({ entity: { ...value.entity, ...patch } })} field={field} />;
      case "address":
        return <RegisteredAddressStep value={value.registeredAddress} onChange={(registeredAddress) => change({ registeredAddress })} field={field} />;
      case "signatories":
        return (
          <PeopleStep
            at="signatories"
            noun="Authorised Signatory"
            people={value.signatories}
            formId={formId}
            documents={documents}
            onChange={(signatories) => change({ signatories })}
            field={field}
          />
        );
      case "owners":
        return (
          <PeopleStep
            at="beneficialOwners"
            noun="Beneficial Owner"
            people={value.beneficialOwners}
            formId={formId}
            documents={documents}
            onChange={(beneficialOwners) => change({ beneficialOwners })}
            field={field}
          />
        );
      case "directors":
        return (
          <PeopleStep
            at="directors"
            noun="Director"
            people={value.directors}
            formId={formId}
            documents={documents}
            onChange={(directors) => change({ directors })}
            field={field}
          />
        );
      case "declarations":
        return <DeclarationsStep declarations={value.declarations} firmName={firmName} onChange={(patch) => change({ declarations: { ...value.declarations, ...patch } })} field={field} />;
      default:
        return <AccountOpeningSummary value={value} onEdit={goTo} />;
    }
  },
};

export const dueDiligenceKit: FormKit<DueDiligenceEntity> = {
  toValue: toDueDiligence,
  review: reviewDueDiligence,
  stepOfField: stepOfDueDiligenceField,
  descriptions: dueDiligenceDescriptions,
  guidance: dueDiligenceGuidance,
  summary: (value) => <DueDiligenceSummary value={value} />,
  step: ({ id, value, change, field, goTo, formId, documents }) => {
    switch (id) {
      case "business":
        return <BusinessStep business={value.business} onChange={(patch) => change({ business: { ...value.business, ...patch } })} field={field} />;
      case "classification":
        return <ClassificationStep classification={value.classification} formId={formId} documents={documents} onChange={(patch) => change({ classification: { ...value.classification, ...patch } })} field={field} />;
      case "suitability":
        return <SuitabilityStep suitability={value.suitability} screening={value.screening} onChange={(patch) => change(patch)} field={field} />;
      case "wealth":
        return <WealthStep wealth={value.wealth} onChange={(patch) => change({ wealth: { ...value.wealth, ...patch } })} field={field} />;
      case "risk":
        return <RiskStep risk={value.risk} formId={formId} documents={documents} onChange={(patch) => change({ risk: { ...value.risk, ...patch } })} field={field} />;
      case "compliance":
        return <ComplianceReviewStep review={value.review} onChange={(patch) => change({ review: { ...value.review, ...patch } })} field={field} />;
      default:
        return <DueDiligenceSummary value={value} onEdit={goTo} />;
    }
  },
};

export const fatcaCrsKit: FormKit<FatcaCrsEntity> = {
  toValue: toFatcaCrs,
  review: reviewFatcaCrs,
  stepOfField: stepOfFatcaCrsField,
  descriptions: fatcaCrsDescriptions,
  guidance: fatcaCrsGuidance,
  summary: (value, attachments) => <FatcaCrsSummary value={value} attachments={attachments} />,
  step: ({ id, value, change, field, goTo, formId, documents }) => {
    switch (id) {
      case "entity":
        return <EntityStep entity={value.entity} onChange={(patch) => change({ entity: { ...value.entity, ...patch } })} field={field} />;
      case "residence":
        return <ResidenceStep residence={value.residence} formId={formId} documents={documents} onChange={(patch) => change({ residence: { ...value.residence, ...patch } })} field={field} />;
      case "fatca":
        return <FatcaStep value={value} onChange={(patch) => change({ fatca: { ...value.fatca, ...patch } })} field={field} />;
      case "crs":
        return <CrsStep value={value} onChange={(patch) => change({ crs: { ...value.crs, ...patch } })} field={field} />;
      case "controlling":
        return <ControllingPersonsStep value={value} onChange={(patch) => change(patch)} field={field} />;
      case "declaration":
        return <DeclarationStep declaration={value.declaration} onChange={(patch) => change({ declaration: { ...value.declaration, ...patch } })} field={field} />;
      default:
        return <FatcaCrsSummary value={value} attachments={documents.files} onEdit={goTo} />;
    }
  },
};

/**
 * The individual's copy of the due diligence form: the entity's form with one table changed, so every part of
 * it below that table is the entity form's own.
 */
export const dueDiligenceIndividualKit: FormKit<DueDiligenceIndividual> = {
  toValue: toDueDiligenceIndividual,
  review: reviewDueDiligenceIndividual,
  stepOfField: stepOfDueDiligenceIndividualField,
  descriptions: dueDiligenceIndividualDescriptions,
  guidance: dueDiligenceGuidance,
  summary: (value) => <DueDiligenceIndividualSummary value={value} />,
  step: ({ id, value, change, field, goTo, formId, documents }) => {
    switch (id) {
      case "customer":
        return <CustomerDetailsStep customer={value.customer} onChange={(patch) => change({ customer: { ...value.customer, ...patch } })} field={field} />;
      case "classification":
        return <ClassificationStep classification={value.classification} formId={formId} documents={documents} onChange={(patch) => change({ classification: { ...value.classification, ...patch } })} field={field} />;
      case "suitability":
        return <SuitabilityStep suitability={value.suitability} screening={value.screening} onChange={(patch) => change(patch)} field={field} />;
      case "wealth":
        return <WealthStep wealth={value.wealth} onChange={(patch) => change({ wealth: { ...value.wealth, ...patch } })} field={field} />;
      case "risk":
        return <RiskStep risk={value.risk} formId={formId} documents={documents} onChange={(patch) => change({ risk: { ...value.risk, ...patch } })} field={field} />;
      case "compliance":
        return <ComplianceReviewStep review={value.review} onChange={(patch) => change({ review: { ...value.review, ...patch } })} field={field} />;
      default:
        return <DueDiligenceIndividualSummary value={value} onEdit={goTo} />;
    }
  },
};

/**
 * The Customer Identification Form. Nine parts, all of them the paper's own: its questions are written as data
 * in its module, so each part sets out its own list the same way.
 */
export const customerIdentificationKit: FormKit<CustomerIdentification> = {
  toValue: toCustomerIdentification,
  review: reviewCustomerIdentification,
  stepOfField: stepOfCustomerIdentificationField,
  descriptions: customerIdentificationDescriptions,
  guidance: customerIdentificationGuidance,
  summary: (value, attachments) => <CustomerIdentificationSummary value={value} attachments={attachments} />,
  step: ({ id, value, change, field, goTo, formId, documents }) => {
    const at = { value, onChange: change, field };
    switch (id) {
      case "personal":
        return <PersonalStep {...at} />;
      case "intentions":
        return <IntentionsStep {...at} />;
      case "wealth":
        return <IdentificationWealthStep {...at} />;
      case "assets":
        return <AssetsStep {...at} />;
      case "experience":
        return <ExperienceStep {...at} />;
      case "declaration":
        return <IdentificationDeclarationStep {...at} />;
      case "documents":
        return <DocumentsStep at={at} formId={formId} documents={documents} />;
      case "signoff":
        return <SignoffStep {...at} />;
      case "screening":
        return <ScreeningStep {...at} />;
      default:
        return <CustomerIdentificationSummary value={value} attachments={documents.files} onEdit={goTo} />;
    }
  },
};

/** What the two holders of a joint account confirm about which of them operates it. */
export const professionalClientConfirmationKit: FormKit<ProfessionalClientConfirmation> = {
  toValue: toProfessionalClientConfirmation,
  review: reviewProfessionalClientConfirmation,
  stepOfField: stepOfProfessionalClientConfirmationField,
  descriptions: professionalClientConfirmationDescriptions,
  guidance: professionalClientConfirmationGuidance,
  summary: (value) => <ProfessionalClientConfirmationSummary value={value} />,
  step: ({ id, value, change, field, goTo }) => {
    switch (id) {
      case "holders":
        return <HoldersStep holders={value.holders} onChange={(patch) => change({ holders: { ...value.holders, ...patch } })} field={field} />;
      case "primary":
        return <PrimaryStep primary={value.primary} onChange={(patch) => change({ primary: { ...value.primary, ...patch } })} field={field} />;
      case "secondary":
        return <SecondaryStep secondary={value.secondary} onChange={(patch) => change({ secondary: { ...value.secondary, ...patch } })} field={field} />;
      case "signatures":
        return <SignaturesStep signatures={value.signatures} onChange={(patch) => change({ signatures: { ...value.signatures, ...patch } })} field={field} />;
      default:
        return <ProfessionalClientConfirmationSummary value={value} onEdit={goTo} />;
    }
  },
};

/**
 * The individual self-certification. It shares a name with the entity form and almost nothing else: four Parts
 * about a person, where the entity form has five about a company.
 */
export const fatcaCrsIndividualKit: FormKit<FatcaCrsIndividual> = {
  toValue: toFatcaCrsIndividual,
  review: reviewFatcaCrsIndividual,
  stepOfField: stepOfFatcaCrsIndividualField,
  descriptions: fatcaCrsIndividualDescriptions,
  guidance: fatcaCrsIndividualGuidance,
  summary: (value) => <FatcaCrsIndividualSummary value={value} />,
  step: ({ id, value, change, field, goTo }) => {
    switch (id) {
      case "holder":
        return <FatcaHolderStep holder={value.holder} onChange={(patch) => change({ holder: { ...value.holder, ...patch } })} field={field} />;
      case "residence":
        return <IndividualResidenceStep residence={value.residence} onChange={(patch) => change({ residence: { ...value.residence, ...patch } })} field={field} />;
      case "fatca":
        return <CitizenshipStep fatca={value.fatca} onChange={(patch) => change({ fatca: { ...value.fatca, ...patch } })} field={field} />;
      case "declaration":
        return <IndividualSelfCertificationStep declaration={value.declaration} onChange={(patch) => change({ declaration: { ...value.declaration, ...patch } })} field={field} />;
      default:
        return <FatcaCrsIndividualSummary value={value} onEdit={goTo} />;
    }
  },
};

/**
 * The checklist is the same form whichever pack it is in; what changes is the list of what has to be on file,
 * which the firm writes differently for a person than for an entity.
 */
function checklistKit(groups: ChecklistGroup[]): FormKit<DfsaChecklistEntity> {
  return {
    toValue: toDfsaChecklist,
    review: (value) => reviewDfsaChecklist(groups, value),
    stepOfField: (field) => stepOfDfsaChecklistField(groups, field),
    descriptions: dfsaChecklistDescriptions(groups),
    guidance: dfsaChecklistGuidance,
    summary: (value, attachments) => <DfsaChecklistSummary groups={groups} value={value} attachments={attachments} />,
    step: ({ id, value, change, field, goTo, formId, documents }) => {
      const group = groups.find((one) => one.id === id);
      if (!group) {
        return <DfsaChecklistSummary groups={groups} value={value} attachments={documents.files} onEdit={goTo} />;
      }
      return (
        <ChecklistStep
          group={group}
          value={value}
          formId={formId}
          documents={documents}
          onChange={change}
          field={field}
        />
      );
    },
  };
}

export const accountOpeningIndividualKit: FormKit<AccountOpeningIndividual> = {
  toValue: toAccountOpeningIndividual,
  review: reviewAccountOpeningIndividual,
  stepOfField: stepOfAccountOpeningIndividualField,
  descriptions: accountOpeningIndividualDescriptions,
  guidance: accountOpeningIndividualGuidance,
  summary: (value, attachments) => <AccountOpeningIndividualSummary value={value} attachments={attachments} />,
  step: ({ id, value, change, field, goTo, formId, documents, firmName }) => {
    const holder = (at: number) => (
      <HolderStep
        at={at}
        holder={value.holders[at] ?? emptyHolder()}
        formId={formId}
        documents={documents}
        onChange={(patch) => {
          const holders = [...value.holders];
          while (holders.length <= at) holders.push(emptyHolder());
          holders[at] = { ...holders[at]!, ...patch };
          change({ holders });
        }}
        field={field}
      />
    );
    switch (id) {
      case "holder1":
        return holder(0);
      case "holder2":
        return holder(1);
      case "mailing":
        return <MailingStep mailing={value.mailing} onChange={(patch) => change({ mailing: { ...value.mailing, ...patch } })} field={field} />;
      case "declarations":
        return <IndividualDeclarationsStep declarations={value.declarations} firmName={firmName} onChange={(patch) => change({ declarations: { ...value.declarations, ...patch } })} field={field} />;
      default:
        return <AccountOpeningIndividualSummary value={value} attachments={documents.files} onEdit={goTo} />;
    }
  },
};

export const dfsaChecklistKit = checklistKit(entityChecklistGroups);

export const dfsaChecklistIndividualKit = checklistKit(individualChecklistGroups);

export const clientClassificationKit: FormKit<ClientClassificationEntity> = {
  toValue: toClientClassification,
  review: reviewClientClassification,
  stepOfField: stepOfClassificationField,
  descriptions: classificationDescriptions,
  guidance: classificationGuidance,
  summary: (value) => <ClientClassificationSummary value={value} />,
  step: ({ id, value, change, field, goTo, formId, documents }) => {
    switch (id) {
      case "client":
        return <ClassificationClientStep client={value.client} onChange={(patch) => change({ client: { ...value.client, ...patch } })} field={field} />;
      case "classification":
        return <ProfessionalClientStep value={value} formId={formId} documents={documents} onChange={change} field={field} />;
      case "declaration":
        return <ClassificationDeclarationStep declaration={value.declaration} formId={formId} documents={documents} onChange={(patch) => change({ declaration: { ...value.declaration, ...patch } })} field={field} />;
      default:
        return <ClientClassificationSummary value={value} onEdit={goTo} />;
    }
  },
};

export const riskProfileKit: FormKit<InvestmentRiskProfileEntity> = {
  toValue: toRiskProfile,
  review: reviewRiskProfile,
  stepOfField: stepOfRiskProfileField,
  descriptions: riskProfileDescriptions,
  guidance: riskProfileGuidance,
  summary: (value) => <RiskProfileSummary value={value} />,
  step: ({ id, value, change, field, goTo }) => {
    switch (id) {
      case "customer":
        return <RiskCustomerStep value={value} onChange={change} field={field} />;
      case "objectives":
        return <RiskQuestionsStep ids={["q1", "q2"]} value={value} onChange={change} field={field} />;
      case "knowledge":
        return <ProductKnowledgeStep value={value} onChange={change} field={field} />;
      case "attitude":
        return <RiskQuestionsStep ids={["q4", "q5", "q6"]} value={value} onChange={change} field={field} />;
      case "capacity":
        return <RiskQuestionsStep ids={["q7", "q8", "q9", "q10", "q11", "q12", "q13"]} value={value} onChange={change} field={field} />;
      case "rating":
        return <RiskRatingStep value={value} onChange={change} field={field} />;
      case "acknowledgement":
        return <RiskAcknowledgementStep value={value} onChange={change} field={field} />;
      default:
        return <RiskProfileSummary value={value} onEdit={goTo} />;
    }
  },
};
