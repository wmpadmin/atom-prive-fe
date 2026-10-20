import type { ApiError } from "@atomprive/api-client";
import {
  useClearSchedule,
  useListSchedules,
  useSetSchedule,
  type DeclarationScheduleRow,
  type DeclarationSchedulePage,
  type DeclarationScheduleRowCadence,
} from "@atomprive/api-client/backoffice";
import { Alert, Button, Dialog, SelectInput, TextInput } from "@atomprive/ui";
import { RotateCcw } from "lucide-react";
import { useState } from "react";

/**
 * How often each declaration is wanted, in the firm's own words.
 *
 * <p>It was written into the code each one shipped with, so moving the Conflict of Interest form from
 * yearly to six-monthly was a release — a software change standing in front of a compliance calendar.
 *
 * <p>Opened from the register rather than from Configuration, because the permission that lets somebody
 * chase a declaration is the permission that lets them say how often it is wanted: the same people, on the
 * screen where they already notice that a cycle is wrong.
 */
const CADENCES: { id: DeclarationScheduleRowCadence; label: string }[] = [
  { id: "WEEKLY", label: "Weekly" },
  { id: "MONTHLY", label: "Monthly" },
  { id: "QUARTERLY", label: "Quarterly" },
  { id: "SIX_MONTHLY", label: "Six-monthly" },
  { id: "ANNUAL", label: "Annual" },
  { id: "ON_APPOINTMENT", label: "On appointment and on change" },
  { id: "ON_JOINING", label: "One-off, on joining" },
];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Monday is 1, the way the server numbers them. */
const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/** A cadence that comes round needs a day to come round on; one that does not has no day of its own. */
function recurs(cadence: DeclarationScheduleRowCadence) {
  return cadence !== "ON_APPOINTMENT" && cadence !== "ON_JOINING";
}

/**
 * Whether the day it is set to is a day of the week rather than a day of the year.
 *
 * <p>Weekly is the one cycle that does not take a month and a date: "the 31st, every week" is not a rule
 * anybody could follow. So the two boxes swap for one, and the server holds the two apart as well — a
 * weekly cycle has no day of the year, and nothing else has a day of the week.
 */
function onAWeekday(cadence: DeclarationScheduleRowCadence) {
  return cadence === "WEEKLY";
}

