/**
 * A support view: the IT Admin seeing a portal as somebody else, read-only, in a tab of its own.
 *
 * <p>The back office opens the view's page with the token in the address's fragment, which never reaches a
 * server. The page keeps it for this tab only and takes it out of the address at once. While a view is open the
 * tab never renews its session and never signs anybody out but the view itself, because the refresh cookie the
 * browser holds belongs to whoever is really signed in at this address.
 */
const KEY = "atomprive.support-view";

export type SupportView = { token: string; until: string; name: string };

/** Takes the view out of the address it was opened with, and keeps it for this tab. False when there is none. */
export function takeSupportView(hash: string): boolean {
  const fields = new URLSearchParams(hash.replace(/^#/, ""));
  const token = fields.get("token");
  const until = fields.get("until");
  const name = fields.get("name");
  if (!token || !until || !name) return false;
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ token, until, name } satisfies SupportView));
    return true;
  } catch {
    return false;
  }
}

/** The view open in this tab, while it lasts. */
export function currentSupportView(): SupportView | null {
  try {
    const held = sessionStorage.getItem(KEY);
    if (!held) return null;
    const view = JSON.parse(held) as SupportView;
    if (new Date(view.until).getTime() <= Date.now()) {
      sessionStorage.removeItem(KEY);
      return null;
    }
    return view;
  } catch {
    return null;
  }
}

export function forgetSupportView() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // Nothing kept, nothing to forget.
  }
}

/** The address that opens a view, with what the view's page needs in its fragment. */
export function supportViewAddress(openAt: string, view: SupportView) {
  return `${openAt}#${new URLSearchParams(view).toString()}`;
}
