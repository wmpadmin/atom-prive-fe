import {
  Children,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "./cn";
import { controlClasses } from "./form";

/**
 * One choice, read off the <option> the caller wrote.
 *
 * <p>Callers write plain <option> children, the way they always have, and this reads them rather than
 * asking for a list of objects. Seventy-odd forms already say it that way, and a component that needed
 * them rewritten would be a component most of them never got.
 */
type Choice = { value: string; label: string; disabled: boolean };

/** Everything inside, flattened: a conditional that produced nothing is nothing, not an empty row. */
function choicesIn(children: ReactNode): Choice[] {
  const found: Choice[] = [];
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    const props = child.props as { value?: string | number; children?: ReactNode; disabled?: boolean };
    if (child.type === "optgroup") {
      found.push(...choicesIn(props.children));
      return;
    }
    if (child.type !== "option") return;
    const label = Children.toArray(props.children).filter((one) => typeof one !== "boolean").join("");
    found.push({ value: String(props.value ?? label), label, disabled: props.disabled === true });
  });
  return found;
}

/** What a select shows when nobody told it anything: the first row that can be chosen. */
function firstChoosable(children: ReactNode): string | null {
  return choicesIn(children).find((one) => !one.disabled)?.value ?? null;
}

/**
 * A dropdown that opens below the box rather than over it.
 *
 * <p>A native select on a Mac opens its list on top of the control, with the chosen row under the
 * cursor — the operating system's doing, which no stylesheet reaches. On a form where the box sits
 * under a heading, the list covers the question it is answering.
 *
 * <p>So the list is drawn here. What it is drawn around is still a real select: hidden, holding the
 * value, carrying the name, and the thing whose change event fires. Every form that reads
 * {@code event.target.value} goes on reading a genuine select event, native validation still points at
 * a real control, and a form posted the old way still carries the field. The visible part is a button
 * and a list; the part the platform talks to has not changed.
 */
