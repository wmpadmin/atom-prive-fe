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

/** Remembered between pages, because a demo walks through several and the address is not retyped. */
const KEPT = "atomprive.demo";

/** A session: what it is called, and the screens it is about, in the order they are walked through. */
export type Meeting = { title: string; routes: string[] };

export const MEETINGS: Record<Demo, Meeting> = {
  /**
   * Managing money against a plan. The one the firm asked to see first: a client's book, the plans it is
   * measured against, what has drifted out of them, and putting several back at once.
   */
  "1": {
    title: "Portfolio management",
    routes: ["/portfolio-clients", "/model-portfolios", "/drift", "/bulk-rebalancing"],
  },
  /** Filled in once the screens have been grouped. Until then it shows the whole menu rather than a guess. */
  "2": { title: "", routes: [] },
  "3": { title: "", routes: [] },
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
 * <p>A session with no screens against it is not in force. The second and third are empty until somebody
 * has decided what is in them, and the honest answer in the meantime is the menu as it stands rather than
 * a session that turns out to be two items long.
 */
export function demoInForce(search: string): Meeting | null {
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
    said = isDemo(asked) ? asked : window.localStorage.getItem(KEPT);
  }
  catch {
    // A browser that will not keep anything — a private window, blocked site data — still has to draw a
    // menu. Whatever the address said holds for this page and no further.
    said = new URLSearchParams(search).get("demo");
  }
  if (!isDemo(said)) return null;
  const meeting = MEETINGS[said];
  return meeting.routes.length > 0 ? meeting : null;
}
