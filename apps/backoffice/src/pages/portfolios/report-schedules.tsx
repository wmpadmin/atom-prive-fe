import { ApiError } from "@atomprive/api-client";
import {
  getListReportSchedulesQueryKey,
  useListReportSchedules,
  useScheduleReport,
  useSwitchReportSchedule,
  type ScheduleRow,
  type SchedulesPage,
} from "@atomprive/api-client/backoffice";
import { Alert, Badge, Button, Field, SelectInput, cn } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarClock } from "lucide-react";
import { useState, type FormEvent } from "react";
import { noErrors, toFormErrors, type FormErrors } from "../../lib/api-errors";
import { formatDateTime } from "../../lib/labels";

type Kind = ScheduleRow["kind"];
type Scope = ScheduleRow["scope"];
type Cadence = ScheduleRow["cadence"];
type SendTo = ScheduleRow["sendTo"];
type Format = ScheduleRow["format"];

/** What each run comes out as. A client's own report is usually the letterheaded one. */
const FORMATS: Record<Format, string> = {
  CSV: "Spreadsheet",
  PDF: "On the letterhead",
};

const CADENCES: Record<Cadence, string> = {
  MONTHLY_FIRST: "Monthly, on the 1st",
  QUARTERLY: "Quarterly",
  AFTER_EACH_REBALANCE: "After each rebalance",
};

const SEND_TO: Record<SendTo, string> = {
  NOBODY: "Filed, nobody told",
  ADVISOR: "The client's advisor",
  CLIENT: "The client",
  BOTH: "Advisor and client",
};

/**
 * Reports that arrive by themselves. Each run goes on the same record as any other report, with its cadence
 * stamped on it instead of "On demand", and says what came of telling anybody.
 */
