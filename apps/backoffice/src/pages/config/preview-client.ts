import type { CustomerRow } from "@atomprive/api-client/backoffice";

/** The client an Admin is previewing emails against, instead of the made-up sample. */
export interface PreviewClient {
  id: string;
  code: string;
  fullName: string;
  /** Their photograph, where the firm has one; their initials stand in where it has not. */
  photo: string | null;
  /** The first relationship manager looking after them, if any. */
  advisorName: string | null;
}

const CHOSEN_CLIENT = "atomprive.templates.previewClient";

export function asPreviewClient(row: CustomerRow): PreviewClient {
  return {
    id: row.id,
    code: row.code,
    fullName: row.fullName,
    photo: row.photo,
    advisorName: row.advisors[0]?.fullName ?? null,
  };
}

export function readPreviewClient(): PreviewClient | null {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(CHOSEN_CLIENT) ?? "null");
    if (saved && typeof saved === "object" && "id" in saved && "fullName" in saved) {
      // A choice remembered before photographs were on this object has no photo. Null rather than
      // missing, so the type is not lying to the avatar that reads it.
      const one = saved as PreviewClient;
      return { ...one, photo: one.photo ?? null };
    }
  } catch {
    // A browser that blocks storage just gets the sample client.
  }
  return null;
}

export function rememberPreviewClient(client: PreviewClient | null) {
  try {
    // The photograph goes in with the rest of it, about 17KB of data URI under one key that is
    // overwritten on every pick. Left out, the chosen client would come back after a reload wearing
    // initials they do not wear anywhere else on the screen.
    if (client) localStorage.setItem(CHOSEN_CLIENT, JSON.stringify(client));
    else localStorage.removeItem(CHOSEN_CLIENT);
  } catch {
    // Nothing to do: the choice then lasts for this visit only.
  }
}

/**
 * The placeholders a chosen client stands in for. Named once, because two things ask the question: filling
 * them in, and deciding whether choosing a client would change anything on screen at all.
 */
const FILLED_BY_A_CLIENT = ["client_name", "client_code", "client_list", "client_count", "advisor_name"];

/**
 * Whether picking a client would change a word of this email.
 *
 * <p>Most emails name a client somewhere. Some are written to a member of staff and name nobody else — the
 * password reset link is one — and on those the picker was a choice that did nothing, beside a preview that
 * went on saying the sample name whatever was chosen.
 */
export function aClientFillsSomethingIn(placeholders: string[]) {
  return placeholders.some((name) => FILLED_BY_A_CLIENT.includes(name));
}

/**
 * What a real client fills in. Everything else — the relationship manager's address, proposal details — has nowhere
 * to come from yet, so those placeholders keep their sample values.
 */
export function placeholderValues(client: PreviewClient | null): Record<string, string> | null {
  if (!client) return null;
  return {
    client_name: client.fullName,
    client_code: client.code,
    client_list: client.fullName,
    client_count: "1",
    ...(client.advisorName ? { advisor_name: client.advisorName } : {}),
  };
}
