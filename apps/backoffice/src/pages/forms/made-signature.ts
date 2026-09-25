/**
 * A signature as it was made. It is kept with the rest of the answers, so it saves, reopens and clears the way
 * everything else written on the document does — and, like the rest, nothing makes anybody write it.
 *
 * @param forWhom set where somebody signed on another's behalf, which the paper then says under the signature
 */
export interface MadeSignature {
  kind: "TYPED" | "DRAWN";
  signature: string;
  signerName: string;
  forWhom?: string;
  at: string;
}

/** Reads a signature back out of the answers. Anything else written there is not one, and is left alone. */
export function madeSignature(written: string | undefined): MadeSignature | null {
  if (!written || !written.startsWith("{")) return null;
  try {
    const held = JSON.parse(written) as Partial<MadeSignature>;
    return held.signature && held.kind ? (held as MadeSignature) : null;
  } catch {
    return null;
  }
}

/**
 * A signature as a line of a summary reads it: the name that was signed, and who actually made it. Anything
 * that is not an e-signature is given back as it was, so a name typed in by hand still reads as that name.
 */
export function signatureText(written: string | undefined): string {
  const made = madeSignature(written);
  if (!made) return written ?? "";
  const name = made.kind === "TYPED" ? made.signature : "Signed";
  return made.forWhom ? `${name} (${made.signerName} for ${made.forWhom})` : `${name} (${made.signerName})`;
}
