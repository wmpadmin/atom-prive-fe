import { cn } from "@atomprive/ui";
import { formatDateTime, roleLabel } from "../lib/labels";

/**
 * Handwriting faces the reader's computer already has: Snell Roundhand on a Mac, Segoe Script on Windows, then any
 * cursive face. Nothing is downloaded for it.
 */
const HANDWRITING = '"Snell Roundhand", "Segoe Script", "Brush Script MT", "Lucida Handwriting", cursive';

/**
 * A note's signature (23 Nov 2026): the name of whoever wrote it, written as a signature when they submitted it, with
 * when. An RM's note carries the RM's, Operations' carries Operations'.
 */
export function Signature({ name, at, className }: { name: string | null | undefined; at?: string | null; className?: string }) {
  if (!name) return null;
  return (
    <span className={cn("inline-flex flex-col items-start", className)}>
      <span aria-label={`Signed by ${name}`} className="border-b border-line pr-6 text-xl leading-tight text-primary-700"
        style={{ fontFamily: HANDWRITING }}>
        {name}
      </span>
      <span className="mt-0.5 text-2xs text-ink-muted">Digitally signed{at ? ` · ${formatDateTime(at)}` : ""}</span>
    </span>
  );
}

/** Shown beside a form's submit button: whose signature the note will carry, and in which role (25 Nov 2026). */
export function SigningAs({ name, role }: { name: string; role?: string | null }) {
  return (
    <span className="inline-flex flex-wrap items-baseline gap-2 text-xs text-ink-muted">
      Signing as
      <span className="text-lg leading-none text-primary-700" style={{ fontFamily: HANDWRITING }}>{name}</span>
      {role && <RolePill role={role} />}
    </span>
  );
}

/** The role a note was signed in, as a tag: an RM's in blue, Operations' in teal. */
function RolePill({ role }: { role: string }) {
  const tone = role === "ADVISOR" ? "bg-primary-50 text-primary-700" : role === "OPERATIONS" ? "bg-teal-50 text-teal-700" : "bg-slate-100 text-ink-soft";
  return <span className={cn("rounded-full px-2 py-0.5 text-2xs font-semibold", tone)}>{roleLabel(role)}</span>;
}

/**
 * A note's signature in a history of notes (25 Nov 2026): the writer's name as a signature, the role they wrote it in
 * (none on a note signed before then), and when.
 */
export function SignedLine({ name, role, at }: { name: string; role?: string | null; at?: string | null }) {
  return (
    <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs text-ink-muted">
      Signed
      <span aria-label={`Signed by ${name}`} className="text-xl leading-none text-primary-700" style={{ fontFamily: HANDWRITING }}>{name}</span>
      {role && <RolePill role={role} />}
      {at && <span>{formatDateTime(at)}</span>}
    </p>
  );
}
