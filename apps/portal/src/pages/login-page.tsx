import { ApiError } from "@atomprive/api-client";
import { useLogin, type SignedIn } from "@atomprive/api-client/portal";
import { Alert, Button, Field, TextInput } from "@atomprive/ui";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { useSession } from "../auth/session-context";
import { AuthLayout } from "./auth-layout";

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
  const signIn = useLogin<ApiError>({
    mutation: {
      onSuccess: (answer: SignedIn) => {
        // An invited person's password is not an account's: there is no account yet. What comes back is
        // the link they would have had out of their inbox, and this is where it gets followed.
        if (answer.joinToken) {
          void navigate(`/join/${encodeURIComponent(answer.joinToken)}`);
          return;
        }
        if (answer.accessToken) {
          began(answer.accessToken);
        }
      },
    },
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    signIn.mutate({ data: { email: email.trim(), password } });
  };

  return (
    <AuthLayout heading="Client sign-in">
      <form onSubmit={submit} className="w-full max-w-sm space-y-5 rounded-2xl border border-line bg-white px-7 py-8">
        <h2 className="text-xl font-bold">Sign in</h2>

        {signIn.isError && <Alert tone="danger">{signIn.error.message}</Alert>}

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
          <TextInput
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>

        {/* No "Forgot your password?" here. The back-office has one because staff have a reset flow behind
            it; clients do not yet, and a link that leads nowhere is worse on this screen than on any
            other — it is read by somebody already locked out. */}
        <Button type="submit" size="lg" className="w-full" disabled={signIn.isPending}>
          {signIn.isPending ? "Signing in…" : "Continue"}
        </Button>

        <p className="text-center text-xs text-ink-muted">
          Can&rsquo;t get in? Your relationship manager can help.
        </p>
      </form>
    </AuthLayout>
  );
}
