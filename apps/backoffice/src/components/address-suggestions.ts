import { useListCities, useListPostalCodes, useListStates } from "@atomprive/api-client/backoffice";
import { useEffect, useState } from "react";
import type { Offered } from "./suggest-input";

/** The value once it has stopped changing for a moment, so a lookup is asked once a word is typed, not per key. */
function useSettledValue(value: string, wait = 500) {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(value), wait);
    return () => window.clearTimeout(timer);
  }, [value, wait]);
  return settled;
}

/**
 * What an address's boxes offer as they are filled in: the country's states, then the towns of the state, then —
 * where a postal service knows them — the town's postal codes. Shared by every address the back office takes, so
 * they all behave the same.
 */
export function useAddressSuggestions(address: { country?: string | null; state?: string | null; city?: string | null }) {
  const country = address.country ?? "";
  const state = useSettledValue((address.state ?? "").trim());
  const city = useSettledValue((address.city ?? "").trim());
  const states = useListStates(country, { query: { enabled: country !== "", staleTime: Infinity } });
  const cities = useListCities(country, { state }, { query: { enabled: country !== "" && state !== "", staleTime: Infinity } });
  const codes = useListPostalCodes(country, { state, city }, {
    query: { enabled: country !== "" && state !== "" && city.length > 1, staleTime: Infinity },
  });
  return {
    states: (states.data ?? []).map((one): Offered => ({ value: one.name })),
    cities: (cities.data ?? []).map((name): Offered => ({ value: name })),
    postalCodes: (codes.data ?? []).map((one): Offered => ({ value: one.code, detail: one.area })),
    /** The codes as last answered, to fill in a town's only one when it arrives. */
    postalCodesAnswer: codes.data,
    lookingUpPostalCodes: codes.isFetching,
  };
}
