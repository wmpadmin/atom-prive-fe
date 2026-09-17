import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";
import { cn } from "./cn";

const controlClasses =
  "block h-10 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink " +
  "placeholder:text-slate-400 focus:border-primary-600 focus:ring-2 focus:ring-primary-600/15 focus:outline-none " +
  "disabled:bg-slate-50 disabled:text-ink-muted aria-invalid:border-red-500";

interface FieldProps {
  id: string;
  label: string;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
  className?: string;
}

/** Label, control, hint and error message, wired together for screen readers. */
export function Field({ id, label, hint, error, children, className }: FieldProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="block text-[11px] font-semibold tracking-wider text-ink-muted uppercase">
        {label}
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

export function TextInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(controlClasses, className)} {...props} />;
}

export function SelectInput({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(controlClasses, "pr-8", className)} {...props} />;
}
