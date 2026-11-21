import { ApiError } from "@atomprive/api-client";
import {
  exportPermissionMatrix,
  getGetPermissionMatrixQueryKey,
  getGetScreenMatrixQueryKey,
  useGetPermissionMatrix,
  useGetScreenMatrix,
  useUpdateRolePermission,
  useUpdateRoleScreen,
  type AccessLevelOption,
  type PermissionGrant,
  type PermissionMatrix,
  type PermissionOption,
  type RoleAccessView,
  type ScreenGrant,
  type ScreenMatrix,
  type ScreenOption,
} from "@atomprive/api-client/backoffice";
import { Alert, cn } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronDown, LoaderCircle, Lock } from "lucide-react";
import { useRef, useState, type KeyboardEvent } from "react";
import { useSearchParams } from "react-router";
import { useSession, useStaffUser } from "../../auth/session";
import { screenNeeds } from "../../menu";
import { ListReportButton } from "../layout/list-report";

type Level = PermissionGrant["level"];
type Role = RoleAccessView["role"];
type Notice = { tone: "success" | "danger"; message: string };

/** One colour per access level, shared by the legend and the level controls (tokens in packages/ui/src/theme.css). */
const levelColours: Record<Level, { dot: string; control: string }> = {
  FULL: { dot: "bg-access-full", control: "bg-access-full-soft text-access-full-ink" },
  VIEW_ONLY: { dot: "bg-access-view", control: "bg-access-view-soft text-access-view-ink" },
  OWN_CLIENTS: { dot: "bg-access-own", control: "bg-access-own-soft text-access-own-ink" },
  ASSIGNED: { dot: "bg-access-assigned", control: "bg-access-assigned-soft text-access-assigned-ink" },
  NONE: { dot: "bg-access-none", control: "bg-access-none-soft text-access-none-ink" },
};

type View = "screens" | "actions";

export function RolesPage() {
  const matrix = useGetPermissionMatrix<PermissionMatrix, ApiError>();
  const screens = useGetScreenMatrix<ScreenMatrix, ApiError>();
  const [searchParams, setSearchParams] = useSearchParams();
  const view: View = searchParams.get("view") === "actions" ? "actions" : "screens";


  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[1.625rem] font-bold">Permission matrix</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Defines what each role may access — customer fields, exports, proposal sends. Changes apply on next request.
          </p>
        </div>
        <ListReportButton list="Permission matrix" load={() => exportPermissionMatrix()} />
      </header>


      <section aria-labelledby="role-capabilities-title" className="rounded-2xl border border-line bg-white p-5">
        <h2 id="role-capabilities-title" className="text-base font-bold">
          Role capabilities
        </h2>
        <p className="mt-0.5 text-xs text-ink-muted">
          {view === "screens"
            ? "Pick a role, then set which screens it can open, by their names on the menu. The colour of each control shows the access level at a glance."
            : "Pick a role, then set what it can do inside its screens. The colour of each control shows the access level at a glance."}
        </p>

        <div role="tablist" aria-label="What is set" className="mt-4 flex gap-1 border-b border-line">
          {([["screens", "Screens"], ["actions", "Actions"]] as const).map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={view === id}
              onClick={() => {
                const next = new URLSearchParams(searchParams);
                next.set("view", id);
                setSearchParams(next, { replace: true });
              }}
              className={cn("-mb-px border-b-2 px-4 py-2 text-sm font-semibold",
                view === id ? "border-primary-600 text-primary-700" : "border-transparent text-ink-muted hover:text-ink")}>
              {label}
            </button>
          ))}
        </div>

        {(matrix.isPending || (view === "screens" && screens.isPending)) && <p className="mt-6 text-sm text-ink-muted">Loading roles…</p>}
        {matrix.isError && (
          <div className="mt-5">
            <Alert tone="danger">{matrix.error.message}</Alert>
          </div>
        )}
        {view === "screens" && screens.isError && (
          <div className="mt-5">
            <Alert tone="danger">{screens.error.message}</Alert>
          </div>
        )}
        {view === "actions" && matrix.isSuccess && <RoleCapabilities matrix={matrix.data} />}
        {view === "screens" && matrix.isSuccess && screens.isSuccess && (
          <ScreenCapabilities screens={screens.data} actions={matrix.data} />
        )}
      </section>
    </div>
  );
}

