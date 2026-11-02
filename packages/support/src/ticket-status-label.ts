/** A ticket's status in words. "Waiting" reads as waiting on you to whoever raised it, on them to support. */
export function statusLabel(status: string, side: "raiser" | "support") {
  switch (status) {
    case "OPEN":
      return "Open";
    case "IN_PROGRESS":
      return "In progress";
    case "WAITING":
      return side === "raiser" ? "Waiting on you" : "Waiting on them";
    case "RESOLVED":
      return "Resolved";
    default:
      return "Closed";
  }
}
