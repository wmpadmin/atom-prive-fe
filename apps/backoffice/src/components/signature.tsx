import { cn } from "@atomprive/ui";
import { formatDateTime } from "../lib/labels";

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

/** Shown beside a form's submit button: whose signature the note will carry. */
export function SigningAs({ name }: { name: string }) {
  return (
    <span className="inline-flex items-baseline gap-2 text-xs text-ink-muted">
      Signing as
      <span className="text-lg leading-none text-primary-700" style={{ fontFamily: HANDWRITING }}>{name}</span>
    </span>
  );
}
