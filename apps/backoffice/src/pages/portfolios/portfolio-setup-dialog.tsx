import { ApiError } from "@atomprive/api-client";
import { useGetCustomer, type CustomerDetail } from "@atomprive/api-client/backoffice";
import { Dialog, cn } from "@atomprive/ui";
import { useState } from "react";
import { AllocationStep } from "./client-allocation-page";
import { NetAumStep } from "./client-net-aum-page";
import { WorthStep } from "./client-worth-page";

/** What each step is handed: whose portfolio it is, and the two ways out of it. */
export type StepProps = {
  customerId: string;
  /** On to the next step, or out of the dialog from the last one. */
  onDone: () => void;
  /** Back to the step before. Not given to the first, which has none. */
  onBack?: () => void;
};

/**
 * A box somebody can see the edge of. The kit draws every control at #e3e9f1, which against white is
 * barely a box at all — on a screen that is almost entirely boxes, there is nothing to tell one from
 * the gap beside it.
 */
export const BOX = "border-ink/20";

const STEPS = [
  { at: 1, name: "What they hold" },
  { at: 2, name: "Non financial assets and loans" },
  { at: 3, name: "Net AUM" },
] as const;

/**
 * What a portfolio has to be told before it can be read against anything: what the client holds, and
 * then what they are worth beside it — what they own that nobody manages, and what they owe.
 *
 * <p>Two steps, because the first is the firm's twenty-two lines and the other two are a handful each.
 * Each saves as it is left, so somebody who closes the dialog half way keeps what they wrote and opens
 * again where the writing stopped.
 */
export function PortfolioSetupDialog({
  customerId,
  onClose,
}: {
  customerId: string;
  onClose: () => void;
}) {
  // Looked up here rather than handed in, so anything that can name a client can open this — the drift
  // queue and the manager's dashboard hold an id and nothing else.
  const client = useGetCustomer<CustomerDetail, ApiError>(customerId);
  const clientName = client.data?.client.fullName ?? "this client";
  const [step, setStep] = useState<1 | 2 | 3>(1);

  return (
    <Dialog
      open
      size="2xl"
      title={`Net AUM calculator for ${clientName}`}
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
        {step === 2 && <WorthStep customerId={customerId} onDone={() => setStep(3)} onBack={() => setStep(1)} />}
        {step === 3 && <NetAumStep customerId={customerId} onDone={onClose} onBack={() => setStep(2)} />}
      </div>
    </Dialog>
  );
}
