import { abilityBand, profileFrom, toleranceBand, type Band, type ThreeProfile } from "@atomprive/forms/risk-questionnaire";

/**
 * Schedule 6 of the firm's Client Onboarding Form, the Risk Profiling Questionnaire (24 Nov 2026), as the onboarding
 * pop-up asks it: once for whoever the relationship manager writes it for, as many times as the account needs. Every
 * heading, question, answer and score here is the paper's own, as printed. The bands and the matrix are the firm's
 * rules, read from the one place the Forms tab reads them, so the two can never disagree. The API checks the same
 * answers with the same messages (OnboardingReview.java), so change both together.
 */

export type Education = "PRIMARY_OR_LOWER" | "SECONDARY" | "DIPLOMA_OR_HIGHER";
export type Level = "NONE" | "KNOWLEDGE" | "UNDER_5" | "OVER_6";
export type LeveragePurpose = "EQUITIES_BONDS" | "LIFE_INSURANCE" | "THIRD_PARTY_DEPOSIT" | "BRIDGE";
export type { Band, ThreeProfile };
export { profileFrom };

/** One time Schedule 6 is filled in, in the shape the form edits. */
export interface FormRiskProfile {
  /** The account holder it is for, by name: the only one there is, or the one the relationship manager chose. */
  filledInFor: string | null;
  education: Education | null;
  qualification: string | null;
  /** I. A level for each product class, by its key. */
  knowledge: Record<string, Level>;
  /** II. The letter chosen for each scored question, q1 to q11. */
  answers: Record<string, string>;
  /** VI. Whether the client agrees with the profile the questionnaire gives. */
  agrees: boolean | null;
  /** VI. The one they prefer, after a No. */
  preferredProfile: ThreeProfile | null;
  /** VII. None where the client won't leverage. */
  leveragePurposes: LeveragePurpose[];
  leverageOther: string | null;
  /** An entity's questionnaire (25 Nov 2026): Part A for each beneficial owner, in the order they are entered. */
  owners: OwnerEducation[];
  /** An entity's questionnaire: the jurisdictions, sectors and extenuating circumstances, each "if any". */
  excludedCountries: string | null;
  excludedSectors: string | null;
  circumstances: string | null;
}

/** Part A of an entity's questionnaire for one beneficial owner: "Beneficial Owner I", II or III. */
export interface OwnerEducation {
  owner: string | null;
  education: Education | null;
  qualification: string | null;
}

export function emptyRiskProfile(): FormRiskProfile {
  return {
    filledInFor: null,
    education: null,
    qualification: null,
    knowledge: {},
    answers: {},
    agrees: null,
    preferredProfile: null,
    leveragePurposes: [],
    leverageOther: null,
    owners: [],
    excludedCountries: null,
    excludedSectors: null,
    circumstances: null,
  };
}

/** A saved risk profile, read loosely, filled out to the whole form. */
export function riskProfileOf(saved: Partial<Record<keyof FormRiskProfile, unknown>> | null | undefined): FormRiskProfile {
  const empty = emptyRiskProfile();
  if (!saved) return empty;
  const text = (value: unknown) => (typeof value === "string" ? value : null);
  const record = <T>(value: unknown) => (value && typeof value === "object" ? { ...(value as Record<string, T>) } : {});
  return {
    filledInFor: text(saved.filledInFor),
    education: (text(saved.education) as Education | null) ?? null,
    qualification: text(saved.qualification),
    knowledge: record<Level>(saved.knowledge),
    answers: record<string>(saved.answers),
    agrees: typeof saved.agrees === "boolean" ? saved.agrees : null,
    preferredProfile: (text(saved.preferredProfile) as ThreeProfile | null) ?? null,
    leveragePurposes: Array.isArray(saved.leveragePurposes) ? (saved.leveragePurposes as LeveragePurpose[]) : [],
    leverageOther: text(saved.leverageOther),
    owners: Array.isArray(saved.owners)
      ? (saved.owners as Partial<OwnerEducation>[]).map((one) => ({ owner: text(one?.owner), education: (text(one?.education) as Education | null) ?? null, qualification: text(one?.qualification) }))
      : [],
    excludedCountries: text(saved.excludedCountries),
    excludedSectors: text(saved.excludedSectors),
    circumstances: text(saved.circumstances),
  };
}

