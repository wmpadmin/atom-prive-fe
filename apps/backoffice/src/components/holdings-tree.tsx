import { ApiError } from "@atomprive/api-client";
import { useGetHoldingHistory, type HoldingHistory } from "@atomprive/api-client/backoffice";
import { Dialog, cn } from "@atomprive/ui";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { formatDate } from "../lib/labels";

/** An amount in the currency it is written in. */
export type TreeAmount = { currency: string; value: number };

/**
 * One holding, as the tree places it: the levels it sits under (asset class, sub-class, sub-sub-class — whichever
 * are known, top first), and what it is worth, in each currency it is stated in.
 */
export type TreeLine = {
  key: string;
  customerId: string;
  name: string;
  isin?: string | null;
  positionId?: string | null;
  levels: string[];
  units?: number | null;
  amounts: TreeAmount[];
  /** Anything a screen shows at the end of the line, such as an answer's buttons. */
  trailing?: ReactNode;
};

type Node = { label: string; path: string; children: Node[]; lines: TreeLine[] };

function build(lines: TreeLine[]): Node {
  const root: Node = { label: "", path: "", children: [], lines: [] };
  for (const line of lines) {
    let at = root;
    for (const level of line.levels) {
      const path = `${at.path}/${level}`;
      let next = at.children.find((one) => one.label === level);
      if (!next) {
        next = { label: level, path, children: [], lines: [] };
        at.children.push(next);
      }
      at = next;
    }
    at.lines.push(line);
  }
  return root;
}

/** Everything under a node, added up currency by currency: a bank's lines are not converted to be summed. */
function totals(node: Node): TreeAmount[] {
  const sums = new Map<string, number>();
  const add = (one: Node) => {
    one.lines.forEach((line) => line.amounts.forEach((amount) => sums.set(amount.currency, (sums.get(amount.currency) ?? 0) + amount.value)));
    one.children.forEach(add);
  };
  add(node);
  return [...sums.entries()].map(([currency, value]) => ({ currency, value }));
}

function count(node: Node): number {
  return node.lines.length + node.children.reduce((sum, one) => sum + count(one), 0);
}

