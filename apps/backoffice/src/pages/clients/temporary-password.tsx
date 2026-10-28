import { Alert, Button } from "@atomprive/ui";
import { Check, Copy, KeyRound } from "lucide-react";
import { useState } from "react";

/**
 * A way into the portal, handed over at the end of the thing that made it.
 *
 * <p>Here rather than on a row, and that is the whole point of it. A password printed on a list sits on a
 * shared screen for as long as the screen is open and is read by whoever walks past. Shown at the end of a
 * flow it is read once, by the person who just did the thing.
 *
 * <p>And it is only the password. Everything this panel used to explain — where it is typed, that it is
 * shown once, what a resend does to it — was read by somebody who already knew, standing in front of a
 * string they needed to copy. Four lines of prose around a credential is four lines between a desk and the
 * one thing they opened the window for.
 */
export function TemporaryPassword({
  password,
  onDone,
  doneLabel = "Done",
  children,
}: {
  /** Empty where none was made, which the panel says plainly rather than drawing an empty box. */
  password: string;
  /** Where there is a window to shut. Left out on a page, which has nothing to shut. */
  onDone?: () => void;
  doneLabel?: string;
  /** Anything to say above it, particular to what has just happened. */
  children?: React.ReactNode;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="space-y-4">
      {children}

      {password === "" ? (
        <Alert tone="warning">
          No password was made for this address. They can still use the link in their email.
        </Alert>
      ) : (
        <div className="rounded-xl border border-primary-100 bg-primary-50/60 px-5 py-4">
          <p className="flex items-center gap-1.5 text-2xs font-bold tracking-wider text-primary-700 uppercase">
            <KeyRound aria-hidden="true" className="size-3.5" />
            Temporary password
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code className="rounded-lg border border-primary-100 bg-white px-3 py-2 font-mono text-sm font-semibold tracking-wide text-ink select-all">
              {password}
            </code>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                // Best effort. A clipboard the browser refuses is not a failure worth a dialog — the
                // password is on screen and selectable, which is the thing that matters.
                void navigator.clipboard?.writeText(password).then(
                  () => setCopied(true),
                  () => setCopied(false),
                );
              }}
            >
              {copied ? (
                <>
                  <Check aria-hidden="true" className="size-3.5" /> Copied
                </>
              ) : (
                <>
                  <Copy aria-hidden="true" className="size-3.5" /> Copy
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {onDone && (
        <div className="flex justify-end">
          <Button onClick={onDone}>{doneLabel}</Button>
        </div>
      )}
    </div>
  );
}
