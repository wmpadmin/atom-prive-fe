import { RequiredMark, cn } from "@atomprive/ui";
import { useEffect, useRef, type ReactNode } from "react";
import type { FieldFor } from "./form-fields";

/**
 * The pieces every one of the client's paper forms is made of: a line, a box beside it, and a heading over a
 * set of them. The words are always the form's own; what the screen translates is the typography — a run of
 * underscores is a blank the form rules, so it becomes a box to write in, and a note the form puts in braces
 * beside a line is set quieter than the line it belongs to.
 */

/**
 * How the pack's forms rule a blank in the middle of a line: mostly a run of underscores, and on the joint
 * account holder's confirmation a pair of brackets with room between them.
 */
const RULED = /(_{3,}|\[\s+\])/;

const RULED_WHOLE = /^(_{3,}|\[\s+\])$/;

/** What goes on the blank a line rules. */
export interface Blank {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  field: FieldFor;
}

/**
 * One of the form's lines, printed as it reads. The two things the paper does with type become the two things
 * the screen does with it: a run of underscores is a blank, so it becomes a box to write in, and the note the
 * form puts in braces beside a line is set quieter than the line it belongs to.
 */
export function Written({
  text,
  htmlFor,
  blank,
  /** The line has not been ticked, so its rule is printed but not yet written on. */
  idle,
}: {
  text: string;
  htmlFor?: string;
  blank?: Blank;
  idle?: boolean;
}) {
  const out: ReactNode[] = [];
  let key = 0;
  const say = (piece: string, quiet: boolean) =>
    htmlFor ? (
      <label key={key++} htmlFor={htmlFor} className={cn("cursor-pointer", quiet && "text-ink-muted")}>
        {piece}
      </label>
    ) : (
      <span key={key++} className={quiet ? "text-ink-muted" : undefined}>
        {piece}
      </span>
    );

  for (const part of text.split(/(\{[^}]*\})/)) {
    if (!part) continue;
    const quiet = part.startsWith("{") && part.endsWith("}");
    for (const chunk of (quiet ? part.slice(1, -1) : part).split(RULED)) {
      if (!chunk) continue;
      if (!RULED_WHOLE.test(chunk)) {
        out.push(say(chunk, quiet));
      } else if (blank && !idle) {
        const { error, onBlur } = blank.field(blank.id);
        out.push(
          <input
            key={key++}
            id={blank.id}
            type="text"
            aria-label={blank.label}
            aria-invalid={error ? true : undefined}
            autoComplete="off"
            value={blank.value}
            onBlur={onBlur}
            onChange={(event) => blank.onChange(event.target.value)}
            className={cn(
              "mx-1 inline-block w-56 max-w-full border-b bg-transparent px-1 py-0.5 text-sm text-ink focus:outline-none",
              error ? "border-red-500" : "border-ink-muted focus:border-primary-600",
            )}
          />,
        );
      } else {
        // A rule on a line nobody has ticked is still the rule the form prints: it is there to be seen, and
        // it is written on once the line beside it is the one chosen.
        out.push(
          <input
            key={key++}
            type="text"
            tabIndex={-1}
            aria-hidden="true"
            readOnly
            disabled
            value={blank?.value ?? ""}
            className="mx-1 inline-block w-56 max-w-full cursor-not-allowed border-b border-line bg-transparent px-1 py-0.5 text-sm text-ink-muted"
          />,
        );
      }
    }
  }
  return <span className="whitespace-pre-line">{out}</span>;
}

/** A box the form prints, and the line beside it. */
export function Tick({
  kind,
  name,
  id,
  checked,
  onChange,
  text,
  blank,
  aside,
  disabled,
  children,
}: {
  kind: "radio" | "checkbox";
  name: string;
  id: string;
  checked: boolean;
  onChange: (on: boolean) => void;
  text: string;
  blank?: Blank;
  /** What the form prints in a column of its own beside the line, such as its Score. */
  aside?: ReactNode;
  /**
   * The form prints this box but an answer above it has not opened it yet, as with the box its wording joins
   * to another with "and". The line is read; the box cannot be ticked.
   */
  disabled?: boolean;
  children?: ReactNode;
}) {
  // What is written on a line's rule belongs to that line: it is only written on while the line is the one
  // ticked, and unticking the line takes back what was written rather than sending it with the form.
  const wasTicked = useRef(checked);
  useEffect(() => {
    if (wasTicked.current && !checked && blank?.value) blank.onChange("");
    wasTicked.current = checked;
  }, [checked, blank]);

  return (
    <div
      // The whole line is the box: picking it is clicking anywhere on it, not hunting for the circle.
      onClick={(event) => {
        if (disabled) return;
        // A blank to write on, or the label of the box itself, is its own: it is written on or already picks
        // the line, so a click that lands on one is left alone.
        if ((event.target as HTMLElement).closest("input, textarea, select, button, a, label")) return;
        onChange(kind === "checkbox" ? !checked : true);
      }}
      className={cn(
        "rounded-xl border transition-colors",
        checked ? "border-primary-600 bg-primary-50/70" : "border-line bg-white hover:border-primary-100",
        disabled ? "border-line bg-slate-50 hover:border-line" : "cursor-pointer",
      )}
    >
      <div className="flex items-start gap-3 p-3.5">
        <input
          type={kind}
          name={name}
          id={id}
          checked={checked}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
          className={cn(
            "mt-0.5 size-4 shrink-0 accent-primary-600",
            kind === "checkbox" && "rounded-[3px]",
            disabled && "cursor-not-allowed",
          )}
        />
        <div className={cn("min-w-0 flex-1 text-sm leading-relaxed", disabled ? "text-ink-muted" : "text-ink")}>
          <Written text={text} htmlFor={id} blank={blank} idle={!checked} />
        </div>
        {aside}
      </div>
      {children}
    </div>
  );
}

/** A set of boxes under one of the form's headings. */
export function Boxes({
  legend,
  required,
  /** The heading is already shown above, so the legend is here only for whoever is listening. */
  hideLegend,
  /** Boxes the paper prints along one line, as it does a short run of them, rather than one under the other. */
  inline,
  error,
  children,
}: {
  legend: string;
  required?: boolean;
  hideLegend?: boolean;
  inline?: boolean;
  error?: string;
  children: ReactNode;
}) {
  return (
    <fieldset>
      <legend className={hideLegend ? "sr-only" : "mb-2 text-sm font-bold text-ink"}>
        <Written text={legend} />
        {required && <RequiredMark />}
      </legend>
      <div className={inline ? "flex flex-wrap gap-2" : "space-y-2"}>{children}</div>
      {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
    </fieldset>
  );
}

