import { httpFile } from "@atomprive/api-client";

/** Saves text the API returned (such as a CSV export) as a file in the browser's downloads. */
export function downloadTextFile(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  // Revoking straight away can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

/**
 * Opens a file the API holds — a client's passport, an attached document — in a new tab. The API is behind
 * the session's token, which a plain link in a new tab does not carry, so the file is fetched here and the
 * tab is pointed at what came back. The tab is opened first, while the click is still the user's, or the
 * browser takes it for a pop-up.
 */
export async function openApiFile(url: string, fileName?: string): Promise<void> {
  // Opened while the click is still the user's, or the browser takes it for a pop-up. No "noopener" here:
  // with it the browser hands back nothing, and there is no tab left to point at the file.
  const tab = window.open("", "_blank");
  try {
    const blob = await httpFile(url);
    const href = URL.createObjectURL(blob);
    if (tab) {
      tab.location.href = href;
    } else {
      // Pop-ups are blocked, so the file is saved instead of shown.
      const link = document.createElement("a");
      link.href = href;
      link.download = fileName ?? "document";
      document.body.append(link);
      link.click();
      link.remove();
    }
    // Long enough for the tab to have taken it; the browser frees it with the tab.
    setTimeout(() => URL.revokeObjectURL(href), 60_000);
  } catch (caught) {
    tab?.close();
    throw caught;
  }
}
