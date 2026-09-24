import type { CaseFormRow } from "@atomprive/api-client/backoffice";

/**
 * A form is ready to go out to be signed when it has been filled in right through and is not already out or
 * signed. The documents that are only read and signed have nothing to fill in, so they are ready as soon as
 * they exist.
 */
export function readyToSend(form: CaseFormRow) {
  return form.formId !== null && form.status === "DRAFT" && form.completedSections >= form.totalSections;
}
