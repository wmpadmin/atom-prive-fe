import { Eye } from "lucide-react";
import type { SupportView } from "./support-view";

/** Across the top of every page in a support view, so it can never be mistaken for the person's own session. */
export function SupportViewBanner({ view, onEnd }: { view: SupportView; onEnd: () => void }) {
  const until = new Date(view.until).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return (
    <div role="status" className="sticky top-0 z-50 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 bg-red-600 px-4 py-2 text-sm text-white print:hidden">
      <span className="flex items-center gap-2 font-semibold">
        <Eye aria-hidden="true" className="size-4" />
        Support view: you are seeing this as {view.name}. Read-only, ends at {until}.
      </span>
      <button type="button" onClick={onEnd} className="rounded-lg bg-white/15 px-3 py-1 text-xs font-bold hover:bg-white/25">
        End view
      </button>
    </div>
  );
}
