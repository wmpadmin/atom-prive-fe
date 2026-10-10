import { useCallback, useEffect, useRef, useState } from "react";

/**
 * A marker that says something was just saved, and takes itself down again.
 *
 * <p>A button that writes a date somebody has already typed changes nothing on screen when it works, and a
 * screen that looks the same afterwards reads as a button that did nothing. This is what lets it say it did.
 *
 * <p>Set from the save itself rather than worked out from the clock: what happened is an event, and reading
 * the time while rendering would make the answer change under its own feet.
 *
 * @return whether to say so, and the call to make when a save lands
 */
export function useJustSaved(forMillis = 4000): readonly [boolean, () => void] {
  const [shown, setShown] = useState(false);
  const takingDown = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (takingDown.current) clearTimeout(takingDown.current);
  }, []);

  const say = useCallback(() => {
    setShown(true);
    if (takingDown.current) clearTimeout(takingDown.current);
    takingDown.current = setTimeout(() => setShown(false), forMillis);
  }, [forMillis]);

  return [shown, say] as const;
}
