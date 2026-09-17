import type { ReactNode } from "react";
import { cn } from "./cn";

type Tone = "neutral" | "success" | "info" | "warning" | "danger";

const badgeTones: Record<Tone, string> = {
  neutral: "bg-slate-100 text-slate-500",
  success: "bg-emerald-50 text-emerald-700",
  info: "bg-primary-50 text-primary-600",
  warning: "bg-amber-50 text-amber-700",
  danger: "bg-red-50 text-red-600",
};

/** Status pill, e.g. Active, Invited, Deactivated. */
export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold", badgeTones[tone])}>
      {children}
    </span>
  );
}

const alertTones = {
  danger: "border-red-200 bg-red-50 text-red-800",
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  info: "border-primary-100 bg-primary-50 text-primary-700",
};

/** A message about the whole page or form. Errors are announced to screen readers straight away. */
export function Alert({ tone, children }: { tone: keyof typeof alertTones; children: ReactNode }) {
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cn("rounded-xl border px-4 py-3 text-sm", alertTones[tone])}>
      {children}
    </div>
  );
}

export function Card({ title, description, actions, children, className }: {
  title?: string;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-2xl border border-line bg-white", className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5">
          <div>
            {title && <h2 className="text-base font-bold text-ink">{title}</h2>}
            {description && <p className="mt-0.5 text-xs text-ink-muted">{description}</p>}
          </div>
          {actions}
        </header>
      )}
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

/** Summary number with an icon, as in the cards above the staff table. */
export function StatCard({ icon, value, label }: { icon: ReactNode; value: ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-line bg-white px-5 py-5">
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary-50 text-primary-600 [&_svg]:size-5">
        {icon}
      </span>
      <p className="flex items-baseline gap-2">
        <span className="text-3xl font-bold text-ink">{value}</span>
        <span className="text-sm text-ink-muted">{label}</span>
      </p>
    </div>
  );
}

const avatarTones = {
  warm: "bg-[#3b2418] text-orange-400",
  navy: "bg-brand-900 text-white",
};

/** Initials in a circle; people have no profile photos in the back-office yet. */
export function Avatar({ name, tone = "warm", className }: { name: string; tone?: keyof typeof avatarTones; className?: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  return (
    <span
      aria-hidden="true"
      className={cn("grid size-9 shrink-0 place-items-center rounded-full text-xs font-bold", avatarTones[tone], className)}
    >
      {initials || "?"}
    </span>
  );
}