export function money(amount: TreeAmount) {
  return `${amount.currency ? `${amount.currency} ` : ""}${amount.value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Holdings as a tree that opens a level at a click: asset class, then sub-class, then sub-sub-class, then the
 * holdings themselves. A double-click on a holding opens its history, every day on file.
 */
export function HoldingsTree({ lines, empty = "No holdings on file yet.", note }: {
  lines: TreeLine[];
  empty?: string;
  note?: ReactNode;
}) {
  const root = useMemo(() => build(lines), [lines]);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [reading, setReading] = useState<TreeLine | null>(null);
  const toggle = (path: string) => setOpen((now) => {
    const next = new Set(now);
    if (next.has(path)) next.delete(path);
    else next.add(path);
    return next;
  });

  if (lines.length === 0) return <p className="py-8 text-center text-sm text-ink-muted">{empty}</p>;

  const rows: ReactNode[] = [];
  const walk = (node: Node, depth: number) => {
    for (const child of node.children) {
      const isOpen = open.has(child.path);
      rows.push(
        <tr key={child.path} className="cursor-pointer select-none hover:bg-slate-50" onClick={() => toggle(child.path)}>
          <th scope="row" className="py-2 pr-3 text-left font-normal" style={{ paddingLeft: `${16 + depth * 20}px` }}>
            <button type="button" aria-expanded={isOpen} className={cn("inline-flex items-center gap-1.5 text-left", depth === 0 ? "font-semibold" : "font-medium")}
              onClick={(event) => { event.stopPropagation(); toggle(child.path); }}>
              {isOpen ? <ChevronDown aria-hidden="true" className="size-4 text-ink-muted" /> : <ChevronRight aria-hidden="true" className="size-4 text-ink-muted" />}
              {child.label}
              <span className="text-xs font-normal text-ink-muted">· {count(child)}</span>
            </button>
          </th>
          <td className="px-3 py-2 text-right" />
          <td className="py-2 pr-4 pl-3 text-right whitespace-nowrap tabular-nums">
            {totals(child).map((amount) => <span key={amount.currency} className="block">{money(amount)}</span>)}
          </td>
          <td className="py-2 pr-4" />
        </tr>,
      );
      if (isOpen) walk(child, depth + 1);
    }
    for (const line of node.lines) {
      rows.push(
        <tr key={line.key} className="cursor-pointer select-none hover:bg-primary-50/50" title="Double-click for its history"
          onDoubleClick={() => setReading(line)}
          onKeyDown={(event) => { if (event.key === "Enter") setReading(line); }} tabIndex={0}>
          <th scope="row" className="py-2 pr-3 text-left font-normal" style={{ paddingLeft: `${16 + depth * 20 + 22}px` }}>
            <span className="block text-ink">{line.name}</span>
            {line.isin && <span className="block text-xs text-ink-muted">{line.isin}</span>}
          </th>
          <td className="px-3 py-2 text-right tabular-nums text-ink-muted">{line.units == null ? "" : line.units.toLocaleString("en-US")}</td>
          <td className="py-2 pr-4 pl-3 text-right whitespace-nowrap tabular-nums">
            {line.amounts.map((amount) => <span key={amount.currency} className="block">{money(amount)}</span>)}
          </td>
          <td className="py-2 pr-4 text-right">{line.trailing}</td>
        </tr>,
      );
    }
  };
  walk(root, 0);

  return (
    <>
      <div className="-mx-5 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-y border-line text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
              <th scope="col" className="py-2 pr-3 pl-4">Holding</th>
              <th scope="col" className="px-3 py-2 text-right">Quantity</th>
              <th scope="col" className="py-2 pr-4 pl-3 text-right">Value</th>
              <th scope="col" className="py-2 pr-4"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">{rows}</tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-ink-muted">{note ?? "Click a row to open it · double-click a holding for its history"}</p>
      {reading && <HoldingHistoryDialog line={reading} onClose={() => setReading(null)} />}
    </>
  );
}

/** A holding's every day on file, newest first, with a small chart of its value. */
export function HoldingHistoryDialog({ line, onClose }: { line: TreeLine; onClose: () => void }) {
  const history = useGetHoldingHistory<HoldingHistory, ApiError>(line.customerId, {
    isin: line.isin ?? undefined,
    name: line.isin ? undefined : line.name,
    positionId: line.isin ? undefined : line.positionId ?? undefined,
  });
  const days = history.data?.days ?? [];
  const charted = days.length === 0 ? [] : days.filter((one) => one.currency === days[0]!.currency).slice().reverse();
  const where = line.levels.join(" › ");

  return (
    <Dialog open onClose={onClose} title={line.name} description={[line.isin, where].filter(Boolean).join(" · ")}>
      {history.isError ? (
        <p className="text-sm text-red-700">The history could not be loaded. Try again.</p>
      ) : !history.data ? (
        <div className="h-40 animate-pulse rounded-xl bg-slate-50" />
      ) : days.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink-muted">No history on file for this holding yet.</p>
      ) : (
        <div className="space-y-3">
          {charted.length > 1 && <Sparkline values={charted.map((one) => one.value)} />}
          <div className="max-h-80 overflow-y-auto">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b border-line text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                  <th scope="col" className="py-2 pr-3">Day</th>
                  <th scope="col" className="px-2 py-2 text-right">Quantity</th>
                  <th scope="col" className="px-2 py-2 text-right">Price</th>
                  <th scope="col" className="px-2 py-2 text-right">Value</th>
                  <th scope="col" className="py-2 pl-2 text-right">Change</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {days.map((one, at) => {
                  const before = days.slice(at + 1).find((other) => other.currency === one.currency);
                  const change = before && before.value !== 0 ? ((one.value - before.value) / Math.abs(before.value)) * 100 : null;
                  return (
                    <tr key={`${one.day}-${one.currency}`}>
                      <td className="py-1.5 pr-3 whitespace-nowrap">{formatDate(one.day)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{one.units == null ? "—" : one.units.toLocaleString("en-US")}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{one.price == null ? "—" : one.price.toLocaleString("en-US", { maximumFractionDigits: 6 })}</td>
                      <td className="px-2 py-1.5 text-right whitespace-nowrap tabular-nums">{money({ currency: one.currency, value: one.value })}</td>
                      <td className={cn("py-1.5 pl-2 text-right tabular-nums", change == null ? "text-ink-muted" : change >= 0 ? "text-emerald-700" : "text-red-700")}>
                        {change == null ? "—" : `${change >= 0 ? "+" : "−"}${Math.abs(change).toFixed(1)}%`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-ink-muted">
            {history.data.asSent ? "Every day the bank's file stated it, as sent." : "Every day's closing value on the platform."}
          </p>
        </div>
      )}
    </Dialog>
  );
}

/** The value over the days on file, oldest at the left. */
function Sparkline({ values }: { values: number[] }) {
  const low = Math.min(...values);
  const high = Math.max(...values);
  const span = high - low || 1;
  const points = values.map((value, at) => `${(at / (values.length - 1)) * 300},${76 - ((value - low) / span) * 64}`).join(" ");
  return (
    <svg viewBox="0 0 300 84" className="h-24 w-full" role="img" aria-label="Value over the days on file">
      <line x1="0" y1="80" x2="300" y2="80" stroke="currentColor" className="text-slate-200" />
      <polyline fill="none" strokeWidth="2" points={points} stroke="currentColor" className="text-primary-600" />
    </svg>
  );
}
