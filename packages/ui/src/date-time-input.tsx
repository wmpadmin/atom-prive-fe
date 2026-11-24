import { CalendarDays } from "lucide-react";
import { useId, useLayoutEffect, useRef, useState } from "react";
import { DayPicker } from "react-day-picker";
import { cn } from "./cn";
import { controlClasses } from "./form";

const shown = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });

const pad = (n: number) => String(n).padStart(2, "0");

/** "2026-12-01T07:00" as a local date and time. */
function parse(value: string | null | undefined) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value ?? "");
  return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5])) : undefined;
}

function format(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const STEP_MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);

interface DateTimeInputProps {
  id: string;
  /** The date and time shown, as a datetime-local value (yyyy-mm-ddThh:mm), or "" for none. */
  value: string;
  /** Called with the applied date and time, yyyy-mm-ddThh:mm, only when Apply is pressed. */
  onChange: (value: string) => void;
  /** Earliest date that can be chosen; twenty-five years back when not given. */
  min?: Date;
  /** Latest date that can be chosen; five years ahead when not given. */
  max?: Date;
  placeholder?: string;
  disabled?: boolean;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}

/**
 * A date and time field that opens a calendar beside an hour and a minute list. Nothing is changed until Apply is
 * pressed; Cancel, Escape or clicking away leaves the field as it was. Looks the same in every browser.
 */
export function DateTimeInput({ id, value, onChange, min, max, placeholder = "Choose a date and time", disabled, ...aria }: DateTimeInputProps) {
  const pickerId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const applied = parse(value);
  const [draft, setDraft] = useState<Date | undefined>(applied);
  const today = new Date();
  const earliest = min ?? new Date(today.getFullYear() - 25, 0, 1);
  const latest = max ?? new Date(today.getFullYear() + 5, 11, 31);

  useLayoutEffect(() => {
    const button = buttonRef.current;
    const picker = pickerRef.current;
    if (!open || !button || !picker) return;
    const place = () => {
      const anchor = button.getBoundingClientRect();
      const { width, height } = picker.getBoundingClientRect();
      const fitsBelow = anchor.bottom + 6 + height <= window.innerHeight - 8;
      picker.style.top = `${fitsBelow ? anchor.bottom + 6 : Math.max(8, anchor.top - 6 - height)}px`;
      picker.style.left = `${Math.max(8, Math.min(anchor.left, window.innerWidth - width - 8))}px`;
    };
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open]);

  // Each opening starts from what is applied, or the next whole hour when nothing is.
  function opened(isOpen: boolean) {
    setOpen(isOpen);
    if (isOpen) {
      const start = new Date();
      start.setHours(start.getHours() + 1, 0, 0, 0);
      setDraft(parse(value) ?? start);
    }
  }

  const close = () => pickerRef.current?.hidePopover();
  const apply = () => {
    if (draft) onChange(format(draft));
    close();
    buttonRef.current?.focus();
  };

  const set = (change: (next: Date) => void) => setDraft((was) => {
    const next = new Date(was ?? new Date());
    change(next);
    return next;
  });
  const minutes = draft && !STEP_MINUTES.includes(draft.getMinutes())
    ? [...STEP_MINUTES, draft.getMinutes()].sort((a, b) => a - b) : STEP_MINUTES;

  return (
    <>
      <button
        ref={buttonRef}
        id={id}
        type="button"
        popoverTarget={disabled ? undefined : pickerId}
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={disabled}
        {...aria}
        className={cn(controlClasses, "flex items-center justify-between gap-2 text-left", !applied && "text-slate-400")}
      >
        <span className="truncate">{applied ? shown.format(applied) : placeholder}</span>
        <CalendarDays aria-hidden="true" className="size-4 shrink-0 text-ink-muted" />
      </button>
      <div
        ref={pickerRef}
        id={pickerId}
        popover="auto"
        role="dialog"
        aria-label="Choose a date and time"
        onToggle={(event) => opened(event.newState === "open")}
        className="m-0 rounded-xl border border-line bg-white p-3 text-ink shadow-xl [inset:auto]"
      >
        {open && (
          <div className="space-y-3">
            <div className="flex gap-3">
              <DayPicker
                mode="single"
                selected={draft}
                onSelect={(day) => day && set((next) => next.setFullYear(day.getFullYear(), day.getMonth(), day.getDate()))}
                defaultMonth={draft ?? today}
                startMonth={earliest}
                endMonth={latest}
                disabled={[{ before: earliest }, { after: latest }]}
                captionLayout="dropdown"
                navLayout="around"
                weekStartsOn={1}
                autoFocus
              />
              <TimeList label="Hour" options={HOURS} chosen={draft?.getHours()} onChoose={(hour) => set((next) => next.setHours(hour))} />
              <TimeList label="Minute" options={minutes} chosen={draft?.getMinutes()} onChoose={(minute) => set((next) => next.setMinutes(minute))} />
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-line pt-3">
              <p className="text-sm text-ink-muted tabular-nums">{draft ? shown.format(draft) : "Nothing chosen"}</p>
              <div className="flex gap-2">
                <button type="button" onClick={close}
                  className="h-9 rounded-lg border border-line px-3.5 text-sm font-semibold text-ink hover:bg-slate-50">
                  Cancel
                </button>
                <button type="button" onClick={apply} disabled={!draft}
                  className="h-9 rounded-lg bg-primary-600 px-4 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50">
                  Apply
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function TimeList({ label, options, chosen, onChoose }: { label: string; options: number[]; chosen?: number; onChoose: (value: number) => void }) {
  const listRef = useRef<HTMLDivElement>(null);
  // The chosen one in view when the list opens.
  useLayoutEffect(() => {
    listRef.current?.querySelector<HTMLElement>("[aria-pressed=true]")?.scrollIntoView({ block: "center" });
  }, []);
  return (
    <div className="flex w-16 flex-col">
      <p className="pb-1 text-center text-2xs font-bold tracking-wider text-ink-muted uppercase">{label}</p>
      <div ref={listRef} role="group" aria-label={label} className="h-72 space-y-1 overflow-y-auto pr-1">
        {options.map((one) => (
          <button key={one} type="button" aria-pressed={one === chosen} onClick={() => onChoose(one)}
            className={cn("block h-9 w-full rounded-lg text-sm tabular-nums",
              one === chosen ? "bg-primary-600 font-bold text-white" : "text-ink hover:bg-slate-100")}>
            {pad(one)}
          </button>
        ))}
      </div>
    </div>
  );
}