export function SelectInput({
  className, children, value, defaultValue, onChange, disabled, id, required,
  "aria-invalid": invalid, "aria-label": label, "aria-labelledby": labelledBy,
  "aria-describedby": describedBy, ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  const listId = useId();
  const select = useRef<HTMLSelectElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [under, setUnder] = useState(true);
  /**
   * Where on the window the list is drawn, which is how it is drawn at all.
   *
   * <p>It used to be positioned against this control and drawn inside it, and an ancestor that scrolls
   * clips what its children draw outside it — which, on a table in a strip that scrolls sideways, is the
   * whole list. Twenty screens put a picker in such a strip, and on every one of them the choices were
   * cut off at the table's edge. A browser's own dropdown is not drawn on the page at all and so cannot
   * be clipped by one; this is drawn on the body, which is as close as a list made of elements gets.
   *
   * <p>Fixed to the window rather than placed on the document, so the figure here is the box's own
   * position on screen and nothing has to know what any ancestor has scrolled.
   */
  const [box, setBox] = useState<{ left: number; top: number; bottom: number; width: number } | null>(null);
  /** Which row the keyboard is on, which is not the same as which is chosen until Enter. */
  const [at, setAt] = useState(0);

  const choices = choicesIn(children);
  // Uncontrolled selects read their own value, which only the DOM knows.
  //
  // Told neither, a select is not empty: the browser shows the first row and posts it. Starting at ""
  // instead drew a blank box over a hidden select that was already carrying the first code — the label
  // said nothing and the form sent something, which is the one disagreement a form may never have.
  const [ownValue, setOwnValue] = useState(() => String(defaultValue ?? firstChoosable(children) ?? ""));
  const shown = value === undefined ? ownValue : String(value);
  const chosen = choices.find((one) => one.value === shown) ?? null;

  /**
   * Picked: told to the real select, which then tells React.
   *
   * <p>Set through the native setter rather than by assignment, because React tracks the last value it
   * wrote and swallows a change event for a value it believes is already there — so assigning it
   * directly means every second pick of the same field does nothing at all.
   */
  function pick(choice: Choice) {
    if (choice.disabled) return;
    const element = select.current;
    if (element) {
      const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
      setter?.call(element, choice.value);
      element.dispatchEvent(new Event("change", { bubbles: true }));
    }
    if (value === undefined) setOwnValue(choice.value);
    setOpen(false);
    trigger.current?.focus();
  }

  // Below where there is room for it, above where there is not: a list that runs off the bottom of a
  // dialog is a list with its last choices in it.
  const place = useCallback(() => {
    const seen = trigger.current?.getBoundingClientRect();
    if (!seen) return;
    const needed = Math.min(choices.length, 7) * 36 + 16;
    setUnder(seen.bottom + needed <= window.innerHeight || seen.top < needed);
    setBox({ left: seen.left, top: seen.bottom, bottom: window.innerHeight - seen.top, width: seen.width });
  }, [choices.length]);

  useLayoutEffect(() => {
    if (!open) return;
    place();
  }, [open, place]);

  // The control moves when anything under the pointer scrolls, and a list fixed to the window does not
  // follow it on its own. Listened for on the way down so a strip scrolling inside the page is heard as
  // well as the page itself.
  useEffect(() => {
    if (!open) return;
    const again = () => place();
    window.addEventListener("scroll", again, true);
    window.addEventListener("resize", again);
    return () => {
      window.removeEventListener("scroll", again, true);
      window.removeEventListener("resize", again);
    };
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const away = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!trigger.current?.contains(target) && !list.current?.contains(target)) setOpen(false);
    };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, [open]);

  // The row the keyboard is on, kept in sight as it moves.
  useEffect(() => {
    if (!open) return;
    list.current?.querySelectorAll("li")[at]?.scrollIntoView({ block: "nearest" });
  }, [open, at]);

  function opened() {
    const from = choices.findIndex((one) => one.value === shown);
    setAt(from < 0 ? 0 : from);
    setOpen(true);
  }

  /** The next row somebody can actually land on, skipping the ones that cannot be picked. */
  function nextFrom(from: number, step: number) {
    for (let i = from + step; i >= 0 && i < choices.length; i += step) {
      if (!choices[i].disabled) return i;
    }
    return from;
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (!open) {
      if (["Enter", " ", "ArrowDown", "ArrowUp"].includes(event.key)) {
        event.preventDefault();
        opened();
      }
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      trigger.current?.focus();
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      const landing = choices[at];
      if (landing) pick(landing);
      return;
    }
    if (event.key === "ArrowDown") { event.preventDefault(); setAt(nextFrom(at, 1)); return; }
    if (event.key === "ArrowUp") { event.preventDefault(); setAt(nextFrom(at, -1)); return; }
    if (event.key === "Home") { event.preventDefault(); setAt(nextFrom(-1, 1)); return; }
    if (event.key === "End") { event.preventDefault(); setAt(nextFrom(choices.length, -1)); return; }
    if (event.key === "Tab") { setOpen(false); return; }
    // Typing a letter jumps to the next choice starting with it, which is how a native one behaves and
    // the only way a list of twenty models is usable without a mouse.
    if (event.key.length === 1) {
      const letter = event.key.toLowerCase();
      const after = choices.slice(at + 1).concat(choices.slice(0, at + 1));
      const landing = after.find((one) => !one.disabled && one.label.toLowerCase().startsWith(letter));
      if (landing) setAt(choices.indexOf(landing));
    }
  }

  return (
    <span className="relative block">
      {/* The real control: what holds the value, carries the name, fires the change and answers to
          native validation. Kept in the layout rather than display:none so a browser asking somebody to
          fill it in has somewhere to point.

          It does NOT take the id, and wears none of the aria the caller passed. A Field renders
          <label htmlFor={id}>, and whatever that id names is the thing a click on the label focuses and
          a screen reader announces the label for — so an id on something aria-hidden and untabbable
          gives seventy fields a label that points at nothing and a dropdown with no name at all. The
          same for aria-invalid: the screen that jumps to the first bad field looks one up by that
          attribute and focuses it, and the first match has to be the control somebody can see. */}
      <select
        {...props}
        ref={select}
        id={id === undefined ? undefined : `${id}-value`}
        required={required}
        disabled={disabled}
        value={value === undefined ? undefined : shown}
        defaultValue={value === undefined ? defaultValue : undefined}
        onChange={(event) => {
          if (value === undefined) setOwnValue(event.target.value);
          onChange?.(event);
        }}
        tabIndex={-1}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 size-full opacity-0"
      >
        {children}
      </select>

      <button
        ref={trigger}
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : opened())}
        onKeyDown={onKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-invalid={invalid}
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        aria-label={label}
        className={cn(controlClasses, "select-control flex items-center pr-9 text-left", className)}
      >
        <span className={cn("min-w-0 flex-1 truncate", chosen === null && "text-slate-400")}>
          {chosen?.label ?? ""}
        </span>
      </button>

      {open && box !== null && createPortal(
        <ul
          ref={list}
          id={listId}
          role="listbox"
          tabIndex={-1}
          aria-activedescendant={`${listId}-${at}`}
          style={{
            left: box.left,
            width: box.width,
            ...(under ? { top: box.top + 4 } : { bottom: box.bottom + 4 }),
          }}
          className="fixed z-50 max-h-64 overflow-auto rounded-lg border border-line bg-white py-1 shadow-lg"
        >
          {choices.map((choice, which) => (
            <li
              key={`${choice.value}-${which}`}
              id={`${listId}-${which}`}
              role="option"
              aria-selected={choice.value === shown}
              aria-disabled={choice.disabled || undefined}
              onMouseEnter={() => !choice.disabled && setAt(which)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => pick(choice)}
              className={cn("cursor-pointer px-3 py-2 text-sm",
                choice.disabled ? "cursor-default text-ink-muted/60"
                  : which === at ? "bg-primary-50 text-ink" : "text-ink",
                choice.value === shown && !choice.disabled && "font-semibold")}
            >
              {choice.label}
            </li>
          ))}
        </ul>,
        document.body,
      )}
    </span>
  );
}
