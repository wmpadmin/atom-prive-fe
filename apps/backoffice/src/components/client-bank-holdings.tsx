import { ApiError } from "@atomprive/api-client";
import { useGetClientBanks, type ClientBankLine, type ClientBanks } from "@atomprive/api-client/backoffice";
import { cn } from "@atomprive/ui";
import { Check, ChevronDown, ChevronRight } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { formatDate } from "../lib/labels";
import { ColumnPicker } from "./column-picker";
import { FileViewToggle, type FileView } from "./converted-usd";
import { useInShownCurrency, useShownCurrency } from "./shown-currency";

const NOT_STATED = "Not stated in the file";

/** What a bank puts under ISIN that is no identifier: words ("Cash Account") or a plain line number. */
const NOT_AN_IDENTIFIER = /^(\d+|[A-Za-z][A-Za-z\s/&.-]*)$/;

type Group = { key: string; name: string; level: number; lines: ClientBankLine[]; children: Group[] };

/** The columns a reader can take off (25 Nov 2026); the name stays, as it says what each row is. */
type Column = "bank" | "isin" | "ccy" | "holding" | "price" | "value" | "share";
const COLUMNS: { id: Column; label: string }[] = [
  { id: "bank", label: "Bank" },
  { id: "isin", label: "ISIN" },
  { id: "ccy", label: "CCY" },
  { id: "holding", label: "Holding" },
  { id: "price", label: "Last price" },
  { id: "value", label: "Market value" },
  { id: "share", label: "%" },
];
const EVERY_COLUMN: ReadonlySet<string> = new Set(COLUMNS.map((one) => one.id));

