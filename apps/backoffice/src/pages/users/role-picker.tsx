import { cn, RequiredMark } from "@atomprive/ui";
import { roleLabels, roles as everyRole, type StaffRole } from "../../lib/labels";

interface RolePickerProps {
  value: StaffRole[];
  onChange: (roles: StaffRole[]) => void;
  disabled?: boolean;
  /** Shows a * after "Roles": at least one must be chosen. */
  required?: boolean;
  hint?: string;
  error?: string;
}

/**
 * Staff can hold several roles at once (#14). Each is a role in its own right — a head is not a rank on top of
 * a team, it is the role the firm gives somebody — so they are simply ticked or not.
 *
 * Admin is not one of them: the firm's Admin is set up on the server, never granted from these screens.
 */
export function RolePicker({ value, onChange, disabled, required, hint, error }: RolePickerProps) {
  const messageId = error ? "roles-error" : "roles-hint";
  const offered = everyRole.filter((role) => role !== "ADMIN");

  function set(role: StaffRole, wanted: boolean) {
    onChange(wanted ? [...value, role] : value.filter((held) => held !== role));
  }

  return (
    <fieldset aria-describedby={hint || error ? messageId : undefined}>
      <legend className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">
        Roles
        {required && <RequiredMark />}
      </legend>

      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {offered.map((role) => {
          const held = value.includes(role);
          return (
            <label
              key={role}
              className={cn(
                "flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition-colors",
                held ? "border-primary-600 bg-primary-50" : "border-line bg-white",
                disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:border-primary-600",
              )}
            >
              <input
                type="checkbox"
                checked={held}
                disabled={disabled}
                onChange={(event) => set(role, event.target.checked)}
                className="size-4 rounded border-line text-primary-600"
              />
              <span className={cn("font-semibold", held && "text-primary-800")}>{roleLabels[role]}</span>
            </label>
          );
        })}
      </div>

      {/* Admin is said rather than offered, so it is clear why it is not in the list. */}
      {value.includes("ADMIN") && (
        <p className="mt-2 text-xs text-ink-muted">
          This person is an <span className="font-semibold text-ink">Admin</span>. That is set up on the server and
          can't be changed here.
        </p>
      )}

      {(hint || error) && (
        <p id={messageId} className={cn("mt-2 text-xs", error ? "text-red-600" : "text-ink-muted")}>
          {error ?? hint}
        </p>
      )}
    </fieldset>
  );
}
