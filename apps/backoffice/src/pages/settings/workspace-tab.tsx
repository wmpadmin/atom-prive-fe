import { ApiError } from "@atomprive/api-client";
import { useEnterWorkspace, type StaffProfile } from "@atomprive/api-client/backoffice";
import { Alert, Button, SelectInput } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import { Columns3, LayoutGrid, MonitorCog, Users } from "lucide-react";
import { useState } from "react";
import { menuFor } from "../../menu";
import { useSession } from "../../auth/session";
import { formatDateTime } from "../../lib/labels";
import { PAGE_SIZES } from "../../lib/page-sizes";
import { usePreferences, type DateFormat, type TimeFormat } from "../../lib/preferences";
import { forgetEveryTableView, tableViewsKept } from "../../lib/table-view";
import { roleLabels, type StaffRole } from "../../lib/labels";
import { Pair, Panel, Setting, Settings } from "./settings-parts";

/**
 * How this reader's own back office behaves: where it opens, how long its tables are, how its dates read.
 *
 * <p>Almost all of this is real, and real because none of it is a fact about the firm. How many rows fit
 * on a screen and whether a date reads 28 Oct 2026 or 2026-10-28 are things about a person's eyes and
 * their job; they are kept in this browser, they take effect at once, and they need no column, no endpoint
 * and nobody's approval. The trade is that they follow a reader on this machine and not to another, which
 * is the right way round for a preference and the wrong way round for a record.
 */
export function WorkspaceTab({ user }: { user: StaffProfile }) {
  const { preferences, change, reset } = usePreferences();
  const wearsSeveralHats = user.roles.length > 1;
  // Only the screens this reader may actually open — their own menu, the same list the sidebar draws.
  // Offering any more than that would land them somewhere their role is bounced off.
  const destinations = menuFor(user);

  return (
    <div className="space-y-6">
      {/* Only to somebody who holds more than one role; for everybody else there is nothing to choose. */}
      {wearsSeveralHats && <WhichDesk user={user} />}

      <Panel
        icon={<MonitorCog />}
        title="Display"
        lead="Where the platform opens, and how much of it fits on a screen. Kept in this browser."
      >
        <Settings>
          <Setting
            label="Open on"
            hint="Where you land when you sign in."
            htmlFor="landing"
          >
            <SelectInput
              id="landing"
              value={preferences.landing}
              onChange={(event) => change("landing", event.target.value)}
            >
              <option value="home">My home screen</option>
              {destinations.map((one) => (
                <option key={one.to} value={one.to}>
                  {one.label}
                </option>
              ))}
            </SelectInput>
          </Setting>

          <Setting label="Rows per page" hint="What a table starts with. Each one can still be changed as you read it." htmlFor="page-size">
            <SelectInput
              id="page-size"
              value={String(preferences.pageSize)}
              onChange={(event) => change("pageSize", Number(event.target.value))}
            >
              {PAGE_SIZES.map((size) => (
                <option key={size} value={String(size)}>
                  {size} rows
                </option>
              ))}
            </SelectInput>
          </Setting>

          <Setting label="Dates read" htmlFor="date-format">
            <SelectInput
              id="date-format"
              value={preferences.dateFormat}
              onChange={(event) => change("dateFormat", event.target.value as DateFormat)}
            >
              <option value="medium">28 Oct 2026</option>
              <option value="dmy">28/10/2026</option>
              <option value="mdy">10/28/2026</option>
              <option value="iso">2026-10-28</option>
            </SelectInput>
          </Setting>

          <Setting label="Times read" htmlFor="time-format">
            <SelectInput
              id="time-format"
              value={preferences.timeFormat}
              onChange={(event) => change("timeFormat", event.target.value as TimeFormat)}
            >
              <option value="24">14:30</option>
              <option value="12">2:30 pm</option>
            </SelectInput>
          </Setting>
        </Settings>

        {/* Shown rather than described: a reader picking a date shape wants to see the shape. */}
        <p className="mt-4 rounded-lg bg-canvas px-3 py-2 text-xs text-ink-soft">
          A date and time now read{" "}
          <strong className="font-semibold text-ink tabular-nums">{formatDateTime(new Date().toISOString())}</strong>
          {" "}across every screen.
        </p>
      </Panel>

      <Pair>
        <Panel
          icon={<LayoutGrid />}
          title="Density"
          lead="How much air a screen has. Type stays the size it is either way — more rows, not smaller words."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <DensityChoice
              on={preferences.density === "comfortable"}
              onChoose={() => change("density", "comfortable")}
              title="Comfortable"
              lead="Room between rows."
              rows={3}
              gap="gap-[7px]"
            />
            <DensityChoice
              on={preferences.density === "compact"}
              onChoose={() => change("density", "compact")}
              title="Compact"
              lead="More on a screen."
              rows={5}
              gap="gap-[3px]"
            />
          </div>
        </Panel>

        <Panel
          icon={<Columns3 />}
          title="Table layouts"
          lead="The columns you have hidden or reordered, kept per table in this browser."
        >
          <KeptLayouts />
        </Panel>
      </Pair>

      <Panel title="Starting over" lead="Puts every setting on this tab back to the firm's own defaults.">
        <Button variant="secondary" onClick={reset}>
          Reset my display settings
        </Button>
      </Panel>
    </div>
  );
}

