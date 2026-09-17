import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "./cn";

/** Shared look of every text box, select and the date picker's button. */
export const controlClasses =
  "block h-10 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink " +
  "placeholder:text-slate-400 focus:border-primary-600 focus:ring-2 focus:ring-primary-600/15 focus:outline-none " +
  "disabled:bg-slate-50 disabled:text-ink-muted aria-invalid:border-red-500";

interface FieldProps {
  id: string;
  label: string;
  /** Shows a * after the label; also set `required` on the control itself. */
  required?: boolean;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
  className?: string;
}

/** Label, control, hint and error message, wired together for screen readers. */
export function Field({ id, label, required, hint, error, children, className }: FieldProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="block text-2xs font-semibold tracking-wider text-ink-muted uppercase">
        {label}
        {required && <RequiredMark />}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-xs text-red-600">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-ink-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** The * after a label for something that must be filled in. Screen readers hear "required" from the control instead. */
export function RequiredMark() {
  return (
    <span aria-hidden="true" className="ml-0.5 text-red-600">
      *
    </span>
  );
}

export function TextInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(controlClasses, className)} {...props} />;
}

export function TextArea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(controlClasses, "h-auto py-2.5", className)} {...props} />;
}

export function SelectInput({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(controlClasses, "pr-8", className)} {...props} />;
}
