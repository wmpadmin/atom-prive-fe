import type { FormDetailAnswers } from "@atomprive/api-client/backoffice";
import type { FormReview } from "./account-opening-entity";

/**
 * The Investment Risk Profile form (IRP): the scored questionnaire that sets the client's risk category.
 *
 * Every question and every answer here is the form's own, word for word. What the screen does that the paper
 * can't is the arithmetic: the form prints a score beside each answer and a band table at the bottom, and
 * leaves whoever holds the pen to add up thirteen numbers and look up the band. Here the total and the profile
 * it lands in are worked out as the answers are given, and the client can still choose a more conservative
 * profile than the one derived — which is the only direction the form allows.
 */

export type Profile = "CONSERVATIVE" | "MODERATE" | "BALANCE" | "GROWTH" | "AGGRESSIVE";

export type Experience = "YES" | "NO";

export type Knowledge = "LIMITED" | "MODERATE" | "GOOD";

export interface RiskOption {
  value: string;
  text: string;
  /** What the form prints in the Score column beside it. Two of its questions carry no score. */
  score?: number;
}

export interface RiskQuestion {
  id: string;
  number: string;
  heading: string;
  /** The line the form asks under the heading. */
  ask?: string;
  options: RiskOption[];
  /** What the form prints under the question, by way of explanation. */
  notes?: string[];
}

/** 5. The form sets these out as a grid: a column per scenario, a row per figure. */
export interface RiskScenario {
  value: string;
  label: string;
  targetReturn: string;
  rangeOfReturns: string;
  score: number;
}

export const scenarioRows = {
  target: "Target annual return over the long run",
  range: "Range of annual returns under normal market circumstances",
};

export const riskScenarios: RiskScenario[] = [
  { value: "A", label: "Scenario A", targetReturn: "1%", rangeOfReturns: "-3% to 7%", score: 1 },
  { value: "B", label: "Scenario B", targetReturn: "2% to 3%", rangeOfReturns: "-7% to 12%", score: 2 },
  { value: "C", label: "Scenario C", targetReturn: "4% to 5%", rangeOfReturns: "-12% to 25%", score: 3 },
  { value: "D", label: "Scenario D", targetReturn: "6% to 7%", rangeOfReturns: "-27% to 36%", score: 4 },
  { value: "E", label: "Scenario E", targetReturn: ">7%", rangeOfReturns: "-40% to 50%", score: 5 },
];

