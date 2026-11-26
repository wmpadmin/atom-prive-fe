import html2canvas from "html2canvas-pro";
import { jsPDF } from "jspdf";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { countryName } from "../../lib/countries";
import { formatMobileNumber } from "../../lib/mobile-numbers";
import type { Address } from "@atomprive/api-client/backoffice";
import {
  activeForLabels,
  activityLabels,
  addressGiven,
  capitalSourceLabels,
  classificationLabels,
  companyActiveForLabels,
  companyAddressGiven,
  companyManagedByLabels,
  companyProductLabels,
  companyWealthSourceLabels,
  controllerTypeGroups,
  legalFormLabels,
  namedControllers,
  noTinReasonText,
  type Classification,
  type ControllerType,
  type NoTinReason,
  type TaxLine,
  decisionLabels,
  employmentStatusLabels,
  genderLabels,
  incomeLabels,
  incomeSourceLabels,
  knowledgeLabels,
  managedByLabels,
  maritalStatusLabels,
  netWealthLabels,
  productLabels,
  serviceLabels,
  turnoverLabels,
  wealthSourceLabels,
  type FormApplication,
  type FormHolder,
} from "./application";
import "./onboarding-print.css";
import {
  CLIENT_DECLARATION,
  CLIENT_DETAILS_NOTE,
  DOCUMENT_TITLE,
  DATA_PROTECTION_STATEMENT,
  ENTITY_DECLARATION,
  ENTITY_DOCUMENT_TITLE,
  ENTITY_RISK_DECLARATION,
  OWNER_DECLARATION,
  OWNER_DETAILS_NOTE,
  PEP_NOTE,
  RISK_DECLARATION,
  RISK_INTRODUCTION,
  SELF_CERT_DECLARATION,
  SELF_CERT_INTRODUCTION,
  SELF_CERT_NOTE,
  SELF_CERT_TITLE,
  SELF_CERT_WARNING,
  SELF_CERT_WHO,
} from "./print-wording";
import {
  DEFINITIONS_INTRODUCTION,
  ENTITY_CERT_DEFINITIONS,
  ENTITY_CERT_GUIDE,
  INDIVIDUAL_CERT_DEFINITIONS,
  INDIVIDUAL_CERT_GUIDE,
  type GlossTerm,
  type GuidePage,
} from "./self-certification-wording";
import {
  abilityIntro,
  abilityQuestions,
  abilityRanges,
  BAND_ORDER,
  bandNames,
  custodianNote,
  educationLabels,
  entityAbilityQuestions,
  entityLeverageNotice,
  exclusionsWording,
  knowledgeDefinitions,
  LEVELS,
  levelLabels,
  leverageNotice,
  leveragePurposeLabels,
  leverageQuestion,
  productGroups,
  profileDefinitions,
  profileFrom,
  profileNames,
  PROFILE_ORDER,
  riskProfileGiven,
  riskScores,
  toleranceIntro,
  toleranceQuestions,
  toleranceRanges,
  totalLine,
  type FormRiskProfile,
  type RiskQuestion,
} from "./risk-profiling";

/** An A4 page less the paper's margins, in the screen's pixels: what each page of the PDF shows. */
const MM = 96 / 25.4;
const PAGE_WIDTH = 182 * MM;
const PAGE_HEIGHT = 267 * MM;
/** Drawn at twice the screen's size, which reads as sharply as print. */
const SCALE = 2;
/** Pages drawn at a time: fewer drawings is faster, and eight at twice the size stay well inside what a browser can draw. */
const PAGES_AT_A_TIME = Math.floor(16_384 / (PAGE_HEIGHT * SCALE));

/**
 * "Download document" (24 Nov 2026, the user's choice over printing): the firm's Client Details & Risk Profiling
 * Questionnaire as a PDF file, made in the browser. Every client's Client Details, each followed by the data
 * protection statement, the declaration and signature boxes; then every risk questionnaire, each followed by its own
 * declaration (VI) and the leverage notice (VII), signed. The chosen answers are ticked and written on the paper's
 * lines. Laid out off screen, cut into A4 pages where the paper would turn over, and saved as pictures of those pages.
 */
export function OnboardingPdf({ application, fileName, onDone, selfCertificationOnly = false }: {
  application: FormApplication; fileName: string; onDone: (failed: boolean) => void;
  /** Only the self-certification, as the prospect's Agreement tab downloads it (25 Nov 2026, local only). */
  selfCertificationOnly?: boolean;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const flow = useRef<HTMLDivElement>(null);
  // A joint holder whose details were skipped has only a name, so there is nothing of theirs to print.
  const entity = application.clientType === "ENTITY";
  // The moment Download was pressed, on the Date line under each printed name (25 Nov 2026).
  const [signedAt] = useState(() => paperDateTime(new Date()));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await document.fonts.ready;
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        if (cancelled || !frame.current || !flow.current) return;
        const pages = paginate(flow.current);
        const pdf = new jsPDF({ unit: "mm", format: "a4" });
        const sheet = document.createElement("canvas");
        sheet.width = Math.round(PAGE_WIDTH * SCALE);
        sheet.height = Math.round(PAGE_HEIGHT * SCALE);
        const pen = sheet.getContext("2d");
        if (!pen) throw new Error("No canvas");
        const outer = frame.current;
        for (let first = 0; first < pages; first += PAGES_AT_A_TIME) {
          const count = Math.min(PAGES_AT_A_TIME, pages - first);
          // Painted from the form's own layout, a stretch of pages at a time, so every cut lands where it was laid out.
          const drawn = await html2canvas(flow.current, {
            scale: SCALE, backgroundColor: "#ffffff", logging: false,
            // Measured from the form's own top-left corner.
            x: 0, y: first * PAGE_HEIGHT, width: PAGE_WIDTH, height: count * PAGE_HEIGHT,
            // Only the form and the page's styles are copied to be painted, not the rest of the back office.
            ignoreElements: (element) => element.closest("head") === null && element.tagName !== "STYLE" && element.tagName !== "LINK"
              && !(outer.contains(element) || element.contains(outer)),
          });
          if (cancelled) return;
          // Cut by the drawing's own size, so the pages land where they are even if it came out smaller.
          const across = drawn.width;
          const down = drawn.height / count;
          for (let at = 0; at < count; at++) {
            pen.fillStyle = "#ffffff";
            pen.fillRect(0, 0, sheet.width, sheet.height);
            pen.drawImage(drawn, 0, at * down, across, down, 0, 0, sheet.width, sheet.height);
            const page = first + at;
            if (page > 0) pdf.addPage();
            // White paper under the form, whatever the reader shows a page's background as.
            pdf.setFillColor(255, 255, 255);
            pdf.rect(0, 0, 210, 297, "F");
            pdf.addImage(sheet.toDataURL("image/jpeg", 0.88), "JPEG", 14, 14, 182, 267, undefined, "FAST");
            pdf.setFontSize(8);
            pdf.setTextColor(138, 148, 166);
            pdf.text(selfCertificationOnly ? SELF_CERT_TITLE[entity ? "entity" : "individual"]
              : entity ? ENTITY_DOCUMENT_TITLE : DOCUMENT_TITLE, 14, 288);
            pdf.text(`Page ${page + 1} of ${pages}`, 196, 288, { align: "right" });
          }
        }
        pdf.save(fileName);
        onDone(false);
      } catch {
        if (!cancelled) onDone(true);
      }
    })();
    return () => {
      cancelled = true;
    };
    // Made once, from the form as it stood when Download was pressed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return createPortal(
    <div ref={frame} className="op-capture" aria-hidden="true">
      <div ref={flow} className="op-doc">
        {selfCertificationOnly ? (
          <SignedAt.Provider value={signedAt}><SelfCertificationPages application={application} /></SignedAt.Provider>
        ) : (
          <PaperDocument application={application} signedAt={signedAt} />
        )}
      </div>
    </div>,
    document.body,
  );
}

/**
 * The paper itself, every page of it, as the PDF draws it: a client's Client Details and questionnaires and each
 * holder's self-certification; or an entity's Schedule 2(A), each beneficial owner's 2(B), its questionnaire and its
 * self-certification with an Annex for each controlling person (25 Nov 2026).
 */
