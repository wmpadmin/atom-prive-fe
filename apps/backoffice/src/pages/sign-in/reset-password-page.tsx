import { ApiError } from "@atomprive/api-client";
import { checkPasswordResetLink, resetPassword, useGetSignInOptions, type SignInOptions } from "@atomprive/api-client/backoffice";
import { Alert, Button, describedBy, Field, isStrongPassword, PasswordChecklist, TextInput } from "@atomprive/ui";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router";
import { noErrors, toFormErrors, type FormErrors } from "../../lib/api-errors";
import { AuthLayout } from "../auth-layout";

type LinkState = "checking" | "usable" | "dead";

/** Where the emailed link lands: choose a new password, once, within half an hour of asking. */
export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const navigate = useNavigate();
  // A link with no token at all is dead from the start; there is nothing to ask the API about.
  const [link, setLink] = useState<LinkState>(() => (token ? "checking" : "dead"));
  // While resets are switched off there is nothing here to use.
  const options = useGetSignInOptions<SignInOptions, ApiError>();
  const [errors, setErrors] = useState<FormErrors>(noErrors);
  const [submitting, setSubmitting] = useState(false);
  // Copies of the two fields for the live checks; the fields stay the source of truth, since password managers can
  // fill them without the typing events that would update these.
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [leftConfirmation, setLeftConfirmation] = useState(false);
  const [triedToSave, setTriedToSave] = useState(false);
  // Checking the link doesn't use it up, and React draws this twice in development, so the answer is kept.
  const asked = useRef<{ token: string; answer: Promise<{ usable: boolean }> }>(undefined);

  useEffect(() => {
    if (!token) return;
    let current = true;
    if (asked.current?.token !== token) {
      asked.current = { token, answer: checkPasswordResetLink({ token }) };
    }
    asked.current.answer
      .then((answer) => current && setLink(answer.usable ? "usable" : "dead"))
      .catch(() => current && setLink("dead"));
    return () => {
      current = false;
    };
  }, [token]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const typedPassword = String(values.get("newPassword"));
    const typedConfirmation = String(values.get("confirmPassword"));
    setNewPassword(typedPassword);
    setConfirmPassword(typedConfirmation);
    setTriedToSave(true);
    setErrors(noErrors);
    // Checked here first so the person sees what to fix straight away. The server checks the rules again.
    if (!isStrongPassword(typedPassword)) {
      focusField(form, "newPassword");
      return;
    }
    if (typedPassword !== typedConfirmation) {
      focusField(form, "confirmPassword");
      return;
    }
    setSubmitting(true);
    try {
      await resetPassword({ token, newPassword: typedPassword });
      navigate("/login", { replace: true, state: { passwordReset: true } });
    } catch (caught) {
      // 410 means the link was used or ran out while this form was open.
      if (caught instanceof ApiError && caught.status === 410) {
        setLink("dead");
      } else {
        setErrors(toFormErrors(caught));
      }
    } finally {
      setSubmitting(false);
    }
  }

  const rulesError =
    triedToSave && !isStrongPassword(newPassword) ? "Your new password doesn't meet all the rules below yet." : undefined;
  const mismatchError =
    (triedToSave || leftConfirmation) && confirmPassword !== "" && confirmPassword !== newPassword
      ? "New password and confirm password do not match."
      : undefined;
  const newPasswordError = rulesError ?? errors.fields.newPassword;
  const confirmPasswordError = mismatchError ?? errors.fields.confirmPassword;

  if (options.data && !options.data.passwordReset) {
    return <Navigate to="/login" replace />;
  }

  return (
    <AuthLayout heading="Staff sign-in">
      {link === "checking" && <p className="text-sm text-ink-muted">Checking your link…</p>}

      {link === "dead" && (
        <div className="w-full max-w-sm space-y-5 rounded-2xl border border-line bg-white p-8">
          <div>
            <h2 className="text-2xl font-bold">This link no longer works</h2>
            <p className="mt-2 text-sm text-ink-muted">
              A reset link works once and expires 30 minutes after it's asked for. Ask for a new one and use the newest
              email.
            </p>
          </div>
          <Link to="/forgot-password" className="block">
            <Button className="w-full">Send a new link</Button>
          </Link>
          <Link to="/login" className="block text-center text-sm font-medium text-primary-600 hover:text-primary-700">
            Back to sign in
          </Link>
        </div>
      )}

      {link === "usable" && (
        <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-5 rounded-2xl border border-line bg-white p-8">
          <div>
            <h2 className="text-2xl font-bold">Choose a new password</h2>
            <p className="mt-1 text-sm text-ink-muted">
              You'll sign in with it straight away, and be signed out of every other device.
            </p>
          </div>
          {errors.form && <Alert tone="danger">{errors.form}</Alert>}
          <Field id="newPassword" label="New password">
            <TextInput
              id="newPassword"
              name="newPassword"
              type="password"
              autoComplete="new-password"
              required
              autoFocus
              onChange={(event) => setNewPassword(event.target.value)}
              aria-invalid={newPasswordError ? true : undefined}
              aria-describedby={newPasswordError ? "newPassword-error newPassword-rules" : "newPassword-rules"}
            />
            {newPasswordError && (
              <p id="newPassword-error" className="text-xs font-medium text-red-600">
                {newPasswordError}
              </p>
            )}
            <PasswordChecklist id="newPassword-rules" password={newPassword} showMissing={triedToSave} />
          </Field>
          <Field id="confirmPassword" label="Confirm new password" error={confirmPasswordError}>
            <TextInput
              {...describedBy("confirmPassword", confirmPasswordError)}
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              onChange={(event) => setConfirmPassword(event.target.value)}
              onBlur={(event) => setLeftConfirmation(event.target.value !== "")}
            />
          </Field>
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Saving…" : "Save new password"}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}

function focusField(form: HTMLFormElement, name: string) {
  const field = form.elements.namedItem(name);
  if (field instanceof HTMLInputElement) field.focus();
}
