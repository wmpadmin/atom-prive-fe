import { useState, type ReactNode } from "react";
import { cn } from "./cn";

type Tone = "neutral" | "success" | "info" | "warning" | "danger";

const badgeTones: Record<Tone, string> = {
  neutral: "bg-slate-100 text-slate-500",
  success: "bg-emerald-50 text-emerald-700",
  info: "bg-primary-50 text-primary-600",
  warning: "bg-amber-50 text-amber-700",
  // red-700 rather than red-600: on the pale red fill the lighter one measures 4.36:1, just under
  // the 4.5 small text needs. The two are indistinguishable side by side.
  danger: "bg-red-50 text-red-700",
};

/** Status pill, e.g. Active, Invited, Deactivated. */
export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold whitespace-nowrap", badgeTones[tone])}>
      {children}
    </span>
  );
}

const alertTones = {
  danger: "border-red-200 bg-red-50 text-red-800",
  /** Something needs attention but nothing has gone wrong, such as a proposal sent back for changes. */
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  info: "border-primary-100 bg-primary-50 text-primary-700",
};

/** A message about the whole page or form. Errors are announced to screen readers straight away. */
/**
 * A note on a screen: what somebody needs to know before they act, rather than what went wrong after they did.
 *
 * <p>Set in the same red as a form's own notes, so that a note reads as a note wherever it appears and nobody
 * has to work out whether this particular grey paragraph was worth reading. It is not an error and carries no
 * alert role — it is simply the thing worth saying.
 *
 * @param panel sets the note in its own tinted box, for a note that explains a whole section rather than one
 * box in it
 */
export function Note({ panel, children, className }: { panel?: boolean; children: ReactNode; className?: string }) {
  return (
    <p
      className={cn(
        "text-xs text-red-700",
        panel && "rounded-xl border border-red-200 bg-red-50 px-4 py-3",
        className,
      )}
    >
      {children}
    </p>
  );
}

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

/**
 * A member of the firm's own face: brown, and in a rounded square.
 *
 * <p>Shape and colour both, because either alone fails somewhere. Colour alone goes when a photograph
 * fills the circle; shape alone goes on a reader who does not notice corners. Together, whose face it
 * is reads before the name does — which is the point, on screens where an adviser and the client they
 * advise sit in the same row.
 *
 * <p>Everything else it does is {@link Avatar}'s, including falling back to initials when there is no
 * photograph and when there is one that will not load.
 */
export function StaffAvatar({ name, photo, className }: {
  name: string;
  photo?: string | null;
  className?: string;
}) {
  return <Avatar name={name} photo={photo} className={cn("rounded-lg bg-staff text-staff-ink", className)} />;
}

/** A client's face, in a circle: their photograph, or their initials where the firm holds none. */
export function Avatar({ name, photo, className }: {
  name: string;
  /**
   * Their photograph, where the firm has one. Anything an <img> can load: a URL, or the data URI a
   * photograph kept in the database comes back as.
   *
   * <p>The initials are not a placeholder for it, they are the other half of the same thing — most people
   * have no photograph on file and never will, and a row of empty grey circles says less than a row of
   * initials does.
   */
  photo?: string | null;
  className?: string;
}) {
  // A photograph that will not load falls back to the initials rather than to a hole. Kept per render of
  // this avatar: the same person may be drawn a dozen times on one screen, and one broken image should not
  // blank the others.
  const [broken, setBroken] = useState(false);
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  const showing = photo && !broken;
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid size-9 shrink-0 place-items-center overflow-hidden rounded-full text-xs font-bold",
        showing ? "bg-slate-200" : "bg-brand-900 text-primary-600",
        className,
      )}
    >
      {showing ? (
        <img src={photo} alt="" loading="lazy" onError={() => setBroken(true)} className="size-full object-cover" />
      ) : (
        initials || "?"
      )}
    </span>
  );
}
