import type { Address, StaffMember } from "@atomprive/api-client/backoffice";
import { Badge, Button } from "@atomprive/ui";
import { PencilLine } from "lucide-react";
import type { ReactNode } from "react";
import { countryName } from "../../lib/countries";
import { formatMobileNumber } from "../../lib/mobile-numbers";
import { RiskProfilesSummary } from "./risk-profiles-summary";
import { riskProfileGiven } from "./risk-profiling";
import {
  activeForLabels,
  addressGiven,
  decisionLabels,
  incomeLabels,
  incomeSourceLabels,
  knowledgeLabels,
  managedByLabels,
  netWealthLabels,
  productLabels,
  serviceLabels,
  turnoverLabels,
  wealthSourceLabels,
  employmentStatusLabels,
  genderLabels,
  holderGroup,
  holderName,
  maritalStatusLabels,
  occupationLabels,
  works,
  signingAuthorityText,
  signsFor,
  reviewApplication,
  activityLabels,
  capitalSourceLabels,
  classificationLabels,
  companyActiveForLabels,
  companyAddressGiven,
  companyManagedByLabels,
  companyProductLabels,
  companyWealthSourceLabels,
  controllerGroup,
  controllerTypeGroups,
  holderCertGroup,
  legalFormLabels,
  listedAsLabels,
  namedControllers,
  ownerGroup,
  type FormApplication,
  type FormHolder,
  type TaxLine,
} from "./application";

const shownDate = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });

function date(value: string | null) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? "");
  return match ? shownDate.format(new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))) : null;
}

/** The boxes ticked, then what was written on the paper's "Other (please specify)" line. */
function withOther(ticked: string[], other: string | null) {
  return [...ticked, ...(other?.trim() ? [`Other: ${other.trim()}`] : [])].join(", ") || null;
}

function country(code: string | null) {
  return code ? countryName(code) : null;
}

function address(value: Address | null) {
  if (!value) return null;
  const parts = [value.line1, value.line2, [value.city, value.state, value.postalCode].filter(Boolean).join(", "), country(value.country)];
  const text = parts.filter((part) => part && part.trim() !== "").join("\n");
  return text || null;
}

type Row = [label: string, value: ReactNode];

/** A self-certification's tax residences, a line each: the country, then the TIN or the reason there is none. */
function taxText(rows: TaxLine[]) {
  return rows.filter((row) => row.country || row.tin?.trim() || row.reason)
    .map((row) => `${country(row.country) ?? "—"} · ${row.tin?.trim() ? `TIN ${row.tin.trim()}` : row.reason ? `No TIN, Reason ${row.reason}` : "—"}`)
    .join("\n") || null;
}

interface SummaryProps {
  application: FormApplication;
  managers: StaffMember[] | undefined;
  /** When given, each section offers Edit, which opens that step. */
  onEdit?: (stepId: string) => void;
}

/** A joint holder's part in signing, as a tag beside their name (23 Nov 2026). */
function signingTag(signs: boolean | null) {
  if (signs === null) return null;
  return signs ? <Badge tone="success">Signatory</Badge> : <Badge tone="neutral">May not sign</Badge>;
}

