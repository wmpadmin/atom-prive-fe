import { createContext, useContext } from "react";

/**
 * The firm's own name as the form being filled in currently says it. The firm names itself all through its own
 * paperwork; none of that is taken out, it is asked for at the head of the form, and every line that prints it
 * reads from here so a change shows everywhere at once.
 */
export const FirmContext = createContext<Record<string, string>>({});

/** The firm's registered name, or nothing where the form has not been told it yet. */
export function useFirmName(): string | null {
  const said = useContext(FirmContext)["firmName"];
  return said?.trim() ? said : null;
}

/** What the form calls the firm in its own short form, where its wording uses one. */
export function useFirmShortName(): string | null {
  const said = useContext(FirmContext)["firmShortName"];
  return said?.trim() ? said : null;
}
