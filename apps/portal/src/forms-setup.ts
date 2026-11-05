import { httpFile } from "@atomprive/api-client";
import { configureForms } from "@atomprive/forms/format";

/** The shared forms open a file on one of the client's own forms through the portal's API, in a new tab. */
configureForms({
  openAttachment: async (formId, fileId) => {
    // Opened while the click is still the client's, or the browser takes it for a pop-up.
    const opened = window.open("", "_blank");
    try {
      const blob = await httpFile(`/api/portal/forms/${formId}/attachments/${fileId}`);
      const href = URL.createObjectURL(blob);
      if (opened) opened.location.replace(href);
      else window.location.assign(href);
    } catch (failed) {
      opened?.close();
      throw failed;
    }
  },
});
