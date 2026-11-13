import { ApiError } from "@atomprive/api-client";
import {
  useGetClientEquity,
  useGetClientHoldingsBook,
  useGetClientIps,
  useGetClientPerformance,
  useGetClientStructure,
  useGetClientWorkspace,
  useGetClientWorkspaceCollectibles,
  useGetClientWorkspaceFixedIncome,
  useGetClientWorkspacePrivateMarkets,
  type ClientCollectibles,
  type ClientEquity,
  type CoItem,
  type CoYear,
  type ClientFixedIncome,
  type ClientPrivateMarkets,
  type PmFund,
  type FiHolding,
  type ClientHoldingsBook,
  type ClientIps,
  type IpsDeviationSeries,
  type EquityHolding,
  type ClientPerformance,
  type AttributionRow,
  type PerformanceMonth,
  type ClientStructure,
  type StructureNode,
  type ClientWorkspace,
  type HoldingsPosition,
} from "@atomprive/api-client/backoffice";
import { Button, cn } from "@atomprive/ui";
import { ArrowLeft, Download, Maximize2, Minimize2, X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router";
import { formatDate } from "../../lib/labels";
import { Chart, ink } from "../book/overview-charts";

/**
 * What a click on a PPM screen opens: one slice of the client's holdings — an asset class, a sub-class, a currency,
 * a custodian, an entity or one position — broken down in a panel on the right, with the screen left behind it.
 * Every figure is the holdings book's or the performance screen's own; the panel only filters and adds them up.
 */
export type DrillBy = "class" | "subClass" | "entity" | "currency" | "custodian" | "account" | "liquidity" | "position" | "sector" | "company" | "maturity" | "rating" | "bond" | "strategy" | "vintage" | "fund" | "category" | "location" | "item" | "rule" | "legalEntity" | "beneficiary" | "month" | "flowType" | "period" | "effect";
export type DrillTarget = { by: DrillBy; key: string; name: string };

const Opener = createContext<((target: DrillTarget) => void) | null>(null);

/** Opens the breakdown panel; nothing outside a client's workspace. */
export function useDrill() {
  return useContext(Opener);
}

const BY_LABEL: Record<DrillBy, string> = {
  class: "Asset class",
  subClass: "Sub-class",
  entity: "Entity",
  currency: "Currency",
  custodian: "Custodian",
  account: "Account",
  liquidity: "Time to cash",
  sector: "Sector · equity",
  company: "Company",
  maturity: "Maturity · fixed income",
  rating: "Credit quality",
  bond: "Bond",
  strategy: "Strategy · private markets",
  vintage: "Vintage · private markets",
  fund: "Fund",
  category: "Collectibles",
  location: "Location",
  item: "Item",
  rule: "IPS rule",
  legalEntity: "Entity",
  beneficiary: "Beneficiary",
  month: "Projected cash flows · month",
  flowType: "Projected cash flows",
  period: "Performance · period",
  effect: "Performance · attribution",
  position: "Position",
};

/** The screen of the workspace that goes deeper into an asset class. */
const CLASS_SCREEN: Record<string, [path: string, name: string]> = {
  EQUITIES: ["equity", "Equity Analytics"],
  FIXED_INCOME: ["fixed-income", "Fixed Income Analytics"],
  ALTERNATIVES: ["private-markets", "Private Markets"],
};

const WIDTH_KEY = "atomprive.drill-width.v1";
const NARROWEST = 420;
const STARTING = 760;

function widest() {
  return typeof window === "undefined" ? 1200 : Math.max(NARROWEST, window.innerWidth - 96);
}

function fit(width: number) {
  return Math.round(Math.min(widest(), Math.max(NARROWEST, width)));
}

/** Gives the screens inside one client's workspace the panel; it opens over whichever screen is showing. */
export function DrillHost({ customerId, children }: { customerId: string; children: ReactNode }) {
  const [trail, setTrail] = useState<DrillTarget[]>([]);
  const open = useCallback((target: DrillTarget) => setTrail([target]), []);
  const deeper = useCallback((target: DrillTarget) => setTrail((now) => [...now, target]), []);
  const close = useCallback(() => setTrail([]), []);
  const back = useCallback(() => setTrail((now) => now.slice(0, -1)), []);

  // A new client starts with the panel shut.
  useEffect(() => close(), [customerId, close]);

  return (
    <Opener.Provider value={open}>
      {children}
      {trail.length > 0 && (
        <DrillPanel customerId={customerId} target={trail[trail.length - 1]!} trail={trail}
          onDeeper={deeper} onBack={back} onClose={close} />
      )}
    </Opener.Provider>
  );
}

function DrillPanel({ customerId, target, trail, onDeeper, onBack, onClose }: {
  customerId: string;
  target: DrillTarget;
  trail: DrillTarget[];
  onDeeper: (target: DrillTarget) => void;
  onBack: () => void;
  onClose: () => void;
}) {
  const [width, setWidth] = useState(() => {
    try {
      const kept = Number(window.localStorage.getItem(WIDTH_KEY));
      return fit(kept > 0 ? kept : STARTING);
    } catch {
      return fit(STARTING);
    }
  });
  const keep = (next: number) => {
    const fitted = fit(next);
    setWidth(fitted);
    try {
      window.localStorage.setItem(WIDTH_KEY, String(fitted));
    } catch {
      // A browser that keeps nothing still resizes; the width lasts until the page is left.
    }
  };
  const dragging = useRef(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const onResize = () => setWidth((now) => fit(now));
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
    };
  }, [onClose]);

  const full = width >= widest() - 4;
  const parent = trail.length > 1 ? trail[trail.length - 2] : null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} aria-hidden="true" />
      <section role="dialog" aria-modal="true" aria-label={`${target.name} breakdown`}
        className="absolute inset-y-0 right-0 flex max-w-full flex-col bg-white shadow-2xl"
        style={{ width }}>
        {/* Dragged to make the panel wider or narrower; the width is kept for the next time it opens. */}
        <div role="separator" aria-orientation="vertical" aria-label="Resize the panel" tabIndex={0}
          aria-valuemin={NARROWEST} aria-valuemax={widest()} aria-valuenow={width}
          title="Drag to resize · double-click to fill the screen"
          className="group absolute inset-y-0 -left-1.5 z-10 flex w-3 cursor-col-resize items-center justify-center focus-visible:outline-none"
          onPointerDown={(event) => {
            dragging.current = true;
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (dragging.current) setWidth(fit(window.innerWidth - event.clientX));
          }}
          onPointerUp={(event) => {
            dragging.current = false;
            event.currentTarget.releasePointerCapture(event.pointerId);
            keep(window.innerWidth - event.clientX);
          }}
          onDoubleClick={() => keep(full ? STARTING : widest())}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft") keep(width + 40);
            if (event.key === "ArrowRight") keep(width - 40);
          }}>
          <span className="h-12 w-1 rounded-full bg-slate-300 transition group-hover:bg-primary-500 group-focus-visible:bg-primary-500" />
        </div>

        <header className="flex items-start justify-between gap-3 border-b border-line px-6 pt-5 pb-4">
          <div className="min-w-0">
            {parent ? (
              <button type="button" onClick={onBack} className="inline-flex items-center gap-1 text-2xs font-semibold tracking-wider text-primary-700 uppercase hover:underline">
                <ArrowLeft className="size-3" aria-hidden="true" /> {parent.name}
              </button>
            ) : (
              <p className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">{BY_LABEL[target.by]}</p>
            )}
            <h2 className="mt-1 truncate text-xl font-bold">{target.name}</h2>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button type="button" onClick={() => keep(full ? STARTING : widest())}
              className="rounded-md p-1.5 text-ink-muted hover:bg-canvas hover:text-ink"
              aria-label={full ? "Make the panel narrower" : "Fill the screen"} title={full ? "Make narrower" : "Fill the screen"}>
              {full ? <Minimize2 className="size-4" aria-hidden="true" /> : <Maximize2 className="size-4" aria-hidden="true" />}
            </button>
            <button type="button" onClick={onClose} className="rounded-md p-1.5 text-ink-muted hover:bg-canvas hover:text-ink" aria-label="Close">
              <X className="size-5" aria-hidden="true" />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {target.by === "sector" || target.by === "company"
            ? <EquityBody customerId={customerId} target={target} wide={width >= 900} onDeeper={onDeeper} />
            : target.by === "maturity" || target.by === "rating" || target.by === "bond"
            ? <BondBody customerId={customerId} target={target} wide={width >= 900} onDeeper={onDeeper} />
            : target.by === "strategy" || target.by === "vintage" || target.by === "fund"
            ? <FundBody customerId={customerId} target={target} wide={width >= 900} onDeeper={onDeeper} />
            : target.by === "category" || target.by === "location" || target.by === "item"
            ? <CollectibleBody customerId={customerId} target={target} wide={width >= 900} onDeeper={onDeeper} />
            : target.by === "rule"
            ? <RuleBody customerId={customerId} target={target} wide={width >= 900} />
            : target.by === "month" || target.by === "flowType"
            ? <FlowBody customerId={customerId} target={target} wide={width >= 900} onDeeper={onDeeper} />
            : target.by === "period"
            ? <PeriodBody customerId={customerId} target={target} wide={width >= 900} onDeeper={onDeeper} />
            : target.by === "effect"
            ? <EffectBody customerId={customerId} target={target} wide={width >= 900} onDeeper={onDeeper} />
            : target.by === "legalEntity" || target.by === "beneficiary"
            ? <EntityBody customerId={customerId} target={target} wide={width >= 900} onDeeper={onDeeper} />
            : <DrillBody customerId={customerId} trail={trail} wide={width >= 900} onDeeper={onDeeper} onClose={onClose} />}
        </div>
      </section>
    </div>
  );
}

function matches(target: DrillTarget, one: HoldingsPosition) {
  switch (target.by) {
    case "class": return one.assetClass === target.key;
    case "subClass": return (one.subClass ?? "") === target.key;
    case "entity": return (one.entity ?? "") === target.key;
    case "currency": return (one.currency ?? "") === target.key;
    case "custodian": return (one.custodian ?? "") === target.key;
    case "account": return (one.account ?? "") === target.key;
    case "liquidity": return rung(one.liquidity ?? "") === rung(target.key);
    // Read from the equity screen's own figures instead: the holdings book does not carry a sector or a company.
    case "sector":
    case "company":
    case "maturity":
    case "rating":
    case "bond":
    case "strategy":
    case "vintage":
    case "fund":
    case "category":
    case "location":
    case "item":
    case "rule":
    case "legalEntity":
    case "beneficiary":
    case "month":
    case "flowType":
    case "period":
    case "effect": return false;
    case "position": return one.id === target.key || one.name === target.key;
  }
}

/** A liquidity rung, read alike whether a screen writes "4–30 days" or "4 – 30 days". */
function rung(name: string) {
  return name.replace(/\s+/g, "").replace(/[–—]/g, "-");
}

type Group = { key: string; name: string; value: number; ytd: number | null };

/** What the holdings book can be broken down by. */
type BookField = "class" | "subClass" | "entity" | "currency" | "custodian" | "account" | "liquidity";

/** The steps that narrow the holdings book: its own fields, and a single line of it. */
const BOOK_FIELDS = new Set<DrillBy>(["class", "subClass", "entity", "currency", "custodian", "account", "liquidity", "position"]);

/** Adds the positions up by one of their fields, largest first; YTD is weighted by value where every line has one. */
function groupBy(positions: HoldingsPosition[], by: BookField): Group[] {
  const groups = new Map<string, { name: string; value: number; weighted: number; known: number }>();
  for (const one of positions) {
    const key = by === "class" ? one.assetClass : (by === "subClass" ? one.subClass : one[by]) ?? "";
    const name = by === "class" ? one.assetClassName : key || "Not stated";
    const group = groups.get(key) ?? { name, value: 0, weighted: 0, known: 0 };
    group.value += one.value;
    if (one.yearToDate != null) {
      group.weighted += one.yearToDate * one.value;
      group.known += one.value;
    }
    groups.set(key, group);
  }
  return [...groups.entries()]
    .map(([key, one]) => ({ key, name: one.name, value: one.value, ytd: one.known > 0 && one.known === one.value ? one.weighted / one.known : null }))
    .sort((a, b) => b.value - a.value);
}

