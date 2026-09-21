import type { CustomerRow } from "@atomprive/api-client/backoffice";

/** The client an Admin is previewing emails against, instead of the made-up sample. */
export interface PreviewClient {
  id: string;
  code: string;
  fullName: string;
  /** The first advisor looking after them, if any. */
  advisorName: string | null;
}

const CHOSEN_CLIENT = "atomprive.templates.previewClient";

export function asPreviewClient(row: CustomerRow): PreviewClient {
  return { id: row.id, code: row.code, fullName: row.fullName, advisorName: row.advisors[0]?.fullName ?? null };
}

export function readPreviewClient(): PreviewClient | null {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(CHOSEN_CLIENT) ?? "null");
    if (saved && typeof saved === "object" && "id" in saved && "fullName" in saved) {
      return saved as PreviewClient;
    }
  } catch {
    // A browser that blocks storage just gets the sample client.
  }
  return null;
}

export function rememberPreviewClient(client: PreviewClient | null) {
  try {
    if (client) localStorage.setItem(CHOSEN_CLIENT, JSON.stringify(client));
    else localStorage.removeItem(CHOSEN_CLIENT);
  } catch {
    // Nothing to do: the choice then lasts for this visit only.
  }
}

/**
 * What a real client fills in. Everything else — the advisor's address, proposal details — has nowhere to come from
 * yet, so those placeholders keep their sample values.
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
