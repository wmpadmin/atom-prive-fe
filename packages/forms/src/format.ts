/**
 * How the forms write dates and open their files, set by the app that shows them.
 *
 * <p>The back office writes a date the way each member of staff has chosen and opens a form's file through its own
 * API; the portal writes dates its own way and opens files through the client's. The forms themselves are the same
 * on both sides, so these two are asked for rather than built in.
 */
export interface FormsSetup {
  formatDate: (value: string) => string;
  /** Opens one file attached to a form, in a new tab. */
  openAttachment: (formId: string, fileId: string, fileName: string) => Promise<void>;
}

const fallback = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" });

let setup: FormsSetup = {
  formatDate: (value) => fallback.format(new Date(value)),
  openAttachment: () => Promise.reject(new Error("Opening a file isn't set up here.")),
};

export function configureForms(chosen: Partial<FormsSetup>) {
  setup = { ...setup, ...chosen };
}

/** "17 Sept 2026", or however the app showing the form writes a day. */
export function formatDate(value: string) {
  return setup.formatDate(value);
}

export function openAttachment(formId: string, fileId: string, fileName: string) {
  return setup.openAttachment(formId, fileId, fileName);
}

/** A file size as people read it, for a document attached to a form. */
export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
