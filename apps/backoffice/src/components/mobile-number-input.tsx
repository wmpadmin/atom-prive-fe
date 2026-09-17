import { TextInput } from "@atomprive/ui";
import { useState } from "react";
import { composeMobileNumber, detectInternational, isTooLong, mobileExample, splitMobileNumber, type CountryCode } from "../lib/mobile-numbers";
import { CountryCodePicker } from "./country-code-picker";

interface MobileNumberInputProps {
  id: string;
  /** The number with its country code, such as +919876543210; it may be incomplete while it's typed. */
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}

/**
 * Country code picker and mobile number, for forms that keep their values in state. Digits beyond the longest
 * mobile number in the chosen country can't be typed, and a number pasted with its own +code switches the country.
 */
export function MobileNumberInput({ id, value, onChange, onBlur, ...aria }: MobileNumberInputProps) {
  const [saved] = useState(() => splitMobileNumber(value));
  const [country, setCountry] = useState<CountryCode>(saved.country);
  const [number, setNumber] = useState(saved.national);

  function update(nextCountry: CountryCode, typed: string) {
    setCountry(nextCountry);
    setNumber(typed);
    onChange(composeMobileNumber(nextCountry, typed));
  }

  function changeNumber(typed: string) {
    if (/[^\d\s()+-]/.test(typed)) return;
    const international = detectInternational(typed);
    if (international) {
      update(international.country, international.national);
    } else if (!isTooLong(country, typed)) {
      update(country, typed);
    }
  }

  return (
    <div className="flex gap-2">
      <CountryCodePicker value={country} onChange={(next) => update(next, number)} />
      <TextInput
        id={id}
        type="tel"
        inputMode="tel"
        autoComplete="off"
        placeholder={mobileExample(country)}
        value={number}
        onChange={(event) => changeNumber(event.target.value)}
        onBlur={onBlur}
        {...aria}
      />
    </div>
  );
}