/** Whether anything of a risk profile was filled in. */
export function riskProfileGiven(profile: FormRiskProfile) {
  return Boolean(profile.filledInFor?.trim() || profile.education || profile.qualification?.trim() || profile.agrees !== null
    || Object.keys(profile.knowledge).length > 0 || Object.keys(profile.answers).length > 0 || profile.leveragePurposes.length > 0);
}

/** What is sent: a preferred profile only after a No, and only the levels and answers the paper has. */
export function tidyRiskProfile(profile: FormRiskProfile): FormRiskProfile {
  const keep = <T>(values: Record<string, T>, keys: string[]) =>
    Object.fromEntries(keys.filter((key) => values[key] !== undefined).map((key) => [key, values[key]!])) as Record<string, T>;
  return {
    ...profile,
    knowledge: keep(profile.knowledge, allProductClasses.map((one) => one.key)),
    answers: keep(profile.answers, riskQuestions.map((one) => one.id)),
    preferredProfile: profile.agrees === false ? profile.preferredProfile : null,
  };
}

/** The paper's five steps of each risk questionnaire in the pop-up: the id's last part and the title. */
export const RISK_STEPS: [string, string][] = [
  ["knowledge", "Knowledge and experience"],
  ["ability", "Your risk ability"],
  ["tolerance", "Your risk tolerance"],
  ["result", "Risk profile and client declaration"],
  ["leverage", "Leverage (risk variation)"],
];

export const riskGroup = (index: number) => `Risk questionnaire ${index + 1}`;

/**
 * The entity's questionnaire in the pop-up (25 Nov 2026, the user's approved mockup), in the paper's order: the risk
 * profile, then the exclusions and extenuating circumstances, then the declaration, then leverage.
 */
export const ENTITY_RISK_STEPS: [string, string][] = [
  ["knowledge", "Knowledge and experience"],
  ["ability", "Your risk ability"],
  ["tolerance", "Your risk tolerance"],
  ["profile", "Risk profile"],
  ["exclusions", "Exclusions and extenuating circumstances"],
  ["declaration", "Client declaration on the risk profile"],
  ["leverage", "Leverage (risk variation)"],
];

export const ENTITY_RISK_GROUP = "Risk questionnaire · Entity";

/** Part A names the beneficial owners as the paper does. */
export const OWNER_NUMERALS = ["I", "II", "III"];

export const educationLabels: Record<Education, string> = {
  PRIMARY_OR_LOWER: "Primary or lower",
  SECONDARY: "Secondary",
  DIPLOMA_OR_HIGHER: "Diploma or higher",
};

/** I. The product classes, in the paper's groups; a class printed on its own row is its own group. */
export const productGroups: { group: string; classes: { key: string; name: string; short: string }[] }[] = [
  {
    group: "Direct Investments",
    classes: [
      { key: "moneyMarket", name: "Money Market (Time Deposits, T-Bills, Commercial Paper)", short: "Money Market" },
      { key: "fixedIncome", name: "Fixed Income (Government or Corporate Bonds)", short: "Fixed Income" },
      { key: "equities", name: "Equities (Exchange traded Shares)", short: "Equities" },
    ],
  },
  {
    group: "Fund Structures",
    classes: [
      { key: "mutualFunds", name: "Mutual Funds, Funds of Funds and Similar Products", short: "Mutual Funds" },
      { key: "hedgeFunds", name: "Hedge Funds, Funds of Hedge Funds and Similar Products", short: "Hedge Funds" },
      { key: "privateEquity", name: "Private Equity", short: "Private Equity" },
    ],
  },
  {
    group: "Derivative Structures",
    classes: [
      {
        key: "structuredMinimum",
        name: "Structured Products with minimum redemption (e.g.: Range Accruals, Floaters)",
        short: "Structured Products with minimum redemption",
      },
      {
        key: "structuredParticipation",
        name: "Structured Products for participation / yield enhancement (e.g.:- Equity Linked Notes, Dual Currency Investments)",
        short: "Structured Products for participation / yield enhancement",
      },
      {
        key: "forwards",
        name: "Forwards and Contract-Based Derivatives (E.g.:- FX / Stock Accumulator Contracts)",
        short: "Forwards and Contract-Based Derivatives",
      },
    ],
  },
  { group: "Foreign Currencies", classes: [{ key: "foreignCurrencies", name: "", short: "Foreign Currencies" }] },
  { group: "Commodities (Future Funds)", classes: [{ key: "commodities", name: "", short: "Commodities" }] },
  { group: "Real Estate (Funds or Real Estate Investments Trusts)", classes: [{ key: "realEstate", name: "", short: "Real Estate" }] },
  { group: "Emerging Markets (E.g.:- Brazil, Russia, China, India)", classes: [{ key: "emergingMarkets", name: "", short: "Emerging Markets" }] },
];

