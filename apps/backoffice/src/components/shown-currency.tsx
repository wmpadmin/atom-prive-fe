import { ApiError } from "@atomprive/api-client";
import { useGetClientWorkspace, useListShownCurrencies, type ClientWorkspace } from "@atomprive/api-client/backoffice";
import { cn } from "@atomprive/ui";
import { Check, ChevronDown } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocation } from "react-router";

/**
 * The currency a client's figures are shown in (25 Nov 2026, the user's design): their own unless somebody picks
 * another at the top of that client's portfolio screens, and then every money figure on every one of those screens, for
 * that client only. Bank view stays the bank's own figures, as sent.
 *
 * <p>A bank-file client's lines come converted to dollars at the latest rate in FX rates, with every currency's rate, so
 * another currency is the same dollars at its rate and nothing is asked of the server again. Every other client's
 * screens are asked of the server in the currency picked, which restates their money figures itself. The choice is
 * kept in this browser, client by client.
 */

const KEPT = "atomprive.clientCurrency";

type Chosen = Record<string, string>;

const ShownCurrencyContext = createContext<{ chosen: Chosen; choose: (customerId: string, code: string) => void } | null>(null);

function read(): Chosen {
  try {
    const kept = JSON.parse(localStorage.getItem(KEPT) ?? "{}") as unknown;
    return kept && typeof kept === "object" ? (kept as Chosen) : {};
  } catch {
    return {};
  }
}

/** Holds each client's chosen currency, for the top bar and the screens under it. */
export function ShownCurrencyProvider({ children }: { children: ReactNode }) {
  const [chosen, setChosen] = useState<Chosen>(read);
  const choose = useCallback((customerId: string, code: string) => {
    setChosen((was) => {
      const next = { ...was, [customerId]: code };
      try {
        localStorage.setItem(KEPT, JSON.stringify(next));
      } catch {
        // Kept for this visit only where the browser keeps nothing.
      }
      return next;
    });
  }, []);
  const value = useMemo(() => ({ chosen, choose }), [chosen, choose]);
  return <ShownCurrencyContext.Provider value={value}>{children}</ShownCurrencyContext.Provider>;
}

/** The client whose portfolio screens are open, from the address; none elsewhere. */
function useOpenClient(): string | null {
  const { pathname } = useLocation();
  return /^\/client-workspace\/([^/]+)/.exec(pathname)?.[1] ?? null;
}

/** The open client's Overview as it is, in their own currency: whether their figures are a bank's file, and in what. */
function useOwnWorkspace(customerId: string | null) {
  return useGetClientWorkspace<ClientWorkspace, ApiError>(customerId ?? "", undefined, { query: { enabled: Boolean(customerId) } });
}

/** The rates the server sends with a bank-file client's converted figures: units of each currency one dollar buys. */
function useRates(customerId: string | null): Record<string, number> | null {
  const workspace = useOwnWorkspace(customerId);
  return (workspace.data?.bankFile?.converted.perUsd as Record<string, number> | undefined) ?? null;
}

/**
 * The currency to ask the server for the open client's screens in: one picked for a client whose figures are not a
 * bank's file, where it is not their own; nothing otherwise, and the screens come in their own currency.
 */
export function useServerCurrency(): string | undefined {
  const customerId = useOpenClient();
  const workspace = useOwnWorkspace(customerId);
  const chosen = useContext(ShownCurrencyContext)?.chosen;
  const code = customerId ? chosen?.[customerId] : undefined;
  if (!code || !workspace.data || workspace.data.bankFile || code === workspace.data.currency) return undefined;
  return code;
}

/** The open client's screens' query parameter: the currency to ask for, or none to ask for their own. */
export function useCurrencyParam(): { currency: string } | undefined {
  const currency = useServerCurrency();
  return currency ? { currency } : undefined;
}

/**
 * The currency the open client's converted figures are shown in, and how many of it one dollar buys; US dollars, at
 * one, wherever no client is open or the currency has no rate.
 */