export const riskQuestions: RiskQuestion[] = [
  {
    id: "q1",
    number: "1.",
    heading: "Investment Objectives :",
    ask: "Which answer best describes your investment objective:",
    options: [
      { value: "a", text: "a. Primarily Capital preservation" },
      { value: "b", text: "b. Primarily income generation along with slight capital growth" },
      { value: "c", text: "c. To achieve a balance of income generation and capital growth" },
      { value: "d", text: "d. Primarily capital growth along with slight income generation" },
      { value: "e", text: "e. Primarily high capital growth" },
    ],
  },
  {
    id: "q2",
    number: "2.",
    heading: "Investment stage and ability",
    ask: "Which of the following best describes your current stage of life?",
    options: [
      {
        value: "a",
        text: "a. Single with few financial burdens. Ready to accumulate wealth for future short term and long term goals.",
        score: 5,
      },
      {
        value: "b",
        text: "b. A couple without children. Preparing for the future by establishing a home. Expecting to have or already have a high purchase rate of household and consumer items.",
        score: 3,
      },
      {
        value: "c",
        text: "c. Young family with a home. You have a mortgage and childcare costs and maintain only small cash balances.",
        score: 1,
      },
      {
        value: "d",
        text: "d. Mature family. You are in your peak earning years and your mortgage is under control. You’re ready to start thinking about your retirement years",
        score: 5,
      },
      {
        value: "e",
        text: "e. Preparing for retirement. You own your home and have few financial burdens; you want to ensure you can afford a comfortable retirement.",
        score: 3,
      },
      {
        value: "f",
        text: "f. Retired. You rely on existing funds and investments to maintain your lifestyle in retirement. You may already be receiving a Government pension and/or Superannuation pension.",
        score: 1,
      },
    ],
  },
  {
    id: "q4",
    number: "4.",
    heading: "Response to Market Decline",
    ask: "During market declines, I tend to sell portions of my riskier assets and invest the money in safer assets.",
    options: [
      { value: "a", text: "a. Strongly disagree", score: 5 },
      { value: "b", text: "b. Disagree", score: 4 },
      { value: "c", text: "c. Somewhat agree.", score: 3 },
      { value: "d", text: "d. Agree", score: 2 },
      { value: "e", text: "e. Strongly Agree", score: 1 },
    ],
  },
  {
    id: "q6",
    number: "6.",
    heading: "Volatility of Returns",
    ask: "Considering your time horizon (holding period) and return expectations, what degree of volatility of return do you believe you can accept ?",
    options: [
      { value: "a", text: "a. I can accept a low degree of volatility", score: 1 },
      { value: "b", text: "b. I can accept a moderate degree of volatility", score: 2 },
      { value: "c", text: "c. I can accept a moderate to high degree of volatility", score: 3 },
      { value: "d", text: "d. I can accept a high degree of volatility", score: 4 },
    ],
  },
  {
    id: "q7",
    number: "7.",
    heading: "Assets under Advice",
    ask: "What % of the assets is under the Firm’s advisory, compared to total Net-Worth ?",
    options: [
      { value: "a", text: "a. 1%-10%.", score: 1 },
      { value: "b", text: "b. 10%-40%", score: 2 },
      { value: "c", text: "c. 40%-70%", score: 3 },
      { value: "d", text: "d. >70%", score: 4 },
    ],
  },
  {
    id: "q8",
    number: "8.",
    heading: "Investment Time Horizon",
    ask: "How long would you invest the majority of your money before you think you would need access to it? (Assuming you already have plans in place to meet short term cash flow and/or emergencies.)",
    options: [
      { value: "a", text: "a. Upto 1 year", score: 1 },
      { value: "b", text: "b. More than 1 year and upto 4 years", score: 2 },
      { value: "c", text: "c. More than 4 years and upto 10 years", score: 3 },
      { value: "d", text: "d. More than 10 years or we have no time commitments.", score: 4 },
    ],
    notes: [
      "The investment time horizon refers to the length of the time one expects to hold one’s portfolio invested, without needing the money for other purposes. With a longer investment time horizon, one can generally afford to invest in instruments which have a higher risk rating, as there will be a longer time line to ride out volatility. Conversely, the shorter the investment time horizon, the more vulnerable to market fluctuations are the investments in one’s portfolio.",
    ],
  },
  {
    id: "q9",
    number: "9.",
    heading: "Liquidity preference",
    ask: "What % of your asset would you expect to withdraw to meet other financial needs within the coming 1 year?",
    options: [
      { value: "a", text: "a. More than 75%", score: 1 },
      { value: "b", text: "b. Between 51% to 75%", score: 2 },
      { value: "c", text: "c. Between 25% to 50%", score: 3 },
      { value: "d", text: "d. Less than 25%", score: 4 },
    ],
  },
  {
    id: "q10",
    number: "10.",
    heading: "Stability of Income",
    ask: "How secure is your current and future income from existing sources?",
    options: [
      { value: "a", text: "a. No or insignificant net income", score: 1 },
      { value: "b", text: "b. High volatility and fluctuation of income – Income levels are not stable", score: 2 },
      {
        value: "c",
        text: "c. Secure income with low volatility at the moment with some uncertainty for the future - Mostly stable",
        score: 3,
      },
      { value: "d", text: "d. Long term secured income flows from various sources - Very stable", score: 4 },
    ],
  },
  {
    id: "q11",
    number: "11.",
    heading: "Financial situation",
    ask: "What % of total financial assets is not required to be used for investment (not used for any anticipated liabilities)?",
    options: [
      { value: "a", text: "a. Less than 25%", score: 1 },
      { value: "b", text: "b. Between 25% to 50%", score: 2 },
      { value: "c", text: "c. Between 51% to 75%", score: 3 },
      { value: "d", text: "d. More than 75%", score: 4 },
    ],
  },
  {
    id: "q12",
    number: "12.",
    heading: "Leverage in investment",
    ask: "Do you currently use or intend to use leverage when investing?",
    options: [
      { value: "a", text: "a. No", score: 1 },
      { value: "b", text: "b. Yes", score: 2 },
    ],
    notes: [
      "In leveraging, you must invest the proceeds of borrowed money and thus, has investment risks. It magnifies investment gains and losses in particular when markets are volatile. As a result of this magnification effect, using leverage for investment purposes carries a greater risk of loss than purchasing investments with cash and may also lead to losses that substantially exceed the original capital amount invested. It also has cash flow risk, interest rate risk and margin call risk.",
    ],
  },
  {
    id: "q13",
    number: "13.",
    heading: "What % of total wealth are liquid bankable assets?",
    options: [
      { value: "a", text: "a. <15%", score: 1 },
      { value: "b", text: "b. 15%-50%", score: 2 },
      { value: "c", text: "c. >50%", score: 3 },
    ],
  },
];

