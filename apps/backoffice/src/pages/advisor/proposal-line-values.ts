import type { LineRequest, LineRequestAction } from "@atomprive/api-client/backoffice";

/** A line as the form holds it: every figure typed, so an empty box reads as nothing rather than zero. */
export type TypedLine = {
  asset: string;
  action: LineRequestAction;
  amount: string;
  weightFrom: string;
  weightTo: string;
};

export const EMPTY_LINE: TypedLine = { asset: "", action: "REDUCE", amount: "", weightFrom: "", weightTo: "" };

/** A line counts once it names a holding and says where that holding ends up. */
export function isWritten(line: TypedLine) {
  return line.asset.trim() !== "" && line.weightFrom.trim() !== "" && line.weightTo.trim() !== "";
}

/** The lines as the API takes them: only the written ones, and a hold carries no amount. */
export function linesFrom(lines: TypedLine[]): LineRequest[] {
  return lines.filter(isWritten).map((line) => ({
    asset: line.asset.trim(),
    action: line.action,
    amount: line.action === "HOLD" || line.amount.trim() === "" ? null : Number(line.amount),
    weightFrom: Number(line.weightFrom),
    weightTo: Number(line.weightTo),
  }));
}
