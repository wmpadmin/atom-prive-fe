/** How Holdings check writes money: whole units, and a difference with its sign. */
export function money(amount: number, currency: string) {
  return `${currency} ${amount.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

export function signed(amount: number) {
  return `${amount > 0 ? "+" : "−"}${Math.abs(amount).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}
