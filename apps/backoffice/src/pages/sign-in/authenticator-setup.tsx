import { ApiError } from "@atomprive/api-client";
import { setUpAuthenticator, setUpAuthenticatorAgain, type MfaSetupResponse } from "@atomprive/api-client/backoffice";
import { Alert, Button } from "@atomprive/ui";
import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/** The secret in blocks of four, so it can be typed in by hand without losing your place. */
function inBlocks(secret: string) {
  return (secret.match(/.{1,4}/g) ?? []).join(" ");
}

interface AuthenticatorSetupProps {
  challengeToken: string;
  onReady: () => void;
  onExpired: (message: string) => void;
}

/** First sign-in: scan the QR code with an authenticator app, then move on to the code it shows. */
export function AuthenticatorSetup({ challengeToken, onReady, onExpired }: AuthenticatorSetupProps) {
  const [setup, setSetup] = useState<MfaSetupResponse>();
  const [error, setError] = useState<string>();
  const [copied, setCopied] = useState(false);
  const [startingAgain, setStartingAgain] = useState(false);

  // React runs effects twice in development and the screen can be re-drawn, so the request is kept rather than
  // repeated: asking twice would be answered with the same secret, but there is no reason to ask.
  const asked = useRef<{ token: string; setup: Promise<MfaSetupResponse> }>(undefined);

  useEffect(() => {
    let current = true;
    if (asked.current?.token !== challengeToken) {
      asked.current = { token: challengeToken, setup: setUpAuthenticator({ challengeToken }) };
    }
    asked.current.setup
      .then((response) => current && setSetup(response))
      .catch((caught: unknown) => {
        if (!current) return;
        if (caught instanceof ApiError && (caught.status === 401 || caught.status === 409)) {
          onExpired(caught.message);
        } else {
          setError(caught instanceof ApiError ? caught.message : "Couldn't reach the server. Try again.");
        }
      });
    return () => {
      current = false;
    };
  }, [challengeToken, onExpired]);

  /*
   * A different code, for an app that never got this one.
   *
   * <p>Showing the same QR again is the right answer when the screen was simply redrawn, and it is what
   * asking twice does. It is the wrong answer for somebody who scanned this into the wrong account, or
   * pressed on without scanning at all and then deleted whatever half-entry their app made: the code was
   * never the problem, so repeating it does not help.
   *
   * <p>Safe only because nothing is confirmed yet. The server enforces that, not this screen.
   */
  async function startAgain() {
    setStartingAgain(true);
    setError(undefined);
    setCopied(false);
    try {
      const fresh = await setUpAuthenticatorAgain({ challengeToken });
      // Replaces what the first request cached, or a redraw would bring the old code straight back.
      asked.current = { token: challengeToken, setup: Promise.resolve(fresh) };
      setSetup(fresh);
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : "Couldn't reach the server. Try again.",
      );
    } finally {
      setStartingAgain(false);
    }
  }

  async function copySecret() {
    if (!setup) return;
    try {
      await navigator.clipboard.writeText(setup.secret);
      setCopied(true);
    } catch {
      setError("Couldn't copy the key. Type it in instead.");
    }
  }

  return (
    <div className="w-full max-w-sm space-y-5 rounded-2xl border border-line bg-white p-8">
      <div>
        <h2 className="text-2xl font-bold">Set up your authenticator</h2>
        <p className="mt-1 text-sm text-ink-muted">
          You do this once. After that, every sign-in asks for the code your app is showing.
        </p>
      </div>
      {error && <Alert tone="danger">{error}</Alert>}
      <ol className="space-y-4 text-sm">
        <li>
          <p className="font-semibold">1. Open Google Authenticator on your phone</p>
          <p className="text-ink-muted">Or any authenticator app — Microsoft Authenticator and 1Password work too.</p>
        </li>
        <li className="space-y-3">
          <p className="font-semibold">2. Scan this QR code</p>
          {setup ? (
            <div
              // Drawn by the API from the same secret; it never contains anything a person typed.
              dangerouslySetInnerHTML={{ __html: setup.qrSvg }}
              className="mx-auto size-48 rounded-xl border border-line bg-white p-2 [&>svg]:size-full"
            />
          ) : (
            <div className="mx-auto size-48 animate-pulse rounded-xl border border-line bg-slate-100" />
          )}
        </li>
        <li className="space-y-2">
          <p className="font-semibold">3. Or type this key in by hand</p>
          <div className="space-y-2 rounded-lg bg-slate-50 p-3">
            <code className="block font-mono text-sm break-all text-ink">{setup ? inBlocks(setup.secret) : "…"}</code>
            <Button type="button" variant="secondary" size="sm" disabled={!setup} onClick={() => void copySecret()}>
              {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
              {copied ? "Copied" : "Copy key"}
            </Button>
          </div>
        </li>
      </ol>
      <Button type="button" className="w-full" disabled={!setup} onClick={onReady}>
        Next
      </Button>
      {/* Underneath Next, not beside it: starting again is the rarer answer and the one with a cost. */}
      <button
        type="button"
        disabled={!setup || startingAgain}
        onClick={() => void startAgain()}
        className="w-full text-center text-sm font-semibold text-primary-700 underline underline-offset-2 hover:text-primary-800 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
      >
        {startingAgain ? "Making a new code…" : "My app didn't get this — make a new code"}
      </button>
    </div>
  );
}
