import { useId } from "react";
import { cn } from "./cn";

/**
 * One thing that is either on or off, and takes effect the moment it is pressed.
 *
 * <p>A switch rather than a checkbox, because there is no Save on the screens that use it: a checkbox
 * promises a form to submit, and a switch promises the thing has already happened. Use a checkbox where
 * the answer is gathered up and sent with others.
 *
 * <p>The state is written beside it as a word, not left to the position of the knob alone. Colour and
 * position together are the whole of a bare switch, and the two of them are the same signal twice over for
 * anybody who cannot see the difference.
 */
export function Switch({ on, label, onLabel = "On", offLabel = "Off", disabled, busy, onChange, className }: {
  on: boolean;
  /** What is being switched, for whoever cannot see the column it sits under. */
  label: string;
  /** The word beside it when on, and when off. "Asked for" and "No" read better than "On" and "Off". */
  onLabel?: string;
  offLabel?: string;
  disabled?: boolean;
  /** True while this one's change is in flight, so it cannot be pressed twice. */
  busy?: boolean;
  onChange: (on: boolean) => void;
  className?: string;
}) {
  const id = useId();
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <button
        type="button"
        role="switch"
        id={id}
        aria-checked={on}
        aria-label={label}
        disabled={disabled || busy}
        onClick={() => onChange(!on)}
        className={cn(
          "relative h-[22px] w-[38px] shrink-0 rounded-full transition-colors",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600",
          "disabled:cursor-not-allowed",
          on ? "bg-primary-600" : "bg-slate-200",
          (disabled || busy) && "opacity-50",
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            "absolute top-[3px] size-4 rounded-full bg-white shadow-sm transition-[left]",
            on ? "left-[19px]" : "left-[3px]",
          )}
        />
      </button>
      {/* Clickable with the switch, so the word is part of the control rather than a caption beside it. */}
      <label
        htmlFor={id}
        className={cn(
          "text-xs font-semibold",
          disabled ? "text-slate-300" : on ? "text-primary-700" : "text-slate-400",
        )}
      >
        {on ? onLabel : offLabel}
      </label>
    </span>
  );
}
