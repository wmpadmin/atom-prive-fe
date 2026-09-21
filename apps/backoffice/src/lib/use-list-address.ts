import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router";

export type AddressChanges = Record<string, string | number | null>;

/**
 * A list's search, filters and page, kept in the address (such as ?q=kapoor&page=2) so they survive opening a row
 * and coming back. Any change other than the page starts again from the first page.
 */
export function useListAddress() {
  const [params, setParams] = useSearchParams();
  const update = useCallback(
    (changes: AddressChanges) => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          if (!("page" in changes)) next.delete("page");
          for (const [key, value] of Object.entries(changes)) {
            if (value === null || value === "") next.delete(key);
            else next.set(key, String(value));
          }
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );
  return { params, update };
}

/**
 * The text in a list's search box: what's typed shows straight away, and the address (so the results) follows once
 * typing pauses. `query` is the search in the address, under ?q=.
 */
export function useTypedSearch(query: string, update: (changes: AddressChanges) => void) {
  const [search, setSearch] = useState(query);
  const [shownQuery, setShownQuery] = useState(query);
  if (query !== shownQuery) {
    // The address changed some other way, such as the menu link clearing the search.
    setShownQuery(query);
    if (query !== search.trim()) setSearch(query);
  }
  const timer = useRef<number>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  return {
    search,
    /** As someone types. */
    change(value: string) {
      setSearch(value);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => update({ q: value.trim() }), 300);
    },
    /** Searches straight away, such as when Enter is pressed. */
    apply(value: string) {
      window.clearTimeout(timer.current);
      setSearch(value);
      update({ q: value.trim() });
    },
    /** Empties the box; the caller updates the address. */
    clear() {
      window.clearTimeout(timer.current);
      setSearch("");
    },
    /** Stops a pending update, such as when leaving the page. */
    cancel() {
      window.clearTimeout(timer.current);
    },
  };
}
