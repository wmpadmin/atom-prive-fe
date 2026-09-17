import {
  AsYouType,
  getCountries,
  getCountryCallingCode,
  getExampleNumber,
  Metadata,
  parsePhoneNumber,
  type CountryCode,
  type PhoneNumber,
} from "libphonenumber-js/mobile";
import examples from "libphonenumber-js/mobile/examples";
import { countryName, officeCountryCodes } from "./countries";

// Mobile numbers are stored with their country code, such as +919876543210, and checked against that country's
// numbering rules. The API checks them again with the same rules (Google's libphonenumber data).

export type { CountryCode };

export interface MobileCountry {
  code: CountryCode;
  name: string;
  callingCode: string;
  flag: string;
}

export const defaultMobileCountry: CountryCode = "IN";

/** "IN" becomes the Indian flag emoji. */
function flagOf(code: string) {
  return String.fromCodePoint(...[...code].map((letter) => 0x1f1e6 + letter.charCodeAt(0) - 65));
}

function toMobileCountry(code: CountryCode): MobileCountry {
  return { code, name: countryName(code), callingCode: getCountryCallingCode(code), flag: flagOf(code) };
}

const allCountries = getCountries()
  .map(toMobileCountry)
  .sort((a, b) => a.name.localeCompare(b.name, "en-GB"));

export const mobileCountries = {
  offices: officeCountryCodes.map(toMobileCountry),
  all: allCountries,
};

export function mobileCountry(code: string): MobileCountry {
  return allCountries.find((country) => country.code === code) ?? toMobileCountry(defaultMobileCountry);
}

const metadata = new Metadata();

interface NumberingPlanLengths {
  possibleLengths(): number[];
  /** Not in the library's typings, but it's how its own checks read the lengths for one type of number. */
  type?(type: "MOBILE"): { possibleLengths(): number[] } | undefined;
}

/** How many digits a mobile number has in this country, without the country code. */
function mobileLengths(country: CountryCode): number[] {
  metadata.selectNumberingPlan(country);
  const plan = metadata.numberingPlan as NumberingPlanLengths | undefined;
  return plan?.type?.("MOBILE")?.possibleLengths() ?? plan?.possibleLengths() ?? [];
}

/** "10 digits", "10 or 11 digits" or "7 to 13 digits". */
function describeLengths(lengths: number[]) {
  const min = Math.min(...lengths);
  const max = Math.max(...lengths);
  if (min === max) return `${min} digits`;
  return lengths.length === 2 ? `${min} or ${max} digits` : `${min} to ${max} digits`;
}

/** A mobile number as someone in that country would type it, such as "81234 56789" for India. */
export function mobileExample(country: CountryCode) {
  const example = getExampleNumber(country, examples);
  return example ? new AsYouType(country).input(example.nationalNumber) : "";
}

/** The country's rule, shown under the field: "10 digits, for example 81234 56789". */
export function mobileRule(country: CountryCode) {
  const lengths = mobileLengths(country);
  const example = mobileExample(country);
  const digits = lengths.length > 0 ? describeLengths(lengths) : "";
  if (digits && example) return `${digits}, for example ${example}`;
  return digits || (example ? `For example ${example}` : "");
}

export function invalidMobileMessage(country: CountryCode) {
  const rule = mobileRule(country);
  return `Enter a valid +${getCountryCallingCode(country)} mobile number${rule ? `: ${rule.charAt(0).toLowerCase()}${rule.slice(1)}` : ""}.`;
}

function parse(text: string, country?: CountryCode): PhoneNumber | undefined {
  try {
    return parsePhoneNumber(text, country);
  } catch {
    return undefined;
  }
}

/** What was typed for the chosen country: the number as stored, or why it can't be used. */
export function checkMobileNumber(country: CountryCode, typed: string): { number?: string; problem?: "missing" | "invalid" } {
  if (!/\d/.test(typed)) return { problem: "missing" };
  const parsed = parse(typed.trim(), country);
  return parsed?.isValid() ? { number: parsed.number } : { problem: "invalid" };
}

/**
 * What was typed, saved with its country code even while it's incomplete: "98765" for India is saved as "+9198765",
 * so a draft keeps both the country and the digits.
 */
export function composeMobileNumber(country: CountryCode, typed: string) {
  const digits = typed.replace(/\D/g, "");
  if (!digits) return "";
  if (typed.trim().startsWith("+")) return `+${digits}`;
  return parse(typed.trim(), country)?.number ?? `+${getCountryCallingCode(country)}${digits}`;
}

/** For a number saved with its country code: nothing when it's a valid mobile number, otherwise the message to show. */
export function mobileNumberMessage(saved: string) {
  const parsed = parse(saved);
  if (parsed?.isValid()) return undefined;
  return parsed?.country ? invalidMobileMessage(parsed.country) : "Enter a valid mobile number for the country you chose.";
}

/** True when there are more digits than any mobile number in the country has, allowing a leading 0. */
export function isTooLong(country: CountryCode, typed: string) {
  const digits = typed.replace(/\D/g, "");
  const lengths = mobileLengths(country);
  if (lengths.length === 0 || typed.trim().startsWith("+")) return false;
  return digits.length > Math.max(...lengths) + (digits.startsWith("0") ? 1 : 0);
}

/** A number pasted or typed with its own +code, split into its country and the rest. */
export function detectInternational(typed: string): { country: CountryCode; national: string } | undefined {
  if (!typed.trim().startsWith("+")) return undefined;
  const formatter = new AsYouType();
  formatter.input(typed);
  const country = formatter.getCountry();
  const nationalNumber = formatter.getNumber()?.nationalNumber;
  return country && nationalNumber ? { country, national: new AsYouType(country).input(nationalNumber) } : undefined;
}

/** A saved number split for editing, such as +919876543210 into India and "98765 43210". */
export function splitMobileNumber(saved: string | null | undefined): { country: CountryCode; national: string } {
  const parsed = saved ? parse(saved) : undefined;
  if (parsed?.country) {
    return { country: parsed.country, national: new AsYouType(parsed.country).input(parsed.nationalNumber) };
  }
  return { country: defaultMobileCountry, national: saved ?? "" };
}

/** A saved number for reading, such as "+91 98765 43210". */
export function formatMobileNumber(saved: string | null | undefined) {
  if (!saved) return null;
  return parse(saved)?.formatInternational() ?? saved;
}