export function HowOftenDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const schedules = useListSchedules<DeclarationSchedulePage, ApiError>({ query: { enabled: open } });
  const [editing, setEditing] = useState<string | null>(null);

  return (
    <Dialog
      open={open}
      size="lg"
      title="How often each declaration is wanted"
      description={
        "Changing one takes effect at once, on everybody: nothing records the cycle a signature was given "
        + "under, so a declaration moved from yearly to six-monthly moves every next-due date the firm holds."
      }
      onClose={onClose}
    >
      {schedules.isError && <Alert tone="danger">{schedules.error.message}</Alert>}
      {schedules.isPending ? (
        <p className="text-sm text-ink-muted">Reading the firm's cycles…</p>
      ) : (
        <ul className="divide-y divide-line">
          {(schedules.data?.items ?? []).map((row) => (
            <li key={row.kind} className="py-4 first:pt-0">
              {/* The list is what the row is read from, so a change that does not reach it is a change
                  the reader cannot see happened. The server hands back the whole list on every write and
                  react-query has no way to know that, so it is asked again. */}
              {editing === row.kind ? (
                <OneCycle
                  row={row}
                  onDone={() => setEditing(null)}
                  onSaved={() => void schedules.refetch()}
                />
              ) : (
                <AtRest
                  row={row}
                  onChange={() => setEditing(row.kind)}
                  onCleared={() => void schedules.refetch()}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  );
}

/** One row as it sits: what the cycle is, and whose answer that is. */
function AtRest({ row, onChange, onCleared }: {
  row: DeclarationScheduleRow;
  onChange: () => void;
  onCleared: () => void;
}) {
  const clear = useClearSchedule<ApiError>({ mutation: { onSuccess: onCleared } });
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-ink">{row.title}</p>
        <p className="mt-0.5 text-sm text-ink-muted">{row.schedule}</p>
        {/* Whose answer it is, and what it would go back to. Somebody changing a cycle wants to know
            whether they are changing the firm's own decision or the one it arrived with. */}
        {row.setByTheFirm && (
          <p className="mt-0.5 text-xs text-ink-muted">
            Set by {row.changedByName ?? "the firm"} · was {row.asShipped}
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {row.setByTheFirm && (
          <Button
            variant="secondary"
            size="sm"
            disabled={clear.isPending}
            onClick={() => clear.mutate({ kind: row.kind })}
          >
            <RotateCcw aria-hidden="true" className="size-3.5" />
            Put back
          </Button>
        )}
        <Button variant="secondary" size="sm" onClick={onChange}>
          Change
        </Button>
      </div>
    </div>
  );
}

/** One row being changed: how often, and by which day of the year. */
function OneCycle({ row, onDone, onSaved }: {
  row: DeclarationScheduleRow;
  onDone: () => void;
  onSaved: () => void;
}) {
  const set = useSetSchedule<ApiError>({
    mutation: {
      onSuccess: () => {
        onSaved();
        onDone();
      },
    },
  });
  const [cadence, setCadence] = useState<DeclarationScheduleRowCadence>(row.cadence);
  // A day of the YEAR, not a day in one: "the 31st of January" is the rule, and 31 January 2026 is only
  // the first time it comes round. So it is a month and a day rather than a date picker.
  const [month, setMonth] = useState(String(row.dueMonth ?? 1));
  const [day, setDay] = useState(String(row.dueDay ?? 31));
  const [weekday, setWeekday] = useState(String(row.dueWeekday ?? 1));
  const refused = set.isError ? set.error : null;

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        set.mutate({
          kind: row.kind,
          data: {
            cadence,
            // The two kinds of day never travel together, which is what the server refuses to hold.
            dueMonth: recurs(cadence) && !onAWeekday(cadence) ? Number(month) : null,
            dueDay: recurs(cadence) && !onAWeekday(cadence) ? Number(day) : null,
            dueWeekday: onAWeekday(cadence) ? Number(weekday) : null,
          },
        });
      }}
    >
      <p className="text-sm font-semibold text-ink">{row.title}</p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="block text-2xs font-semibold tracking-wider text-ink-muted uppercase">
            How often
          </span>
          <SelectInput
            id={`cadence-${row.kind}`}
            value={cadence}
            onChange={(event) => setCadence(event.target.value as DeclarationScheduleRowCadence)}
            className="w-56"
          >
            {CADENCES.map((one) => (
              <option key={one.id} value={one.id}>{one.label}</option>
            ))}
          </SelectInput>
        </label>
        {/* Only where it comes round. A day on a one-off is a day nobody would ever be asked for, and a
            box somebody fills in that the server then ignores is a rule they believe is in force. */}
        {onAWeekday(cadence) && (
          <label className="block">
            <span className="block text-2xs font-semibold tracking-wider text-ink-muted uppercase">
              Day of the week
            </span>
            <SelectInput
              id={`weekday-${row.kind}`}
              value={weekday}
              onChange={(event) => setWeekday(event.target.value)}
              className="w-36"
            >
              {WEEKDAYS.map((name, at) => (
                <option key={name} value={String(at + 1)}>{name}</option>
              ))}
            </SelectInput>
          </label>
        )}
        {recurs(cadence) && !onAWeekday(cadence) && (
          <>
            <label className="block">
              <span className="block text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                Month
              </span>
              <SelectInput
                id={`month-${row.kind}`}
                value={month}
                onChange={(event) => setMonth(event.target.value)}
                className="w-28"
              >
                {MONTHS.map((name, at) => (
                  <option key={name} value={String(at + 1)}>{name}</option>
                ))}
              </SelectInput>
            </label>
            <label className="block">
              <span className="block text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                Day
              </span>
              <TextInput
                id={`day-${row.kind}`}
                inputMode="numeric"
                value={day}
                onChange={(event) => setDay(event.target.value)}
                className="w-20"
              />
            </label>
          </>
        )}
      </div>
      {/* Said where it is chosen rather than only in the dialog's own blurb: the 31st, stepped quarterly,
          is the end of every quarter, and that is the whole reason the day is a day of the year. */}
      {recurs(cadence) && !onAWeekday(cadence) && (
        <p className="text-xs text-ink-muted">
          A day the month is too short for falls on that month's last, so the 31st every three months is
          the end of each quarter.
        </p>
      )}
      {/* Said where it is chosen, because a week is a tight cycle and the rule surprises people: it is the
          next such day AFTER the signature, the same as every other cycle here. Signed on the Wednesday,
          a declaration due on Fridays is wanted again two days later. */}
      {onAWeekday(cadence) && (
        <p className="text-xs text-ink-muted">
          Wanted again on the next {WEEKDAYS[Number(weekday) - 1] ?? "day"} after it is signed — which can
          be a day or two later, for somebody who signs it late in the week.
        </p>
      )}
      {refused && <Alert tone="danger">{refused.message}</Alert>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={set.isPending}>
          {set.isPending ? "Saving…" : "Save"}
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
