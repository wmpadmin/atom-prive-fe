import { ApiError } from "@atomprive/api-client";
import {
  useGetBankFeedDetail,
  type BankFeedAccount,
  type BankFeedDetail,
  type BankFeedLine,
} from "@atomprive/api-client/backoffice";
import { Alert, Badge, cn, SelectInput, TextInput } from "@atomprive/ui";
import { ArrowLeft, Search } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router";
import { formatDate, formatDateTime } from "../../lib/labels";
import { connectionLabels, feedStanding, scheduleLabels } from "./feed-labels";

/**
 * One bank's feed on a page of its own, opened from a row on Ingestion monitoring: the feed, every account the firm
 * holds at the bank, and each account's latest file line by line. Every figure is as the bank sent it — never
 * converted, never added across currencies; the only totals are one per currency.
 */
export function BankFeedDetailPage() {
  const { bankId = "" } = useParams();
  const detail = useGetBankFeedDetail<BankFeedDetail, ApiError>(bankId, { query: { enabled: bankId !== "" } });
  const [tab, setTab] = useState<"accounts" | "holdings">("accounts");

  if (detail.isError) return <Alert tone="danger">{detail.error.message}</Alert>;
  const data = detail.data;
  const feed = data?.feed;
  const standing = feed ? feedStanding(feed) : null;

  return (
    <div className="space-y-6">
      <header>
        <Link to="/ingestion" className="inline-flex items-center gap-1 text-2xs font-semibold tracking-wider text-ink-muted uppercase hover:text-ink">
          <ArrowLeft className="size-3" aria-hidden="true" />
          Bank feeds{feed && ` / ${feed.name}`}
        </Link>
        <h1 className="mt-1 text-[1.625rem] font-bold">{feed?.name ?? "Bank feed"}</h1>
        {feed && standing && (
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-muted">
            <span>{connectionLabels[feed.connectionType] ?? feed.connectionType}</span>
            <span aria-hidden="true">·</span>
            <span>{scheduleLabels[feed.schedule] ?? feed.schedule}</span>
            <span aria-hidden="true">·</span>
            <span>last file {feed.lastRunAt ? formatDateTime(feed.lastRunAt) : "never"}</span>
            <Badge tone={standing.tone}>{standing.label}</Badge>
            {data?.demo && <Badge tone="warning">Demo data</Badge>}
          </p>
        )}
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Accounts" value={data ? data.accounts.length.toLocaleString() : undefined}
          note={feed ? `${feed.liveAccounts} live${feed.takenOffAccounts > 0 ? ` · ${feed.takenOffAccounts} taken off` : ""}` : ""} />
        <Kpi label="Clients" value={data?.clients.toLocaleString()} note="holding an account here" />
        <Kpi label="Holding lines (latest file)" value={data?.lines.length.toLocaleString()}
          note={data ? `${data.holdingsFromBank.toLocaleString()} on file from this bank in all` : ""} />
        <Kpi label="Latest file dated" value={data ? (data.latestFileOn ? formatDate(data.latestFileOn) : "No file yet") : undefined}
          note="the newest as-of date any account was sent" />
      </div>

      <section className="rounded-2xl border border-line bg-white">
        <div role="tablist" aria-label="What to show" className="flex gap-1 border-b border-line px-5 pt-4 pb-3">
          {([["accounts", `Accounts · ${data?.accounts.length ?? "…"}`], ["holdings", `Holdings · ${data?.lines.length ?? "…"}`]] as const).map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
              className={cn("rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors",
                tab === id ? "bg-primary-50 text-primary-700 ring-1 ring-primary-200" : "text-ink-muted hover:bg-canvas")}>
              {label}
            </button>
          ))}
        </div>
        {!data ? <p className="px-5 py-10 text-center text-sm text-ink-muted">Loading the feed…</p>
          : tab === "accounts" ? <AccountsTab accounts={data.accounts} /> : <HoldingsTab data={data} />}
      </section>
    </div>
  );
}

