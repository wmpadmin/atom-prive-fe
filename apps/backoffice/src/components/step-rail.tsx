import { cn } from "@atomprive/ui";
import { Check } from "lucide-react";
import type { ReactNode } from "react";

export interface RailStep {
  id: string;
  group: string;
  label: string;
  complete: boolean;
}

interface StepRailProps {
  steps: RailStep[];
  currentId: string;
  onSelect: (id: string) => void;
  /** A line under each part saying what it asks for, by the part's id. */
  hints?: Record<string, string>;
  /** What the rail says about the thing it is the side of, where it is not a form to fill in. */
  intro?: string;
  /** A short note the form makes about itself, set apart at the foot of the rail. */
  note?: { title: string; body: string };
  /** Links out of the form: back to the case it belongs to, and anything beside it. */
  footer?: ReactNode;
}

/**
 * The parts of a form, down the side of it. Each carries the mark the paper puts in its margin — PART A, or the
 * number of the section — which turns into a tick once the part is answered, so how far the form has got reads
 * at a glance. Nothing here is locked: a form is filled in whatever order the client's papers arrive in.
 */
export function StepRail({ steps, currentId, onSelect, hints, intro, note, footer }: StepRailProps) {
  // A form whose parts the paper letters keeps its letters; the review at the end is not one of its parts.
  // A document that marks its own parts keeps its marks, and the ones it leaves unmarked stay unmarked:
  // numbering those would read as parts the paper does not have.
  const lettered = steps.some((step) => PART.test(step.group.trim()) || OWN_MARK.test(step.group.trim()));
  return (
    <nav aria-label="Sections of this form" className="rounded-2xl border border-line bg-white p-4 lg:sticky lg:top-6">
      <p className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">On this page</p>
      <p className="mt-1.5 text-xs leading-relaxed text-ink-muted">
        {intro ?? "One form, one submission. Go to any part — nothing is locked."}
      </p>

      <ol className="mt-4 space-y-0.5">
        {steps.map((step, position) => {
          const current = step.id === currentId;
          const hint = hints?.[step.id];
          return (
            <li key={step.id}>
              <button
                type="button"
                aria-current={current ? "step" : undefined}
                onClick={() => onSelect(step.id)}
                className={cn(
                  "flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600",
                  current ? "bg-primary-50" : "hover:bg-slate-50",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "mt-px grid size-5.5 shrink-0 place-items-center rounded-full border text-2xs font-semibold",
                    step.complete
                      ? "border-emerald-500 bg-emerald-500 text-white"
                      : current
                        ? "border-primary-600 bg-primary-600 text-white"
                        : "border-line bg-white text-ink-muted",
                  )}
                >
                  {step.complete ? <Check className="size-3" strokeWidth={3} /> : markOf(step, position, lettered)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cn("block text-sm", current ? "font-semibold text-primary-700" : "text-ink-soft")}>
                    {step.label}
                  </span>
                  {hint && <span className="mt-0.5 line-clamp-2 text-2xs leading-relaxed text-ink-muted">{hint}</span>}
                </span>
                <span className="sr-only">{step.complete ? "(complete)" : "(to do)"}</span>
              </button>
            </li>
          );
        })}
      </ol>

      {note && (
        <div className="mt-5 rounded-xl border border-line bg-canvas px-4 py-3">
          <p className="text-xs font-semibold text-ink">{note.title}</p>
          <p className="mt-1 text-xs leading-relaxed text-ink-muted">{note.body}</p>
        </div>
      )}

      {footer && <div className="mt-5 flex flex-col gap-2 border-t border-line pt-4">{footer}</div>}
    </nav>
  );
}

const PART = /^part\s+(\w+)$/i;

/**
 * A mark the paper puts in its own margin without the word PART: the joint confirmation letters A and B, the
 * identification form numbers two of its nine parts, and an em dash is a part it marks with nothing at all.
 */
const OWN_MARK = /^([A-Z]|\d+|—)$/;

/** The mark the paper puts in the margin: PART A's letter, or the part's number in the form. */
function markOf(step: RailStep, position: number, lettered: boolean) {
  const own = PART.exec(step.group.trim());
  if (own) return own[1]!.toUpperCase();
  // A document that numbers its own parts keeps its numbers, which are not always 1, 2, 3 from the top; a part
  // it gives no number to is marked with none, rather than being counted as though it had one.
  const mark = step.group.trim();
  // A document's own mark for a part: its number, the letter of a division it is under, or none at all.
  if (OWN_MARK.test(mark)) return mark;
  // Numbering one part of a lettered form would read as a part the paper doesn't have.
  return lettered ? "" : String(position + 1);
}