export const allProductClasses = productGroups.flatMap((group) => group.classes);

/** I. The table's four columns, as their heads are printed. */
export const levelLabels: Record<Level, string> = {
  NONE: "No Knowledge No Experience",
  KNOWLEDGE: "Have Knowledge No Experience",
  UNDER_5: "Have Knowledge <5 Years' Experience",
  OVER_6: "Have knowledge 6+ years' Experience",
};

export const LEVELS: Level[] = ["NONE", "KNOWLEDGE", "UNDER_5", "OVER_6"];

export const knowledgeDefinitions = {
  knowledge: "You understand the distinctive characteristics and the important underlying risks of the relevant product class",
  experience: "You have conducted at least 5 trades on the product class, with any financial institution",
};

export interface RiskOption {
  value: string;
  text: string;
  score: number;
}

export interface RiskQuestion {
  id: string;
  title: string;
  ask: string;
  options: RiskOption[];
}

const scored = (texts: string[], scores = [1, 2, 3, 4, 5]): RiskOption[] =>
  texts.map((text, at) => ({ value: "abcde"[at]!, text, score: scores[at]! }));

export const abilityIntro =
  "Your Risk Ability – Please answer all question below as accurately as possible by choosing one of the options provided";

/** II. Your Risk Ability: six questions, 10 to 50. */
export const abilityQuestions: RiskQuestion[] = [
  {
    id: "q1",
    title: "Free Assets",
    ask: "What percentage of your total financial assets are available for investments?",
    options: scored(["Less than 10%", "Between 10% and 40%", "Between 40% and 60%", "Between 60% and 90%", "More than 90%"]),
  },
  {
    id: "q2",
    title: "Time Horizon",
    ask: "For how many years from now are you unlikely to need substantial funds from your free assets?",
    options: scored(
      ["Less than 3 years", "Between 3 and 5 years", "Between 5 and 8 years", "Between 8 and 12 years", "More than 12 years"],
      [3, 6, 9, 12, 15],
    ),
  },
  {
    id: "q3",
    title: "Retirement Coverage",
    ask: "To what extent are you planning to use your free assets to finance your standard of living after retirement?",
    // Four answers, scored 1, 2, 3 and 5 as printed: there is no 4, so no "d".
    options: [
      { value: "a", text: "All or most (More than 60%)", score: 1 },
      { value: "b", text: "A significant portion (between 30% and 60%)", score: 2 },
      { value: "c", text: "Some (less than 30%)", score: 3 },
      { value: "e", text: "None (0%)", score: 5 },
    ],
  },
  {
    id: "q4",
    title: "Absorption of Loss",
    ask: "How much of loss % on your assets can be compensated from your annual savings?",
    options: scored([
      "Low (less than 2%)",
      "Moderate (between 2% and 5%)",
      "Medium (between 5% and 10%)",
      "Quite high (between 10% and 20%)",
      "High (above 20%)",
    ]),
  },
  {
    id: "q5",
    title: "Capital Erosion",
    ask: "Assuming you has no annual income (from occupation or investments), for how long could you finance your current standard of living from your free assets?",
    options: scored(["Less than 2 years", "Between 2 and 6 years", "Between 6 and 10 years", "Between 10 and 15 years", "For 15 years and more"]),
  },
  {
    id: "q6",
    title: "Future liabilities and plans",
    ask: "What portion if any of your free assets do you need to use for future liabilities or plans (E.g.:- real estate purchases, business investments, loan repayments)?",
    options: scored(
      [
        "Most (more than 75%)",
        "A large portion (between 75% and 40%)",
        "Some portion (between 40% and 20%)",
        "A small portion (between 20% and 0%)",
        "There are currently no liabilities or plans (0%)",
      ],
      [3, 6, 9, 12, 15],
    ),
  },
];