function AccountsTab({ accounts }: { accounts: BankFeedAccount[] }) {
  const [query, setQuery] = useState("");
  const [client, setClient] = useState("");
  const [currency, setCurrency] = useState("");
  const clients = useMemo(() => [...new Map(accounts.map((one) => [one.clientId, `${one.clientName} · ${one.clientCode}`])).entries()]
    .sort((a, b) => a[1].localeCompare(b[1])), [accounts]);
  const currencies = useMemo(() => [...new Set(accounts.map((one) => one.currency))].sort(), [accounts]);
  const needle = query.trim().toLowerCase();
  const rows = accounts.filter((one) =>
    (!client || one.clientId === client) && (!currency || one.currency === currency)
    && (!needle || `${one.clientName} ${one.clientCode} ${one.maskedNumber}`.toLowerCase().includes(needle)));
  return (
    <>
      <Filters>
        <SearchBox value={query} onChange={setQuery} placeholder="Search client or account" />
        <Select label="Clients" value={client} onChange={setClient} options={clients} />
        <Select label="Currencies" value={currency} onChange={setCurrency} options={currencies.map((one) => [one, one])} />
      </Filters>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-y border-line text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
              <th scope="col" className="py-2.5 pr-3 pl-5">Client</th>
              <th scope="col" className="px-3 py-2.5">Account</th>
              <th scope="col" className="px-3 py-2.5">Currency</th>
              <th scope="col" className="px-3 py-2.5">Type</th>
              <th scope="col" className="py-2.5 pr-5 pl-3">Added on</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.length === 0 && <EmptyRow span={5}>{accounts.length === 0 ? "No account is held at this bank." : "No account matches."}</EmptyRow>}
            {rows.map((one) => (
              <tr key={one.id}>
                <td className="py-2.5 pr-3 pl-5">
                  <Link to={`/client-workspace/${one.clientId}`} className="block font-medium hover:text-primary-700 hover:underline">{one.clientName}</Link>
                  <span className="block text-xs text-ink-muted">{one.clientCode}</span>
                </td>
                <td className="px-3 py-2.5 font-mono text-xs whitespace-nowrap">{one.maskedNumber}</td>
                <td className="px-3 py-2.5">{one.currency}</td>
                <td className="px-3 py-2.5 text-ink-soft">{titleCase(one.accountType)}</td>
                <td className="py-2.5 pr-5 pl-3 whitespace-nowrap text-ink-soft tabular-nums">{formatDate(one.addedOn)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function HoldingsTab({ data }: { data: BankFeedDetail }) {
  const [query, setQuery] = useState("");
  const [currency, setCurrency] = useState("");
  const [bankClass, setBankClass] = useState("");
  const lines = data.lines;
  const currencies = useMemo(() => [...new Set(lines.map((one) => one.currency))].sort(), [lines]);
  const classes = useMemo(() => [...new Set(lines.map((one) => one.bankClass ?? ""))].sort(), [lines]);
  const needle = query.trim().toLowerCase();
  const rows = lines.filter((one) =>
    (!currency || one.currency === currency) && (!bankClass || (one.bankClass ?? "") === bankClass)
    && (!needle || `${one.instrument ?? ""} ${one.isin ?? ""}`.toLowerCase().includes(needle)));
  // The server's totals for the latest files, one per currency; never one figure across currencies.
  const totals = data.totals;
  return (
    <>
      <p className="px-5 pt-4 text-xs text-ink-muted">
        {data.holdingsFromBank.toLocaleString()} holding line{data.holdingsFromBank === 1 ? "" : "s"} on file from this bank in all.
        Shown: each account's latest file, exactly as sent — never converted, never added across currencies.
      </p>
      {/* Said wherever a line was not sent by the bank: these were made from the clients' own holdings for the
          demonstration, and no figure anywhere else is read from them. */}
      {data.demo && (
        <p className="mx-5 mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <span className="font-semibold">Demo data.</span> Lines marked Demo were made from the clients' own
          holdings for the demonstration. This bank has not sent them, and no other screen reads them.
        </p>
      )}
      <Filters>
        <SearchBox value={query} onChange={setQuery} placeholder="Search instrument or ISIN" />
        <Select label="Currencies" value={currency} onChange={setCurrency} options={currencies.map((one) => [one, one])} />
        <Select label="Bank's classes" value={bankClass} onChange={setBankClass}
          options={classes.map((one) => [one, one === "" ? "Not given" : one])} />
      </Filters>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-y border-line text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
              <th scope="col" className="py-2.5 pr-3 pl-5">Instrument</th>
              <th scope="col" className="px-3 py-2.5">Account</th>
              <th scope="col" className="px-3 py-2.5 text-right">Quantity</th>
              <th scope="col" className="px-3 py-2.5 text-right">Price</th>
              <th scope="col" className="px-3 py-2.5 text-right">Value</th>
              <th scope="col" className="py-2.5 pr-5 pl-3">As of</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.length === 0 && <EmptyRow span={6}>{lines.length === 0 ? "No file has been received from this bank yet." : "No line matches."}</EmptyRow>}
            {rows.map((one) => <LineRow key={one.id} line={one} />)}
          </tbody>
          {totals.length > 0 && (
            <tfoot>
              <tr className="border-t border-line">
                <td colSpan={6} className="px-5 py-3 text-xs text-ink-muted">
                  <span className="font-semibold text-ink">Latest files, totals per currency: </span>
                  {totals.map((one, at) => (
                    <span key={one.currency} className="whitespace-nowrap tabular-nums">
                      {at > 0 && " · "}{one.currency} {number(one.amount, 2)}
                    </span>
                  ))}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </>
  );
}

function LineRow({ line }: { line: BankFeedLine }) {
  return (
    <tr>
      <td className="py-2.5 pr-3 pl-5">
        <span className="block font-medium break-words">{line.instrument ?? "Not named in the file"}</span>
        <span className="block text-xs text-ink-muted">{[line.isin, line.bankClass].filter(Boolean).join(" · ") || "No ISIN or class given"}</span>
      </td>
      <td className="px-3 py-2.5 font-mono text-xs whitespace-nowrap">{line.maskedAccount}</td>
      <td className="px-3 py-2.5 text-right tabular-nums">{line.quantity == null ? "—" : number(line.quantity)}</td>
      <td className="px-3 py-2.5 text-right tabular-nums">{line.price == null ? "—" : number(line.price)}</td>
      <td className="px-3 py-2.5 text-right font-semibold whitespace-nowrap tabular-nums">{line.currency} {number(line.value, 2)}</td>
      <td className="py-2.5 pr-5 pl-3 whitespace-nowrap text-ink-soft tabular-nums">
        {formatDate(line.asOf)}
        {line.demo && <span className="ml-2"><Badge tone="warning">Demo</Badge></span>}
      </td>
    </tr>
  );
}

function Kpi({ label, value, note }: { label: string; value: string | undefined; note: string }) {
  return (
    <div className="rounded-2xl border border-line bg-white px-5 py-4">
      <p className="text-xs font-semibold tracking-wider text-ink-muted uppercase">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value ?? "—"}</p>
      <p className="mt-0.5 text-xs text-ink-muted">{note}</p>
    </div>
  );
}

/** The app's filter bar: search first at a set width, then each filter sized to its words; wraps when narrow. */
function Filters({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2 px-5 py-3">{children}</div>;
}

function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <label className="relative w-[360px] max-w-full">
      <span className="sr-only">{placeholder}</span>
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
      <TextInput type="search" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder}
        className="w-full pl-9" />
    </label>
  );
}

function Select({ label, value, onChange, options }: {
  label: string; value: string; onChange: (value: string) => void; options: (readonly [string, string])[];
}) {
  return (
    <label className="max-w-full">
      <span className="sr-only">{label}</span>
      <SelectInput value={value} onChange={(event) => onChange(event.target.value)} title={label}
        className="w-auto max-w-[220px] sm:min-w-[140px]">
        <option value="">{`All ${label.toLowerCase()}`}</option>
        {options.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
      </SelectInput>
    </label>
  );
}

function EmptyRow({ span, children }: { span: number; children: ReactNode }) {
  return (
    <tr>
      <td colSpan={span} className="px-5 py-10 text-center text-sm text-ink-muted">{children}</td>
    </tr>
  );
}

function number(value: number, digits?: number) {
  return value.toLocaleString("en-GB", digits == null ? { maximumFractionDigits: 8 } : { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function titleCase(text: string) {
  return text.charAt(0) + text.slice(1).toLowerCase().replaceAll("_", " ");
}