export function useShownCurrency(): { code: string; perUsd: number } {
  const customerId = useOpenClient();
  const rates = useRates(customerId);
  const chosen = useContext(ShownCurrencyContext)?.chosen;
  const code = customerId ? chosen?.[customerId] ?? "USD" : "USD";
  const perUsd = code === "USD" ? 1 : rates?.[code];
  return perUsd ? { code, perUsd } : { code: "USD", perUsd: 1 };
}

const round = (value: number) => Math.round(value * 100) / 100;

/**
 * A response with every converted figure in it restated from dollars into the chosen currency: the converted reading
 * of the bank's lines (its totals, slices, lines and history, and the rates it reads other currencies at), a holdings
 * cost, and a bank's dollar totals and lines. What the bank sent, as sent, is left alone.
 */
export function restated<T>(data: T, code: string, perUsd: number): T {
  const walk = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(walk);
    if (!node || typeof node !== "object") return node;
    const one = node as Record<string, unknown>;
    // The converted reading of the bank's lines: its currency, its rates and every dollar figure in it.
    if (typeof one.currency === "string" && one.perUsd && typeof one.perUsd === "object" && typeof one.total === "number") {
      const slices = (list: unknown) => (Array.isArray(list) ? list.map((slice) => ({ ...slice, usd: round((slice as { usd: number }).usd * perUsd) })) : list);
      return {
        ...one,
        currency: code,
        total: round(one.total * perUsd),
        currencies: Array.isArray(one.currencies)
          ? one.currencies.map((each) => ({ ...each, usd: round(each.usd * perUsd), perUsd: each.perUsd / perUsd }))
          : one.currencies,
        byClass: slices(one.byClass),
        byCurrency: slices(one.byCurrency),
        top: slices(one.top),
        lines: slices(one.lines),
        history: Array.isArray(one.history) ? one.history.map((day) => ({ ...day, value: round((day as { value: number }).value * perUsd) })) : one.history,
        perUsd: Object.fromEntries(Object.entries(one.perUsd as Record<string, number>).map(([each, rate]) => [each, rate / perUsd])),
      };
    }
    // A bank-file client's fees, worked out by the server in dollars: what his rates come to, and what he paid.
    if (typeof one.currency === "string" && typeof one.grossAssets === "number" && typeof one.annualAmount === "number" && Array.isArray(one.paid)) {
      return {
        ...one,
        currency: code,
        grossAssets: round(one.grossAssets * perUsd),
        annualAmount: round(one.annualAmount * perUsd),
        paidAmount: typeof one.paidAmount === "number" ? round(one.paidAmount * perUsd) : one.paidAmount,
        rates: Array.isArray(one.rates) ? one.rates.map((rate) => ({ ...rate, annualAmount: round((rate as { annualAmount: number }).annualAmount * perUsd) })) : one.rates,
        paid: one.paid.map((fee) => {
          const amount = (fee as { amount: number | null }).amount;
          return { ...fee, amount: amount == null ? null : round(amount * perUsd) };
        }),
      };
    }
    // A bank-file client's IPS: the server measures his house classes against the bands in dollars, so each class's
    // value and deviation, and the screen's own currency, are restated with the lines under them.
    if (one.bankFile === true && Array.isArray(one.allocation) && one.converted && typeof one.currency === "string") {
      const scaled = (value: unknown) => (typeof value === "number" ? round(value * perUsd) : value);
      const rest = Object.fromEntries(Object.entries(one).map(([key, value]) => [key, walk(value)]));
      return {
        ...rest,
        currency: code,
        investable: scaled(one.investable),
        ownedOutright: scaled(one.ownedOutright),
        allocation: one.allocation.map((row) => ({
          ...row,
          value: scaled((row as { value: unknown }).value),
          deviationValue: scaled((row as { deviationValue: unknown }).deviationValue),
        })),
      };
    }
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(one)) {
      out[key] = (key === "costUsd" || key === "totalUsd" || key === "marketValueUsd") && typeof value === "number"
        ? round(value * perUsd)
        : (key === "byBank" || key === "unrealisedByClass") && Array.isArray(value)
          ? value.map((slice) => ({ ...slice, usd: round((slice as { usd: number }).usd * perUsd) }))
          : walk(value);
    }
    return out;
  };
  return walk(data) as T;
}

