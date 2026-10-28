/**
 * The four trails, and what each one is read from.
 *
 * <p>Not the audit log. A trail was built on it first, because an audit row says who did what and when —
 * but it does not say how much, out of what, into what, or who agreed to it, and those are the questions
 * somebody opening a trail is actually asking. Each trail reads the firm's own record of the work
 * instead: move plans and their legs, proposals and their lines, the asks to move a client's plan.
 */
export type TrailId = "proposals" | "client-requests" | "trades" | "models";

export const TRAILS: { id: TrailId; label: string; description: string }[] = [
  {
    id: "proposals",
    label: "Proposals",
    description:
      "Every proposal the desk wrote for a client, and what became of it.",
  },
  {
    id: "client-requests",
    label: "Client requests",
    description:
      "Money a relationship manager moved because the client asked them to. Nobody else agrees to these "
      + "— whoever wrote it down is whoever carried it out.",
  },
  {
    id: "trades",
    label: "Trades",
    description:
      "Money the desk asked to move and the client's manager agreed to, with every move made under that "
      + "agreement.",
  },
  {
    id: "models",
    label: "Models",
    description: "Every time the firm was asked to move a client from one plan to another.",
  },
];

export function trailOf(id: string | null | undefined) {
  return TRAILS.find((one) => one.id === id) ?? TRAILS[0];
}
