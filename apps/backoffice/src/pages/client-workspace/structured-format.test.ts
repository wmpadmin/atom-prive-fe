import { describe, expect, it } from "vitest";
import { asSent, dayMonth, kpiValue, levelText, monthYear, nextEventText, percent, signedMoney, toneClass, withAmount } from "./structured-format";

describe("how the Structured Products screens set the server's figures down (25 Nov 2026)", () => {
  it("puts a line's sum of money in, in the screen's currency, and leaves a missing sum as a dash", () => {
    expect(withAmount("{amount} of notional", 9_000_000, "USD")).toBe("$9M of notional");
    expect(withAmount("{amount} back to reinvest", 5_000_000, "EUR")).toBe("€5M back to reinvest");
    expect(withAmount("{amount} of notional", null, "USD")).toBe("— of notional");
    expect(withAmount("Indicative issuer bids", 10, "USD")).toBe("Indicative issuer bids");
    expect(withAmount(null, 10, "USD")).toBeNull();
  });

  it("signs a change with a true minus, as the design does", () => {
    expect(signedMoney(-420_000, "USD")).toBe("−$420K");
    expect(signedMoney(40_000, "USD")).toBe("+$40K");
    expect(signedMoney(0, "USD")).toBe("$0");
  });

  it("writes a note's next event, its level and a percent as the table does", () => {
    expect(nextEventText("Autocall obs", "2026-12-15")).toBe("Autocall obs 15 Dec");
    expect(nextEventText("Matures", "2028-06-30")).toBe("Matures 30 Jun 2028");
    expect(dayMonth("2026-12-02")).toBe("02 Dec");
    expect(levelText("AAPL", 112)).toBe("AAPL 112.0%");
    expect(levelText(null, 103.1)).toBe("103.1%");
    expect(levelText("TSLA", null)).toBe("—");
    expect(percent(10.54)).toBe("10.54%");
    expect(percent(null)).toBe("—");
  });

  it("writes each kind of figure across the top as the designs do, and a bank's number with every digit sent", () => {
    expect(kpiValue({ unit: "YEARS", value: 3.4, on: null }, "USD")).toBe("3.4 yrs");
    expect(kpiValue({ unit: "PERCENT", value: 72, on: null }, "USD")).toBe("72%");
    expect(kpiValue({ unit: "NOTES", value: 2, on: null }, "USD")).toBe("2 notes");
    expect(kpiValue({ unit: "DATE", value: null, on: "2026-12-15" }, "USD")).toBe("15 Dec");
    expect(kpiValue({ unit: "MONEY", value: 5200, on: null }, "USD")).toBe("$5.2K");
    expect(kpiValue({ unit: "OUT_OF", value: 6, on: null, notes: ["a", "b", "c", "d", "e", "f", "g", "h"] }, "USD")).toBe("6 of 8");
    expect(monthYear("2029-06-20")).toBe("Jun 2029");
    expect(monthYear("2032-09-15")).toBe("Sep 2032");
    expect(signedMoney(-758.5, "USD")).toBe("−$759");
    expect(asSent(0.9987)).toBe("0.9987");
  });

  it("colours a status by its tone", () => {
    expect(toneClass("DANGER")).toContain("red");
    expect(toneClass("WARN")).toContain("amber");
    expect(toneClass("OK")).toContain("emerald");
    expect(toneClass(undefined)).toContain("slate");
  });
});
