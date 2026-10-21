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
import { PagedFooter, usePagedRows } from "../../lib/paged-rows";
import { NotAsked, ReportFields } from "./report-fields";
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
  MONTHLY_FIRST: "Every month, on the 1st",
  QUARTERLY: "Every three months",
  AFTER_EACH_REBALANCE: "Each time a rebalance is recorded",
};

const SEND_TO: Record<SendTo, string> = {
  NOBODY: "Nobody — just save it",
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
  // The schedules come back whole rather than a page at a time, so the page is taken here.
  const paged = usePagedRows(rows);

  return (
    <section className="space-y-4">
      {mayChange && (
        <div className="rounded-2xl border border-line bg-white p-5">
          <h2 className="text-base font-bold">Set up a report that repeats on its own</h2>
          <p className="mt-0.5 text-xs text-ink-muted">
            Set this up once and the platform makes the same report again and again — every month, every
            three months, or each time a rebalance is recorded. Nobody has to come back and press anything,
            and it can be emailed out as soon as it is made.
          </p>
          {errors.form && (
            <div className="mt-3">
              <Alert tone="danger">{errors.form}</Alert>
            </div>
          )}
          {/* The same four across as producing one now, so the two forms line up down the page: six fields
              crammed into one row with the button on the end left every box too narrow to read. */}
          <form onSubmit={submit} className="mt-3 space-y-4">
            <ReportFields>
            <Field id="sched-kind" label="What you want" error={errors.fields.kind}>
              <SelectInput id="sched-kind" value={kind} onChange={(e) => setKind(e.target.value as Kind)}>
                {kinds.map((one) => (
                  <option key={one.kind} value={one.kind}>
                    {one.title}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Field id="sched-scope" label="Who it is about" error={errors.fields.scope}>
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
                <option value="MODEL">Everyone on one model</option>
                <option value="CLIENT">Just one client</option>
              </SelectInput>
            </Field>
            {scope === "FIRM" ? (
              <NotAsked id="sched-which" label="Which one" says="Every client — nothing to pick" />
            ) : (
              <Field id="sched-which" label="Which one" error={errors.fields.scopeId}>
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
              </Field>
            )}
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
            {/* A report about a model or the whole firm has nobody in particular to tell, so it is not a
                choice to be greyed out — it is a choice that does not arise. */}
            {canTellSomebody ? (
              <Field id="sched-send" label="Email it to" error={errors.fields.sendTo}>
                <SelectInput
                  id="sched-send"
                  value={sendTo}
                  onChange={(e) => setSendTo(e.target.value as SendTo)}
                >
                  {(Object.keys(SEND_TO) as SendTo[]).map((one) => (
                    <option key={one} value={one}>
                      {SEND_TO[one]}
                    </option>
                  ))}
                </SelectInput>
              </Field>
            ) : (
              <NotAsked id="sched-send" label="Email it to" says="Nobody — it is just saved here" />
            )}
            <Field id="sched-format" label="File type" error={errors.fields.format}>
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
            </ReportFields>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="max-w-prose text-xs text-ink-muted">
                {canTellSomebody
                  ? "Emailed to them with the file attached, as soon as it is made."
                  : "Nobody is emailed. It appears under Reports already made, for whoever wants it."}
              </p>
              <Button type="submit" disabled={create.isPending || (scope !== "FIRM" && !scopeId)}>
                <CalendarClock aria-hidden="true" />
                {create.isPending ? "Setting it up…" : "Set it up"}
              </Button>
            </div>
          </form>
        </div>
      )}

      <div className="rounded-2xl border border-line bg-white">
        {/* The sideways scroll is its own box so that the footer below sits still while a table wider
            than the card is dragged across. */}
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                <th scope="col" className="py-3 pr-4 pl-5">Report</th>
                <th scope="col" className="px-4 py-3">Who it covers</th>
                <th scope="col" className="px-4 py-3">How often</th>
                <th scope="col" className="px-4 py-3">File type</th>
                <th scope="col" className="px-4 py-3">Emailed to</th>
                <th scope="col" className="px-4 py-3">Last made</th>
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
                    Nothing is set up yet. Anything you set up above is listed here.
                  </td>
                </tr>
              )}
              {paged.shown.map((row) => (
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
        {/* Not while the schedules are still being read: a count of nothing, said before anybody has
            looked, reads as there being nothing. */}
        {!schedules.isPending && <PagedFooter paged={paged} noun={["schedule", "schedules"]} />}
      </div>
    </section>
  );
}
