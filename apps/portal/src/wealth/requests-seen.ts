/**
 * When the client last opened Access Requests, kept in this browser so the bell can count the answers that came
 * in since. Only a convenience: without it the bell counts every answer until the page is next opened.
 */
export const SEEN_KEY = "atomprive.access-requests.seen";

export function lastSeen(): string {
  try {
    return localStorage.getItem(SEEN_KEY) ?? "";
  } catch {
    return "";
  }
}
