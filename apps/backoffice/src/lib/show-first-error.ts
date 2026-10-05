import { useEffect, useRef, type RefObject } from "react";
import type { FormErrors } from "./api-errors";

/**
 * Takes the reader to what the server refused.
 *
 * <p>A long form puts its first fields a screen or more above the button that submits it. The message that
 * says what is wrong is rendered against the field it is about, which is the right place to read it and the
 * wrong place to find it: somebody who has just pressed Save at the foot of the form sees nothing happen at
 * all, and presses it again. The message was always there; this is what makes it arrive.
 *
 * <p>What it looks for is whatever the form actually drew, in the order the form draws it: a field the
 * refusal marked, then any message a field is showing, then a message about the form as a whole. Fields are
 * marked by {@code describedBy} and messages are drawn by {@code Field}, so neither has to be remembered
 * here — a form that shows its errors at all is one this can find them in.
 */
export function useShowFirstError(errors: FormErrors, within: RefObject<HTMLElement | null>) {
  // What was already shown, so a later render does not keep snatching the cursor back from somebody who is
  // part way through putting it right.
  const shown = useRef<string>("");

  useEffect(() => {
    const named = Object.keys(errors.fields);
    const refusal = `${errors.form ?? ""}|${named.join(",")}`;
    if (refusal === shown.current) return;
    shown.current = refusal;
    if (named.length === 0 && errors.form === undefined) return;

    const form = within.current;
    if (!form) return;
    // One query over the three, so the match is whichever comes first on the page rather than whichever
    // kind was looked for first.
    const found = form.querySelector<HTMLElement>(
      '[aria-invalid="true"], [data-form-error], p[id$="-error"]',
    );
    if (!found) return;
    found.scrollIntoView({ block: "center", behavior: "smooth" });
    // Only a field takes the cursor. Putting it on a paragraph would move it away from the box somebody has
    // to type in, which is worse than leaving it where they left it.
    if (found.matches('[aria-invalid="true"]')) found.focus({ preventScroll: true });
  }, [errors, within]);
}
