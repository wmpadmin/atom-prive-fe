/**
 * Showing one meeting's worth of the platform at a time.
 *
 * <p>The whole back-office is thirty-odd screens across portfolio work, client onboarding, compliance and
 * administration. Shown to somebody who has come to hear about one of those, the other three are not
 * context — they are a menu of things that will not be talked about, read by somebody wondering which of
 * them they were supposed to be looking at.
 *
 * <p>So the menu can be cut down to one session's screens for as long as that session lasts. It is asked
 * for in the address and remembered, because a demo is given from a browser somebody has already got open
 * and a console is not a thing to be typing into in front of an audience:
 *
 * <pre>
 *   /portfolio-clients?demo=1   the first session's screens, and nothing else
 *   /portfolio-clients?demo=off everything back
 * </pre>
 *
 * <p>Nothing is shown or hidden unless somebody has asked. Asked for nothing, this hands back null and the
 * menu is drawn exactly as it was — which is what every other reader of the app gets, and what this is
 * when nobody is demoing anything.
 */

/** Which session. */
export type Demo = "1" | "2" | "3";

/**
 * The session being shown while the firm is demoing, with nothing in the address asking for one.
 *
 * <p>THIS IS THE ONE LINE TO CHANGE. Set it to null when the demos are over and the menu goes back to
 * being the whole menu for everybody. Set it to "2" or "3" to walk through one of the other sessions.
 *
 * <p>It is a default rather than something asked for because a demo is given from whatever browser is in
 * front of the room — a borrowed laptop, a screen share, a window reopened after it went to sleep — and
 * a sidebar that depends on somebody having typed a query string once is a sidebar that comes back wrong
 * at the worst moment.
 */
const WHILE_DEMOING: Demo | null = "1";

/** Remembered between pages, because a demo walks through several and the address is not retyped. */
const KEPT = "atomprive.demo";

/**
 * A session: what it is called, and the screens it is about, in the order they are walked through.
 *
 * <p>Where only some of them are being shown, the rest are still listed. A session cut to the screens
 * somebody has time for leaves the room looking at four items and no way to tell that the story has a
 * beginning and an end they are not seeing — which is the question that arrives mid-sentence.
 */
export type Meeting = {
  title: string;
  routes: string[];
  /** The ones being walked through. Everything else in routes is drawn and goes nowhere. Absent: all of them. */
  live?: string[];
};

export const MEETINGS: Record<Demo, Meeting> = {
  /**
   * Managing money against a plan: the firm writes one down, puts clients on it, watches them wander off
   * it, and puts them back.
   *
   * <p>Four screens, which is what the firm asked for. The data-flow story is eleven — the bands and
   * trading rules that decide what counts as a breach come first, and the blotter, model changes,
   * performance, risk, reports and dashboard after it are all reads of what these four wrote. Shown as
   * four, two things are taken on trust: where the breach threshold came from, and where the orders went.
   */
  "1": {
    title: "Portfolio management",
    // The four being shown first, then the rest of the story: the bands and trading rules that decide
    // what counts as a breach, where the orders raised by a rebalance go, the other answer to drift, what
    // the plans themselves did, and the reads of all of it.
    routes: ["/portfolio-clients", "/model-portfolios", "/drift", "/bulk-rebalancing",
      "/portfolio-settings", "/trade-orders", "/model-changes", "/model-performance", "/model-risk",
      "/reports", "/dashboard"],
    live: ["/portfolio-clients", "/model-portfolios", "/drift", "/bulk-rebalancing"],
  },
  /**
   * Running the platform. Two roots that need no data at all — the firm's reference data and the
   * permission matrix — and everything that grows straight out of them: bank feeds and their failures,
   * staff accounts, the declarations those accounts owe, the mail that chases them, and the log that
   * records the lot.
   *
   * <p>The only session that can be shown on an empty system, which is why it comes before the client
   * journey: that one borrows this one's staff accounts and mail templates, so the dependencies point
   * backwards rather than forwards.
   */
  "2": {
    title: "Running the platform",
    routes: ["/config", "/ingestion", "/sync-errors", "/roles", "/users", "/settings",
      "/my-declarations", "/staff-declarations", "/staff-tracker", "/notifications", "/audit-log"],
  },
  /**
   * One client from an empty form pack to a piece of advice signed off and sent, in the order the firm
   * actually does it: the checklist, the case, the advisor, the signatures, the papers, the KYC decision,
   * the welcome pack, then the proposal and its sign-off. It ends on the two trails, which read back the
   * activity the session has just made.
   */
  "3": {
    title: "Onboarding to signed advice",
    routes: ["/forms", "/onboarding", "/clients", "/my-clients", "/to-sign", "/client-documents",
      "/kyc-documents", "/kyc", "/post-onboarding", "/proposals", "/manager-review",
      "/proposal-trail", "/family-access"],
  },
};

function isDemo(said: string | null): said is Demo {
  return said === "1" || said === "2" || said === "3";
}

/**
 * Which session is in force, having first taken anything the address has to say about it.
 *
 * <p>Reading the address and writing down what it said are one step on purpose. A demo is walked through
 * by clicking, and every click after the first loses the query it arrived with — asked once, it has to
 * hold for the rest of the sitting.
 *
 * <p>A session with no screens against it is not in force: the honest answer is the menu as it stands
 * rather than a session that turns out to be two items long.
 */
export function demoInForce(search: string): Demo | null {
  let said: string | null = null;
  try {
    const asked = new URLSearchParams(search).get("demo");
    if (asked === "off") {
      window.localStorage.removeItem(KEPT);
      return null;
    }
    if (isDemo(asked)) {
      window.localStorage.setItem(KEPT, asked);
    }
    said = isDemo(asked) ? asked : window.localStorage.getItem(KEPT) ?? WHILE_DEMOING;
  }
  catch {
    // A browser that will not keep anything — a private window, blocked site data — still has to draw a
    // menu. Whatever the address said holds for this page and no further.
    said = new URLSearchParams(search).get("demo") ?? WHILE_DEMOING;
  }
  if (!isDemo(said)) return null;
  return MEETINGS[said].routes.length > 0 ? said : null;
}

/**
 * The session being shown, and which of its screens are a way in.
 *
 * <p>One session, not three. All three were drawn once, the other two greyed, so the room could see the
 * whole platform — and a sidebar of twenty-eight items, twenty-four of them dead, is a wall to read
 * rather than a map. The story being told has its own beginning and end, and that is the shape worth
 * showing.
 */
export function sessionShown(inForce: Demo) {
  const meeting = MEETINGS[inForce];
  const live = meeting.live ?? meeting.routes;
  return {
    key: inForce,
    title: meeting.title,
    routes: meeting.routes,
    isLive: (route: string) => live.includes(route),
  };
}
