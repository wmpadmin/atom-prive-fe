import { ApiError } from "@atomprive/api-client";
import {
  useGetPortfolioManagerDashboard,
  useListCurrencies,
  type Currency,
  type PortfolioManagerDashboard as Figures,
} from "@atomprive/api-client/backoffice";
import { Alert, SelectInput, cn } from "@atomprive/ui";
import { keepPreviousData } from "@tanstack/react-query";
import {
  Activity,
  ArrowLeftRight,
  BarChart3,
  CircleCheck,
  CircleX,
  FileText,
  Hourglass,
  Layers,
  PieChart,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { useStaffUser } from "../../auth/session";
import { menuFor } from "../../menu";
import {
  AskTheAssistant,
  Breakdown,
  CardGrid,
  Counts,
  EditCards,
  Loading,
  Panel,
  Strip,
  money,
  useDashboardCards,
  type CardMeta,
} from "../dashboard/dashboard-kit";

/**
 * A portfolio manager's dashboard: the clients assigned to them — what they hold, how far each sits from plan,
 * the models they are on, the furthest from plan, and what this manager has raised. One dashboard with Customize view
 * to move, size and hide cards, the same as every other role's.
 */

const PERIODS = [
  { days: 7, label: "Last 7 days" },
  { days: 30, label: "Last 30 days" },
  { days: 90, label: "Last 90 days" },
  { days: 365, label: "Last 12 months" },
];

type CardId = "overview" | "health" | "proposals" | "models" | "deviations" | "assistant";

const CARD: Record<CardId, CardMeta> = {
  overview: { title: "AUM & portfolio overview", area: "main" },
  health: { title: "Portfolio health", area: "main" },
  proposals: { title: "Proposals & rebalancing", area: "main" },
  models: { title: "Model portfolios", area: "main" },
  deviations: { title: "Top deviations", area: "main" },
  assistant: { title: "AI Assistant", area: "side" },
};


/** What the dashboard opens on: the four that matter most, chosen 13 Nov 2026; the rest wait in Add cards. A layout someone saved is kept. */
const DEFAULT_CARDS: CardId[] = ["overview", "health", "proposals", "deviations"];

/** Which screen each counted line is worked from. A line whose screen the reader's menu lacks has no link. */
const WORKED_FROM: Record<string, string[]> = {
  raised: ["/approvals?queue=proposals"],
  waiting: ["/approvals?queue=proposals"],
  approved: ["/approvals?queue=proposals"],
  declined: ["/approvals?queue=proposals"],
  moves: ["/trade-logs", "/approvals"],
};

const ICON_FOR: Record<string, LucideIcon> = {
  raised: FileText,
  waiting: Hourglass,
  approved: CircleCheck,
  declined: CircleX,
  moves: ArrowLeftRight,
};

const ASK = [
  "Which of my clients are furthest from their model?",
  "Summarise my portfolios against their models.",
  "Which proposals are waiting on a relationship manager?",
  "How do I raise a rebalance?",
  "How do I move a client to another model?",
];

/** A drift in points, signed, with its colour: within a point reads as fine, past two as far out. */
function driftTone(drift: number) {
  const size = Math.abs(drift);
  return size >= 2 ? "bg-red-50 text-red-700" : size >= 1 ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700";
}

function points(drift: number | null | undefined) {
  return drift == null ? "—" : `${Number(drift).toFixed(2)}%`;
}

export function PortfolioManagerDashboard() {
  const user = useStaffUser();
  const [days, setDays] = useState(30);
  const [currency, setCurrency] = useState("USD");
  const figures = useGetPortfolioManagerDashboard<Figures, ApiError>(
    { currency, days },
    { query: { placeholderData: keepPreviousData, refetchInterval: 60_000 } },
  );
  const currencies = useListCurrencies<Currency[], ApiError>();
  const view = useDashboardCards("portfolio-manager", CARD, DEFAULT_CARDS);
  // Every screen on the reader's menu, the ones drawn under a section heading included.
  const reachable = useMemo(
    () => new Set(menuFor(user).flatMap((one) => [one.to, ...(one.below ?? []).map((under) => under.to)])),
    [user],
  );
  const goTo = (...screens: string[]) => screens.find((one) => reachable.has(one.split("?")[0]!));
  const linkFor = (key: string) => goTo(...(WORKED_FROM[key] ?? []));
  const data = figures.data;
  const cur = data?.currency ?? currency;
  const clientLink = (customerId: string) => (reachable.has("/portfolio-clients") ? `/portfolio-clients/${customerId}` : undefined);

  const render: Record<CardId, ReactNode> = {
    overview: (
      <Panel icon={Layers} title="AUM & portfolio overview" to={goTo("/portfolio-clients", "/book")}>
        {data ? (
          <div className="space-y-4">
            {data.byAssetClass.length === 0 ? (
              <p className="py-6 text-center text-sm text-ink-muted">None of your clients holds anything yet.</p>
            ) : (
              <Breakdown currency={cur} centre={money(data.book.aum, cur)} centreLabel={`${cur} AUM`}
                rows={data.byAssetClass.map((one) => ({ name: one.name, value: one.amount, share: one.sharePercent }))} />
            )}
            <Strip figures={[
              { label: "Assigned clients", value: data.book.clients, to: goTo("/portfolio-clients") },
              { label: "Portfolios", value: data.book.portfolios },
              { label: `AUM vs ${days} days ago`, value: money(data.book.aum, cur), change: data.book.aumChangePercent },
            ]} />
          </div>
        ) : <Loading />}
      </Panel>
    ),
    health: (
      <Panel icon={Activity} title="Portfolio health" to={goTo("/drift")}>
        {data ? (
          <div className="space-y-4">
            <Breakdown centre={`${data.health.onPlanPercent}%`} centreLabel="On plan"
              rows={[
                { name: "On plan", value: data.health.onPlan, colour: "#16a34a" },
                { name: "Off plan", value: data.health.offPlan, colour: "#dc2626" },
                { name: "No model", value: data.health.noModel, colour: "#cbd5e1" },
              ]} />
            <Strip figures={[
              { label: "Model drift (avg.)", value: points(data.health.averageDrift) },
              { label: "Off plan", value: data.health.offPlan, danger: data.health.offPlan > 0, to: goTo("/drift") },
              { label: "Model switches", value: data.health.switchesWaiting, to: goTo("/approvals?queue=model-changes") },
            ]} />
          </div>
        ) : <Loading />}
      </Panel>
    ),
    proposals: (
      <Panel icon={FileText} title="Proposals & rebalancing" to={goTo("/approvals?queue=proposals")}>
        {data ? <Counts rows={data.proposals} linkFor={linkFor} iconFor={ICON_FOR} /> : <Loading />}
      </Panel>
    ),
    models: (
      <Panel icon={BarChart3} title="Model portfolios" to={goTo("/model-portfolios")}>
        {!data ? <Loading /> : data.models.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-muted">None of your clients is on a model yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-ink-muted">
                <th scope="col" className="py-1.5 font-medium">Model</th>
                <th scope="col" className="py-1.5 text-right font-medium">AUM</th>
                <th scope="col" className="py-1.5 text-right font-medium">Clients</th>
                <th scope="col" className="py-1.5 text-right font-medium">Drift</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.models.map((one) => (
                <tr key={one.modelId}>
                  <td className="py-2 font-medium">{one.name}</td>
                  <td className="py-2 text-right tabular-nums">{money(one.aum, cur).replace(`${cur} `, "")}</td>
                  <td className="py-2 text-right tabular-nums">{one.clients}</td>
                  <td className="py-2 text-right">
                    {one.averageDrift == null ? "—" : (
                      <span className={cn("rounded-md px-1.5 py-0.5 text-xs font-semibold tabular-nums", driftTone(one.averageDrift))}>
                        {points(one.averageDrift)}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    ),
    deviations: (
      <Panel icon={TriangleAlert} title="Top deviations" to={goTo("/drift")}>
        {!data ? <Loading /> : data.deviations.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-muted">No portfolio of yours has a drift to read.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-ink-muted">
                <th scope="col" className="py-1.5 font-medium">Client</th>
                <th scope="col" className="py-1.5 font-medium">Model</th>
                <th scope="col" className="py-1.5 text-right font-medium">Deviation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.deviations.map((one) => {
                const to = clientLink(one.customerId);
                return (
                  <tr key={one.customerId}>
                    <td className="py-2 font-medium">
                      {to ? <Link to={to} className="hover:text-primary-700 hover:underline">{one.clientName}</Link> : one.clientName}
                    </td>
                    <td className="py-2 text-ink-soft">{one.modelName ?? "—"}</td>
                    <td className="py-2 text-right">
                      <span className={cn("rounded-md px-1.5 py-0.5 text-xs font-semibold tabular-nums", driftTone(one.drift))}>
                        {points(one.drift)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Panel>
    ),
    assistant: <AskTheAssistant questions={ASK} blurb="Get insights on your portfolios, deviations, models and proposals." />,
  };

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-2xl bg-primary-50 text-primary-600">
            <PieChart className="size-6" aria-hidden="true" />
          </span>
          <div>
            <h1 className="text-[1.625rem] leading-tight font-bold">Portfolio manager dashboard</h1>
            <p className="text-sm text-ink-muted">Portfolio performance, model alignment, proposals and rebalancing.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <EditCards view={view} />
          <SelectInput id="pm-period" aria-label="Period the changes are measured over" value={String(days)}
            onChange={(event) => setDays(Number(event.target.value))} className="w-40">
            {PERIODS.map((one) => <option key={one.days} value={one.days}>{one.label}</option>)}
          </SelectInput>
          <SelectInput id="pm-currency" aria-label="Currency the figures are shown in" value={currency}
            onChange={(event) => setCurrency(event.target.value)} className="w-28">
            {(currencies.data ?? [{ code: "USD", name: "US dollar" }]).map((one) => (
              <option key={one.code} value={one.code}>{one.code}</option>
            ))}
          </SelectInput>
        </div>
      </header>

      {figures.isError && <Alert tone="danger">{figures.error.message}</Alert>}

      <CardGrid meta={CARD} view={view} render={render} screen="Portfolio Manager dashboard" />
    </div>
  );
}
