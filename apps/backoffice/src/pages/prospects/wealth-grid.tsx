import {
  addWealthPeriod,
  changeWealthPeriod,
  removeWealthPeriod,
  saveWealthProfile,
  type HolderWealth,
  type WealthPeriod,
  type WealthView,
} from "@atomprive/api-client/backoffice";
import { cn } from "@atomprive/ui";
import { Plus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toFormErrors } from "../../lib/api-errors";
import { countries, countryName } from "../../lib/countries";

const usd = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 });

type Key = "fromYear" | "toYear" | "employmentDetails" | "country" | "turnover" | "marginPercent" | "salary"
  | "increasePercent" | "expensePercent" | "equity" | "realEstate";
type Row = {
  id: string | null; key: string; values: Record<Key, string>; errors: Record<string, string>; saving: boolean;
  /** What the server last had for the row (sent, or read): a cell typed into since is kept when its copy comes back. */
  sent: Record<Key, string> | null;
};

const MONEY: Key[] = ["turnover", "salary", "equity", "realEstate"];
const PERCENT: Key[] = ["marginPercent", "increasePercent", "expensePercent"];

function money(value: number) {
  return value === 0 ? "" : usd.format(value);
}

function rowOf(period: WealthPeriod): Row {
  const pct = (value: number) => (value === 0 ? "" : String(value));
  const values = {
    fromYear: String(period.fromYear), toYear: String(period.toYear), employmentDetails: period.employmentDetails ?? "",
    country: period.country ?? "", turnover: money(period.turnover), marginPercent: pct(period.marginPercent),
    salary: money(period.salary), increasePercent: pct(period.increasePercent), expensePercent: pct(period.expensePercent),
    equity: money(period.equity), realEstate: money(period.realEstate),
  };
  return { id: period.id, key: period.id, errors: {}, saving: false, values, sent: values };
}

let fresh = 0;
const blank = (): Row => ({
  id: null, key: `new-${++fresh}`, errors: {}, saving: false, sent: null,
  values: { fromYear: "", toYear: "", employmentDetails: "", country: "", turnover: "", marginPercent: "", salary: "",
    increasePercent: "", expensePercent: "", equity: "", realEstate: "" },
});

/**
 * The firm's wealth template as a sheet (23 Nov 2026): the same columns as the Excel, typed straight into. Yellow cells
 * are the ones to fill; years, income, earnings, expenses and savings are worked out on the server with the corrected
 * formulas. A row saves when its cell is left, a new row once it has its years and an income; problems show on the row.
 */
/** Hands the Save button one way to save what is on screen; it says whether everything saved. */
export type SaveRegister = (save: () => Promise<boolean>) => () => void;