/** Each step of the trail narrows the one before it: Equities, then USD, is the equities held in dollars. */
function DrillBody({ customerId, trail, wide, onDeeper, onClose }: {
  customerId: string;
  trail: DrillTarget[];
  wide: boolean;
  onDeeper: (target: DrillTarget) => void;
  onClose: () => void;
}) {
  const target = trail[trail.length - 1]!;
  const onHoldings = useLocation().pathname.endsWith("/holdings");
  const book = useGetClientHoldingsBook<ClientHoldingsBook, ApiError>(customerId);
  const workspace = useGetClientWorkspace<ClientWorkspace, ApiError>(customerId);
  const performance = useGetClientPerformance<ClientPerformance, ApiError>(customerId, { query: { enabled: target.by === "class" && trail.length === 1 } });
  const ips = useGetClientIps<ClientIps, ApiError>(customerId, { query: { enabled: target.by === "class" && trail.length === 1 } });

  if (book.isError) return <p className="text-sm text-red-600">{book.error.message}</p>;
  if (!book.data) return <p className="py-16 text-center text-sm text-ink-muted">Opening the breakdown…</p>;

  const currency = book.data.currency;
  // Only the steps that name a field of the holdings book narrow it; a step read from another screen (an entity of the
  // structure, a sector of the equity sleeve) is how the panel got here, not a filter on the lines.
  const narrowing = trail.filter((step) => BOOK_FIELDS.has(step.by));
  const positions = book.data.positions.filter((one) => narrowing.every((step) => matches(step, one))).sort((a, b) => b.value - a.value);
  if (book.data.bankFile || positions.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-ink-muted">
        {book.data.bankFile ? "This client's holdings come from the bank's file, which is shown on the Consolidated Holdings screen as it was sent." : "No holdings in this slice."}
      </p>
    );
  }

  const value = positions.reduce((sum, one) => sum + one.value, 0);
  const cost = positions.every((one) => one.cost != null) ? positions.reduce((sum, one) => sum + (one.cost ?? 0), 0) : null;
  const investable = book.data.kpis.marketValue;
  const netWorth = workspace.data?.headline.netWorth ?? null;
  const ytd = positions.every((one) => one.yearToDate != null) && value > 0
    ? positions.reduce((sum, one) => sum + (one.yearToDate ?? 0) * one.value, 0) / value : null;
  const band = target.by === "class" && narrowing.length === 1 ? workspace.data?.bands.find((one) => one.assetClass === target.key) : undefined;
  const classRow = target.by === "class" && narrowing.length === 1 ? performance.data?.byClass.find((one) => one.key === target.key) : undefined;
  const screen = target.by === "class" ? CLASS_SCREEN[target.key] : undefined;
  const accounts = new Set(positions.map((one) => one.account ?? "")).size;
  const dimensions = (["subClass", "entity", "currency", "custodian", "account", "liquidity", "class"] as const).filter((one) => narrowing.every((step) => step.by !== one)
    && new Set(positions.map((line) => (one === "class" ? line.assetClass : line[one]) ?? "")).size > 1);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {screen && (
          <Link to={`/client-workspace/${customerId}/${screen[0]}`} onClick={onClose}
            className="inline-flex h-8 items-center rounded-lg bg-primary-600 px-3 text-xs font-semibold text-on-accent shadow-xs hover:bg-primary-700">
            Open {screen[1]} →
          </Link>
        )}
        {!onHoldings && (
          <Link to={`/client-workspace/${customerId}/holdings`} onClick={onClose}
            className="inline-flex h-8 items-center rounded-lg border border-line bg-white px-3 text-xs font-semibold text-ink shadow-xs hover:bg-slate-50">
            See all in Consolidated Holdings
          </Link>
        )}
        <Button size="sm" variant="secondary" onClick={() => download(target, positions, currency)}>
          <Download className="size-4" aria-hidden="true" /> Download CSV
        </Button>
      </div>

      <dl className={cn("grid gap-3", wide ? "grid-cols-4" : "grid-cols-2")}>
        <Tile label="Value" value={money(value, currency)}
          note={netWorth ? `${((value / netWorth) * 100).toFixed(1)}% of net worth` : investable ? `${((value / investable) * 100).toFixed(1)}% of investable` : "of the holdings book"} />
        {band ? (
          <Tile label="Vs target" value={`${band.actual.toFixed(1)}%`}
            note={`target ${band.target.toFixed(1)}% · ${band.deviating ? "outside band" : "within band"}`} tone={band.deviating ? "bad" : "good"} />
        ) : (
          <Tile label="Unrealised P&L" value={cost == null ? "—" : money(value - cost, currency)}
            note={cost == null || cost === 0 ? "cost not on file" : signed(((value - cost) / cost) * 100, "%")} tone={cost == null ? undefined : value >= cost ? "good" : "bad"} />
        )}
        <Tile label="YTD" value={ytd == null ? "—" : signed(ytd, "%")} note="price change of the positions held today" tone={ytd == null ? undefined : ytd >= 0 ? "good" : "bad"} />
        <Tile label="Positions" value={String(positions.length)} note={`across ${accounts} account${accounts === 1 ? "" : "s"}`} />
      </dl>

      {classRow && <Returns row={classRow} />}
      {target.by === "class" && trail.length === 1 && (() => {
        const series = ips.data?.history.find((one) => one.assetClass === target.key || one.name === target.name);
        return series && series.points.length > 1 ? <DeviationHistory series={series} /> : null;
      })()}
      {target.by === "class" && trail.length === 1 && performance.data?.attribution && (
        <Attribution periods={performance.data.attribution.periods} classKey={target.key} />
      )}

      <div className={cn("grid gap-6", wide && dimensions.length > 0 && positions.length > 1 && "grid-cols-2")}>
        {dimensions.length > 0 && positions.length > 1 && <Breakdown positions={positions} dimensions={dimensions} currency={currency} total={value} onDeeper={onDeeper} />}
        <Positions positions={positions} currency={currency} total={value} onDeeper={positions.length === 1 ? undefined : onDeeper} />
      </div>
      <p className="text-2xs text-ink-muted italic">Figures as of {formatDate(book.data.asOf)}, in {currency}, from the client's holdings book.</p>
    </div>
  );
}

/**
 * A sector or a company of the equity sleeve, read from the Equity Analytics screen's own figures (look-through view).
 * A sector's weight counts what funds hold in it, but only the companies held directly are named, so the panel lists
 * those and shows the rest as held through funds.
 */
