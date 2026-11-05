import type { SignaturePackRowStatus } from "@atomprive/api-client/backoffice";

/** How a pack's state reads on screen, and the tone it is shown in. */
export const packTones: Record<SignaturePackRowStatus, "warning" | "success" | "neutral"> = {
  OUT: "warning",
  COMPLETE: "success",
  WITHDRAWN: "neutral",
};

/** What is left to do on a pack, said from the point of view of whoever is reading it. */
export function whatIsLeft(formsToSign: number, formCount: number) {
  if (formsToSign === 0) return `All ${formCount === 1 ? "signed" : `${formCount} signed`}`;
  return `${formsToSign} of ${formCount} to sign`;
}
