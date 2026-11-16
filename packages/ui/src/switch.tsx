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
          // The rounded pill the firm asked for (16 Nov 2026): a wide track and a large round knob that fills
          // its height, sitting just inside the edge.
          "relative h-[26px] w-[50px] shrink-0 rounded-full transition-colors duration-200 motion-reduce:transition-none",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600",
          "disabled:cursor-not-allowed",
          on ? "bg-primary-600" : "bg-slate-300",
          (disabled || busy) && "opacity-50",
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            // A real white, not the theme's "white": in dark mode that is the page's own dark surface, and the
            // knob vanished into the track. The faint ring keeps its edge against a light track.
            "absolute top-[2px] size-[22px] rounded-full bg-[#ffffff] shadow-[0_1px_3px_rgba(0,0,0,0.25)] ring-1 ring-black/10",
            "transition-[left] duration-200 motion-reduce:transition-none",
            on ? "left-[26px]" : "left-[2px]",
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
