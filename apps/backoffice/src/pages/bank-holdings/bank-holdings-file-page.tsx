import { ApiError } from "@atomprive/api-client";
import {
  getGetViewLayoutQueryKey,
  useGetBankHoldingsBanks,
  useGetBankHoldingsFile,
  useGetViewLayout,
  useResetViewLayout,
  useSaveViewLayout,
  type BankHoldingsBanks,
  type BankHoldingsFile,
  type BankHoldingsLine,
  type ViewLayout,
} from "@atomprive/api-client/backoffice";
import { Button, cn } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown, ChevronRight, Columns3, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router";
import { useBookPanel } from "../../components/book-panel";
import { formatDate, formatDateTime } from "../../lib/labels";
import { opens } from "../portfolios/figure-opens";
import { clientKey, clientLabel } from "./bank-holdings-clients";
import { BankHoldingsCrumbs } from "./bank-holdings-crumbs";

/** The columns the grouped tab shows until the reader picks others, by the sheet's own headings. */
const MAIN = ["Name", "ISIN", "CCY", "Holding", "Last Price", "Market value USD", "P&L (USD)", "%"];

/** The three levels a bank's holdings are grouped by, outermost first. */
const LEVELS = ["Asset Class", "Product Type", "Sub-Asset Class 1"];

/** The columns a group adds up from its lines. */
const ADDED = ["Market value USD", "P&L (USD)"];

const NOT_STATED = "Not stated in the file";

/** The reader's saved view of these screens, kept to their account with the app's other screen layouts. */
const VIEW_KEY = "bank-holdings";

type Tab = "classes" | "all";

const TABS: [Tab, string][] = [["classes", "By asset class"], ["all", "All data"]];

