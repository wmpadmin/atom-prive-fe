import { useCallback, useEffect, useState } from "react";

/**
 * How one reader likes the back office to behave, kept in their own browser.
 *
 * <p>Same reasoning as the theme and the table arrangements beside it: none of this is a fact about the
 * firm or the client. How long a date reads, how many rows fit on a screen, which page somebody wants to
 * open on — these are things about a person's eyes and their job, not records, and giving each one a
 * column, an endpoint and an approval would be a lot of machinery for a question only this browser ever
 * asks. The trade is the honest one: it follows them on this machine and not to another.
 *
 * <p>Everything here is read through a try/catch, because a private window or blocked site data must give
 * a working screen rather than a broken one — it just starts from the firm's own defaults each time.
 */

export type DateFormat = "medium" | "dmy" | "mdy" | "iso";

export type TimeFormat = "24" | "12";

export type Density = "comfortable" | "compact";

export type Preferences = {
  /** Where a reader wants to land when they sign in. A path, or "home" for the role's own home screen. */
  landing: string;
  /** How many rows a table starts with. One of {@link PAGE_SIZES}. */
  pageSize: number;
  dateFormat: DateFormat;
  timeFormat: TimeFormat;
  density: Density;
  /** How wide the reader has drawn the sidebar, in pixels. Held between {@link SIDEBAR_NARROWEST} and
   * {@link SIDEBAR_WIDEST}, because a sidebar dragged to nothing cannot be dragged back. */
  sidebarWidth: number;
  /** Whether the reader has put the sidebar away. The width is remembered separately, so bringing it
   * back brings it back the width they had it. */
  sidebarAway: boolean;
};

/** The sidebar at its narrowest still shows a label; at its widest it still leaves the page the most room. */
export const SIDEBAR_NARROWEST = 200;

export const SIDEBAR_WIDEST = 420;

/** What it has always been: w-64, which is 16rem. */
export const SIDEBAR_DEFAULT = 256;

export const DEFAULTS: Preferences = {
  landing: "home",
  pageSize: 10,
  dateFormat: "medium",
  timeFormat: "24",
  density: "comfortable",
  sidebarWidth: SIDEBAR_DEFAULT,
  sidebarAway: false,
};

const KEY = "atomprive.preferences";

/** Raised when a change would make an old stored value mean something different. */
const SHAPE = 1;

/**
 * A width this build can actually draw.
 *
 * <p>Anything unrecognised is the default rather than an error, as with every other value here — but a
 * number is clamped rather than dropped, because somebody who dragged the sidebar wide on a large screen
 * and then opened the same account on a laptop meant "wide", and the nearest width this screen can give
 * them is nearer their intent than starting over.
 */
function withinReach(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULTS.sidebarWidth;
  }
  return Math.min(Math.max(Math.round(value), SIDEBAR_NARROWEST), SIDEBAR_WIDEST);
}

function where() {
  return `${KEY}.v${SHAPE}`;
}

/**
 * What is on file, with anything unrecognised dropped rather than trusted.
 *
 * <p>A value written by an older build, a half-finished write, somebody editing their own storage: all the
 * same answer, which is the default. Nothing here is important enough to be worth a thrown error.
 */
export function readPreferences(): Preferences {
  try {
    const held = localStorage.getItem(where());
    if (!held) return DEFAULTS;
    const parsed = JSON.parse(held) as Partial<Preferences>;
    return {
      landing: typeof parsed.landing === "string" ? parsed.landing : DEFAULTS.landing,
      sidebarWidth: withinReach(parsed.sidebarWidth),
      sidebarAway: typeof parsed.sidebarAway === "boolean" ? parsed.sidebarAway : DEFAULTS.sidebarAway,
      pageSize: PAGE_CHOICES.includes(parsed.pageSize as number) ? (parsed.pageSize as number) : DEFAULTS.pageSize,
      dateFormat: DATE_CHOICES.includes(parsed.dateFormat as DateFormat)
        ? (parsed.dateFormat as DateFormat)
        : DEFAULTS.dateFormat,
      timeFormat: parsed.timeFormat === "12" ? "12" : DEFAULTS.timeFormat,
      density: parsed.density === "compact" ? "compact" : DEFAULTS.density,
    };
  } catch {
    return DEFAULTS;
  }
}

const PAGE_CHOICES: number[] = [10, 25, 50];

const DATE_CHOICES: DateFormat[] = ["medium", "dmy", "mdy", "iso"];

/**
 * Tells the page which density is in force, so the stylesheet can read it the way it reads the theme.
 *
 * <p>Set on the root element rather than passed down, because it has to reach a table nine components deep
 * without every component in between having to know about it.
 */
export function applyDensity(density: Density) {
  document.documentElement.dataset.density = density;
}

/**
 * Anybody who wants to know what one preference is right now, outside a component.
 *
 * <p>The date formatters and the tables' starting size are read at the moment they are used rather than
 * subscribed to, which means a change shows as the reader moves around the platform rather than redrawing
 * every mounted screen under them. For a setting somebody changes once that is the right trade; keeping
 * fifteen tables subscribed to a value that changes twice a year is not.
 */
export function preference<K extends keyof Preferences>(which: K): Preferences[K] {
  return readPreferences()[which];
}

/** The signed-in person's preferences, and the one way to change them. */
export function usePreferences() {
  const [preferences, setPreferences] = useState<Preferences>(readPreferences);

  useEffect(() => {
    applyDensity(preferences.density);
  }, [preferences.density]);

  const change = useCallback(<K extends keyof Preferences>(which: K, to: Preferences[K]) => {
    setPreferences((held) => {
      const next = { ...held, [which]: to };
      try {
        localStorage.setItem(where(), JSON.stringify(next));
      } catch {
        // Nothing to tell them: the setting takes effect, it just will not be remembered next time.
      }
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setPreferences(DEFAULTS);
    try {
      localStorage.removeItem(where());
    } catch {
      // As above.
    }
  }, []);

  return { preferences, change, reset };
}