function RoleCapabilities({ matrix }: { matrix: PermissionMatrix }) {
  const user = useStaffUser();
  const { reloadUser } = useSession();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [saved, setSaved] = useState<Notice>();

  const selected = matrix.roles.find((role) => role.role === searchParams.get("role")) ?? matrix.roles[0];
  const levelLabels = Object.fromEntries(matrix.levels.map((option) => [option.level, option.label])) as Record<Level, string>;

  const update = useUpdateRolePermission<ApiError>({
    mutation: {
      onMutate: () => setSaved(undefined),
      onSuccess: (updated, { permission, data }) => {
        queryClient.setQueryData<PermissionMatrix>(getGetPermissionMatrixQueryKey(), (current) =>
          current && { ...current, roles: current.roles.map((role) => (role.role === updated.role ? updated : role)) },
        );
        const label = matrix.permissions.find((option) => option.permission === permission)?.label ?? permission;
        setSaved({ tone: "success", message: `Saved: ${updated.name} · ${label} is now ${levelLabels[data.level]}.` });
        // Changing your own role's access changes what you can do here too.
        if (updated.role === user.activeRole) void reloadUser();
      },
      onError: (error) => {
        setSaved({ tone: "danger", message: error.message });
        // Someone else may have changed the matrix, or this person's own access may have been reduced.
        void queryClient.invalidateQueries({ queryKey: getGetPermissionMatrixQueryKey() });
      },
    },
  });

  if (!selected) {
    return <p className="mt-6 text-sm text-ink-muted">No roles have been set up yet.</p>;
  }

  const saving = update.isPending ? update.variables : undefined;
  const panelId = "role-capabilities-panel";

  return (
    <>
      <RoleTabs
        roles={matrix.roles}
        selected={selected.role}
        panelId={panelId}
        onSelect={(role) => {
          setSaved(undefined);
          const next = new URLSearchParams(searchParams);
          next.set("role", role);
          setSearchParams(next, { replace: true });
        }}
      />

      <div className="mt-5 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <p
          aria-live="polite"
          className={cn("min-h-4 text-xs", saved?.tone === "danger" ? "text-red-600" : "text-ink-muted")}
        >
          {saved?.message}
        </p>
        <Legend levels={matrix.levels} />
      </div>

      <ul
        id={panelId}
        role="tabpanel"
        aria-labelledby={`role-tab-${selected.role}`}
        className="mt-3 divide-y divide-line rounded-xl border border-line"
      >
        {matrix.permissions.map((permission) => {
          const grant = selected.grants.find((candidate) => candidate.permission === permission.permission);
          if (!grant) return null;
          return (
            <CapabilityRow
              key={permission.permission}
              role={selected}
              permission={permission}
              grant={grant}
              levelLabels={levelLabels}
              disabled={saving !== undefined}
              saving={saving?.role === selected.role && saving.permission === permission.permission}
              onChange={(level) =>
                update.mutate({ role: selected.role, permission: permission.permission, data: { level } })
              }
            />
          );
        })}
      </ul>

    </>
  );
}

function RoleTabs({ roles, selected, panelId, onSelect }: {
  roles: { role: Role; name: string }[];
  selected: Role;
  panelId: string;
  onSelect: (role: Role) => void;
}) {
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

  // Arrow keys move between roles, as in any tab list.
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const current = roles.findIndex((role) => role.role === selected);
    const last = roles.length - 1;
    let next: number;
    switch (event.key) {
      case "ArrowRight":
        next = current === last ? 0 : current + 1;
        break;
      case "ArrowLeft":
        next = current === 0 ? last : current - 1;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = last;
        break;
      default:
        return;
    }
    event.preventDefault();
    onSelect(roles[next].role);
    tabs.current[next]?.focus();
  }

  return (
    <div
      role="tablist"
      aria-label="Roles"
      onKeyDown={handleKeyDown}
      className="mt-5 inline-flex max-w-full flex-wrap gap-1 rounded-xl border border-line bg-canvas/60 p-1"
    >
      {roles.map((role, index) => {
        const isSelected = role.role === selected;
        return (
          <button
            key={role.role}
            ref={(element) => {
              tabs.current[index] = element;
            }}
            id={`role-tab-${role.role}`}
            type="button"
            role="tab"
            aria-selected={isSelected}
            aria-controls={panelId}
            tabIndex={isSelected ? 0 : -1}
            onClick={() => onSelect(role.role)}
            className={cn(
              "rounded-lg px-5 py-2 text-sm font-semibold transition-colors",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600",
              isSelected ? "bg-primary-600 text-on-accent shadow-xs" : "text-ink-soft hover:bg-white hover:text-ink",
            )}
          >
            {role.name}
          </button>
        );
      })}
    </div>
  );
}

function Legend({ levels }: { levels: AccessLevelOption[] }) {
  return (
    <ul aria-label="Access levels" className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {levels.map((option) => (
        <li key={option.level} className="flex items-center gap-1.5 text-xs text-ink-soft">
          <span aria-hidden="true" className={cn("size-2 rounded-full", levelColours[option.level].dot)} />
          {option.label}
        </li>
      ))}
    </ul>
  );
}