/** A screen's response in the open client's chosen currency: as it came, in dollars, until another is picked. */
export function useInShownCurrency<T>(data: T | undefined): T | undefined {
  const { code, perUsd } = useShownCurrency();
  return useMemo(() => (data === undefined || code === "USD" ? data : restated(data, code, perUsd)), [data, code, perUsd]);
}

const NAMES = (() => {
  try {
    return new Intl.DisplayNames(["en"], { type: "currency" });
  } catch {
    return null;
  }
})();

/**
 * The currency picker in the top bar, beside the workspace switch: drawn only on a client's portfolio screens, for
 * every client, with every currency FX rates holds a rate for.
 */
export function ClientCurrencySwitch() {
  const customerId = useOpenClient();
  const workspace = useOwnWorkspace(customerId);
  const rates = useRates(customerId);
  const kept = useContext(ShownCurrencyContext);
  const { code: bankCode } = useShownCurrency();
  // A client whose figures are not a bank's file: their own currency until another is picked, from FX rates' list.
  const listed = useListShownCurrencies<string[], ApiError>({ query: { enabled: Boolean(customerId && workspace.data && !workspace.data.bankFile) } });
  const own = workspace.data?.currency ?? "USD";
  const code = workspace.data?.bankFile ? bankCode : (customerId ? kept?.chosen[customerId] : undefined) ?? own;
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !menuRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  if (!customerId || !kept || !workspace.data) return null;
  const available = workspace.data.bankFile ? (rates ? Object.keys(rates) : []) : (listed.data ?? []);
  if (available.length === 0) return null;
  // The client's own currency first (the dollar for a bank-file client), then the rest by code.
  const first = workspace.data.bankFile ? "USD" : own;
  const codes = [first, ...available.filter((one) => one !== first).sort()];
  const name = (one: string) => NAMES?.of(one) ?? one;
  const found = codes.filter((one) => !search.trim() || `${one} ${name(one)}`.toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <div ref={menuRef} className="relative">
      <button type="button" aria-haspopup="listbox" aria-expanded={open} onClick={() => { setOpen((was) => !was); setSearch(""); }}
        title="The currency this client's converted figures are shown in"
        className="flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1.5 text-sm font-semibold text-ink hover:border-primary-300">
        <span className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">Currency</span>
        {code}
        <ChevronDown aria-hidden="true" className="size-4 text-ink-muted" />
      </button>
      {open && (
        <div className="absolute top-full left-0 z-40 mt-2 w-64 rounded-xl border border-line bg-white p-1.5 shadow-lg">
          <input autoFocus value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search currency"
            aria-label="Search currency" className="mb-1 w-full rounded-lg border border-line px-2.5 py-1.5 text-sm" />
          <ul role="listbox" aria-label="Currency" className="max-h-72 overflow-y-auto">
            {found.map((one) => (
              <li key={one} role="option" aria-selected={one === code}>
                <button type="button" onClick={() => { kept.choose(customerId, one); setOpen(false); }}
                  className={cn("flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm",
                    one === code ? "bg-primary-50 font-semibold text-primary-700" : "hover:bg-canvas")}>
                  <span className="flex items-center gap-2">
                    {one === code ? <Check aria-hidden="true" className="size-3.5" /> : <span className="size-3.5" />}
                    {one}
                  </span>
                  <span className="truncate text-xs text-ink-muted">{name(one)}</span>
                </button>
              </li>
            ))}
            {found.length === 0 && <li className="px-2.5 py-2 text-sm text-ink-muted">No currency matches.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
