import type { ButtonHTMLAttributes } from "react";
import { cn } from "./cn";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "danger-soft";

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-primary-600 text-white shadow-xs hover:bg-primary-700",
  secondary: "border border-line bg-white text-ink shadow-xs hover:bg-slate-50",
  ghost: "bg-slate-100 text-ink-soft hover:bg-slate-200",
  danger: "bg-red-600 text-white shadow-xs hover:bg-red-700",
  /** A destructive action that shouldn't dominate the page, such as Deactivate next to Edit. */
  "danger-soft": "border border-red-200 bg-red-50 text-red-600 hover:bg-red-100",
};

const sizeClasses = {
  md: "h-10 gap-2 rounded-xl px-4 text-sm",
  /** For actions inside tables and card headers. */
  sm: "h-8 gap-1.5 rounded-lg px-3 text-xs",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: keyof typeof sizeClasses;
}

export function Button({ variant = "primary", size = "md", type = "button", className, ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center font-semibold whitespace-nowrap transition-colors",
        sizeClasses[size],
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600",
        "disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
        variantClasses[variant],
        className,
      )}
      {...props}
    />
  );
}

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label"> {
  /** Required: icon-only buttons need a name for screen readers. */
  label: string;
  tone?: "neutral" | "danger";
}

/** Small square button holding only an icon, as in table rows and pagination. */
export function IconButton({ label, tone = "neutral", type = "button", className, ...props }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        "inline-grid size-8 place-items-center rounded-lg border border-line bg-slate-50 transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600",
        "disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-4",
        tone === "danger" ? "text-red-500 hover:bg-red-50" : "text-ink-soft hover:bg-slate-100",
        className,
      )}
      {...props}
    />
  );
}