/** 5. Risk tolerance, capital loss and market fluctuation. */
export const riskToleranceQuestion = {
  id: "q5",
  number: "5.",
  heading: "Risk tolerance, capital loss and market fluctuation",
  ask: "Which of the following 5 hypothetical scenarios below best describes the level of risk you are willing to bear in respect of your investments?",
  notes: [
    "Risk tolerance is the degree of variability in investment returns that an investor is willing to withstand. Risk tolerance is an important component in investing. Please bear in mind that the opportunity to make higher returns typically requires a higher ability and willingness to assume a greater amount of risk, which in turn increases the possibility of losses.",
    "In an unfortunate event, the scenarios in D and E may result in complete capital erosion and are also expected to use leverage in investment.",
  ],
};

/** 3. Product knowledge and experience, as the form lists the products by product type. */
export const productTypes: { type: string; products: string[] }[] = [
  { type: "1", products: ["Deposits", "Money market instruments", "Foreign Exchange (Spot)"] },
  {
    type: "2",
    products: [
      "Government bonds",
      "Plain vanilla investment grade bonds",
      "Investment grade bond funds / exchange traded funds",
    ],
  },
  {
    type: "3",
    products: [
      "Equities / Preferred Shares",
      "Equity funds, exchange traded funds / high yield bond funds",
      "Othercorporatebonds",
    ],
  },
  {
    type: "4",
    products: [
      "Plain vanilla options",
      "Dual currency investments",
      "Structured Notes",
      "Non-investment grade bonds",
      "Bonds with special features",
    ],
  },
  {
    type: "5",
    products: [
      "Private Equity Funds",
      "Hedge funds",
      "Accumulators and Decumulators",
      "Exotic options",
      "Forwards / Warrants / Swaps",
      "Interest Rate Swaps",
    ],
  },
];

export const experienceHeading = "Experience in the past 3 years with any financial institution";

export const knowledgeHeading = "Knowledge\n(relevant education or investment experience)";

export const experienceLabels: Record<Experience, string> = { YES: "Yes", NO: "No" };

export const knowledgeLabels: Record<Knowledge, string> = {
  LIMITED: "Limited",
  MODERATE: "Moderate",
  GOOD: "Good",
};

/** 14. Assessment of knowledge and experience, (a) to (g) as the form letters them. */
export const assessmentMatters: { value: string; text: string }[] = [
  {
    value: "a",
    text: "(a) the Person’s knowledge and understanding of the relevant financial markets, types of financial products or arrangements and the risks involved either generally or in relation to a proposed Transaction.",
  },
  {
    value: "b",
    text: "(b) the length of time the Person has participated in relevant financial markets, the frequency of dealings and the extent to which the Person has relied on professional financial advice;",
  },
  {
    value: "c",
    text: "(c) the size and nature of transactions that have been undertaken by, or on behalf of, the Person in relevant financial markets;",
  },
  { value: "d", text: "(d) the Person’s relevant qualifications relating to financial markets;" },
  { value: "e", text: "(e) the composition and size of the Person’s existing financial investment portfolio;" },
  {
    value: "f",
    text: "(f) in the case of credit or insurance transactions, relevant experience in relation to similar transactions to be able to understand the risks associated with such transactions; and",
  },
  { value: "g", text: "(g) any other matters which the Firm considers relevant." },
];

