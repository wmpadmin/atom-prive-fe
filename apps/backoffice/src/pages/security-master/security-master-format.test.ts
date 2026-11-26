import { describe, expect, it } from "vitest";
import { applies, bands, cellText } from "./security-master-format";

const day = (iso: string) => `day:${iso}`;

describe("a Security master cell", () => {
  it("keeps a number as sent, with at least the template's decimals and the thousands grouped", () => {
    expect(cellText({ key: "px_last", type: "NUMBER", decimals: 2 }, "1250.4", day)).toBe("1,250.40");
    expect(cellText({ key: "px_last", type: "NUMBER", decimals: 2 }, "0.12345", day)).toBe("0.12345");
    expect(cellText({ key: "chg_ytd", type: "PERCENT", decimals: 2 }, "12.5", day)).toBe("12.50");
    expect(cellText({ key: "z_spread", type: "NUMBER", decimals: null }, "112", day)).toBe("112");
    expect(cellText({ key: "volume", type: "INTEGER", decimals: 0 }, "2450000", day)).toBe("2,450,000");
    expect(cellText({ key: "mkt_cap", type: "MILLIONS", decimals: null }, "15234.75", day)).toBe("15,234.75");
  });

  it("names the asset class, writes a date the reader's way and leaves text alone", () => {
    expect(cellText({ key: "asset_class", type: "TEXT", decimals: null }, "FIXED_INCOME_ETF", day)).toBe("Fixed Income ETF");
    expect(cellText({ key: "maturity", type: "DATE", decimals: null }, "2031-03-15", day)).toBe("day:2031-03-15");
    expect(cellText({ key: "rtg_sp", type: "TEXT", decimals: null }, "AA-", day)).toBe("AA-");
    expect(cellText({ key: "rtg_sp", type: "TEXT", decimals: null }, undefined, day)).toBeNull();
  });

  it("knows a column that does not apply to the security's asset class, which is left blank", () => {
    expect(applies({ appliesTo: ["FIXED_INCOME"] }, "EQUITY")).toBe(false);
    expect(applies({ appliesTo: ["EQUITY", "FIXED_INCOME"] }, "EQUITY")).toBe(true);
  });

  it("draws one band over each run of columns in the same category", () => {
    expect(bands([{ category: "Asset Class" }, { category: "Identifiers" }, { category: "Identifiers" }, { category: "Yield" }]))
      .toEqual([{ category: "Asset Class", span: 1 }, { category: "Identifiers", span: 2 }, { category: "Yield", span: 1 }]);
  });
});
