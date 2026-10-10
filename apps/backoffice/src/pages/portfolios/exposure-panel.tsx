import { ApiError } from "@atomprive/api-client";
import {
  useGetClientGeography,
  useGetClientSectors,
  type ExposureTable,
} from "@atomprive/api-client/backoffice";
import { Alert, Badge, cn } from "@atomprive/ui";
import { useState } from "react";
import { standingLabels, standingTones, type DriftStanding } from "./portfolio-labels";

type Dimension = "geography" | "sector";

const TABS: { id: Dimension; label: string; nothing: string }[] = [
  {
    id: "geography",
    label: "By country",
    nothing: "No holding written down line by line names a country yet.",
  },
  { id: "sector", label: "By sector", nothing: "No holding written down line by line names a sector yet." },
];

function money(amount: number, currency: string) {
  return `${currency} ${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** "+4.0pp", "−4.0pp", and a true nothing as "0.0pp". */
function apart(deviation: number) {
  const rounded = deviation.toFixed(1);
  if (Number(rounded) > 0) return `+${rounded}pp`;
  if (Number(rounded) < 0) return `−${rounded.replace("-", "")}pp`;
  return "0.0pp";
}

/**
 * Where a client's money sits by country and by sector, against what the plan asks for.
 *
 * <p>Only a holding written down line by line says what country or line of business it is in, so the panel
 * says how much of the portfolio the answer covers. A figure read against a third of the money is not the
 * same claim as one read against all of it.
 */
export function ExposurePanel({ customerId }: { customerId: string }) {
  const [showing, setShowing] = useState<Dimension>("geography");
  const geography = useGetClientGeography<ExposureTable, ApiError>(customerId);
  const sectors = useGetClientSectors<ExposureTable, ApiError>(customerId);
  const asked = showing === "geography" ? geography : sectors;
  const tab = TABS.find((one) => one.id === showing)!;

  if (asked.isError) {
    // A portfolio with nothing written down has no spread to show, which is not an error worth raising.
    return asked.error.status === 404 ? null : <Alert tone="danger">{asked.error.message}</Alert>;
  }
  const table = asked.data;
  if (!table) return null;
  const items = [...table.items].sort((one, two) => two.actualShare - one.actualShare);

  return (
    <section className="rounded-2xl border border-line bg-white px-6 py-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">Where the money sits</h2>
        <div className="flex rounded-lg border border-line p-0.5">
          {TABS.map((one) => (
            <button
              key={one.id}
              type="button"
              aria-pressed={showing === one.id}
              onClick={() => setShowing(one.id)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-semibold transition-colors",
                showing === one.id ? "bg-primary-600 text-white" : "text-ink-muted hover:text-ink",
              )}
            >
              {one.label}
            </button>
          ))}
        </div>
      </div>

      {items.length === 0 ? (
        <p className="mt-2 text-sm text-ink-muted">{tab.nothing}</p>
      ) : (
        <>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-y border-line text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                  <th scope="col" className="py-2 pr-4">{showing === "geography" ? "Country" : "Sector"}</th>
                  <th scope="col" className="px-4 py-2 text-right">Wanted</th>
                  <th scope="col" className="px-4 py-2 text-right">Held</th>
                  <th scope="col" className="px-4 py-2 text-right">Value</th>
                  <th scope="col" className="px-4 py-2 text-right">Apart</th>
                  <th scope="col" className="py-2 pl-4 text-left">Standing</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {items.map((one) => (
                  <tr key={one.code}>
                    <th scope="row" className="py-2 pr-4 text-left font-medium text-ink">{one.name}</th>
                    {/* The plan may ask nothing of somewhere the money happens to be. */}
                    <td className="px-4 py-2 text-right tabular-nums text-ink-soft">
                      {one.target === null ? "—" : `${one.target.toFixed(2)}%`}
                    </td>
                    <td className="px-4 py-2 text-right font-medium tabular-nums">
                      {one.actualShare.toFixed(2)}%
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-ink-soft">
                      {money(one.actualValue, table.currency)}
                    </td>
                    <td
                      className={cn(
                        "px-4 py-2 text-right font-medium tabular-nums",
                        one.deviation === null
                          ? "text-ink-muted"
                          : one.deviation > 0
                            ? "text-emerald-700"
                            : one.deviation < 0
                              ? "text-red-600"
                              : "text-ink",
                      )}
                    >
                      {one.deviation === null ? "—" : apart(one.deviation)}
                    </td>
                    <td className="py-2 pl-4">
                      {one.standing === null ? (
                        <span className="text-xs text-ink-muted">Not asked for</span>
                      ) : (
                        <Badge tone={standingTones[one.standing as DriftStanding]}>
                          {standingLabels[one.standing as DriftStanding]}
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* How much of the money the answer is actually about. Said plainly, because a spread read against
              part of a portfolio is a different claim from one read against all of it. */}
          <p className="mt-2 text-xs text-ink-muted">
            {table.placed >= 100 ? (
              <>Every holding is written down line by line, so this covers the whole portfolio.</>
            ) : (
              <>
                <span className="font-semibold text-amber-700">
                  This covers {table.placed.toFixed(1)}% of the portfolio.
                </span>{" "}
                Only a holding written down line by line says where it is; the rest is recorded as a class
                total, which says nothing about {showing === "geography" ? "country" : "sector"}.
              </>
            )}
          </p>
        </>
      )}
    </section>
  );
}
