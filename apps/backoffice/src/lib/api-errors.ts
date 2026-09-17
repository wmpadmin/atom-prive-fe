import { ApiError } from "@atomprive/api-client";

export interface FormErrors {
  /** Message for the form as a whole, shown above the fields. */
  form?: string;
  fields: Record<string, string>;
}

/** Splits an API failure into per-field messages and one message for the whole form. */
export function toFormErrors(error: unknown): FormErrors {
  if (error instanceof ApiError) {
    const fields = error.problem.errors ?? {};
    const hasFieldErrors = Object.keys(fields).length > 0;
    return { form: hasFieldErrors ? undefined : error.message, fields };
  }
  return { form: "Couldn't reach the server. Check your connection and try again.", fields: {} };
}

export const noErrors: FormErrors = { fields: {} };
