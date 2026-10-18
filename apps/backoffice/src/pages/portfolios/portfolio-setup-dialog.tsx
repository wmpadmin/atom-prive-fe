import { ApiError } from "@atomprive/api-client";
import {
  useGetClientPortfolio,
  useGetCustomer,
  type CustomerDetail,
  type PortfolioStanding,
} from "@atomprive/api-client/backoffice";
import { Dialog, cn } from "@atomprive/ui";
import { useState } from "react";
import type { NonFinancialAssetRequest } from "@atomprive/api-client/backoffice";
import type { Calculator } from "./the-calculator";
import { AllocationStep } from "./client-allocation-page";
import { ModelStep } from "./client-model-page";
import { NetAumStep } from "./client-net-aum-page";
import { isSetUp } from "./set-up";
import { WorthStep } from "./client-worth-page";

/**
 * What the two figure steps have between them, until one of them sends it.
 *
 * <p>The calculator is one act typed over two screens, and the step that finishes it is the one that
 * sends it. So the first hands its half here instead of writing it: whoever walks on to the second
 * finds it waiting, and the whole calculator goes in a single request.
 */
export type Draft = {
  /** What the first step typed, where somebody has been there. Lines, currency and the loan. */
  held?: Pick<Calculator, "classes" | "currency" | "netAum" | "loanAmount">;
  /** What the second step typed, where somebody went there and came back. */
  owned?: NonFinancialAssetRequest[];
};

/** What each step is handed: whose portfolio it is, and the two ways out of it. */
export type StepProps = {
  customerId: string;
  /** On to the next step, or out of the dialog from the last one. */
  onDone: () => void;
  /** Back to the step before. Not given to the first, which has none. */
  onBack?: () => void;
  /** What the figure steps have between them. Not given to the steps that only read. */
  draft?: Draft;
  onDraft?: (draft: Draft) => void;
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
  { at: 4, name: "The plan" },
] as const;

/**
 * What a portfolio has to be told before it can be read against anything: what the client holds, and
 * then what they are worth beside it — what they own that nobody manages, and what they owe.
 *
 * <p>Two steps, because the first is the firm's twenty-two lines and the other two are a handful each.
 * The two of them are one act, though, so neither sends on its own: the first hands its figures to the
 * second and the second sends the whole calculator — written outright the first time and asked for every
 * time after. Walking away before the second is walking away before the act, and asks for nothing.
 */
export function PortfolioSetupDialog({
  customerId,
  openAt,
  onClose,
  onFinish,
}: {
  customerId: string;
  /**
   * The step to open on, where the way in has said. Somebody who came to change a figure came for the
   * step figures are written in, and landing them on the last of four to walk back through three is
   * making them find it.
   */
  openAt?: 1 | 2 | 3 | 4;
  /** Left without finishing: the X, Escape, the ground beside the dialog. */
  onClose: () => void;
  /** Done on the last step. Worked through to the end, which is a different thing from walking away. */
  onFinish: () => void;
}) {
  // Looked up here rather than handed in, so anything that can name a client can open this — the drift
  // queue and the manager's dashboard hold an id and nothing else.
  const client = useGetCustomer<CustomerDetail, ApiError>(customerId);
  const clientName = client.data?.client.fullName ?? "this client";
  const standing = useGetClientPortfolio<PortfolioStanding, ApiError>(customerId);

  // Where to open. A client already set up is opened to the table, because that is what somebody opening
  // them has come to read — walking them back through four steps of figures they wrote last week to reach
  // it is making them prove the work again. One who is not is opened at the beginning, which is the only
  // place their figures can come from. Set up means both halves: a plan put on a client who has written
  // nothing down opened to a table of a model's shares of nothing.
  const [chosen, setStep] = useState<1 | 2 | 3 | 4 | null>(null);
  // What the first figure step typed, kept here so the second can send the whole calculator at once.
  // Thrown away with the dialog: a walk that was abandoned asked for nothing, which is how every other
  // change on the platform behaves.
  const [draft, setDraft] = useState<Draft>({});
  const settled = standing.isSuccess || standing.isError;
  const step = chosen ?? openAt ?? (isSetUp(standing.data) ? 4 : 1);

  return (
    <Dialog
      open
      size="2xl"
      tall
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
              onClick={() => setStep(one.at as 1 | 2 | 3 | 4)}
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

      {/* The step fills the height the dialog is held at, so its buttons sit at the foot of the dialog
          rather than halfway up it on a short step. */}
      <div className="mt-4 flex flex-1 flex-col">
        {/* Nothing until it is known which step this client opens on, so nobody is shown the first and
            moved off it a moment later. */}
        {settled && step === 1 && (
          <AllocationStep customerId={customerId} onDone={() => setStep(2)} draft={draft} onDraft={setDraft} />
        )}
        {settled && step === 2 && (
          <WorthStep
            customerId={customerId}
            onDone={() => setStep(3)}
            onBack={() => setStep(1)}
            draft={draft}
            onDraft={setDraft}
          />
        )}
        {settled && step === 3 && <NetAumStep customerId={customerId} onDone={() => setStep(4)} onBack={() => setStep(2)} />}
        {settled && step === 4 && <ModelStep customerId={customerId} onDone={onFinish} onBack={() => setStep(3)} />}
      </div>
    </Dialog>
  );
}