export function ReportSchedules({
  mayChange,
  kinds,
  clients,
  models,
}: {
  mayChange: boolean;
  kinds: { kind: Kind; title: string }[];
  clients: { id: string; fullName: string }[];
  models: { id: string; name: string }[];
}) {
  const queryClient = useQueryClient();
  const schedules = useListReportSchedules<SchedulesPage, ApiError>();
  const [kind, setKind] = useState<Kind>("ALLOCATION_VS_PLAN");
  const [scope, setScope] = useState<Scope>("FIRM");
  const [scopeId, setScopeId] = useState("");
  const [cadence, setCadence] = useState<Cadence>("MONTHLY_FIRST");
  const [sendTo, setSendTo] = useState<SendTo>("NOBODY");
  const [format, setFormat] = useState<Format>("CSV");
  const [errors, setErrors] = useState<FormErrors>(noErrors);

  const kept = () => void queryClient.invalidateQueries({ queryKey: getListReportSchedulesQueryKey() });
  const create = useScheduleReport<ApiError>({
    mutation: {
      onSuccess: () => {
        setErrors(noErrors);
        kept();
      },
      onError: (caught) => setErrors(toFormErrors(caught)),
    },
  });
  const switched = useSwitchReportSchedule<ApiError>({ mutation: { onSuccess: kept } });

  // Only a report about one client has an advisor and a client to tell; anything wider is filed.
  const canTellSomebody = scope === "CLIENT";

  function submit(event: FormEvent) {
    event.preventDefault();
    create.mutate({
      data: {
        kind,
        scope,
        scopeId: scope === "FIRM" ? null : scopeId || null,
        cadence,
        sendTo: canTellSomebody ? sendTo : "NOBODY",
        format,
      },
    });
  }

  const rows = schedules.data?.items ?? [];

  return (
    <section className="space-y-4">
      {mayChange && (
        <div className="rounded-2xl border border-line bg-white p-5">
          <h2 className="text-base font-bold">Or have it arrive by itself</h2>
          {errors.form && (
            <div className="mt-3">
              <Alert tone="danger">{errors.form}</Alert>
            </div>
          )}
          <form onSubmit={submit} className="mt-3 grid gap-3 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1fr_1fr_auto] lg:items-end">
            <Field id="sched-kind" label="Report" error={errors.fields.kind}>
              <SelectInput id="sched-kind" value={kind} onChange={(e) => setKind(e.target.value as Kind)}>
                {kinds.map((one) => (
                  <option key={one.kind} value={one.kind}>
                    {one.title}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Field id="sched-scope" label="Covering" error={errors.fields.scope}>
              <SelectInput
                id="sched-scope"
                value={scope}
                onChange={(event) => {
                  setScope(event.target.value as Scope);
                  setScopeId("");
                  // A wider report has nobody in particular to tell, so the choice goes back to filing it.
                  if (event.target.value !== "CLIENT") setSendTo("NOBODY");
                }}
              >
                <option value="FIRM">Every client</option>
                <option value="MODEL">Everyone on a model</option>
                <option value="CLIENT">One client</option>
              </SelectInput>
            </Field>
            <Field id="sched-which" label="Which" error={errors.fields.scopeId}>
              {scope === "FIRM" ? (
                <SelectInput id="sched-which" value="" disabled>
                  <option value="">Not needed</option>
                </SelectInput>
              ) : (
                <SelectInput id="sched-which" value={scopeId} onChange={(e) => setScopeId(e.target.value)}>
                  <option value="">{scope === "MODEL" ? "Choose a model" : "Choose a client"}</option>
                  {scope === "MODEL"
                    ? models.map((model) => (
                        <option key={model.id} value={model.id}>
                          {model.name}
                        </option>
                      ))
                    : clients.map((client) => (
                        <option key={client.id} value={client.id}>
                          {client.fullName}
                        </option>
                      ))}
                </SelectInput>
              )}
            </Field>
            <Field id="sched-cadence" label="How often" error={errors.fields.cadence}>
              <SelectInput
                id="sched-cadence"
                value={cadence}
                onChange={(e) => setCadence(e.target.value as Cadence)}
              >
                {(Object.keys(CADENCES) as Cadence[]).map((one) => (
                  <option key={one} value={one}>
                    {CADENCES[one]}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Field id="sched-send" label="Tell" error={errors.fields.sendTo}>
              <SelectInput
                id="sched-send"
                value={canTellSomebody ? sendTo : "NOBODY"}
                disabled={!canTellSomebody}
                onChange={(e) => setSendTo(e.target.value as SendTo)}
              >
                {(Object.keys(SEND_TO) as SendTo[]).map((one) => (
                  <option key={one} value={one}>
                    {SEND_TO[one]}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Field id="sched-format" label="As" error={errors.fields.format}>
              <SelectInput
                id="sched-format"
                value={format}
                onChange={(event) => setFormat(event.target.value as Format)}
              >
                {(Object.keys(FORMATS) as Format[]).map((one) => (
                  <option key={one} value={one}>
                    {FORMATS[one]}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Button type="submit" disabled={create.isPending || (scope !== "FIRM" && !scopeId)}>
              <CalendarClock aria-hidden="true" />
              {create.isPending ? "Saving…" : "Schedule"}
            </Button>
          </form>

          {/* A report read by date covers the stretch that has just ended, so each run says something new. */}
          {kind === "TRADE_ORDERS" && (
            <p className="mt-2 text-xs text-ink-muted">
              {cadence === "MONTHLY_FIRST"
                ? "Each run covers the month just gone."
                : cadence === "QUARTERLY"
                  ? "Each run covers the quarter just gone."
                  : "Each run covers whatever has been raised since the last one."}
            </p>
          )}
          <p className="mt-2 text-xs text-ink-muted">
            {canTellSomebody
              ? "Emailed with the report attached, as soon as it is produced."
              : "A report about a model or the whole firm is filed: there is nobody in particular to tell."}
          </p>
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
              <th scope="col" className="py-3 pr-4 pl-5">Scheduled report</th>
              <th scope="col" className="px-4 py-3">Covering</th>
              <th scope="col" className="px-4 py-3">How often</th>
              <th scope="col" className="px-4 py-3">As</th>
              <th scope="col" className="px-4 py-3">Tells</th>
              <th scope="col" className="px-4 py-3">Last run</th>
              <th scope="col" className="py-3 pr-5 pl-4">
                <span className="sr-only">On or off</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {schedules.isPending && (
              <tr>
                <td colSpan={7} className="px-5 py-8 text-center text-ink-muted">Reading the schedules…</td>
              </tr>
            )}
            {schedules.data && rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-8 text-center text-ink-muted">
                  Nothing arrives by itself yet.
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.id} className={cn("hover:bg-slate-50/60", !row.active && "opacity-60")}>
                <td className="py-3 pr-4 pl-5 font-semibold">{row.title}</td>
                <td className="px-4 py-3 text-ink-soft">{row.scopeLabel}</td>
                <td className="px-4 py-3 whitespace-nowrap text-ink-soft">{CADENCES[row.cadence]}</td>
                <td className="px-4 py-3 whitespace-nowrap text-ink-soft">{FORMATS[row.format]}</td>
                <td className="px-4 py-3 whitespace-nowrap text-ink-soft">{SEND_TO[row.sendTo]}</td>
                <td className="px-4 py-3">
                  {row.lastRunAt === null ? (
                    <span className="text-ink-muted">Not yet</span>
                  ) : (
                    <>
                      <span className="block whitespace-nowrap text-ink-soft">{formatDateTime(row.lastRunAt)}</span>
                      {/* What happened last time, so a schedule quietly failing is seen rather than assumed. */}
                      {row.lastOutcome && (
                        <span
                          className={cn(
                            "block text-xs",
                            row.lastOutcome.startsWith("Couldn't") ? "text-rose-700" : "text-ink-muted",
                          )}
                        >
                          {row.lastOutcome}
                        </span>
                      )}
                    </>
                  )}
                </td>
                <td className="py-3 pr-5 pl-4 text-right whitespace-nowrap">
                  {row.active ? <Badge tone="success">On</Badge> : <Badge tone="neutral">Off</Badge>}
                  {mayChange && (
                    <button
                      type="button"
                      onClick={() => switched.mutate({ id: row.id, params: { on: !row.active } })}
                      className="ml-3 text-sm font-medium text-primary-700 hover:underline"
                    >
                      {row.active ? "Stop" : "Start"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