/** The bands the form prints under Investment Risk Rating, and what each profile means. */
export const profiles: { value: Profile; label: string; band: string; means: string }[] = [
  {
    value: "CONSERVATIVE",
    label: "Conservative",
    band: "<12",
    means: "Capital Protection\nLow fluctuations in the value of your investment Capital.",
  },
  {
    value: "MODERATE",
    label: "Moderate",
    band: "13-19",
    means: "Consistent income stream\nLow fluctuation in the value of your investment Capital.",
  },
  {
    value: "BALANCE",
    label: "Balance",
    band: "20-26",
    means: "Able to accept occasional short-term losses for potential positive returns.\nModerate fluctuations in the value of your investment Capital.",
  },
  {
    value: "GROWTH",
    label: "Growth",
    band: "27-32",
    means: "Able to accept some investment risk for potentially higher returns for capital growth\nHigh fluctuations in the value of your investment Capital.",
  },
  {
    value: "AGGRESSIVE",
    label: "Aggressive",
    band: ">32",
    means: "Able to accept a significant risk, including the possible loss of principal for the potential to maximise long-term returns\nSignificant fluctuation in the value of your investment Capital.",
  },
];

export const riskProfileNotes = {
  intro:
    "The information contained in this Investment Risk Profile form will be the basis on which any investment information or recommendations shall be made to you. Any inaccurate or incomplete information may affect the suitability of such information or recommendation. It is strongly recommended that you provide such information required by this IRP as fully as possible and any future changes in circumstances or information contained within this IRP should be advised as soon as possible in order to ensure the continued suitability of investment information or recommendations provided to you.",
  derived: "Based on the inputs given above, your risk rating as below:",
  lower:
    "Your chosen investment profile is recorded above. In case you would like to choose a lower profile which is in line with your current requirements and risk appetite, please notify your relationship manager. Please note that you can only choose an alternative investment profile that is more conservative than that indicated above.",
  confirmation: [
    "I/We acknowledge that the information stated in this application form is true and correct and have duly verified the same. I/WE hereby acknowledge that the investment profile in section above is consistent with my / our investment risk tolerance requirement and investment objectives.",
    "I/We declare that I/We have understood and answered all the questions in the above application. I/ We undertake to notify {{firmName}}(\"the Company\") of any change in the information with respect to any material aspects impacting my risk profile.",
  ],
  relationshipManager:
    "I, hereby declare that I have explained the contents of the Risk profiling form to customers. I have read out the answers to the above mentioned questions to the clients. I declare that whatever I have stated herein above is true and correct to the best of my knowledge & belief. I further confirm that I have assessed the investment objectives and risk profile of the applicant as stated above and conclude that the overall risk profile mentioned above is correct. I have also assessed any associated risks and recommend that the clients be classified as a Professional client (s) (as defined by the DFSA rules).",
};

/** One line of a sign-off block: the name, and the Date and Sign off the form rules beside it. */
export interface SignOff {
  name: string;
  signedOn: string;
  signOff: string;
}

export interface InvestmentRiskProfileEntity {
  customerName: string;
  /** The answer to each numbered question, by the letter the form prints beside it. */
  answers: Record<string, string>;
  /** Product knowledge and experience, by the product's own name. */
  products: Record<string, { experience: Experience | null; knowledge: Knowledge | null }>;
  /** 14. What the firm makes of each of the matters (a) to (g). */
  assessment: Record<string, string>;
  /** The rating ticked under Investment Risk Rating, which the score the answers come to points at. */
  ratingProfile: Profile | null;
  /** The profile the client chooses, which the form allows to be more conservative than the rating. */
  chosenProfile: Profile | null;
  acknowledgement: {
    confirmed: boolean;
    accountHolders: SignOff[];
    authorisedIndividuals: SignOff[];
    relationshipManager: SignOff;
  };
}

export function emptySignOff(): SignOff {
  return { name: "", signedOn: "", signOff: "" };
}

export function emptyRiskProfile(): InvestmentRiskProfileEntity {
  return {
    customerName: "",
    answers: {},
    products: {},
    assessment: {},
    ratingProfile: null,
    chosenProfile: null,
    acknowledgement: {
      confirmed: false,
      accountHolders: [emptySignOff()],
      authorisedIndividuals: [],
      relationshipManager: emptySignOff(),
    },
  };
}