/** Everything entered, section by section, as the last step of the form and for cases already submitted. */
export function ApplicationSummary({ application, managers, onEdit }: SummaryProps) {
  const { steps } = reviewApplication(application, managers);
  const complete = (id: string) => steps.find((step) => step.id === id)?.complete ?? false;
  const managerName = managers?.find((person) => person.id === application.relationshipManagerId)?.fullName ?? null;

  let signingSection: { id: string; title: string; rows: Row[] } | null = null;
  // The self-certification (25 Nov 2026), shown after the questionnaires, where the form asks it.
  const certSections: { id: string; title: string; rows: Row[] }[] = [];
  const sections: { id: string; title: string; rows: Row[] }[] = [
    {
      id: "client",
      title: "Client type",
      rows: [
        ["Client type", application.clientType === "ENTITY" ? "Entity" : "Individual"],
        ["Relationship manager", managerName],
      ],
    },
  ];

  // Schedule 2 for one person (24 Nov 2026): an account holder, or an entity's beneficial owner (25 Nov 2026).
  const personSections = (holder: FormHolder, index: number, prefix: "holder" | "owner", group: string) => {
      const { details } = holder;
      const countries = (codes: string[]) => codes.map(countryName).join(", ") || null;
      const profile = details.profile;
      // An application from before 24 Nov 2026 has no professional status; its occupation is shown instead.
      const workRows: Row[] = details.employmentStatus
        ? [
            ["Professional status", employmentStatusLabels[details.employmentStatus]],
            ...(works(details)
              ? ([
                  ["Job title / function", holder.employer.position],
                  ["Sector / industry", details.sector],
                  ["Name of employer", holder.employer.companyName],
                  ["Country of business", country(holder.employer.country)],
                ] as Row[])
              : []),
          ]
        : [["Occupation", holder.occupation === "OTHER" ? `Other: ${holder.occupationOther ?? "—"}` : holder.occupation && occupationLabels[holder.occupation]]];
      sections.push(
        {
          id: `${prefix}-${index}-name`,
          title: `${group} · Personal details`,
          // Schedule 2's lines in its order and words (24 Nov 2026), and nothing it does not ask.
          rows: [
            ["Full name (as on passport)", holder.fullName],
            ["Previous name(s)", details.previousNames],
            ["Other name(s) (including any alias)", details.otherNames],
            ...(prefix === "holder" && application.holders.length > 1 ? ([["Signing", signingTag(signsFor(application, holder))]] as Row[]) : []),
            ["Gender", details.gender && genderLabels[details.gender]],
            ["Date of birth", date(holder.dateOfBirth)],
            ["Place of birth", [details.placeOfBirth, country(holder.countryOfBirth)].filter(Boolean).join(", ") || null],
            ["Marital status", details.maritalStatus && maritalStatusLabels[details.maritalStatus]],
            ["Spouse name", details.maritalStatus === "MARRIED" ? details.spouseName : null],
            ["Nationality (Nationalities)", countries([holder.nationality, ...details.otherNationalities].filter((code): code is string => Boolean(code)))],
            ["Country of citizenship / residency", countries(details.citizenship)],
            ["Country of legal domicile", country(details.legalDomicile) ?? "Same as above"],
            ["Country of fiscal residence", country(details.fiscalResidence) ?? "Same as above"],
          ],
        },
        {
          id: `${prefix}-${index}-address`,
          title: `${group} · Address and contact`,
          rows: [
            ["Permanent address", [address(holder.residentialAddress), details.emirate].filter(Boolean).join(", ") || null],
            [
              "Mailing address",
              holder.mailingSameAsResidential || !addressGiven(holder.mailingAddress) ? "Same as permanent address"
                : [address(holder.mailingAddress), details.mailingEmirate].filter(Boolean).join(", ") || null,
            ],
            ["Telephone", [formatMobileNumber(holder.phone), formatMobileNumber(details.secondPhone)].filter(Boolean).join(", ") || null],
            ["Fax", [details.fax, details.secondFax].filter(Boolean).join(", ") || "None"],
            ["Email", [holder.email, details.secondEmail].filter(Boolean).join(", ") || null],
          ],
        },
        { id: `${prefix}-${index}-work`, title: `${group} · Professional details`, rows: workRows },
      );
      // Schedule 2's second page (24 Nov 2026), each answer in the paper's words, with any "Other" written in. A
      // client onboarded before it was asked has none, so their file does not list four empty sections.
      const answered = Object.entries(profile).some(([key, value]) => key !== "pepPeople" && (Array.isArray(value) ? value.length > 0 : value !== null));
      if (!onEdit && !answered) return;
      sections.push(
        {
          id: `${prefix}-${index}-pep`,
          title: `${group} · Politically exposed person`,
          rows: [
            ["Politically exposed person", profile.pep === null ? null : profile.pep ? "Yes" : "No"],
            ...(profile.pep
              ? profile.pepPeople.filter((one) => one.name || one.function)
                .map((one, at): Row => [`Name and function${at > 0 ? ` (${at + 1})` : ""}`, [one.name, one.function].filter(Boolean).join(", ")])
              : []),
          ],
        },
        {
          id: `${prefix}-${index}-business`,
          title: `${group} · Business intentions with us`,
          rows: [
            ["Services or products of interest", withOther(profile.services.map((one) => serviceLabels[one]), profile.servicesOther)],
            ["Expected annual in/out flow turnover", profile.turnover && turnoverLabels[profile.turnover]],
          ],
        },
        {
          id: `${prefix}-${index}-wealth`,
          title: `${group} · Wealth and income`,
          rows: [
            ["Estimated global net wealth", withOther(profile.netWealth ? [netWealthLabels[profile.netWealth]] : [], profile.netWealthOther)],
            ["How the wealth was built up", withOther(profile.wealthSources.map((one) => wealthSourceLabels[one]), profile.wealthSourcesOther)],
            ["Countries the wealth is in or was built up", countries(profile.wealthCountries)],
            ["Annual regular income", profile.income && incomeLabels[profile.income]],
            ["How the regular income is earned", withOther(profile.incomeSources.map((one) => incomeSourceLabels[one]), profile.incomeSourcesOther)],
            ["Countries the regular income is earned", countries(profile.incomeCountries)],
          ],
        },
        {
          id: `${prefix}-${index}-experience`,
          title: `${group} · Experience and understanding of financial markets`,
          rows: [
            ["Knowledge and understanding", withOther(profile.knowledge ? [knowledgeLabels[profile.knowledge]] : [], profile.knowledgeOther)],
            ["Active on the financial markets for", withOther(profile.activeFor ? [activeForLabels[profile.activeFor]] : [], profile.activeForOther)],
            ["Assets managed before", withOther(profile.managedBy ? [managedByLabels[profile.managedBy]] : [], profile.managedByOther)],
            ["Products invested in regularly", withOther(profile.products.map((one) => productLabels[one]), profile.productsOther)],
            ["Investment decisions taken", withOther(profile.decisions ? [decisionLabels[profile.decisions]] : [], profile.decisionsOther)],
          ],
        },
      );
  };

  if (application.clientType === "ENTITY") {
    const { entity } = application;
    const company = entity.company;
    const lines = (rows: { name: string | null }[], text: (row: never) => string) =>
      rows.filter((row) => row.name?.trim()).map((row) => text(row as never)).join("\n") || null;
    const yes = (value: boolean | null, more?: string | null) => (value === null ? null : value ? `Yes${more ? `, ${more}` : ""}` : "No");
    // Schedule 2(A) (25 Nov 2026), in the paper's words and order.
    sections.push(
      {
        id: "entity-identification",
        title: "Company · Identification details",
        rows: [
          ["Registered name", entity.legalName],
          ["Legal form", company.form && legalFormLabels[company.form]],
          ["Other used trading name(s)", company.tradingNames],
          ["Date of incorporation", date(entity.dateOfIncorporation)],
          ["Place/Emirate of incorporation", company.placeOfIncorporation],
          ["License number of the Company", entity.registrationNumber],
        ],
      },
      {
        id: "entity-addresses",
        title: "Company · Addresses",
        rows: [
          ["Registered address", [address(entity.registeredAddress), company.registeredEmirate].filter(Boolean).join(", ") || null],
          ["Trading address", companyAddressGiven(company.tradingAddress) ? [address(company.tradingAddress), company.tradingEmirate].filter(Boolean).join(", ") : "Same as registered address"],
          ["Other countries of operations / business", entity.countriesOfBusiness.map(countryName).join(", ") || "None"],
          ["Mailing address", companyAddressGiven(company.mailingAddress) ? [address(company.mailingAddress), company.mailingEmirate].filter(Boolean).join(", ") : "Same as registered address"],
        ],
      },
      {
        id: "entity-contact",
        title: "Company · Contact details",
        rows: [
          ["Contact name", company.contactName],
          ["Telephone", [company.phone, company.secondPhone].filter(Boolean).join(", ") || null],
          ["Fax", [company.fax, company.secondFax].filter(Boolean).join(", ") || "None"],
          ["Email", [company.email, company.secondEmail].filter(Boolean).join(", ") || null],
          ["Website", company.website],
          ["Country of fiscal residence", country(entity.taxResidency)],
        ],
      },
      {
        id: "entity-activity",
        title: "Company · Business activities, group and regulation",
        rows: [
          ["Business activity(ies)", [company.activities.map((one) => activityLabels[one]).join(", "), company.activitiesDetail].filter(Boolean).join("\n") || null],
          ["Part of a group", yes(company.partOfGroup, [company.groupName, country(company.groupCountry)].filter(Boolean).join(", "))],
          ["Supervised by a Financial Services Regulator", yes(entity.regulated, entity.regulatorName)],
          ["Name of External Auditor", company.externalAuditor],
          ["Politically exposed person among directors, signatories or shareholders", yes(company.pep, [company.pepPerson.name, company.pepPerson.function].filter(Boolean).join(", "))],
        ],
      },
      {
        id: "entity-directors",
        title: "Company · Directors, shareholders and signatories",
        rows: [
          ["Directors / Partners", lines(company.directors, (row: { name: string; position: string | null }) => [row.name, row.position].filter(Boolean).join(" · "))],
          ["Publicly listed", yes(company.listed, [company.exchange, company.ticker].filter(Boolean).join(" · "))],
          ["Shareholders", lines(company.shareholders, (row: { name: string; sharePercent: number | null; controllers: string | null }) =>
            [row.name, row.sharePercent === null ? null : `${row.sharePercent}%`, row.controllers?.trim() ? `controlled by ${row.controllers.trim().replaceAll("\n", ", ")}` : null].filter(Boolean).join(" · "))],
          ["Persons who will interact with us", lines(company.signatories, (row: { name: string; position: string | null }) => [row.name, row.position].filter(Boolean).join(" · "))],
        ],
      },
      {
        id: "entity-intentions",
        title: "Company · Business intentions, wealth and experience",
        rows: [
          ["Services or products of interest", withOther(company.services.map((one) => serviceLabels[one]), company.servicesOther)],
          ["Expected annual in/out flow turnover", company.turnover && turnoverLabels[company.turnover]],
          ["Estimated global net wealth", withOther(company.netWealth ? [netWealthLabels[company.netWealth]] : [], company.netWealthOther)],
          ["How it has been built up", withOther(company.wealthSources.map((one) => companyWealthSourceLabels[one]), company.wealthSourcesOther)],
          ["Personal Investment Vehicle", yes(company.personalInvestmentVehicle, withOther(company.capitalSources.map((one) => capitalSourceLabels[one]), company.capitalSourcesOther))],
          ["Active on the financial markets for", withOther(company.activeFor ? [companyActiveForLabels[company.activeFor]] : [], company.activeForOther)],
          ["Assets managed before", withOther(company.managedBy ? [companyManagedByLabels[company.managedBy]] : [], company.managedByOther)],
          ["Products invested in regularly", withOther(company.products.map((one) => companyProductLabels[one]), company.productsOther)],
        ],
      },
    );
    application.beneficialOwners.forEach((owner, index) => personSections(owner, index, "owner", ownerGroup(index)));
    // The self-certification and the Annex of each controlling person it names (25 Nov 2026).
    const form = entity.selfCertification;
    certSections.push({
      id: "sc-identification",
      title: "Self-certification · Entity",
      rows: [
        ["Place of incorporation", country(entity.countryOfIncorporation)],
        ["Place of operations", country(form.placeOfOperations)],
        ["Tax residence", taxText(form.taxResidences)],
        ...(form.noTinExplanation?.trim() ? ([["Why no TIN", form.noTinExplanation]] as Row[]) : []),
        ["CRS classification", form.classification && [
          classificationLabels[form.classification],
          form.classification === "ACTIVE_NFE_LISTED" && form.listedAs ? `${listedAsLabels[form.listedAs]}${form.relatedEntity ? ` (${form.relatedEntity})` : ""}${form.securitiesMarket ? `: ${form.securitiesMarket}` : ""}` : null,
          form.classification === "ACTIVE_NFE_OTHER" ? form.activeCategory : null,
        ].filter(Boolean).join("\n")],
      ],
    });
    for (const place of namedControllers(form)) {
      const person = form.controllingPersons[place]!;
      const type = controllerTypeGroups.flatMap((group) => Object.entries(group.types)).find(([key]) => key === person.type)?.[1] ?? null;
      certSections.push({
        id: `cp-${place}-identification`,
        title: `${controllerGroup(place)} · ${person.fullName ?? ""}`,
        rows: [
          ["Name", [person.title, person.firstName, person.middleNames, person.surname].filter(Boolean).join(" ") || null],
          ["Date of birth", date(person.dateOfBirth)],
          ["Place of birth", [person.townOfBirth, country(person.countryOfBirth)].filter(Boolean).join(", ") || null],
          ["Current residence address", address(person.residenceAddress)],
          ["Tax residence", taxText(person.taxResidences)],
          ["Type of controlling person", type && (person.typeOther?.trim() ? `${type}: ${person.typeOther.trim()}` : type)],
        ],
      });
    }
  } else {
    application.holders.forEach((holder, index) => {
      const group = holderGroup(index);
      // A joint holder whose details were skipped (24 Nov 2026): who they are, and that the rest wasn't taken.
      if (index > 0 && holder.details.skipped) {
        sections.push({
          id: `holder-${index}-name`,
          title: `${group} · Details skipped`,
          rows: [
            ["Full name", holder.fullName],
            ["Email", holder.email],
            ["Telephone", holder.phone],
            ["Client Details", "Skipped, not needed to submit"],
          ],
        });
        return;
      }
      personSections(holder, index, "holder", group);
    });
    // Each holder's self-certification (25 Nov 2026), shown after the risk questionnaires as the form asks it.
    application.holders.forEach((holder, index) => {
      if (index > 0 && holder.details.skipped) return;
      certSections.push({
        id: `holdercert-${index}-identification`,
        title: holderCertGroup(index),
        rows: [
          ["Name", [holder.details.title, holder.forenames, holder.details.middleNames, holder.surname].filter(Boolean).join(" ") || null],
          ["Current residence address", address(holder.residentialAddress)],
          ["Mailing address", addressGiven(holder.mailingAddress) ? address(holder.mailingAddress) : "Same as residence address"],
          ["Tax residence", taxText(holder.details.taxResidences)],
          ...(holder.details.noTinExplanation?.trim() ? ([["Why no TIN", holder.details.noTinExplanation]] as Row[]) : []),
        ],
      });
    });
    if (application.holders.length > 1) {
      const signers = application.holders.flatMap((holder, index) => (signsFor(application, holder) ? [holderName(holder, index)] : []));
      const notSigning = application.holders.flatMap((holder, index) => (signsFor(application, holder) === false ? [holderName(holder, index)] : []));
      // Shown after the risk questionnaires, which is where the form asks it (24 Nov 2026).
      signingSection = {
        id: "signing",
        title: "Joint account · Signing authority",
        rows: [
          ["Signing authority", signingAuthorityText(application)],
          ["Authorised signatories", signers.join(", ") || null],
          ...(notSigning.length > 0 ? ([["May not sign", notSigning.join(", ")]] as Row[]) : []),
        ],
      };
    }
  }

  const drawSection = (section: { id: string; title: string; rows: Row[] }) => (
        <section key={section.id} className="rounded-xl border border-line">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-slate-50/60 px-4 py-2.5">
            <h3 className="text-sm font-bold">{section.title}</h3>
            <div className="flex items-center gap-2">
              {onEdit && !complete(section.id) && <Badge tone="warning">Needs details</Badge>}
              {onEdit && (
                <Button size="sm" variant="ghost" onClick={() => onEdit(section.id)}>
                  <PencilLine aria-hidden="true" />
                  Edit
                </Button>
              )}
            </div>
          </div>
          <dl className="grid gap-x-6 gap-y-3 px-4 py-4 sm:grid-cols-2 xl:grid-cols-3">
            {section.rows.map(([label, value]) => (
              <div key={label} className="min-w-0">
                <dt className="text-2xs font-medium tracking-wide text-ink-muted uppercase">{label}</dt>
                <dd className={value ? "mt-0.5 text-sm font-medium break-words whitespace-pre-line" : "mt-0.5 text-sm text-ink-muted"}>{value || "—"}</dd>
              </div>
            ))}
          </dl>
        </section>
  );

  return (
    <div className="space-y-4">
      {sections.map((section) => drawSection(section))}
      {/* A case submitted before 24 Nov 2026 has none: only the form being filled in shows an empty one. */}
      {(onEdit || application.riskProfiles.some(riskProfileGiven)) && (
        <RiskProfilesSummary
          profiles={application.clientType === "ENTITY" ? application.riskProfiles.slice(0, 1).map((one) => ({ ...one, filledInFor: application.entity.legalName })) : application.riskProfiles}
          complete={(index) => steps.filter((step) => step.id.startsWith(`risk-${index}-`)).every((step) => step.complete)}
          // Edit opens the questionnaire where it still needs something, or at its start.
          onEdit={onEdit && ((index) => onEdit(steps.find((step) => step.id.startsWith(`risk-${index}-`) && !step.complete)?.id ?? `risk-${index}-knowledge`))}
        />
      )}
      {/* The self-certification after the questionnaires, as the form asks it (25 Nov 2026); a case from before has none. */}
      {(onEdit || certSections.some((section) => section.rows.some(([, value]) => value))) && certSections.map((section) => drawSection(section))}
      {signingSection && drawSection(signingSection)}
    </div>
  );
}
