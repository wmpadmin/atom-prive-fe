import { ApiError } from "@atomprive/api-client";
import { useListEntries, type EntryRow } from "@atomprive/api-client/backoffice";

/**
 * The firm's own relationship types, read from the firm rather than written down here.
 *
 * <p>These were a list in this file and an enum in the API, which meant a firm wanting to record a grandchild
 * had to wait for a deploy. They are configuration now: added on the Config screen and offered here the moment
 * they are there.
 *
 * <p>Only the ones the firm still uses are offered. One it has retired stays on every client already recorded
 * against it, which is why reading a stored code falls back to the code itself rather than showing a blank.
 */
export function useRelationshipTypes() {
  const listed = useListEntries<EntryRow[], ApiError>("RELATIONSHIP_TYPE");
  const inUse = listed.data ?? [];
  return {
    inUse,
    /** What to call a stored code. A retired one is not on the list any more, so it reads as its own code. */
    labelFor: (code: string | null | undefined) =>
      code ? (inUse.find((entry) => entry.code === code)?.name ?? code) : "",
  };
}
