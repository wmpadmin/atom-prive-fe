import { ApiError } from "@atomprive/api-client";
import { useLogin, type SignedIn } from "@atomprive/api-client/portal";
import { Alert, Button, Field, HumanCheck, TextInput, useHumanCheck } from "@atomprive/ui";
import { useCallback, useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { useSession } from "../auth/session-context";
import { AuthLayout } from "./auth-layout";
import { PasswordInput } from "./password-input";
import { AuthenticatorStep, CodeStep, NewPasswordStep } from "./sign-in-steps";

/** Where a client is between their password and the portal. */
type Stage =
  | { at: "password" }
  | { at: "authenticator"; challenge: string }
  | { at: "code"; challenge: string; justSetUp: boolean }
  | { at: "newPassword"; challenge: string };

/**
 * The client's front door.
 *
 * <p>One message for every way of being refused, because the server answers that way too: telling somebody
 * an address is unknown tells them which addresses are known, and a private bank's client list is not
 * something to hand over a form field at a time.
 */
export function LoginPage() {
  const { began } = useSession();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [stage, setStage] = useState<Stage>({ at: "password" });
  const [over, setOver] = useState<string>();
  // "Confirm you're a person", once the server has asked for it after too many wrong tries (S12).
  const human = useHumanCheck();

  /** Whatever the server answered: a session, an invitation, or the next step owed. */
  const follow = useCallback(
    (answer: SignedIn, justSetUp = false) => {
      if (answer.accessToken) {
        began(answer.accessToken);
        return;
      }
      if (answer.challengeToken && answer.next === "SET_UP_AUTHENTICATOR") {
        setStage({ at: "authenticator", challenge: answer.challengeToken });
      } else if (answer.challengeToken && answer.next === "ENTER_CODE") {
        setStage({ at: "code", challenge: answer.challengeToken, justSetUp });
      } else if (answer.challengeToken && answer.next === "NEW_PASSWORD") {
        setStage({ at: "newPassword", challenge: answer.challengeToken });
      }
    },
    [began],
  );
  const startOver = useCallback((message: string) => {
    setOver(message);
    setPassword("");
    setStage({ at: "password" });
  }, []);

  const signIn = useLogin<ApiError>({
    mutation: {
      onSettled: (_answer, error) => human.heard(error),
      onSuccess: (answer: SignedIn) => {
        // An invited person's password is not an account's: there is no account yet. What comes back is
        // the link they would have had out of their inbox, and this is where it gets followed.
        if (answer.joinToken) {
          void navigate(`/join/${encodeURIComponent(answer.joinToken)}`);
          return;
        }
        setOver(undefined);
        follow(answer);
      },
    },
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    signIn.mutate({ data: { email: email.trim(), password, humanCheckToken: human.token } });
  };

  if (stage.at === "authenticator") {
    return (
      <AuthLayout heading="Client sign-in">
        <AuthenticatorStep
          challengeToken={stage.challenge}
          onReady={() => setStage({ at: "code", challenge: stage.challenge, justSetUp: true })}
          onOver={startOver}
        />
      </AuthLayout>
    );
  }
  if (stage.at === "code") {
    return (
      <AuthLayout heading="Client sign-in">
        <CodeStep
          challengeToken={stage.challenge}
          justSetUp={stage.justSetUp}
          onAnswer={(answer) => follow(answer)}
          onShowQrAgain={() => setStage({ at: "authenticator", challenge: stage.challenge })}
          onOver={startOver}
        />
      </AuthLayout>
    );
  }
  if (stage.at === "newPassword") {
    return (
      <AuthLayout heading="Client sign-in">
        <NewPasswordStep challengeToken={stage.challenge} onAnswer={(answer) => follow(answer)} onOver={startOver} />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout heading="Client sign-in">
      <form onSubmit={submit} className="w-full max-w-sm space-y-5 rounded-2xl border border-line bg-white px-7 py-8">
        <h2 className="text-xl font-bold">Sign in</h2>

        {signIn.isError ? (
          <Alert tone="danger">
            {signIn.error.message}
            {signIn.error.status === 401 && signIn.error.problem.humanCheckSiteKey && " Before you try again, confirm you're a person."}
          </Alert>
        ) : (
          over && <Alert tone="danger">{over}</Alert>
        )}

        <Field id="email" label="Email" required>
          <TextInput
            id="email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </Field>

        <Field id="password" label="Password" required>
          <PasswordInput
            id="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>

        {/* No "Forgot your password?" here. The back-office has one because staff have a reset flow behind
            it; clients do not yet, and a link that leads nowhere is worse on this screen than on any
            other — it is read by somebody already locked out. */}
        {human.siteKey && <HumanCheck key={human.round} siteKey={human.siteKey} onToken={human.setToken} theme="light" />}
        <Button type="submit" size="lg" className="w-full" disabled={signIn.isPending || human.waiting}>
          {signIn.isPending ? "Signing in…" : "Continue"}
        </Button>

        <p className="text-center text-xs text-ink-muted">
          Can&rsquo;t get in? Your relationship manager can help.
        </p>
      </form>
    </AuthLayout>
  );
}
