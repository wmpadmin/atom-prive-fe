import { configureForms } from "@atomprive/forms/format";
import { openApiFile } from "./lib/download";
import { formatDate } from "./lib/labels";

/** The shared forms write dates as this member of staff has chosen, and open files through the back office's API. */
configureForms({
  formatDate,
  openAttachment: (formId, fileId, fileName) => openApiFile(`/api/backoffice/forms/${formId}/attachments/${fileId}`, fileName),
});
