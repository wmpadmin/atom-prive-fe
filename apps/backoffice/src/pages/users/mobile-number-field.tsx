import { describedBy, Field, TextInput } from "@atomprive/ui";
import { useState } from "react";
import { CountryCodePicker } from "../../components/country-code-picker";
import {
  checkMobileNumber,
  detectInternational,
  invalidMobileMessage,
  isTooLong,
  mobileExample,
  splitMobileNumber,
  type CountryCode,
} from "../../lib/mobile-numbers";

interface MobileNumberFieldProps {
  /** The saved number, such as +919876543210. */
  defaultValue?: string | null;
  error?: string;
  /** Called when the person moves on from the number, with the message to show if it breaks the country's rules. */
  onCheck: (message: string | undefined) => void;
}

/**
 * Country code picker and mobile number. The placeholder shows an example for the chosen country, digits beyond
 * the longest mobile number there can't be typed, and the country's rule is spelled out only if the number breaks
 * it. The form reads "phoneCountry" and "phone".
 */
export function MobileNumberField({ defaultValue, error, onCheck }: MobileNumberFieldProps) {
  const [saved] = useState(() => splitMobileNumber(defaultValue));
  const [country, setCountry] = useState<CountryCode>(saved.country);
  const [number, setNumber] = useState(saved.national);

  function changeNumber(typed: string) {
    if (/[^\d\s()+-]/.test(typed)) return;
    // A number pasted with its own country code switches the picker to that country.
    const international = detectInternational(typed);
    if (international) {
      setCountry(international.country);
      setNumber(international.national);
    } else if (!isTooLong(country, typed)) {
      setNumber(typed);
    }
  }

  function check() {
    onCheck(checkMobileNumber(country, number).problem === "invalid" ? invalidMobileMessage(country) : undefined);
  }

  return (
    <Field id="phone" label="Mobile" required error={error}>
      <div className="flex gap-2">
        <CountryCodePicker name="phoneCountry" value={country} onChange={setCountry} />
        <TextInput
          {...describedBy("phone", error)}
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="off"
          placeholder={mobileExample(country)}
          value={number}
          onChange={(event) => changeNumber(event.target.value)}
          onBlur={check}
          required
        />
      </div>
    </Field>
  );
}