export const toleranceIntro =
  "Your Risk Tolerance – Please answer all question below as accurately as possible by choosing one of the options provided";

/** II. Your Risk Tolerance: five questions, 5 to 25. */
export const toleranceQuestions: RiskQuestion[] = [
  {
    id: "q7",
    title: "Experience",
    ask: "How many years of experience do you have investing in risk-bearing products such as equities, alternative investments, derivatives and similar instruments?",
    options: scored(["No experience", "Between 1 and 3 years", "Between 3 and 6 years", "Between 6 and 15 years", "More than 15 years"]),
  },
  {
    id: "q8",
    title: "Interests",
    ask: "How often do you follow developments in the financial markets?",
    options: scored(["Never", "Rarely", "Sometimes", "Regularly", "Almost daily or more often"]),
  },
  {
    id: "q9",
    title: "Expectations",
    ask: "Do you agree with the following statement: Over the long term (more than 5 year), riskier investments with a higher potential return (E.g.:- equities) are more attractive than less risky investments with a lower potential return (E.g.:- money market investments)?",
    options: scored(["Do not agree", "Slightly disagree", "Partially agree", "Mostly agree", "Agree"]),
  },
  {
    id: "q10",
    title: "Risk Appetite / Awareness",
    ask: "Scenario A: Annual return between 15 – 35% in the last 5 years. Return as low as -4%. Scenario B: Guaranteed fixed return of 5%. How much of your investments would you put in the riskier scenario A and how much in scenario B?",
    options: scored(["None", "Less than 50%", "Around 50%", "More than 50%", "Up to 100%"]),
  },
  {
    id: "q11",
    title: "Comport / Loss Sensitivity",
    ask: "How would you react if your portfolio were to decrease in value by 30%?",
    options: scored([
      "Broadly reduce positions",
      "Selectively reduce positions",
      "Maintain current positions",
      "Selectively increase positions",
      "Broadly increase positions",
    ]),
  },
];

export const riskQuestions = [...abilityQuestions, ...toleranceQuestions];

/**
 * The entity paper's Risk Ability (25 Nov 2026): its third question is about future growth instead of retirement, with
 * the same four answers and scores.
 */
export const entityAbilityQuestions: RiskQuestion[] = abilityQuestions.map((question) => (question.id !== "q3" ? question : {
  ...question,
  title: "Future Growth / Investment Coverage",
  ask: "To what extent are you planning to use your free assets to finance your future growth / investment plans?",
}));

export const totalLine = "Add up the values of all responses to calculate your total score:";

/** The bands as each part prints them, Low to High. */
export const BAND_ORDER: Band[] = ["LOW", "MODERATE", "MEDIUM", "ENHANCED", "HIGH"];
export const bandNames: Record<Band, string> = { LOW: "Low", MODERATE: "Moderate", MEDIUM: "Medium", ENHANCED: "Enhanced", HIGH: "High" };
export const abilityRanges: Record<Band, string> = { LOW: "10-14", MODERATE: "15-24", MEDIUM: "25-34", ENHANCED: "35-44", HIGH: "45-50" };
export const toleranceRanges: Record<Band, string> = { LOW: "5-7", MODERATE: "8-12", MEDIUM: "13-17", ENHANCED: "18-22", HIGH: "23-25" };

export const PROFILE_ORDER: ThreeProfile[] = ["CONSERVATIVE", "BALANCED", "AGGRESSIVE"];
export const profileNames: Record<ThreeProfile, string> = { CONSERVATIVE: "Conservative", BALANCED: "Balanced", AGGRESSIVE: "Aggressive" };