function EquityBody({ customerId, target, wide, onDeeper }: {
  customerId: string;
  target: DrillTarget;
  wide: boolean;
  onDeeper: (target: DrillTarget) => void;
}) {
  const equity = useGetClientEquity<ClientEquity, ApiError>(customerId, { view: "LOOK_THROUGH" });
  if (equity.isError) return <p className="text-sm text-red-600">{equity.error.message}</p>;
  const data = equity.data;
  if (!data) return <p className="py-16 text-center text-sm text-ink-muted">Opening the breakdown…</p>;
  const currency = data.currency;
  const sleeve = data.strip.value ?? 0;

  if (target.by === "company") {
    const one = data.holdings.find((line) => line.name === target.key);
    if (!one) return <p className="py-12 text-center text-sm text-ink-muted">This company is no longer held.</p>;
    return <CompanyFacts one={one} data={data} wide={wide} />;
  }

  const row = data.sectors.find((line) => line.key === target.key);
  const companies = data.holdings.filter((line) => line.kind === "COMPANY" && line.sector === target.key)
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
  const value = row ? (row.portfolio / 100) * sleeve : 0;
  const named = companies.reduce((sum, line) => sum + (line.value ?? 0), 0);
  const viaFunds = Math.max(0, value - named);
  return (
    <div className="space-y-6">
      <dl className={cn("grid gap-3", wide ? "grid-cols-4" : "grid-cols-2")}>
        <Tile label="Weight" value={row ? `${row.portfolio.toFixed(1)}%` : "—"} note={`of the equity sleeve · ${money(value, currency)}`} />
        <Tile label="Benchmark" value={row?.benchmark == null ? "—" : `${row.benchmark.toFixed(1)}%`} note={data.benchmark} />
        <Tile label="Active" value={row?.active == null ? "—" : signed(row.active, " pp")} note="weight less benchmark"
          tone={row?.active == null ? undefined : row.active >= 0 ? "good" : "bad"} />
        <Tile label="Held directly" value={money(named, currency)} note={`${companies.length} compan${companies.length === 1 ? "y" : "ies"} · ${money(viaFunds, currency)} via funds`} />
      </dl>
      <section>
        <h3 className="mb-2 text-2xs font-bold tracking-wider text-ink-soft uppercase">Companies held directly</h3>
        {companies.length === 0 ? (
          <p className="text-sm text-ink-muted">None: all of this sector is held through funds, which do not name their companies here.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-2xs font-semibold tracking-wider whitespace-nowrap text-ink-muted uppercase">
                  <th scope="col" className="py-1.5 pr-2">Company</th>
                  <th scope="col" className="px-2 py-1.5">Country</th>
                  <th scope="col" className="px-2 py-1.5 text-right">Value</th>
                  <th scope="col" className="px-2 py-1.5 text-right">Wt.</th>
                  <th scope="col" className="px-2 py-1.5 text-right">Fwd P/E</th>
                  <th scope="col" className="px-2 py-1.5 text-right">ROE</th>
                  <th scope="col" className="px-2 py-1.5 text-right">YTD</th>
                  <th scope="col" className="py-1.5 pl-2 text-right">Contrib.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line tabular-nums">
                {companies.map((line) => (
                  <tr key={line.name} className="cursor-pointer hover:bg-canvas" onClick={() => onDeeper({ by: "company", key: line.name, name: line.name })}>
                    <td className="py-1.5 pr-2"><span className="font-medium">{line.name}</span>{line.ticker && <span className="block text-2xs text-ink-muted">{line.ticker}</span>}</td>
                    <td className="px-2 py-1.5 text-xs">{line.country ?? "—"}</td>
                    <td className="px-2 py-1.5 text-right font-semibold">{line.value == null ? "—" : money(line.value, currency)}</td>
                    <td className="px-2 py-1.5 text-right">{line.weight == null ? "—" : `${line.weight.toFixed(1)}%`}</td>
                    <td className="px-2 py-1.5 text-right">{line.forwardPe == null ? "—" : `${line.forwardPe.toFixed(1)}×`}</td>
                    <td className="px-2 py-1.5 text-right">{line.roe == null ? "—" : `${line.roe.toFixed(1)}%`}</td>
                    <td className={cn("px-2 py-1.5 text-right", line.ytd != null && (line.ytd >= 0 ? "text-emerald-600" : "text-red-600"))}>{line.ytd == null ? "—" : signed(line.ytd, "%")}</td>
                    <td className="py-1.5 pl-2 text-right">{line.contribution == null ? "—" : `${line.contribution > 0 ? "+" : ""}${line.contribution} bp`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <p className="text-2xs text-ink-muted italic">
        From the Equity Analytics screen, fund look-through applied, as of {formatDate(data.asOf)}. Fundamentals are the demo figures seeded per security, not a market-data feed.
      </p>
    </div>
  );
}

/** The ladder year a bond falls due in: its next call where it has one, as the ladder reads callables, else its maturity. */
function dueYear(one: FiHolding) {
  const on = one.nextCall ?? one.maturity;
  return on ? Number(on.slice(0, 4)) : null;
}

/** A bond's rating bucket: the first agency's rating, notches dropped ("BB+ / Ba1" is BB). */
function bucket(one: FiHolding) {
  if (one.kind !== "BOND" || !one.rating) return "NR / funds";
  return one.rating.split("/")[0]!.trim().replace(/[+-]/g, "");
}

/**
 * A year of the maturity ladder, a credit-quality bucket or one bond, read from the Fixed Income Analytics screen's
 * own figures. The ladder and the quality bars look through funds, but only bonds held directly are named, so the panel
 * lists those and shows the rest as held through funds.
 */
function BondBody({ customerId, target, wide, onDeeper }: {
  customerId: string;
  target: DrillTarget;
  wide: boolean;
  onDeeper: (target: DrillTarget) => void;
}) {
  const fi = useGetClientWorkspaceFixedIncome<ClientFixedIncome, ApiError>(customerId);
  if (fi.isError) return <p className="text-sm text-red-600">{fi.error.message}</p>;
  const data = fi.data;
  if (!data) return <p className="py-16 text-center text-sm text-ink-muted">Opening the breakdown…</p>;
  const currency = data.currency;
  const sleeve = data.sleeve ?? 0;
  const bonds = data.holdings.filter((one) => one.kind === "BOND");

  if (target.by === "bond") {
    const one = data.holdings.find((line) => line.name === target.key);
    if (!one) return <p className="py-12 text-center text-sm text-ink-muted">This bond is no longer held.</p>;
    return <BondFacts one={one} currency={currency} asOf={data.asOf} wide={wide} />;
  }

  let value = 0;
  let share: number | null = null;
  let benchmark: number | null = null;
  let named: FiHolding[] = [];
  if (target.by === "maturity") {
    const year = data.ladder.find((one) => one.year === target.key);
    value = year ? year.government + year.credit : 0;
    share = sleeve > 0 ? (value / sleeve) * 100 : null;
    const from = Number(target.key.replace("+", ""));
    named = bonds.filter((one) => {
      const due = dueYear(one);
      return due != null && (target.key.endsWith("+") ? due >= from : due === from);
    });
  } else {
    const row = data.quality.find((one) => one.key === target.key);
    share = row?.portfolio ?? null;
    benchmark = row?.benchmark ?? null;
    value = share == null ? 0 : (share / 100) * sleeve;
    named = target.key === "NR / funds" ? data.holdings.filter((one) => one.kind === "FUND") : bonds.filter((one) => bucket(one) === target.key);
  }
  named = [...named].sort((a, b) => b.value - a.value);
  const listed = named.reduce((sum, one) => sum + one.value, 0);
  // The bars are shares rounded to a tenth of a percent, so a leftover under 1% of the bar is rounding, not funds.
  const leftover = value - listed;
  const viaFunds = leftover > value * 0.01 ? leftover : 0;
  const income = named.reduce((sum, one) => sum + (one.couponsNext12 ?? 0), 0);
  const weightedYtm = listed > 0 && named.every((one) => one.ytm != null)
    ? named.reduce((sum, one) => sum + (one.ytm ?? 0) * one.value, 0) / listed : null;

  return (
    <div className="space-y-6">
      <dl className={cn("grid gap-3", wide ? "grid-cols-4" : "grid-cols-2")}>
        <Tile label="Value" value={money(value, currency)} note={share == null ? "of the fixed income sleeve" : `${share.toFixed(1)}% of the fixed income sleeve`} />
        {target.by === "rating" ? (
          <Tile label="Benchmark" value={benchmark == null ? "—" : `${benchmark.toFixed(1)}%`} note={data.benchmark} />
        ) : (
          <Tile label="Coupons · 12M" value={money(income, currency)} note="from the bonds named below" />
        )}
        <Tile label="Yield to maturity" value={weightedYtm == null ? "—" : `${weightedYtm.toFixed(2)}%`} note="value-weighted, named lines" />
        <Tile label="Held directly" value={money(listed, currency)}
          note={`${named.length} line${named.length === 1 ? "" : "s"}${viaFunds > 0 ? ` · ${money(viaFunds, currency)} via funds` : ""}`} />
      </dl>
      <section>
        <h3 className="mb-2 text-2xs font-bold tracking-wider text-ink-soft uppercase">{target.key === "NR / funds" ? "Funds" : "Bonds held directly"}</h3>
        {named.length === 0 ? (
          <p className="text-sm text-ink-muted">None: all of this is held through funds, which do not name their bonds here.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-2xs font-semibold tracking-wider whitespace-nowrap text-ink-muted uppercase">
                  <th scope="col" className="py-1.5 pr-2">Security</th>
                  <th scope="col" className="px-2 py-1.5">Rating</th>
                  <th scope="col" className="px-2 py-1.5">Maturity</th>
                  <th scope="col" className="px-2 py-1.5 text-right">Value</th>
                  <th scope="col" className="px-2 py-1.5 text-right">YTM</th>
                  <th scope="col" className="py-1.5 pl-2 text-right">Mod. dur.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line tabular-nums">
                {named.map((one) => (
                  <tr key={one.name} className="cursor-pointer hover:bg-canvas" onClick={() => onDeeper({ by: "bond", key: one.name, name: one.name })}>
                    <td className="py-1.5 pr-2"><span className="font-medium">{one.name}</span><span className="block text-2xs text-ink-muted">{one.sector ?? "—"}</span></td>
                    <td className="px-2 py-1.5 text-xs whitespace-nowrap">{one.rating ?? "—"}</td>
                    <td className="px-2 py-1.5 text-xs whitespace-nowrap">{one.perpetual ? "Perpetual" : one.maturity ? formatDate(one.maturity) : "—"}</td>
                    <td className="px-2 py-1.5 text-right font-semibold">{money(one.value, currency)}</td>
                    <td className="px-2 py-1.5 text-right">{one.ytm == null ? "—" : `${one.ytm.toFixed(2)}%`}</td>
                    <td className="py-1.5 pl-2 text-right">{one.modifiedDuration == null ? "—" : one.modifiedDuration.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <p className="text-2xs text-ink-muted italic">
        From the Fixed Income Analytics screen, funds looked through, as of {formatDate(data.asOf)}. Demo security data, not a market-data feed.
        {target.by === "maturity" && " A callable bond is counted in the year of its next call, as the ladder does."}
      </p>
    </div>
  );
}

/** Everything the screen holds on one bond or fund line. */
function BondFacts({ one, currency, asOf, wide }: { one: FiHolding; currency: string; asOf: string; wide: boolean }) {
  const frequency = one.frequency == null ? "—" : one.frequency === 12 ? "Monthly" : one.frequency === 2 ? "Semi-annual" : one.frequency === 1 ? "Annual" : `${one.frequency}× a year`;
  const facts: [string, string][] = [
    ["ISIN", one.isin ?? "—"],
    ["Sector", one.sector ?? "—"],
    ["Rating", one.rating ?? "—"],
    ["Currency", one.currency ?? "—"],
    ["Coupon", one.coupon == null ? "—" : `${one.coupon}%`],
    ["Maturity", one.perpetual ? "Perpetual" : one.maturity ? formatDate(one.maturity) : "—"],
    ["Next call", one.nextCall ? formatDate(one.nextCall) : "—"],
    ["Clean price", one.price == null ? "—" : one.price.toFixed(2)],
    ["Yield to worst", one.ytw == null ? "—" : `${one.ytw.toFixed(2)}%`],
    ["OAS", one.oas == null ? "—" : `${one.oas} bp`],
    ["DV01", one.dv01 == null ? "—" : money(one.dv01, currency)],
    ["Next coupon", one.nextCoupon ? formatDate(one.nextCoupon) : "—"],
    ["Frequency", frequency],
    ["Principal · 12M", one.principalNext12 == null ? "—" : money(one.principalNext12, currency)],
  ];
  return (
    <div className="space-y-6">
      <dl className={cn("grid gap-3", wide ? "grid-cols-4" : "grid-cols-2")}>
        <Tile label="Value" value={money(one.value, currency)} note={one.weight == null ? "—" : `${one.weight.toFixed(1)}% of the sleeve`} />
        <Tile label="Yield to maturity" value={one.ytm == null ? "—" : `${one.ytm.toFixed(2)}%`} note="local currency" />
        <Tile label="Modified duration" value={one.modifiedDuration == null ? "—" : `${one.modifiedDuration.toFixed(1)} yrs`} note="price move per 1% in rates" />
        <Tile label="Coupons · 12M" value={one.couponsNext12 == null ? "—" : money(one.couponsNext12, currency)} note="contractual" />
      </dl>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
        {facts.map(([label, value]) => (
          <div key={label}>
            <dt className="text-2xs text-ink-muted">{label}</dt>
            <dd className="font-medium tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-2xs text-ink-muted italic">Demo security data, not a market-data feed; as of {formatDate(asOf)}.</p>
    </div>
  );
}

/**
 * A strategy, a vintage year or one fund of the private-markets programme, read from the Private Markets screen's own
 * figures: commitments, calls, distributions and NAV as the fund statements on file give them.
 */
function FundBody({ customerId, target, wide, onDeeper }: {
  customerId: string;
  target: DrillTarget;
  wide: boolean;
  onDeeper: (target: DrillTarget) => void;
}) {
  const pm = useGetClientWorkspacePrivateMarkets<ClientPrivateMarkets, ApiError>(customerId);
  if (pm.isError) return <p className="text-sm text-red-600">{pm.error.message}</p>;
  const data = pm.data;
  if (!data) return <p className="py-16 text-center text-sm text-ink-muted">Opening the breakdown…</p>;
  const currency = data.currency;
  const funds = data.funds.filter((one) => !one.total && (
    target.by === "fund" ? one.name === target.key
      : target.by === "vintage" ? String(one.vintage ?? "") === target.key
      : one.strategy === target.key || one.strategy === target.name));
  if (funds.length === 0) return <p className="py-12 text-center text-sm text-ink-muted">No fund in this slice.</p>;

  const sum = (read: (one: PmFund) => number) => funds.reduce((total, one) => total + read(one), 0);
  const committed = sum((one) => one.committed);
  const paidIn = sum((one) => one.paidIn);
  const distributed = sum((one) => one.distributed);
  const nav = sum((one) => one.nav);
  const unfunded = sum((one) => one.unfunded);
  const tvpi = paidIn > 0 ? (distributed + nav) / paidIn : null;
  const dpi = paidIn > 0 ? distributed / paidIn : null;
  const single = funds.length === 1 ? funds[0]! : null;
  const score = single ? data.scorecard.find((one) => one.name === single.name) : undefined;
  const names = new Set(funds.map((one) => one.name));
  const notices = data.notices.filter((one) => names.has(one.fund));

  return (
    <div className="space-y-6">
      <dl className={cn("grid gap-3", wide ? "grid-cols-4" : "grid-cols-2")}>
        <Tile label="Committed" value={money(committed, currency)} note={`${money(unfunded, currency)} still to be called`} />
        <Tile label="Paid in" value={money(paidIn, currency)} note={committed > 0 ? `${((paidIn / committed) * 100).toFixed(0)}% called` : "—"} />
        <Tile label="Distributed" value={money(distributed, currency)} note={dpi == null ? "—" : `DPI ${dpi.toFixed(2)}×`} />
        <Tile label="NAV" value={money(nav, currency)} note={tvpi == null ? "—" : `TVPI ${tvpi.toFixed(2)}×`} />
      </dl>

      {single ? (
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          {([
            ["Strategy", single.strategy],
            ["Vintage", single.vintage == null ? "—" : String(single.vintage)],
            ["Administrator", single.administrator ?? "—"],
            ["NAV date", single.navDate ? `${formatDate(single.navDate)}${single.stale ? " · older than the latest quarter end" : ""}` : "—"],
            ["Net IRR", single.irr != null ? signed(single.irr, "%") : single.irrText ?? "—"],
            ["Quartile", single.quartile ?? "—"],
            ["Against its PME", score?.pme == null ? "—" : `MSCI ACWI PME IRR ${score.pme.toFixed(1)}% · fund ${score.abovePme ? "above" : "below"}`],
          ] as [string, string][]).map(([label, value]) => (
            <div key={label}>
              <dt className="text-2xs text-ink-muted">{label}</dt>
              <dd className="font-medium tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <section>
          <h3 className="mb-2 text-2xs font-bold tracking-wider text-ink-soft uppercase">Funds</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-2xs font-semibold tracking-wider whitespace-nowrap text-ink-muted uppercase">
                  <th scope="col" className="py-1.5 pr-2">Fund</th>
                  <th scope="col" className="px-2 py-1.5 text-right">Committed</th>
                  <th scope="col" className="px-2 py-1.5 text-right">NAV</th>
                  <th scope="col" className="px-2 py-1.5 text-right">TVPI</th>
                  <th scope="col" className="py-1.5 pl-2 text-right">Net IRR</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line tabular-nums">
                {funds.map((one) => (
                  <tr key={one.name} className="cursor-pointer hover:bg-canvas" onClick={() => onDeeper({ by: "fund", key: one.name, name: one.name })}>
                    <td className="py-1.5 pr-2"><span className="font-medium">{one.name}</span><span className="block text-2xs text-ink-muted">{[one.strategy, one.vintage].filter(Boolean).join(" · ")}</span></td>
                    <td className="px-2 py-1.5 text-right">{money(one.committed, currency)}</td>
                    <td className="px-2 py-1.5 text-right font-semibold">{money(one.nav, currency)}</td>
                    <td className="px-2 py-1.5 text-right">{one.tvpi == null ? "—" : `${one.tvpi.toFixed(2)}×`}</td>
                    <td className={cn("py-1.5 pl-2 text-right", one.irr != null && (one.irr >= 0 ? "text-emerald-600" : "text-red-600"))}>
                      {one.irr != null ? signed(one.irr, "%") : one.irrText ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {notices.length > 0 && (
        <section>
          <h3 className="mb-2 text-2xs font-bold tracking-wider text-ink-soft uppercase">Calls and distributions</h3>
          <ul className="divide-y divide-line text-sm">
            {notices.map((one, at) => (
              <li key={`${one.fund}-${one.on}-${at}`} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                <span>{one.kind === "CAPITAL_CALL" ? "Capital call" : "Distribution"}{!single && <span className="text-ink-muted"> · {one.fund}</span>}</span>
                <span className="text-ink-muted tabular-nums">{formatDate(one.on)} · {one.status}</span>
                <span className={cn("font-semibold tabular-nums", one.amount >= 0 ? "text-emerald-600" : "text-red-600")}>{one.amount > 0 ? "+" : ""}{money(one.amount, currency)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="text-2xs text-ink-muted italic">From the Private Markets screen, as of {formatDate(data.asOf)}; TVPI and DPI for a group are its funds added up.</p>
    </div>
  );
}

function payments(count: number) {
  return count === 1 ? "1 payment" : `${count} payments`;
}

/** A month of the twelve, as the panel heads it: "December 2026". */
function monthName(month: string) {
  return new Date(`${month.slice(0, 7)}-01T00:00:00`).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

/**
 * One month of the Overview's projected cash flows, or one kind of flow (coupons, capital calls…) across all twelve:
 * the same flows the card lists, added up by kind or by month. A capital call goes on to its fund.
 */
function FlowBody({ customerId, target, wide, onDeeper }: {
  customerId: string;
  target: DrillTarget;
  wide: boolean;
  onDeeper: (target: DrillTarget) => void;
}) {
  const workspace = useGetClientWorkspace<ClientWorkspace, ApiError>(customerId);
  const months = workspace.data?.cashFlowMonths;
  const option = useMemo(() => {
    if (!months || target.by !== "flowType") return null;
    const flows = workspace.data!.cashFlows.filter((one) => one.title === target.key);
    const colours = ink();
    const totals = months.map((month) => flows.filter((one) => one.on.slice(0, 7) === month.month.slice(0, 7))
      .reduce((sum, one) => sum + one.amount, 0));
    return {
      textStyle: { fontFamily: colours.font },
      grid: { left: 8, right: 8, top: 12, bottom: 8, containLabel: true },
      tooltip: { trigger: "axis", valueFormatter: (value: number) => money(value, workspace.data!.currency) },
      xAxis: {
        type: "category", data: months.map((one) => new Date(`${one.month.slice(0, 7)}-01T00:00:00`).toLocaleDateString("en-GB", { month: "short" })),
        axisLabel: { color: colours.muted }, axisLine: { lineStyle: { color: colours.line } }, axisTick: { show: false },
      },
      yAxis: { type: "value", splitNumber: 3, axisLabel: { color: colours.muted, formatter: (value: number) => money(value, workspace.data!.currency) }, splitLine: { lineStyle: { color: colours.line } } },
      series: [{
        type: "bar", name: target.name, barMaxWidth: 28,
        data: totals.map((value) => ({ value, itemStyle: { color: value < 0 ? colours.danger : colours.primary, borderRadius: value < 0 ? [0, 0, 4, 4] : [4, 4, 0, 0] } })),
      }],
    };
  }, [months, target, workspace.data]);

  if (workspace.isError) return <p className="text-sm text-red-600">{workspace.error.message}</p>;
  const data = workspace.data;
  if (!data || !months) return <p className="py-16 text-center text-sm text-ink-muted">Opening the breakdown…</p>;
  const currency = data.currency;
  const flows = data.cashFlows.filter((one) => target.by === "month" ? one.on.slice(0, 7) === target.key.slice(0, 7) : one.title === target.key);
  if (flows.length === 0) return <p className="py-12 text-center text-sm text-ink-muted">Nothing expected {target.by === "month" ? "this month" : "of this kind in the next twelve months"}.</p>;

  const inflows = flows.filter((one) => one.amount > 0).reduce((sum, one) => sum + one.amount, 0);
  const outflows = flows.filter((one) => one.amount < 0).reduce((sum, one) => sum + one.amount, 0);
  const net = inflows + outflows;
  const kinds = [...flows.reduce((all, one) => all.set(one.title, (all.get(one.title) ?? 0) + one.amount), new Map<string, number>())]
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  const largest = Math.max(...kinds.map(([, amount]) => Math.abs(amount)), 1);
  const open = (one: ClientWorkspace["cashFlows"][number]) => {
    if (one.kind === "CAPITAL_CALL" && one.detail) onDeeper({ by: "fund", key: one.detail, name: one.detail });
    else if (target.by === "month") onDeeper({ by: "flowType", key: one.title, name: one.title });
    else onDeeper({ by: "month", key: one.on.slice(0, 7), name: monthName(one.on) });
  };

  return (
    <div className="space-y-6">
      <dl className={cn("grid gap-3", wide ? "grid-cols-4" : "grid-cols-2")}>
        <Tile label="Coming in" value={money(inflows, currency)} note={payments(flows.filter((one) => one.amount > 0).length)} tone={inflows > 0 ? "good" : undefined} />
        <Tile label="Going out" value={money(outflows, currency)} note={payments(flows.filter((one) => one.amount < 0).length)} tone={outflows < 0 ? "bad" : undefined} />
        <Tile label="Net" value={money(net, currency)} note={net >= 0 ? "More in than out" : "More out than in"} tone={net >= 0 ? "good" : "bad"} />
        <Tile label={target.by === "month" ? "Kinds" : "Months"} value={String(target.by === "month" ? kinds.length : new Set(flows.map((one) => one.on.slice(0, 7))).size)}
          note={target.by === "month" ? "of flow this month" : "with a payment of this kind"} />
      </dl>

      {option && (
        <section>
          <h3 className="mb-2 text-2xs font-bold tracking-wider text-ink-soft uppercase">Month by month</h3>
          <Chart option={option} height={200} label={`${target.name} expected each month for the next twelve`}
            onPick={(_, index) => {
              const month = months[index];
              if (month) onDeeper({ by: "month", key: month.month.slice(0, 7), name: monthName(month.month) });
            }} />
        </section>
      )}

      {target.by === "month" && (
        <section>
          <h3 className="mb-2 text-2xs font-bold tracking-wider text-ink-soft uppercase">By kind</h3>
          <ul className="space-y-1.5 text-sm">
            {kinds.map(([title, amount]) => (
              <li key={title}>
                <button type="button" onClick={() => onDeeper({ by: "flowType", key: title, name: title })}
                  className="grid w-full grid-cols-[9rem_1fr_6rem] items-center gap-3 rounded-md px-1 py-1 text-left hover:bg-canvas">
                  <span className="truncate font-medium">{title}</span>
                  <span className="h-2 rounded-full bg-canvas">
                    <span className={cn("block h-2 rounded-full", amount < 0 ? "bg-red-500" : "bg-primary-600")} style={{ width: `${(Math.abs(amount) / largest) * 100}%` }} />
                  </span>
                  <span className={cn("text-right font-semibold tabular-nums", amount < 0 ? "text-red-600" : "text-emerald-600")}>{amount > 0 ? "+" : ""}{money(amount, currency)}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h3 className="mb-2 text-2xs font-bold tracking-wider text-ink-soft uppercase">Payments</h3>
        <ul className="divide-y divide-line text-sm">
          {flows.map((one, at) => (
            <li key={`${one.on}-${at}`}>
              <button type="button" onClick={() => open(one)} className="flex w-full items-center gap-3 px-1 py-2 text-left hover:bg-canvas">
                <span className="w-24 shrink-0 text-xs text-ink-muted tabular-nums">{formatDate(one.on)}</span>
                <span className="min-w-0 flex-1 truncate">{one.title}{one.detail && <span className="text-ink-muted"> · {one.detail}</span>}</span>
                <span className={cn("shrink-0 font-semibold tabular-nums", one.amount < 0 ? "text-red-600" : "text-emerald-600")}>{one.amount > 0 ? "+" : ""}{money(one.amount, currency)}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
      <p className="text-2xs text-ink-muted italic">The Overview's projected cash flows, in {currency}: coupons, dividends and other expected payments, capital calls due, and running costs.</p>
    </div>
  );
}

/** "March 2026" or "2025": how the panel heads a month or a year of the Performance screen. */
export function periodName(key: string) {
  return key.length === 4 ? key : new Date(`${key.slice(0, 7)}-01T00:00:00`).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

function ordinal(at: number) {
  const tail = at % 100 >= 11 && at % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][at % 10] ?? "th";
  return `${at}${tail}`;
}

/** Monthly returns compounded, in percent. */
function chained(values: number[]) {
  return (values.reduce((grown, one) => grown * (1 + one / 100), 1) - 1) * 100;
}

/**
 * One calendar year or one month of the Performance screen: its return beside the benchmark, the months it is made
 * of, where it ranks, and what the growth line and the rolling year stood at. Every figure is the screen's own; the
 * panel only picks them out and compounds months where it adds up a year to date.
 */
function PeriodBody({ customerId, target, wide, onDeeper }: {
  customerId: string;
  target: DrillTarget;
  wide: boolean;
  onDeeper: (target: DrillTarget) => void;
}) {
  const performance = useGetClientPerformance<ClientPerformance, ApiError>(customerId);
  const data = performance.data;
  const isYear = target.key.length === 4;
  const year = target.key.slice(0, 4);
  const months = useMemo(() => (data?.monthly ?? []).filter((one) => one.month.startsWith(year)), [data, year]);
  const option = useMemo(() => {
    if (months.length === 0) return null;
    const colours = ink();
    return {
      textStyle: { fontFamily: colours.font },
      grid: { left: 8, right: 8, top: 12, bottom: 8, containLabel: true },
      tooltip: { trigger: "axis", valueFormatter: (value: number) => `${value.toFixed(2)}%` },
      xAxis: {
        type: "category", data: months.map((one) => new Date(`${one.month.slice(0, 7)}-01T00:00:00`).toLocaleDateString("en-GB", { month: "short" })),
        axisLabel: { color: colours.muted }, axisLine: { lineStyle: { color: colours.line } }, axisTick: { show: false },
      },
      yAxis: { type: "value", splitNumber: 3, axisLabel: { color: colours.muted, formatter: "{value}%" }, splitLine: { lineStyle: { color: colours.line } } },
      series: [{
        type: "bar", name: "Net TWR", barMaxWidth: 28,
        data: months.map((one) => {
          const chosen = !isYear && one.month.slice(0, 7) === target.key.slice(0, 7);
          const colour = one.value < 0 ? colours.danger : colours.primary;
          return { value: one.value, itemStyle: { color: colour, opacity: isYear || chosen ? 1 : 0.35, borderRadius: one.value < 0 ? [0, 0, 4, 4] : [4, 4, 0, 0] } };
        }),
      }],
    };
  }, [months, isYear, target.key]);

  if (performance.isError) return <p className="text-sm text-red-600">{performance.error.message}</p>;
  if (!data) return <p className="py-16 text-center text-sm text-ink-muted">Opening the breakdown…</p>;
  const toMonth = (one: { month: string }) => onDeeper({ by: "period", key: one.month.slice(0, 7), name: periodName(one.month) });
  const chart = option && (
    <section>
      <h3 className="mb-2 text-2xs font-bold tracking-wider text-ink-soft uppercase">{year} month by month · net TWR</h3>
      <Chart option={option} height={200} label={`Each month's return in ${year}`}
        onPick={(_, index) => { const one = months[index]; if (one && one.month.slice(0, 7) !== target.key) toMonth(one); }} />
    </section>
  );

  if (isYear) {
    const row = data.calendarYears.find((one) => String(one.year) === year);
    if (!row) return <p className="py-12 text-center text-sm text-ink-muted">No return measured for {year}.</p>;
    const excess = row.benchmark == null ? null : row.portfolio - row.benchmark;
    const ranked = [...data.calendarYears].sort((a, b) => b.portfolio - a.portfolio);
    const rank = ranked.findIndex((one) => one.year === row.year) + 1;
    const best = months.reduce<PerformanceMonth | null>((top, one) => (top == null || one.value > top.value ? one : top), null);
    const worst = months.reduce<PerformanceMonth | null>((low, one) => (low == null || one.value < low.value ? one : low), null);
    const up = months.filter((one) => one.value > 0).length;
    const inYear = data.growth.filter((one) => one.on.startsWith(year));
    const before = [...data.growth].reverse().find((one) => one.on.slice(0, 4) < year);
    const start = before ?? inYear[0];
    const end = inYear[inYear.length - 1];
    return (
      <div className="space-y-6">
        <dl className={cn("grid gap-3", wide ? "grid-cols-4" : "grid-cols-2")}>
          <Tile label="Portfolio" value={signed(row.portfolio, "%")} note={row.partial ? "Part year" : "Net TWR"} tone={row.portfolio >= 0 ? "good" : "bad"} />
          <Tile label="Benchmark" value={row.benchmark == null ? "—" : signed(row.benchmark, "%")} note="Policy benchmark" />
          <Tile label="Excess" value={excess == null ? "—" : `${excess >= 0 ? "+" : ""}${excess.toFixed(1)} pp`} note={excess == null ? "No benchmark" : excess >= 0 ? "Ahead of the benchmark" : "Behind the benchmark"} tone={excess == null ? undefined : excess >= 0 ? "good" : "bad"} />
          <Tile label="Rank" value={`${ordinal(rank)} of ${ranked.length}`} note="Among the years measured" />
        </dl>
        {chart}
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          {([
            ["Best month", best ? `${periodName(best.month)} · ${signed(best.value, "%")}` : "—", best],
            ["Worst month", worst ? `${periodName(worst.month)} · ${signed(worst.value, "%")}` : "—", worst],
            ["Months up", months.length ? `${up} of ${months.length}` : "—", null],
            ["Growth of $100", start && end ? `${start.portfolio.toFixed(1)} → ${end.portfolio.toFixed(1)}` : "—", null],
          ] as [string, string, PerformanceMonth | null][]).map(([label, value, month]) => (
            <div key={label}>
              <dt className="text-2xs text-ink-muted">{label}</dt>
              <dd className="font-medium tabular-nums">
                {month ? <button type="button" onClick={() => toMonth(month)} className="text-primary-700 hover:underline">{value}</button> : value}
              </dd>
            </div>
          ))}
        </dl>
        <p className="text-2xs text-ink-muted italic">From the Performance screen, as of {formatDate(data.asOf)}; net of fees, time-weighted.{row.partial ? " A part year runs from the first measured month or to the latest." : ""}</p>
      </div>
    );
  }

  const one = data.monthly.find((m) => m.month.slice(0, 7) === target.key.slice(0, 7));
  if (!one) return <p className="py-12 text-center text-sm text-ink-muted">No return measured for {target.name}.</p>;
  const ranked = [...data.monthly].sort((a, b) => b.value - a.value);
  const rank = ranked.findIndex((m) => m.month === one.month) + 1;
  const ytd = chained(months.filter((m) => m.month <= one.month).map((m) => m.value));
  const rolling = data.rolling.find((point) => point.on.slice(0, 7) === target.key.slice(0, 7));
  const grown = [...data.growth].reverse().find((point) => point.on.slice(0, 7) <= target.key.slice(0, 7));
  return (
    <div className="space-y-6">
      <dl className={cn("grid gap-3", wide ? "grid-cols-4" : "grid-cols-2")}>
        <Tile label="Month" value={signed(one.value, "%")} note={one.partial ? "Month to date" : "Net TWR"} tone={one.value >= 0 ? "good" : "bad"} />
        <Tile label={`${year} to date`} value={signed(ytd, "%")} note={`Compounded to the end of ${periodName(one.month).split(" ")[0]}`} tone={ytd >= 0 ? "good" : "bad"} />
        <Tile label="Rolling 12 months" value={rolling ? signed(rolling.portfolio, "%") : "—"}
          note={rolling ? (rolling.benchmark == null ? "No benchmark" : `Benchmark ${signed(rolling.benchmark, "%")}`) : "Needs twelve months"} />
        <Tile label="Rank" value={`${ordinal(rank)} of ${ranked.length}`} note="Among the months measured" />
      </dl>
      {chart}
      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
        <div>
          <dt className="text-2xs text-ink-muted">Growth of $100</dt>
          <dd className="font-medium tabular-nums">{grown ? `${grown.portfolio.toFixed(1)}${grown.benchmark == null ? "" : ` · benchmark ${grown.benchmark.toFixed(1)}`}` : "—"}</dd>
        </div>
        <div>
          <dt className="text-2xs text-ink-muted">The year</dt>
          <dd className="font-medium">
            <button type="button" onClick={() => onDeeper({ by: "period", key: year, name: year })} className="text-primary-700 hover:underline">All of {year}</button>
          </dd>
        </div>
      </dl>
      <p className="text-2xs text-ink-muted italic">From the Performance screen, as of {formatDate(data.asOf)}; net of fees, time-weighted.{one.partial ? " A part month runs to the latest valuation." : ""}</p>
    </div>
  );
}

type Effect = "allocation" | "selection" | "interaction" | "total";

const EFFECT_FIELD: Record<Effect, keyof Pick<AttributionRow, "allocationBp" | "selectionBp" | "interactionBp" | "totalBp">> = {
  allocation: "allocationBp", selection: "selectionBp", interaction: "interactionBp", total: "totalBp",
};

const EFFECT_NOTE: Record<Effect, string> = {
  allocation: "Weighting each class away from the benchmark: what over- and underweights earned.",
  selection: "Doing better or worse than the benchmark inside each class, at the benchmark's weight.",
  interaction: "Overweighting the classes where selection also worked, or the reverse.",
  total: "Every effect added up for each class: allocation, selection and interaction.",
};

/**
 * One Brinson-Fachler effect from the Excess Return Bridge, class by class, over whichever period is picked. The
 * server's figures, sorted; nothing is recomputed.
 */
function EffectBody({ customerId, target, wide, onDeeper }: {
  customerId: string;
  target: DrillTarget;
  wide: boolean;
  onDeeper: (target: DrillTarget) => void;
}) {
  const performance = useGetClientPerformance<ClientPerformance, ApiError>(customerId);
  const [chosen, setChosen] = useState<string | null>(null);
  if (performance.isError) return <p className="text-sm text-red-600">{performance.error.message}</p>;
  const data = performance.data;
  if (!data) return <p className="py-16 text-center text-sm text-ink-muted">Opening the breakdown…</p>;
  const periods = data.attribution?.periods ?? [];
  if (periods.length === 0) return <p className="py-12 text-center text-sm text-ink-muted">No attribution measured yet.</p>;
  const period = periods.find((one) => one.key === (chosen ?? "YTD")) ?? periods[0]!;
  const effect = (target.key in EFFECT_FIELD ? target.key : "total") as Effect;
  const field = EFFECT_FIELD[effect];
  const rows = [...period.rows].sort((a, b) => b[field] - a[field]);
  const largest = Math.max(1, ...rows.map((row) => Math.abs(row[field])));
  const sum = effect === "total" ? period.allocation + period.selection + period.interaction : period[effect];
  const top = rows[0];
  const bottom = rows[rows.length - 1];

  return (
    <div className="space-y-6">
      <div className="inline-flex flex-wrap rounded-lg border border-line p-0.5" role="group" aria-label="Period">
        {periods.map((one) => (
          <button key={one.key} type="button" onClick={() => setChosen(one.key)} aria-pressed={one.key === period.key}
            className={cn("rounded-md px-2.5 py-1 text-xs font-semibold whitespace-nowrap",
              one.key === period.key ? "bg-primary-50 text-primary-700 ring-1 ring-primary-200" : "text-ink-soft hover:bg-slate-50")}>
            {one.label}
          </button>
        ))}
      </div>
      <dl className={cn("grid gap-3", wide ? "grid-cols-4" : "grid-cols-2")}>
        <Tile label={effect === "total" ? "All effects" : target.name} value={`${sum >= 0 ? "+" : ""}${sum.toFixed(2)} pp`} note={period.label} tone={sum >= 0 ? "good" : "bad"} />
        <Tile label="Portfolio" value={signed(period.portfolio, "%")} note={`Benchmark ${signed(period.benchmark, "%")}`} />
        <Tile label="Added most" value={top ? `${top[field] >= 0 ? "+" : ""}${top[field]} bp` : "—"} note={top?.name ?? "—"} tone={top && top[field] > 0 ? "good" : undefined} />
        <Tile label={bottom && bottom[field] < 0 ? "Cost most" : "Added least"} value={bottom ? `${bottom[field] >= 0 ? "+" : ""}${bottom[field]} bp` : "—"} note={bottom?.name ?? "—"} tone={bottom && bottom[field] < 0 ? "bad" : undefined} />
      </dl>
      <p className="text-sm text-ink-soft">{EFFECT_NOTE[effect]}</p>

      <section>
        <h3 className="mb-2 text-2xs font-bold tracking-wider text-ink-soft uppercase">By asset class · basis points</h3>
        <ul className="space-y-1.5 text-sm">
          {rows.map((row) => (
            <li key={row.key}>
              <button type="button" onClick={() => onDeeper({ by: "class", key: row.key, name: row.name })}
                className="grid w-full grid-cols-[9rem_1fr_4.5rem] items-center gap-3 rounded-md px-1 py-1 text-left hover:bg-canvas">
                <span className="truncate font-medium">{row.name}</span>
                <span className="relative h-2 rounded-full bg-canvas">
                  <span className={cn("absolute top-0 h-2 rounded-full", row[field] < 0 ? "right-1/2 bg-red-500" : "left-1/2 bg-primary-600")}
                    style={{ width: `${(Math.abs(row[field]) / largest) * 50}%` }} />
                </span>
                <span className={cn("text-right font-semibold tabular-nums", row[field] < 0 ? "text-red-600" : row[field] > 0 ? "text-emerald-600" : "text-ink-muted")}>
                  {row[field] > 0 ? "+" : ""}{row[field]}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className="mb-2 text-2xs font-bold tracking-wider text-ink-soft uppercase">Weights and returns · {period.label}</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-2xs font-semibold tracking-wider whitespace-nowrap text-ink-muted uppercase">
                <th scope="col" className="py-1.5 pr-2">Class</th>
                <th scope="col" className="px-2 py-1.5 text-right">Weight</th>
                <th scope="col" className="px-2 py-1.5 text-right">Bench wt</th>
                <th scope="col" className="px-2 py-1.5 text-right">Return</th>
                <th scope="col" className="px-2 py-1.5 text-right">Bench ret</th>
                <th scope="col" className="py-1.5 pl-2 text-right">Alloc · Sel · Int</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line tabular-nums">
              {rows.map((row) => (
                <tr key={row.key} className="cursor-pointer hover:bg-canvas" onClick={() => onDeeper({ by: "class", key: row.key, name: row.name })}>
                  <td className="py-1.5 pr-2 font-medium">{row.name}</td>
                  <td className="px-2 py-1.5 text-right">{row.portfolioWeight.toFixed(1)}%</td>
                  <td className="px-2 py-1.5 text-right text-ink-muted">{row.benchmarkWeight.toFixed(1)}%</td>
                  <td className={cn("px-2 py-1.5 text-right", row.portfolioReturn >= 0 ? "text-emerald-600" : "text-red-600")}>{signed(row.portfolioReturn, "%")}</td>
                  <td className="px-2 py-1.5 text-right text-ink-muted">{signed(row.benchmarkReturn, "%")}</td>
                  <td className="py-1.5 pl-2 text-right whitespace-nowrap">{row.allocationBp} · {row.selectionBp} · {row.interactionBp}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <p className="text-2xs text-ink-muted italic">{data.attribution?.note}</p>
    </div>
  );
}

/** Each category's column of the register's year-end values. */
const YEAR_FIELD: Record<string, keyof Omit<CoYear, "year">> = {
  YACHT: "yacht", ART: "art", CARS: "cars", WATCHES: "watches", WINE: "wine", JEWELLERY: "jewellery",
};

/**
 * A category of collectibles, a place where they sit, or one item, read from the Collectibles & Real Assets screen's
 * own register: what the firm's staff entered, with its appraisals, custody and insurance.
 */
function CollectibleBody({ customerId, target, wide, onDeeper }: {
  customerId: string;
  target: DrillTarget;
  wide: boolean;
  onDeeper: (target: DrillTarget) => void;
}) {
  const co = useGetClientWorkspaceCollectibles<ClientCollectibles, ApiError>(customerId);
  if (co.isError) return <p className="text-sm text-red-600">{co.error.message}</p>;
  const data = co.data;
  if (!data) return <p className="py-16 text-center text-sm text-ink-muted">Opening the breakdown…</p>;
  const currency = data.currency;

  if (target.by === "item") {
    const one = data.items.find((line) => line.id === target.key);
    if (!one) return <p className="py-12 text-center text-sm text-ink-muted">This item is no longer on the register.</p>;
    return <ItemFacts one={one} currency={currency} wide={wide} />;
  }

  const items = data.items.filter((one) => (target.by === "category" ? one.category === target.key : one.location === target.key))
    .sort((a, b) => b.value - a.value);
  if (items.length === 0) return <p className="py-12 text-center text-sm text-ink-muted">Nothing on the register here.</p>;
  const value = items.reduce((sum, one) => sum + one.value, 0);
  const insured = items.reduce((sum, one) => sum + (one.insured ?? 0), 0);
  const cost = items.every((one) => one.cost != null) ? items.reduce((sum, one) => sum + (one.cost ?? 0), 0) : null;
  const premium = items.reduce((sum, one) => sum + (one.premium ?? 0), 0);
  const field = target.by === "category" ? YEAR_FIELD[target.key] : undefined;

  return (
    <div className="space-y-6">
      <dl className={cn("grid gap-3", wide ? "grid-cols-4" : "grid-cols-2")}>
        <Tile label="Register value" value={money(value, currency)} note={`${items.length} item${items.length === 1 ? "" : "s"}`} />
        <Tile label="Insured" value={money(insured, currency)} note={value > 0 ? `${((insured / value) * 100).toFixed(0)}% of value` : "—"}
          tone={value > 0 && insured < value * 0.9 ? "bad" : undefined} />
        <Tile label="Gain on cost" value={cost == null || cost === 0 ? "—" : signed(((value - cost) / cost) * 100, "%")}
          note={cost == null ? "cost not on file for every item" : `cost ${money(cost, currency)}`} tone={cost == null ? undefined : value >= cost ? "good" : "bad"} />
        <Tile label="Premiums · annual" value={money(premium, currency)} note="insurance on these items" />
      </dl>
      {field && <RegisterHistory years={data.years} field={field} currency={currency} name={target.name} />}
      <section>
        <h3 className="mb-2 text-2xs font-bold tracking-wider text-ink-soft uppercase">Items</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-2xs font-semibold tracking-wider whitespace-nowrap text-ink-muted uppercase">
                <th scope="col" className="py-1.5 pr-2">Item</th>
                <th scope="col" className="px-2 py-1.5">{target.by === "category" ? "Location" : "Category"}</th>
                <th scope="col" className="px-2 py-1.5 text-right">Value</th>
                <th scope="col" className="px-2 py-1.5 text-right">Gain</th>
                <th scope="col" className="py-1.5 pl-2 text-right">Next appraisal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line tabular-nums">
              {items.map((one) => (
                <tr key={one.id} className="cursor-pointer hover:bg-canvas" onClick={() => onDeeper({ by: "item", key: one.id, name: one.name })}>
                  <td className="py-1.5 pr-2"><span className="font-medium">{one.name}</span>{one.line && <span className="block text-2xs text-ink-muted">{one.line}</span>}</td>
                  <td className="px-2 py-1.5 text-xs">{target.by === "category" ? one.location ?? "—" : one.categoryLabel}</td>
                  <td className="px-2 py-1.5 text-right font-semibold">{money(one.value, currency)}</td>
                  <td className={cn("px-2 py-1.5 text-right", one.gainPercent != null && (one.gainPercent >= 0 ? "text-emerald-600" : "text-red-600"))}>
                    {one.gainPercent == null ? "—" : signed(one.gainPercent, "%")}
                  </td>
                  <td className="py-1.5 pl-2 text-right text-xs">{one.nextAppraisal ? formatDate(one.nextAppraisal) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <p className="text-2xs text-ink-muted italic">From the Collectibles &amp; Real Assets register as of {formatDate(data.asOf)}; values are what staff entered from appraisals.</p>
    </div>
  );
}

/** A category's year-end appraised value, year by year, from the register's own series. */
function RegisterHistory({ years, field, currency, name }: { years: CoYear[]; field: keyof Omit<CoYear, "year">; currency: string; name: string }) {
  const option = useMemo(() => {
    const colours = ink();
    return {
      textStyle: { fontFamily: colours.font },
      grid: { left: 8, right: 12, top: 12, bottom: 4, containLabel: true },
      tooltip: { trigger: "axis", valueFormatter: (value: number) => money(value, currency) },
      xAxis: { type: "category", data: years.map((one) => one.year), axisLabel: { color: colours.muted }, axisLine: { lineStyle: { color: colours.line } } },
      yAxis: { type: "value", splitNumber: 3, axisLabel: { color: colours.muted, formatter: (value: number) => money(value, currency) }, splitLine: { lineStyle: { color: colours.line } } },
      series: [{ type: "line", name, data: years.map((one) => one[field]), smooth: false, symbolSize: 6,
        lineStyle: { color: colours.primary, width: 2 }, itemStyle: { color: colours.primary }, areaStyle: { color: colours.primarySoft, opacity: 0.5 } }],
    };
  }, [years, field, currency, name]);
  if (years.length < 2) return null;
  return (
    <section>
      <h3 className="mb-2 text-2xs font-bold tracking-wider text-ink-soft uppercase">Value over time</h3>
      <Chart option={option} height={170} label={`${name}: year-end appraised value`} />
    </section>
  );
}

/** Everything the register holds on one item. */
function ItemFacts({ one, currency, wide }: { one: CoItem; currency: string; wide: boolean }) {
  const facts: [string, string][] = [
    ["Category", one.categoryLabel],
    ["Reference", one.reference ?? "—"],
    ["Owner", one.owner ?? "—"],
    ["Acquired", one.acquiredOn ? formatDate(one.acquiredOn) : "—"],
    ["Valuation method", one.valuationMethod ?? "—"],
    ["Last appraisal", [one.lastAppraisal ? formatDate(one.lastAppraisal) : null, one.valuer].filter(Boolean).join(" · ") || "—"],
    ["Next appraisal", one.nextAppraisal ? formatDate(one.nextAppraisal) : "—"],
    ["Location", one.location ?? "—"],
    ["Custody", one.custody ?? "—"],
    ["Policy", [one.policyRef, one.coverType].filter(Boolean).join(" · ") || "—"],
  ];
  return (
    <div className="space-y-6">
      <dl className={cn("grid gap-3", wide ? "grid-cols-4" : "grid-cols-2")}>
        <Tile label="Value" value={money(one.value, currency)} note={one.line ?? "—"} />
        <Tile label="Cost" value={one.cost == null ? "—" : money(one.cost, currency)}
          note={one.gainPercent == null ? "—" : `${signed(one.gainPercent, "%")} gain`} tone={one.gainPercent == null ? undefined : one.gainPercent >= 0 ? "good" : "bad"} />
        <Tile label="Insured" value={one.insured == null ? "—" : money(one.insured, currency)}
          note={one.coveragePercent == null ? "—" : `${one.coveragePercent.toFixed(0)}% of value`} tone={one.coveragePercent != null && one.coveragePercent < 90 ? "bad" : undefined} />
        <Tile label="Premium · annual" value={one.premium == null ? "—" : money(one.premium, currency)} note="insurance" />
      </dl>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
        {facts.map(([label, value]) => (
          <div key={label}>
            <dt className="text-2xs text-ink-muted">{label}</dt>
            <dd className="font-medium">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** The class's distance from its strategic target at each month end, against the edges of its band. */
function DeviationHistory({ series }: { series: IpsDeviationSeries }) {
  const option = useMemo(() => {
    const colours = ink();
    const months = series.points.map((one) => new Date(one.on).toLocaleString("en-GB", { month: "short", year: "2-digit" }));
    return {
      textStyle: { fontFamily: colours.font },
      grid: { left: 8, right: 12, top: 12, bottom: 4, containLabel: true },
      tooltip: { trigger: "axis", valueFormatter: (value: number) => `${value > 0 ? "+" : ""}${value.toFixed(2)} pp` },
      xAxis: { type: "category", data: months, axisLabel: { color: colours.muted, fontSize: 10 }, axisLine: { lineStyle: { color: colours.line } } },
      yAxis: { type: "value", axisLabel: { color: colours.muted, formatter: "{value} pp" }, splitLine: { lineStyle: { color: colours.line } } },
      series: [
        { type: "line", name: "Deviation", data: series.points.map((one) => one.deviation), symbolSize: 6,
          lineStyle: { color: colours.primary, width: 2 },
          itemStyle: { color: (point: { dataIndex: number }) => (series.points[point.dataIndex]?.outside ? colours.danger : colours.primary) } },
        { type: "line", name: "Band edge", data: series.points.map(() => series.band), symbol: "none", lineStyle: { color: colours.danger, type: "dashed", width: 1 } },
        { type: "line", name: "Band edge", data: series.points.map(() => -series.band), symbol: "none", lineStyle: { color: colours.danger, type: "dashed", width: 1 } },
      ],
    };
  }, [series]);
  return (
    <section>
      <h3 className="mb-2 text-2xs font-bold tracking-wider text-ink-soft uppercase">Deviation from target · 12 months</h3>
      <Chart option={option} height={170} label={`${series.name}: percentage points from its strategic target at each month end, with its band`} />
      <p className="mt-1 text-2xs text-ink-muted">Dashed lines are the band's edges (±{series.band} pp); a red point is a month end outside it.</p>
    </section>
  );
}

/** One rule of the client's investment policy: where it stands today and every exception logged against it. */
function RuleBody({ customerId, target, wide }: { customerId: string; target: DrillTarget; wide: boolean }) {
  const ips = useGetClientIps<ClientIps, ApiError>(customerId);
  if (ips.isError) return <p className="text-sm text-red-600">{ips.error.message}</p>;
  const data = ips.data;
  if (!data) return <p className="py-16 text-center text-sm text-ink-muted">Opening the rule…</p>;
  const check = [...data.checks, ...data.gauges].find((one) => one.key === target.key || one.label === target.name);
  const log = data.log.filter((one) => one.rule === target.name || one.rule === check?.label);
  const status: Record<string, [string, "good" | "bad" | undefined]> = {
    COMPLIANT: ["Compliant", "good"], NEAR_LIMIT: ["Near limit", "bad"], WARNING: ["Warning", "bad"], DEVIATION: ["Deviation", "bad"], NOT_MEASURED: ["Not measured", undefined],
  };
  return (
    <div className="space-y-6">
      {check ? (
        <dl className={cn("grid gap-3", wide ? "grid-cols-4" : "grid-cols-2")}>
          <Tile label="Limit" value={check.limit} note={check.bound} />
          <Tile label="Current" value={check.currentText ?? (check.current == null ? "—" : `${check.current}%`)}
            note={check.measuredOn ? `measured ${formatDate(check.measuredOn)}` : `checked ${formatDate(data.checkedAt)}`} />
          <Tile label="Utilisation" value={check.usedPercent == null ? "—" : `${check.usedPercent}%`} note="of the limit used" />
          <Tile label="Status" value={status[check.status]?.[0] ?? check.status} note={check.note ?? "per the signed IPS"} tone={status[check.status]?.[1]} />
        </dl>
      ) : (
        <p className="text-sm text-ink-muted">This rule is no longer checked; its history is below.</p>
      )}
      <section>
        <h3 className="mb-2 text-2xs font-bold tracking-wider text-ink-soft uppercase">Exceptions logged · last 12 months</h3>
        {log.length === 0 ? <p className="text-sm text-ink-muted">None: the rule has held all year.</p> : (
          <ul className="divide-y divide-line text-sm">
            {log.map((one, at) => (
              <li key={`${one.on}-${at}`} className="py-2">
                <p className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{one.observed}</span>
                  <span className="text-xs text-ink-muted tabular-nums">{formatDate(one.on)} · {one.status.toLowerCase()}</span>
                </p>
                <p className="text-xs text-ink-soft">{[one.resolution, one.approvedBy && `approved by ${one.approvedBy}`, one.source].filter(Boolean).join(" · ")}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/** Every entity in the tree, children after their parent. */
function flatten(nodes: StructureNode[]): StructureNode[] {
  return nodes.flatMap((one) => [one, ...flatten(one.children)]);
}

/** As the Entity Structure screen names them. */
const ENTITY_TYPE: Record<string, string> = {
  TRUST: "Trust", SUB_TRUST: "Sub-trust", COMPANY: "Company", LLC: "LLC", SPV: "SPV", FOUNDATION: "Foundation",
  PERSONAL: "Personal holding", JOINT: "Joint holding",
};

/**
 * One entity of the client's structure, or one beneficiary across them, read from the Entity Structure screen: what it
 * is and who runs it, what it owns and holds, who benefits from it, and what falls due for it.
 */
function EntityBody({ customerId, target, wide, onDeeper }: {
  customerId: string;
  target: DrillTarget;
  wide: boolean;
  onDeeper: (target: DrillTarget) => void;
}) {
  const structure = useGetClientStructure<ClientStructure, ApiError>(customerId);
  if (structure.isError) return <p className="text-sm text-red-600">{structure.error.message}</p>;
  const data = structure.data;
  if (!data) return <p className="py-16 text-center text-sm text-ink-muted">Opening the entity…</p>;
  const currency = data.currency;

  if (target.by === "beneficiary") {
    const at = data.beneficiaries.findIndex((one) => one.id === target.key);
    const who = data.beneficiaries[at];
    if (!who) return <p className="py-12 text-center text-sm text-ink-muted">This beneficiary is no longer on file.</p>;
    const rows = data.interests.map((row) => ({ row, amount: (row.cells as (number | null)[])[at] ?? null }))
      .filter((one) => one.amount != null && one.amount > 0).sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0));
    return (
      <div className="space-y-6">
        <dl className={cn("grid gap-3", wide ? "grid-cols-4" : "grid-cols-2")}>
          <Tile label="Economic interest" value={money(who.value, currency)} note={`${who.sharePercent.toFixed(1)}% of the structure`} />
          <Tile label="Generation" value={who.generation ?? "—"} note={who.kind.toLowerCase().replace(/_/g, " ")} />
          <Tile label="Through" value={String(rows.length)} note={`entit${rows.length === 1 ? "y" : "ies"}`} />
          <Tile label="Largest" value={rows[0] ? money(rows[0].amount ?? 0, currency) : "—"} note={rows[0]?.row.entity ?? "—"} />
        </dl>
        <section>
          <h3 className="mb-2 text-2xs font-bold tracking-wider text-ink-soft uppercase">Interest by entity</h3>
          <ul className="divide-y divide-line">
            {rows.map(({ row, amount }) => (
              <li key={row.entityId}>
                <button type="button" onClick={() => onDeeper({ by: "legalEntity", key: row.entityId, name: row.entity })}
                  className="grid w-full grid-cols-[minmax(0,1.4fr)_minmax(3rem,1fr)_auto_3.25rem] items-center gap-3 rounded-md px-1 py-2 text-left text-sm hover:bg-canvas">
                  <span className="truncate font-medium">{row.entity}</span>
                  <span className="block h-2 rounded-full bg-slate-100" aria-hidden="true">
                    <span className="block h-full rounded-full bg-primary-600" style={{ width: `${((amount ?? 0) / who.value) * 100}%` }} />
                  </span>
                  <span className="text-right font-semibold tabular-nums">{money(amount ?? 0, currency)}</span>
                  <span className="text-right text-xs text-ink-muted tabular-nums">{row.value > 0 ? `${(((amount ?? 0) / row.value) * 100).toFixed(0)}%` : "—"}</span>
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-1 text-2xs text-ink-muted italic">The last figure is the beneficiary's share of that entity, as recorded (trust deeds and letters of wishes).</p>
        </section>
      </div>
    );
  }

  const node = flatten(data.entities).find((one) => one.id === target.key);
  const row = data.register.find((one) => one.id === target.key);
  if (!node && !row) return <p className="py-12 text-center text-sm text-ink-muted">This entity is no longer on file.</p>;
  const name = row?.name ?? node!.name;
  const mix = data.assetMix.find((one) => one.entityId === target.key)?.slices ?? [];
  const interests = data.interests.find((one) => one.entityId === target.key);
  const benefits = interests ? data.beneficiaries.map((one, at) => ({ one, amount: (interests.cells as (number | null)[])[at] ?? null }))
    .filter((line) => line.amount != null && line.amount > 0) : [];
  const due = data.governance.filter((one) => one.entity === name);
  const papers = data.documents.filter((one) => one.entity === name);
  const officers = row?.officers ?? node?.officers ?? [];
  const value = row?.value ?? node?.value ?? 0;

  return (
    <div className="space-y-6">
      <dl className={cn("grid gap-3", wide ? "grid-cols-4" : "grid-cols-2")}>
        <Tile label="Value" value={money(value, currency)} note={row?.netWorthPercent == null ? "look-through" : `${row.netWorthPercent.toFixed(1)}% of net worth`} />
        <Tile label="Type" value={ENTITY_TYPE[row?.type ?? node?.type ?? ""] ?? (row?.type ?? node?.type ?? "—")} note={row?.jurisdiction ?? node?.jurisdiction ?? "—"} />
        <Tile label="Owned" value={row?.ownedPercent == null ? "—" : `${row.ownedPercent}%`} note={row?.parent ? `by ${row.parent}` : "by the settlors"} />
        <Tile label="Held directly" value={node ? money(node.direct, currency) : "—"} note={(node?.custodians ?? row?.custodians ?? []).join(" · ") || "no account linked"} />
      </dl>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
        {([
          ["Tax classification", row?.taxClassification ?? node?.taxClassification ?? "—"],
          ["Trustees & directors", officers.length === 0 ? "—" : officers.map((one) => `${one.name} (${one.role.toLowerCase()})`).join(" · ")],
          ["KYC / CRS", row?.refreshKind && row.refreshDue ? `${row.refreshKind === "CRS_RENEWAL" ? "CRS" : "KYC"} due ${formatDate(row.refreshDue)}` : "Nothing due"],
          ["Description", node?.description ?? "—"],
        ] as [string, string][]).map(([label, text]) => (
          <div key={label}>
            <dt className="text-2xs text-ink-muted">{label}</dt>
            <dd className="font-medium">{text}</dd>
          </div>
        ))}
      </dl>

      <div className={cn("grid gap-6", wide && "grid-cols-2")}>
        {mix.length > 0 && (
          <section>
            <h3 className="mb-2 text-2xs font-bold tracking-wider text-ink-soft uppercase">Asset mix</h3>
            <ul className="divide-y divide-line">
              {mix.map((one) => (
                <li key={one.key} className="grid grid-cols-[minmax(0,1.4fr)_minmax(3rem,1fr)_auto_3.25rem] items-center gap-3 py-2 text-sm">
                  <span className="truncate font-medium">{one.name}</span>
                  <span className="block h-2 rounded-full bg-slate-100" aria-hidden="true">
                    <span className="block h-full rounded-full bg-primary-600" style={{ width: `${one.sharePercent}%` }} />
                  </span>
                  <span className="text-right font-semibold tabular-nums">{money(one.value, currency)}</span>
                  <span className="text-right text-xs text-ink-muted tabular-nums">{one.sharePercent.toFixed(1)}%</span>
                </li>
              ))}
            </ul>
          </section>
        )}
        {benefits.length > 0 && (
          <section>
            <h3 className="mb-2 text-2xs font-bold tracking-wider text-ink-soft uppercase">Who benefits</h3>
            <ul className="divide-y divide-line">
              {benefits.map(({ one, amount }) => (
                <li key={one.id}>
                  <button type="button" onClick={() => onDeeper({ by: "beneficiary", key: one.id, name: one.name })}
                    className="flex w-full items-center justify-between gap-3 rounded-md px-1 py-2 text-left text-sm hover:bg-canvas">
                    <span className="font-medium">{one.name}{one.generation && <span className="text-ink-muted"> · {one.generation}</span>}</span>
                    <span className="font-semibold tabular-nums">{money(amount ?? 0, currency)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {node && node.children.length > 0 && (
        <section>
          <h3 className="mb-2 text-2xs font-bold tracking-wider text-ink-soft uppercase">Owns</h3>
          <ul className="divide-y divide-line">
            {node.children.map((child) => (
              <li key={child.id}>
                <button type="button" onClick={() => onDeeper({ by: "legalEntity", key: child.id, name: child.name })}
                  className="flex w-full items-center justify-between gap-3 rounded-md px-1 py-2 text-left text-sm hover:bg-canvas">
                  <span className="font-medium">{child.name}<span className="text-ink-muted"> · {[child.ownedPercent == null ? null : `${child.ownedPercent}%`, child.jurisdiction].filter(Boolean).join(" · ")}</span></span>
                  <span className="font-semibold tabular-nums">{money(child.value, currency)}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {node && node.direct > 0 && (
        <button type="button" onClick={() => onDeeper({ by: "entity", key: name, name: `Held directly by ${name}` })}
          className="inline-flex h-8 items-center rounded-lg border border-line bg-white px-3 text-xs font-semibold text-ink shadow-xs hover:bg-slate-50">
          Open the holdings {name} holds directly →
        </button>
      )}

      {(due.length > 0 || papers.length > 0) && (
        <section>
          <h3 className="mb-2 text-2xs font-bold tracking-wider text-ink-soft uppercase">Governance &amp; documents</h3>
          <ul className="divide-y divide-line text-sm">
            {due.map((one, at) => (
              <li key={`due-${at}`} className="flex flex-wrap justify-between gap-2 py-1.5">
                <span>{one.title}</span>
                <span className="text-xs text-ink-muted tabular-nums">{formatDate(one.dueOn)} · {one.status.toLowerCase()}</span>
              </li>
            ))}
            {papers.map((one, at) => (
              <li key={`doc-${at}`} className="flex flex-wrap justify-between gap-2 py-1.5">
                <span>{one.title}</span>
                <span className="text-xs text-ink-muted">{[one.executedOn && `executed ${formatDate(one.executedOn)}`, one.amendedOn && `updated ${formatDate(one.amendedOn)}`].filter(Boolean).join(" · ") || "—"}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="text-2xs text-ink-muted italic">From the Entity Structure screen, as recorded by the firm's staff; values are look-through, as of {formatDate(data.asOf)}.</p>
    </div>
  );
}

/** One company: its weight, return and contribution, and its fundamentals beside the equity sleeve's and the benchmark's. */
function CompanyFacts({ one, data, wide }: { one: EquityHolding; data: ClientEquity; wide: boolean }) {
  const metrics: [string, (line: EquityHolding) => number | null, (value: number) => string][] = [
    ["Market cap", (line) => line.marketCap, (value) => `$${Math.round(value).toLocaleString("en-US")}B`],
    ["P/E · trailing", (line) => line.pe, (value) => `${value.toFixed(1)}×`],
    ["P/E · forward", (line) => line.forwardPe, (value) => `${value.toFixed(1)}×`],
    ["Price / Book", (line) => line.pb, (value) => `${value.toFixed(1)}×`],
    ["Return on equity", (line) => line.roe, (value) => `${value.toFixed(1)}%`],
    ["Dividend yield", (line) => line.dividendYield, (value) => `${value.toFixed(1)}%`],
    ["EPS growth · 3Y", (line) => line.epsGrowth, (value) => signed(value, "%")],
    ["Net debt / EBITDA", (line) => line.netDebtEbitda, (value) => `${value.toFixed(1)}×`],
    ["Beta", (line) => line.beta, (value) => value.toFixed(2)],
  ];
  const cell = (line: EquityHolding | null, [, read, show]: (typeof metrics)[number]) => {
    const value = line ? read(line) : null;
    return value == null ? "—" : show(value);
  };
  return (
    <div className="space-y-6">
      <dl className={cn("grid gap-3", wide ? "grid-cols-4" : "grid-cols-2")}>
        <Tile label="Value" value={one.value == null ? "—" : money(one.value, data.currency)} note={[one.ticker, one.country].filter(Boolean).join(" · ") || "—"} />
        <Tile label="Weight" value={one.weight == null ? "—" : `${one.weight.toFixed(1)}%`} note="of the equity sleeve" />
        <Tile label="YTD" value={one.ytd == null ? "—" : signed(one.ytd, "%")} note={one.sector ?? "—"} tone={one.ytd == null ? undefined : one.ytd >= 0 ? "good" : "bad"} />
        <Tile label="Contribution" value={one.contribution == null ? "—" : `${one.contribution > 0 ? "+" : ""}${one.contribution} bp`} note="to the sleeve's return, YTD"
          tone={one.contribution == null ? undefined : one.contribution >= 0 ? "good" : "bad"} />
      </dl>
      <section>
        <h3 className="mb-2 text-2xs font-bold tracking-wider text-ink-soft uppercase">Fundamentals</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
              <th scope="col" className="py-1.5 pr-2">Measure</th>
              <th scope="col" className="px-2 py-1.5 text-right">{one.name}</th>
              <th scope="col" className="px-2 py-1.5 text-right">Equity sleeve</th>
              <th scope="col" className="py-1.5 pl-2 text-right">{data.benchmark}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line tabular-nums">
            {metrics.map((metric) => (
              <tr key={metric[0]}>
                <th scope="row" className="py-1.5 pr-2 text-left font-medium">{metric[0]}</th>
                <td className="px-2 py-1.5 text-right font-semibold">{cell(one, metric)}</td>
                <td className="px-2 py-1.5 text-right">{cell(data.portfolio, metric)}</td>
                <td className="py-1.5 pl-2 text-right text-ink-muted">{cell(data.benchmarkRow, metric)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <p className="text-2xs text-ink-muted italic">Demo fundamentals seeded per security, not a market-data feed; as of {formatDate(data.asOf)}.</p>
    </div>
  );
}

function Tile({ label, value, note, tone }: { label: string; value: string; note: string; tone?: "good" | "bad" }) {
  return (
    <div className="rounded-lg border border-line px-3 py-2.5">
      <dt className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">{label}</dt>
      <dd className={cn("mt-0.5 text-lg font-bold tabular-nums", tone === "good" && "text-emerald-600", tone === "bad" && "text-red-600")}>{value}</dd>
      <dd className="text-2xs text-ink-muted">{note}</dd>
    </div>
  );
}

const PERIODS = ["MTD", "QTD", "YTD", "1Y", "3Y", "5Y", "ITD"];

/** The class's change in value over each period, beside its benchmark where it has one: the performance screen's own row. */
function Returns({ row }: { row: ClientPerformance["byClass"][number] }) {
  const shown = PERIODS.map((name, at) => ({ name, own: row.figures[at] ?? null, bench: row.benchmark[at] ?? null })).filter((one) => one.own != null);
  const option = useMemo(() => {
    const colours = ink();
    const hasBench = shown.some((one) => one.bench != null);
    return {
      textStyle: { fontFamily: colours.font },
      grid: { left: 40, right: 8, top: hasBench ? 28 : 12, bottom: 22 },
      legend: hasBench ? { top: 0, right: 0, itemWidth: 10, itemHeight: 10, textStyle: { color: colours.muted, fontSize: 11 } } : undefined,
      tooltip: { trigger: "axis", valueFormatter: (one: number | null) => (one == null ? "—" : `${one.toFixed(1)}%`) },
      xAxis: { type: "category", data: shown.map((one) => one.name), axisLine: { lineStyle: { color: colours.line } }, axisLabel: { color: colours.muted } },
      yAxis: { type: "value", axisLabel: { color: colours.muted, formatter: "{value}%" }, splitLine: { lineStyle: { color: colours.line } } },
      series: [
        { name: row.name, type: "bar", barMaxWidth: 26, itemStyle: { color: colours.primary, borderRadius: [4, 4, 0, 0] }, data: shown.map((one) => one.own) },
        ...(hasBench ? [{ name: "Benchmark", type: "bar", barMaxWidth: 26, itemStyle: { color: colours.neutral, borderRadius: [4, 4, 0, 0] }, data: shown.map((one) => one.bench) }] : []),
      ],
    };
  }, [row, shown]);
  if (shown.length === 0) return null;
  return (
    <section>
      <h3 className="mb-2 text-2xs font-bold tracking-wider text-ink-soft uppercase">Change in value by period</h3>
      <Chart option={option} height={170} label={`${row.name}: change in value for each period`} />
    </section>
  );
}

/** The class's line of the Brinson-Fachler attribution, period by period: the performance screen's own figures. */
function Attribution({ periods, classKey }: { periods: NonNullable<ClientPerformance["attribution"]>["periods"]; classKey: string }) {
  const rows = periods.flatMap((period) => period.rows.filter((row) => row.key === classKey).map((row) => ({ period: period.label, row })));
  if (rows.length === 0) return null;
  const bp = (value: number) => <span className={cn(value > 0 ? "text-emerald-600" : value < 0 ? "text-red-600" : "")}>{value > 0 ? "+" : ""}{value}</span>;
  return (
    <section>
      <h3 className="mb-2 text-2xs font-bold tracking-wider text-ink-soft uppercase">Attribution against the benchmark</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-2xs font-semibold tracking-wider whitespace-nowrap text-ink-muted uppercase">
              <th scope="col" className="py-1.5 pr-2">Period</th>
              <th scope="col" className="px-2 py-1.5 text-right">Port. wt</th>
              <th scope="col" className="px-2 py-1.5 text-right">Bench wt</th>
              <th scope="col" className="px-2 py-1.5 text-right">Port. ret</th>
              <th scope="col" className="px-2 py-1.5 text-right">Bench ret</th>
              <th scope="col" className="px-2 py-1.5 text-right">Alloc.</th>
              <th scope="col" className="px-2 py-1.5 text-right">Select.</th>
              <th scope="col" className="py-1.5 pl-2 text-right">Total bp</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line tabular-nums">
            {rows.map(({ period, row }) => (
              <tr key={period}>
                <th scope="row" className="py-1.5 pr-2 text-left font-medium">{period}</th>
                <td className="px-2 py-1.5 text-right">{row.portfolioWeight.toFixed(1)}%</td>
                <td className="px-2 py-1.5 text-right">{row.benchmarkWeight.toFixed(1)}%</td>
                <td className="px-2 py-1.5 text-right">{signed(row.portfolioReturn, "%")}</td>
                <td className="px-2 py-1.5 text-right">{signed(row.benchmarkReturn, "%")}</td>
                <td className="px-2 py-1.5 text-right">{bp(row.allocationBp)}</td>
                <td className="px-2 py-1.5 text-right">{bp(row.selectionBp)}</td>
                <td className="py-1.5 pl-2 text-right font-semibold">{bp(row.totalBp)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Breakdown({ positions, dimensions, currency, total, onDeeper }: {
  positions: HoldingsPosition[];
  dimensions: readonly BookField[];
  currency: string;
  total: number;
  onDeeper: (target: DrillTarget) => void;
}) {
  const [by, setBy] = useState(dimensions[0]!);
  const current = dimensions.includes(by) ? by : dimensions[0]!;
  const groups = groupBy(positions, current);
  const largest = Math.max(...groups.map((one) => one.value), 1);
  return (
    <section>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-2xs font-bold tracking-wider text-ink-soft uppercase">Breakdown</h3>
        <div className="flex gap-0.5 rounded-lg bg-canvas p-0.5" role="tablist" aria-label="Broken down by">
          {dimensions.map((one) => (
            <button key={one} type="button" role="tab" aria-selected={one === current} onClick={() => setBy(one)}
              className={cn("rounded-md px-2.5 py-1 text-2xs font-semibold whitespace-nowrap", one === current ? "bg-white text-ink shadow-xs" : "text-ink-muted hover:text-ink")}>
              {BY_LABEL[one]}
            </button>
          ))}
        </div>
      </div>
      <ul className="divide-y divide-line">
        {groups.map((one) => (
          <li key={one.key}>
            <button type="button" onClick={() => onDeeper({ by: current, key: one.key, name: one.name })}
              className="grid w-full grid-cols-[minmax(0,1.4fr)_minmax(3rem,1fr)_auto_3.25rem] items-center gap-3 rounded-md px-1 py-2 text-left text-sm hover:bg-canvas">
              <span className="truncate font-medium">{one.name}</span>
              <span className="block h-2 rounded-full bg-slate-100" aria-hidden="true">
                <span className="block h-full rounded-full bg-primary-600" style={{ width: `${(one.value / largest) * 100}%` }} />
              </span>
              <span className="text-right font-semibold tabular-nums">{money(one.value, currency)}</span>
              <span className="text-right text-xs text-ink-muted tabular-nums">{((one.value / total) * 100).toFixed(1)}%</span>
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-1 text-2xs text-ink-muted italic">Click a row to break it down further.</p>
    </section>
  );
}

function Positions({ positions, currency, total, onDeeper }: {
  positions: HoldingsPosition[];
  currency: string;
  total: number;
  onDeeper?: (target: DrillTarget) => void;
}) {
  return (
    <section className="min-w-0">
      <h3 className="mb-2 text-2xs font-bold tracking-wider text-ink-soft uppercase">Positions</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
              <th scope="col" className="py-1.5 pr-2">Position</th>
              <th scope="col" className="px-2 py-1.5 text-right">Value</th>
              <th scope="col" className="px-2 py-1.5 text-right">Wt.</th>
              <th scope="col" className="py-1.5 pl-2 text-right">YTD</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {positions.map((one) => (
              <tr key={one.id} className={cn(onDeeper && "cursor-pointer hover:bg-canvas")}
                onClick={onDeeper ? () => onDeeper({ by: "position", key: one.id, name: one.name }) : undefined}>
                <td className="py-1.5 pr-2">
                  <span className="font-medium">{one.name}</span>
                  <span className="block text-2xs text-ink-muted">{[one.entity, one.custodian, one.currency].filter(Boolean).join(" · ")}</span>
                </td>
                <td className="px-2 py-1.5 text-right font-semibold whitespace-nowrap tabular-nums">{money(one.value, currency)}</td>
                <td className="px-2 py-1.5 text-right text-xs tabular-nums">{((one.value / total) * 100).toFixed(1)}%</td>
                <td className={cn("py-1.5 pl-2 text-right tabular-nums", one.yearToDate != null && (one.yearToDate >= 0 ? "text-emerald-600" : "text-red-600"))}>
                  {one.yearToDate == null ? "—" : signed(one.yearToDate, "%")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {positions.length === 1 && <PositionFacts one={positions[0]!} currency={currency} />}
    </section>
  );
}

/** Everything the book holds on one position, when the panel is down to one. */
function PositionFacts({ one, currency }: { one: HoldingsPosition; currency: string }) {
  const facts: [string, string][] = [
    ["Asset class", one.assetClassName],
    ["Sub-class", one.subClass ?? "—"],
    ["Identifier", one.identifier ?? "—"],
    ["Held by", one.entity ?? "—"],
    ["Custodian · account", [one.custodian, one.account].filter(Boolean).join(" · ") || "—"],
    ["Currency", one.currency ?? "—"],
    ["Liquidity", one.liquidity ?? "—"],
    ["Quantity", one.quantity == null ? "—" : one.quantity.toLocaleString("en-US", { maximumFractionDigits: 4 })],
    ["Price", one.price == null ? "—" : one.price.toLocaleString("en-US", { maximumFractionDigits: 4 })],
    ["Cost", one.cost == null ? "—" : money(one.cost, currency)],
    ["Unrealised", one.unrealised == null ? "—" : `${money(one.unrealised, currency)}${one.unrealisedPercent == null ? "" : ` (${signed(one.unrealisedPercent, "%")})`}`],
    ["1 day", one.oneDay == null ? "—" : signed(one.oneDay, "%")],
  ];
  return (
    <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
      {facts.map(([label, value]) => (
        <div key={label}>
          <dt className="text-2xs text-ink-muted">{label}</dt>
          <dd className="font-medium tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function download(target: DrillTarget, positions: HoldingsPosition[], currency: string) {
  const head = ["Position", "Identifier", "Asset class", "Sub-class", "Entity", "Custodian", "Account", "Currency", "Quantity", "Price", `Value (${currency})`, `Cost (${currency})`, "YTD %"];
  const cell = (one: unknown) => {
    const text = one == null ? "" : String(one);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const rows = positions.map((one) => [one.name, one.identifier, one.assetClassName, one.subClass, one.entity, one.custodian, one.account,
    one.currency, one.quantity, one.price, one.value, one.cost, one.yearToDate]);
  const blob = new Blob([[head, ...rows].map((row) => row.map(cell).join(",")).join("\n")], { type: "text/csv" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${target.name.replace(/[^\w-]+/g, "-")}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function money(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, notation: "compact", maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `${currency} ${new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 }).format(amount)}`;
  }
}

function signed(value: number, unit: string) {
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}${unit}`;
}
