import { Moon, Sun } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTheme, type ThemePreference } from "../lib/theme";

/** How long the sun or moon takes to cross the screen; the theme changes as it passes the top, half way. */
const CROSSING_MS = 1300;

/**
 * Light or dark, one click. Today's theme shows on the button; clicking it sends the other one's sun or moon in an
 * arc across the screen, and the page changes over as it passes the top. Settings → Preferences still offers
 * the same two choices for whoever would rather pick one there.
 *
 * <p>Somebody who has asked their machine for less motion gets the change at once, with no crossing.
 */
export function ThemeToggle() {
  const { preference, choose } = useTheme();
  const [crossing, setCrossing] = useState<ThemePreference | null>(null);
  const timers = useRef<number[]>([]);
  const dark = preference === "dark";
  const next: ThemePreference = dark ? "light" : "dark";

  useEffect(() => () => {
    timers.current.forEach((one) => window.clearTimeout(one));
    document.documentElement.classList.remove("theme-crossing");
  }, []);

  function toggle() {
    if (crossing) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      choose(next);
      return;
    }
    const root = document.documentElement;
    root.classList.add("theme-crossing");
    setCrossing(next);
    timers.current = [
      window.setTimeout(() => choose(next), CROSSING_MS / 2),
      window.setTimeout(() => {
        root.classList.remove("theme-crossing");
        setCrossing(null);
      }, CROSSING_MS),
    ];
  }

  const Icon = dark ? Moon : Sun;
  return (
    <>
      <button
        type="button"
        onClick={toggle}
        aria-label={`Theme: ${dark ? "Dark" : "Light"}. Switch to ${dark ? "light" : "dark"}`}
        className="relative grid size-10 place-items-center overflow-hidden rounded-xl text-ink-soft hover:bg-white hover:text-ink"
      >
        {/* Keyed on the theme, so the new icon turns in each time it changes. */}
        <Icon key={preference} className="theme-icon-in size-5" aria-hidden="true" />
      </button>
      {crossing && createPortal(<Crossing to={crossing} />, document.body)}
    </>
  );
}

/**
 * The sun or moon of the theme being moved to, arcing from the bottom left to the bottom right with a halo, over a
 * brief wash of that theme's page colour. The colours are written out rather than read from the theme, because
 * the theme on the page is still the old one until half way.
 */
function Crossing({ to }: { to: ThemePreference }) {
  const dark = to === "dark";
  return (
    <div className="pointer-events-none fixed inset-0 z-[100] overflow-hidden" aria-hidden="true">
      <div className="theme-crossing-wash absolute inset-0" style={{ backgroundColor: dark ? "#0d1117" : "#edf2f8" }} />
      <div className="theme-crossing-arc absolute top-0 left-0">
        <div className="-translate-x-1/2 -translate-y-1/2">
          <div
            className="absolute top-1/2 left-1/2 size-[75vmax] -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              background: dark
                ? "radial-gradient(circle, rgba(61,135,244,0.28) 0%, rgba(29,110,232,0.10) 32%, rgba(0,0,0,0) 60%)"
                : "radial-gradient(circle, rgba(253,184,19,0.45) 0%, rgba(255,236,170,0.22) 32%, rgba(255,255,255,0) 60%)",
            }}
          />
          <div className="relative drop-shadow-2xl">{dark ? <BigMoon /> : <BigSun />}</div>
        </div>
      </div>
    </div>
  );
}

function BigSun() {
  const rays = Array.from({ length: 12 }, (_, at) => {
    const angle = (at * 30 * Math.PI) / 180;
    return {
      x1: 60 + Math.cos(angle) * 34,
      y1: 60 + Math.sin(angle) * 34,
      x2: 60 + Math.cos(angle) * 52,
      y2: 60 + Math.sin(angle) * 52,
    };
  });
  return (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none">
      <circle cx="60" cy="60" r="24" fill="#FDB813" />
      {rays.map((ray, at) => (
        <line key={at} {...ray} stroke="#FDB813" strokeWidth="5" strokeLinecap="round" />
      ))}
    </svg>
  );
}

function BigMoon() {
  return (
    <svg width="110" height="110" viewBox="0 0 110 110" fill="none">
      <defs>
        <mask id="atomprive-crescent">
          <rect width="110" height="110" fill="white" />
          <circle cx="74" cy="42" r="40" fill="black" />
        </mask>
      </defs>
      <circle cx="55" cy="55" r="42" fill="#E8ECF6" mask="url(#atomprive-crescent)" />
    </svg>
  );
}