export function PaperDocument({ application, signedAt = "" }: { application: FormApplication; signedAt?: string }) {
  // A joint holder whose details were skipped has only a name, so there is nothing of theirs to print.
  const clients = application.holders.flatMap((holder, index) => (index === 0 || !holder.details.skipped ? [{ holder, index }] : []));
  const questionnaires = application.riskProfiles.filter(riskProfileGiven);
  const entity = application.clientType === "ENTITY";
  const owners = application.beneficialOwners.filter((owner) => owner.fullName?.trim());
  return (
    <SignedAt.Provider value={signedAt}>
      {entity ? (
        <>
          <EntityDetails application={application} />
          {owners.map((owner, n) => <ClientDetails key={n} holder={owner} index={n} first={false} owner />)}
          <Questionnaire profile={{ ...(application.riskProfiles[0] ?? questionnaires[0]!), filledInFor: application.entity.legalName }} number={null}
            owners={owners.map((owner) => owner.fullName?.trim() ?? "")} />
          <EntityCertification application={application} />
          <CertGuide pages={ENTITY_CERT_GUIDE} definitions={ENTITY_CERT_DEFINITIONS} />
        </>
      ) : (
        <>
          {clients.map(({ holder, index }, n) => <ClientDetails key={index} holder={holder} index={index} first={n === 0} />)}
          {questionnaires.map((profile, n) => <Questionnaire key={n} profile={profile} number={questionnaires.length > 1 ? n + 1 : null} />)}
          {/* Each holder's self-certification after the questionnaires, as the form asks it (25 Nov 2026). */}
          {clients.map(({ holder, index }) => <HolderCertification key={`cert-${index}`} holder={holder} />)}
          {/* The paper's instructions and definitions once, after the last holder's form. */}
          <CertGuide pages={INDIVIDUAL_CERT_GUIDE} definitions={INDIVIDUAL_CERT_DEFINITIONS} />
        </>
      )}
    </SignedAt.Provider>
  );
}

/**
 * When the paper was downloaded, written on the Date line under each printed name (25 Nov 2026, the user's choice); a
 * box with no name in it keeps its Date line empty, to be written by whoever signs there.
 */
const SignedAt = createContext("");

/** What is never cut across two pages: a row, a question with its answers, a statement, the signature boxes. */
const UNBROKEN = [
  ".op-hero", ".op-sec", ".op-stmt", ".op-t", ".op-sigs", ".op-bands", ".op-total", ".op-defs", ".op-agree", ".op-keep",
  ".op-note", ".op-reasons", ".op-warn", ".op-guide-title",
  "section > .op-opts", "section > .op-other", "table > thead > tr", "table > tbody > tr",
].join(", ");

/** What goes over to the next page with whatever follows it: a heading never ends a page. */
const WITH_NEXT = ".op-sec, .op-stmt, .op-guide-title, thead > tr, tr:has(> th.op-bar)";

/**
 * Turns the form over where the paper would: every client and every questionnaire on a new page, as the paper's
 * sections are, and nothing in {@link UNBROKEN} cut in two. Space is put in front of whatever would be cut, and a table
 * running onto the next page has its heading again, as the paper's do. Answers how many pages there are.
 */
function paginate(flow: HTMLElement): number {
  const top = () => flow.getBoundingClientRect().top;
  const position = (element: Element) => {
    const box = element.getBoundingClientRect();
    return { top: box.top - top(), bottom: box.bottom - top() };
  };
  const atoms: Element[] = [];
  for (const element of flow.querySelectorAll(UNBROKEN)) {
    const last = atoms.at(-1);
    if (!last?.contains(element)) atoms.push(element);
  }
  const startsNewPage = (element: Element) => element.matches(".op-break")
    || (element.parentElement?.matches("section.op-break") === true && element.parentElement.firstElementChild === element);

  atoms.forEach((element, at) => {
    const box = position(element);
    let from = box.top;
    const to = box.bottom;
    const page = Math.floor(from / PAGE_HEIGHT);
    const pageEnd = (page + 1) * PAGE_HEIGHT;
    const forced = startsNewPage(element) && from > page * PAGE_HEIGHT + 1;
    const cut = to > pageEnd + 0.5 && to - from <= PAGE_HEIGHT;
    if (!forced && !cut) return;
    // A heading just before what moves goes with it.
    let moving = element;
    const before = atoms[at - 1];
    if (!forced && before?.matches(WITH_NEXT)) {
      const previous = position(before);
      if (Math.floor(previous.top / PAGE_HEIGHT) === page) {
        moving = before;
        from = previous.top;
      }
    }
    // Margins around the room put in shift what moves by a few pixels, so it is set again to land exactly on the new
    // page, a pixel in, where nothing of it shows at the foot of the page before.
    const pushed = pushDown(moving, pageEnd - from);
    if (pushed) {
      const landed = position(pushed.first).top;
      pushed.room.style.height = `${Math.max(0, parseFloat(pushed.room.style.height) + pageEnd + 1 - landed)}px`;
    }
  });
  return Math.max(1, Math.ceil(flow.scrollHeight / PAGE_HEIGHT));
}

/**
 * Room in front of an element, a row of a table's own when it is one, with the table's heading again after it.
 * Answers what holds the room's height, to set it again once it is in place, and what now comes first on the page.
 */
function pushDown(element: Element, height: number): { room: HTMLElement; first: Element } | null {
  if (height <= 0) return null;
  const inTable = element.tagName === "TR" || element.tagName === "TBODY";
  if (!inTable) {
    const space = document.createElement("div");
    space.style.height = `${height}px`;
    element.before(space);
    return { room: space, first: element };
  }
  const row = document.createElement("tr");
  const cell = document.createElement("td");
  cell.colSpan = 99;
  cell.style.cssText = `height:${height}px;padding:0;border:0;background:#fff`;
  row.append(cell);
  const heading = element.parentElement?.tagName === "THEAD" ? null : element.closest("table")?.querySelector(":scope > thead > tr");
  const again = heading ? (heading.cloneNode(true) as Element) : null;
  if (element.tagName === "TBODY") {
    const body = document.createElement("tbody");
    body.append(row);
    if (again) body.append(again);
    element.before(body);
  } else {
    element.before(row);
    if (again) element.before(again);
  }
  return { room: cell, first: again ?? element };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** The moment of downloading as the paper's Date line takes it: DD-MMM-YYYY, then the time, 25-Nov-2026, 10:42 AM. */
function paperDateTime(at: Date) {
  const hour = at.getHours() % 12 || 12;
  const minutes = String(at.getMinutes()).padStart(2, "0");
  return `${String(at.getDate()).padStart(2, "0")}-${MONTHS[at.getMonth()]}-${at.getFullYear()}, ${hour}:${minutes} ${at.getHours() < 12 ? "AM" : "PM"}`;
}

/** As the paper asks for it: DD-MMM-YYYY. */
function paperDate(iso: string | null | undefined) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? "");
  return match ? `${match[3]}-${MONTHS[Number(match[2]) - 1]}-${match[1]}` : "";
}
const country = (code: string | null | undefined) => (code ? countryName(code) : "");
const phone = (value: string | null | undefined) => (value ? formatMobileNumber(value) : "");