export function WealthGrid({ prospectId, holder, editable, onSaved, register }: {
  prospectId: string;
  holder: HolderWealth;
  editable: boolean;
  onSaved: (next: WealthView) => void;
  register?: SaveRegister;
}) {
  const [rows, setRows] = useState<Row[]>(() => holder.periods.map(rowOf));
  // What the server holds comes back after every save. Each row keeps its place (a new row stays where it was typed,
  // in year order once the page is opened again: the user's choice, 25 Nov 2026), and a cell typed into while a save
  // was on its way stays as typed rather than being put back to what the server had.
  useEffect(() => {
    setRows((was) => {
      const fromServer = new Map(holder.periods.map((period) => [period.id, period]));
      const kept = was.flatMap((one): Row[] => {
        if (one.id === null) return [one];
        const period = fromServer.get(one.id);
        if (!period) return [];
        fromServer.delete(one.id);
        const server = rowOf(period).values;
        const values = { ...server };
        for (const field of Object.keys(values) as Key[]) {
          if (one.sent && one.values[field] !== one.sent[field]) values[field] = one.values[field];
        }
        return [{ ...one, values, sent: server }];
      });
      return [...kept, ...[...fromServer.values()].map(rowOf)];
    });
  }, [holder.periods]);
  const periodOf = (row: Row) => holder.periods.find((one) => one.id === row.id);
  // What the server last sent, for saves that finish after the screen has moved on.
  const latest = useRef(holder);
  useEffect(() => {
    latest.current = holder;
  }, [holder]);
  const t = holder.totals;

  const change = (key: string, field: Key, value: string) =>
    setRows((was) => was.map((one) => (one.key === key ? { ...one, values: { ...one.values, [field]: value } } : one)));

  // Save (23 Nov 2026): every row on screen, a half-typed new one told what it still needs.
  const current = useRef(rows);
  current.current = rows;
  const saveAll = useRef<() => Promise<boolean>>(async () => true);
  saveAll.current = async () => {
    let ok = true;
    for (const row of current.current) ok = (await commit(row, true)) && ok;
    return ok;
  };
  useEffect(() => register?.(() => saveAll.current()), [register]);

  // A row's saves go one after another (25 Nov 2026). Each cell left used to send its own save at once, so a new row
  // was added again for every cell left before the first add came back: five cells, five copies of the row. Now a
  // new row is added once, and what is typed in it after that changes the row it became.
  const queue = useRef(new Map<string, Promise<boolean>>());
  const created = useRef(new Map<string, string>());
  function commit(row: Row, asked = false): Promise<boolean> {
    const next = (queue.current.get(row.key) ?? Promise.resolve(true)).catch(() => false).then(() => send(row, asked));
    queue.current.set(row.key, next);
    return next;
  }

  async function send(row: Row, asked: boolean): Promise<boolean> {
    const id = row.id ?? created.current.get(row.key) ?? null;
    const v = row.values;
    const num = (field: Key) => (v[field].trim() === "" ? null : Number(v[field].replace(/[,%\s]/g, "")));
    if (id === null && (!v.fromYear.trim() || !v.toYear.trim() || (!v.salary.trim() && !v.turnover.trim()))) {
      const typed = Object.values(v).some((one) => one.trim() !== "");
      if (asked && typed) {
        setRows((was) => was.map((one) => (one.key === row.key
          ? { ...one, errors: { form: "Enter From, To and a salary or turnover to save this row." } } : one)));
        return false;
      }
      return true;
    }
    const saved = id === null ? undefined : latest.current.periods.find((one) => one.id === id);
    if (saved && JSON.stringify(rowOf(saved).values) === JSON.stringify(v)) return true;
    const body = {
      holderId: holder.holderId, fromYear: num("fromYear"), toYear: num("toYear"),
      employmentDetails: v.employmentDetails.trim() || null, country: v.country || null,
      salary: num("salary"), increasePercent: num("increasePercent"), turnover: num("turnover"),
      marginPercent: num("marginPercent"), expensePercent: num("expensePercent"), equity: num("equity"), realEstate: num("realEstate"),
    };
    setRows((was) => was.map((one) => (one.key === row.key ? { ...one, saving: true } : one)));
    try {
      let next: WealthView;
      if (id !== null) {
        next = await changeWealthPeriod(prospectId, id, body);
      } else {
        const known = new Set(latest.current.periods.map((one) => one.id));
        const claimed = new Set(created.current.values());
        next = await addWealthPeriod(prospectId, body);
        const mine = next.holders.find((one) => one.holderId === holder.holderId)?.periods.find((one) =>
          !known.has(one.id) && !claimed.has(one.id) && one.fromYear === body.fromYear && one.toYear === body.toYear);
        if (mine) created.current.set(row.key, mine.id);
      }
      const now = id ?? created.current.get(row.key) ?? null;
      setRows((was) => (now === null
        // Not found in what came back: shown as the server has it rather than risk adding it twice.
        ? was.filter((one) => one.key !== row.key)
        : was.map((one) => (one.key === row.key ? { ...one, id: now, saving: false, errors: {}, sent: v } : one))));
      onSaved(next);
      return true;
    } catch (caught) {
      const said = toFormErrors(caught);
      setRows((was) => was.map((one) => (one.key === row.key
        ? { ...one, saving: false, errors: { ...said.fields, ...(said.form ? { form: said.form } : {}) } } : one)));
      return false;
    }
  }

  async function remove(row: Row) {
    // A save on its way finishes first, so a row being added is removed once it has been.
    await queue.current.get(row.key);
    const id = row.id ?? created.current.get(row.key) ?? null;
    if (id === null) {
      setRows((was) => was.filter((one) => one.key !== row.key));
      return;
    }
    if (!window.confirm(`Remove ${row.values.fromYear} to ${row.values.toYear}?`)) return;
    onSaved(await removeWealthPeriod(prospectId, id));
  }

  const input = (row: Row, field: Key, align: "left" | "right" | "center" = "right") => {
    const wrong = row.errors[field];
    const shown = row.values[field];
    return (
      <td className={cn("border border-line p-0", editable ? "bg-amber-50/70" : "bg-white", wrong && "bg-red-50 ring-1 ring-red-400 ring-inset")}>
        {editable ? (
          <span className="flex items-center">
            <input aria-label={`${LABELS[field]}, ${row.values.fromYear || "new"} row`} title={wrong} value={shown}
              inputMode={field === "employmentDetails" ? "text" : "decimal"}
              onChange={(event) => change(row.key, field, event.target.value)}
              onBlur={(event) => {
                if (MONEY.includes(field)) {
                  const n = Number(event.target.value.replace(/[,\s]/g, ""));
                  if (event.target.value.trim() && Number.isFinite(n)) change(row.key, field, usd.format(n));
                }
                void commit({ ...row, values: { ...row.values, [field]: MONEY.includes(field) && event.target.value.trim()
                  && Number.isFinite(Number(event.target.value.replace(/[,\s]/g, ""))) ? usd.format(Number(event.target.value.replace(/[,\s]/g, ""))) : event.target.value } });
              }}
              className={cn("h-9 w-full min-w-0 bg-transparent px-2 text-sm text-ink tabular-nums outline-none focus:bg-white focus:ring-2 focus:ring-primary-600 focus:ring-inset",
                align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left")} />
            {PERCENT.includes(field) && shown && <span className="pr-2 text-xs text-ink-muted">%</span>}
          </span>
        ) : (
          <span className={cn("block px-2 py-2 text-sm tabular-nums", align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left")}>
            {field === "country" ? (shown ? countryName(shown) : "") : shown}{PERCENT.includes(field) && shown ? "%" : ""}
          </span>
        )}
      </td>
    );
  };

  const worked = (value: number | undefined, strong?: boolean) => (
    <td className={cn("border border-line bg-slate-50 px-2 py-2 text-right text-sm tabular-nums", strong ? "font-semibold text-ink" : "text-ink-soft")}>
      {value == null ? "" : usd.format(value)}
    </td>
  );

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full min-w-[1180px] border-collapse">
          <colgroup>
            <col className="w-16" /><col className="w-16" /><col className="w-12" /><col className="w-52" /><col className="w-40" />
            <col className="w-32" /><col className="w-20" /><col className="w-32" /><col className="w-20" /><col className="w-28" />
            <col className="w-32" /><col className="w-20" /><col className="w-28" /><col className="w-32" /><col className="w-32" />
            <col className="w-28" />{editable && <col className="w-10" />}
          </colgroup>
          <thead>
            <tr className="bg-slate-100 text-center text-xs font-bold text-ink">
              <th scope="colgroup" colSpan={5} className="border border-line px-2 py-1.5">Particulars</th>
              <th scope="colgroup" colSpan={5} className="border border-line px-2 py-1.5">Source of income</th>
              <th scope="colgroup" colSpan={1} className="border border-line px-2 py-1.5">Earnings</th>
              <th scope="colgroup" colSpan={2} className="border border-line px-2 py-1.5">Expense</th>
              <th scope="colgroup" colSpan={3} className="border border-line px-2 py-1.5">Wealth accumulation</th>
              {editable && <th className="border border-line" />}
            </tr>
            <tr className="bg-slate-50 text-xs font-semibold text-ink-soft">
              {(["From", "To", "Yrs", "Employment details", "Country", "Business turnover p.a.", "Profit margin", "Avg salary p.a.",
                "% incr. a year", "Income p.a.", "Total earnings", "% expense", "Total expenses", "Total savings", "Equity / fixed income",
                "Real estate"]).map((label) => (
                <th key={label} scope="col" className="border border-line px-2 py-1.5 text-center leading-tight">{label}</th>
              ))}
              {editable && <th scope="col" className="border border-line"><span className="sr-only">Remove</span></th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const p = periodOf(row);
              const country = row.values.country;
              return [
                <tr key={row.key} className={cn(row.saving && "opacity-60")}>
                  {input(row, "fromYear", "center")}
                  {input(row, "toYear", "center")}
                  <td className="border border-line bg-slate-50 px-2 py-2 text-center text-sm tabular-nums text-ink-soft">{p?.years ?? ""}</td>
                  {input(row, "employmentDetails", "left")}
                  {editable ? (
                    <td className={cn("border border-line bg-amber-50/70 p-0", row.errors.country && "bg-red-50")}>
                      <select aria-label={`Country, ${row.values.fromYear || "new"} row`} value={country}
                        onChange={(event) => {
                          change(row.key, "country", event.target.value);
                          void commit({ ...row, values: { ...row.values, country: event.target.value } });
                        }}
                        className="h-9 w-full bg-transparent px-1.5 text-sm text-ink outline-none focus:bg-white focus:ring-2 focus:ring-primary-600 focus:ring-inset">
                        <option value="">—</option>
                        {countries.map((one) => <option key={one.code} value={one.code}>{one.name}</option>)}
                      </select>
                    </td>
                  ) : input(row, "country", "left")}
                  {input(row, "turnover")}
                  {input(row, "marginPercent")}
                  {input(row, "salary")}
                  {input(row, "increasePercent")}
                  {worked(p?.incomePerYear)}
                  {worked(p?.earnings)}
                  {input(row, "expensePercent")}
                  {worked(p?.expenses)}
                  {worked(p?.savings, true)}
                  {input(row, "equity")}
                  {input(row, "realEstate")}
                  {editable && (
                    <td className="border border-line text-center">
                      <button type="button" aria-label={`Remove ${row.values.fromYear || "new"} row`} onClick={() => void remove(row)}
                        className="rounded p-1 text-ink-muted hover:bg-red-50 hover:text-red-700"><X aria-hidden="true" className="size-4" /></button>
                    </td>
                  )}
                </tr>,
                Object.keys(row.errors).length > 0 && (
                  <tr key={`${row.key}-errors`}>
                    <td colSpan={editable ? 17 : 16} className="border border-line bg-red-50 px-3 py-1.5 text-xs text-red-700">
                      {Object.values(row.errors).join(" ")}
                    </td>
                  </tr>
                ),
              ];
            })}
            {editable && (
              <tr>
                <td colSpan={17} className="border border-line p-0">
                  <button type="button" onClick={() => setRows((was) => [...was, blank()])}
                    className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-sm font-semibold text-primary-700 hover:bg-primary-50">
                    <Plus aria-hidden="true" className="size-4" />Add a row
                  </button>
                </td>
              </tr>
            )}
            {rows.length === 0 && !editable && (
              <tr><td colSpan={16} className="border border-line px-3 py-6 text-center text-sm text-ink-muted">No periods yet for {holder.name}.</td></tr>
            )}
            <tr className="bg-slate-100 text-sm font-bold">
              <td colSpan={2} className="border border-line px-2 py-2">Total</td>
              <td className="border border-line px-2 py-2 text-center tabular-nums">{t.years || ""}</td>
              <td colSpan={7} className="border border-line" />
              <td className="border border-line px-2 py-2 text-right tabular-nums">{usd.format(t.earnings)}</td>
              <td className="border border-line" />
              <td className="border border-line px-2 py-2 text-right tabular-nums">{usd.format(t.expenses)}</td>
              <td className="border border-line px-2 py-2 text-right tabular-nums">{usd.format(t.savings)}</td>
              <td className="border border-line px-2 py-2 text-right tabular-nums">{usd.format(t.equity)}</td>
              <td className="border border-line px-2 py-2 text-right tabular-nums">{usd.format(t.realEstate)}</td>
              {editable && <td className="border border-line" />}
            </tr>
          </tbody>
        </table>
      </div>
      {editable && (
        <p className="flex flex-wrap items-center gap-3 text-xs text-ink-muted">
          <span className="inline-flex items-center gap-1.5"><span className="size-3 rounded-sm border border-line bg-amber-50" />Type here</span>
          <span className="inline-flex items-center gap-1.5"><span className="size-3 rounded-sm border border-line bg-slate-50" />Worked out for you</span>
          <span>Each row saves when you leave a cell. A new row saves once it has its years and a salary or turnover.</span>
        </p>
      )}
    </div>
  );
}

const LABELS: Record<Key, string> = {
  fromYear: "From", toYear: "To", employmentDetails: "Employment details", country: "Country", turnover: "Business turnover",
  marginPercent: "Profit margin", salary: "Avg salary", increasePercent: "% increase a year", expensePercent: "% expense",
  equity: "Equity / fixed income", realEstate: "Real estate",
};

/** The brief profile and note, typed in place and saved when the box is left. */
export function WealthText({ prospectId, holder, field, editable, onSaved, register }: {
  prospectId: string;
  holder: HolderWealth;
  field: "briefProfile" | "note";
  editable: boolean;
  onSaved: (next: WealthView) => void;
  register?: SaveRegister;
}) {
  const [value, setValue] = useState(holder[field] ?? "");
  const [problem, setProblem] = useState<string>();
  useEffect(() => setValue(holder[field] ?? ""), [holder, field]);
  const save = useRef<() => Promise<boolean>>(async () => true);
  save.current = async () => {
    if ((holder[field] ?? "") === value.trim()) return true;
    setProblem(undefined);
    try {
      onSaved(await saveWealthProfile(prospectId, holder.holderId, {
        briefProfile: field === "briefProfile" ? value.trim() || null : holder.briefProfile ?? null,
        note: field === "note" ? value.trim() || null : holder.note ?? null,
      }));
      return true;
    } catch (caught) {
      setProblem(toFormErrors(caught).form ?? Object.values(toFormErrors(caught).fields).join(" "));
      return false;
    }
  };
  useEffect(() => register?.(() => save.current()), [register]);
  const label = field === "briefProfile" ? "Brief profile" : "Note";
  if (!editable) {
    return (
      <div className="grid gap-1 sm:grid-cols-[8rem_1fr]">
        <p className="text-sm text-ink-muted">{label}</p>
        <p className="text-sm whitespace-pre-wrap">{holder[field] ?? <span className="text-ink-muted">None</span>}</p>
      </div>
    );
  }
  return (
    <label className="grid gap-1 sm:grid-cols-[8rem_1fr] sm:items-start">
      <span className="pt-2 text-sm text-ink-muted">{label}</span>
      <span>
        <textarea rows={2} maxLength={1000} value={value} onChange={(event) => setValue(event.target.value)}
          placeholder={field === "briefProfile" ? "Engineer, then runs a logistics business in Dubai." : "Audited accounts 2020 to 2025."}
          onBlur={() => void save.current()}
          className="w-full rounded-lg border border-line bg-amber-50/70 px-3 py-2 text-sm text-ink outline-none focus:bg-white focus:ring-2 focus:ring-primary-600" />
        {problem && <span className="block text-xs text-red-700">{problem}</span>}
      </span>
    </label>
  );
}
