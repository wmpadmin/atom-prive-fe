import { cn, RequiredMark } from "@atomprive/ui";
import { roleLabels, roles, type StaffRole } from "../../lib/labels";

interface RolePickerProps {
  value: StaffRole[];
  onChange: (roles: StaffRole[]) => void;
  disabled?: boolean;
  /** Shows a * after "Roles": at least one must be chosen. */
  required?: boolean;
  hint?: string;
  error?: string;
}

/** Staff can hold several roles at once, Admin included (#14). */
export function RolePicker({ value, onChange, disabled, required, hint, error }: RolePickerProps) {
  const messageId = error ? "roles-error" : "roles-hint";

  return (
    <fieldset aria-describedby={messageId} aria-invalid={error ? true : undefined} disabled={disabled} className="space-y-1.5">
      <legend className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">
        Roles
        {required && <RequiredMark />}
      </legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {roles.map((role) => {
          const checked = value.includes(role);
          return (
            <label
              key={role}
              className={cn(
                "flex items-center gap-2.5 rounded-lg border px-3 py-2 text-sm transition-colors",
                checked ? "border-primary-600 bg-primary-50 font-semibold" : "border-line bg-white",
                disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:border-primary-100",
              )}
            >
              <input
                type="checkbox"
                name="roles"
                value={role}
                className="size-4 accent-primary-600"
                checked={checked}
                onChange={(event) =>
                  onChange(event.target.checked ? roles.filter((option) => option === role || value.includes(option)) : value.filter((option) => option !== role))
                }
              />
              {roleLabels[role]}
            </label>
          );
        })}
      </div>
      {error ? (
        <p id="roles-error" className="text-xs text-red-600">
          {error}
        </p>
      ) : (
        <p id="roles-hint" className="text-xs text-ink-muted">
          {hint ?? "Someone holding several roles picks one when they sign in."}
        </p>
      )}
    </fieldset>
  );
}
