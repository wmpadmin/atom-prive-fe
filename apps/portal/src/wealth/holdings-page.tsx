import { ApiError, httpFile } from "@atomprive/api-client";
import { getExportHoldingsUrl, useHoldings, type HoldingRow, type PortalHoldings } from "@atomprive/api-client/portal";
import { Button, Pagination, SelectInput } from "@atomprive/ui";
import { Building2, ChevronDown, Download, HandCoins, LineChart, Search, X, type LucideIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router";
import { PanelEdge } from "./panel-edge";

/**
 * Everything the client holds and owes, one line each: investments, things owned outright and loans. Searched and
 * filtered by asset class, opened one at a time in a side panel, and exported as the filtered list.
 *
 * <p>The account a holding sits in comes with the custodian feed; until then the column says so with a dash.
 */

const PAGE = 10;

/** How wide the details panel opens, and how far it may be dragged either way. */
const PANEL_OPENS = 448;
const PANEL_NARROWEST = 360;
const PANEL_KEY = "atomprive.portal.holdingPanelWidth";

function widest() {
  return Math.max(PANEL_NARROWEST, Math.min(900, window.innerWidth - 80));
}

/** The width the client last left the panel at, kept in this browser only. */
function rememberedWidth() {
  try {
    const kept = Number(window.localStorage.getItem(PANEL_KEY));
    return kept >= PANEL_NARROWEST ? Math.min(kept, widest()) : PANEL_OPENS;
  } catch {
    return PANEL_OPENS;
  }
}
const NOT_SENT = "Not sent by your bank yet";

const KIND_ICON: Record<string, LucideIcon> = { INVESTMENT: LineChart, OWNED: Building2, LOAN: HandCoins };

const countries = new Intl.DisplayNames(["en"], { type: "region" });

function countryName(code: string) {
  try {
    return countries.of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}

function amount(value: number) {
  const drawn = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 }).format(Math.abs(value));
  return value < 0 ? `(${drawn})` : drawn;
}

function quantity(value: number | null) {
  return value === null ? "—" : new Intl.NumberFormat("en-GB", { maximumFractionDigits: 4 }).format(value);
}

/** Excel, CSV or PDF, from a small menu under the button. */
export type Format = "xlsx" | "csv" | "pdf";

