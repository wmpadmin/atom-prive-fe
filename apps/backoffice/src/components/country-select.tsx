import { SelectInput } from "@atomprive/ui";
import { X } from "lucide-react";
import { countries, countryName, officeCountries } from "../lib/countries";

interface CountrySelectProps {
  id: string;
  /** ISO 3166 two-letter code. */
  value: string | null;
  onChange: (code: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}

/** Every country, with the ones the firm has offices in listed first. */
export function CountrySelect({ id, value, onChange, onBlur, placeholder = "Choose a country", ...aria }: CountrySelectProps) {
  return (
    <SelectInput id={id} value={value ?? ""} onChange={(event) => onChange(event.target.value)} onBlur={onBlur} {...aria}>
      <option value="" disabled>
        {placeholder}
      </option>
      {officeCountries.map((country) => (
        <option key={`office-${country.code}`} value={country.code}>
          {country.name}
        </option>
      ))}
      <option disabled>──────────</option>
      {countries.map((country) => (
        <option key={country.code} value={country.code}>
          {country.name}
        </option>
      ))}
    </SelectInput>
  );
}

interface CountriesPickerProps {
  id: string;
  /** ISO 3166 two-letter codes, in the order they were added. */
  value: string[];
  onChange: (codes: string[]) => void;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}

/** Several countries: each one chosen from the list becomes a chip that can be removed again. */
export function CountriesPicker({ id, value, onChange, ...aria }: CountriesPickerProps) {
  const notChosen = (code: string) => !value.includes(code);
  return (
    <div className="space-y-2.5">
      <SelectInput
        id={id}
        value=""
        onChange={(event) => {
          if (event.target.value) onChange([...value, event.target.value]);
        }}
        {...aria}
      >
        <option value="">{value.length > 0 ? "Add another country" : "Choose countries"}</option>
        {officeCountries.filter((country) => notChosen(country.code)).map((country) => (
          <option key={`office-${country.code}`} value={country.code}>
            {country.name}
          </option>
        ))}
        <option disabled>──────────</option>
        {countries.filter((country) => notChosen(country.code)).map((country) => (
          <option key={country.code} value={country.code}>
            {country.name}
          </option>
        ))}
      </SelectInput>
      {value.length > 0 && (
        <ul aria-label="Chosen countries" className="flex flex-wrap gap-2">
          {value.map((code) => (
            <li key={code} className="inline-flex items-center gap-1 rounded-full border border-primary-100 bg-primary-50 py-1 pr-1 pl-3 text-xs font-semibold text-primary-700">
              {countryName(code)}
              <button
                type="button"
                aria-label={`Remove ${countryName(code)}`}
                onClick={() => onChange(value.filter((chosen) => chosen !== code))}
                className="grid size-5 place-items-center rounded-full hover:bg-primary-100"
              >
                <X aria-hidden="true" className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
