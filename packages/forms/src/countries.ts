const regionNames = new Intl.DisplayNames(["en-GB"], { type: "region" });

/** A country's name from its ISO 3166-1 alpha-2 code, in English; the code itself where the browser has no name. */
export function countryName(code: string) {
  try {
    return regionNames.of(code) ?? code;
  } catch {
    return code;
  }
}