/** A written line, empty or with the answer on it. */
function V({ children }: { children?: ReactNode }) {
  return <span className="op-v">{children || " "}</span>;
}
const Cb = ({ on }: { on: boolean }) => <span className={on ? "op-cb op-on" : "op-cb"} />;
const Box = ({ label, on }: { label: string; on: boolean }) => <span className="op-box"><Cb on={on} />{label}</span>;
const Row = ({ label, right, children }: { label: ReactNode; right?: boolean; children: ReactNode }) => (
  <tr><td className={right ? "op-l op-r" : "op-l"}>{label}</td><td>{children}</td></tr>
);
const WithHint = ({ value, hint }: { value: string | null | undefined; hint: string }) => (
  <div className="op-fl"><V>{value}</V><span className="op-hint">{hint}</span></div>
);
const Labelled = ({ label, value }: { label: string; value: string | null | undefined }) => (
  <div className="op-fl"><span className="op-hint">{label}</span><V>{value}</V></div>
);
function Lines({ values, count }: { values: (string | null | undefined)[]; count: number }) {
  return <div className="op-two">{Array.from({ length: count }, (_, at) => <V key={at}>{values[at]}</V>)}</div>;
}
function Bar({ title, color }: { title: string; color: string }) {
  // In the table's head, so a section running onto the next page carries its heading again, as the paper's does.
  return <thead><tr><th className="op-bar" colSpan={2} style={{ background: color }}>{title}</th></tr></thead>;
}
function Options<T extends string>({ labels, chosen, other, otherHint = "(please specify)" }: {
  labels: Record<T, string>;
  chosen: T | T[] | null;
  other?: string | null;
  otherHint?: string;
}) {
  const isChosen = (value: T) => (Array.isArray(chosen) ? chosen.includes(value) : chosen === value);
  return (
    <>
      <div className="op-opts">{(Object.keys(labels) as T[]).map((value) => <Box key={value} label={labels[value]} on={isChosen(value)} />)}</div>
      {other !== undefined && <div className="op-other"><span>Other:</span><V>{other}</V><span className="op-hint">{otherHint}</span></div>}
    </>
  );
}
function Signatures({ name, company }: { name: string; company?: string }) {
  const signedAt = useContext(SignedAt);
  return (
    <div className="op-sigs">
      {[name, ""].map((who, at) => (
        <div key={at} className="op-sig">
          <div><span>Name</span><V>{who}</V></div>
          <div><span>Date</span><V>{who ? signedAt : ""}</V></div>
          <div className="op-gap" />
          <div><span>Signature</span><V /></div>
          {company !== undefined && <div><span>Name of the Company</span><V>{company}</V></div>}
          <div><span>Place</span><V /></div>
        </div>
      ))}
    </div>
  );
}

/**
 * Schedule 2 for one client, then the data protection statement and the declaration they sign. An entity's beneficial
 * owner is asked the same page as Schedule 2(B), with its own heading and declaration (25 Nov 2026).
 */
function ClientDetails({ holder, index, first, owner }: { holder: FormHolder; index: number; first: boolean; owner?: boolean }) {
  const { details } = holder;
  const profile = details.profile;
  const mailing = addressGiven(holder.mailingAddress) ? holder.mailingAddress : null;
  const working = details.employmentStatus === "EMPLOYED" || details.employmentStatus === "SELF_EMPLOYED";
  const name = holder.fullName?.trim() ?? "";
  return (
    <section className={first ? undefined : "op-break"}>
      <div className="op-hero">
        <div className="op-kicker">{owner ? "SCHEDULE 2(B)" : "SCHEDULE 2"}</div>
        <h1>Client Details <span className="op-pill">{owner ? `Beneficial Owner ${index + 1}` : `Client ${index + 1}`}</span></h1>
        <p>{owner ? OWNER_DETAILS_NOTE : CLIENT_DETAILS_NOTE}</p>
      </div>
      <table className="op-form">
        <Bar title={owner ? "Beneficial Owner" : "Individual Client"} color="var(--op-navy)" />
        <tbody>
          <Row label="Full name"><WithHint value={name} hint="(as on passport)" /></Row>
          <Row label="Previous name(s)"><V>{details.previousNames}</V></Row>
          <Row label="Other name(s)"><WithHint value={details.otherNames} hint="(including any alias)" /></Row>
          <Row label="Gender"><Options labels={genderLabels} chosen={details.gender} /></Row>
          <Row label="Date of Birth"><WithHint value={paperDate(holder.dateOfBirth)} hint="(DD-MMM-YYYY)" /></Row>
          <Row label="Place of Birth"><div className="op-two"><V>{details.placeOfBirth}</V><Labelled label="Country:" value={country(holder.countryOfBirth)} /></div></Row>
          <Row label="Marital status"><Options labels={maritalStatusLabels} chosen={details.maritalStatus} /></Row>
          <Row label="Spouse name"><V>{details.maritalStatus === "MARRIED" ? details.spouseName : ""}</V></Row>
          <Row label="Nationality (Nationalities)"><Lines values={[holder.nationality, ...details.otherNationalities].map(country)} count={4} /></Row>
          <Row label="Country of Citizenship/Residency"><Lines values={details.citizenship.map(country)} count={4} /></Row>
          <Row label="Country of legal domicile"><WithHint value={country(details.legalDomicile)} hint="Only if different from above" /></Row>
          <Row label="Country of fiscal residence"><WithHint value={country(details.fiscalResidence)} hint="Only if different from above" /></Row>
          <Row label="Permanent address"><V>{holder.residentialAddress.line1}</V></Row>
          <Row label="Postal Code/ P.O Box" right>
            <div className="op-two">
              <V>{holder.residentialAddress.postalCode}</V>
              <div><Labelled label="Country:" value={country(holder.residentialAddress.country)} /><div style={{ marginTop: 4 }}><Labelled label="Emirate (if applicable):" value={details.emirate} /></div></div>
            </div>
          </Row>
          <Row label="Mailing address (if different to the address stated above)"><V>{mailing?.line1}</V></Row>
          <Row label="Postal Code/ P.O Box" right>
            <div className="op-two">
              <V>{mailing?.postalCode}</V>
              <div><Labelled label="Country:" value={country(mailing?.country)} /><div style={{ marginTop: 4 }}><Labelled label="Emirate (if applicable):" value={mailing ? details.mailingEmirate : ""} /></div></div>
            </div>
          </Row>
          <Row label={<><b>Contact details</b>&nbsp; Telephone</>} right><Lines values={[phone(holder.phone), phone(details.secondPhone)]} count={2} /></Row>
          <Row label="Fax" right><Lines values={[details.fax, details.secondFax]} count={2} /></Row>
          <Row label="Email" right><Lines values={[holder.email, details.secondEmail]} count={2} /></Row>
          <Row label={<><b>Professional details</b>&nbsp; Status</>} right><Options labels={employmentStatusLabels} chosen={details.employmentStatus} /></Row>
          <Row label="Job title / Function" right><V>{working ? holder.employer.position : ""}</V></Row>
          <Row label="Sector / Industry" right><V>{working ? details.sector : ""}</V></Row>
          <Row label="Name of employer" right><V>{working ? holder.employer.companyName : ""}</V></Row>
          <Row label="Country of business" right><V>{working ? country(holder.employer.country) : ""}</V></Row>
        </tbody>
      </table>

      <table className="op-form">
        <Bar title={owner ? "Beneficial Owner" : "Individual Client"} color="var(--op-navy)" />
        <tbody>
          <Row label={<>Are you /is a member of your family / a close associate a Politically Exposed Person?<p className="op-hint" style={{ margin: "6px 0 0" }}>{PEP_NOTE}</p></>}>
            <Box label="Yes" on={profile.pep === true} /><Box label="No" on={profile.pep === false} />
            <p className="op-hint" style={{ margin: "8px 0 4px" }}>If yes, please specify:</p>
            {[0, 1].map((at) => {
              const person = profile.pep ? profile.pepPeople[at] : undefined;
              return <div key={at} className="op-two" style={{ marginTop: 4 }}><Labelled label="Name" value={person?.name} /><Labelled label="Function" value={person?.function} /></div>;
            })}
          </Row>
        </tbody>
      </table>

      <table className="op-form">
        <Bar title="About your Business Intentions with us" color="#1f6f6f" />
        <tbody>
          <Row label="What are the services or products you are interested in?"><Options labels={serviceLabels} chosen={profile.services} other={profile.servicesOther} /></Row>
          <Row label="What is the expected annual in/out flow turnover of assets"><Options labels={turnoverLabels} chosen={profile.turnover} /></Row>
        </tbody>
      </table>

      <table className="op-form">
        <Bar title="About your Wealth and Income" color="var(--op-indigo)" />
        <tbody>
          <Row label="What is your estimated global net wealth?"><Options labels={netWealthLabels} chosen={profile.netWealth} other={profile.netWealthOther} otherHint="(please specify in USD)" /></Row>
          <Row label="How have you built up your global net wealth?"><Options labels={wealthSourceLabels} chosen={profile.wealthSources} other={profile.wealthSourcesOther} /></Row>
          <Row label="In which countries do you have or built up your wealth"><Lines values={profile.wealthCountries.map(country)} count={4} /></Row>
          <Row label="How much is your annual regular income?"><Options labels={incomeLabels} chosen={profile.income} /></Row>
          <Row label="How do you earn your regular income?"><Options labels={incomeSourceLabels} chosen={profile.incomeSources} other={profile.incomeSourcesOther} /></Row>
          <Row label="In which countries do you earn your regular income?"><Lines values={profile.incomeCountries.map(country)} count={4} /></Row>
        </tbody>
      </table>

      <table className="op-form">
        <Bar title="Your Experience and Understanding of Financial Markets and Instruments" color="var(--op-brown)" />
        <tbody>
          <Row label="How is your knowledge and understanding of financial markets and products?"><Options labels={knowledgeLabels} chosen={profile.knowledge} other={profile.knowledgeOther} /></Row>
          <Row label="For how long have you been active on the financial markets / investing in financial products?"><Options labels={activeForLabels} chosen={profile.activeFor} other={profile.activeForOther} /></Row>
          <Row label="How have your assets been managed before?"><Options labels={managedByLabels} chosen={profile.managedBy} other={profile.managedByOther} /></Row>
          <Row label="In which financial products have you already invested on a regular basis?"><Options labels={productLabels} chosen={profile.products} other={profile.productsOther} /></Row>
          <Row label="How often do you take investments decisions (buy/sell)?"><Options labels={decisionLabels} chosen={profile.decisions} other={profile.decisionsOther} /></Row>
        </tbody>
      </table>

      <h3 className="op-stmt">Data protection statement</h3>
      <p className="op-t">{DATA_PROTECTION_STATEMENT}</p>
      <h3 className="op-stmt">Declaration</h3>
      {(owner ? OWNER_DECLARATION : CLIENT_DECLARATION).map((paragraph) => <p key={paragraph} className="op-t">{paragraph}</p>)}
      <Signatures name={name} />
    </section>
  );
}