/** One of the two densities, shown as what it does rather than named and left at that. */
function DensityChoice({
  on,
  onChoose,
  title,
  lead,
  rows,
  gap,
}: {
  on: boolean;
  onChoose: () => void;
  title: string;
  lead: string;
  rows: number;
  gap: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onChoose}
      className={`rounded-xl border p-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 ${
        on ? "border-primary-600 bg-primary-50/50 ring-1 ring-primary-600" : "border-line hover:bg-canvas"
      }`}
    >
      {/* A little picture of the thing, which says it faster than the words under it. */}
      <span aria-hidden="true" className={`flex h-[3.25rem] flex-col justify-center ${gap}`}>
        {/* The chosen one's rows are the strong colour rather than a pale tint of it: on this tile's own
            blue ground a tint disappeared altogether, so the density you had picked was the one you
            could not see. */}
        {Array.from({ length: rows }, (_, row) => (
          <span key={row} className={`h-[3px] rounded-full ${on ? "bg-primary-600" : "bg-slate-300"}`} />
        ))}
      </span>
      <span className="mt-2 block text-sm font-semibold text-ink">{title}</span>
      <span className="block text-xs text-ink-muted">{lead}</span>
    </button>
  );
}

/** How many table arrangements this browser is holding, and the one way to be rid of them. */
function KeptLayouts() {
  const [kept, setKept] = useState(tableViewsKept);
  const [forgotten, setForgotten] = useState<number>();

  return (
    <>
      <p className="text-sm text-ink-soft">
        {kept === 0
          ? "Every table is in the firm's own order. Hide or move a column on one and it will be remembered here."
          : `${kept} ${kept === 1 ? "table is" : "tables are"} arranged your way.`}
      </p>
      {forgotten !== undefined && (
        <div className="mt-3">
          <Alert tone="success">
            {forgotten === 0
              ? "There was nothing kept to forget."
              : `${forgotten} ${forgotten === 1 ? "layout" : "layouts"} forgotten. Tables are back in the firm's order.`}
          </Alert>
        </div>
      )}
      <Button
        variant="secondary"
        className="mt-3"
        disabled={kept === 0}
        onClick={() => {
          setForgotten(forgetEveryTableView());
          setKept(0);
        }}
      >
        Forget my table layouts
      </Button>
    </>
  );
}

/**
 * The role this reader opens in, which they set for themselves.
 *
 * <p>The Admin chooses it when a member of staff is added, and this is where that person changes their own
 * mind. It takes effect at once — picking one enters it — so the screens change under them as they choose,
 * which is the point: it is their workspace, not a preference to be applied later.
 */
function WhichDesk({ user }: { user: StaffProfile }) {
  const queryClient = useQueryClient();
  const { applyProfile } = useSession();
  const [saved, setSaved] = useState(false);
  const enter = useEnterWorkspace<ApiError>({
    mutation: {
      onSuccess: (profile) => {
        setSaved(true);
        // The menu and every screen behind it are the active role's, so none of what is cached still
        // applies — and the profile has to be taken in hand too, or the sidebar redraws as it was.
        queryClient.clear();
        applyProfile(profile);
      },
    },
  });

  return (
    <Panel
      icon={<Users />}
      title="Which desk you open at"
      lead="You hold more than one role. The one you open in decides what you see when you sign in — and you move into it as soon as you choose it."
    >
      {enter.isError && (
        <div className="mb-3">
          <Alert tone="danger">{enter.error.message}</Alert>
        </div>
      )}
      {saved && !enter.isError && (
        <div className="mb-3">
          <Alert tone="success">
            You open in {roleLabels[(user.opensIn ?? user.activeRole) as StaffRole]} from now on.
          </Alert>
        </div>
      )}
      <Setting label="I open in" htmlFor="opens-in">
        <div className="max-w-xs">
          <SelectInput
            id="opens-in"
            value={(user.opensIn ?? user.activeRole ?? "") as string}
            disabled={enter.isPending}
            onChange={(event) => {
              const role = event.target.value as StaffRole;
              setSaved(false);
              enter.mutate({ data: { role, fromNowOn: true } });
            }}
          >
            {user.roles.map((role) => (
              <option key={role} value={role}>
                {roleLabels[role as StaffRole]}
              </option>
            ))}
          </SelectInput>
        </div>
      </Setting>
    </Panel>
  );
}
