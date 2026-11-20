import type { ClientRebalance } from "@atomprive/api-client/backoffice";
import type { KeyboardEvent, MouseEvent } from "react";
import type { FigureDetail } from "../client-workspace/figure-panel";
import { driftLabel, standingLabels, underManagementLabel } from "./portfolio-labels";

/**
 * What a figure on a portfolio screen needs to open the side panel: a press or Enter, held to itself so the row
 * underneath it still opens what it opened before.
 */
export function opens(open: () => void) {
  return {
    role: "button" as const,
    tabIndex: 0,
    onClick: (event: MouseEvent) => {
      event.stopPropagation();
      open();
    },
    onKeyDown: (event: KeyboardEvent) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      event.stopPropagation();
      open();
    },
  };
}

/** The look a figure that opens the panel is given: the pointer, and a faint underline on hover. */
export const OPENS = "cursor-pointer hover:underline hover:decoration-dotted hover:underline-offset-2";

function standingWord(standing: ClientRebalance["standing"]) {
  return standing ? standingLabels[standing] : "Nothing written down";
}

/** The clients behind a figure, one line each, each opening their workspace. Every cell is read off the row. */
export function clientsTable(clients: ClientRebalance[], title: string): NonNullable<FigureDetail["table"]> {
  return {
    title,
    columns: ["Client", "AUM", "Drift", "Standing"],
    rows: clients.map((one) => [
      one.clientName,
      underManagementLabel(one.underManagement, one.currency),
      one.drift == null ? null : driftLabel(one.drift),
      standingWord(one.standing),
    ]),
    links: clients.map((one) => `/client-workspace/${one.customerId}`),
  };
}
