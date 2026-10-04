import { cn } from "@atomprive/ui";
import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTheme, type ThemePreference } from "../lib/theme";

const CHOICES: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: "system", label: "Match my system", icon: Monitor },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
];

/**
 * Light, dark, or whatever the machine is set to. Three choices rather than a switch, because "follow my
 * system" is a real answer and a two-state switch cannot say it.
 */
export function ThemeToggle() {
  const { preference, choose } = useTheme();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const chosen = CHOICES.find((choice) => choice.value === preference) ?? CHOICES[0];
  const Icon = chosen.icon;

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Theme: ${chosen.label}`}
        onClick={() => setOpen((current) => !current)}
        className="grid size-10 place-items-center rounded-xl text-ink-soft hover:bg-white hover:text-ink"
      >
        <Icon className="size-5" aria-hidden="true" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-10 mt-2 w-48 rounded-xl border border-line bg-white p-1.5 shadow-lg">
          {CHOICES.map((choice) => {
            const ChoiceIcon = choice.icon;
            const here = choice.value === preference;
            return (
              <button
                key={choice.value}
                type="button"
                role="menuitemradio"
                aria-checked={here}
                onClick={() => {
                  choose(choice.value);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm",
                  here ? "bg-primary-50 font-semibold text-ink" : "text-ink-soft hover:bg-slate-50",
                )}
              >
                <ChoiceIcon className="size-4 shrink-0" aria-hidden="true" />
                {choice.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