/** One question and its answers with the paper's scores, the chosen one ticked. */
function ScoredTable({ questions, answers }: { questions: RiskQuestion[]; answers: Record<string, string> }) {
  return (
    <table className="op-q">
      {questions.map((question) => (
        <tbody key={question.id} className="op-keep">
          {question.options.map((option, at) => {
            const chosen = answers[question.id] === option.value;
            return (
              <tr key={option.value} className={chosen ? "op-hit" : undefined}>
                {at === 0 && <td className="op-qn" rowSpan={question.options.length}><b>{question.title}</b>{question.ask}</td>}
                <td><Cb on={chosen} /> {option.text}</td>
                <td className="op-sc">{option.score}</td>
              </tr>
            );
          })}
        </tbody>
      ))}
    </table>
  );
}

/**
 * Schedule 6 for whoever it was filled in for, then their declaration (VI) and the leverage notice (VII). An entity's
 * own questionnaire (25 Nov 2026) asks Part A of each beneficial owner, its third question about future growth, the
 * exclusions on page 14, and its own declaration (v.).
 */
function Questionnaire({ profile, number, owners }: { profile: FormRiskProfile; number: number | null; owners?: string[] }) {
  const entity = owners !== undefined;
  const scores = riskScores(profile);
  const worked = scores.profile;
  const assigned = profile.agrees === false ? profile.preferredProfile : worked;
  const name = profile.filledInFor?.trim() ?? "";
  const matrixAbility = ["Low (10 - 14)", "Moderate (15 - 24)", "Medium (25 - 34)", "Enhanced (35 - 44)", "High (45 - 50)"];
  const matrixTolerance = ["Low (5 - 7)", "Moderate (8 - 12)", "Medium (13 - 17)", "Enhanced (18 - 22)", "High (23 - 25)"];
  return (
    <section className="op-break">
      <div className="op-hero">
        <div className="op-kicker">{entity ? "RISK PROFILING" : "SCHEDULE 6"}</div>
        <h1>Risk Profiling Questionnaire/ Suitability Assessment {entity ? <span className="op-pill">Entity</span> : number !== null && <span className="op-pill">{number}</span>}</h1>
        <p>Filled in for <b>{name}</b></p>
      </div>
      {!entity && <div className="op-sec" style={{ background: "var(--op-navy)" }}>Knowledge and Experience</div>}
      {!entity && RISK_INTRODUCTION.map((paragraph) => <p key={paragraph} className="op-t">{paragraph}</p>)}

      <div className="op-sec" style={{ background: "var(--op-teal)" }}>{entity ? "i." : "I."} &nbsp;Knowledge and Experience</div>
      {entity ? (
        <table className="op-form">
          <tbody>
            <tr><th className="op-bar" style={{ background: "var(--op-teal)" }}>Part A (to be filled by the Beneficial Owner(s) of the Client) — 1. What is the highest level of education of the Beneficial Owner(s) of the Client? Please pick one that applies:</th></tr>
            {["I", "II", "III"].map((numeral, at) => (
              <tr key={numeral}><td>
                <b>{String.fromCharCode(97 + at)}) Beneficial Owner {numeral}{at > 0 && " (if any)"}</b>{owners[at] && <span className="op-hint"> · {owners[at]}</span>}
                <div style={{ marginTop: 4 }}><Options labels={educationLabels} chosen={owners[at] ? profile.owners[at]?.education ?? null : null} /></div>
              </td></tr>
            ))}
            <tr><th className="op-bar" style={{ background: "var(--op-teal)" }}>2. Please provide details if the Beneficial Owner(s) hold a qualification related to financial markets:</th></tr>
            {["I", "II", "III"].map((numeral, at) => (
              <tr key={numeral}><td><Labelled label={`${String.fromCharCode(97 + at)}) Beneficial Owner ${numeral} (if any)`} value={owners[at] ? profile.owners[at]?.qualification : ""} /></td></tr>
            ))}
            <tr><th className="op-bar" style={{ background: "var(--op-teal)" }}>Part B (to be filled on behalf of the Client/ entity)</th></tr>
          </tbody>
        </table>
      ) : (
        <table className="op-form">
          <tbody>
            <tr><th className="op-bar" style={{ background: "var(--op-teal)" }}>What is your highest level of education? Please pick one that applies:</th></tr>
            <tr><td><Options labels={educationLabels} chosen={profile.education} /></td></tr>
            <tr><th className="op-bar" style={{ background: "var(--op-teal)" }}>Please provide details if you hold a qualification related to financial markets:</th></tr>
            <tr><td><V>{profile.qualification}</V></td></tr>
          </tbody>
        </table>
      )}
      <div className="op-defs">
        <div><b>Knowledge</b>{knowledgeDefinitions.knowledge}</div>
        <div><b>Experience</b>{knowledgeDefinitions.experience}</div>
      </div>
      <table className="op-grid">
        <thead><tr><th colSpan={2} style={{ textAlign: "left" }}>Product Classes</th>{LEVELS.map((level) => <th key={level}>{levelLabels[level]}</th>)}</tr></thead>
        {productGroups.map((group) => (
          <tbody key={group.group} className="op-keep">
            {group.classes.map((one, at) => {
              const [main, note] = one.name.split(/ (?=\()/, 2);
              return (
                <tr key={one.key}>
                  {at === 0 && (
                    <td className="op-grp" rowSpan={one.name ? group.classes.length : 1} colSpan={one.name ? 1 : 2}>{group.group}</td>
                  )}
                  {one.name && <td><b>{main}</b> {note && <span className="op-hint">{note}</span>}</td>}
                  {LEVELS.map((level) => <td key={level} className="op-c"><Cb on={profile.knowledge[one.key] === level} /></td>)}
                </tr>
              );
            })}
          </tbody>
        ))}
      </table>

      <div className="op-sec op-break" style={{ background: "var(--op-teal)" }}>{entity ? "General Risk Profile" : "II. General Risk Profile"}</div>
      <p className="op-t">{abilityIntro}</p>
      <ScoredTable questions={entity ? entityAbilityQuestions : abilityQuestions} answers={profile.answers} />
      <div className="op-total"><span>{totalLine}</span><span>{scores.ability}</span></div>
      <div className="op-bands">
        {BAND_ORDER.map((band) => <div key={band} className={band === scores.abilityBand ? "op-hit" : undefined}>Score of {abilityRanges[band]}<br />{bandNames[band]}</div>)}
      </div>
      <p className="op-t op-break">{toleranceIntro}</p>
      <ScoredTable questions={toleranceQuestions} answers={profile.answers} />
      <div className="op-total"><span>Add up the values of all responses to calculate your total scores:</span><span>{scores.tolerance}</span></div>
      <div className="op-bands">
        {BAND_ORDER.map((band) => <div key={band} className={band === scores.toleranceBand ? "op-hit" : undefined}>Score of {toleranceRanges[band]}<br />{bandNames[band]}</div>)}
      </div>

      <div className="op-keep">
        <div className="op-sec" style={{ background: "var(--op-teal)" }}>Risk Profile Definitions</div>
        <p className="op-t">Please use the following matrix to map Risk Ability against Risk Tolerance, to obtain the client’s risk profile.</p>
        <table className="op-matrix">
          <thead><tr><th>Ability → / Tolerance ↓</th>{matrixAbility.map((label) => <th key={label}>{label}</th>)}</tr></thead>
          <tbody>
            {BAND_ORDER.map((tolerance, row) => (
              <tr key={tolerance}>
                <th>{matrixTolerance[row]}</th>
                {BAND_ORDER.map((ability) => (
                  <td key={ability} className={ability === scores.abilityBand && tolerance === scores.toleranceBand ? "op-hit" : undefined}>
                    {profileNames[profileFrom(ability, tolerance)].toUpperCase()}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <table className="op-profiles">
        <thead><tr><th>Risk Profile</th>{PROFILE_ORDER.map((one) => <th key={one}>{profileNames[one]}</th>)}</tr></thead>
        <tbody>
          {profileDefinitions.map((definition) => (
            <tr key={definition.row}>
              <td className="op-h">{definition.row}</td>
              {PROFILE_ORDER.map((one) => <td key={one} className={one === worked ? "op-pick" : undefined}>{definition.text[one]}</td>)}
            </tr>
          ))}
        </tbody>
      </table>

      {entity && (
        <>
          <div className="op-sec op-break" style={{ background: "var(--op-teal)" }}>Excluded Jurisdictions</div>
          <p className="op-t">{exclusionsWording.countriesAsk}</p>
          <Row2 label={exclusionsWording.countriesLabel} value={profile.excludedCountries} />
          <div className="op-sec" style={{ background: "var(--op-teal)" }}>Excluded Sectors/ Industries</div>
          <p className="op-t">{exclusionsWording.sectorsAsk}</p>
          <Row2 label={exclusionsWording.sectorsLabel} value={profile.excludedSectors} />
          <div className="op-sec" style={{ background: "var(--op-teal)" }}>{exclusionsWording.circumstancesHeading}</div>
          <p className="op-t">{exclusionsWording.circumstancesLabel}</p>
          <Row2 label="" value={profile.circumstances} />
        </>
      )}
      <div className={entity ? "op-sec" : "op-sec op-break"} style={{ background: "var(--op-indigo)" }}>{entity ? "v." : "VI."} &nbsp;Client Declaration On Understanding And Accepting The Risk Profile</div>
      <div className="op-agree">
        <div><Box label="Yes" on={profile.agrees === true} /></div>
        <div>
          <Box label="No. Please specify your preferred Risk Profile" on={profile.agrees === false} />
          <div style={{ marginTop: 6 }}><V>{profile.agrees === false && profile.preferredProfile ? profileNames[profile.preferredProfile] : ""}</V></div>
        </div>
      </div>
      <p className="op-t">{(entity ? ENTITY_RISK_DECLARATION : RISK_DECLARATION).confirm}</p>
      <p className="op-t">
        {(entity ? ENTITY_RISK_DECLARATION : RISK_DECLARATION).assignedBefore} <span className="op-ins">{assigned ? profileNames[assigned] : " "}</span>{" "}
        <span className="op-hint">(insert risk profile)</span> {(entity ? ENTITY_RISK_DECLARATION : RISK_DECLARATION).assignedAfter}
      </p>
      {(entity ? ENTITY_RISK_DECLARATION : RISK_DECLARATION).rest.map((paragraph) => <p key={paragraph} className="op-t">{paragraph}</p>)}
      <Signatures name={entity ? "" : name} />

      <div className="op-sec op-break" style={{ background: "var(--op-navy)" }}>RISK VARIATION — {entity ? "" : "VII. "}Important Notice For Clients Who Intend to Leverage Against Their Portfolio:</div>
      {(entity ? entityLeverageNotice : leverageNotice).map((paragraph) => <p key={paragraph} className="op-t">{paragraph}</p>)}
      <p className="op-t">{leverageQuestion}</p>
      <Options labels={leveragePurposeLabels} chosen={profile.leveragePurposes} />
      <div className="op-other"><span>Other needs, please specify</span><V>{profile.leverageOther}</V></div>
      <p className="op-t" style={{ marginTop: 8 }}>{custodianNote}</p>
      <Signatures name={entity ? "" : name} />
    </section>
  );
}

/** A written answer on its own, in a box the width of the page. */
function Row2({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <table className="op-form">
      <tbody><tr>{label && <td className="op-l">{label}</td>}<td><span className="op-v" style={{ whiteSpace: "pre-line", minHeight: 30 }}>{value || " "}</span></td></tr></tbody>
    </table>
  );
}


/** "Building name" and the address's own lines, as Schedule 2(A) has them, with the postal code, country and emirate. */
function CompanyAddressRows({ label, value, emirate, hint }: { label: string; value: Address | null; emirate: string | null; hint?: string }) {
  return (
    <>
      <Row label={label}>
        <div className="op-fl"><span className="op-hint">Building name</span><V>{value?.line1}</V>{hint && <span className="op-hint">{hint}</span>}</div>
        <div style={{ marginTop: 4 }}><V>{value?.line2}</V></div>
      </Row>
      <Row label="Postal Code" right>
        <div className="op-two">
          <V>{value?.postalCode}</V>
          <div><Labelled label="Country:" value={country(value?.country)} /><div style={{ marginTop: 4 }}><Labelled label="Emirate:" value={value ? emirate : ""} /></div></div>
        </div>
      </Row>
    </>
  );
}

/** A numbered list the paper prints a set number of lines for, such as its directors. */
function Numbered({ heading, color, columns, rows }: { heading: string; color: string; columns: string[]; rows: string[][] }) {
  return (
    <table className="op-grid">
      <thead>
        <tr><th colSpan={columns.length + 1} style={{ background: color, textAlign: "left" }}>{heading}</th></tr>
        <tr><th style={{ background: color }}>No</th>{columns.map((one) => <th key={one} style={{ background: color, textAlign: "left" }}>{one}</th>)}</tr>
      </thead>
      <tbody>
        {rows.map((row, at) => (
          <tr key={at}><td className="op-c"><b>{at + 1}</b></td>{row.map((cell, i) => <td key={i} style={{ whiteSpace: "pre-line", height: 22 }}>{cell}</td>)}</tr>
        ))}
      </tbody>
    </table>
  );
}

/** Schedule 2(A), the entity's Client Details (25 Nov 2026), then its data protection statement and declaration. */
function EntityDetails({ application }: { application: FormApplication }) {
  const { entity } = application;
  const company = entity.company;
  const name = entity.legalName?.trim() ?? "";
  const trading = companyAddressGiven(company.tradingAddress) ? company.tradingAddress : null;
  const mailing = companyAddressGiven(company.mailingAddress) ? company.mailingAddress : null;
  const yes = (value: boolean | null) => <><Box label="Yes" on={value === true} /><Box label="No" on={value === false} /></>;
  return (
    <section>
      <div className="op-hero">
        <div className="op-kicker">SCHEDULE 2(A)</div>
        <h1>Client Details <span className="op-pill">Entity</span></h1>
        <p>Identification details of the Company / Legal Entity / Corporate Structure.</p>
      </div>
      <table className="op-form">
        <Bar title="Identification Details of your Company/Legal Entity/Corporate Structure" color="var(--op-navy)" />
        <tbody>
          <Row label="Registered name"><V>{name}</V></Row>
          <Row label={<>Legal form<p className="op-hint" style={{ margin: "2px 0 0" }}>(Corporate-Private/Corporate-Listed /Trust)</p></>}><Options labels={legalFormLabels} chosen={company.form} /></Row>
          <Row label="Other used trading name(s)"><V>{company.tradingNames}</V></Row>
          <Row label="Date of incorporation"><V>{paperDate(entity.dateOfIncorporation)}</V></Row>
          <Row label="Place/Emirate of incorporation"><V>{company.placeOfIncorporation}</V></Row>
          <Row label="License number of the Company"><V>{entity.registrationNumber}</V></Row>
          <CompanyAddressRows label="Registered address" value={entity.registeredAddress} emirate={company.registeredEmirate} />
          <CompanyAddressRows label="Trading address" value={trading} emirate={company.tradingEmirate} hint="(only if different from above)" />
          <Row label="Other countries of operations / business"><Lines values={entity.countriesOfBusiness.map(country)} count={4} /></Row>
          <CompanyAddressRows label="Mailing address (if different from Registered address)" value={mailing} emirate={company.mailingEmirate} />
          <Row label="Contact Name"><V>{company.contactName}</V></Row>
          <Row label={<><b>Contact details</b>&nbsp; Telephone</>} right><Lines values={[company.phone, company.secondPhone]} count={2} /></Row>
          <Row label="Fax" right><Lines values={[company.fax, company.secondFax]} count={2} /></Row>
          <Row label="Email" right><Lines values={[company.email, company.secondEmail]} count={2} /></Row>
          <Row label="Website" right><V>{company.website}</V></Row>
          <Row label="Country of fiscal residence"><V>{country(entity.taxResidency)}</V></Row>
          <Row label="Business activity(ies)"><Options labels={activityLabels} chosen={company.activities} /><div style={{ marginTop: 4, whiteSpace: "pre-line" }}><V>{company.activitiesDetail}</V></div></Row>
          <Row label="Is the Company part of a Group?">{yes(company.partOfGroup)}</Row>
          <Row label="Group Name" right><V>{company.partOfGroup ? company.groupName : ""}</V></Row>
          <Row label="Country" right><V>{company.partOfGroup ? country(company.groupCountry) : ""}</V></Row>
          <Row label="Is the company supervised by a Financial Services Regulator?">{yes(entity.regulated)}</Row>
          <Row label="If yes, Name of Regulator" right><Labelled label="By:" value={entity.regulated ? entity.regulatorName : ""} /></Row>
          <Row label="Name of External Auditor"><V>{company.externalAuditor}</V></Row>
          <Row label={<>Are any of the directors /signatories /shareholders or a member of their family / a close associate, a Politically Exposed Person?<p className="op-hint" style={{ margin: "6px 0 0" }}>{PEP_NOTE}</p></>}>
            <Box label="No" on={company.pep === false} /><Box label="Yes" on={company.pep === true} />
            <div className="op-two" style={{ marginTop: 6 }}><Labelled label="Name" value={company.pep ? company.pepPerson.name : ""} /><Labelled label="Function" value={company.pep ? company.pepPerson.function : ""} /></div>
          </Row>
        </tbody>
      </table>

      <Numbered heading="List of Directors / Partners of the Company" color="var(--op-teal)" columns={["Name of Director/ Partner", "Position"]}
        rows={company.directors.slice(0, 8).map((one) => [one.name ?? "", one.position ?? ""])} />
      <table className="op-form">
        <Bar title="List of Shareholders of the Company" color="var(--op-indigo)" />
        <tbody>
          <Row label="Is the Company publicly listed?">{yes(company.listed)}</Row>
          <Row label="Exchange, Country" right><V>{company.listed ? company.exchange : ""}</V></Row>
          <Row label="Ticker/Code" right><V>{company.listed ? company.ticker : ""}</V></Row>
        </tbody>
      </table>
      <Numbered heading="Shareholders" color="var(--op-indigo)" columns={["Name of Shareholder(s)", "% Shares", "Name of individual(s) controlling the Shareholder"]}
        rows={company.shareholders.slice(0, 6).map((one) => [one.name ?? "", one.sharePercent === null ? "" : `${one.sharePercent}`, one.controllers ?? ""])} />
      <Numbered heading="Please list the names of the persons who will interact with us" color="var(--op-brown)" columns={["Name of Authorised Signatory", "Position"]}
        rows={company.signatories.slice(0, 8).map((one) => [one.name ?? "", one.position ?? ""])} />

      <table className="op-form">
        <Bar title="About your Business Intentions with us" color="#1f6f6f" />
        <tbody>
          <Row label="What are the services or products you are interested in?"><Options labels={serviceLabels} chosen={company.services} other={company.servicesOther} /></Row>
          <Row label="What is the expected annual in/out flow turnover of assets"><Options labels={turnoverLabels} chosen={company.turnover} /></Row>
        </tbody>
      </table>
      <table className="op-form">
        <Bar title="About the Company's Wealth" color="var(--op-indigo)" />
        <tbody>
          <Row label="What is the estimated global net wealth of your company?"><Options labels={netWealthLabels} chosen={company.netWealth} other={company.netWealthOther} otherHint="(please specify in USD)" /></Row>
          <Row label="How has this been built up?"><Options labels={companyWealthSourceLabels} chosen={company.wealthSources} other={company.wealthSourcesOther} /></Row>
          <Row label={<>Is the Company a Personal Investment Vehicle?<p style={{ margin: "8px 0 0" }}>What is the source of the Vehicle's capital?</p></>}>
            {yes(company.personalInvestmentVehicle)}
            <div style={{ marginTop: 6 }}><Options labels={capitalSourceLabels} chosen={company.personalInvestmentVehicle ? company.capitalSources : []} other={company.personalInvestmentVehicle ? company.capitalSourcesOther : ""} /></div>
          </Row>
        </tbody>
      </table>
      <table className="op-form">
        <Bar title="About the Company's Experience and Understanding of Financial Markets and Instruments" color="var(--op-brown)" />
        <tbody>
          <Row label="For how long the company has been active on the financial markets / investing in financial products?"><Options labels={companyActiveForLabels} chosen={company.activeFor} other={company.activeForOther} /></Row>
          <Row label="How have the company's assets been managed before?"><Options labels={companyManagedByLabels} chosen={company.managedBy} other={company.managedByOther} /></Row>
          <Row label="In which financial products has the company already invested on a regular basis?"><Options labels={companyProductLabels} chosen={company.products} other={company.productsOther} /></Row>
        </tbody>
      </table>

      <h3 className="op-stmt">Data protection statement</h3>
      <p className="op-t">{DATA_PROTECTION_STATEMENT}</p>
      <h3 className="op-stmt">Declaration</h3>
      {ENTITY_DECLARATION.map((paragraph) => <p key={paragraph} className="op-t">{paragraph}</p>)}
      <Signatures name="" company={name} />
    </section>
  );
}

/** The self-certification's own address lines: two lines, the city, the province, the postal code, the country. */
function CertAddressRows({ heading, value, hint }: { heading: string; value: Address | null; hint?: string }) {
  return (
    <>
      <Row label={<b>{heading}</b>}>{hint ? <span className="op-hint">{hint}</span> : null}</Row>
      <Row label="Address Line 1" right><V>{value?.line1}</V></Row>
      <Row label="Address Line 2" right><V>{value?.line2}</V></Row>
      <Row label="City/Town" right><V>{value?.city}</V></Row>
      <Row label="Province/State/County" right><V>{value?.state}</V></Row>
      <Row label="Postal Code/ZIP Code" right><V>{value?.postalCode}</V></Row>
      <Row label="Country/Jurisdiction" right><V>{country(value?.country)}</V></Row>
    </>
  );
}

/** Part 2 of a self-certification: three lines of tax residence, each with its TIN or Reason A, B or C. */
function CertTax({ who, rows, explanation }: { who: string; rows: TaxLine[]; explanation: string | null }) {
  const shown = Array.from({ length: 3 }, (_, at) => rows[at]);
  return (
    <>
      {/* Every part on a page of its own, as the paper turns over. */}
      <div className="op-sec op-break" style={{ background: "var(--op-teal)" }}>Part 2 &nbsp;Tax Residence Information</div>
      <p className="op-t">
        Please complete the following table indicating the country(ies)/jurisdiction(s) where the {who} is resident for tax purposes and the {who}'s
        Taxpayer Identification Number or functional equivalent (hereafter referred to as 'TIN') for each country/jurisdiction indicated.
      </p>
      <p className="op-t">If the {who} is a resident for tax purposes in more than three countries, please use a separate sheet.</p>
      <p className="op-t">If no TIN is available, please indicate Reason A, B or C as appropriate:</p>
      {/* The three reasons in the paper's green box, each named in bold. */}
      <div className="op-reasons">
        {(["A", "B", "C"] as NoTinReason[]).map((reason) => (
          <p key={reason}><b>Reason {reason}:</b> {noTinReasonText[reason].replace(/^Reason . – /, "").replaceAll("{who}", who)}</p>
        ))}
      </div>
      <table className="op-grid">
        <thead><tr><th>No.</th><th style={{ textAlign: "left" }}>Country/Jurisdiction of tax residence</th><th style={{ textAlign: "left" }}>TIN</th><th>If no TIN is available, please indicate Reason A, B or C</th></tr></thead>
        <tbody>
          {shown.map((row, at) => (
            <tr key={at}>
              <td className="op-c"><b>{at + 1}</b></td>
              <td>{country(row?.country)}</td>
              <td>{row?.tin}</td>
              <td className="op-c">{(["A", "B", "C"] as NoTinReason[]).map((reason) => <Box key={reason} label={reason} on={!row?.tin?.trim() && row?.reason === reason} />)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="op-t">If Reason B or C is selected, please explain below the reason(s) the {who} is unable or not required to obtain a TIN, or the reason(s) a TIN is not available.</p>
      <Row2 label="" value={explanation} />
    </>
  );
}

/** A self-certification's declaration and its one signature, name and capacity. */
function CertDeclaration({ part, kind, name }: { part: string; kind: keyof typeof SELF_CERT_DECLARATION; name: string }) {
  const words = SELF_CERT_DECLARATION[kind];
  const signedAt = useContext(SignedAt);
  return (
    <div>
      <div className="op-sec op-break" style={{ background: kind === "individual" ? "var(--op-indigo)" : "var(--op-brown)" }}>{part}</div>
      {words.statement.map((paragraph) => <p key={paragraph} className="op-t">{paragraph}</p>)}
      <h3 className="op-stmt">Certification</h3>
      {words.certification.map((paragraph) => <p key={paragraph} className="op-t">{paragraph}</p>)}
      <div className="op-sig op-keep" style={{ marginTop: 10 }}>
        <div><span>Sign Here ▶</span><V /></div>
        <p className="op-hint" style={{ margin: "0 0 6px" }}>{words.signature}</p>
        <div><span>Print Name</span><V>{name}</V></div>
        <p className="op-hint" style={{ margin: "0 0 6px" }}>{words.printName}</p>
        <div><span>Capacity</span><V /></div>
        <p className="op-hint" style={{ margin: "0 0 6px" }}>{words.capacity}</p>
        <div><span>Date</span><V>{name ? signedAt : ""}</V></div>
      </div>
      <div className="op-warn">{SELF_CERT_WARNING}</div>
    </div>
  );
}

/** The opening page of a self-certification form, under the paper's own banner with its two circles. */
function CertOpening({ kind }: { kind: "individual" | "entity" }) {
  return (
    <>
      <div className="op-hero op-cert">
        <span className="op-ring op-ring-1" />
        <span className="op-ring op-ring-2" />
        <div className="op-kicker">CRS / FATCA</div>
        <h1>{SELF_CERT_TITLE[kind]}</h1>
        <p>Version Oct 2025</p>
      </div>
      {SELF_CERT_INTRODUCTION.map((paragraph) => <p key={paragraph} className="op-t">{paragraph}</p>)}
      <div className="op-note">{SELF_CERT_NOTE}</div>
      <p className="op-t">{SELF_CERT_WHO[kind]}</p>
    </>
  );
}

const GUIDE_TINT = { navy: "#eef2f8", teal: "#e9f2f1", indigo: "#eceef8", brown: "#f6efe8" };

/** "…at this link." as the paper prints it, the word underlined. */
function Linked({ text }: { text: string }) {
  const at = text.lastIndexOf("this link");
  if (at < 0) return <>{text}</>;
  return <>{text.slice(0, at)}this <span className="op-link">link</span>{text.slice(at + "this link".length)}</>;
}

/**
 * The paper's closing pages (25 Nov 2026): how to complete the form, a table for each part in that part's colour, then
 * the definitions, a term on the left and its meaning, line by line, on the right.
 */
function CertGuide({ pages, definitions }: { pages: GuidePage[]; definitions: GlossTerm[] }) {
  return (
    <>
      {pages.map((page) => (
        <section key={page.title} className="op-break">
          <h2 className="op-guide-title">{page.title}</h2>
          {page.tables.map((table) => (
            <table key={table.part} className="op-guide">
              <thead>
                <tr style={{ background: `var(--op-${table.tone})` }}><th>{table.part}</th><th>{table.title}</th></tr>
              </thead>
              <tbody>
                {table.rows.map((row) => (
                  <tr key={row.label}>
                    <td style={{ background: GUIDE_TINT[table.tone] }}>{row.label}</td>
                    <td>{row.text.map((paragraph) => <p key={paragraph}><Linked text={paragraph} /></p>)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ))}
        </section>
      ))}
      <section className="op-break">
        <h2 className="op-guide-title">Definitions</h2>
        <p className="op-t op-hint">{DEFINITIONS_INTRODUCTION}</p>
        <table className="op-gloss">
          {definitions.map((term) => (
            <tbody key={term.term}>
              {term.lines.map((line, at) => (
                <tr key={at} className={at === term.lines.length - 1 ? "op-gloss-end" : undefined}>
                  <td className="op-term">{at === 0 ? term.term : ""}</td>
                  <td>
                    {line.heading ? (
                      <div className="op-gloss-head">{line.text}</div>
                    ) : (
                      <div className="op-gloss-line" style={{ paddingLeft: line.marker === undefined ? 0 : `${(line.depth ?? 1) * 16}px` }}>
                        {line.marker ? <span className="op-mark">{line.marker}</span> : null}
                        <span style={line.italic ? { fontStyle: "italic" } : undefined}>
                          {line.lead ? <b>{line.lead}</b> : null}{line.lead ? " " : null}<Linked text={line.text} />
                        </span>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </section>
    </>
  );
}

/** An account holder's self-certification (25 Nov 2026): Part 1 their identification, Part 2, Part 3 signed. */
function HolderCertification({ holder }: { holder: FormHolder }) {
  const { details } = holder;
  const mailing = addressGiven(holder.mailingAddress) ? holder.mailingAddress : null;
  return (
    <section className="op-break">
      <CertOpening kind="individual" />
      <div className="op-sec op-break" style={{ background: "var(--op-navy)" }}>Part 1 &nbsp;Identification of Account Holder</div>
      <table className="op-form">
        <tbody>
          <Row label={<b>A) Name of the Individual Account Holder</b>}> </Row>
          <Row label="Title" right><V>{details.title}</V></Row>
          <Row label="Surname" right><V>{holder.surname}</V></Row>
          <Row label="First or Given Name" right><V>{holder.forenames}</V></Row>
          <Row label="Middle Name(s)" right><V>{details.middleNames}</V></Row>
          <Row label={<b>B) Date of Birth</b>}><WithHint value={paperDate(holder.dateOfBirth)} hint="(DD-MMM-YYYY)" /></Row>
          <Row label={<b>C) Place of Birth</b>}> </Row>
          <Row label="Town or City of Birth" right><V>{details.placeOfBirth}</V></Row>
          <Row label="Country/Jurisdiction of Birth" right><V>{country(holder.countryOfBirth)}</V></Row>
          <CertAddressRows heading="D) Current Residence Address" value={holder.residentialAddress} />
          <CertAddressRows heading="E) Mailing Address" value={mailing} hint="(complete only if different from Section D)" />
        </tbody>
      </table>
      <CertTax who="Account Holder" rows={details.taxResidences} explanation={details.noTinExplanation} />
      <CertDeclaration part="Part 3  Declaration and Signature" kind="individual" name={holder.fullName?.trim() ?? ""} />
    </section>
  );
}

/** The entity's self-certification (25 Nov 2026): Parts 1 to 4, then an Annex for each controlling person. */
function EntityCertification({ application }: { application: FormApplication }) {
  const { entity } = application;
  const company = entity.company;
  const form = entity.selfCertification;
  const mailing = companyAddressGiven(company.mailingAddress) ? company.mailingAddress : null;
  const classes = (keys: Classification[]) => keys.map((key) => (
    <div key={key} style={{ marginBottom: 6 }}><Box label={classificationLabels[key]} on={form.classification === key} /></div>
  ));
  const listed = form.classification === "ACTIVE_NFE_LISTED";
  const named = namedControllers(form);
  return (
    <>
      <section className="op-break">
        <CertOpening kind="entity" />
        <div className="op-sec op-break" style={{ background: "var(--op-navy)" }}>Part 1 &nbsp;Identification of Account Holder</div>
        <table className="op-form">
          <tbody>
            <Row label={<b>A) Name of the Company/Legal Entity/Corporate Structure</b>}> </Row>
            <Row label="Registered Name" right><V>{entity.legalName}</V></Row>
            <Row label="Legal Form (Corporate-Private/Corporate-Listed/Trust)" right><V>{company.form ? legalFormLabels[company.form] : ""}</V></Row>
            <Row label="Other Trading Name(s)" right><V>{company.tradingNames}</V></Row>
            <Row label={<b>B) Date of Incorporation</b>}><WithHint value={paperDate(entity.dateOfIncorporation)} hint="(DD-MMM-YYYY)" /></Row>
            <Row label={<b>C) Place of Incorporation</b>}><Labelled label="Country/Jurisdiction:" value={country(entity.countryOfIncorporation)} /></Row>
            <CertAddressRows heading="D) Registered Address" value={entity.registeredAddress} />
            <CertAddressRows heading="E) Mailing Address" value={mailing} hint="(complete only if different from Section D)" />
            <Row label={<b>F) Contact Details</b>}> </Row>
            <Row label="Telephone" right><V>{company.phone}</V></Row>
            <Row label="Fax" right><V>{company.fax}</V></Row>
            <Row label="Email" right><V>{company.email}</V></Row>
            <Row label="Website" right><V>{company.website}</V></Row>
            <Row label={<b>G) Place of Operations</b>}><Labelled label="Country/Jurisdiction:" value={country(form.placeOfOperations)} /></Row>
            <Row label={<b>H) Company Registration Number</b>}><V>{entity.registrationNumber}</V></Row>
          </tbody>
        </table>
        <CertTax who="Account Holder" rows={form.taxResidences} explanation={form.noTinExplanation} />
        <div className="op-sec op-break" style={{ background: "var(--op-indigo)" }}>Part 3 &nbsp;Entity Classification</div>
        <p className="op-t">Please tick the appropriate box to declare the Company/Legal Entity/Corporate Structure's CRS Classification. Please refer to the Definitions section for more details.</p>
        <h3 className="op-stmt">Financial Institution (FI)</h3>
        {classes(["INVESTMENT_ENTITY_NON_PARTICIPATING", "OTHER_FINANCIAL_INSTITUTION"])}
        <h3 className="op-stmt">Non-Financial Entity (NFE)</h3>
        {classes(["ACTIVE_NFE_LISTED"])}
        <div style={{ marginLeft: 22 }}>
          <p className="op-t"><Cb on={listed && form.listedAs === "TRADED"} /> The Account Holder is a corporation, the shares of which are regularly traded on <span className="op-ins">{listed && form.listedAs === "TRADED" ? form.securitiesMarket : " "}</span>, which is an established securities market.</p>
          <p className="op-t"><Cb on={listed && form.listedAs === "RELATED_ENTITY"} /> The Account Holder is a Related Entity of <span className="op-ins">{listed && form.listedAs === "RELATED_ENTITY" ? form.relatedEntity : " "}</span>, a corporation, the shares of which are regularly traded on <span className="op-ins">{listed && form.listedAs === "RELATED_ENTITY" ? form.securitiesMarket : " "}</span>, which is an established securities market.</p>
        </div>
        {classes(["ACTIVE_NFE_GOVERNMENT", "ACTIVE_NFE_OTHER"])}
        <Row2 label="" value={form.classification === "ACTIVE_NFE_OTHER" ? form.activeCategory : ""} />
        {classes(["PASSIVE_NFE"])}
        <div className="op-sec" style={{ background: "var(--op-brown)" }}>Controlling Person(s) of Company/Legal Entity/Corporate Structure</div>
        <p className="op-t">Please indicate below the Full Name of the Controlling Person(s) of the Company/Legal Entity/Corporate Structure, and complete the Annex – Controlling Person(s) for each Controlling Person.</p>
        <Lines values={form.controllingPersons.slice(0, 4).map((one) => (named.length > 0 ? one.fullName : ""))} count={4} />
        <CertDeclaration part="Part 4  Declaration and Signature" kind="entity" name="" />
      </section>
      {named.map((place, at) => {
        const person = form.controllingPersons[place]!;
        const type = (key: ControllerType) => <Box key={key} label={controllerTypeGroups.flatMap((group) => Object.entries(group.types)).find(([one]) => one === key)![1]} on={person.type === key} />;
        return (
          <section key={place} className="op-break">
            <div className="op-hero">
              <div className="op-kicker">ANNEX {at + 1} OF {named.length}</div>
              <h1>Annex – Controlling Person(s)</h1>
              <p>This section must be completed for each Controlling Person. · {person.fullName}</p>
            </div>
            <div className="op-sec" style={{ background: "var(--op-navy)" }}>Part 1 &nbsp;Identification of Controlling Person</div>
            <table className="op-form">
              <tbody>
                <Row label={<b>A) Name of Controlling Person</b>}> </Row>
                <Row label="Title" right><V>{person.title}</V></Row>
                <Row label="Surname(s)" right><V>{person.surname}</V></Row>
                <Row label="First or Given Name" right><V>{person.firstName}</V></Row>
                <Row label="Middle Name(s)" right><V>{person.middleNames}</V></Row>
                <Row label={<b>B) Date of Birth</b>}><WithHint value={paperDate(person.dateOfBirth)} hint="(DD-MMM-YYYY)" /></Row>
                <Row label={<b>C) Place of Birth</b>}> </Row>
                <Row label="Town or City of Birth" right><V>{person.townOfBirth}</V></Row>
                <Row label="Country/Jurisdiction of Birth" right><V>{country(person.countryOfBirth)}</V></Row>
                <CertAddressRows heading="D) Current Residence Address" value={person.residenceAddress} />
                <CertAddressRows heading="E) Mailing Address" value={addressGiven(person.mailingAddress) ? person.mailingAddress : null} hint="(complete only if different from Section D)" />
              </tbody>
            </table>
            <CertTax who="Controlling Person" rows={person.taxResidences} explanation={person.noTinExplanation} />
            <div className="op-sec op-break" style={{ background: "var(--op-indigo)" }}>Part 3 &nbsp;Type of Controlling Person</div>
            <p className="op-t">Please provide the Controlling Person's status by ticking the appropriate box.</p>
            {controllerTypeGroups.map((group) => (
              <div key={group.group} className="op-keep">
                <h3 className="op-stmt">{group.group}</h3>
                <div className="op-opts">{(Object.keys(group.types) as ControllerType[]).map(type)}</div>
              </div>
            ))}
            <div className="op-other"><span>Other (please specify):</span><V>{person.type === "TRUST_OTHER" || person.type === "OTHER_EQUIVALENT" ? person.typeOther : ""}</V></div>
            <CertDeclaration part="Part 4  Declaration and Signature of Controlling Person" kind="controller" name={person.fullName?.trim() ?? ""} />
          </section>
        );
      })}
    </>
  );
}

/**
 * The self-certification alone, as it was filled in at onboarding (25 Nov 2026, local only): each account holder's
 * form, or the entity's with an Annex for each controlling person, then the paper's instructions and definitions.
 * Shown read-only on the prospect's Agreement tab, each form a section of its own.
 */
export function SelfCertificationPages({ application }: { application: FormApplication }) {
  if (application.clientType === "ENTITY") {
    return (
      <>
        <EntityCertification application={application} />
        <CertGuide pages={ENTITY_CERT_GUIDE} definitions={ENTITY_CERT_DEFINITIONS} />
      </>
    );
  }
  // A joint holder whose details were skipped has only a name, so there is nothing of theirs to show.
  const holders = application.holders.filter((holder, index) => index === 0 || !holder.details.skipped);
  return (
    <>
      {holders.map((holder, index) => <HolderCertification key={index} holder={holder} />)}
      <CertGuide pages={INDIVIDUAL_CERT_GUIDE} definitions={INDIVIDUAL_CERT_DEFINITIONS} />
    </>
  );
}
