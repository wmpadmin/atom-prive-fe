import { ApiError } from "@atomprive/api-client";
import { usePortfolio, type PortalPortfolio } from "@atomprive/api-client/portal";
import { SelectInput } from "@atomprive/ui";
import { ArrowDownLeft, ArrowUpRight, Landmark, PiggyBank, TrendingUp, Wallet, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useSearchParams } from "react-router";
import { when } from "../lib/dates";
import { Card } from "./card";
import { AllocationRing, LineChart, ValueChart, type Series } from "./dashboard-charts";
import { INK, percent, whole } from "./figures";

/**
 * The client's portfolio: what the firm manages, how it has done over a period they pick, against their model's
 * benchmark, how it is spread, and the money that has moved in and out. The period and the tab are in the
 * address, so a reload or a shared link opens the same view.
 */

const PERIODS = [
  { id: "1M", label: "1 month" },
  { id: "3M", label: "3 months" },
  { id: "YTD", label: "Year to date" },
  { id: "1Y", label: "1 year" },
  { id: "ALL", label: "Since start" },
];

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "performance", label: "Performance" },
  { id: "benchmarks", label: "Benchmarks" },
  { id: "transactions", label: "Transactions" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const PORTFOLIO_INK = "var(--color-primary-600)";
const BENCHMARK_INK = "#8b5cf6";

function short(period: string) {
  return period === "ALL" ? "since start" : period;
}

function Signed({ value, className = "" }: { value: number | null | undefined; className?: string }) {
  if (value === null || value === undefined) {
    return <span className={`text-ink-muted ${className}`}>—</span>;
  }
  return (
    <span className={`tabular-nums ${value >= 0 ? "text-access-full-ink" : "text-access-none-ink"} ${className}`}>
      {percent(value)}
    </span>
  );
}

function Tile({ icon: Icon, label, children, note }: { icon: LucideIcon; label: string; children: ReactNode; note?: ReactNode }) {
  return (
    <div className="flex min-w-0 items-center gap-3 p-5">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
        <Icon aria-hidden="true" className="size-5" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium text-ink-muted">{label}</p>
        <div className="mt-0.5 truncate text-xl font-bold text-ink tabular-nums">{children}</div>
        {note && <div className="text-xs font-semibold">{note}</div>}
      </div>
    </div>
  );
}

function Figures({ data }: { data: PortalPortfolio }) {
  const gain = data.unrealisedGain;
  return (
    <div className="grid divide-line rounded-2xl border border-line bg-white sm:grid-cols-2 sm:divide-x xl:grid-cols-4">
      <Tile
        icon={Landmark}
        label="Portfolio value"
        note={data.periodReturn !== null && <><Signed value={data.periodReturn} /> <span className="font-medium text-ink-muted">({short(data.period)})</span></>}
      >
        {whole(data.value, data.currency)}
      </Tile>
      <Tile icon={PiggyBank} label="Invested amount" note={data.invested === null && <span className="font-medium text-ink-muted">Not recorded yet</span>}>
        {data.invested === null ? "—" : whole(data.invested, data.currency)}
      </Tile>
      <Tile icon={Wallet} label="Unrealised gain">
        {gain === null ? "—" : <span className={gain >= 0 ? "text-access-full-ink" : "text-access-none-ink"}>{whole(gain, data.currency)}</span>}
      </Tile>
      <Tile icon={TrendingUp} label={`Total return (${short(data.period)})`}>
        <Signed value={data.periodReturn} />
      </Tile>
    </div>
  );
}

function Legend({ items }: { items: { name: string; colour: string }[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-soft">
      {items.map((one) => (
        <li key={one.name} className="flex items-center gap-1.5">
          <span aria-hidden="true" className="h-0.5 w-4 rounded-full" style={{ background: one.colour }} />
          {one.name}
        </li>
      ))}
    </ul>
  );
}

/** The portfolio's return through the period, and the benchmark's beside it where the model has one. */
function ReturnChart({ data }: { data: PortalPortfolio }) {
  const series: Series[] = [{ name: "Your portfolio", colour: PORTFOLIO_INK, points: data.performance }];
  if (data.benchmark && data.benchmark.line.length > 0) {
    series.push({ name: data.benchmark.name, colour: BENCHMARK_INK, points: data.benchmark.line });
  }
  return (
    <Card title="Performance" action={<Legend items={series.map((one) => ({ name: one.name, colour: one.colour }))} />}>
      <LineChart
        series={series}
        format={(value) => percent(value)}
        tick={(value) => `${value.toFixed(value % 1 === 0 ? 0 : 1)}%`}
        label={`Return over ${short(data.period)}`}
        empty="Your portfolio's return appears here once it has been valued in this period."
      />
      {!data.benchmark && (
        <p className="mt-2 text-xs text-ink-muted">Your model portfolio has no benchmark set, so only your own return is shown.</p>
      )}
    </Card>
  );
}

function TopHoldings({ data }: { data: PortalPortfolio }) {
  return (
    <Card title="Top holdings">
      {data.topHoldings.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink-muted">No holdings recorded yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-left text-sm">
            <thead>
              <tr className="text-xs text-ink-muted">
                <th scope="col" className="pb-2 font-semibold">Holding</th>
                <th scope="col" className="pb-2 font-semibold">Asset class</th>
                <th scope="col" className="pb-2 text-right font-semibold">Value ({data.currency})</th>
                <th scope="col" className="pb-2 text-right font-semibold">Weight</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.topHoldings.map((one) => (
                <tr key={`${one.name}-${one.value}`}>
                  <td className="py-2.5 pr-3 font-semibold text-ink">{one.name}</td>
                  <td className="py-2.5 pr-3 text-ink-soft">{one.assetClass}</td>
                  <td className="py-2.5 text-right text-ink tabular-nums">{new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 }).format(one.value)}</td>
                  <td className="py-2.5 text-right text-ink-soft tabular-nums">{one.share.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function Overview({ data }: { data: PortalPortfolio }) {
  return (
    <div className="space-y-5">
      <Figures data={data} />
      <ReturnChart data={data} />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Card title="Asset allocation">
          <AllocationRing slices={data.allocation} currency={data.currency} />
        </Card>
        <TopHoldings data={data} />
      </div>
    </div>
  );
}

function Performance({ data }: { data: PortalPortfolio }) {
  const changes = data.changeByAssetClass;
  return (
    <div className="space-y-5">
      <Card title="Portfolio value" action={<span className="text-xs font-medium text-ink-muted">{data.currency}</span>}>
        <ValueChart points={data.valueLine} currency={data.currency} empty="Your portfolio's value appears here once it has been valued in this period." />
      </Card>
      <Card title="Change by asset class">
        {changes.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-muted">Nothing to compare in this period yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {changes.map((one, index) => (
              <li key={one.assetClass} className="flex items-center gap-3 py-2.5 text-sm first:pt-0 last:pb-0">
                <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ background: INK[index % INK.length] }} />
                <span className="min-w-0 flex-1 truncate font-semibold text-ink">{one.name}</span>
                <span className="text-ink-soft tabular-nums">{whole(one.change, data.currency)}</span>
                <Signed value={one.percent} className="w-20 text-right font-semibold" />
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-ink-muted">Includes money added to or taken from each class during the period.</p>
      </Card>
    </div>
  );
}

function Benchmarks({ data }: { data: PortalPortfolio }) {
  const benchmark = data.benchmark;
  if (!benchmark) {
    return (
      <Card title="Benchmarks">
        <p className="py-6 text-center text-sm text-ink-muted">
          Your model portfolio has no benchmark set yet. Your relationship manager can tell you which index it is measured against.
        </p>
      </Card>
    );
  }
  const difference = data.periodReturn !== null && benchmark.periodReturn !== null ? data.periodReturn - benchmark.periodReturn : null;
  return (
    <div className="space-y-5">
      <div className="grid divide-line rounded-2xl border border-line bg-white sm:grid-cols-3 sm:divide-x">
        <Tile icon={TrendingUp} label={`Your portfolio (${short(data.period)})`}>
          <Signed value={data.periodReturn} />
        </Tile>
        <Tile icon={Landmark} label={`${benchmark.name} (${short(data.period)})`}>
          <Signed value={benchmark.periodReturn} />
        </Tile>
        <Tile icon={ArrowUpRight} label="Difference">
          {difference === null ? "—" : <Signed value={difference} />}
        </Tile>
      </div>
      <ReturnChart data={data} />
      {benchmark.description && (
        <Card title={`About ${benchmark.name}`}>
          <p className="text-sm text-ink-soft">{benchmark.description}</p>
        </Card>
      )}
    </div>
  );
}

function Transactions({ data }: { data: PortalPortfolio }) {
  return (
    <Card title="Money in and out">
      {data.movements.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink-muted">No money has been added to or taken from your portfolio yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-left text-sm">
            <thead>
              <tr className="text-xs text-ink-muted">
                <th scope="col" className="pb-2 font-semibold">Date</th>
                <th scope="col" className="pb-2 font-semibold">Type</th>
                <th scope="col" className="pb-2 text-right font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.movements.map((one, index) => {
                const added = one.direction === "IN";
                const Icon = added ? ArrowDownLeft : ArrowUpRight;
                return (
                  <tr key={`${one.on}-${index}`}>
                    <td className="py-2.5 pr-3 whitespace-nowrap text-ink-soft">{when(one.on)}</td>
                    <td className="py-2.5 pr-3">
                      <span className="flex items-center gap-2 font-semibold text-ink">
                        <Icon aria-hidden="true" className={`size-4 ${added ? "text-access-full-ink" : "text-access-none-ink"}`} />
                        {added ? "Money added" : "Money withdrawn"}
                      </span>
                    </td>
                    <td className={`py-2.5 text-right font-semibold tabular-nums ${added ? "text-access-full-ink" : "text-ink"}`}>
                      {added ? "+" : "−"}
                      {whole(Math.abs(one.amount), one.currency)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

export function PortfolioPage() {
  const [params, setParams] = useSearchParams();
  const period = PERIODS.some((one) => one.id === params.get("period")) ? params.get("period")! : "YTD";
  const tab: TabId = TABS.some((one) => one.id === params.get("tab")) ? (params.get("tab") as TabId) : "overview";
  const portfolio = usePortfolio<PortalPortfolio, ApiError>({ period });

  const change = (key: string, value: string) =>
    setParams(
      (was) => {
        const next = new URLSearchParams(was);
        next.set(key, value);
        return next;
      },
      { replace: true },
    );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-balance text-ink">Portfolio</h1>
          <p className="mt-1 text-sm text-ink-muted">View performance, returns and portfolio allocation.</p>
        </div>
        <label className="flex items-center gap-2 text-sm text-ink-muted">
          Period
          <SelectInput id="period" value={period} onChange={(event) => change("period", event.target.value)} className="w-44">
            {PERIODS.map((one) => (
              <option key={one.id} value={one.id}>
                {one.label}
              </option>
            ))}
          </SelectInput>
        </label>
      </div>

      <div role="tablist" aria-label="Portfolio" className="flex gap-6 overflow-x-auto border-b border-line">
        {TABS.map((one) => (
          <button
            key={one.id}
            type="button"
            role="tab"
            aria-selected={tab === one.id}
            onClick={() => change("tab", one.id)}
            className={`-mb-px border-b-2 pb-2.5 text-sm font-semibold whitespace-nowrap ${
              tab === one.id ? "border-primary-600 text-primary-700" : "border-transparent text-ink-muted hover:text-ink"
            }`}
          >
            {one.label}
          </button>
        ))}
      </div>

      {portfolio.isError ? (
        <p className="rounded-2xl border border-line bg-white p-6 text-sm text-access-none-ink">
          Your portfolio could not be loaded. Refresh the page to try again.
        </p>
      ) : !portfolio.data ? (
        <div className="h-96 animate-pulse rounded-2xl bg-white/60" />
      ) : (
        <>
          {tab === "overview" && <Overview data={portfolio.data} />}
          {tab === "performance" && <Performance data={portfolio.data} />}
          {tab === "benchmarks" && <Benchmarks data={portfolio.data} />}
          {tab === "transactions" && <Transactions data={portfolio.data} />}
        </>
      )}
    </div>
  );
}
