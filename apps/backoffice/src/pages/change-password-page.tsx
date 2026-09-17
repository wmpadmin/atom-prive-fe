import { changePassword } from "@atomprive/api-client/backoffice";
import { Alert, Button, describedBy, Field, isStrongPassword, PasswordChecklist, TextInput } from "@atomprive/ui";
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { useSession, useStaffUser } from "../auth/session";
import { noErrors, toFormErrors, type FormErrors } from "../lib/api-errors";

export function ChangePasswordPage() {
  const user = useStaffUser();
  const { applySignIn, signOut } = useSession();
  const navigate = useNavigate();
  const [errors, setErrors] = useState<FormErrors>(noErrors);
  const [submitting, setSubmitting] = useState(false);
  // Copies of what's in the two new-password fields, for the live checks. The fields themselves stay the source of
  // truth, because password managers can fill them without the typing events that would update these copies.
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [leftConfirmation, setLeftConfirmation] = useState(false);
  const [triedToSave, setTriedToSave] = useState(false);

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
    // Check the rules here first, so the person sees straight away what to fix. The server checks them again.
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
      const currentPassword = String(values.get("currentPassword"));
      applySignIn(await changePassword({ currentPassword, newPassword: typedPassword }));
      navigate("/", { replace: true });
    } catch (caught) {
      setErrors(toFormErrors(caught));
    } finally {
      setSubmitting(false);
    }
  }

  // Once shown, these messages follow the fields as they change and disappear when fixed. The mismatch shows as soon
  // as the person leaves the confirmation field, rather than while they're still typing it.
  const rulesError =
    triedToSave && !isStrongPassword(newPassword) ? "Your new password doesn't meet all the rules below yet." : undefined;
  const mismatchError =
    (triedToSave || leftConfirmation) && confirmPassword !== "" && confirmPassword !== newPassword
      ? "New password and confirm password do not match."
      : undefined;
  const newPasswordError = rulesError ?? errors.fields.newPassword;
  const confirmPasswordError = mismatchError ?? errors.fields.confirmPassword;

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-6 py-12 font-sans text-ink">
      <form onSubmit={handleSubmit} className="w-full max-w-md space-y-5 rounded-2xl border border-line bg-white p-8">
        <div>
          <h1 className="text-2xl font-bold">Choose a new password</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {user.mustChangePassword
              ? "Your account was set up with a temporary password. Choose your own to continue."
              : "You'll be signed out of every other device."}
          </p>
        </div>
        {errors.form && <Alert tone="danger">{errors.form}</Alert>}
        <Field id="currentPassword" label={user.mustChangePassword ? "Temporary password" : "Current password"} error={errors.fields.currentPassword}>
          <TextInput {...describedBy("currentPassword", errors.fields.currentPassword)} name="currentPassword" type="password" autoComplete="current-password" required />
        </Field>
        <Field id="newPassword" label="New password">
          <TextInput
            id="newPassword"
            name="newPassword"
            type="password"
            autoComplete="new-password"
            required
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
        <div className="flex items-center justify-between gap-3">
          {user.mustChangePassword ? (
            <Button variant="ghost" onClick={() => void signOut()}>
              Sign out
            </Button>
          ) : (
            <Link to="/" className="text-sm text-ink-muted hover:text-ink">
              Cancel
            </Link>
          )}
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving…" : "Save new password"}
          </Button>
        </div>
      </form>
    </main>
  );
}

function focusField(form: HTMLFormElement, name: string) {
  const field = form.elements.namedItem(name);
  if (field instanceof HTMLInputElement) field.focus();
}
