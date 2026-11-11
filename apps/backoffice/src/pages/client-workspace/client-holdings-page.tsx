import { ApiError } from "@atomprive/api-client";
import {
  useGetClientHoldingsBook,
  useReconcileClientHoldings,
  type ClientHoldingsBook,
  type ClientHoldingsCheck,
  type HoldingsGroup,
  type HoldingsPosition,
  type HoldingsSlice,
} from "@atomprive/api-client/backoffice";
import { Alert, Button, SelectInput, cn } from "@atomprive/ui";
import { ChevronDown, ChevronRight, Columns3 } from "lucide-react";
import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router";
import { formatDate } from "../../lib/labels";
import { HoldingsCheckBody } from "../bank-syncs/holdings-check-client-page";
import { INK } from "../portfolios/asset-classes";

/**
 * A client's Consolidated Holdings, laid out the way the firm's own design draws it: what the lines are worth, cost and
 * have gained, realised and paid this year, where they sit by custodian and currency, the lines themselves grouped
 * and filtered, their tax lots, every movement, corporate actions, and the custodian reconciliation.
 *
 * <p>Read only. The reconciliation is the Operations Holdings check itself, the same figures by the same rules. A client
 * whose figures come only from their bank's files is shown their lines exactly as sent, each in its own currency, with
 * totals per currency and "not in bank file" for cost, gains, income, lots and corporate actions.
 */
export function ClientHoldingsPage() {
  const { customerId = "" } = useParams();
  const book = useGetClientHoldingsBook<ClientHoldingsBook, ApiError>(customerId);
  const check = useReconcileClientHoldings<ClientHoldingsCheck, ApiError>(customerId, { query: { retry: false } });
  const data = book.data;

  if (book.isError) return <Alert tone="danger">{book.error.message}</Alert>;
  if (!data) return <p className="py-16 text-center text-sm text-ink-muted">Reading the holdings…</p>;

  const reconciliation: Reconciliation = check.data ? { kind: "data", data: check.data }
    : check.isError ? { kind: "none", message: check.error.status === 404 ? "No bank has sent this client's holdings." : check.error.message }
    : { kind: "loading" };

  return (
    <div className="space-y-5">
      <header>
        <p className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">
          Portfolio Management / <Link to="/client-directory" className="hover:text-primary-700">Clients</Link> / {data.name} / Consolidated Holdings
        </p>
        <h1 className="mt-1 text-[1.625rem] leading-tight font-bold">Consolidated Holdings</h1>
        <p className="mt-1 text-sm text-ink-muted">
          {data.name} · all entities and custodians · positions as of {formatDate(data.asOf)} close
        </p>
      </header>
      <Kpis data={data} reconciliation={reconciliation} />
      <div className="grid gap-4 lg:grid-cols-3">
        <CustodianCard data={data} />
        <CurrencyCard data={data} />
        <PnlCard data={data} />
      </div>
      <Tabs data={data} reconciliation={reconciliation} />
      <footer className="flex flex-wrap justify-between gap-2 pt-2 text-2xs text-ink-muted">
        <span>
          {data.bankFile ? "Values in the bank's own currencies, unconverted" : `Values in ${data.currency} unless stated`}; market data as of {formatDate(data.asOf)} close.
        </span>
        <span>atom privé · Portfolio Management · Internal use only</span>
      </footer>
    </div>
  );
}

type Reconciliation = { kind: "data"; data: ClientHoldingsCheck } | { kind: "none"; message: string } | { kind: "loading" };

/* ------------------------------------------------------------------------------------------------------------ */
/* Figures                                                                                                       */

function Kpis({ data, reconciliation }: { data: ClientHoldingsBook; reconciliation: Reconciliation }) {
  const k = data.kpis;
  const cur = data.currency;
  const file = data.bankFile;
  const summary = reconciliation.kind === "data" ? reconciliation.data.summary : null;
  return (
    <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(min(100%,190px),1fr))]">
      <Kpi label="Market value" value={file ? <Marker>per currency below</Marker> : compact(k.marketValue ?? 0, cur)}
        note={`${k.positions} positions · ${k.accounts} accounts`} />
      <Kpi label="Cost basis"
        value={file
          ? (data.fileCostTotals.length === 0 ? <NotInFile /> : (
            <span className="flex flex-col text-base">
              {data.fileCostTotals.map((one) => <span key={one.currency}>{exact(one.amount, one.currency)}</span>)}
            </span>
          ))
          : k.costBasis == null ? "—" : compact(k.costBasis, cur)}
        note={file
          ? (data.fileCostTotals.length === 0 ? null : `The bank's own total cost, for ${k.costed} of ${k.positions} lines · per currency; the rest not in bank file`)
          : k.averageHoldingYears == null ? "No tax lots on file" : `Average holding period ${k.averageHoldingYears} years${k.costed < k.positions ? ` · ${k.costed} of ${k.positions} lines costed` : ""}`} />
      <Kpi label="Unrealised P&L" tone={file ? undefined : toneOf(k.unrealised ?? 0)}
        value={file ? <NotInFile /> : k.unrealised == null ? "—" : signedCompact(k.unrealised, cur)}
        note={file ? null : k.unrealisedPercent == null ? null : `${k.unrealisedPercent > 0 ? "+" : ""}${k.unrealisedPercent}% on cost`} />
      <Kpi label="Realised P&L · YTD" tone={file ? undefined : toneOf(k.realisedYearToDate ?? 0)}
        value={file ? <NotInFile /> : signedCompact(k.realisedYearToDate ?? 0, cur)}
        note={file ? null : `ST ${signedCompact(k.realisedShortTerm ?? 0, cur)} · LT ${signedCompact(k.realisedLongTerm ?? 0, cur)}`} />
      <Kpi label="Income · YTD" value={file ? <NotInFile /> : compact(k.incomeYearToDate ?? 0, cur)}
        note={file ? null : `Coupons ${compact(k.coupons ?? 0, cur)} · Dividends ${compact(k.dividends ?? 0, cur)} · Dist. ${compact(k.distributions ?? 0, cur)}`} />
      {/* The check's own counts: lines matched over lines compared, and everything else a break. */}
      <Kpi label="Reconciliation"
        value={summary ? matchedShare(summary) : reconciliation.kind === "none" ? "—" : "…"}
        note={summary ? breaksNote(summary) : reconciliation.kind === "none" ? reconciliation.message : null} />
    </div>
  );
}