/** The Risk Profile table, row by row, as the paper prints it. */
export const profileDefinitions: { row: string; text: Record<ThreeProfile, string> }[] = [
  {
    row: "Type of Investor",
    text: {
      CONSERVATIVE: "You are a conservative investor whose priority is to safeguard your investment capital",
      BALANCED: "You are an assertive investor who understands the moments of investments markets",
      AGGRESSIVE: "You are an assertive investor who understands the moments of investments markets",
    },
  },
  {
    row: "Return Objective",
    text: {
      CONSERVATIVE: "You prefer limited fluctuations in the value of your portfolio instead of achieving higher expected returns",
      BALANCED: "You want to try to achieve a higher expected return than would be possible with a \"Conservative\" portfolio",
      AGGRESSIVE:
        "You would like to achieve the highest possible expected return at the end of your investment horizon and are willing to take considerable risks to accomplish this",
    },
  },
  {
    row: "Risk Tolerance",
    text: {
      CONSERVATIVE: "You probably wish to be able to utilize your capital within a few years",
      BALANCED:
        "You are able to tolerate temporary falls in the value of your portfolio and realize that you could face negative annual returns. However, you do not feel comfortable with large negative fluctuations",
      AGGRESSIVE: "You are willing to accept higher fluctuations in portfolio value in return for potential higher long term capital appreciation",
    },
  },
  {
    row: "Use of Leverage",
    text: {
      CONSERVATIVE: "You do not wish to leverage your portfolio as this increase the volatility and potentially leads to higher losses",
      BALANCED: "You do not wish to leverage your portfolio as this increase the volatility and potentially leads to higher losses",
      AGGRESSIVE: "You are willing to use the leverage enhance returns and realize that this considerably increases the risk of your portfolio",
    },
  },
  {
    row: "Asset Allocation Target",
    text: {
      CONSERVATIVE:
        "The longer your investment horizon, the higher the proportion of shares and bonds that could be included in your portfolio. However, you should stay within a reasonable range of the typical proportions as mentioned in the table below",
      BALANCED:
        "To accomplish your expected return, you are willing to take a higher risk with your investments. This can be expressed by a higher percentage of shares and/or high yield bonds in your portfolio",
      AGGRESSIVE:
        "There will be more emphasis in share and high yield bonds in your portfolio as compared to a \"Balanced\" or \"Conservative\" profile, even if your investment horizon is relatively short.",
    },
  },
];

export const declarationHeading = "VI. Client Declaration On Understanding And Accepting The Risk Profile";
export const agreeQuestion = "Do You Agree With This Risk Profile Assigned To You Based On The Questionnaire?";
export const preferredQuestion = "Please specify your preferred Risk Profile";

export const leverageHeading = "VII. Important Notice For Clients Who Intend to Leverage Against Their Portfolio:";
export const leverageNotice = [
  "Leveraging a portfolio (i.e. borrowing against the value of your portfolio) significantly increase its risk profile.",
  "The degree of the increase in the risk level will depend on the amount of borrowing in comparison to the assets in your portfolio. Other factors such as the liquidity and volatility of your investments should also be taken into consideration, as leveraging investments which are illiquid and volatile could lead to significantly higher losses.",
  "Only \"Aggressive\" risk profiled clients should employ Leverage.",
  "If, however, you are profiled in this investment and risk profile form as \"Conservative\" or \"Balanced\", but nevertheless wish to employ leverage, you acknowledge that you have been informed by Relationship Investment Advisor, and you understand the risks of the use of such leverage.",
  "We would like to draw your attention to the risks of leverage as described in the \"Risks Disclosure Statement\" set out in the Investment Services Agreement entered into between us.",
];
export const leverageQuestion = "You also agree that you will employ Leverage only for the following purposes:";

/** The entity paper's notice says "Relationship Investment Manager" where the individual's says "Advisor". */
export const entityLeverageNotice = leverageNotice.map((line) => line.replace("Relationship Investment Advisor", "Relationship Investment Manager"));
export const entityLeverageHeading = "Important Notice For Clients Who Intend to Leverage Against Their Portfolio:";
export const entityDeclarationHeading = "v. Client Declaration On Understanding And Accepting The Risk Profile";

