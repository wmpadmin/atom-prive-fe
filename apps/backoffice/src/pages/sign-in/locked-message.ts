const time = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" });

/** What the sign-in screen says after too many wrong passwords or codes: "Sign-in is locked until 14:35." */
export function lockedMessage(lockedUntil: string | undefined) {
  const until = lockedUntil ? new Date(lockedUntil) : null;
  return until && !Number.isNaN(until.getTime())
    ? `Too many failed sign-in attempts. Sign-in is locked until ${time.format(until)}.`
    : "Too many failed sign-in attempts. Sign-in is locked for now; try again later.";
}
