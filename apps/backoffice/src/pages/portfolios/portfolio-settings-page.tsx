import { ApiError } from "@atomprive/api-client";
import {
  getGetPortfolioSettingsQueryKey,
  useChangePortfolioSettings,
  useGetPortfolioSettings,
  useListReportSchedules,
  useRiskProfileReviewSettings,
  useChangeRiskProfileReviewSettings,
  getRiskProfileReviewSettingsQueryKey,
  type RiskReviewSettings,
  type SchedulesPage,
  type SettingsView,
} from "@atomprive/api-client/backoffice";
import { Alert, Button, Field, SelectInput, Switch, TextInput, cn, describedBy } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  ChevronRight,
  FileBarChart2,
  Clock,
  Gauge,
  Layers,
  LayoutDashboard,
  Mail,
  Monitor,
  RefreshCw,
  RotateCcw,
  Save,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sigma,
  Wallet,
  X,
} from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router";
import { useStaffUser } from "../../auth/session";
import { noErrors, toFormErrors, type FormErrors } from "../../lib/api-errors";
import { asFigure } from "../../lib/figures";
import { formatDateTime } from "../../lib/labels";
import { hasAuthority } from "../../lib/permissions";
import { useShowFirstError } from "../../lib/show-first-error";
import { AssetClassesTab } from "../config/asset-classes-tab";
import { PortfolioAccessTab } from "./portfolio-access-tab";

type SellOrder = SettingsView["sellOrder"];
type AlertTo = SettingsView["breachAlertTo"];
type AlertEvery = SettingsView["breachAlertEvery"];

const TABS = [
  { id: "general", label: "Core settings", icon: Settings2 },
  { id: "classes", label: "Asset classes", icon: Layers },
  { id: "drift", label: "Drift & rebalancing", icon: RefreshCw },
  { id: "alerts", label: "Alerts & notifications", icon: Bell },
  { id: "reporting", label: "Reporting & emails", icon: Mail },
  { id: "access", label: "Access & visibility", icon: ShieldCheck },
  { id: "advanced", label: "Advanced", icon: SlidersHorizontal },
] as const;
type TabId = (typeof TABS)[number]["id"];

/** What the platform ships with, which Reset to defaults puts back into the form — saved only on Save changes. */
const DEFAULTS = {
  classBreachAt: "10",
  subAssetBreachAt: "5",
  insideSubAssetBreachAt: "5",
  breachAlertTo: "PORTFOLIO_MANAGER" as AlertTo,
  breachAlertEvery: "DAY" as AlertEvery,
  digestEnabled: true,
  digestAt: "07:00",
  proposalAnswerDays: "14",
};

const WHO: Record<AlertTo, string> = {
  NOBODY: "Nobody",
  PORTFOLIO_MANAGER: "Portfolio manager",
  ADVISOR: "Relationship manager",
  BOTH: "Portfolio manager, RM",
};

const EVERY: Record<AlertEvery, string> = {
  DAY: "Every morning",
  WEEKDAY: "Weekday mornings",
  WEEK: "Monday mornings",
  MONTH: "First of the month",
};

const CADENCE: Record<string, string> = {
  MONTHLY_FIRST: "Monthly",
  QUARTERLY: "Quarterly",
  AFTER_EACH_REBALANCE: "After each rebalance",
};

/**
 * The rules the firm sets once and every other portfolio screen obeys, in tabs. What the platform acts on is
 * live and saved with Save changes; what it does not act on yet is shown as it behaves today, greyed, with a note
 * saying so — a switch that changed nothing would be read as broken, or worse, believed.
 */