/** Page 14 of the entity paper, word for word. */
export const exclusionsWording = {
  countriesHeading: "Excluded Jurisdictions",
  countriesAsk: "Please provide details of any jurisdictions you explicitly do not wish to invest in. (Please note that based on the excluded jurisdictions mentioned by you, we will not be including investment products/ transactions from the said excluded jurisdictions whilst advising you or making any recommendation.)",
  countriesLabel: "Names of Countries",
  sectorsHeading: "Excluded Sectors/ Industries",
  sectorsAsk: "Please provide details of any sectors/ industries you explicitly do not wish to invest in. (Please note that based on the excluded sectors/industries mentioned by you, we will not be including investment products/ transactions from the said excluded sectors/industries whilst advising you or making any recommendation.)",
  sectorsLabel: "Names of Sectors/Industries",
  circumstancesHeading: "Extenuating Circumstances (if any of the Beneficial Owner(s) of the Client)",
  circumstancesLabel: "Are there any extenuating circumstances of any of the Beneficial Owner(s) to be considered eg. divorce, widowed, caring for minor children etc? (Please provide details of anything you feel may be relevant and may have a bearing on the Beneficial Owner(s)' financial status)",
};
export const leveragePurposeLabels: Record<LeveragePurpose, string> = {
  EQUITIES_BONDS: "To invest in equities and/or bonds",
  LIFE_INSURANCE: "To finance a life insurance plan",
  THIRD_PARTY_DEPOSIT: "To finance a deposit held with a 3rd Party bank",
  BRIDGE: "For temporary bridge financing (under 1 year)",
};
export const leverageOtherLabel = "Other needs, please specify";
export const custodianNote = "You acknowledge that the arranging of any leverage is subject to custodian bank discretion.";

function total(questions: RiskQuestion[], answers: Record<string, string>) {
  return questions.reduce((sum, question) => sum + (question.options.find((one) => one.value === answers[question.id])?.score ?? 0), 0);
}

const allAnswered = (questions: RiskQuestion[], answers: Record<string, string>) =>
  questions.every((question) => question.options.some((one) => one.value === answers[question.id]));

/**
 * "Add up the values of all responses": both totals, and once every question of a part is answered, its band and,
 * with both, the profile the firm's matrix gives.
 */
export function riskScores(profile: FormRiskProfile) {
  const ability = total(abilityQuestions, profile.answers);
  const tolerance = total(toleranceQuestions, profile.answers);
  const abilityBandIs = allAnswered(abilityQuestions, profile.answers) ? abilityBand(ability) : null;
  const toleranceBandIs = allAnswered(toleranceQuestions, profile.answers) ? toleranceBand(tolerance) : null;
  return {
    ability,
    tolerance,
    abilityBand: abilityBandIs,
    toleranceBand: toleranceBandIs,
    profile: abilityBandIs && toleranceBandIs ? profileFrom(abilityBandIs, toleranceBandIs) : null,
  };
}

/** The step of a risk profile a field is on, such as "risk-1-tolerance" for "riskProfiles[1].answers.q9". */
export function riskStepOfField(field: string, entity = false): string | null {
  if (entity) return entityRiskStepOfField(field);
  if (field === "riskProfiles") return "risk-0-knowledge";
  const found = /^riskProfiles\[(\d+)\]\.(\w+)(?:\.(\w+))?/.exec(field);
  if (!found) return null;
  const [, index, name = "", inner = ""] = found;
  const part = name === "answers" ? abilityQuestions.some((question) => question.id === inner) ? "ability" : "tolerance"
      : name === "agrees" || name === "preferredProfile" ? "result"
        : name.startsWith("leverage") ? "leverage" : "knowledge";
  return `risk-${index}-${part}`;
}

type Check = (id: string, group: string, label: string, checks: () => void) => void;
type Problem = (field: string, message: string) => void;

/**
 * Each risk questionnaire's steps, checked as the API checks them: the paper's five, for the account holder whose it
 * is (25 Nov 2026: one each, named for them, so never chosen).
 */
