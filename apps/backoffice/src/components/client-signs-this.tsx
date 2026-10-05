import { PenLine } from "lucide-react";

/**
 * Stands where a form rules the client's own signing lines — a printed name, a signature, the date, and the
 * capacity somebody signs in.
 *
 * <p>None of those is asked of whoever is filling the form in. The firm writes a form up; the client puts
 * their name to it afterwards, and that signature is kept against the form itself rather than typed into its
 * answers by somebody else. Nothing here holds a section open either, so a form is finished when the firm has
 * written down everything that is the firm's to write.
 */
export function ClientSignsThis({ what = "Signature, printed name and date" }: { what?: string }) {
  return <SignedLater what={what} by="are the client's own, and are taken when they sign" />;
}

/**
 * The same, for the firm's own sign-off lines — a relationship manager, the MLRO, the SEO. Whoever signs the
 * form off does it in To sign, where their name, the moment and where they signed from are kept against the
 * form. Typing a name into a box here would be a second, weaker record of the same thing.
 */
export function FirmSignsThis({ what = "Name, date and signature" }: { what?: string }) {
  return <SignedLater what={what} by="are taken when the form is signed off" />;
}

function SignedLater({ what, by }: { what: string; by: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-dashed border-line bg-slate-50/70 px-4 py-3">
      <PenLine aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-ink-muted" />
      <p className="text-sm text-ink-muted">
        <span className="font-semibold text-ink-soft">{what}</span> {by}. Nothing to fill in here.
      </p>
    </div>
  );
}
