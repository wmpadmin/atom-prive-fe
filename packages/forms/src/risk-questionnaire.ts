import type { FormDetailAnswers } from "@atomprive/api-client/backoffice";
import type { FormReview } from "./account-opening-entity";

/**
 * The firm's own Risk Profile questionnaire (received 5 Nov 2026), which replaces the platform's earlier one.
 *
 * Its eleven scored questions fall in two parts: Risk Ability (six, scored 10 to 50) and Risk Tolerance (five,
 * scored 5 to 25). Each total lands in one of five bands, and the two bands meet in the firm's matrix, which gives
 * one of three profiles: Conservative, Balanced or Aggressive. Every question, answer and score here is the form's
 * own, as printed. What the screen adds is the arithmetic the paper leaves to whoever holds the pen.
 *
 * Saved answers carry `version: 2`, so a form filled on the earlier questionnaire still reads back as it was.
 */

export const QUESTIONNAIRE_VERSION = 2;

export type ThreeProfile = "CONSERVATIVE" | "BALANCED" | "AGGRESSIVE";

export type Band = "LOW" | "MODERATE" | "MEDIUM" | "ENHANCED" | "HIGH";

/** Part I's four levels, from the form's own column heads. */
export type Level = "NONE" | "KNOWLEDGE" | "UNDER_5" | "OVER_6";

export interface ScoredOption {
  value: string;
  text: string;
  score: number;
}

export interface ScoredQuestion {
  id: string;
  title: string;
  ask: string;
  options: ScoredOption[];
}

const five = (texts: string[], scores = [1, 2, 3, 4, 5]): ScoredOption[] =>
  texts.map((text, at) => ({ value: "abcde"[at]!, text, score: scores[at]! }));

