import { takeSupportView } from "@atomprive/support/support-view";
import { useEffect, useState } from "react";

/**
 * Where the back office opens a support view: takes the view out of the address, keeps it for this tab, and
 * reloads into the portal as the client, so nothing of the token is left in the address bar or the history.
 */
export function SupportViewPage() {
  // Taken once, on the way in: the address is read and the view kept before anything is drawn.
  const [taken] = useState(() => takeSupportView(window.location.hash));
  useEffect(() => {
    if (taken) window.location.replace("/new");
  }, [taken]);
  return (
    <p className="p-8 text-center text-sm text-ink-muted">
      {!taken ? "This support view link is not valid. Open it again from the back office." : "Opening the support view…"}
    </p>
  );
}
