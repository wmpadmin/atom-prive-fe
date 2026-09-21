import { ApiError } from "@atomprive/api-client";
import {
  useSetFormCategories,
  type CatalogueEntry,
  type CatalogueEntryCategoriesItem,
} from "@atomprive/api-client/backoffice";
import { Alert, Button, Dialog } from "@atomprive/ui";
import { useState } from "react";
import { categoryLabels, formCategories } from "./form-labels";

interface FormCategoriesDialogProps {
  form: CatalogueEntry | null;
  onClose: () => void;
  onChanged: (pack: CatalogueEntry[]) => void;
}

/** Which categories a form belongs to. A form can serve more than one, and every form needs at least one. */
export function FormCategoriesDialog({ form, onClose, onChanged }: FormCategoriesDialogProps) {
  const [chosen, setChosen] = useState<CatalogueEntryCategoriesItem[] | null>(null);
  const categories = chosen ?? form?.categories ?? [];
  const change = useSetFormCategories<ApiError>();

  function close() {
    setChosen(null);
    change.reset();
    onClose();
  }

  function toggle(category: CatalogueEntryCategoriesItem) {
    setChosen(categories.includes(category) ? categories.filter((held) => held !== category) : [...categories, category]);
  }

  return (
    <Dialog open={form !== null} title={form ? `Categories: ${form.title}` : "Categories"} onClose={close}>
      <div className="space-y-4">
        <p className="text-sm text-ink-muted">
          Which kinds of account this form is used for. The same form can be used by more than one.
        </p>
        {change.isError && <Alert tone="danger">{change.error.message}</Alert>}
        <ul className="space-y-2">
          {formCategories.map((category) => (
            <li key={category}>
              <label className="flex items-center gap-3 rounded-xl border border-line px-4 py-3 text-sm">
                <input
                  type="checkbox"
                  className="size-4 accent-primary-600"
                  checked={categories.includes(category)}
                  onChange={() => toggle(category)}
                />
                {categoryLabels[category]}
              </label>
            </li>
          ))}
        </ul>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={close} disabled={change.isPending}>
            Cancel
          </Button>
          <Button
            disabled={categories.length === 0 || change.isPending || !form}
            onClick={() =>
              form &&
              change.mutate(
                { kind: form.kind, data: { categories } },
                {
                  onSuccess: (pack) => {
                    onChanged(pack);
                    close();
                  },
                },
              )
            }
          >
            {change.isPending ? "Saving…" : "Save categories"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
