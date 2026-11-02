import { takeSupportView } from "@atomprive/support/support-view";
import { useEffect, useState } from "react";

/**
 * Where a support view of the back office opens: takes the view out of the address, keeps it for this tab, and
 * reloads into the back office as that member of staff.
 */
export function SupportViewPage() {
  // Taken once, on the way in: the address is read and the view kept before anything is drawn.
  const [taken] = useState(() => takeSupportView(window.location.hash));
  useEffect(() => {
    if (taken) window.location.replace("/");
  }, [taken]);
  return (
    <p className="p-8 text-center text-sm text-ink-muted">
      {!taken ? "This support view link is not valid. Open it again from Sign in as." : "Opening the support view…"}
    </p>
  );
}