/** II. Your Risk Ability: six questions, 10 to 50 points. */
export const abilityQuestions: ScoredQuestion[] = [
  {
    id: "q1",
    title: "Free Assets",
    ask: "What percentage of your total financial assets are available for investments?",
    options: five(["Less than 10%", "Between 10% and 40%", "Between 40% and 60%", "Between 60% and 90%", "More than 90%"]),
  },
  {
    id: "q2",
    title: "Time Horizon",
    ask: "For how many years from now are you unlikely to need substantial funds from your free assets?",
    // The paper prints no tick-box beside "Less than 3 years"; it is offered, because without it the lowest total
    // would be 13 and the 10–14 band could never be reached.
    options: five(
      ["Less than 3 years", "Between 3 and 5 years", "Between 5 and 8 years", "Between 8 and 12 years", "More than 12 years"],
      [3, 6, 9, 12, 15],
    ),
  },
  {
    id: "q3",
    title: "Future Growth / Investment Coverage",
    ask: "To what extent are you planning to use your free assets to finance your future growth / investment plans?",
    // Four answers scored 1, 2, 3 and 5, as printed: there is no 4.
    options: [
      { value: "a", text: "All or most (more than 60%)", score: 1 },
      { value: "b", text: "A significant portion (between 30% and 60%)", score: 2 },
      { value: "c", text: "Some (less than 30%)", score: 3 },
      { value: "e", text: "None (0%)", score: 5 },
    ],
  },
  {
    id: "q4",
    title: "Absorption of Loss",
    ask: "How much of loss % on your assets can be compensated from your annual savings?",
    options: five([
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
    ask: "Assuming you have no annual revenue (from business activities or investments), for how long could you finance yourself from your free assets?",
    options: five(["Less than 2 years", "Between 2 and 6 years", "Between 6 and 10 years", "Between 10 and 15 years", "For 15 years and more"]),
  },
  {
    id: "q6",
    title: "Future liabilities and plans",
    ask: "What portion, if any, of your free assets do you need to use for future liabilities or plans (e.g. real estate purchases, business investments, loan repayments)?",
    options: five(
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

/** II. Your Risk Tolerance: five questions, 5 to 25 points. */
export const toleranceQuestions: ScoredQuestion[] = [
  {
    id: "q7",
    title: "Experience",
    ask: "How many years of experience do you have investing in risk-bearing products such as equities, alternative investments, derivatives and similar instruments?",
    options: five(["No experience", "Between 1 and 3 years", "Between 3 and 6 years", "Between 6 and 15 years", "More than 15 years"]),
  },
  {
    id: "q8",
    title: "Interests",
    ask: "How often do you follow developments in the financial markets?",
    options: five(["Never", "Rarely", "Sometimes", "Regularly", "Almost daily or more often"]),
  },
  {
    id: "q9",
    title: "Expectations",
    ask: "Do you agree with the following statement: over the long term (more than 5 years), riskier investments with a higher potential return (e.g. equities) are more attractive than less risky investments with a lower potential return (e.g. money market investments)?",
    options: five(["Do not agree", "Slightly disagree", "Partially agree", "Mostly agree", "Agree"]),
  },
  {
    id: "q10",
    title: "Risk Appetite / Awareness",
    ask: "Scenario A: annual return between 15% and 35% in the last 5 years, with a return as low as -4%. Scenario B: a guaranteed fixed return of 5%. How much of your investments would you put in the riskier scenario A, and how much in scenario B?",
    options: five(["None", "Less than 50%", "Around 50%", "More than 50%", "Up to 100%"]),
  },
  {
    id: "q11",
    title: "Loss Sensitivity",
    ask: "How would you react if your portfolio were to decrease in value by 30%?",
    options: five([
      "Broadly reduce positions",
      "Selectively reduce positions",
      "Maintain current positions",
      "Selectively increase positions",
      "Broadly increase positions",
    ]),
  },
];

export const allQuestions = [...abilityQuestions, ...toleranceQuestions];

/** The bands, as the form prints them under each part. */
export const bandLabels: Record<Band, string> = {
  LOW: "Low",
  MODERATE: "Moderate",
  MEDIUM: "Medium",
  ENHANCED: "Enhanced",
  HIGH: "High",
};

export const BANDS: Band[] = ["LOW", "MODERATE", "MEDIUM", "ENHANCED", "HIGH"];

/** Each band's lowest score, Low to High. */
const ABILITY_FROM = [10, 15, 25, 35, 45];
const TOLERANCE_FROM = [5, 8, 13, 18, 23];

export const abilityRanges = ["10–14", "15–24", "25–34", "35–44", "45–50"];
export const toleranceRanges = ["5–7", "8–12", "13–17", "18–22", "23–25"];

function bandFrom(score: number, from: number[]): Band {
  let at = 0;
  from.forEach((lowest, index) => {
    if (score >= lowest) at = index;
  });
  return BANDS[at]!;
}

export const abilityBand = (score: number) => bandFrom(score, ABILITY_FROM);
export const toleranceBand = (score: number) => bandFrom(score, TOLERANCE_FROM);

/**
 * The firm's matrix, copied cell by cell from page 3: Low on either side is Conservative; Enhanced or High on both
 * is Aggressive; everything else is Balanced.
 */
export function profileFrom(ability: Band, tolerance: Band): ThreeProfile {
  if (ability === "LOW" || tolerance === "LOW") return "CONSERVATIVE";
  const high = (band: Band) => band === "ENHANCED" || band === "HIGH";
  return high(ability) && high(tolerance) ? "AGGRESSIVE" : "BALANCED";
}

export const PROFILES: ThreeProfile[] = ["CONSERVATIVE", "BALANCED", "AGGRESSIVE"];

export const profileLabels: Record<ThreeProfile, string> = {
  CONSERVATIVE: "Conservative",
  BALANCED: "Balanced",
  AGGRESSIVE: "Aggressive",
};

/** What each profile means, from the form's page 4. */
export const profileMeans: Record<ThreeProfile, { investor: string; returns: string; tolerance: string; leverage: string; allocation: string }> = {
  CONSERVATIVE: {
    investor: "You are a conservative investor whose priority is to safeguard your investment capital.",
    returns: "You prefer limited fluctuations in the value of your portfolio instead of achieving higher expected returns.",
    tolerance: "You probably wish to be able to utilise your capital within a few years.",
    leverage: "You do not wish to leverage your portfolio, as this increases the volatility and potentially leads to higher losses.",
    allocation:
      "The longer your investment horizon, the higher the proportion of shares and bonds that could be included in your portfolio, within a reasonable range of the typical proportions.",
  },
  BALANCED: {
    investor: "You are an assertive investor who understands the movements of investment markets.",
    returns: "You want to try to achieve a higher expected return than would be possible with a Conservative portfolio.",
    tolerance:
      "You are able to tolerate temporary falls in the value of your portfolio and realise that you could face negative annual returns. However, you do not feel comfortable with large negative fluctuations.",
    leverage: "You do not wish to leverage your portfolio, as this increases the volatility and potentially leads to higher losses.",
    allocation:
      "To accomplish your expected return, you are willing to take a higher risk with your investments. This can be expressed by a higher percentage of shares and/or high yield bonds in your portfolio.",
  },
  AGGRESSIVE: {
    investor: "You are an assertive investor who understands the movements of investment markets.",
    returns:
      "You would like to achieve the highest possible expected return at the end of your investment horizon and are willing to take considerable risks to accomplish this.",
    tolerance: "You are willing to accept higher fluctuations in portfolio value in return for potential higher long-term capital appreciation.",
    leverage: "You are willing to use leverage to enhance returns and realise that this considerably increases the risk of your portfolio.",
    allocation:
      "There will be more emphasis on shares and high yield bonds in your portfolio than in a Balanced or Conservative profile, even if your investment horizon is relatively short.",
  },
};

/** I. The thirteen product classes, in the form's groups. */
export const productClasses: { group: string; classes: { key: string; name: string }[] }[] = [
  {
    group: "Direct investments",
    classes: [
      { key: "moneyMarket", name: "Money Market (Time Deposits, T-Bills, Commercial Paper)" },
      { key: "fixedIncome", name: "Fixed Income (Government or Corporate Bonds)" },
      { key: "equities", name: "Equities (Exchange traded Shares)" },
    ],
  },
  {
    group: "Fund structures",
    classes: [
      { key: "mutualFunds", name: "Mutual Funds, Funds of Funds and Similar Products" },
      { key: "hedgeFunds", name: "Hedge Funds, Funds of Hedge Funds and Similar Products" },
      { key: "privateEquity", name: "Private Equity" },
    ],
  },
  {
    group: "Derivative structures",
    classes: [
      { key: "structuredMinimum", name: "Structured Products with minimum redemption (e.g. Range Accruals, Floaters)" },
      { key: "structuredParticipation", name: "Structured Products for participation / yield enhancement (e.g. Equity Linked Notes, Dual Currency Investments)" },
      { key: "forwards", name: "Forwards and Contract-Based Derivatives (e.g. FX / Stock Accumulator Contracts)" },
    ],
  },
  {
    group: "Other",
    classes: [
      { key: "foreignCurrencies", name: "Foreign Currencies" },
      { key: "commodities", name: "Commodities (Future Funds)" },
      { key: "realEstate", name: "Real Estate (Funds or Real Estate Investment Trusts)" },
      { key: "emergingMarkets", name: "Emerging Markets (e.g. Brazil, Russia, China, India)" },
    ],
  },
];

export const allClasses = productClasses.flatMap((group) => group.classes);

export const levelLabels: Record<Level, string> = {
  NONE: "No knowledge, no experience",
  KNOWLEDGE: "Have knowledge, no experience",
  UNDER_5: "Have knowledge, under 5 years' experience",
  OVER_6: "Have knowledge, 6+ years' experience",
};

export const LEVELS: Level[] = ["NONE", "KNOWLEDGE", "UNDER_5", "OVER_6"];

export const knowledgeNote = {
  knowledge: "You understand the distinctive characteristics and the important underlying risks of the relevant product class.",
  experience: "You have conducted at least 5 trades on the product class, with any financial institution.",
};

/** IV. The sectors and industries a client can exclude; anything else goes in the box beside them. */
export const sectors = [
  "Alcohol",
  "Adult entertainment",
  "Coal, oil and gas",
  "Communication services",
  "Consumer discretionary",
  "Consumer staples",
  "Energy",
  "Financials",
  "Gambling",
  "Health care",
  "Industrials",
  "Information technology",
  "Materials",
  "Real estate",
  "Tobacco",
  "Utilities",
  "Weapons and defence",
];

/** VII. What leverage may be used for, as the form lists it. */
export const leveragePurposes: { value: string; text: string }[] = [
  { value: "EQUITIES_BONDS", text: "To invest in equities and/or bonds" },
  { value: "LIFE_INSURANCE", text: "To finance a life insurance plan" },
  { value: "THIRD_PARTY_DEPOSIT", text: "To finance a deposit held with a third-party bank" },
  { value: "BRIDGE", text: "For temporary bridge financing (under 1 year)" },
  { value: "OTHER", text: "Other needs" },
];

export const questionnaireText = {
  exclusionsNote:
    "Based on the excluded jurisdictions and sectors mentioned, we will not be including investment products or transactions from them whilst advising you or making any recommendation.",
  circumstances:
    "Are there any extenuating circumstances of any of the beneficial owner(s) to be considered, e.g. divorce, widowed, caring for minor children? Please give details of anything you feel may be relevant and may have a bearing on their financial status.",
  declaration: [
    "I/We hereby confirm that the information furnished in the above questionnaire is materially correct and is a true reflection of my/our risk attitude.",
    "I/We agree with the risk profile assigned as {{profile}} and understand that this profile will be considered in determining the suitability of any advice or recommendation, and I/we acknowledge that I/we understand the risks associated with the assigned profile.",
    "I/We understand and acknowledge that the recommendations provided by the Investment Advisor are of an advisory nature and I/we shall exercise due judgement when making any decisions and/or entering into any transactions based on these recommendations.",
    "I/We also agree to notify the Investment Advisor of any material change in my/our situation, circumstances and/or investment profile.",
    "I/We acknowledge and understand that any statements of financial goals or objectives provided by me/us do not make or imply any undertaking, agreement or guarantee as to the attainment or the feasibility of attainment of such goals or objectives.",
  ],
  leverageNotice: [
    "Leveraging a portfolio (i.e. borrowing against the value of your portfolio) significantly increases its risk profile. The degree of the increase depends on the amount of borrowing compared with the assets in your portfolio. Other factors such as the liquidity and volatility of your investments should also be considered, as leveraging investments which are illiquid and volatile could lead to significantly higher losses.",
    "Only Aggressive risk-profiled clients should employ leverage.",
    "If, however, you are profiled as Conservative or Balanced but nevertheless wish to employ leverage, you acknowledge that you have been informed by your relationship manager and you understand the risks of the use of such leverage, as described in the Risks Disclosure Statement of the Investment Services Agreement.",
    "You acknowledge that the arranging of any leverage is subject to custodian bank discretion.",
  ],
};

export interface RiskQuestionnaire {
  version: 2;
  customerName: string;
  /** I. A level for each product class, by its key. */
  knowledge: Record<string, Level | null>;
  /** II. The answer to each question, by the letter beside it. */
  answers: Record<string, string>;
  /** III. ISO 3166 two-letter codes. */
  excludedCountries: string[];
  /** IV. From the list above. */
  excludedSectors: string[];
  otherSectors: string;
  /** V. */
  circumstances: string;
  /** VI. Whether the client agrees with the profile worked out. */
  agrees: boolean | null;
  /** VI. Where they do not, the one they prefer: only ever more conservative. */
  preferredProfile: ThreeProfile | null;
  /** The profile that counts: worked out where they agree, preferred where not. Kept for the rest of the platform. */
  chosenProfile: ThreeProfile | null;
  declarationConfirmed: boolean;
  /** VII. */
  intendsLeverage: boolean | null;
  leveragePurposes: string[];
  leverageOther: string;
  leverageAcknowledged: boolean;
}

export function emptyQuestionnaire(): RiskQuestionnaire {
  return {
    version: QUESTIONNAIRE_VERSION,
    customerName: "",
    knowledge: {},
    answers: {},
    excludedCountries: [],
    excludedSectors: [],
    otherSectors: "",
    circumstances: "",
    agrees: null,
    preferredProfile: null,
    chosenProfile: null,
    declarationConfirmed: false,
    intendsLeverage: null,
    leveragePurposes: [],
    leverageOther: "",
    leverageAcknowledged: false,
  };
}

/** Whether saved answers are this questionnaire's rather than the earlier one's. */
export function isQuestionnaire(saved: FormDetailAnswers | undefined): boolean {
  return Number((saved as { version?: unknown } | undefined)?.version ?? 0) >= QUESTIONNAIRE_VERSION;
}

/** What the API holds, filled out to the whole form. Anything saved on the earlier questionnaire starts afresh. */
export function toQuestionnaire(saved: FormDetailAnswers | undefined): RiskQuestionnaire {
  const empty = emptyQuestionnaire();
  if (!saved || !isQuestionnaire(saved)) return empty;
  const held = saved as Partial<RiskQuestionnaire>;
  return {
    ...empty,
    ...held,
    version: QUESTIONNAIRE_VERSION,
    knowledge: { ...held.knowledge },
    answers: { ...held.answers },
    excludedCountries: held.excludedCountries ?? [],
    excludedSectors: held.excludedSectors ?? [],
    leveragePurposes: held.leveragePurposes ?? [],
  };
}

function scoreOf(questions: ScoredQuestion[], answers: Record<string, string>) {
  return questions.reduce((total, question) => total + (question.options.find((one) => one.value === answers[question.id])?.score ?? 0), 0);
}

const answeredAll = (questions: ScoredQuestion[], answers: Record<string, string>) => questions.every((one) => Boolean(answers[one.id]));

/** Both totals, how many are answered, and — once every question is — the bands and the profile they give. */
export function scored(value: RiskQuestionnaire) {
  const ability = scoreOf(abilityQuestions, value.answers);
  const tolerance = scoreOf(toleranceQuestions, value.answers);
  const abilityDone = answeredAll(abilityQuestions, value.answers);
  const toleranceDone = answeredAll(toleranceQuestions, value.answers);
  const bands = { ability: abilityDone ? abilityBand(ability) : null, tolerance: toleranceDone ? toleranceBand(tolerance) : null };
  return {
    ability,
    tolerance,
    abilityAnswered: abilityQuestions.filter((one) => value.answers[one.id]).length,
    toleranceAnswered: toleranceQuestions.filter((one) => value.answers[one.id]).length,
    bands,
    profile: bands.ability && bands.tolerance ? profileFrom(bands.ability, bands.tolerance) : null,
  };
}

/** The profiles a client may prefer: the one worked out, or anything more conservative. */
export function noRiskierThan(profile: ThreeProfile | null): ThreeProfile[] {
  return profile ? PROFILES.slice(0, PROFILES.indexOf(profile) + 1) : [];
}

/**
 * The form with the profile that counts brought up to date: the one worked out where the client agrees, the one
 * they prefer where they do not. Every change goes through this, so what is saved always says which profile counts.
 */
export function settled(value: RiskQuestionnaire): RiskQuestionnaire {
  const worked = scored(value).profile;
  const preferred = value.preferredProfile && noRiskierThan(worked).includes(value.preferredProfile) ? value.preferredProfile : null;
  const chosenProfile = value.agrees === true ? worked : value.agrees === false ? preferred : null;
  return { ...value, version: QUESTIONNAIRE_VERSION, preferredProfile: value.agrees === false ? preferred : null, chosenProfile };
}

/** Whether the leverage notice applies: a client who intends to leverage and is not Aggressive. */
export function needsLeverageNotice(value: RiskQuestionnaire) {
  return value.intendsLeverage === true && value.chosenProfile !== "AGGRESSIVE";
}

const REQUIRED = "This is needed.";

function none(problems: Record<string, string>, prefix: string) {
  return !Object.keys(problems).some((key) => key.startsWith(prefix));
}

/** What is still missing, part by part. The API counts the same parts. */
export function reviewQuestionnaire(value: RiskQuestionnaire): FormReview {
  const problems: Record<string, string> = {};
  if (!value.customerName.trim()) problems["customerName"] = REQUIRED;
  for (const one of allClasses) {
    if (!value.knowledge[one.key]) problems[`knowledge.${one.key}`] = "Choose one.";
  }
  for (const question of allQuestions) {
    if (!value.answers[question.id]) problems[`answers.${question.id}`] = "Choose one.";
  }
  if (value.agrees === null) problems["agrees"] = "Say whether the client agrees.";
  else if (value.agrees === false && !value.preferredProfile) problems["preferredProfile"] = "Choose the profile the client prefers.";
  if (!value.declarationConfirmed) problems["declarationConfirmed"] = "The declaration has to be confirmed.";
  if (value.intendsLeverage === null) problems["intendsLeverage"] = "Say whether the client intends to use leverage.";
  if (needsLeverageNotice(value)) {
    if (value.leveragePurposes.length === 0) problems["leveragePurposes"] = "Tick what leverage will be used for.";
    if (value.leveragePurposes.includes("OTHER") && !value.leverageOther.trim()) problems["leverageOther"] = "Say what the other need is.";
    if (!value.leverageAcknowledged) problems["leverageAcknowledged"] = "The client has to acknowledge the notice.";
  }

  const ability = abilityQuestions.every((one) => none(problems, `answers.${one.id}`));
  const tolerance = toleranceQuestions.every((one) => none(problems, `answers.${one.id}`));
  const group = "Risk Profile Questionnaire";
  return {
    problems,
    steps: [
      { id: "customer", group, label: "The customer", complete: none(problems, "customerName") },
      { id: "knowledge", group, label: "I. Knowledge and experience", complete: none(problems, "knowledge.") },
      { id: "ability", group, label: "II. Risk Ability", complete: ability },
      { id: "tolerance", group, label: "II. Risk Tolerance", complete: tolerance },
      { id: "result", group, label: "The client's risk profile", complete: ability && tolerance },
      { id: "exclusions", group, label: "III–V. Exclusions and circumstances", complete: true },
      {
        id: "agreement",
        group: "Declarations",
        label: "VI. Agreeing the profile",
        complete: none(problems, "agrees") && none(problems, "preferredProfile") && none(problems, "declarationConfirmed"),
      },
      { id: "leverage", group: "Declarations", label: "VII. Leverage", complete: none(problems, "intendsLeverage") && none(problems, "leverage") },
    ],
  };
}

/** The part a field belongs to, so a message from the API opens the part that holds it. */
export function stepOfQuestionnaireField(field: string): string {
  if (field.startsWith("knowledge")) return "knowledge";
  if (abilityQuestions.some((one) => field === `answers.${one.id}`)) return "ability";
  if (field.startsWith("answers.")) return "tolerance";
  if (["excluded", "otherSectors", "circumstances"].some((key) => field.startsWith(key))) return "exclusions";
  if (["agrees", "preferredProfile", "declarationConfirmed", "chosenProfile"].some((key) => field.startsWith(key))) return "agreement";
  if (field.startsWith("intendsLeverage") || field.startsWith("leverage")) return "leverage";
  return "customer";
}

export const questionnaireGuidance: Record<string, string> = {
  "Risk Profile Questionnaire":
    "Please answer all the questions below as accurately as possible by choosing one of the options provided. The two parts are added up and banded, and the firm's matrix gives the client's risk profile.",
};

export const questionnaireDescriptions: Record<string, string> = {
  customer: "Who the risk profile is for.",
  knowledge: "Each product class, on one of four levels of knowledge and experience. Not scored.",
  ability: "Six questions on what the client can afford to put at risk, scored 10 to 50.",
  tolerance: "Five questions on how much risk the client is willing to take, scored 5 to 25.",
  result: "Both scores, their bands, and the profile the firm's matrix gives.",
  exclusions: "Countries and sectors the client does not wish to invest in, and any extenuating circumstances.",
  agreement: "Whether the client agrees with the profile, and the declaration.",
  leverage: "Whether the client intends to leverage their portfolio, and the notice where it applies.",
};
