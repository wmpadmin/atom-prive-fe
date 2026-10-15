import { cn } from "@atomprive/ui";
import { Dialog } from "@atomprive/ui";
import { useState } from "react";
import { AllocationStep } from "./client-allocation-page";
import { OweStep } from "./client-loans-page";
import { OwnStep } from "./client-non-financial-page";

/** What each step is handed: whose portfolio it is, and the two ways out of it. */
export type StepProps = {
  customerId: string;
  /** On to the next step, or out of the dialog from the last one. */
  onDone: () => void;
  /** Back to the step before. Not given to the first, which has none. */
  onBack?: () => void;
};

const STEPS = [
  { at: 1, name: "What they hold" },
  { at: 2, name: "What they own" },
  { at: 3, name: "What they owe" },
] as const;

/**
 * The three things a portfolio has to be told before it can be read against anything: what the client
 * holds, what they own that nobody manages, and what they owe.
 *
 * <p>One sitting rather than three screens. Each step saves as it is left, so somebody who closes the
 * dialog half way keeps what they wrote and opens again where the writing stopped.
 */
export function PortfolioSetupDialog({
  customerId,
  clientName,
  onClose,
}: {
  customerId: string;
  clientName: string;
  onClose: () => void;
}) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const back = (at: 1 | 2) => () => setStep(at);

  return (
    <Dialog
      open
      size="xl"
      title="Set the portfolio up"
      description={`What ${clientName} holds, what they own that nobody manages, and what they owe.`}
      onClose={onClose}
    >
      {/* One bar a step, named, filled behind where somebody is. A step already done is a way back to
          it, because correcting what was written there should not mean starting again. */}
      <ol className="flex items-center gap-2">
        {STEPS.map((one) => (
          <li key={one.at} className="min-w-0 flex-1">
            <button
              type="button"
              disabled={one.at >= step}
              onClick={() => setStep(one.at as 1 | 2 | 3)}
              aria-label={`Back to step ${one.at}, ${one.name.toLowerCase()}`}
              className="block w-full"
            >
              <span
                className={cn(
                  "block h-1.5 rounded-full transition-colors",
                  one.at <= step ? "bg-primary-600" : "bg-slate-200",
                )}
              />
            </button>
            <span
              className={cn(
                "mt-1 block truncate text-2xs",
                one.at === step ? "font-semibold text-ink" : "text-ink-muted",
              )}
            >
              {one.name}
            </span>
          </li>
        ))}
        <li className="shrink-0 pb-4 text-2xs font-semibold tracking-wider text-ink-muted uppercase tabular-nums">
          Step {step} of {STEPS.length}
        </li>
      </ol>

      <div className="mt-4">
        {step === 1 && <AllocationStep customerId={customerId} onDone={() => setStep(2)} />}
        {step === 2 && <OwnStep customerId={customerId} onDone={() => setStep(3)} onBack={back(1)} />}
        {step === 3 && <OweStep customerId={customerId} onDone={onClose} onBack={back(2)} />}
      </div>
    </Dialog>
  );
}
