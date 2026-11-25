import { describe, expect, it } from "vitest";
import { restated } from "./shown-currency";

/** A bank-file client's converted reading, in dollars, as the server sends it. */
const converted = {
  currency: "USD",
  ratesOn: "2026-11-25",
  total: 1000,
  currencies: [{ currency: "CHF", asSent: 880, perUsd: 0.88, usd: 1000, rateOn: "2026-11-25" }],
  missing: [{ currency: "XYZ", amount: 5 }],
  byClass: [{ name: "Equity", usd: 600, share: 60 }],
  byCurrency: [{ name: "CHF", usd: 1000, share: 100 }],
  top: [{ name: "Nestle", usd: 1000, share: 100 }],
  lines: [{ name: "Nestle", value: 880, currency: "CHF", usd: 1000, share: 100 }],
  history: [{ day: "2026-11-24", value: 900 }],
  perUsd: { USD: 1, EUR: 0.9, CHF: 0.88 },
};

describe("a client's converted figures in the currency picked at the top of his screens (25 Nov 2026)", () => {
  it("restates every dollar figure at the chosen currency's rate, and leaves what the bank sent as it was", () => {
    const shown = restated({ bankFile: { converted } }, "EUR", 0.9).bankFile.converted;
    expect(shown.currency).toBe("EUR");
    expect(shown.total).toBe(900);
    expect(shown.byClass[0]).toMatchObject({ usd: 540, share: 60 });
    expect(shown.lines[0]).toMatchObject({ value: 880, currency: "CHF", usd: 900 });
    expect(shown.history[0]!.value).toBe(810);
    expect(shown.missing).toEqual([{ currency: "XYZ", amount: 5 }]);
    // Rates re-read against the chosen currency: 880 francs is still 900 euros, and a dollar is 0.9 of them.
    expect(880 / shown.perUsd.CHF!).toBeCloseTo(900, 6);
    expect(shown.perUsd.USD).toBeCloseTo(1 / 0.9, 10);
    expect(shown.currencies[0]!.perUsd).toBeCloseTo(0.88 / 0.9, 10);
  });

  it("restates a bank's dollar totals and lines, a holdings cost, and the fees worked out in dollars", () => {
    const banks = restated({ banks: [{ totalUsd: 100 }], lines: [{ marketValueUsd: 50, asSent: 45 }] }, "GBP", 0.8);
    expect(banks.banks[0]!.totalUsd).toBe(80);
    expect(banks.lines[0]).toMatchObject({ marketValueUsd: 40, asSent: 45 });
    const book = restated({ converted: { costUsd: 200, byBank: [{ name: "EFG", usd: 300, share: 100 }] } }, "GBP", 0.8);
    expect(book.converted).toMatchObject({ costUsd: 160, byBank: [{ usd: 240 }] });
    const fees = restated({ fees: { currency: "USD", ratesOn: null, grossAssets: 1000, annualBp: 50, annualAmount: 5, rates: [{ annualAmount: 5 }],
      paid: [{ amount: 2, asSent: 2, currency: "USD" }, { amount: null, asSent: 3, currency: "XYZ" }], paidAmount: 2, noRate: [] } }, "GBP", 0.8).fees;
    expect(fees).toMatchObject({ currency: "GBP", grossAssets: 800, annualAmount: 4, paidAmount: 1.6, annualBp: 50 });
    expect(fees.paid.map((one) => one.amount)).toEqual([1.6, null]);
  });

  it("restates a bank-file client's IPS classes, measured by the server in dollars, and names the chosen currency", () => {
    const ips = restated({ currency: "USD", bankFile: true, investable: null, ownedOutright: 10, converted,
      allocation: [{ key: "EQUITIES", value: -300, deviationValue: null, actual: -30 }] }, "BRL", 5);
    expect(ips).toMatchObject({ currency: "BRL", ownedOutright: 50, investable: null });
    expect(ips.allocation[0]).toMatchObject({ value: -1500, deviationValue: null, actual: -30 });
    expect(ips.converted.currency).toBe("BRL");
    // A client whose figures are not the bank's is left alone.
    expect(restated({ currency: "USD", bankFile: false, allocation: [{ value: 10 }], converted: null }, "BRL", 5).allocation[0]!.value).toBe(10);
  });
});
