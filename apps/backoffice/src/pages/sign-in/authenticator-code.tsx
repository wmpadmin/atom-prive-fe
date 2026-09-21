import { ApiError } from "@atomprive/api-client";
import { verifyCode, type SignInResponse } from "@atomprive/api-client/backoffice";
import { Alert, Button, Field } from "@atomprive/ui";
import { useState, type FormEvent } from "react";
import { lockedMessage } from "./locked-message";

interface AuthenticatorCodeProps {
  challengeToken: string;
  /** True when they have just scanned the QR code, so this code also finishes setting it up. */
  justSetUp: boolean;
  onSignedIn: (response: SignInResponse) => void;
  onLocked: (message: string) => void;
  onExpired: (message: string) => void;
  onSetUpNeeded: () => void;
}

/** The code from the authenticator app, asked for at every sign-in. */
export function AuthenticatorCode({
  challengeToken,
  justSetUp,
  onSignedIn,
  onLocked,
  onExpired,
  onSetUpNeeded,
}: AuthenticatorCodeProps) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(undefined);
    try {
      onSignedIn(await verifyCode({ challengeToken, code }));
    } catch (caught) {
      if (!(caught instanceof ApiError)) {
        setError("Couldn't reach the server. Check your connection and try again.");
      } else if (caught.status === 423) {
        onLocked(lockedMessage(caught.problem.lockedUntil));
      } else if (caught.status === 409) {
        onSetUpNeeded();
      } else if (caught.status === 401 && caught.problem.attemptsLeft === undefined) {
        onExpired(caught.message);
      } else {
        setError(caught.message);
        setCode("");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-5 rounded-2xl border border-line bg-white p-8">
      <div>
        <h2 className="text-2xl font-bold">Enter your code</h2>
        <p className="mt-1 text-sm text-ink-muted">
          {justSetUp
            ? "Type the 6-digit code your authenticator app is showing for Atom Privé."
            : "Open your authenticator app and type the 6-digit code it shows for Atom Privé."}
        </p>
      </div>
      {error && <Alert tone="danger">{error}</Alert>}
      <Field id="code" label="6-digit code">
        <input
          id="code"
          name="code"
          value={code}
          onChange={(event) => setCode(event.target.value.replaceAll(/\D/g, "").slice(0, 6))}
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          required
          aria-describedby="code-help"
          className="w-full rounded-xl border border-line bg-white px-4 py-3 text-center font-mono text-2xl tracking-[0.5em] focus-visible:border-primary-600 focus-visible:outline-2 focus-visible:outline-primary-600"
        />
      </Field>
      <p id="code-help" className="text-xs text-ink-muted">
        The code changes every 30 seconds. Five wrong codes lock sign-in for an hour.
      </p>
      <Button type="submit" className="w-full" disabled={submitting || code.length < 6}>
        {submitting ? "Checking…" : "Sign in"}
      </Button>
    </form>
  );
}
