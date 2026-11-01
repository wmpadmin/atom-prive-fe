import type { CashflowList, ClientNonFinancialAssets, ClientOverview } from "@atomprive/api-client/backoffice";
import { describe, expect, it } from "vitest";
import { rateOn, restate } from "./overview-data";

const rates = [
  { on: "2026-10-01", value: 0.9 },
  { on: "2026-10-02", value: 0.92 },
  { on: "2026-10-05", value: 0.95 },
];

function overview(currency: string, given = rates): ClientOverview {
  return { currency, baseCurrency: "USD", rates: given } as unknown as ClientOverview;
}

describe("rateOn", () => {
  it("reads the day's own rate, or the latest before it, or the first for a day before them all", () => {
    expect(rateOn(rates, "2026-10-02")).toBe(0.92);
    expect(rateOn(rates, "2026-10-04")).toBe(0.92);
    expect(rateOn(rates, "2026-09-15")).toBe(0.9);
    expect(rateOn(rates, "2026-12-31")).toBe(0.95);
  });
});

describe("restate", () => {
  const owned = { customerId: "c", currency: "USD", total: 1000, items: [{ id: "a", item: "Flat", description: null, valueAmount: 1000 }] } as ClientNonFinancialAssets;
  const cashflows = {
    currency: "USD",
    joinedOn: null,
    paidIn: 100,
    takenOut: 50,
    items: [
      { id: "in", happenedOn: "2026-10-01", amount: 100, currency: "USD", note: null, recordedBy: null, recordedAt: "" },
      { id: "out", happenedOn: "2026-10-03", amount: -50, currency: "USD", note: null, recordedBy: null, recordedAt: "" },
    ],
  } as CashflowList;

  it("restates what is held at today's rate and each movement at its own day's", () => {
    const shown = restate(overview("EUR"), { holdings: undefined, owned, loans: undefined, cashflows });
    expect(shown.owned?.currency).toBe("EUR");
    expect(shown.owned?.total).toBe(950);
    expect(shown.owned?.items[0]?.valueAmount).toBe(950);
    expect(shown.cashflows?.items.map((one) => one.amount)).toEqual([90, -46]);
    expect(shown.cashflows?.paidIn).toBe(90);
    expect(shown.cashflows?.takenOut).toBe(46);
  });

  it("leaves the lists as they are in the portfolio's own currency", () => {
    const lists = { holdings: undefined, owned, loans: undefined, cashflows };
    expect(restate(overview("USD", []), lists)).toBe(lists);
  });
});
