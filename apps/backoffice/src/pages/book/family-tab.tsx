import { ApiError } from "@atomprive/api-client";
import { useGetFamilyWealth, type FamilyMember, type FamilyWealth } from "@atomprive/api-client/backoffice";
import { Alert, cn } from "@atomprive/ui";
import { keepPreviousData } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router";
import { useRelationshipTypes } from "../../lib/relationship-types";
import { axisMoney, money, short } from "./book-figures";
import { CategoryChart, TimeChart } from "./overview-charts";
import { column as col, row as exportRow, useExportSheet } from "./overview-export";
import type { PanelContext } from "./overview-panels";

const percent = (value: number) => `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;

/**
 * A family's money added up: the client and everybody in their family group, with a switch to look at one of
 * them. Each member is read as their own page reads them, in the page's currency and dates; what the family owns
 * jointly is counted once, split by the owners' shares.
 */
export function FamilyTab({ context, family }: { context: PanelContext; family: FamilyMember[] }) {
  const { customerId, sources } = context;
  const [picked, setPicked] = useState<string | null>(null);
  const { labelFor } = useRelationshipTypes();
  const read = useGetFamilyWealth<FamilyWealth, ApiError>(customerId,
    { from: sources.from, to: sources.to, currency: sources.overview.currency },
    { query: { placeholderData: keepPreviousData } });
  const data = read.data;
  const known = new Map(family.map((one) => [one.id, one]));
  const about = (id: string) => {
    const one = known.get(id);
    if (!one) return "";
    if (one.primaryHolder) return one.accountHolder ? "Primary holder" : "Primary";
    if (one.accountHolder) return "Joint holder";
    return labelFor(one.relationship);
  };

  useExportSheet(() => data ? {
    columns: [col("Member"), col("Relationship"), col(`Managed portfolio (${data.currency})`, "MONEY"), col(`Owned assets, their share (${data.currency})`, "MONEY"),
      col(`Loans (${data.currency})`, "MONEY"), col(`Net worth (${data.currency})`, "MONEY"), col("Share of family %", "PERCENT"), col("TWR (YTD) %", "PERCENT")],
    rows: [
      ...data.members.map((one) => exportRow([one.name, about(one.customerId), one.managed, one.owned, one.loans, one.netWorth, one.share, one.twrYearToDate])),
      exportRow(["Whole family", "", data.managed, data.owned, data.loans, data.netWorth, 100, data.twrYearToDate], 0, true),
    ],
  } : null);

  if (read.isError) return <Alert tone="danger">{read.error.message}</Alert>;
  if (!data) return <p className="py-10 text-center text-sm text-ink-muted">Adding up the family…</p>;
  const ccy = data.currency;
  const member = data.members.find((one) => one.customerId === picked) ?? null;
  const cards: [string, number | null, boolean?][] = member
    ? [[`Net worth (${ccy})`, member.netWorth], [`Managed portfolio (${ccy})`, member.managed], [`Owned assets, their share (${ccy})`, member.owned], [`Loans (${ccy})`, member.loans, true]]
    : [[`Family net worth (${ccy})`, data.netWorth], [`Managed portfolios (${ccy})`, data.managed], [`Owned assets (${ccy})`, data.owned], [`Loans (${ccy})`, data.loans, true]];
  const slices = (member ? member.byAssetClass : data.byAssetClass).map((one) => ({ key: one.key, label: one.name, value: one.value }));
  const line = member ? member.netWorthLine : data.netWorthLine;

  return (
    <div className="space-y-4">
      <div role="radiogroup" aria-label="Whose figures" className="inline-flex flex-wrap gap-1 rounded-lg bg-canvas p-1 text-sm">
        {[{ id: null as string | null, label: "Whole family" }, ...data.members.map((one) => ({ id: one.customerId, label: about(one.customerId) ? `${one.name} · ${about(one.customerId)}` : one.name }))]
          .map((one) => (
            <button key={one.id ?? "all"} type="button" role="radio" aria-checked={picked === one.id} onClick={() => setPicked(one.id)}
              className={cn("rounded-md px-3 py-1.5", picked === one.id ? "bg-white font-semibold text-ink shadow-sm" : "text-ink-muted hover:text-ink")}>
              {one.label}
            </button>
          ))}
      </div>

      <div className="grid grid-cols-2 overflow-hidden rounded-2xl border border-line bg-white sm:grid-cols-4 sm:divide-x sm:divide-line">
        {cards.map(([label, value, owed]) => (
          <div key={label} className="px-4 py-4 text-center">
            <p className="text-xs font-semibold text-ink-muted">{label}</p>
            <p className={cn("mt-1 text-xl font-bold tabular-nums", value === null ? "text-ink-muted/70" : owed && value < 0 ? "text-danger" : "text-ink")}>
              {value === null ? "—" : money(value)}
            </p>
          </div>
        ))}
      </div>
      {member && (
        <p className="-mt-2 text-sm">
          <Link to={`/book/${member.customerId}`} className="font-semibold text-primary-700 hover:underline">Open {member.name}&apos;s page ›</Link>
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section aria-label="By member" className="min-w-0 rounded-2xl border border-line bg-white px-4 py-4">
          <h2 className="mb-3 text-base font-bold">By member</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-canvas text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                  <th scope="col" className="rounded-l-lg px-3 py-2 text-left whitespace-nowrap">Member</th>
                  <th scope="col" className="px-3 py-2 text-right">Managed portfolio</th>
                  <th scope="col" className="px-3 py-2 text-right">Owned assets (their share)</th>
                  <th scope="col" className="px-3 py-2 text-right">Loans</th>
                  <th scope="col" className="px-3 py-2 text-right">Net worth</th>
                  <th scope="col" className="px-3 py-2 text-right">Share of family</th>
                  <th scope="col" className="rounded-r-lg px-3 py-2 text-right">TWR (YTD)</th>
                </tr>
              </thead>
              <tbody>
                {data.members.map((one) => (
                  <tr key={one.customerId} className={cn("border-b border-line", one.customerId === picked && "bg-primary-50/60")}>
                    <th scope="row" className="px-3 py-2.5 text-left whitespace-nowrap">
                      <button type="button" onClick={() => setPicked(one.customerId)} className="text-left font-semibold hover:underline">{one.name}</button>
                      {about(one.customerId) && <span className="block text-xs font-normal text-ink-muted">{about(one.customerId)}</span>}
                    </th>
                    <td className="px-3 py-2.5 text-right tabular-nums">{one.managed === null ? <span className="text-ink-muted/70">—</span> : money(one.managed)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{money(one.owned)}</td>
                    <td className={cn("px-3 py-2.5 text-right tabular-nums", one.loans < 0 && "text-danger")}>{money(one.loans)}</td>
                    <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{money(one.netWorth)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{one.share.toFixed(2)}%</td>
                    <td className={cn("px-3 py-2.5 text-right tabular-nums", one.twrYearToDate === null ? "text-ink-muted/70" : one.twrYearToDate < 0 ? "text-danger" : "text-emerald-700")}>
                      {one.twrYearToDate === null ? "—" : percent(one.twrYearToDate)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-bold">
                  <th scope="row" className="px-3 py-2.5 text-left whitespace-nowrap">Whole family</th>
                  <td className="px-3 py-2.5 text-right tabular-nums">{money(data.managed)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{money(data.owned)}</td>
                  <td className={cn("px-3 py-2.5 text-right tabular-nums", data.loans < 0 && "text-danger")}>{money(data.loans)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{money(data.netWorth)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">100.00%</td>
                  <td className={cn("px-3 py-2.5 text-right tabular-nums", data.twrYearToDate === null ? "text-ink-muted/70" : data.twrYearToDate < 0 ? "text-danger" : "text-emerald-700")}>
                    {data.twrYearToDate === null ? "—" : percent(data.twrYearToDate)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
        <section aria-label="By asset class" className="flex min-h-72 flex-col rounded-2xl border border-line bg-white px-5 py-4">
          <h2 className="mb-2 text-base font-bold">{member ? `${member.name} by asset class` : "Family by asset class"}</h2>
          {slices.length === 0 ? <p className="text-sm text-ink-muted">Nothing to show.</p>
            : <div className="min-h-0 flex-1"><CategoryChart rows={slices} type="PIE" format={money} classes={context.classes} label="By asset class" /></div>}
        </section>
      </div>

      <section aria-label="Net worth over time" className="flex h-80 flex-col rounded-2xl border border-line bg-white px-5 py-4">
        <h2 className="mb-2 text-base font-bold">{member ? `${member.name}'s net worth over time` : "Family net worth over time"}</h2>
        <div className="min-h-0 flex-1">
          <TimeChart key={`${picked ?? "all"}-${data.from}-${data.to}-${ccy}`} points={line} label="Net worth" axisTitle={ccy} format={short} axisFormat={axisMoney} />
        </div>
      </section>

      <p className="text-xs text-ink-muted">
        Everyone in the family group counts: their managed portfolios, their share of each owned asset, and their loans. Something owned
        jointly is counted once, split by the owners&apos; shares on the Owned assets tab. The return is the family&apos;s portfolios
        together, with money paid in or taken out left out. Owned assets and loans are carried at today&apos;s value on the line.
      </p>
    </div>
  );
}