/** What the API holds, filled out to the whole form so every question has something to answer. */
export function toRiskProfile(saved: FormDetailAnswers | undefined): InvestmentRiskProfileEntity {
  const empty = emptyRiskProfile();
  if (!saved) return empty;
  const held = saved as Partial<InvestmentRiskProfileEntity>;
  const acknowledgement = held.acknowledgement;
  return {
    customerName: held.customerName ?? "",
    answers: { ...held.answers },
    products: { ...held.products },
    assessment: { ...held.assessment },
    ratingProfile: held.ratingProfile ?? null,
    chosenProfile: held.chosenProfile ?? null,
    acknowledgement: {
      ...empty.acknowledgement,
      ...acknowledgement,
      accountHolders:
        acknowledgement?.accountHolders && acknowledgement.accountHolders.length > 0
          ? acknowledgement.accountHolders
          : empty.acknowledgement.accountHolders,
      authorisedIndividuals: acknowledgement?.authorisedIndividuals ?? [],
      relationshipManager: { ...emptySignOff(), ...acknowledgement?.relationshipManager },
    },
  };
}

/** Every question that carries a score, in the order the form asks them. */
export const scoredQuestions = ["q2", "q4", "q5", "q6", "q7", "q8", "q9", "q10", "q11", "q12", "q13"];

/** The total the form's Score column adds up to, from the answers given so far. */
export function scoreOf(value: InvestmentRiskProfileEntity) {
  let total = 0;
  for (const question of riskQuestions) {
    const answer = value.answers[question.id];
    const option = question.options.find((one) => one.value === answer);
    total += option?.score ?? 0;
  }
  const scenario = riskScenarios.find((one) => one.value === value.answers["q5"]);
  return total + (scenario?.score ?? 0);
}

/**
 * The band the total lands in. The form prints its bands as "<12", "13-19", "20-26", "27-32" and ">32", which
 * leaves 12 itself between two of them; a total of 12 is treated as the lower band, Conservative.
 */
export function profileOf(score: number): Profile {
  if (score <= 12) return "CONSERVATIVE";
  if (score <= 19) return "MODERATE";
  if (score <= 26) return "BALANCE";
  if (score <= 32) return "GROWTH";
  return "AGGRESSIVE";
}

/** The profile derived from the answers, once every scored question has one. */
export function derivedProfile(value: InvestmentRiskProfileEntity): Profile | null {
  const answered = scoredQuestions.every((id) => Boolean(value.answers[id]));
  return answered ? profileOf(scoreOf(value)) : null;
}

const ORDER: Profile[] = ["CONSERVATIVE", "MODERATE", "BALANCE", "GROWTH", "AGGRESSIVE"];

/** The form allows an alternative profile only if it is more conservative than the one derived. */
export function noMoreThan(derived: Profile | null): Profile[] {
  if (!derived) return [];
  return ORDER.slice(0, ORDER.indexOf(derived) + 1);
}

/** Every product the form lists, in the order it lists them. */
export const allProducts = productTypes.flatMap((group) => group.products);

const REQUIRED = "This is needed.";

function none(problems: Record<string, string>, prefix: string) {
  return !Object.keys(problems).some((key) => key.startsWith(prefix));
}

