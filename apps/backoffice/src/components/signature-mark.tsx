import { cn } from "@atomprive/ui";
import { PenLine } from "lucide-react";
import { formatDate } from "../lib/labels";
import type { MadeSignature } from "../pages/forms/made-signature";

/**
 * What a signature is set in. No face is fetched from anywhere: these are the script faces a Mac or a Windows
 * machine already has, so a signature reads as handwriting wherever the back office is opened.
 */
const SIGNATURE_FACE = '"Segoe Script", "Bradley Hand", "Snell Roundhand", "Apple Chancery", cursive';

const SHAPES = {
  block: "mt-4 block w-80 max-w-full",
  inline: "inline-block w-72 max-w-full align-bottom",
  cell: "w-full",
  field: "block w-full",
} as const;

/**
 * A signature where a paper asks for one — on a document's ruled line, in a table cell, or as a field on a
 * form. Made, it is the signature itself over the rule; unmade, it is the place to sign.
 */
export function SignatureMark({
  made,
  who,
  shape = "block",
  onOpen,
  disabled,
  written,
}: {
  made: MadeSignature | null;
  /** Whose signature the paper asks for, where it says; shown on the empty place so it is clear who signs. */
  who?: string;
  shape?: keyof typeof SHAPES;
  /** Set where this person may sign here; without it the place only shows. */
  onOpen?: () => void;
  disabled?: boolean;
  /** A name typed in before this was an e-signature, kept readable rather than thrown away. */
  written?: string;
}) {
  const frame = SHAPES[shape];

  if (made) {
    const mark = (
      <>
        {made.kind === "DRAWN" ? (
          <img src={made.signature} alt={`Signed by ${made.signerName}`} className="h-12 w-auto object-contain object-left" />
        ) : (
          <span className="block h-12 truncate text-3xl leading-[3rem] text-ink" style={{ fontFamily: SIGNATURE_FACE }}>
            {made.signature}
          </span>
        )}
        <span className="block border-t border-ink-muted/60 pt-1 text-xs text-ink-muted">
          {made.forWhom ? `${made.signerName} for ${made.forWhom}` : made.signerName} · {formatDate(made.at)}
        </span>
      </>
    );
    // A signature is changed the way it was made: by opening the same place again.
    if (!onOpen || disabled) return <span className={frame}>{mark}</span>;
    return (
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Change the signature by ${made.signerName}`}
        className={cn(frame, "rounded-lg text-left hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600")}
      >
        {mark}
      </button>
    );
  }

  const inside = (
    <>
      <PenLine aria-hidden="true" className="size-4 shrink-0" />
      <span className="truncate">{onOpen && !disabled ? "Sign here" : "Signature"}</span>
      {written ? (
        <span className="truncate font-normal opacity-80">{written}</span>
      ) : who ? (
        <span className="truncate text-2xs tracking-wider uppercase opacity-70">{who}</span>
      ) : null}
    </>
  );
  if (!onOpen || disabled) {
    return (
      <span className={cn(frame, "flex h-12 items-center gap-2 rounded-lg border border-dashed border-line bg-canvas px-3 text-sm text-ink-muted", shape === "inline" && "inline-flex")}>
        {inside}
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        frame,
        "flex h-12 items-center gap-2 rounded-lg border border-dashed border-primary-600 bg-primary-50 px-3 text-sm font-semibold text-primary-800",
        "hover:bg-primary-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600",
        shape === "inline" && "inline-flex",
      )}
    >
      {inside}
    </button>
  );
}