function CustodianCard({ data }: { data: ClientHoldingsBook }) {
  return (
    <Card title="By Custodian" lead="Book of record per custodian">
      {data.bankFile ? <FileByBank data={data} /> : <Bars slices={data.byCustodian} currency={data.currency} />}
    </Card>
  );
}

function CurrencyCard({ data }: { data: ClientHoldingsBook }) {
  return (
    <Card title="By Currency" lead={data.bankFile ? "Each currency as the bank's files state it; not converted" : `Unhedged exposure in reporting currency (${data.currency})`}>
      {data.bankFile ? (
        data.fileTotals.length === 0 ? <FileBlock /> : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2 2xl:grid-cols-4">
            {data.fileTotals.map((one) => (
              <div key={one.currency} className="rounded-lg border border-line px-2.5 py-2">
                <p className="text-xs font-semibold">{one.currency}</p>
                <p className="text-sm font-bold tabular-nums">{exact(one.amount, one.currency)}</p>
              </div>
            ))}
          </div>
        )
      ) : data.byCurrency.length === 0 ? <Empty>No line states its currency.</Empty> : (
        <>
          <div className="flex h-3 w-full overflow-hidden rounded-sm" aria-hidden="true">
            {data.byCurrency.map((one, at) => <span key={one.key} style={{ width: `${one.sharePercent}%`, background: INK[at % INK.length] }} />)}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2 2xl:grid-cols-4">
            {data.byCurrency.map((one, at) => (
              <div key={one.key} className="rounded-lg border border-line px-2.5 py-2">
                <p className="flex items-center gap-1.5 text-xs font-semibold">
                  <span className="size-2 rounded-xs" style={{ background: INK[at % INK.length] }} aria-hidden="true" />{one.name}
                </p>
                <p className="text-base font-bold tabular-nums">{one.sharePercent.toFixed(1)}%</p>
                <p className="text-2xs text-ink-muted tabular-nums">{compact(one.amount, data.currency)}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}

function PnlCard({ data }: { data: ClientHoldingsBook }) {
  const largest = Math.max(1, ...data.unrealisedByClass.map((one) => Math.abs(one.amount)));
  return (
    <Card title="Unrealised P&L by Asset Class" lead="Market value less cost basis">
      {data.bankFile ? <FileBlock /> : data.unrealisedByClass.length === 0 ? <Empty>No tax lots on file.</Empty> : (
        <ul className="space-y-2">
          {data.unrealisedByClass.map((one) => (
            <li key={one.key} className="grid grid-cols-[1fr_5rem_5rem] items-center gap-2 text-sm">
              <span className="truncate">{one.name}</span>
              <span className="relative block h-2" aria-hidden="true">
                <span className="absolute top-0 left-1/2 h-2 w-px bg-line" />
                <span className={cn("absolute top-0 h-2", one.amount >= 0 ? "left-1/2 bg-emerald-500" : "right-1/2 bg-red-600")}
                  style={{ width: `${(Math.abs(one.amount) / largest) * 50}%` }} />
              </span>
              <span className={cn("text-right font-semibold tabular-nums", toneOf(one.amount))}>{signedCompact(one.amount, data.currency)}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function Bars({ slices, currency }: { slices: HoldingsSlice[]; currency: string }) {
  const largest = Math.max(1, ...slices.map((one) => one.amount));
  if (slices.length === 0) return <Empty>Nothing held yet.</Empty>;
  return (
    <ul className="space-y-2">
      {slices.map((one) => (
        <li key={one.key} className="grid grid-cols-[1fr_6rem_5rem] items-center gap-2 text-sm">
          <span className="truncate">{one.name}</span>
          <span className="block h-2 rounded-full bg-slate-100" aria-hidden="true">
            <span className="block h-full rounded-full bg-primary-600" style={{ width: `${(one.amount / largest) * 100}%` }} />
          </span>
          <span className="text-right font-semibold tabular-nums">{compact(one.amount, currency)}</span>
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------------------------------------------------ */
/* Tabs                                                                                                          */

const TABS = [
  ["positions", "Positions"],
  ["lots", "Tax lots"],
  ["transactions", "Transactions"],
  ["actions", "Corporate actions"],
  ["reconciliation", "Custodian reconciliation"],
] as const;

type Tab = (typeof TABS)[number][0];

function Tabs({ data, reconciliation }: { data: ClientHoldingsBook; reconciliation: Reconciliation }) {
  const [tab, setTab] = useState<Tab>("positions");
  const [picked, setPicked] = useState<HoldingsPosition | null>(data.positions[0] ?? null);
  return (
    <>
      <section className="rounded-2xl border border-line bg-white p-5">
        <div role="tablist" aria-label="Holdings" className="-mx-5 mb-4 flex gap-1 overflow-x-auto border-b border-line px-5">
          {TABS.map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
              className={cn("-mb-px border-b-2 px-3 py-2 text-sm font-semibold whitespace-nowrap",
                tab === id ? "border-primary-600 text-primary-700" : "border-transparent text-ink-soft hover:text-ink")}>
              {label}
            </button>
          ))}
        </div>
        {tab === "positions" && <Positions data={data} onPick={setPicked} picked={picked} />}
        {tab === "lots" && (data.bankFile ? <FileNote what="Tax lots" /> : <LotsTable data={data} position={null} />)}
        {tab === "transactions" && <Ledger data={data} limit={null} />}
        {tab === "actions" && (data.bankFile ? <FileNote what="Corporate actions" /> : <Actions data={data} />)}
        {tab === "reconciliation" && (
          reconciliation.kind === "data" ? <HoldingsCheckBody data={reconciliation.data} />
            : reconciliation.kind === "none" ? <Empty>{reconciliation.message}</Empty> : <Empty>Comparing holdings…</Empty>
        )}
      </section>
      {tab === "positions" && picked && !data.bankFile && (
        <Card title={`Tax Lots · ${picked.name}`}
          lead={[picked.quantity == null ? null : `${plain(picked.quantity)} units`, picked.entity].filter(Boolean).join(" · ") || undefined}>
          <LotsTable data={data} position={picked} />
        </Card>
      )}
      {tab === "positions" && picked && data.bankFile && (
        <Card title={`Tax Lots · ${picked.name}`}><FileNote what="Tax lots" /></Card>
      )}
      <Card title="Recent Transactions" lead={data.bankFile ? "As the bank's files state them" : "From bank statements, recorded flows, capital calls and events"}
        action={<button type="button" onClick={() => setTab("transactions")} className="text-xs font-semibold text-primary-700 hover:underline">Full ledger</button>}>
        <Ledger data={data} limit={8} />
      </Card>
    </>
  );
}

const GROUPINGS = [
  ["assetClass", "Asset class"],
  ["entity", "Entity"],
  ["custodian", "Custodian"],
  ["currency", "Currency"],
  ["account", "Account"],
] as const;

type Grouping = (typeof GROUPINGS)[number][0];

const COLUMNS = [
  ["identifier", "Identifier"], ["entity", "Entity"], ["custodian", "Custodian"], ["currency", "Ccy"], ["quantity", "Quantity"],
  ["price", "Price"], ["value", "Market value"], ["weight", "Weight"], ["cost", "Cost basis"], ["unrealised", "Unrealised P&L"],
  ["pnl", "P&L %"], ["oneDay", "1D"], ["ytd", "YTD"], ["accrued", "Accrued"],
  ["bankCostPrice", "Bank's cost price"], ["bankCostTotal", "Bank's total cost"],
] as const;

type Column = (typeof COLUMNS)[number][0];

/** How many lines a group shows before the rest fold into "Other … (n)". */
const SHOWN_PER_GROUP = 8;

function keyOf(position: HoldingsPosition, by: Grouping) {
  const value = by === "assetClass" ? position.assetClassName : position[by];
  return value ?? "Not stated";
}

function Positions({ data, onPick, picked }: { data: ClientHoldingsBook; onPick: (one: HoldingsPosition) => void; picked: HoldingsPosition | null }) {
  const file = data.bankFile;
  const [by, setBy] = useState<Grouping>("assetClass");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [opened, setOpened] = useState<Set<string>>(new Set());
  const [hidden, setHidden] = useState<Set<Column>>(new Set(["accrued", "bankCostPrice", "bankCostTotal"]));
  const on = (column: Column) => !hidden.has(column);

  const options = useMemo(() => ({
    entity: unique(data.positions.map((one) => one.entity)),
    custodian: unique(data.positions.map((one) => one.custodian)),
    currency: unique(data.positions.map((one) => one.currency)),
    assetClassName: unique(data.positions.map((one) => one.assetClassName)),
    liquidity: unique(data.positions.map((one) => one.liquidity)),
  }), [data.positions]);
  const shown = data.positions.filter((one) =>
    Object.entries(filters).every(([field, value]) => !value || (one[field as keyof HoldingsPosition] ?? "Not stated") === value));
  const groups = new Map<string, HoldingsPosition[]>();
  shown.forEach((one) => {
    const key = keyOf(one, by);
    groups.set(key, [...(groups.get(key) ?? []), one]);
  });
  const columns = 1 + COLUMNS.filter(([id]) => on(id)).length;
  const filtered = Object.values(filters).some(Boolean);

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-ink-muted">Group by</span>
        <Toggle label="Group by" value={by} onChange={(next) => { setBy(next); setCollapsed(new Set()); setOpened(new Set()); }}
          options={GROUPINGS.filter(([id]) => !(file && id === "entity")).map(([id, label]) => [id, label])} />
        {!file && <Filter label="Entity" field="entity" values={options.entity} filters={filters} onChange={setFilters} />}
        <Filter label="Custodian" field="custodian" values={options.custodian} filters={filters} onChange={setFilters} />
        <Filter label="Currency" field="currency" values={options.currency} filters={filters} onChange={setFilters} />
        <Filter label={file ? "Bank's class" : "Asset class"} field="assetClassName" values={options.assetClassName} filters={filters} onChange={setFilters} />
        {!file && <Filter label="Liquidity" field="liquidity" values={options.liquidity} filters={filters} onChange={setFilters} />}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-xs text-ink-muted" title="No fund's own holdings are on file, so there is nothing to look through to">
          <input type="checkbox" disabled checked={false} readOnly />
          Fund look-through <span className="text-3xs">(no fund holdings on file)</span>
        </label>
        <ColumnsMenu hidden={hidden} onChange={setHidden} />
      </div>
      <div className="-mx-5 mt-3 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-y border-line text-left text-2xs font-semibold tracking-wider whitespace-nowrap text-ink-muted uppercase">
              <th scope="col" className="py-2 pr-3 pl-5">Position</th>
              {on("identifier") && <th scope="col" className="px-1.5 py-2">Identifier</th>}
              {on("entity") && <th scope="col" className="px-1.5 py-2">Entity</th>}
              {on("custodian") && <th scope="col" className="px-1.5 py-2">Custodian</th>}
              {on("currency") && <th scope="col" className="px-1.5 py-2">Ccy</th>}
              {on("quantity") && <th scope="col" className="px-1.5 py-2 text-right">Quantity</th>}
              {on("price") && <th scope="col" className="px-1.5 py-2 text-right">Price</th>}
              {on("value") && <th scope="col" className="px-1.5 py-2 text-right">Market value</th>}
              {on("weight") && <th scope="col" className="px-1.5 py-2 text-right">Weight</th>}
              {on("cost") && <th scope="col" className="px-1.5 py-2 text-right">Cost basis</th>}
              {on("unrealised") && <th scope="col" className="px-1.5 py-2 text-right">Unrealised P&amp;L</th>}
              {on("pnl") && <th scope="col" className="px-1.5 py-2 text-right">P&amp;L %</th>}
              {on("oneDay") && <th scope="col" className="px-1.5 py-2 text-right">1D</th>}
              {on("ytd") && <th scope="col" className="px-1.5 py-2 text-right">YTD</th>}
              {on("accrued") && <th scope="col" className="px-1.5 py-2 text-right">Accrued</th>}
              {on("bankCostPrice") && <th scope="col" className="px-1.5 py-2 text-right whitespace-normal">Bank's cost price</th>}
              {on("bankCostTotal") && <th scope="col" className="py-2 pr-5 pl-2 text-right whitespace-normal">Bank's total cost</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {groups.size === 0 && <tr><td colSpan={columns} className="px-5 py-8 text-center text-ink-muted">No line matches these filters.</td></tr>}
            {[...groups.entries()].map(([group, lines]) => {
              const closed = collapsed.has(group);
              const all = opened.has(group);
              const visible = all ? lines : lines.slice(0, SHOWN_PER_GROUP);
              const rest = lines.length - visible.length;
              return (
                <Fragment key={group}>
                  <GroupRow group={group} lines={lines} closed={closed} file={file} currency={data.currency} on={on}
                    summary={filtered ? undefined : data.groups.find((one) => one.grouping === GROUPING_KEYS[by] && one.key === group)}
                    onToggle={() => setCollapsed((was) => toggled(was, group))} />
                  {!closed && visible.map((one) => (
                    <tr key={one.id} onClick={() => onPick(one)}
                      className={cn("cursor-pointer hover:bg-slate-50", picked?.id === one.id && "bg-primary-50")}>
                      <td className="py-2 pr-3 pl-8 font-medium">{one.name}{one.subClass && <span className="block text-xs font-normal text-ink-muted">{one.subClass}</span>}</td>
                      {on("identifier") && <td className="px-1.5 py-2 font-mono text-xs text-ink-muted">{one.identifier ?? (file ? <NotInFile /> : "—")}</td>}
                      {on("entity") && <td className="px-1.5 py-2 text-xs">{file ? <NotInFile /> : one.entity ?? "—"}</td>}
                      {on("custodian") && <td className="px-1.5 py-2 text-xs">{one.custodian ?? "—"}</td>}
                      {on("currency") && <td className="px-1.5 py-2 text-xs">{one.currency ?? "—"}</td>}
                      {on("quantity") && <td className="px-1.5 py-2 text-right tabular-nums">{one.quantity == null ? (file ? <NotInFile /> : "—") : plain(one.quantity)}</td>}
                      {on("price") && <td className="px-1.5 py-2 text-right tabular-nums">{one.price == null ? (file ? <NotInFile /> : "—") : plain(one.price)}</td>}
                      {on("value") && (
                        <td className="px-1.5 py-2 text-right font-semibold whitespace-nowrap tabular-nums">
                          {file ? exact(one.value, one.currency ?? "") : compact(one.value, data.currency)}
                        </td>
                      )}
                      {on("weight") && <td className="px-1.5 py-2 text-right tabular-nums">{file ? <NotInFile /> : one.weight == null ? "—" : `${one.weight.toFixed(2)}%`}</td>}
                      {on("cost") && <td className="px-1.5 py-2 text-right whitespace-nowrap tabular-nums">{file ? <NotInFile /> : one.cost == null ? "—" : compact(one.cost, data.currency)}</td>}
                      {on("unrealised") && (
                        <td className={cn("px-1.5 py-2 text-right whitespace-nowrap tabular-nums", toneOf(one.unrealised ?? 0))}>
                          {file ? <NotInFile /> : one.unrealised == null ? "—" : signedCompact(one.unrealised, data.currency)}
                        </td>
                      )}
                      {on("pnl") && <td className={cn("px-1.5 py-2 text-right tabular-nums", toneOf(one.unrealisedPercent ?? 0))}>{file ? <NotInFile /> : signedPct(one.unrealisedPercent)}</td>}
                      {on("oneDay") && <td className={cn("px-1.5 py-2 text-right tabular-nums", toneOf(one.oneDay ?? 0))}>{file ? <NotInFile /> : signedPct(one.oneDay)}</td>}
                      {on("ytd") && <td className={cn("px-1.5 py-2 text-right tabular-nums", toneOf(one.yearToDate ?? 0))}>{file ? <NotInFile /> : signedPct(one.yearToDate)}</td>}
                      {on("accrued") && <td className="px-1.5 py-2 text-right tabular-nums">{one.accruedInterest == null ? (file ? <NotInFile /> : "—") : exact(one.accruedInterest, one.currency ?? "")}</td>}
                      {on("bankCostPrice") && (
                        <td className="px-1.5 py-2 text-right whitespace-nowrap tabular-nums">
                          {one.bankCostPrice == null ? (file ? <NotInFile /> : "—") : exact(one.bankCostPrice, one.currency ?? "")}
                        </td>
                      )}
                      {on("bankCostTotal") && (
                        <td className="py-2 pr-5 pl-2 text-right whitespace-nowrap tabular-nums">
                          {one.bankCostTotal == null ? (file ? <NotInFile /> : "—") : exact(one.bankCostTotal, one.currency ?? "")}
                        </td>
                      )}
                    </tr>
                  ))}
                  {!closed && rest > 0 && (
                    <tr>
                      <td colSpan={columns} className="py-2 pr-3 pl-8">
                        <button type="button" className="text-xs font-semibold text-primary-700 hover:underline"
                          onClick={() => setOpened((was) => toggled(was, group))}>
                          Other {group.toLowerCase()} positions ({rest})
                        </button>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {file || !data.total ? (
              <tr className="font-semibold">
                <td colSpan={columns} className="py-2 pr-3 pl-5">
                  Total · {shown.length} positions
                  {file ? ` · ${data.fileTotals.map((one) => exact(one.amount, one.currency)).join(" · ")} (per currency, not added together)` : ""}
                </td>
              </tr>
            ) : (
              <tr className="border-t border-line font-semibold">
                <th scope="row" className="py-2 pr-3 pl-5 text-left">Total · {data.positions.length} positions</th>
                {COLUMNS.filter(([id]) => on(id)).map(([id]) => (
                  <td key={id} className={cn("px-1.5 py-2 text-right whitespace-nowrap tabular-nums",
                    id === "unrealised" && toneOf(data.total!.unrealised ?? 0))}>
                    {id === "value" ? compact(data.total!.value, data.currency)
                      : id === "weight" ? "100.00%"
                      : id === "cost" ? (data.total!.cost == null ? "—" : compact(data.total!.cost, data.currency))
                      : id === "unrealised" ? (data.total!.unrealised == null ? "—" : signedCompact(data.total!.unrealised, data.currency))
                      : id === "pnl" ? signedPct(data.total!.unrealisedPercent)
                      : id === "oneDay" ? signedPct(data.total!.oneDay)
                      : id === "ytd" ? signedPct(data.total!.yearToDate) : ""}
                  </td>
                ))}
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {!file && filtered && <p className="mt-2 text-3xs text-ink-muted italic">Group totals are the server's for the whole table, so they are not shown while a filter is on.</p>}
      <p className="mt-2 text-3xs text-ink-muted italic">
        {file ? "Lines exactly as the bank's files state them, under the bank's own class labels. The bank's cost price and total cost are its own figures, in each line's currency; unrealised P&L is not in the bank file and is not worked out from them."
          : "Select a line to see its tax lots. Price is the value over the units held."}
      </p>
    </>
  );
}

/** The server's name for each way the table groups, to find its group rows. */
const GROUPING_KEYS: Record<Grouping, string> = {
  assetClass: "ASSET_CLASS", entity: "ENTITY", custodian: "CUSTODIAN", currency: "CURRENCY", account: "ACCOUNT",
};

/**
 * A group's own row, as the design draws it: its name and, from the server, what its lines add up to. A bank-file
 * client's group shows its lines' values per currency as sent, since they are never added across currencies.
 */
function GroupRow({ group, lines, closed, file, currency, on, summary, onToggle }: {
  group: string;
  lines: HoldingsPosition[];
  closed: boolean;
  file: boolean;
  currency: string;
  on: (column: Column) => boolean;
  summary: HoldingsGroup | undefined;
  onToggle: () => void;
}) {
  const perCurrency = () => {
    const sums = new Map<string, number>();
    lines.forEach((one) => sums.set(one.currency ?? "", (sums.get(one.currency ?? "") ?? 0) + one.value));
    return [...sums.entries()].map(([ccy, sum]) => <span key={ccy} className="block">{exact(sum, ccy)}</span>);
  };
  const g = summary;
  return (
    <tr className="bg-slate-50 font-semibold">
      <th scope="rowgroup" className="py-2 pr-3 pl-5 text-left">
        <button type="button" aria-expanded={!closed} className="flex items-center gap-1.5 text-sm font-semibold" onClick={onToggle}>
          {closed ? <ChevronRight className="size-4" aria-hidden="true" /> : <ChevronDown className="size-4" aria-hidden="true" />}
          {group}
        </button>
      </th>
      {COLUMNS.filter(([id]) => on(id)).map(([id]) => (
        <td key={id} className={cn("px-1.5 py-2 text-right whitespace-nowrap tabular-nums", id === "unrealised" && g && toneOf(g.unrealised ?? 0))}>
          {file ? (id === "value" ? perCurrency() : "")
            : !g ? ""
            : id === "value" ? compact(g.value, currency)
            : id === "weight" ? `${g.weight.toFixed(1)}%`
            : id === "cost" ? (g.cost == null ? "—" : compact(g.cost, currency))
            : id === "unrealised" ? (g.unrealised == null ? "—" : signedCompact(g.unrealised, currency))
            : id === "pnl" ? signedPct(g.unrealisedPercent)
            : id === "oneDay" ? signedPct(g.oneDay)
            : id === "ytd" ? signedPct(g.yearToDate) : ""}
        </td>
      ))}
    </tr>
  );
}

/** His banks, each with what its file lines add up to in each currency, as sent. */
function FileByBank({ data }: { data: ClientHoldingsBook }) {
  const banks = new Map<string, Map<string, number>>();
  data.positions.forEach((one) => {
    const bank = banks.get(one.custodian ?? "Not stated") ?? new Map<string, number>();
    bank.set(one.currency ?? "", (bank.get(one.currency ?? "") ?? 0) + one.value);
    banks.set(one.custodian ?? "Not stated", bank);
  });
  if (banks.size === 0) return <FileBlock />;
  return (
    <ul className="divide-y divide-line text-sm">
      {[...banks.entries()].map(([bank, sums]) => (
        <li key={bank} className="flex items-start justify-between gap-3 py-2">
          <span>{bank}</span>
          <span className="text-right text-xs font-semibold tabular-nums">
            {[...sums.entries()].map(([ccy, sum]) => <span key={ccy} className="block">{exact(sum, ccy)}</span>)}
          </span>
        </li>
      ))}
    </ul>
  );
}

function FileBlock() {
  return <p className="rounded-xl border border-dashed border-line px-4 py-8 text-center"><NotInFile /></p>;
}

function matchedShare(summary: ClientHoldingsCheck["summary"]) {
  const compared = summary.matching + summary.differing + summary.onlyAtBank + summary.notAtBank;
  return compared === 0 ? "—" : `${((summary.matching * 100) / compared).toFixed(1)}%`;
}

/** How many breaks, and what they come to in each currency they are in, as the check sends them: never added across. */
function breaksNote(summary: ClientHoldingsCheck["summary"]): ReactNode {
  const breaks = summary.differing + summary.onlyAtBank + summary.notAtBank;
  if (breaks === 0) return "No breaks";
  return (
    <span className="flex flex-wrap gap-x-1">
      <span>{breaks} {breaks === 1 ? "break" : "breaks"}</span>
      {summary.breaks.map((one) => (
        <span key={one.currency} className="whitespace-nowrap">· {compact(one.amount, one.currency)}</span>
      ))}
    </span>
  );
}

function signedPct(value: number | null | undefined) {
  if (value == null) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function LotsTable({ data, position }: { data: ClientHoldingsBook; position: HoldingsPosition | null }) {
  const names = new Map(data.positions.map((one) => [one.id, one.name]));
  const lots = position ? data.lots.filter((one) => one.positionId === position.id) : data.lots;
  const cur = data.currency;
  if (lots.length === 0) return <Empty>{position ? "No tax lots are on file for this line." : "No tax lots on file."}</Empty>;
  return (
    <div className="-mx-5 overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-y border-line text-left text-2xs font-semibold tracking-wider whitespace-nowrap text-ink-muted uppercase">
            <th scope="col" className="py-2 pr-3 pl-5">Lot</th>
            {!position && <th scope="col" className="px-2 py-2">Position</th>}
            <th scope="col" className="px-2 py-2">Acquired</th>
            <th scope="col" className="px-2 py-2">Account</th>
            <th scope="col" className="px-2 py-2 text-right">Qty</th>
            <th scope="col" className="px-2 py-2 text-right">Unit cost</th>
            <th scope="col" className="px-2 py-2 text-right">Cost basis</th>
            <th scope="col" className="px-2 py-2 text-right">Market value</th>
            <th scope="col" className="px-2 py-2 text-right">Unrealised</th>
            <th scope="col" className="py-2 pr-5 pl-2">Term</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {lots.map((one) => (
            <tr key={`${one.positionId}-${one.lotRef}`}>
              <td className="py-2 pr-3 pl-5 font-mono text-xs">{one.lotRef}</td>
              {!position && <td className="px-2 py-2">{names.get(one.positionId) ?? "—"}</td>}
              <td className="px-2 py-2 whitespace-nowrap">{formatDate(one.acquiredOn)}</td>
              <td className="px-2 py-2 text-xs">{one.account ?? "—"}</td>
              <td className="px-2 py-2 text-right tabular-nums">{one.quantity == null ? "—" : plain(one.quantity)}</td>
              <td className="px-2 py-2 text-right tabular-nums">{one.unitCost == null ? "—" : plain(one.unitCost)}</td>
              <td className="px-2 py-2 text-right tabular-nums">{compact(one.cost, cur)}</td>
              <td className="px-2 py-2 text-right tabular-nums">{compact(one.marketValue, cur)}</td>
              <td className={cn("px-2 py-2 text-right tabular-nums", toneOf(one.unrealised))}>{signedCompact(one.unrealised, cur)}</td>
              <td className="py-2 pr-5 pl-2"><Pill tone={one.term === "LONG" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-ink-soft"}>{one.term === "LONG" ? "Long-term" : "Short-term"}</Pill></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Ledger({ data, limit }: { data: ClientHoldingsBook; limit: number | null }) {
  const rows = limit == null ? data.transactions : data.transactions.slice(0, limit);
  if (rows.length === 0) return <Empty>{data.bankFile ? <NotInFile /> : "No movements on file."}</Empty>;
  return (
    <div className="-mx-5 overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-y border-line text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
            <th scope="col" className="py-2 pr-3 pl-5">Date</th>
            <th scope="col" className="px-2 py-2">Type</th>
            <th scope="col" className="px-2 py-2">Security</th>
            <th scope="col" className="px-2 py-2">Entity</th>
            <th scope="col" className="py-2 pr-5 pl-2 text-right">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((one, at) => (
            <tr key={`${one.on}-${at}`}>
              <td className="py-2 pr-3 pl-5 whitespace-nowrap text-ink-muted">{formatDate(one.on)}</td>
              <td className="px-2 py-2"><Pill tone="bg-slate-100 text-ink-soft">{one.type}</Pill></td>
              <td className="px-2 py-2">{one.description}</td>
              <td className="px-2 py-2 text-xs text-ink-soft" title={one.account ?? undefined}>
                {data.bankFile ? <NotInFile /> : one.entity ?? "—"}
              </td>
              <td className={cn("py-2 pr-5 pl-2 text-right font-semibold whitespace-nowrap tabular-nums", toneOf(one.amount))}>
                {data.bankFile ? exact(one.amount, one.currency) : signedCompact(one.amount, one.currency)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Actions({ data }: { data: ClientHoldingsBook }) {
  if (data.corporateActions.length === 0) return <Empty>No corporate actions on file.</Empty>;
  const tone = (status: string) => (status === "ANNOUNCED" ? "bg-amber-50 text-amber-700" : status === "ELECTED" ? "bg-primary-50 text-primary-700" : "bg-emerald-50 text-emerald-700");
  return (
    <div className="-mx-5 overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-y border-line text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
            <th scope="col" className="py-2 pr-3 pl-5">Security</th>
            <th scope="col" className="px-2 py-2">Action</th>
            <th scope="col" className="px-2 py-2">Ex-date</th>
            <th scope="col" className="px-2 py-2">Pay date</th>
            <th scope="col" className="px-2 py-2">Detail</th>
            <th scope="col" className="py-2 pr-5 pl-2">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {data.corporateActions.map((one, at) => (
            <tr key={`${one.security}-${at}`}>
              <td className="py-2 pr-3 pl-5 font-medium">{one.security}</td>
              <td className="px-2 py-2">{titleCase(one.kind)}</td>
              <td className="px-2 py-2 whitespace-nowrap">{formatDate(one.exDate)}</td>
              <td className="px-2 py-2 whitespace-nowrap">{one.payDate ? formatDate(one.payDate) : "—"}</td>
              <td className="px-2 py-2 text-ink-soft">{one.detail ?? "—"}</td>
              <td className="py-2 pr-5 pl-2"><Pill tone={tone(one.status)}>{titleCase(one.status)}</Pill></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------------------------------------------------ */
/* Small pieces                                                                                                  */

function Filter({ label, field, values, filters, onChange }: {
  label: string;
  field: string;
  values: string[];
  filters: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
}) {
  return (
    <SelectInput aria-label={label} value={filters[field] ?? ""} className="h-8 w-auto min-w-32"
      onChange={(event) => onChange({ ...filters, [field]: event.target.value })}>
      <option value="">{label}: All</option>
      {values.map((one) => <option key={one} value={one}>{label}: {one}</option>)}
    </SelectInput>
  );
}

function ColumnsMenu({ hidden, onChange }: { hidden: Set<Column>; onChange: (next: Set<Column>) => void }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (event: MouseEvent) => {
      if (box.current && !box.current.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  return (
    <div ref={box} className="relative">
      <Button variant="secondary" size="sm" aria-expanded={open} onClick={() => setOpen(!open)}>
        <Columns3 aria-hidden="true" />
        Columns
      </Button>
      {open && (
        <div className="absolute left-0 z-20 mt-1 w-48 rounded-xl border border-line bg-white p-2 shadow-lg">
          {COLUMNS.map(([id, label]) => (
            <label key={id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-slate-50">
              <input type="checkbox" checked={!hidden.has(id)} onChange={() => onChange(toggled(hidden, id))} />
              {label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function toggled<T>(set: Set<T>, value: T) {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

function Card({ title, lead, action, children }: { title: string; lead?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col rounded-2xl border border-line bg-white p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">{title}</h2>
          {lead && <p className="mt-0.5 text-xs text-ink-muted">{lead}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Kpi({ label, value, note, tone }: { label: string; value: ReactNode; note: ReactNode; tone?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-white px-4 py-3.5">
      <p className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">{label}</p>
      <p className={cn("mt-1.5 text-2xl font-bold tabular-nums", tone)}>{value}</p>
      {note && <div className="mt-1 text-xs text-ink-muted">{note}</div>}
    </div>
  );
}

function Toggle<T extends string>({ label, value, onChange, options }: { label: string; value: T; onChange: (value: T) => void; options: [T, string][] }) {
  return (
    <div role="group" aria-label={label} className="flex rounded-lg border border-line p-0.5">
      {options.map(([id, name]) => (
        <button key={id} type="button" onClick={() => onChange(id)} aria-pressed={value === id}
          className={cn("rounded-md px-2.5 py-1 text-xs font-semibold whitespace-nowrap",
            value === id ? "bg-primary-50 text-primary-700 ring-1 ring-primary-200" : "text-ink-soft hover:bg-slate-50")}>
          {name}
        </button>
      ))}
    </div>
  );
}

function FileNote({ what }: { what: string }) {
  return <p className="py-6 text-center text-sm text-ink-muted">{what}: <NotInFile /></p>;
}

function Pill({ tone, children }: { tone: string; children: ReactNode }) {
  return <span className={cn("inline-block rounded-md px-2 py-0.5 text-2xs font-semibold whitespace-nowrap", tone)}>{children}</span>;
}

function Marker({ children }: { children: ReactNode }) {
  return (
    <span className="inline-block w-fit rounded-sm border border-dashed border-line px-1 text-3xs font-medium whitespace-nowrap text-ink-muted">
      {children}
    </span>
  );
}

/** Wraps onto two short lines, so the bank-file client's many unfilled columns do not widen the table. */
function NotInFile() {
  return (
    <span className="inline-block max-w-14 rounded-sm border border-dashed border-line px-1 text-left text-3xs leading-tight font-medium text-ink-muted">
      not in bank file
    </span>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="py-8 text-center text-sm text-ink-muted">{children}</p>;
}

function unique(values: (string | null | undefined)[]) {
  return [...new Set(values.map((one) => one ?? "Not stated"))].sort((a, b) => a.localeCompare(b));
}

function compact(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, notation: "compact", maximumFractionDigits: 2 }).format(amount);
  } catch {
    return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 }).format(amount);
  }
}

function signedCompact(amount: number, currency: string) {
  return `${amount > 0 ? "+" : ""}${compact(amount, currency)}`;
}

/** A bank's figure in full, as the bank wrote it. */
function exact(amount: number, currency: string) {
  return `${currency} ${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 8 })}`.trim();
}

function plain(value: number) {
  return value.toLocaleString("en-US", { maximumFractionDigits: 8 });
}

function toneOf(value: number) {
  return value > 0 ? "text-emerald-700" : value < 0 ? "text-red-700" : undefined;
}

function titleCase(text: string) {
  return text.toLowerCase().replace(/_/g, " ").replace(/^\w/, (first) => first.toUpperCase());
}
