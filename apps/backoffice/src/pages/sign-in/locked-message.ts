const time = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" });

/** What the sign-in screen says after five wrong codes: "Sign-in is locked until 14:35." */
export function lockedMessage(lockedUntil: string | undefined) {
  const until = lockedUntil ? new Date(lockedUntil) : null;
  return until && !Number.isNaN(until.getTime())
    ? `Too many wrong codes. Sign-in is locked until ${time.format(until)}.`
    : "Too many wrong codes. Sign-in is locked for an hour.";
}