/** What is still missing. The API checks the same things on submit. */
export function reviewRiskProfile(value: InvestmentRiskProfileEntity): FormReview {
  const problems: Record<string, string> = {};
  if (!value.customerName.trim()) problems["customerName"] = REQUIRED;

  for (const question of [...riskQuestions, riskToleranceQuestion]) {
    if (!value.answers[question.id]) problems[`answers.${question.id}`] = "Choose one.";
  }
  for (const product of allProducts) {
    const held = value.products[product];
    if (!held?.experience) problems[`products.${product}.experience`] = "Say yes or no.";
    if (!held?.knowledge) problems[`products.${product}.knowledge`] = "Choose one.";
  }
  for (const matter of assessmentMatters) {
    if (!value.assessment[matter.value]?.trim()) problems[`assessment.${matter.value}`] = REQUIRED;
  }

  const derived = derivedProfile(value);
  if (!value.ratingProfile) problems["ratingProfile"] = "Tick the rating the score comes to.";
  // The form allows an alternative only where it is more conservative than the rating indicated above.
  const ceiling = value.ratingProfile ?? derived;
  if (!value.chosenProfile) {
    problems["chosenProfile"] = "Record the profile the client is on.";
  } else if (ceiling && !noMoreThan(ceiling).includes(value.chosenProfile)) {
    problems["chosenProfile"] = "Only a profile more conservative than that indicated above can be chosen.";
  }

  const { acknowledgement } = value;
  if (!acknowledgement.confirmed) problems["acknowledgement.confirmed"] = "The confirmation has to be made.";
  const named = [...acknowledgement.accountHolders, ...acknowledgement.authorisedIndividuals].filter((one) =>
    one.name.trim(),
  );
  if (named.length === 0) problems["acknowledgement.signOff"] = "Name whoever signs off.";
  // Each line the form rules carries a Date beside the name. The sign off is the client's own, made once the
  // form reaches them, so it is not what makes the form ready to send.
  for (const signer of named) {
    if (!signer.signedOn) {
      problems["acknowledgement.signOff"] = "Give the date beside each name.";
    }
  }
  const manager = acknowledgement.relationshipManager;
  if (!manager.name.trim()) problems["acknowledgement.relationshipManager.name"] = REQUIRED;
  if (!manager.signedOn) problems["acknowledgement.relationshipManager.signedOn"] = "Choose a date.";
  if (!manager.signOff.trim()) problems["acknowledgement.relationshipManager.signOff"] = REQUIRED;

  return {
    problems,
    steps: [
      { id: "customer", group: "Risk Profiling Questionnaire", label: "The customer", complete: none(problems, "customerName") },
      {
        id: "objectives",
        group: "Risk Profiling Questionnaire",
        label: "Objectives and stage of life",
        complete: none(problems, "answers.q1") && none(problems, "answers.q2"),
      },
      {
        id: "knowledge",
        group: "Risk Profiling Questionnaire",
        label: "Product knowledge and experience",
        complete: none(problems, "products."),
      },
      {
        id: "attitude",
        group: "Risk Profiling Questionnaire",
        label: "Risk tolerance",
        complete: none(problems, "answers.q4") && none(problems, "answers.q5") && none(problems, "answers.q6"),
      },
      {
        id: "capacity",
        group: "Risk Profiling Questionnaire",
        label: "Financial situation",
        complete: ["q7", "q8", "q9", "q10", "q11", "q12", "q13"].every((id) => none(problems, `answers.${id}`)),
      },
      {
        id: "rating",
        group: "Investment Risk Rating",
        label: "Rating and assessment",
        complete: none(problems, "assessment.") && none(problems, "ratingProfile"),
      },
      {
        id: "acknowledgement",
        group: "Acknowledgement",
        label: "Acknowledgement and sign off",
        complete: none(problems, "acknowledgement.") && none(problems, "chosenProfile"),
      },
    ],
  };
}

/** The part a field belongs to, so a message from the API opens the part that holds it. */
export function stepOfRiskProfileField(field: string): string {
  if (field.startsWith("products")) return "knowledge";
  if (field.startsWith("assessment") || field.startsWith("ratingProfile")) return "rating";
  if (field.startsWith("acknowledgement") || field.startsWith("chosenProfile")) return "acknowledgement";
  if (field.startsWith("answers.q1") || field.startsWith("answers.q2")) return "objectives";
  if (["q4", "q5", "q6"].some((id) => field.startsWith(`answers.${id}`))) return "attitude";
  if (field.startsWith("answers.")) return "capacity";
  return "customer";
}

export const riskProfileGuidance: Record<string, string> = {
  "Risk Profiling Questionnaire": riskProfileNotes.intro,
};

export const riskProfileDescriptions: Record<string, string> = {
  customer: "Who the Investment Risk Profile is for.",
  objectives: "1. Investment Objectives, and 2. Investment stage and ability.",
  knowledge: "3. Product knowledge and experience, for each product the form lists.",
  attitude: "4. Response to Market Decline, 5. Risk tolerance, and 6. Volatility of Returns.",
  capacity: "7. to 13., on what the client can afford to put at risk.",
  rating: "Investment Risk Rating, and 14. Assessment of knowledge and experience.",
  acknowledgement: "Acknowledgement for Investment Risk Profiling, and who signs off.",
};
