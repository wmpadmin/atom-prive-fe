/** What a ticket can be about, in the words whoever raises it reads. */
export const CATEGORY_LABELS: Record<string, string> = {
  ACCESS: "Access & sign-in",
  PORTFOLIO: "Portfolio",
  DOCUMENTS: "Documents",
  REPORTS: "Reports",
  DATA: "Data update",
  OTHER: "Other",
};

/** How urgent a ticket is, which sets how soon it should be answered. */
export const PRIORITY_LABELS: Record<string, string> = { HIGH: "High", MEDIUM: "Medium", LOW: "Low" };

export const PRIORITY_TONES: Record<string, string> = {
  HIGH: "bg-red-50 text-red-700",
  MEDIUM: "bg-amber-50 text-amber-700",
  LOW: "bg-emerald-50 text-emerald-700",
};
