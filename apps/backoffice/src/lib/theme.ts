import { useCallback, useEffect, useState } from "react";

/** What somebody asked for: light or dark. Light until they choose; "follow my machine" was taken away on 18 Nov 2026. */
export type ThemePreference = "light" | "dark";

export const THEME_KEY = "atomprive.theme";

const PREFERENCES: ThemePreference[] = ["light", "dark"];

function stored(): ThemePreference {
  try {
    const held = localStorage.getItem(THEME_KEY);
    return PREFERENCES.includes(held as ThemePreference) ? (held as ThemePreference) : "light";
  } catch {
    // A browser with site data blocked still gets a working screen; it just starts light every time, which is
    // the same answer it would have had on a first visit. A "system" kept from before reads as light too.
    return "light";
  }
}

/** Writes the theme that is actually in force, so the stylesheet never has to work it out twice. */
export function applyTheme(preference: ThemePreference) {
  const dark = preference === "dark";
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}

/**
 * The signed-in person's theme. Kept in this browser only: it is how somebody likes to look at a screen, not
 * something about them the firm has any business keeping.
 */
export function useTheme() {
  const [preference, setPreference] = useState<ThemePreference>(stored);

  useEffect(() => {
    applyTheme(preference);
  }, [preference]);

  const choose = useCallback((wanted: ThemePreference) => {
    setPreference(wanted);
    try {
      localStorage.setItem(THEME_KEY, wanted);
    } catch {
      // Nothing to tell them: the theme still changes, it just will not be remembered next time.
    }
  }, []);

  return { preference, choose };
}
