import { cn } from "@atomprive/ui";

// The pop-up's choice buttons (24 Nov 2026), shared by the Client Details and the risk profile steps.
//
// The chosen answer's border is the accent at 40%: the theme has no lighter shade of it, and a class naming one draws
// nothing, which left the border dark (24 Nov 2026).
export const pillClasses = (checked: boolean) => cn(
  "flex min-h-10 cursor-pointer items-center gap-2.5 rounded-xl border px-3.5 py-2 text-sm leading-snug font-medium text-ink transition-colors has-focus-visible:ring-2 has-focus-visible:ring-primary-600/30",
  checked ? "border-primary-600/40 bg-primary-50" : "border-line bg-white hover:border-primary-600/40",
);

/** A label record as choices, in its own order, which is the paper's. */
export function choicesOf<T extends string>(labels: Record<T, string>) {
  return (Object.keys(labels) as T[]).map((value) => ({ value, label: labels[value] }));
}
