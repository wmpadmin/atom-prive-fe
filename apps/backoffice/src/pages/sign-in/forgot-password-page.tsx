import { ApiError } from "@atomprive/api-client";
import { sendPasswordResetLink, useGetSignInOptions, type SignInOptions } from "@atomprive/api-client/backoffice";
import { Alert, Button, Field, TextInput } from "@atomprive/ui";
import { MailCheck } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, Navigate } from "react-router";
import { AuthLayout } from "../auth-layout";

/** "Forgot your password?": asks for the address, and the API emails a link to whoever that account belongs to. */
export function ForgotPasswordPage() {
  // While resets are switched off there is nothing here to use.
  const options = useGetSignInOptions<SignInOptions, ApiError>();

  const [sent, setSent] = useState<string>();
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email")).trim();
    setSubmitting(true);
    setError(undefined);
    try {
      await sendPasswordResetLink({ email });
      setSent(email);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Couldn't reach the server. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (options.data && !options.data.passwordReset) {
    return <Navigate to="/login" replace />;
  }

  return (
    <AuthLayout heading="Staff sign-in">
      {sent ? (
        <div className="w-full max-w-sm space-y-5 rounded-2xl border border-line bg-white p-8 text-center">
          <MailCheck aria-hidden="true" className="mx-auto size-10 text-primary-600" />
          <div>
            <h2 className="text-2xl font-bold">Check your email</h2>
            {/* The same message whatever was typed: whether an address belongs to staff here isn't ours to tell. */}
            <p className="mt-2 text-sm text-ink-muted">
              If <span className="font-semibold text-ink">{sent}</span> belongs to a staff account, a link to choose a new
              password is on its way. It works once and expires in 30 minutes.
            </p>
          </div>
          <p className="text-xs text-ink-muted">Nothing arrived? Check your spam folder, or ask an Admin to reset your password.</p>
          <Button variant="secondary" className="w-full" onClick={() => setSent(undefined)}>
            Use a different email
          </Button>
          <Link to="/login" className="block text-sm font-medium text-primary-600 hover:text-primary-700">
            Back to sign in
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-5 rounded-2xl border border-line bg-white p-8">
          <div>
            <h2 className="text-2xl font-bold">Forgot your password?</h2>
            <p className="mt-1 text-sm text-ink-muted">
              Enter the email your account uses and we'll send a link to choose a new password.
            </p>
          </div>
          {error && <Alert tone="danger">{error}</Alert>}
          <Field id="email" label="Email">
            <TextInput id="email" name="email" type="email" autoComplete="username" required autoFocus />
          </Field>
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Sending…" : "Send the link"}
          </Button>
          <Link to="/login" className="block text-center text-sm font-medium text-primary-600 hover:text-primary-700">
            Back to sign in
          </Link>
        </form>
      )}
    </AuthLayout>
  );
}