export function PortfolioSettingsPage() {
  const queryClient = useQueryClient();
  const mayChange = hasAuthority(useStaffUser(), "SEND_PROPOSALS:CHANGE");
  const settings = useGetPortfolioSettings<SettingsView, ApiError>();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab: TabId = TABS.find((one) => one.id === searchParams.get("tab"))?.id ?? "general";

  const [edits, setEdits] = useState<Typed | null>(null);
  const page = useRef<HTMLDivElement>(null);
  const [errors, setErrors] = useState<FormErrors>(noErrors);
  useShowFirstError(errors, page);
  const [saved, setSaved] = useState(false);

  const held = settings.data;
  const typed = edits ?? asTyped(held);
  const set = (part: Partial<Typed>) => {
    setSaved(false);
    setEdits({ ...typed, ...part });
  };
  const changed = held != null
    && (Object.keys(typed) as (keyof Typed)[]).some((field) => typed[field] !== asTyped(held)[field]);
  const readable = [typed.classBreachAt, typed.subAssetBreachAt, typed.insideSubAssetBreachAt]
    .every((one) => one.trim() !== "" && Number.isFinite(Number(one)));

  const change = useChangePortfolioSettings<ApiError>({
    mutation: {
      onSuccess: () => {
        setErrors(noErrors);
        setSaved(true);
        setEdits(null);
        void queryClient.invalidateQueries({ queryKey: getGetPortfolioSettingsQueryKey() });
      },
      onError: (caught) => {
        setSaved(false);
        setErrors(toFormErrors(caught));
      },
    },
  });

  function submit() {
    change.mutate({
      data: {
        classBreachAt: Number(typed.classBreachAt),
        subAssetBreachAt: Number(typed.subAssetBreachAt),
        insideSubAssetBreachAt: Number(typed.insideSubAssetBreachAt),
        sellOrder: typed.sellOrder,
        minimumTrade: Number(typed.minimumTrade),
        breachAlertTo: typed.breachAlertTo,
        breachAlertEvery: typed.breachAlertEvery,
        digestEnabled: typed.digestEnabled,
        digestAt: `${typed.digestAt}:00`,
        proposalAnswerDays: Number(typed.proposalAnswerDays),
        // Left blank, the rate stays as it is.
        riskFreePercent: typed.riskFreePercent.trim() === "" ? null : Number(typed.riskFreePercent),
      },
    });
  }

  if (settings.isError) return <Alert tone="danger">{settings.error.message}</Alert>;

  return (
    <div ref={page} className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Portfolio settings</h1>
          <p className="mt-1 text-sm text-ink-muted">Configure portfolio rules, asset classes, alerts, reporting and access.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {held && (
            <p className="text-xs text-ink-muted">
              Last changed: {formatDateTime(held.updatedAt)}
              {held.updatedBy ? ` by ${held.updatedBy}` : ""}
            </p>
          )}
          {mayChange && (
            <>
              <Button variant="secondary" size="sm" disabled={change.isPending}
                onClick={() => set({ ...typed, ...DEFAULTS })}>
                <RotateCcw aria-hidden="true" />
                Reset to defaults
              </Button>
              <Button size="sm" disabled={!changed || !readable || change.isPending} onClick={submit}>
                <Save aria-hidden="true" />
                {change.isPending ? "Saving…" : "Save changes"}
              </Button>
            </>
          )}
        </div>
      </div>

      <div role="tablist" aria-label="Portfolio settings" className="flex gap-1 overflow-x-auto border-b border-line">
        {TABS.map((one) => {
          const Icon = one.icon;
          return (
            <button key={one.id} type="button" role="tab" aria-selected={tab === one.id}
              onClick={() => setSearchParams((was) => { const next = new URLSearchParams(was); next.set("tab", one.id); return next; }, { replace: true })}
              className={cn("-mb-px flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-semibold whitespace-nowrap",
                tab === one.id ? "border-primary-600 bg-primary-50/60 text-primary-700" : "border-transparent text-ink-muted hover:text-ink")}>
              <Icon aria-hidden="true" className="size-4" />
              {one.label}
            </button>
          );
        })}
      </div>

      {errors.form && <Alert tone="danger">{errors.form}</Alert>}
      {saved && !change.isPending && <Alert tone="success">Saved. The next morning&rsquo;s look and email use the new rules.</Alert>}
      {changed && !change.isPending && <Alert tone="info">You have changes that are not saved yet. Press Save changes to keep them.</Alert>}

      {tab === "general" && <GeneralTab />}

      {tab === "classes" && (
        <Card icon={<Layers />} title="Asset classes" lead="The asset classes, sub-assets and lines portfolios are counted in.">
          <AssetClassesTab lean />
        </Card>
      )}

      {tab === "drift" && (
        <Card icon={<Gauge />} title="Drift & rebalancing" lead="How far a portfolio may drift from its target, and what happens when it does.">
          <div className="grid gap-4 lg:grid-cols-2">
            <Box icon={<Gauge />} title="Drift thresholds" lead="Percentage points from target, at each depth. A new model starts from these.">
              {/* One under another, so the box fills the height of the rules beside it rather than leaving it empty. */}
              <div className="space-y-3">
                <Figure id="set-class" label="Asset class drift" value={typed.classBreachAt} error={errors.fields.classBreachAt}
                  disabled={!mayChange} onChange={(value) => set({ classBreachAt: asFigure(value, typed.classBreachAt) })} />
                <Figure id="set-sub-asset" label="Sub-asset drift" value={typed.subAssetBreachAt} error={errors.fields.subAssetBreachAt}
                  disabled={!mayChange} onChange={(value) => set({ subAssetBreachAt: asFigure(value, typed.subAssetBreachAt) })} />
                <Figure id="set-inside" label="Inside sub-asset drift" value={typed.insideSubAssetBreachAt}
                  error={errors.fields.insideSubAssetBreachAt} disabled={!mayChange}
                  onChange={(value) => set({ insideSubAssetBreachAt: asFigure(value, typed.insideSubAssetBreachAt) })} />
              </div>
            </Box>
            <Box icon={<RefreshCw />} title="Rebalancing rules" lead="What happens when a portfolio drifts past its limit.">
              <div className="space-y-2.5 text-sm" role="radiogroup" aria-label="When a portfolio drifts past its limit">
                <Radio checked label="Raise an alert only" />
                <Radio checked={false} disabled label="Create a rebalance recommendation" />
                <Radio checked={false} disabled label="Auto-create a rebalance transaction (requires approval)" />
              </div>
              <NotYet>Alerts are what the platform does today; a rebalance is raised by hand from Bulk rebalancing.</NotYet>
            </Box>
            <Box icon={<Clock />} title="Proposals" lead="How long a client has to approve or reject a proposal sent to them.">
              <Field id="set-answer-days" label="Days to answer" error={errors.fields.proposalAnswerDays}>
                <span className="relative block max-w-48">
                  <TextInput {...describedBy("set-answer-days", errors.fields.proposalAnswerDays)} id="set-answer-days"
                    inputMode="numeric" disabled={!mayChange} value={typed.proposalAnswerDays} className="pr-12"
                    onChange={(event) => set({ proposalAnswerDays: event.target.value.replace(/[^0-9]/g, "") })} />
                  <span aria-hidden="true" className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-ink-muted">days</span>
                </span>
              </Field>
              <p className="mt-2 text-xs text-ink-muted">An unanswered proposal expires after this, and nothing moves. Between 1 and 90.</p>
            </Box>
            <Box icon={<Clock />} title="Performance" lead="The risk-free rate every excess-over-cash figure is read against.">
              <Field id="set-risk-free" label="Risk-free rate (3-month T-bill)" error={errors.fields.riskFreePercent}>
                <span className="relative block max-w-48">
                  <TextInput {...describedBy("set-risk-free", errors.fields.riskFreePercent)} id="set-risk-free"
                    inputMode="decimal" disabled={!mayChange} value={typed.riskFreePercent} className="pr-16" placeholder="Not set"
                    onChange={(event) => set({ riskFreePercent: event.target.value.replace(/[^0-9.-]/g, "") })} />
                  <span aria-hidden="true" className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-ink-muted">% a year</span>
                </span>
              </Field>
              <p className="mt-2 text-xs text-ink-muted">Sharpe, Sortino and Jensen's alpha are read against it; while it is not set, none of them is shown.</p>
            </Box>
          </div>
        </Card>
      )}

      {tab === "alerts" && (
        <Card icon={<Bell />} title="Alerts & notifications" lead="What the platform watches for, who hears about it, and how often."
          action={<Button variant="secondary" size="sm" disabled>+ Add alert</Button>}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-canvas text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                  <th scope="col" className="rounded-l-lg px-3 py-2.5">Alert type</th>
                  <th scope="col" className="px-3 py-2.5">Trigger / condition</th>
                  <th scope="col" className="px-3 py-2.5">Recipients</th>
                  <th scope="col" className="px-3 py-2.5">Frequency</th>
                  <th scope="col" className="rounded-r-lg px-3 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                <tr>
                  <td className="px-3 py-2.5 font-semibold">Portfolio drift</td>
                  <td className="px-3 py-2.5 text-ink-soft">Drift exceeds the configured limit</td>
                  <td className="min-w-52 px-3 py-2">
                    <SelectInput id="set-alert" aria-label="Who hears about portfolio drift" value={typed.breachAlertTo} disabled={!mayChange}
                      onChange={(event) => set({ breachAlertTo: event.target.value as AlertTo })}>
                      {(Object.keys(WHO) as AlertTo[]).map((one) => <option key={one} value={one}>{WHO[one]}</option>)}
                    </SelectInput>
                  </td>
                  <td className="min-w-44 px-3 py-2">
                    <SelectInput id="set-every" aria-label="How often" value={typed.breachAlertEvery} disabled={!mayChange}
                      onChange={(event) => set({ breachAlertEvery: event.target.value as AlertEvery })}>
                      {(Object.keys(EVERY) as AlertEvery[]).map((one) => <option key={one} value={one}>{EVERY[one]}</option>)}
                    </SelectInput>
                  </td>
                  <td className="px-3 py-2.5"><Pill on={typed.breachAlertTo !== "NOBODY"} /></td>
                </tr>
                {[
                  ["Valuation exception", "Valuation not received or a price missing", "Portfolio manager", "Daily"],
                  ["Cash outside range", "Cash above or below its target range", "Portfolio manager, Operations", "Daily"],
                  ["Large transaction", "A single transaction above a set amount", "Portfolio manager, Admin", "Immediate"],
                ].map(([type, trigger, who, often]) => (
                  <tr key={type} className="text-ink-muted">
                    <td className="px-3 py-2.5 font-semibold">{type}</td>
                    <td className="px-3 py-2.5">{trigger}</td>
                    <td className="px-3 py-2.5">{who}</td>
                    <td className="px-3 py-2.5">{often}</td>
                    <td className="px-3 py-2.5"><span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold">Not built yet</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-ink-muted">
            Drift is looked for every morning at 6:30 Dubai on every client on a model, and each alert goes to the bell of the
            client&rsquo;s own managers. The other three wait for the valuation feed, cash targets and the order system.
          </p>
          <RiskReviewBox />
        </Card>
      )}

      {tab === "reporting" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <ReportsBox />
          <Card icon={<Mail />} title="Email settings" lead="The daily email of allocation alerts, and the wording of the platform's emails.">
            <div className="space-y-4">
              <div className="grid items-end gap-3 sm:grid-cols-[auto_1fr_1fr]">
                <Field id="set-digest" label="Send daily email">
                  <Switch on={typed.digestEnabled} label="Send the daily email" disabled={!mayChange}
                    onChange={(on) => set({ digestEnabled: on })} />
                </Field>
                <Field id="set-digest-at" label="At" error={errors.fields.digestAt}>
                  <TextInput id="set-digest-at" type="time" step={300} value={typed.digestAt}
                    disabled={!mayChange || !typed.digestEnabled} onChange={(event) => set({ digestAt: event.target.value })} />
                </Field>
                <Field id="set-digest-zone" label="Time zone">
                  <SelectInput id="set-digest-zone" value="Asia/Dubai" disabled onChange={() => {}}>
                    <option value="Asia/Dubai">Dubai (UTC+04:00)</option>
                  </SelectInput>
                </Field>
              </div>
              <div>
                <p className="text-xs font-semibold text-ink-soft">Email recipients</p>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {(["PORTFOLIO_MANAGER", "ADVISOR"] as const).map((role) => {
                    const on = typed.breachAlertTo === role || typed.breachAlertTo === "BOTH";
                    return (
                      <button key={role} type="button" disabled={!mayChange} aria-pressed={on}
                        onClick={() => {
                          const other = role === "PORTFOLIO_MANAGER" ? "ADVISOR" : "PORTFOLIO_MANAGER";
                          const otherOn = typed.breachAlertTo === other || typed.breachAlertTo === "BOTH";
                          set({ breachAlertTo: on ? (otherOn ? other : "NOBODY") : (otherOn ? "BOTH" : role) });
                        }}
                        className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium",
                          on ? "border-primary-200 bg-primary-50 text-primary-700" : "border-line text-ink-muted hover:text-ink")}>
                        {role === "PORTFOLIO_MANAGER" ? "Portfolio manager" : "Relationship manager"}
                        {on && <X aria-hidden="true" className="size-3.5" />}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-1.5 text-xs text-ink-muted">Each hears about their own clients only — the same people the drift alert goes to.</p>
              </div>
              <Link to="/config?tab=templates" className="inline-flex items-center gap-1 text-sm font-semibold text-primary-700 hover:underline">
                Manage email templates
                <ChevronRight aria-hidden="true" className="size-4" />
              </Link>
            </div>
          </Card>
        </div>
      )}

      {tab === "access" && (
        <Card icon={<ShieldCheck />} title="Access & visibility" lead="Control who can view and manage portfolios, settings and reports.">
          <PortfolioAccessTab />
        </Card>
      )}

      {tab === "advanced" && <AdvancedTab />}
    </div>
  );
}

/** Core settings: how portfolios are valued, shown and calculated — today's behaviour, not yet a choice. */
function GeneralTab() {
  return (
    // No heading of its own: the tab above names it, and its first section is the core settings themselves.
    <section className="rounded-2xl border border-line bg-white p-5">
      <div className="divide-y divide-line">
        <Section icon={<Settings2 />} title="Core settings" lead="Basic configuration for portfolio management.">
          <div className="grid gap-3 sm:grid-cols-3">
            <Fixed label="Default base currency" value="Each client's own" />
            <Fixed label="Valuation frequency" value="Daily" />
            <Fixed label="Price source" value="Market (default)" />
          </div>
        </Section>
        <Section icon={<Monitor />} title="Portfolio display" lead="What information is shown in the portfolio.">
          <div className="flex flex-wrap gap-x-8 gap-y-2">
            <Tick checked label="Show performance (returns)" />
            <Tick checked label="Show asset allocation" />
            <Tick checked label="Show cash balance" />
            <Tick checked={false} label="Show cost basis" />
            <Tick checked={false} label="Show unrealised gain/loss" />
          </div>
        </Section>
        <Section icon={<Sigma />} title="Calculation settings" lead="Default methods for portfolio calculations.">
          <div className="grid gap-3 sm:grid-cols-3">
            <Fixed label="Return calculation method" value="Time-weighted return (TWR)" />
            <Fixed label="Performance period (default)" value="YTD" />
            <Fixed label="Benchmark (default)" value="None" />
          </div>
        </Section>
        <Section icon={<Wallet />} title="Portfolio defaults" lead="Default behaviour for new portfolios.">
          <div className="flex flex-wrap gap-x-8 gap-y-2">
            <Tick checked label="Use model portfolios by default" />
            <Tick checked label="Include cash in total portfolio value" />
            <Tick checked={false} label="Create new portfolios as active" />
            <Tick checked={false} label="Apply standard asset classes to new portfolios" />
          </div>
        </Section>
      </div>
      <NotYet>
        Shown as the platform behaves today and not yet a choice: each client is valued in their own currency from the
        daily feed, returns are time-weighted, and a PM picks the period and benchmark on the client&rsquo;s page. These
        become settings with the custodian&rsquo;s price feed.
      </NotYet>
    </section>
  );
}

const EVERY_MONTHS = [12, 24, 36];
const REMIND_DAYS = [14, 30, 60, 90];

/** How often a client's risk profile is redone, and how far ahead their managers are told. Admin sets it. */
function RiskReviewBox() {
  const queryClient = useQueryClient();
  const mayChange = hasAuthority(useStaffUser(), "MANAGE_CONFIGURATION:CHANGE");
  const held = useRiskProfileReviewSettings<RiskReviewSettings, ApiError>();
  const [typed, setTyped] = useState<{ everyMonths: number; remindDays: number } | null>(null);
  const [saved, setSaved] = useState(false);
  const save = useChangeRiskProfileReviewSettings<ApiError>({
    mutation: {
      onSuccess: () => {
        setTyped(null);
        setSaved(true);
        void queryClient.invalidateQueries({ queryKey: getRiskProfileReviewSettingsQueryKey() });
      },
    },
  });
  if (!held.data) return null;
  const now = typed ?? { everyMonths: held.data.everyMonths, remindDays: held.data.remindDays };
  const changed = now.everyMonths !== held.data.everyMonths || now.remindDays !== held.data.remindDays;
  const years = (months: number) => (months % 12 === 0 ? `${months / 12} year${months === 12 ? "" : "s"}` : `${months} months`);
  return (
    <section className="mt-5 rounded-xl border border-line p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold">Risk profile reviews</h3>
          <p className="text-xs text-ink-muted">When a client&rsquo;s investment risk profile must be redone, and when their managers are reminded.</p>
        </div>
        {mayChange && (
          <Button size="sm" disabled={!changed || save.isPending}
            onClick={() => { setSaved(false); save.mutate({ data: now }); }}>
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field id="risk-every" label="Redo every">
          <SelectInput id="risk-every" value={String(now.everyMonths)} disabled={!mayChange}
            onChange={(event) => setTyped({ ...now, everyMonths: Number(event.target.value) })}>
            {[...new Set([...EVERY_MONTHS, held.data.everyMonths])].map((one) => <option key={one} value={one}>{years(one)}</option>)}
          </SelectInput>
        </Field>
        <Field id="risk-remind" label="Remind before">
          <SelectInput id="risk-remind" value={String(now.remindDays)} disabled={!mayChange}
            onChange={(event) => setTyped({ ...now, remindDays: Number(event.target.value) })}>
            {[...new Set([...REMIND_DAYS, held.data.remindDays])].map((one) => <option key={one} value={one}>{one} days</option>)}
          </SelectInput>
        </Field>
        <Fixed label="Who is reminded" value="Client's RM and PM (bell + email)" />
      </div>
      <p className="mt-2 text-xs text-ink-muted">
        Counted from the day the newest questionnaire was finished; reminded once ahead and once on the day, at 7:15 Dubai.
        {!mayChange && " Admin sets this."}
        {saved && !changed && " Saved."}
      </p>
    </section>
  );
}

/** The reports the firm sends on a schedule, as set up on the Reports screen. */
function ReportsBox() {
  const schedules = useListReportSchedules<SchedulesPage, ApiError>({ query: { retry: false } });
  const kinds = [
    ["ALLOCATION_VS_PLAN", "Allocation vs plan"],
    ["HOLDINGS", "Holdings"],
    ["DRIFT_HISTORY", "Drift history"],
    ["MODEL_PERFORMANCE", "Model performance"],
  ] as const;
  const items = schedules.data?.items ?? [];
  return (
    <Card icon={<FileBarChart2 />} title="Reports" lead="Standard reports and how often they go out.">
      <ul className="divide-y divide-line">
        {kinds.map(([kind, label]) => {
          const theirs = items.filter((one) => one.kind === kind && one.active);
          return (
            <li key={kind} className="flex items-center gap-3 py-2.5 text-sm">
              <input type="checkbox" checked={theirs.length > 0} disabled readOnly className="size-4 accent-primary-600" aria-label={`${label} is scheduled`} />
              <span className="flex-1 font-medium">{label}</span>
              <span className="min-w-36 rounded-lg border border-line bg-canvas px-3 py-1.5 text-ink-muted">
                {theirs.length === 0 ? "Not scheduled" : [...new Set(theirs.map((one) => CADENCE[one.cadence] ?? one.cadence))].join(", ")}
              </span>
            </li>
          );
        })}
      </ul>
      <Link to="/reports" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary-700 hover:underline">
        Manage report schedules
        <ChevronRight aria-hidden="true" className="size-4" />
      </Link>
    </Card>
  );
}

/** Advanced: the rules that are fixed today, shown as they stand. */
function AdvancedTab() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        <Box icon={<LayoutDashboard />} title="Model portfolios">
          <Toggles rows={[["Use model portfolios", true], ["Allow custom allocation per client", true], ["Require approval for model changes", true]]} />
        </Box>
        <Box icon={<Wallet />} title="Cash & liquidity">
          <Toggles rows={[["Allow cash outside target range", false], ["Include pending transactions in allocation", false], ["Exclude illiquid assets from drift calculation", false]]} />
        </Box>
        <Box icon={<Sigma />} title="Data & calculations">
          <Toggles rows={[["Use adjusted prices (corporate actions)", false], ["Include fees in performance calculation", false], ["Handle missing prices as zero", false]]} />
        </Box>
        <Box icon={<SlidersHorizontal />} title="Other settings">
          <div className="space-y-2 text-sm">
            {[["Auto-archive inactive portfolios", "Never"], ["Default risk profile", "Set per client"], ["Performance rounding", "2 decimal places"]].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-3">
                <span className="text-ink-soft">{label}</span>
                <span className="rounded-lg border border-line bg-canvas px-2.5 py-1 whitespace-nowrap text-ink-muted">{value}</span>
              </div>
            ))}
          </div>
        </Box>
      </div>
      <NotYet>
        Shown as the platform behaves today and not yet a choice. Model changes already wait for approval, and a client may be put on their
        own allocation; the rest arrive with the custodian&rsquo;s feed and the order system.
      </NotYet>
    </div>
  );
}

// ---------------------------------------------------------------- parts

function Card({ icon, title, lead, action, children }: { icon: ReactNode; title: string; lead: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-white p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-full bg-primary-50 text-primary-700 [&_svg]:size-5">{icon}</span>
          <div>
            <h2 className="text-base font-bold">{title}</h2>
            <p className="text-xs text-ink-muted">{lead}</p>
          </div>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Box({ icon, title, lead, children }: { icon: ReactNode; title: string; lead?: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-line p-4">
      <div className="mb-3 flex items-start gap-2.5">
        <span aria-hidden="true" className="text-primary-700 [&_svg]:size-5">{icon}</span>
        <div>
          <h3 className="text-sm font-bold">{title}</h3>
          {lead && <p className="text-xs text-ink-muted">{lead}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function Section({ icon, title, lead, children }: { icon: ReactNode; title: string; lead: string; children: ReactNode }) {
  return (
    <div className="flex gap-4 py-4 first:pt-0">
      <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary-50 text-primary-700 [&_svg]:size-4">{icon}</span>
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-bold">{title}</h3>
        <p className="mb-3 text-xs text-ink-muted">{lead}</p>
        {children}
      </div>
    </div>
  );
}

function Figure({ id, label, value, error, disabled, onChange }: {
  id: string; label: string; value: string; error?: string; disabled: boolean; onChange: (value: string) => void;
}) {
  return (
    <Field id={id} label={label} error={error}>
      <span className="relative block">
        <TextInput {...describedBy(id, error)} id={id} inputMode="decimal" disabled={disabled} value={value} className="pr-8"
          onChange={(event) => onChange(event.target.value)} />
        <span aria-hidden="true" className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-ink-muted">%</span>
      </span>
    </Field>
  );
}

function Fixed({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold text-ink-soft">{label}</p>
      <p className="mt-1.5 rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink-muted">{value}</p>
    </div>
  );
}

function Tick({ checked, label }: { checked: boolean; label: string }) {
  return (
    <label className="inline-flex items-center gap-2 text-sm text-ink-muted">
      <input type="checkbox" checked={checked} disabled readOnly className="size-4 accent-primary-600" />
      {label}
    </label>
  );
}

function Radio({ checked, disabled = false, label }: { checked: boolean; disabled?: boolean; label: string }) {
  return (
    <label className={cn("flex items-center gap-2", disabled && "text-ink-muted")}>
      <input type="radio" checked={checked} disabled={disabled} readOnly className="size-4 accent-primary-600" />
      {label}
    </label>
  );
}

function Toggles({ rows }: { rows: [string, boolean][] }) {
  return (
    <div className="space-y-2.5">
      {rows.map(([label, on]) => (
        <div key={label} className="flex items-center gap-3 text-sm">
          <Switch on={on} label={label} disabled onChange={() => {}} />
          <span className="text-ink-soft">{label}</span>
        </div>
      ))}
    </div>
  );
}

function Pill({ on }: { on: boolean }) {
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", on ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-ink-muted")}>
      {on ? "Active" : "Off"}
    </span>
  );
}

function NotYet({ children }: { children: ReactNode }) {
  return (
    <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-900">
      <span className="font-semibold">Not connected yet. </span>
      {children}
    </p>
  );
}

/** The rules as they are typed, which is as text until they are saved as figures. */
interface Typed {
  classBreachAt: string;
  subAssetBreachAt: string;
  insideSubAssetBreachAt: string;
  sellOrder: SellOrder;
  minimumTrade: string;
  breachAlertTo: AlertTo;
  breachAlertEvery: AlertEvery;
  digestEnabled: boolean;
  /** HH:mm, as the time box reads and writes it. */
  digestAt: string;
  /** Whole days, as typed. */
  proposalAnswerDays: string;
  /** The firm's risk-free rate, percent a year, as typed; blank where none is set. */
  riskFreePercent: string;
}

/** What the firm has settled, as boxes. Blank until it has been read, rather than a guess at the defaults. */
function asTyped(held: SettingsView | undefined): Typed {
  return {
    classBreachAt: held ? String(held.classBreachAt) : "",
    subAssetBreachAt: held ? String(held.subAssetBreachAt) : "",
    insideSubAssetBreachAt: held ? String(held.insideSubAssetBreachAt) : "",
    sellOrder: held?.sellOrder ?? "ASK",
    minimumTrade: held ? String(held.minimumTrade) : "",
    breachAlertTo: held?.breachAlertTo ?? "PORTFOLIO_MANAGER",
    breachAlertEvery: held?.breachAlertEvery ?? "DAY",
    digestEnabled: held?.digestEnabled ?? true,
    digestAt: held?.digestAt?.slice(0, 5) ?? "07:00",
    proposalAnswerDays: held ? String(held.proposalAnswerDays) : "14",
    riskFreePercent: held?.riskFreePercent == null ? "" : String(held.riskFreePercent),
  };
}
