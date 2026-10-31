import type { RequestClearances } from "@atomprive/api-client/backoffice";
import { cn } from "@atomprive/ui";
import { Check } from "lucide-react";
import { formatDate } from "../../lib/labels";

type StepState = "done" | "current" | "ahead";

/**
 * The five places a deactivation passes through, and which one this client is at.
 *
 * <p>Worked out from the request rather than stored as a stage of its own: a stage that is saved can
 * fall out of step with the answers it is meant to summarise, and this one cannot. The last step is never
 * reached here, because a deactivated client has no open request left to draw it from.
 */
export function DeactivationStepper({ standing }: { standing: RequestClearances }) {
  const sent = Boolean(standing.startedAt);
  const steps: { label: string; when?: string | null; state: StepState }[] = [
    { label: "Request raised", when: standing.askedAt, state: "done" },
    {
      label: sent ? "Clearance in progress" : "Waiting on Operations",
      when: standing.startedAt,
      state: standing.clear ? "done" : "current",
    },
    { label: "All clearances completed", when: standing.clearedAt, state: standing.clear ? "done" : "ahead" },
    { label: "Admin review", state: standing.clear ? "current" : "ahead" },
    { label: "Deactivated", state: "ahead" },
  ];

  return (
    <ol aria-label="Where this deactivation has got to" className="flex flex-wrap items-start gap-y-4">
      {steps.map((step, index) => (
        <li key={step.label} className="flex min-w-36 flex-1 items-start gap-2">
          <div className="flex flex-col items-center gap-1.5 text-center">
            <span
              aria-hidden="true"
              className={cn(
                "grid size-8 place-items-center rounded-full border-2 text-sm font-bold",
                step.state === "done" && "border-emerald-500 bg-emerald-500 text-white",
                step.state === "current" && "border-primary-600 bg-primary-600 text-white",
                step.state === "ahead" && "border-line bg-white text-ink-muted",
              )}
            >
              {step.state === "done" ? <Check className="size-4" /> : index + 1}
            </span>
            <span
              className={cn(
                "max-w-28 text-xs font-semibold text-balance",
                step.state === "current" ? "text-primary-700" : step.state === "done" ? "text-ink" : "text-ink-muted",
              )}
            >
              {step.label}
              <span className="sr-only">
                {step.state === "done" ? " (done)" : step.state === "current" ? " (current step)" : " (not yet)"}
              </span>
            </span>
            {step.when && <span className="text-2xs text-ink-muted">{formatDate(step.when)}</span>}
          </div>
          {index < steps.length - 1 && (
            <span
              aria-hidden="true"
              className={cn(
                "mt-4 h-0.5 flex-1 rounded-full",
                step.state === "done" ? "bg-emerald-400" : "bg-line",
              )}
            />
          )}
        </li>
      ))}
    </ol>
  );
}
