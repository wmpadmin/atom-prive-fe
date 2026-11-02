/**
 * The last back-office page somebody was on before Report an issue, so a ticket can say where the problem was
 * without asking. Kept for this tab only; without storage the ticket form simply starts with the field empty.
 */
const KEY = "atomprive.backoffice.last-page";

export function rememberPage(href: string) {
  try {
    sessionStorage.setItem(KEY, href);
  } catch {
    // A private window may refuse storage; the ticket form then starts empty.
  }
}

export function lastPage(): string {
  try {
    return sessionStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}