function CapabilityRow({ role, permission, grant, levelLabels, disabled, saving, onChange }: {
  role: RoleAccessView;
  permission: PermissionOption;
  grant: PermissionGrant;
  levelLabels: Record<Level, string>;
  /** True while any change is being saved. */
  disabled: boolean;
  /** True while this row's change is being saved. */
  saving: boolean;
  onChange: (level: Level) => void;
}) {
  const id = `level-${role.role}-${permission.permission}`;
  const editable = grant.lockedReason == null;
  const controlClasses = cn(
    "h-9 w-40 rounded-lg pl-3 text-sm font-semibold",
    levelColours[grant.level].control,
  );

  return (
    <li className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-5 py-4">
      <div className="min-w-0">
        {editable ? (
          <label htmlFor={id} className="block text-sm font-semibold text-ink">
            {permission.label}
          </label>
        ) : (
          <p className="text-sm font-semibold text-ink">{permission.label}</p>
        )}
        <p id={`${id}-description`} className="mt-0.5 text-xs text-ink-muted">
          {permission.description}
        </p>
        {grant.lockedReason && (
          <p className="mt-1 flex items-center gap-1 text-xs text-ink-muted">
            <Lock className="size-3 shrink-0" aria-hidden="true" />
            {grant.lockedReason}
          </p>
        )}
      </div>

      {editable ? (
        <div className="relative">
          <select
            id={id}
            aria-describedby={`${id}-description`}
            aria-busy={saving}
            value={grant.level}
            disabled={disabled}
            onChange={(event) => onChange(event.target.value as Level)}
            className={cn(
              controlClasses,
              "cursor-pointer appearance-none pr-9 disabled:cursor-wait",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600",
            )}
          >
            {permission.levels.map((level) => (
              <option key={level} value={level} className="bg-white text-ink">
                {levelLabels[level]}
              </option>
            ))}
          </select>
          {saving ? (
            <LoaderCircle
              className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin motion-reduce:animate-none"
              aria-hidden="true"
            />
          ) : (
            <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2" aria-hidden="true" />
          )}
        </div>
      ) : (
        <span className={cn(controlClasses, "inline-flex items-center justify-between pr-3")}>
          {levelLabels[grant.level]}
          {grant.lockedReason && <Lock className="size-3.5" aria-hidden="true" />}
        </span>
      )}
    </li>
  );
}

/** The authorities a role's level for a permission gives, as the server grants them. */
function authoritiesOf(grants: PermissionGrant[]) {
  const out = new Set<string>();
  for (const grant of grants) {
    const name = grant.permission;
    if (grant.level === "FULL") { out.add(`${name}:VIEW`); out.add(`${name}:CHANGE`); }
    if (grant.level === "VIEW_ONLY") out.add(`${name}:VIEW`);
    if (grant.level === "OWN_CLIENTS") out.add(`${name}:OWN_CLIENTS`);
    if (grant.level === "ASSIGNED") out.add(`${name}:ASSIGNED`);
  }
  return out;
}

/**
 * The Screens tab: every back-office screen under its menu name, grouped as the menu groups them, with the role's
 * level for each. A screen switched on that the role's Actions do not yet allow says which action it also needs.
 */
