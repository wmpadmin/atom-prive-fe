import { ApiError } from "@atomprive/api-client";
import { login } from "@atomprive/api-client/backoffice";
import { Alert, Button, Field, TextInput } from "@atomprive/ui";
import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router";
import { useSession } from "../auth/session";
import { AuthLayout } from "./auth-layout";

export function LoginPage() {
  const { state, applySignIn } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  if (state.status === "signedIn") {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSubmitting(true);
    setError(undefined);
    try {
      const response = await login({ email: String(form.get("email")), password: String(form.get("password")) });
      applySignIn(response);
      const from = (location.state as { from?: string } | null)?.from;
      navigate(response.user.mustChangePassword ? "/change-password" : (from ?? "/"), { replace: true });
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Couldn't reach the server. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout heading="Staff sign-in">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-5 rounded-2xl border border-line bg-white p-8">
        <div>
          <h2 className="text-2xl font-bold">Sign in</h2>
          <p className="mt-1 text-sm text-ink-muted">Use the email your Admin invited.</p>
        </div>
        {error && <Alert tone="danger">{error}</Alert>}
        <Field id="email" label="Email">
          <TextInput id="email" name="email" type="email" autoComplete="username" required autoFocus />
        </Field>
        <Field id="password" label="Password">
          <TextInput id="password" name="password" type="password" autoComplete="current-password" required />
        </Field>
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </AuthLayout>
  );
}
