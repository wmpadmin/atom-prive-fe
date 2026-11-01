import { ApiError } from "@atomprive/api-client";
import { useListCurrencies, type Currency } from "@atomprive/api-client/backoffice";
import { cn } from "@atomprive/ui";
import { Check, ChevronDown } from "lucide-react";
import { useState } from "react";
import { Popover } from "./overview-dialogs";

/** The ten currencies the client reports in first, in the order they are usually listed. */
const G10 = ["EUR", "JPY", "GBP", "CHF", "CAD", "AUD", "NZD", "SEK", "NOK", "USD"];

/**
 * The currency a client's figures are shown in, beside their name: the portfolio's own first, then the G10,
 * then the firm's other currencies. Choosing one changes what is shown, never what the portfolio is written in.
 */
export function CurrencyPicker({ base, shown, onPick }: { base: string; shown: string; onPick: (code: string) => void }) {
  const [open, setOpen] = useState(false);
  const listed = useListCurrencies<Currency[], ApiError>({ query: { staleTime: 300_000 } });
  const all = listed.data ?? [];
  const own = all.find((one) => one.code === base) ?? { code: base, name: base };
  const g10 = G10.filter((code) => code !== base)
    .map((code) => all.find((one) => one.code === code))
    .filter((one): one is Currency => Boolean(one));
  const other = all.filter((one) => one.code !== base && !G10.includes(one.code));
  const pick = (code: string) => {
    setOpen(false);
    onPick(code);
  };

  const option = (one: Currency, note?: string) => (
    <button key={one.code} type="button" role="option" aria-selected={one.code === shown} onClick={() => pick(one.code)}
      className={cn("flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm",
        one.code === shown ? "bg-primary-50" : "hover:bg-canvas")}>
      <b className={cn("w-10 font-semibold", one.code === shown ? "text-primary-700" : "text-ink")}>{one.code}</b>
      <span className="flex-1 text-ink-muted">{one.name}</span>
      {note && <span className="rounded bg-canvas px-1.5 py-0.5 text-3xs font-semibold text-ink-soft">{note}</span>}
      {one.code === shown && <Check aria-hidden="true" className="size-4 text-primary-600" />}
    </button>
  );

  return (
    <div className="relative">
      <button type="button" aria-haspopup="listbox" aria-expanded={open} aria-label={`Figures shown in ${shown}. Change currency`}
        onClick={() => setOpen((was) => !was)}
        className={cn("inline-flex h-10 items-center gap-2 rounded-lg border bg-white px-3 text-sm",
          open ? "border-primary-600 text-primary-700" : "border-line text-ink hover:border-ink-muted/50")}>
        {shown}
        <ChevronDown aria-hidden="true" className="size-4" />
      </button>
      <Popover open={open} onClose={() => setOpen(false)} className="top-12 left-0 w-72 p-1.5">
        <div role="listbox" aria-label="Show figures in" className="max-h-96 overflow-y-auto">
          <p className="px-2.5 pt-1.5 pb-1 text-3xs font-bold tracking-wider text-ink-muted uppercase">Client&apos;s base</p>
          {option(own, "Base")}
          {g10.length > 0 && <p className="px-2.5 pt-2.5 pb-1 text-3xs font-bold tracking-wider text-ink-muted uppercase">G10</p>}
          {g10.map((one) => option(one))}
          {other.length > 0 && <p className="px-2.5 pt-2.5 pb-1 text-3xs font-bold tracking-wider text-ink-muted uppercase">Other</p>}
          {other.map((one) => option(one))}
        </div>
        <p className="mt-1 border-t border-line px-2.5 pt-2 pb-1 text-xs text-ink-muted">
          Past figures use each day&apos;s own rate. AED follows the fixed USD peg (3.6725).
        </p>
      </Popover>
    </div>
  );
}
