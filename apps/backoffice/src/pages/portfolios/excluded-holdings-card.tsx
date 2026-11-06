import type { HeldExclusions } from "@atomprive/api-client/backoffice";
import { countryName } from "../../lib/countries";

/**
 * What the client holds in a country or sector they excluded on their risk questionnaire. Nothing where they
 * excluded nothing; where they did and nothing breaks it, it says so.
 */
export function ExcludedHoldingsCard({ exclusions, currency }: { exclusions: HeldExclusions | null | undefined; currency: string }) {
  if (!exclusions) return null;
  const excluded = [...exclusions.countries.map(countryName), ...exclusions.sectors].join(", ");
  const money = (value: number) => `${currency} ${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  return (
    <section className="rounded-2xl border border-line bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-4">
        <div>
          <h2 className="flex items-center gap-2 text-base font-bold">
            Holdings in excluded countries or sectors
            <span className={exclusions.holdings.length ? "rounded-full bg-access-none-soft px-2 py-0.5 text-xs font-bold text-access-none-ink" : "rounded-full bg-access-full-soft px-2 py-0.5 text-xs font-bold text-access-full-ink"}>
              {exclusions.holdings.length}
            </span>
          </h2>
          <p className="mt-0.5 text-sm text-ink-muted">From the client's risk questionnaire: excludes {excluded}.</p>
        </div>
      </div>
      {exclusions.holdings.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-y border-line text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                <th className="px-5 py-2.5">Holding</th>
                <th className="px-5 py-2.5">Line</th>
                <th className="px-5 py-2.5">Why</th>
                <th className="px-5 py-2.5 text-right">Value</th>
              </tr>
            </thead>
            <tbody>
              {exclusions.holdings.map((one) => (
                <tr key={one.positionId} className="border-b border-line last:border-b-0">
                  <td className="px-5 py-3 font-semibold">{one.name}</td>
                  <td className="px-5 py-3 text-ink-muted">{one.subSubClass ?? one.subClass ?? one.assetClass}</td>
                  <td className="px-5 py-3">
                    {one.kind === "COUNTRY" ? countryName(one.what) : one.what}
                    <span className="ml-2 rounded-full bg-access-none-soft px-2 py-0.5 text-2xs font-bold text-access-none-ink">
                      excluded {one.kind === "COUNTRY" ? "country" : "sector"}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums">{money(one.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="border-t border-line px-5 py-3 text-xs text-ink-muted">
        {exclusions.holdings.length === 0 && "Nothing held breaks these. "}
        {exclusions.unchecked > 0 && `${exclusions.unchecked} ${exclusions.unchecked === 1 ? "holding has" : "holdings have"} no country or sector written down, so ${exclusions.unchecked === 1 ? "it can't" : "they can't"} be checked. `}
        Holdings recorded as one figure per class can't be checked either.
      </p>
    </section>
  );
}
