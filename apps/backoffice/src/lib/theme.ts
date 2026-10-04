import { useCallback, useEffect, useState } from "react";

/** What somebody asked for. "System" follows whatever their machine is set to, and keeps following it. */
export type ThemePreference = "system" | "light" | "dark";

export const THEME_KEY = "atomprive.theme";

const PREFERENCES: ThemePreference[] = ["system", "light", "dark"];

function stored(): ThemePreference {
  try {
    const held = localStorage.getItem(THEME_KEY);
    return PREFERENCES.includes(held as ThemePreference) ? (held as ThemePreference) : "system";
  } catch {
    // A browser with site data blocked still gets a working screen; it just starts from the machine's own
    // setting every time, which is the same answer it would have had on a first visit.
    return "system";
  }
}

function systemIsDark() {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

/** Writes the theme that is actually in force, so the stylesheet never has to work it out twice. */
export function applyTheme(preference: ThemePreference) {
  const dark = preference === "dark" || (preference === "system" && systemIsDark());
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
    if (preference !== "system") return;
    // Following the machine means following it as it changes, not only as it was when the page loaded.
    const watch = window.matchMedia("(prefers-color-scheme: dark)");
    const follow = () => applyTheme("system");
    watch.addEventListener("change", follow);
    return () => watch.removeEventListener("change", follow);
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
