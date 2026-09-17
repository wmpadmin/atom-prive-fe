import { cn, RequiredMark } from "@atomprive/ui";
import { Check } from "lucide-react";
import type { ReactNode } from "react";

export interface Choice<T extends string> {
  value: T;
  label: string;
  description?: string;
  icon?: ReactNode;
}

interface ChoiceCardsProps<T extends string> {
  /** Name shared by the radio buttons; also the id for the error message. */
  name: string;
  legend: string;
  required?: boolean;
  value: T | null;
  onChange: (value: T) => void;
  choices: Choice<T>[];
  /** Grid columns, such as "sm:grid-cols-3". */
  columns?: string;
  /** Smaller cards for short answers such as Yes or No. */
  compact?: boolean;
  error?: string;
}

/** A choice of one, as cards: easier to scan and to hit than small radio buttons. */
export function ChoiceCards<T extends string>({ name, legend, required, value, onChange, choices, columns = "sm:grid-cols-2", compact, error }: ChoiceCardsProps<T>) {
  return (
    <fieldset aria-describedby={error ? `${name}-error` : undefined} aria-invalid={error ? true : undefined}>
      <legend className="mb-1.5 text-2xs font-semibold tracking-wider text-ink-muted uppercase">
        {legend}
        {required && <RequiredMark />}
      </legend>
      <div className={cn("grid gap-2", columns)}>
        {choices.map((choice) => {
          const checked = value === choice.value;
          return (
            <label
              key={choice.value}
              className={cn(
                "relative flex cursor-pointer items-center gap-3 rounded-xl border transition-colors has-focus-visible:ring-2 has-focus-visible:ring-primary-600/30",
                compact ? "px-3.5 py-2.5" : "p-3.5",
                checked ? "border-primary-600 bg-primary-50/70" : "border-line bg-white hover:border-primary-100",
              )}
            >
              <input type="radio" name={name} value={choice.value} checked={checked} onChange={() => onChange(choice.value)} className="sr-only" />
              {choice.icon && (
                <span
                  aria-hidden="true"
                  className={cn(
                    "grid size-9 shrink-0 place-items-center rounded-lg transition-colors [&_svg]:size-4.5",
                    checked ? "bg-primary-600 text-white" : "bg-slate-100 text-ink-soft",
                  )}
                >
                  {choice.icon}
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-ink">{choice.label}</span>
                {choice.description && <span className="mt-0.5 block text-xs text-ink-muted">{choice.description}</span>}
              </span>
              <span
                aria-hidden="true"
                className={cn(
                  "grid size-4.5 shrink-0 place-items-center rounded-full border transition-colors",
                  checked ? "border-primary-600 bg-primary-600 text-white" : "border-slate-300 bg-white",
                )}
              >
                {checked && <Check className="size-3" strokeWidth={3} />}
              </span>
            </label>
          );
        })}
      </div>
      {error && (
        <p id={`${name}-error`} className="mt-1.5 text-xs text-red-600">
          {error}
        </p>
      )}
    </fieldset>
  );
}