export function reviewRiskProfiles(profiles: FormRiskProfile[], step: Check, problem: Problem) {
  profiles.forEach((profile, index) => {
    const at = `riskProfiles[${index}].`;
    const group = riskGroup(index);
    const [knowledge, ability, tolerance, result, leverage] = RISK_STEPS.map(([, label]) => label) as [string, string, string, string, string];
    step(`risk-${index}-knowledge`, group, knowledge, () => {
      if (!profile.education) problem(`${at}education`, "Choose the highest level of education.");
      for (const one of allProductClasses) {
        if (!profile.knowledge[one.key]) problem(`${at}knowledge.${one.key}`, `Choose a level for ${one.short}.`);
      }
    });
    const answered = (questions: RiskQuestion[]) => () => {
      for (const question of questions) {
        if (!question.options.some((one) => one.value === profile.answers[question.id])) {
          problem(`${at}answers.${question.id}`, `Choose an answer to ${question.title}.`);
        }
      }
    };
    step(`risk-${index}-ability`, group, ability, answered(abilityQuestions));
    step(`risk-${index}-tolerance`, group, tolerance, answered(toleranceQuestions));
    step(`risk-${index}-result`, group, result, () => {
      if (profile.agrees === null) problem(`${at}agrees`, "Say whether the client agrees with this risk profile.");
      else if (!profile.agrees && !profile.preferredProfile) problem(`${at}preferredProfile`, "Choose the risk profile the client prefers.");
    });
    step(`risk-${index}-leverage`, group, leverage, () => {});
  });
}

/** The step of the entity's questionnaire a field is on (25 Nov 2026). */
function entityRiskStepOfField(field: string): string | null {
  if (field === "riskProfiles") return "risk-0-knowledge";
  const found = /^riskProfiles\[\d+\]\.(\w+)(?:\.(\w+))?/.exec(field);
  if (!found) return null;
  const [, name = "", inner = ""] = found;
  const part = name === "answers" ? abilityQuestions.some((question) => question.id === inner) ? "ability" : "tolerance"
    : name === "agrees" || name === "preferredProfile" ? "declaration"
      : name.startsWith("leverage") ? "leverage"
        : name === "excludedCountries" || name === "excludedSectors" || name === "circumstances" ? "exclusions" : "knowledge";
  return `risk-0-${part}`;
}

/**
 * The entity's questionnaire, checked as the API checks it (25 Nov 2026): Part A's education for each beneficial
 * owner (their qualification only "if any"), Part B's product classes, the scored questions, and the declaration.
 * The exclusions are asked "if any", and leverage only of a client who means to use it.
 */
export function reviewEntityRisk(profile: FormRiskProfile, owners: number, step: Check, problem: Problem) {
  const at = "riskProfiles[0].";
  const label = (part: string) => ENTITY_RISK_STEPS.find(([id]) => id === part)![1];
  step("risk-0-knowledge", ENTITY_RISK_GROUP, label("knowledge"), () => {
    for (let index = 0; index < Math.min(owners, OWNER_NUMERALS.length); index++) {
      if (!profile.owners[index]?.education) {
        problem(`${at}owners[${index}].education`, `Choose the highest level of education of Beneficial Owner ${OWNER_NUMERALS[index]}.`);
      }
    }
    for (const one of allProductClasses) {
      if (!profile.knowledge[one.key]) problem(`${at}knowledge.${one.key}`, `Choose a level for ${one.short}.`);
    }
  });
  const answered = (questions: RiskQuestion[]) => () => {
    for (const question of questions) {
      if (!question.options.some((one) => one.value === profile.answers[question.id])) {
        problem(`${at}answers.${question.id}`, `Choose an answer to ${question.title}.`);
      }
    }
  };
  step("risk-0-ability", ENTITY_RISK_GROUP, label("ability"), answered(entityAbilityQuestions));
  step("risk-0-tolerance", ENTITY_RISK_GROUP, label("tolerance"), answered(toleranceQuestions));
  step("risk-0-profile", ENTITY_RISK_GROUP, label("profile"), () => {});
  step("risk-0-exclusions", ENTITY_RISK_GROUP, label("exclusions"), () => {});
  step("risk-0-declaration", ENTITY_RISK_GROUP, label("declaration"), () => {
    if (profile.agrees === null) problem(`${at}agrees`, "Say whether the client agrees with this risk profile.");
    else if (!profile.agrees && !profile.preferredProfile) problem(`${at}preferredProfile`, "Choose the risk profile the client prefers.");
  });
  step("risk-0-leverage", ENTITY_RISK_GROUP, label("leverage"), () => {});
}
