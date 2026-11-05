import { ApiError } from "@atomprive/api-client";
import {
  choosePassword,
  enterCode,
  setUpAuthenticator,
  setUpAuthenticatorAgain,
  type AuthenticatorSetup,
  type SignedIn,
} from "@atomprive/api-client/portal";
import { Alert, Button, Field, isStrongPassword, PasswordChecklist } from "@atomprive/ui";
import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { PasswordInput } from "./password-input";

/*
 * The steps between a client's password and the portal, the way staff sign in: an authenticator set up where
 * they have none, its code every time, and a password of their own where they hold the firm's temporary one or
 * theirs has run out. Each is shown only when the server says it is owed.
 */

const OFFLINE = "Couldn't reach the server. Check your connection and try again.";

/** A refusal that means the whole sign-in is over and has to start again from the password. */
function isOver(caught: ApiError) {
  return caught.status === 401 && !/code is wrong/i.test(caught.message);
}

/** The secret in blocks of four, so it can be typed in by hand without losing your place. */
function inBlocks(secret: string) {
  return (secret.match(/.{1,4}/g) ?? []).join(" ");
}

const CARD = "w-full max-w-sm space-y-5 rounded-2xl border border-line bg-white px-7 py-8";

/** Scan the QR code into an authenticator app, then go on to the code it shows. */
export function AuthenticatorStep({
  challengeToken,
  onReady,
  onOver,
}: {
  challengeToken: string;
  onReady: () => void;
  onOver: (message: string) => void;
}) {
  const [setup, setSetup] = useState<AuthenticatorSetup>();
  const [error, setError] = useState<string>();
  const [copied, setCopied] = useState(false);
  const [startingAgain, setStartingAgain] = useState(false);
  // The screen can be drawn twice; the request is kept rather than repeated.
  const asked = useRef<{ token: string; setup: Promise<AuthenticatorSetup> }>(undefined);

  useEffect(() => {
    let current = true;
    if (asked.current?.token !== challengeToken) {
      asked.current = { token: challengeToken, setup: setUpAuthenticator({ challengeToken }) };
    }
    asked.current.setup
      .then((answer) => current && setSetup(answer))
      .catch((caught: unknown) => {
        if (!current) return;
        if (caught instanceof ApiError && (caught.status === 401 || caught.status === 409)) {
          onOver(caught.message);
        } else {
          setError(caught instanceof ApiError ? caught.message : OFFLINE);
        }
      });
    return () => {
      current = false;
    };
  }, [challengeToken, onOver]);

  async function startAgain() {
    setStartingAgain(true);
    setError(undefined);
    setCopied(false);
    try {
      const fresh = await setUpAuthenticatorAgain({ challengeToken });
      asked.current = { token: challengeToken, setup: Promise.resolve(fresh) };
      setSetup(fresh);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : OFFLINE);
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
    <div className={CARD}>
      <div>
        <h2 className="text-xl font-bold">Set up your authenticator</h2>
        <p className="mt-1 text-sm text-ink-muted">
          You do this once. After that, every sign-in asks for the code your app is showing.
        </p>
      </div>
      {error && <Alert tone="danger">{error}</Alert>}
      <ol className="space-y-4 text-sm">
        <li>
          <p className="font-semibold">1. Open an authenticator app on your phone</p>
          <p className="text-ink-muted">Google Authenticator, Microsoft Authenticator and 1Password all work.</p>
        </li>
        <li className="space-y-3">
          <p className="font-semibold">2. Scan this QR code</p>
          {setup ? (
            <div
              // Drawn by the server from the same secret; it never holds anything a person typed.
              dangerouslySetInnerHTML={{ __html: setup.qrSvg }}
              className="mx-auto size-48 rounded-xl border border-line bg-white p-2 [&>svg]:size-full"
            />
          ) : (
            <div className="mx-auto size-48 animate-pulse rounded-xl border border-line bg-canvas" />
          )}
        </li>
        <li className="space-y-2">
          <p className="font-semibold">3. Or type this key in by hand</p>
          <div className="space-y-2 rounded-lg bg-canvas p-3">
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
      <button
        type="button"
        disabled={!setup || startingAgain}
        onClick={() => void startAgain()}
        className="w-full text-center text-sm font-semibold text-primary-700 underline underline-offset-2 disabled:opacity-50"
      >
        {startingAgain ? "Making a new code…" : "My app didn't get this — make a new code"}
      </button>
    </div>
  );
}

/** The six-digit code from the authenticator, asked for at every sign-in. */
export function CodeStep({
  challengeToken,
  justSetUp,
  onAnswer,
  onShowQrAgain,
  onOver,
}: {
  challengeToken: string;
  justSetUp: boolean;
  onAnswer: (answer: SignedIn) => void;
  onShowQrAgain: () => void;
  onOver: (message: string) => void;
}) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(undefined);
    try {
      onAnswer(await enterCode({ challengeToken, code }));
    } catch (caught) {
      if (!(caught instanceof ApiError)) {
        setError(OFFLINE);
      } else if (caught.status === 409) {
        onShowQrAgain();
      } else if (isOver(caught) || caught.status === 429) {
        onOver(caught.message);
      } else {
        setError(caught.message);
        setCode("");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className={CARD}>
      <div>
        <h2 className="text-xl font-bold">Enter your code</h2>
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
        {submitting ? "Checking…" : "Continue"}
      </Button>
      {justSetUp && (
        <button
          type="button"
          onClick={onShowQrAgain}
          className="w-full text-center text-sm font-semibold text-primary-700 underline underline-offset-2"
        >
          Show the QR code again
        </button>
      )}
    </form>
  );
}

/** A password of the client's own, in place of the firm's temporary one or one that has run out. */
export function NewPasswordStep({
  challengeToken,
  onAnswer,
  onOver,
}: {
  challengeToken: string;
  onAnswer: (answer: SignedIn) => void;
  onOver: (message: string) => void;
}) {
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [tried, setTried] = useState(false);
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const mismatch = again.length > 0 && again !== password;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTried(true);
    if (!isStrongPassword(password) || password !== again) {
      return;
    }
    setSubmitting(true);
    setError(undefined);
    try {
      onAnswer(await choosePassword({ challengeToken, newPassword: password }));
    } catch (caught) {
      if (!(caught instanceof ApiError)) {
        setError(OFFLINE);
      } else if (isOver(caught)) {
        onOver(caught.message);
      } else {
        setError(caught.message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className={CARD}>
      <div>
        <h2 className="text-xl font-bold">Create your password</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Choose a password only you know. You'll use it with your authenticator code from now on.
        </p>
      </div>
      {error && <Alert tone="danger">{error}</Alert>}
      <Field id="newPassword" label="New password" required>
        <PasswordInput
          id="newPassword"
          autoComplete="new-password"
          autoFocus
          value={password}
          aria-describedby="newPassword-rules"
          onChange={(event) => setPassword(event.target.value)}
        />
      </Field>
      <PasswordChecklist id="newPassword-rules" password={password} showMissing={tried} />
      <Field id="newPasswordAgain" label="Type it again" required error={mismatch ? "The two passwords don't match." : undefined}>
        <PasswordInput
          id="newPasswordAgain"
          autoComplete="new-password"
          value={again}
          onChange={(event) => setAgain(event.target.value)}
        />
      </Field>
      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? "Saving…" : "Save and continue"}
      </Button>
    </form>
  );
}
