import type { BankAccountRow } from "@atomprive/api-client/backoffice";

export const accountTypes = ["CURRENT", "SAVINGS", "CUSTODY", "INVESTMENT"] as const satisfies readonly BankAccountRow["accountType"][];

export const accountTypeLabels: Record<BankAccountRow["accountType"], string> = {
  CURRENT: "Current",
  SAVINGS: "Savings",
  CUSTODY: "Custody",
  INVESTMENT: "Investment",
};

/** Where a linked account stands with its bank, in the words the screen uses. */
export function bankAccountStatus(status: BankAccountRow["status"]): { label: string; tone: "neutral" | "success" | "warning" | "danger" } {
  switch (status) {
    case "VERIFIED":
      return { label: "Verified", tone: "success" };
    case "FAILED":
      return { label: "Failed", tone: "danger" };
    case "SYNC_ERROR":
      return { label: "Sync error", tone: "danger" };
    case "DEACTIVATED":
      return { label: "Taken off", tone: "neutral" };
    default:
      return { label: "Waiting on the bank", tone: "warning" };
  }
}

/** The currencies the firm's clients hold accounts in. Reference data will take this over. */
export const currencies = ["AED", "USD", "EUR", "GBP", "SGD", "INR", "CHF"] as const;