export function ExportMenu({ onPick, busy, formats = ["xlsx", "csv", "pdf"] }: { onPick: (format: Format) => void; busy: boolean; formats?: Format[] }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (event: MouseEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, [open]);
  return (
    <div ref={box} className="relative">
      <Button aria-haspopup="menu" aria-expanded={open} disabled={busy} onClick={() => setOpen((was) => !was)}>
        <Download aria-hidden="true" />
        {busy ? "Exporting…" : "Export"}
        <ChevronDown aria-hidden="true" />
      </Button>
      {open && (
        <div role="menu" className="absolute right-0 z-30 mt-2 w-44 rounded-xl border border-line bg-white p-1.5 shadow-lg">
          {(
            [
              ["xlsx", "Excel (.xlsx)"],
              ["csv", "CSV (.csv)"],
              ["pdf", "PDF (.pdf)"],
            ] as const
          )
            .filter(([format]) => formats.includes(format))
            .map(([format, label]) => (
            <button
              key={format}
              role="menuitem"
              type="button"
              onClick={() => {
                setOpen(false);
                onPick(format);
              }}
              className="block w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-ink-soft hover:bg-sidebar"
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className="text-right text-sm font-semibold text-ink">{children}</dd>
    </div>
  );
}

/** Credit rating, yield and duration belong to bonds, and only to bonds. */
const BONDS = "FIXED_INCOME";

/**
 * What is worth saying about one holding: only rows that have something in them, and the bond figures only for a
 * bond. A sub-class that merely repeats the holding's name says nothing new and is left off.
 */
function facts(row: HoldingRow, currency: string): [string, ReactNode][] {
  const all: [string, ReactNode | null][] = [
    [
      "Change this year",
      row.changeThisYear === null ? null : (
        <span key="change" className={row.changeThisYear >= 0 ? "text-access-full-ink" : "text-orange-600"}>
          {currency} {amount(row.changeThisYear)}
        </span>
      ),
    ],
    [row.kind === "OWNED" ? "What it is" : "Sub-class", row.subClass && row.subClass !== row.name ? row.subClass : null],
  ];
  if (row.kind === "INVESTMENT") {
    all.push(
      ["Quantity", row.units === null ? null : quantity(row.units)],
      ["Ticker", row.ticker],
      ["Country", row.countryCode ? countryName(row.countryCode) : null],
      ["Sector", row.sector],
    );
    if (row.assetClass === BONDS) {
      all.push(
        ["Credit rating", row.creditRating],
        ["Yield", row.yieldPercent === null ? null : `${row.yieldPercent.toFixed(2)}%`],
        ["Duration", row.durationYears === null ? null : `${row.durationYears.toFixed(2)} years`],
      );
    }
  }
  return all.filter((one): one is [string, ReactNode] => one[1] !== null && one[1] !== undefined && one[1] !== "");
}

/** One holding, everything the firm has on it, in a panel from the right. */
function HoldingPanel({ row, currency, onClose }: { row: HoldingRow; currency: string; onClose: () => void }) {
  useEffect(() => {
    const escape = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [onClose]);
  const [width, setWidth] = useState(rememberedWidth);
  const fit = useCallback((to: number) => Math.round(Math.min(widest(), Math.max(PANEL_NARROWEST, to))), []);
  const drag = useCallback((to: number) => setWidth(fit(to)), [fit]);
  const settle = useCallback(
    (to: number) => {
      const kept = fit(to);
      setWidth(kept);
      try {
        window.localStorage.setItem(PANEL_KEY, String(kept));
      } catch {
        // Nothing to keep it in; it opens at the usual width next time.
      }
    },
    [fit],
  );
  const Icon = KIND_ICON[row.kind] ?? LineChart;
  return (
    <div className="fixed inset-0 z-40">
      <button type="button" aria-label="Close" className="absolute inset-0 bg-brand-950/30" onClick={onClose} />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="holding-title"
        className="absolute inset-y-0 right-0 flex max-w-full flex-col bg-white shadow-2xl"
        style={{ width }}
      >
        <PanelEdge
          label="How wide the holding panel is"
          width={width}
          narrowest={PANEL_NARROWEST}
          widest={widest()}
          opensAt={PANEL_OPENS}
          onDrag={drag}
          onSettled={settle}
        />
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <div className="flex items-start gap-3 border-b border-line px-6 py-5">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
            <Icon aria-hidden="true" className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="holding-title" className="text-lg font-bold text-ink">
              {row.name}
            </h2>
            <p className="text-sm text-ink-muted">{row.assetClassName}</p>
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className="rounded-lg p-1.5 text-ink-muted hover:bg-sidebar">
            <X aria-hidden="true" className="size-4" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3 px-6 py-5">
          <div className="rounded-xl bg-sidebar p-4">
            <p className="text-xs text-ink-muted">Market value ({currency})</p>
            <p className={`mt-1 text-xl font-bold tabular-nums ${row.value < 0 ? "text-orange-600" : "text-ink"}`}>{amount(row.value)}</p>
          </div>
          <div className="rounded-xl bg-sidebar p-4">
            <p className="text-xs text-ink-muted">Weight</p>
            <p className="mt-1 text-xl font-bold text-ink tabular-nums">{row.share.toFixed(2)}%</p>
          </div>
        </div>
        <dl className="divide-y divide-line px-6 pb-6">
          {facts(row, currency).map(([label, value]) => (
            <Detail key={label} label={label}>
              {value}
            </Detail>
          ))}
        </dl>
        </div>
      </aside>
    </div>
  );
}

export function HoldingsPage() {
  const [params, setParams] = useSearchParams();
  const holdings = useHoldings<PortalHoldings, ApiError>();
  const [search, setSearch] = useState(params.get("q") ?? "");
  const assetClass = params.get("class") ?? "";
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState<HoldingRow | null>(null);
  const [exporting, setExporting] = useState(false);
  const [problem, setProblem] = useState<string>();

  const change = (key: string, value: string) => {
    setPage(0);
    setParams(
      (was) => {
        const next = new URLSearchParams(was);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );
  };

  const data = holdings.data;
  const wanted = search.trim().toLowerCase();
  const rows = (data?.rows ?? []).filter(
    (one) =>
      (!assetClass || one.assetClass === assetClass) &&
      (!wanted ||
        [one.name, one.subClass, one.identifier, one.ticker, one.assetClassName].some((text) => text?.toLowerCase().includes(wanted))),
  );
  const shown = rows.slice(page * PAGE, page * PAGE + PAGE);

  const exportAs = async (format: Format) => {
    setExporting(true);
    setProblem(undefined);
    try {
      const blob = await httpFile(getExportHoldingsUrl({ format, assetClass: assetClass || undefined, search: wanted || undefined }));
      const href = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = href;
      link.download = `Holdings ${new Date().toISOString().slice(0, 10)}.${format}`;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(href), 1_000);
    } catch (caught) {
      setProblem(caught instanceof ApiError ? caught.message : "The file could not be made. Try again.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[1.625rem] font-bold text-balance text-ink">Holdings</h1>
          <p className="mt-1 text-sm text-ink-muted">View your investments and asset holdings.</p>
        </div>
      </div>

      <section className="rounded-2xl border border-line bg-white p-5">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <label className="relative min-w-56 flex-1">
            <span className="sr-only">Search holdings</span>
            <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-muted" />
            <input
              id="holding-search"
              type="search"
              value={search}
              placeholder="Search holdings…"
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(0);
              }}
              className="h-10 w-full rounded-xl border border-line bg-white pr-3 pl-10 text-sm focus-visible:border-primary-600 focus-visible:outline-2 focus-visible:outline-primary-600"
            />
          </label>
          <SelectInput id="holding-class" aria-label="Asset class" value={assetClass} onChange={(event) => change("class", event.target.value)} className="w-56">
            <option value="">Asset class: All</option>
            {Object.entries(data?.classes ?? {}).map(([key, name]) => (
              <option key={key} value={key}>
                {name}
              </option>
            ))}
          </SelectInput>
          <div className="ml-auto">
            <ExportMenu onPick={(format) => void exportAs(format)} busy={exporting} />
          </div>
        </div>
        {problem && <p className="mb-3 text-sm text-access-none-ink">{problem}</p>}

        {holdings.isError ? (
          <p className="py-8 text-center text-sm text-access-none-ink">Your holdings could not be loaded. Refresh the page to try again.</p>
        ) : !data ? (
          <div className="h-72 animate-pulse rounded-xl bg-sidebar" />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead>
                  <tr className="border-y border-line text-left text-2xs font-semibold tracking-wider whitespace-nowrap text-ink-muted uppercase">
                    <th scope="col" className="py-3 pr-4 pl-3">Holding</th>
                    <th scope="col" className="px-4 py-3">Asset class</th>
                    <th scope="col" className="px-4 py-3">Account</th>
                    <th scope="col" className="px-4 py-3 text-right">Quantity</th>
                    <th scope="col" className="px-4 py-3 text-right">Market value ({data.currency})</th>
                    <th scope="col" className="py-3 pr-3 pl-4 text-right">Weight</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {shown.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-sm text-ink-muted">
                        {data.rows.length === 0 ? "No holdings recorded yet." : "No holdings match your search."}
                      </td>
                    </tr>
                  ) : (
                    shown.map((one) => {
                      const Icon = KIND_ICON[one.kind] ?? LineChart;
                      return (
                        <tr key={one.id} className="cursor-pointer hover:bg-sidebar" onClick={() => setOpen(one)}>
                          <td className="px-3 py-3">
                            <button type="button" onClick={() => setOpen(one)} className="flex items-center gap-3 text-left">
                              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
                                <Icon aria-hidden="true" className="size-4" />
                              </span>
                              <span className="min-w-0">
                                <span className="block font-semibold text-ink">{one.name}</span>
                                {one.subClass && one.subClass !== one.name && <span className="block text-xs text-ink-muted">{one.subClass}</span>}
                              </span>
                            </button>
                          </td>
                          <td className="px-3 py-3 text-ink-soft">{one.assetClassName}</td>
                          <td className="px-3 py-3 text-ink-muted" title={NOT_SENT}>
                            —
                          </td>
                          <td className="px-3 py-3 text-right text-ink-soft tabular-nums">{quantity(one.units)}</td>
                          <td className={`px-3 py-3 text-right font-semibold tabular-nums ${one.value < 0 ? "text-orange-600" : "text-ink"}`}>
                            {amount(one.value)}
                          </td>
                          <td className="px-3 py-3 text-right text-ink-soft tabular-nums">{one.share.toFixed(1)}%</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <div className="mt-4">
              <Pagination page={page} pageSize={PAGE} totalItems={rows.length} onPageChange={setPage} noun={["holding", "holdings"]} />
            </div>
          </>
        )}
      </section>
      {open && data && <HoldingPanel row={open} currency={data.currency} onClose={() => setOpen(null)} />}
    </div>
  );
}
