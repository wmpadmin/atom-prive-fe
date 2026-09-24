import { ApiError } from "@atomprive/api-client";
import {
  login,
  signInWithGoogle,
  useGetSignInOptions,
  type MfaChallengeResponse,
  type SignInOptions,
  type SignInResponse,
} from "@atomprive/api-client/backoffice";
import { Alert, Button, Field, TextInput } from "@atomprive/ui";
import { useCallback, useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router";
import { useSession } from "../../auth/session";
import { AuthLayout } from "../auth-layout";
import { AuthenticatorCode } from "./authenticator-code";
import { AuthenticatorSetup } from "./authenticator-setup";
import { GoogleButton } from "./google-button";
import { lockedMessage } from "./locked-message";

/**
 * The password is only the first half of signing in: everyone finishes with the code from their authenticator app,
 * scanning a QR code the first time (#74).
 */
type Step =
  | { name: "password" }
  | { name: "setup"; challengeToken: string }
  | { name: "code"; challengeToken: string; justSetUp: boolean };

export function LoginPage() {
  const { state, applySignIn } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const [step, setStep] = useState<Step>({ name: "password" });
  // Set by the reset page, so someone who has just chosen a new password knows it worked.
  const justReset = (location.state as { passwordReset?: boolean } | null)?.passwordReset === true;
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  // "Continue with Google" is only offered once an Admin has set up a Google client ID.
  const options = useGetSignInOptions<SignInOptions, ApiError>();
  const googleClientId = options.data?.googleClientId;

  const startAgain = useCallback((message: string) => {
    setStep({ name: "password" });
    setError(message);
  }, []);

  /**
   * What the password step led to. Normally it leads to the authenticator code; where the firm has switched
   * the code off, the password finishes sign-in on its own and an access token comes straight back.
   */
  const afterPassword = useCallback(
    (outcome: MfaChallengeResponse | SignInResponse) => {
      if ("accessToken" in outcome) {
        applySignIn(outcome);
        const from = (location.state as { from?: string } | null)?.from;
        navigate(outcome.user.mustChangePassword ? "/change-password" : (from ?? "/"), { replace: true });
        return;
      }
      setStep(
        outcome.setUpRequired
          ? { name: "setup", challengeToken: outcome.challengeToken }
          : { name: "code", challengeToken: outcome.challengeToken, justSetUp: false },
      );
    },
    [applySignIn, location.state, navigate],
  );

  const signInFailed = useCallback((caught: unknown) => {
    if (caught instanceof ApiError) {
      setError(caught.status === 423 ? lockedMessage(caught.problem.lockedUntil) : caught.message);
    } else {
      setError("Couldn't reach the server. Check your connection and try again.");
    }
  }, []);

  const continueWithGoogle = useCallback(
    async (credential: string) => {
      setSubmitting(true);
      setError(undefined);
      try {
        afterPassword(await signInWithGoogle({ credential }));
      } catch (caught) {
        signInFailed(caught);
      } finally {
        setSubmitting(false);
      }
    },
    [afterPassword, signInFailed],
  );

  if (state.status === "signedIn") {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSubmitting(true);
    setError(undefined);
    try {
      afterPassword(await login({ email: String(form.get("email")), password: String(form.get("password")) }));
    } catch (caught) {
      signInFailed(caught);
    } finally {
      setSubmitting(false);
    }
  }

  function signedIn(response: SignInResponse) {
    applySignIn(response);
    const from = (location.state as { from?: string } | null)?.from;
    navigate(response.user.mustChangePassword ? "/change-password" : (from ?? "/"), { replace: true });
  }

  return (
    <AuthLayout heading="Staff sign-in">
      {step.name === "password" && (
        <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-5 rounded-2xl border border-line bg-white p-8">
          <div>
            <h2 className="text-2xl font-bold">Sign in</h2>
            <p className="mt-1 text-sm text-ink-muted">Use the email your Admin invited.</p>
          </div>
          {error && <Alert tone="danger">{error}</Alert>}
          {!error && justReset && <Alert tone="success">Your password has been changed. Sign in with it now.</Alert>}
          <Field id="email" label="Email">
            <TextInput id="email" name="email" type="email" autoComplete="username" required autoFocus />
          </Field>
          <Field id="password" label="Password">
            <TextInput id="password" name="password" type="password" autoComplete="current-password" required />
          </Field>
          {options.data?.passwordReset && (
            <Link to="/forgot-password" className="-mt-2 block text-sm font-medium text-primary-600 hover:text-primary-700">
              Forgot your password?
            </Link>
          )}
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Signing in…" : "Continue"}
          </Button>
          {googleClientId && (
            <>
              <div className="flex items-center gap-3 text-xs text-ink-muted">
                <span className="h-px flex-1 bg-line" />
                or
                <span className="h-px flex-1 bg-line" />
              </div>
              <GoogleButton clientId={googleClientId} onCredential={(credential) => void continueWithGoogle(credential)} onUnavailable={setError} />
            </>
          )}
        </form>
      )}

      {step.name === "setup" && (
        <AuthenticatorSetup
          challengeToken={step.challengeToken}
          onReady={() => setStep({ name: "code", challengeToken: step.challengeToken, justSetUp: true })}
          onExpired={startAgain}
        />
      )}

      {step.name === "code" && (
        <AuthenticatorCode
          challengeToken={step.challengeToken}
          justSetUp={step.justSetUp}
          onSignedIn={signedIn}
          onLocked={startAgain}
          onExpired={startAgain}
          onSetUpNeeded={() => setStep({ name: "setup", challengeToken: step.challengeToken })}
        />
      )}
    </AuthLayout>
  );
}
