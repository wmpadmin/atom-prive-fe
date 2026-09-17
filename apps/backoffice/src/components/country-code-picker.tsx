import { ChevronDown } from "lucide-react";
import { mobileCountries, mobileCountry, type CountryCode } from "../lib/mobile-numbers";

interface CountryCodePickerProps {
  value: CountryCode;
  onChange: (country: CountryCode) => void;
  /** Form field name, for forms read with FormData. */
  name?: string;
}

/**
 * The flag and dialling code in front of a phone number. The native select sits invisibly on top, so the picker
 * works with the keyboard and screen readers, and the list shows full country names.
 */
export function CountryCodePicker({ value, onChange, name }: CountryCodePickerProps) {
  const selected = mobileCountry(value);
  return (
    <div className="relative flex h-10 shrink-0 items-center gap-1.5 rounded-lg border border-line bg-white pr-2 pl-3 text-sm text-ink focus-within:border-primary-600 focus-within:ring-2 focus-within:ring-primary-600/15">
      <span aria-hidden="true">{selected.flag}</span>
      <span aria-hidden="true" className="font-medium tabular-nums">
        +{selected.callingCode}
      </span>
      <ChevronDown aria-hidden="true" className="size-4 text-ink-muted" />
      <select
        name={name}
        aria-label="Country code"
        value={value}
        onChange={(event) => onChange(event.target.value as CountryCode)}
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        {mobileCountries.offices.map((option) => (
          <option key={`office-${option.code}`} value={option.code}>
            {option.flag} {option.name} (+{option.callingCode})
          </option>
        ))}
        <option disabled>──────────</option>
        {mobileCountries.all.map((option) => (
          <option key={option.code} value={option.code}>
            {option.flag} {option.name} (+{option.callingCode})
          </option>
        ))}
      </select>
    </div>
  );
}
