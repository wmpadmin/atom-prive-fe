import { CalendarDays, X } from "lucide-react";
import { useId, useLayoutEffect, useRef, useState } from "react";
import { DayPicker } from "react-day-picker";
import { cn } from "./cn";
import { controlClasses } from "./form";

const shown = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" });

/** "2024-01-15" as a local date, so the day doesn't move with the time zone. */
function parseDate(value: string | null | undefined) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? "");
  return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : undefined;
}

function toIsoDate(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

interface DateInputProps {
  id: string;
  /** Sent with the form as yyyy-mm-dd. */
  name: string;
  /** A saved date, yyyy-mm-dd. */
  defaultValue?: string | null;
  /** The date shown, yyyy-mm-dd, for a date kept elsewhere, such as a filter in the address; "" for none. */
  value?: string | null;
  /** Offers a button that clears the date, calling onChange with "". */
  clearable?: boolean;
  /** Earliest date that can be chosen. */
  min: Date;
  /** Latest date that can be chosen. */
  max: Date;
  placeholder?: string;
  required?: boolean;
  /** The line is printed but not open to write on yet, because of an answer above it. */
  disabled?: boolean;
  /** Called with the chosen date, yyyy-mm-dd. */
  onChange?: (value: string) => void;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}

/**
 * A date field that opens a calendar, with month and year lists for jumping back years at a time. It looks the
 * same in every browser, unlike the browser's own date box, and only dates from min to max can be chosen.
 */
export function DateInput({ id, name, defaultValue, value: shownValue, clearable, min, max, placeholder = "Choose a date", required, disabled, onChange, ...aria }: DateInputProps) {
  const calendarId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const calendarRef = useRef<HTMLDivElement>(null);
  const [chosen, setChosen] = useState(() => parseDate(defaultValue));
  const value = shownValue === undefined ? chosen : parseDate(shownValue);
  const [open, setOpen] = useState(false);

  // The calendar floats above everything, dialogs included, so it's placed by the button here, and follows
  // the button when the form scrolls.
  useLayoutEffect(() => {
    const button = buttonRef.current;
    const calendar = calendarRef.current;
    if (!open || !button || !calendar) return;
    const place = () => {
      const anchor = button.getBoundingClientRect();
      const { width, height } = calendar.getBoundingClientRect();
      const fitsBelow = anchor.bottom + 6 + height <= window.innerHeight - 8;
      calendar.style.top = `${fitsBelow ? anchor.bottom + 6 : Math.max(8, anchor.top - 6 - height)}px`;
      calendar.style.left = `${Math.max(8, Math.min(anchor.left, window.innerWidth - width - 8))}px`;
    };
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open]);

  function choose(date: Date | undefined) {
    // Clicking the chosen day again would clear it; a required date stays chosen instead.
    if (!date) return;
    setChosen(date);
    onChange?.(toIsoDate(date));
    calendarRef.current?.hidePopover();
  }

  function clear() {
    setChosen(undefined);
    onChange?.("");
    buttonRef.current?.focus();
  }

  const today = new Date();
  const firstMonthShown = value ?? (today > max ? max : today < min ? min : today);

  const trigger = (
    <button
      ref={buttonRef}
      id={id}
      type="button"
      popoverTarget={disabled ? undefined : calendarId}
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-required={required}
      disabled={disabled}
      {...aria}
      className={cn(controlClasses, "flex items-center justify-between gap-2 text-left", !value && "text-slate-400")}
    >
      <span className="truncate">{value ? shown.format(value) : placeholder}</span>
      <CalendarDays aria-hidden="true" className={cn("size-4 shrink-0 text-ink-muted", clearable && value && "invisible")} />
    </button>
  );

  return (
    <>
      {clearable ? (
        <div className="relative">
          {trigger}
          {value && (
            <button
              type="button"
              aria-label="Clear the date"
              onClick={clear}
              className="absolute top-1/2 right-2 grid size-6 -translate-y-1/2 place-items-center rounded-md text-ink-muted hover:bg-slate-100 hover:text-ink focus-visible:outline-2 focus-visible:outline-primary-600"
            >
              <X aria-hidden="true" className="size-3.5" />
            </button>
          )}
        </div>
      ) : (
        trigger
      )}
      <input type="hidden" name={name} value={value ? toIsoDate(value) : ""} />
      <div
        ref={calendarRef}
        id={calendarId}
        popover="auto"
        role="dialog"
        aria-label="Choose a date"
        onToggle={(event) => setOpen(event.newState === "open")}
        className="m-0 rounded-xl border border-line bg-white p-3 text-ink shadow-xl [inset:auto]"
      >
        {open && (
          <DayPicker
            mode="single"
            selected={value}
            onSelect={choose}
            defaultMonth={firstMonthShown}
            startMonth={min}
            endMonth={max}
            disabled={[{ before: min }, { after: max }]}
            captionLayout="dropdown"
            navLayout="around"
            weekStartsOn={1}
            autoFocus
          />
        )}
      </div>
    </>
  );
}
