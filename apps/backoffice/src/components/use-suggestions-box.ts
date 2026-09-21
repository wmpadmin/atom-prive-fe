import { useState } from "react";
import { useDebouncedValue } from "../lib/use-debounced-value";

/**
 * The state behind a search box with suggestions. Suggestions are fetched for `typed`, the text once typing pauses
 * briefly, and only while `showing`, so nothing is fetched until someone types.
 */
export function useSuggestionsBox(value: string) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const typed = useDebouncedValue(value.trim(), 150);
  return { open, setOpen, active, setActive, typed, showing: open && typed !== "" };
}

export type SuggestionsBox = ReturnType<typeof useSuggestionsBox>;
