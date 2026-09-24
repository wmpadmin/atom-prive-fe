import { useListTeamHeads, type TeamHead } from "@atomprive/api-client/backoffice";
import { cn, RequiredMark } from "@atomprive/ui";
import { roleLabels, teamRoles, type StaffRole } from "../../lib/labels";

interface RolePickerProps {
  value: StaffRole[];
  onChange: (roles: StaffRole[]) => void;
  disabled?: boolean;
  /** Shows a * after "Roles": at least one must be chosen. */
  required?: boolean;
  hint?: string;
  error?: string;
  /** Who is being edited, so the screen doesn't say they would replace themselves. */
  editing?: string;
}

/**
 * Staff can hold several roles at once, Admin included (#14). Each department is set to Member or Head —
 * nobody runs a department they are not in, so choosing Head puts them in it as well. A department nobody
 * has chosen is simply not theirs.
 */
export function RolePicker({ value, onChange, disabled, required, hint, error, editing }: RolePickerProps) {
  const messageId = error ? "roles-error" : "roles-hint";
  // One person runs each team, so naming a head says whom it takes the team from.
  const heads = useListTeamHeads<TeamHead[]>({ query: { staleTime: 30_000 } });
  const runsItNow = (head: StaffRole) => {
    const held = heads.data?.find((one) => one.head === head);
    return held?.fullName && held.staffUserId !== editing ? held.fullName : null;
  };
  // Running a team says it holds the team's role too, so the summary names the head and leaves it at that.
  const headed: StaffRole[] = teamRoles.filter(({ head }) => value.includes(head)).map(({ team }) => team);
  const chosen = value.filter((role) => !headed.includes(role));

  /** Member keeps them on the team; Head adds running it; None takes the department away. */
  function set(team: StaffRole, head: StaffRole, wanted: "member" | "head" | null) {
    const without = value.filter((role) => role !== team && role !== head);
    if (wanted === null) {
      onChange(without);
      return;
    }
    onChange(wanted === "head" ? [...without, team, head] : [...without, team]);
  }

  return (
    <fieldset aria-describedby={messageId} aria-invalid={error ? true : undefined} disabled={disabled} className="space-y-4">
      <div>
        <legend className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">
          Roles
          {required && <RequiredMark />}
        </legend>
        <p className="mt-0.5 text-xs text-ink-muted">Each department is None, Member or Head.</p>
      </div>

      {value.includes("ADMIN") && (
        <p className="rounded-xl border border-line bg-canvas px-4 py-3 text-sm text-ink-soft">
          <span className="font-semibold text-ink">Admin.</span> The firm&rsquo;s Admin is set up on the server,
          so it is not changed here.
        </p>
      )}

      <div className="space-y-1.5">
        <div className="space-y-2">
          {teamRoles.map(({ team, head }) => {
            const isHead = value.includes(head);
            const isMember = value.includes(team) && !isHead;
            return (
              <div
                key={team}
                className={cn(
                  "flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3",
                  isHead || isMember ? "border-primary-600 bg-primary-50" : "border-line bg-white",
                )}
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink">{roleLabels[team]}</p>
                  {isHead && (
                    <p className="text-xs text-ink-muted">
                      {roleLabels[head]}
                      {runsItNow(head) && <> · replaces {runsItNow(head)}</>}
                    </p>
                  )}
                </div>
                <div
                  role="group"
                  aria-label={roleLabels[team]}
                  className="flex shrink-0 rounded-lg bg-slate-100 p-0.5"
                >
                  <Pill label="None" active={!isMember && !isHead} disabled={disabled} onClick={() => set(team, head, null)} />
                  <Pill label="Member" active={isMember} disabled={disabled} onClick={() => set(team, head, "member")} />
                  <Pill label="Head" active={isHead} lead disabled={disabled} onClick={() => set(team, head, "head")} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <p className="border-t border-line pt-3 text-xs text-ink-muted">
        {chosen.length === 0 ? (
          "No roles chosen yet."
        ) : (
          <>
            Selected: <span className="font-semibold text-ink">{chosen.map((role) => roleLabels[role]).join(", ")}</span>
          </>
        )}
      </p>

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

function Pill({
  label,
  active,
  lead,
  disabled,
  onClick,
}: {
  label: string;
  active: boolean;
  /** The choice that carries weight — running the team — so it is the one shown in the accent. */
  lead?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "h-8 rounded-md px-3.5 text-sm font-semibold transition-colors",
        active && lead && "bg-primary-600 text-white shadow-xs",
        active && !lead && "bg-white text-ink shadow-xs",
        !active && "text-ink-soft hover:text-ink",
        disabled && "cursor-not-allowed opacity-60",
      )}
    >
      {label}
    </button>
  );
}
