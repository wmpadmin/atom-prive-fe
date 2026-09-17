import type { BankViewConnectionType, BankViewSchedule } from "@atomprive/api-client/backoffice";

export const connectionLabels: Record<BankViewConnectionType, string> = {
  SFTP: "SFTP file drop",
  REST_API: "REST API",
  MANUAL_UPLOAD: "Manual upload",
};

export const scheduleLabels: Record<BankViewSchedule, string> = {
  HOURLY: "Every hour",
  EVERY_6_HOURS: "Every 6 hours",
  TWICE_A_DAY: "Twice a day",
  ONCE_A_DAY: "Once a day",
  ON_UPLOAD: "When a file is uploaded",
};

const dayMonthYear = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" });

const utcDateTime = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "UTC",
});

/** "22 Jul 2026" */
export function formatDay(value: string) {
  return dayMonthYear.format(new Date(value));
}

/** "28 Jul 2026 06:00 UTC", as rates are quoted. */
export function formatUtc(value: string) {
  return `${utcDateTime.format(new Date(value)).replace(",", "")} UTC`;
}