function money(value: number) {
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function short(value: number) {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}m`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return value.toFixed(0);
}

function plain(value: number | null | undefined) {
  return value == null ? "" : value.toLocaleString("en-US", { maximumFractionDigits: 4 });
}

/**
 * Holdings by bank: every bank the client holds at — those whose files come by feed, and the holdings Excel files
 * uploaded as his — with a selector to read one bank, several or all. The lines are grouped by asset class, product
 * type and sub-asset class, a fed bank's classes named as the Excel files name theirs. Draws nothing for a client
 * with no bank.
 */
export function ClientBankHoldings({ customerId }: { customerId: string }) {
  const query = useGetClientBanks<ClientBanks, ApiError>(customerId, { query: { enabled: !!customerId } });
  const [chosen, setChosen] = useState<Set<string> | null>(null);
  const [view, setView] = useState<FileView>("converted");
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [shown, setShown] = useState<ReadonlySet<string>>(EVERY_COLUMN);
  const on = (column: Column) => shown.has(column);
  // Its dollar figures in the currency picked at the top of the client's screens (25 Nov 2026).
  const data = useInShownCurrency(query.data);
  const { code } = useShownCurrency();

  const banks = useMemo(() => data?.banks ?? [], [data]);
  const picked = useMemo(() => chosen ?? new Set(banks.map((one) => one.key)), [chosen, banks]);
  const lines = useMemo(() => (data?.lines ?? []).filter((one) => picked.has(one.bank)), [data, picked]);
  const total = lines.reduce((sum, one) => sum + (one.marketValueUsd ?? 0), 0);

  const tree = useMemo(() => {
    const levels: ((line: ClientBankLine) => string | null | undefined)[] = [
      (line) => line.assetClass, (line) => line.productType, (line) => line.subAssetClass,
    ];
    const worth = (some: ClientBankLine[]) => some.reduce((sum, one) => sum + (one.marketValueUsd ?? 0), 0);
    function group(some: ClientBankLine[], level: number, parent: string): Group[] {
      if (level >= levels.length) return [];
      const named = new Map<string, ClientBankLine[]>();
      for (const line of some) {
        const label = levels[level]?.(line)?.trim() || NOT_STATED;
        named.set(label, [...(named.get(label) ?? []), line]);
      }
      return [...named.entries()]
        .map(([label, own]) => ({ key: `${parent}/${label}`, name: label, level, lines: own, children: group(own, level + 1, `${parent}/${label}`) }))
        .sort((a, b) => worth(b.lines) - worth(a.lines));
    }
    return group(lines, 0, "");
  }, [lines]);

  if (!data || banks.length === 0) return null;

  function toggleBank(key: string) {
    // From the choice as it stands when React applies it, so two quick clicks both count.
    setChosen((before) => {
      const next = new Set(before ?? banks.map((one) => one.key));
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleGroup(key: string) {
    const next = new Set(open);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setOpen(next);
  }

  const chosenNames = banks.filter((one) => picked.has(one.key)).map((one) => one.name);

  /** A column a group's lines all share shows it; one they differ in shows a dash. */
  function shared(some: ClientBankLine[], of: (line: ClientBankLine) => string | null | undefined): ReactNode {
    const values = new Set(some.map((line) => of(line) ?? ""));
    if (values.size === 1) return [...values][0] ?? "";
    return <span title="Differs between the lines in this group" className="text-ink-muted">—</span>;
  }

  function isin(text: string | null | undefined): ReactNode {
    if (!text) return "";
    if (NOT_AN_IDENTIFIER.test(text.trim())) {
      return <span title={`Not an identifier. The bank's file says “${text}”.`} className="text-ink-muted">—</span>;
    }
    return <span className="font-mono text-xs">{text}</span>;
  }

  function value(line: ClientBankLine): ReactNode {
    if (view === "bank") return line.asSent == null ? "" : `${line.asSentCurrency ?? ""} ${money(line.asSent)}`;
    if (line.marketValueUsd == null) return <span className="text-xs text-amber-700">no FX rate</span>;
    return (
      <>
        {money(line.marketValueUsd)}
        {line.asSentCurrency && line.asSentCurrency !== code && line.asSent != null && (
          <span className="block text-2xs text-ink-muted">{line.asSentCurrency} {money(line.asSent)}</span>
        )}
      </>
    );
  }

  function groupValue(some: ClientBankLine[]): ReactNode {
    const usd = some.reduce((sum, one) => sum + (one.marketValueUsd ?? 0), 0);
    if (view === "converted") return money(usd);
    const currencies = new Set(some.map((one) => one.asSentCurrency));
    if (currencies.size === 1) {
      return `${[...currencies][0] ?? ""} ${money(some.reduce((sum, one) => sum + (one.asSent ?? 0), 0))}`;
    }
    return <span title="Several currencies, not added together in the bank view" className="text-ink-muted">—</span>;
  }

  function share(some: ClientBankLine[]) {
    if (total === 0) return "";
    return `${((some.reduce((sum, one) => sum + (one.marketValueUsd ?? 0), 0) / total) * 100).toFixed(2)}%`;
  }

  function rows(groups: Group[]): ReactNode[] {
    return groups.flatMap((group) => {
      const isOpen = open.has(group.key);
      const row = (
        <tr key={group.key} onClick={() => toggleGroup(group.key)}
          className={cn("cursor-pointer hover:bg-primary-50/60", group.level === 0 ? "bg-canvas font-bold" : "font-semibold")}>
          <th scope="row" className="py-2.5 pr-3 text-left" style={{ paddingLeft: `${1.25 + group.level * 1.5}rem` }}>
            <button type="button" aria-expanded={isOpen} className="inline-flex items-center gap-1.5 text-left whitespace-nowrap hover:text-primary-700">
              {isOpen ? <ChevronDown aria-hidden="true" className="size-4 shrink-0" /> : <ChevronRight aria-hidden="true" className="size-4 shrink-0" />}
              {group.name}
            </button>
          </th>
          {on("bank") && <td className="px-3 py-2.5 font-normal whitespace-nowrap">{shared(group.lines, (one) => one.bank)}</td>}
          {on("isin") && <td className="px-3 py-2.5 font-normal">{shared(group.lines, () => "")}</td>}
          {on("ccy") && <td className="px-3 py-2.5 font-normal">{shared(group.lines, (one) => one.currency)}</td>}
          {on("holding") && <td className="px-3 py-2.5" />}
          {on("price") && <td className="px-3 py-2.5" />}
          {on("value") && <td className="px-3 py-2.5 text-right whitespace-nowrap tabular-nums">{groupValue(group.lines)}</td>}
          {on("share") && <td className="py-2.5 pr-5 pl-3 text-right tabular-nums">{share(group.lines)}</td>}
        </tr>
      );
      if (!isOpen) return [row];
      if (group.children.length > 0) return [row, ...rows(group.children)];
      return [row, ...group.lines.map((line, index) => (
        <tr key={`${group.key}#${line.bank}#${index}`}>
          <th scope="row" className="py-2 pr-3 text-left font-normal" style={{ paddingLeft: `${1.25 + (group.level + 1) * 1.5 + 1.375}rem` }}>
            {line.name}
          </th>
          {on("bank") && <td className="px-3 py-2 whitespace-nowrap">{line.bank}</td>}
          {on("isin") && <td className="px-3 py-2">{isin(line.isin)}</td>}
          {on("ccy") && <td className="px-3 py-2">{line.currency ?? ""}</td>}
          {on("holding") && <td className="px-3 py-2 text-right tabular-nums">{plain(line.holding)}</td>}
          {on("price") && <td className="px-3 py-2 text-right tabular-nums">{plain(line.lastPrice)}</td>}
          {on("value") && <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums">{value(line)}</td>}
          {on("share") && <td className="py-2 pr-5 pl-3 text-right tabular-nums">{line.marketValueUsd == null || total === 0 ? "" : `${((line.marketValueUsd / total) * 100).toFixed(2)}%`}</td>}
        </tr>
      ))];
    });
  }

  const missing = banks.filter((one) => picked.has(one.key) && one.noRate.length > 0);

  return (
    <section aria-labelledby="client-banks-title" className="rounded-2xl border border-line bg-white p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="client-banks-title" className="text-lg font-bold">Holdings by bank</h2>
          <p className="mt-0.5 text-xs text-ink-muted">
            {banks.length} {banks.length === 1 ? "bank" : "banks"} · each bank's latest file · pick one bank, several or all
            {data.ratesOn ? ` · fed banks converted at the FX rates of ${formatDate(data.ratesOn)}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ColumnPicker columns={COLUMNS} shown={shown} onChange={setShown} onReset={shown.size < EVERY_COLUMN.size ? () => setShown(EVERY_COLUMN) : undefined} />
          <FileViewToggle value={view} onChange={setView} />
        </div>
      </div>

      <div className="rounded-xl border border-line p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-sm font-semibold">Banks</span>
          <span className="flex gap-3 text-xs font-semibold">
            <button type="button" onClick={() => setChosen(null)} className="text-primary-600 hover:text-primary-700">Select all</button>
            <button type="button" onClick={() => setChosen(new Set())} className="text-primary-600 hover:text-primary-700">Clear</button>
          </span>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {banks.map((bank) => {
            const on = picked.has(bank.key);
            return (
              <button key={bank.key} type="button" role="checkbox" aria-checked={on} onClick={() => toggleBank(bank.key)}
                className={cn("rounded-lg border px-3 py-2 text-left transition-colors",
                  on ? "border-primary-600 bg-primary-50" : "border-line hover:border-primary-200")}>
                <span className={cn("flex items-center gap-2 text-sm font-semibold", on ? "text-primary-700" : "text-ink")}>
                  <span className={cn("flex size-4 shrink-0 items-center justify-center rounded border", on ? "border-primary-600 bg-primary-600 text-white" : "border-line")}>
                    {on && <Check aria-hidden="true" className="size-3" />}
                  </span>
                  <span className="truncate">{bank.name}</span>
                </span>
                <span className="mt-0.5 block text-xs text-ink-muted">
                  {code} {short(bank.totalUsd)} · {bank.source === "FEED" ? "bank feed" : "Excel"}
                  {bank.asOf ? ` · ${formatDate(bank.asOf)}` : ""}
                </span>
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-ink-muted">
          Showing <span className="font-semibold text-ink">{chosenNames.length} of {banks.length} banks</span>
          {chosenNames.length > 0 && <> · {code} {money(total)}</>}
        </p>
      </div>

      {missing.map((bank) => (
        <p key={bank.key} className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {bank.name}: {bank.noRate.join(", ")} {bank.noRate.length === 1 ? "has" : "have"} no FX rate, so those lines are in no {code} total.
        </p>
      ))}

      {lines.length === 0 ? (
        <p className="py-10 text-center text-sm text-ink-muted">Pick at least one bank to see its holdings.</p>
      ) : (
        <div className="-mx-5 mt-4 overflow-x-auto">
          <table className="min-w-full text-sm" data-own-columns>
            <thead>
              <tr className="border-y border-line bg-canvas text-left text-2xs font-semibold tracking-wider whitespace-nowrap text-ink-muted uppercase">
                <th scope="col" className="min-w-72 py-3 pr-3 pl-5">Name</th>
                {on("bank") && <th scope="col" className="px-3 py-3">Bank</th>}
                {on("isin") && <th scope="col" className="px-3 py-3">ISIN</th>}
                {on("ccy") && <th scope="col" className="px-3 py-3">CCY</th>}
                {on("holding") && <th scope="col" className="px-3 py-3 text-right">Holding</th>}
                {on("price") && <th scope="col" className="px-3 py-3 text-right">Last price</th>}
                {on("value") && <th scope="col" className="px-3 py-3 text-right">{view === "converted" ? `Market value ${code}` : "Value as sent"}</th>}
                {on("share") && <th scope="col" className="py-3 pr-5 pl-3 text-right">%</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">{rows(tree)}</tbody>
            <tfoot>
              <tr className="border-t-2 border-line font-bold">
                <th scope="row" className="py-3 pr-3 pl-5 text-left"
                  colSpan={1 + (["bank", "isin", "ccy", "holding", "price"] as Column[]).filter(on).length}>Total · {chosenNames.join(" + ")}</th>
                {on("value") && <td className="px-3 py-3 text-right whitespace-nowrap tabular-nums">{groupValue(lines)}</td>}
                {on("share") && <td className="py-3 pr-5 pl-3 text-right tabular-nums">100.00%</td>}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      <p className="mt-3 text-xs text-ink-muted">
        Grouped by Asset Class, then Product Type, then Sub-Asset Class 1. A bank feed's own classes are shown under the Excel files' names
        (EQUITIES as Equity, BONDS as Fixed Income, CASH AND CASH EQUIVALENTS as Cash &amp; Cash Equivalents, Miscellaneous as Alternative);
        a feed states no product type or sub-asset class. The Excel files state every line in USD.
      </p>
    </section>
  );
}
