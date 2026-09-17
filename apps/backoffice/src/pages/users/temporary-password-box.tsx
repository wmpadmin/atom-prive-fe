import { Button } from "@atomprive/ui";
import { Check, Copy } from "lucide-react";
import { useState } from "react";

/** Shows a new temporary password once, for the Admin to pass on to the user. */
export function TemporaryPasswordBox({ email, password }: { email: string; password: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(password);
    setCopied(true);
  }

  return (
    <div className="space-y-3">
      <dl className="space-y-3 rounded-xl border border-line bg-canvas/60 p-4">
        <div>
          <dt className="text-[11px] font-semibold tracking-wider text-ink-muted uppercase">Sign-in email</dt>
          <dd className="mt-1 text-sm font-medium">{email}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-semibold tracking-wider text-ink-muted uppercase">Temporary password</dt>
          <dd className="mt-1 flex items-center justify-between gap-3">
            <code className="font-mono text-lg font-semibold tracking-wide select-all">{password}</code>
            <Button variant="secondary" onClick={() => void copy()}>
              {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </dd>
        </div>
      </dl>
      <p className="text-xs text-ink-muted">
        This password won't be shown again. Share it privately, and they'll choose their own password when they sign in.
      </p>
    </div>
  );
}