function ScreenCapabilities({ screens, actions }: { screens: ScreenMatrix; actions: PermissionMatrix }) {
  const user = useStaffUser();
  const { reloadUser } = useSession();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [saved, setSaved] = useState<Notice>();

  const selected = screens.roles.find((role) => role.role === searchParams.get("role")) ?? screens.roles[0];
  const levelLabels = Object.fromEntries(screens.levels.map((option) => [option.level, option.label])) as Record<Level, string>;
  const permissionLabels = Object.fromEntries(actions.permissions.map((one) => [one.permission, one.label]));

  const update = useUpdateRoleScreen<ApiError>({
    mutation: {
      onMutate: () => setSaved(undefined),
      onSuccess: (updated, { screen, data }) => {
        queryClient.setQueryData<ScreenMatrix>(getGetScreenMatrixQueryKey(), (current) =>
          current && { ...current, roles: current.roles.map((role) => (role.role === updated.role ? updated : role)) },
        );
        const label = screens.screens.find((option) => option.screen === screen)?.label ?? screen;
        setSaved({ tone: "success", message: `Saved: ${updated.name} · ${label} is now ${levelLabels[data.level]}.` });
        if (updated.role === user.activeRole) void reloadUser();
      },
      onError: (error) => {
        setSaved({ tone: "danger", message: error.message });
        void queryClient.invalidateQueries({ queryKey: getGetScreenMatrixQueryKey() });
      },
    },
  });

  if (!selected) {
    return <p className="mt-6 text-sm text-ink-muted">No roles have been set up yet.</p>;
  }
  const granted = authoritiesOf(actions.roles.find((role) => role.role === selected.role)?.grants ?? []);
  const saving = update.isPending ? update.variables : undefined;
  const panelId = "role-screens-panel";
  const sections = [...new Set(screens.screens.map((one) => one.section))];

  return (
    <>
      <RoleTabs
        roles={screens.roles}
        selected={selected.role}
        panelId={panelId}
        onSelect={(role) => {
          setSaved(undefined);
          const next = new URLSearchParams(searchParams);
          next.set("role", role);
          setSearchParams(next, { replace: true });
        }}
      />

      <div className="mt-5 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <p aria-live="polite" className={cn("min-h-4 text-xs", saved?.tone === "danger" ? "text-red-600" : "text-ink-muted")}>
          {saved?.message}
        </p>
        <Legend levels={screens.levels} />
      </div>

      <div id={panelId} role="tabpanel" aria-labelledby={`role-tab-${selected.role}`} className="mt-3 space-y-5">
        {sections.map((section) => (
          <div key={section}>
            <h3 className="mb-2 text-2xs font-semibold tracking-wider text-ink-muted uppercase">{section}</h3>
            <ul className="divide-y divide-line rounded-xl border border-line">
              {screens.screens.filter((one) => one.section === section).map((screen) => {
                const grant = selected.grants.find((candidate) => candidate.screen === screen.screen);
                if (!grant) return null;
                const needs = screenNeeds(screen.path);
                const missing = grant.level !== "NONE" && needs != null && !needs.some((one) => granted.has(one))
                  ? [...new Set(needs.map((one) => permissionLabels[one.split(":")[0] ?? ""] ?? one))]
                  : [];
                return (
                  <ScreenRow
                    key={screen.screen}
                    role={selected}
                    screen={screen}
                    grant={grant}
                    levels={screens.levels.map((one) => one.level)}
                    levelLabels={levelLabels}
                    missing={missing}
                    disabled={saving !== undefined}
                    saving={saving?.role === selected.role && saving.screen === screen.screen}
                    onChange={(level) => update.mutate({ role: selected.role, screen: screen.screen, data: { level } })}
                  />
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </>
  );
}

function ScreenRow({ role, screen, grant, levels, levelLabels, missing, disabled, saving, onChange }: {
  role: { role: Role };
  screen: ScreenOption;
  grant: ScreenGrant;
  levels: Level[];
  levelLabels: Record<Level, string>;
  /** The actions the role still needs before this screen, switched on, opens for it. */
  missing: string[];
  disabled: boolean;
  saving: boolean;
  onChange: (level: Level) => void;
}) {
  const id = `screen-${role.role}-${screen.screen}`;
  const editable = grant.lockedReason == null;
  const controlClasses = cn("h-9 w-40 rounded-lg pl-3 text-sm font-semibold", levelColours[grant.level].control);

  return (
    <li className={cn("flex flex-wrap items-center justify-between gap-x-6 gap-y-3 py-4 pr-5", screen.under ? "pl-10" : "pl-5")}>
      <div className="min-w-0">
        {editable ? (
          <label htmlFor={id} className="block text-sm font-semibold text-ink">{screen.label}</label>
        ) : (
          <p className="text-sm font-semibold text-ink">{screen.label}</p>
        )}
        <p id={`${id}-description`} className="mt-0.5 text-xs text-ink-muted">{screen.description}</p>
        {grant.lockedReason && (
          <p className="mt-1 flex items-center gap-1 text-xs text-ink-muted">
            <Lock className="size-3 shrink-0" aria-hidden="true" />
            {grant.lockedReason}
          </p>
        )}
        {missing.length > 0 && (
          <p className="mt-1 text-xs text-amber-700">
            Opens only once this role also has {missing.join(" or ")} in Actions.
          </p>
        )}
      </div>

      {editable ? (
        <div className="relative">
          <select
            id={id}
            aria-describedby={`${id}-description`}
            aria-busy={saving}
            value={grant.level}
            disabled={disabled}
            onChange={(event) => onChange(event.target.value as Level)}
            className={cn(
              controlClasses,
              "cursor-pointer appearance-none pr-9 disabled:cursor-wait",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600",
            )}
          >
            {levels.map((level) => (
              <option key={level} value={level} className="bg-white text-ink">{levelLabels[level]}</option>
            ))}
          </select>
          {saving ? (
            <LoaderCircle
              className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin motion-reduce:animate-none"
              aria-hidden="true"
            />
          ) : (
            <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2" aria-hidden="true" />
          )}
        </div>
      ) : (
        <span className={cn(controlClasses, "inline-flex items-center justify-between pr-3")}>
          {levelLabels[grant.level]}
          <Lock className="size-3.5" aria-hidden="true" />
        </span>
      )}
    </li>
  );
}