function same(a: string, b: string) {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function number(text: string) {
  if (text.trim() === "") return null;
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

/**
 * What a bank puts under ISIN that is no identifier at all: words ("Cash Account", "Loan") or a plain line number
 * ("1", "2"). Anything else stays: an ISIN, or a bank's own reference for a deposit (AA25233KJPVR, SGXZ89219851USDC).
 */
const NOT_AN_IDENTIFIER = /^(\d+|[A-Za-z][A-Za-z\s/&.-]*)$/;

/**
 * A cell as text the eye reads: a fraction under a % heading as a percentage, a day as a date, numbers grouped. Under
 * ISIN, words or a plain line number (UBS writes "Cash Account" there, JP Morgan numbers its cash lines) show as a
 * dash, with what the file says on hover; the file keeps it as sent.
 */
function shown(text: string, heading: string): ReactNode {
  if (same(heading, "ISIN") && NOT_AN_IDENTIFIER.test(text.trim())) {
    return <span title={`Not an identifier. The bank's file says “${text}”.`} className="text-ink-muted">—</span>;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return formatDate(text);
  const value = number(text);
  if (value == null) return text;
  if (heading.includes("%")) return `${(value * 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
  const digits = Math.abs(value) >= 1000 ? 2 : 4;
  return value.toLocaleString("en-US", { maximumFractionDigits: digits });
}

function money(value: number) {
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * A column as it is saved: its place in the sheet and its heading, so a column is the same column whichever bank's
 * file is open (the four banks' sheets share their layout), and two columns with one heading stay apart.
 */
function columnId(file: BankHoldingsFile, index: number) {
  return `${index}:${file.headings[index] ?? ""}`.slice(0, 160);
}

/** The sheet's columns that have a heading, in the sheet's order. */
function sheetColumns(file: BankHoldingsFile) {
  return file.headings.map((heading, index) => ({ heading, index })).filter((one) => one.heading.trim() !== "");
}

/** What each tab shows when nothing is saved: the main columns grouped, every column in All data. */
function defaults(file: BankHoldingsFile): Record<Tab, number[]> {
  const every = sheetColumns(file).map((one) => one.index);
  const main = MAIN.map((heading) => file.headings.findIndex((one) => same(one, heading))).filter((index) => index >= 0);
  return { classes: every.filter((index) => main.includes(index)), all: every };
}

/** A tab's shown columns from a saved view: every column but the ones it took off. */
function fromSaved(file: BankHoldingsFile, layout: ViewLayout | undefined): Record<Tab, number[]> {
  const start = defaults(file);
  if (!layout?.savedAt) return start;
  const every = sheetColumns(file).map((one) => one.index);
  const out = { ...start };
  for (const [tab] of TABS) {
    const card = layout.cards.find((one) => one.id === tab);
    if (card) {
      const hidden = new Set(card.hiddenColumns ?? []);
      out[tab] = every.filter((index) => !hidden.has(columnId(file, index)));
    }
  }
  return out;
}

type Group = { key: string; name: string; level: number; lines: BankHoldingsLine[]; children: Group[] };

/**
 * One bank's holdings, as its Excel file states them, in two tabs grouped the same way — by the file's Asset Class,
 * then Product Type, then Sub-Asset Class 1, each group adding up the file's own Market value USD. By asset class
 * starts on the main columns; All data on every column of the sheet. Each tab's columns are chosen apart, and Save
 * view keeps both to the reader's account.
 */
export function BankHoldingsFilePage() {
  const { fileId = "" } = useParams();
  const file = useGetBankHoldingsFile<BankHoldingsFile, ApiError>(fileId, { query: { enabled: !!fileId } });
  const layout = useGetViewLayout<ViewLayout, ApiError>(VIEW_KEY, { query: { staleTime: 60_000 } });
  const [tab, setTab] = useState<Tab>("classes");
  const [query, setQuery] = useState("");
  const data = file.data;
  // The file itself does not name its client; the list of banks does, so the trail reads client, then bank.
  const banks = useGetBankHoldingsBanks<BankHoldingsBanks, ApiError>();
  const listed = banks.data?.banks.find((one) => one.id === fileId);

  return (
    <div className="space-y-6">
      <BankHoldingsCrumbs trail={[
        ...(listed ? [{ label: clientLabel(listed), to: `/bank-holdings/clients/${clientKey(listed)}` }] : []),
        { label: data?.bankName ?? "…" },
      ]} />

      {file.isLoading && <p className="py-10 text-center text-sm text-ink-muted">Loading the bank's holdings…</p>}
      {file.isError && (
        <p className="py-10 text-center text-sm text-red-700">
          {file.error?.status === 404 ? "This bank's file is no longer on the platform. A newer one may have replaced it." : "The holdings could not be loaded. Refresh to try again."}{" "}
          <Link to="/bank-holdings" className="font-semibold text-primary-600 hover:text-primary-700">Back to Bank holdings</Link>
        </p>
      )}
      {data && !layout.isLoading && (
        <Holdings key={`${data.id}:${layout.data?.savedAt ?? "default"}`} file={data} saved={layout.data} tab={tab} onTab={setTab}
          query={query} onQuery={setQuery} />
      )}
    </div>
  );
}

function Holdings({ file, saved, tab, onTab, query, onQuery }: {
  file: BankHoldingsFile; saved: ViewLayout | undefined; tab: Tab; onTab: (tab: Tab) => void;
  query: string; onQuery: (value: string) => void;
}) {
  const queryClient = useQueryClient();
  const save = useSaveViewLayout<ApiError>();
  const reset = useResetViewLayout<ApiError>();
  const [columns, setColumns] = useState(() => fromSaved(file, saved));
  const [justSaved, setJustSaved] = useState(false);
  const savedColumns = useMemo(() => fromSaved(file, saved), [file, saved]);
  const changed = TABS.some(([one]) => columns[one].join() !== savedColumns[one].join());
  const every = sheetColumns(file).map((one) => one.index);

  function saveView() {
    save.mutate({
      key: VIEW_KEY,
      data: {
        cards: TABS.map(([one]) => ({
          id: one, width: "FULL", hidden: false, chart: null, title: null, note: null, palette: null,
          hiddenColumns: every.filter((index) => !columns[one].includes(index)).map((index) => columnId(file, index)),
        })),
      },
    }, {
      onSuccess: (layout) => {
        queryClient.setQueryData(getGetViewLayoutQueryKey(VIEW_KEY), layout);
        setJustSaved(true);
      },
    });
  }

  function resetView() {
    reset.mutate({ key: VIEW_KEY }, {
      onSuccess: () => {
        setColumns(defaults(file));
        void queryClient.invalidateQueries({ queryKey: getGetViewLayoutQueryKey(VIEW_KEY) });
      },
    });
  }

  return (
    <>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[1.625rem] font-bold">{file.bankName}</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {file.fileName} · uploaded {formatDateTime(file.uploadedAt)} by {file.uploadedBy} · as the bank sent it
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span role="status" className="text-xs text-ink-muted">
            {save.isError ? <span className="text-red-700">The view could not be saved. Try again.</span>
              : changed ? "Unsaved changes" : justSaved ? "View saved" : saved?.savedAt ? `Saved view · ${formatDateTime(saved.savedAt)}` : ""}
          </span>
          {saved?.savedAt && (
            <Button variant="secondary" disabled={reset.isPending} onClick={resetView}>Reset view</Button>
          )}
          <Button disabled={save.isPending} onClick={saveView}>{save.isPending ? "Saving…" : "Save view"}</Button>
        </div>
      </header>

      <div role="tablist" aria-label="How the holdings are shown" className="flex gap-1 border-b border-line">
        {TABS.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => onTab(id)}
            className={cn("-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold",
              tab === id ? "border-primary-600 text-primary-700" : "border-transparent text-ink-muted hover:text-ink")}>
            {label}
          </button>
        ))}
      </div>

      <Grouped key={tab} file={file} query={query} onQuery={onQuery} every={tab === "all"} columns={columns[tab]}
        onColumns={(next) => { setColumns({ ...columns, [tab]: next }); setJustSaved(false); }}
        onDefault={() => { setColumns({ ...columns, [tab]: defaults(file)[tab] }); setJustSaved(false); }} />
    </>
  );
}

function SearchBox({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <label className="relative min-w-60 flex-1">
      <span className="sr-only">Search holdings</span>
      <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-muted" />
      <input id="bank-holdings-line-search" type="search" value={value} placeholder="Search name or ISIN…" onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-xl border border-line bg-white pr-3 pl-10 text-sm placeholder:text-ink-muted focus-visible:ring-2 focus-visible:ring-primary-200 focus-visible:outline-none" />
    </label>
  );
}

/** Lines whose name or ISIN holds what was typed. */
function matching(file: BankHoldingsFile, query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return file.lines;
  const name = file.headings.findIndex((one) => same(one, "Name"));
  const isin = file.headings.findIndex((one) => same(one, "ISIN"));
  return file.lines.filter((line) => [name, isin].some((at) => at >= 0 && (line.cells[at] ?? "").toLowerCase().includes(needle)));
}

/**
 * The holdings grouped by asset class, product type and sub-asset class, on the columns chosen for the tab. The
 * name always shows, first, since it names the row; the rest keep the sheet's order.
 */
function Grouped({ file, query, onQuery, every, columns, onColumns, onDefault }: {
  file: BankHoldingsFile; query: string; onQuery: (value: string) => void; every: boolean;
  columns: number[]; onColumns: (next: number[]) => void; onDefault: () => void;
}) {
  const at = (heading: string) => file.headings.findIndex((one) => same(one, heading));
  const usd = at("Market value USD");
  const name = Math.max(0, at("Name"));
  const [open, setOpen] = useState<Set<string>>(new Set());
  const panel = useBookPanel();
  const ccy = at("CCY");
  const share = at("%");
  const lines = matching(file, query);
  const searching = query.trim() !== "";

  const valueOf = (line: BankHoldingsLine, column: number) => (column >= 0 ? number(line.cells[column] ?? "") ?? 0 : 0);
  const sumAt = (some: BankHoldingsLine[], column: number) => some.reduce((total, line) => total + valueOf(line, column), 0);
  const whole = sumAt(file.lines, usd);

  const tree = useMemo(() => {
    const levels = LEVELS.map((heading) => file.headings.findIndex((one) => same(one, heading)));
    const worth = (some: BankHoldingsLine[]) => some.reduce((t, l) => t + valueOf(l, usd), 0);
    function group(some: BankHoldingsLine[], level: number, parent: string): Group[] {
      if (level >= levels.length) return [];
      const column = levels[level] ?? -1;
      const named = new Map<string, BankHoldingsLine[]>();
      for (const line of some) {
        const label = (column >= 0 ? line.cells[column] : "")?.trim() || NOT_STATED;
        named.set(label, [...(named.get(label) ?? []), line]);
      }
      return [...named.entries()]
        .map(([label, own]) => {
          const key = `${parent}/${label}`;
          return { key, name: label, level, lines: own, children: group(own, level + 1, key) };
        })
        .sort((a, b) => worth(b.lines) - worth(a.lines));
    }
    return group(lines, 0, "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file, lines, usd]);

  const everyKey = useMemo(() => {
    const keys: string[] = [];
    const walk = (groups: Group[]) => groups.forEach((one) => { keys.push(one.key); walk(one.children); });
    walk(tree);
    return keys;
  }, [tree]);

  // A search opens every group, so what matched is in sight; clearing it puts the reader's own groups back.
  const shownOpen = searching ? new Set(everyKey) : open;
  // A column is a number column when most of the values it holds are numbers; it is set right, the rest left, in
  // every row alike, so a group's value sits under its lines' values.
  const numeric = useMemo(() => {
    const out = new Set<number>();
    file.headings.forEach((_, index) => {
      const filled = file.lines.map((line) => line.cells[index] ?? "").filter((text) => text.trim() !== "");
      if (filled.length > 0 && filled.filter((text) => number(text) != null).length * 2 > filled.length) out.add(index);
    });
    return out;
  }, [file]);
  const align = (index: number) => (numeric.has(index) ? "text-right tabular-nums" : "text-left");
  const rest = columns.filter((index) => index !== name).map((index) => ({ index, heading: file.headings[index] ?? "" }));
  const nameHeading = file.headings[name] ?? "Name";

  function toggle(key: string) {
    const next = new Set(open);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setOpen(next);
  }

  /**
   * What a group or the total says under a column: its sum where the column adds up, its share under %, the one
   * value its lines all share (an asset class, a currency), and a dash where they differ.
   */
  function summary(some: BankHoldingsLine[], index: number, heading: string): ReactNode {
    if (ADDED.some((added) => same(added, heading))) return money(sumAt(some, index));
    if (same(heading, "%") && whole !== 0) return `${((sumAt(some, usd) / whole) * 100).toFixed(2)}%`;
    const values = new Set(some.map((line) => (line.cells[index] ?? "").trim()));
    if (values.size === 1) {
      const only = [...values][0] ?? "";
      return only === "" ? "" : <span className="font-normal">{shown(only, heading)}</span>;
    }
    return <span title="Differs between the lines in this group" className="font-normal text-ink-muted">—</span>;
  }

  /** A share as the sheet states it (a fraction), written as a percentage; blank when the sheet has none. */
  function percent(text: string) {
    const value = number(text);
    return value == null ? null : `${(value * 100).toFixed(2)}%`;
  }

  /** A group's lines in the side panel, read off the file: name, currency, Market value USD and the sheet's %. */
  function openGroup(group: Group) {
    const worth = sumAt(group.lines, usd);
    panel?.({
      name: group.name,
      figure: {
        label: `${file.bankName} · ${LEVELS[group.level] ?? "Group"}`,
        value: usd >= 0 ? `${money(worth)} USD` : undefined,
        note: `${group.lines.length} line${group.lines.length === 1 ? "" : "s"} of ${file.fileName}, as the bank stated them.${whole !== 0 ? ` ${((worth / whole) * 100).toFixed(2)}% of the file's Market value USD.` : ""}`,
        table: {
          columns: ["Name", "CCY", "Market value USD", "%"],
          rows: group.lines.map((line) => [
            line.cells[name] ?? "",
            ccy >= 0 ? line.cells[ccy] ?? null : null,
            usd >= 0 ? number(line.cells[usd] ?? "") : null,
            share >= 0 ? percent(line.cells[share] ?? "") : null,
          ]),
          total: ["Total", null, usd >= 0 ? Number(worth.toFixed(2)) : null, whole !== 0 ? `${((worth / whole) * 100).toFixed(2)}%` : null],
        },
      },
    });
  }

  /** The total by asset class in the side panel: each class's Market value USD and share, from the grouped lines. */
  function openTotal() {
    const shownWorth = sumAt(lines, usd);
    panel?.({
      name: "Total",
      figure: {
        label: `${file.bankName} · by asset class`,
        value: usd >= 0 ? `${money(shownWorth)} USD` : undefined,
        note: `Market value USD added up by the file's own Asset Class${searching ? `, for the lines matching “${query}”` : ""}. Nothing is converted.`,
        table: {
          columns: ["Asset class", "Lines", "Market value USD", "%"],
          rows: tree.map((group) => {
            const worth = sumAt(group.lines, usd);
            return [group.name, group.lines.length, Number(worth.toFixed(2)), whole !== 0 ? `${((worth / whole) * 100).toFixed(2)}%` : null];
          }),
          total: ["Total", lines.length, Number(shownWorth.toFixed(2)), whole !== 0 ? `${((shownWorth / whole) * 100).toFixed(2)}%` : null],
        },
      },
    });
  }

  function groupRows(groups: Group[]): ReactNode[] {
    return groups.flatMap((group) => {
      const isOpen = shownOpen.has(group.key);
      const row = (
        // The whole row opens and closes the group. The button inside stays for a keyboard; its click reaches the
        // row, so it toggles once.
        <tr key={group.key} onClick={() => toggle(group.key)}
          className={cn("cursor-pointer hover:bg-primary-50/60", group.level === 0 ? "bg-canvas font-bold" : "font-semibold")}>
          <th scope="row" className="py-2.5 pr-3 text-left" style={{ paddingLeft: `${1.25 + group.level * 1.5}rem` }}>
            <button type="button" aria-expanded={isOpen} className="inline-flex items-center gap-1.5 text-left whitespace-nowrap hover:text-primary-700">
              {isOpen ? <ChevronDown aria-hidden="true" className="size-4 shrink-0" /> : <ChevronRight aria-hidden="true" className="size-4 shrink-0" />}
              {group.name}
            </button>
            {panel && (
              <button type="button" onClick={(event) => { event.stopPropagation(); openGroup(group); }}
                onKeyDown={(event) => event.stopPropagation()}
                className="ml-2 rounded-md border border-line px-1.5 py-0.5 text-2xs font-semibold text-ink-muted hover:border-primary-200 hover:text-primary-700">
                Breakdown
              </button>
            )}
          </th>
          {rest.map((one) => (
            <td key={one.index} className={cn("px-3 py-2.5 whitespace-nowrap", align(one.index))}>{summary(group.lines, one.index, one.heading)}</td>
          ))}
        </tr>
      );
      if (!isOpen) return [row];
      if (group.children.length > 0) return [row, ...groupRows(group.children)];
      return [row, ...group.lines.map((line) => (
        <tr key={`${group.key}#${line.lineNo}`}>
          <th scope="row" className="py-2 pr-3 text-left font-normal" style={{ paddingLeft: `${1.25 + (group.level + 1) * 1.5 + 1.375}rem` }}>
            {shown(line.cells[name] ?? "", nameHeading)}
          </th>
          {rest.map((one) => {
            const text = line.cells[one.index] ?? "";
            return (
              <td key={one.index} className={cn("px-3 py-2 whitespace-nowrap", align(one.index))}>
                {shown(text, one.heading)}
              </td>
            );
          })}
        </tr>
      ))];
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start gap-3">
        <SearchBox value={query} onChange={onQuery} />
        <Button variant="secondary" onClick={() => setOpen(new Set(everyKey))}>Expand all</Button>
        <Button variant="secondary" onClick={() => setOpen(new Set())}>Collapse all</Button>
        <ColumnsMenu file={file} name={name} chosen={columns} every={every} onChange={onColumns} onDefault={onDefault} />
      </div>
      <section className="overflow-hidden rounded-2xl border border-line bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm" data-own-columns>
            <thead>
              <tr className="border-b border-line bg-canvas text-left text-2xs font-semibold tracking-wider whitespace-nowrap text-ink-muted uppercase">
                <th scope="col" className="min-w-72 py-3 pr-3 pl-5">{nameHeading}</th>
                {rest.map((one) => (
                  <th key={one.index} scope="col" className={cn("px-3 py-3", numeric.has(one.index) ? "text-right" : "text-left")}>{one.heading}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {tree.length === 0 && (
                <tr><td colSpan={rest.length + 1} className="px-5 py-10 text-center text-ink-muted">No holding matches “{query}”.</td></tr>
              )}
              {groupRows(tree)}
            </tbody>
            <tfoot>
              <tr {...(panel ? opens(openTotal) : {})} className={cn("border-t-2 border-line font-bold", panel && "cursor-pointer hover:bg-canvas")}>
                <th scope="row" className="py-3 pr-3 pl-5 text-left">Total</th>
                {rest.map((one) => (
                  <td key={one.index} className={cn("px-3 py-3 whitespace-nowrap", align(one.index))}>{summary(lines, one.index, one.heading)}</td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
      <p className="text-xs text-ink-muted">
        {every && `${rest.length + 1} of the ${sheetColumns(file).length} columns of ${file.fileName}. `}Grouped by the file's own Asset Class, Product Type and
        Sub-Asset Class 1. A group's Market value USD and P&L (USD) add up its lines as the bank stated them; nothing is converted. % is a group's
        share of the file's Market value USD.
      </p>
    </div>
  );
}

/** Which of the sheet's columns a tab shows. The name always shows; a column with the same heading as another is told apart by its place. */
function ColumnsMenu({ file, name, chosen, every, onChange, onDefault }: {
  file: BankHoldingsFile; name: number; chosen: number[]; every: boolean;
  onChange: (next: number[]) => void; onDefault: () => void;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (event: MouseEvent) => { if (box.current && !box.current.contains(event.target as Node)) setOpen(false); };
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", key); };
  }, [open]);
  const columns = sheetColumns(file);
  const twice = (heading: string) => columns.filter((one) => same(one.heading, heading)).length > 1;
  const count = chosen.filter((index) => index !== name).length + 1;
  return (
    <div ref={box} className="relative">
      <Button variant="secondary" aria-expanded={open} onClick={() => setOpen((was) => !was)}>
        <Columns3 aria-hidden="true" className="size-4" />
        Columns · {count}/{columns.length}
      </Button>
      {open && (
        <div className="absolute right-0 z-20 mt-2 max-h-96 w-80 overflow-y-auto rounded-xl border border-line bg-white p-2 shadow-lg">
          <div className="mb-1 flex gap-1">
            <button type="button" onClick={() => onChange(columns.map((one) => one.index))}
              className="flex-1 rounded-lg px-2 py-1.5 text-left text-xs font-semibold text-primary-600 hover:bg-canvas">Show all</button>
            <button type="button" onClick={onDefault}
              className="flex-1 rounded-lg px-2 py-1.5 text-left text-xs font-semibold text-primary-600 hover:bg-canvas">
              {every ? "Back to every column" : "Back to the main columns"}
            </button>
          </div>
          {columns.map((one) => {
            const on = one.index === name || chosen.includes(one.index);
            const fixed = one.index === name;
            return (
              <button key={one.index} type="button" role="menuitemcheckbox" aria-checked={on} disabled={fixed}
                onClick={() => onChange(on ? chosen.filter((index) => index !== one.index) : [...chosen, one.index].sort((a, b) => a - b))}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-canvas disabled:text-ink-muted">
                <span className={cn("flex size-4 shrink-0 items-center justify-center rounded border", on ? "border-primary-600 bg-primary-600 text-white" : "border-line")}>
                  {on && <Check aria-hidden="true" className="size-3" />}
                </span>
                <span className="min-w-0 flex-1">{one.heading}</span>
                {twice(one.heading) && <span className="text-2xs text-ink-muted">column {one.index + 1}</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
