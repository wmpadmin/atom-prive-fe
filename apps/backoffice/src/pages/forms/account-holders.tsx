import { Button } from "@atomprive/ui";
import { Plus, Trash2 } from "lucide-react";

/**
 * The bar above every part of a form that is asked of each account holder in turn. A joint account is one
 * form however many people hold it, so this is where another of them is added or taken off again.
 */
export function AccountHolders({
  names,
  at,
  onAdd,
  onRemove,
}: {
  /** What each holder is called, in the order the form names them. */
  names: string[];
  /** Which of them the part on screen belongs to. */
  at: number;
  onAdd: () => void;
  onRemove: () => void;
}) {
  const joint = names.length > 1;
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-canvas px-4 py-3">
      <p className="text-sm">
        {joint ? (
          <>
            <span className="font-semibold">{names[at]}</span>
            <span className="text-ink-muted">
              {" "}
              · holder {at + 1} of {names.length}
            </span>
          </>
        ) : (
          <span className="text-ink-muted">One account holder. Add another if the account is held jointly.</span>
        )}
      </p>
      <div className="flex gap-2">
        {joint && at > 0 && (
          <Button variant="ghost" size="sm" onClick={onRemove}>
            <Trash2 aria-hidden="true" />
            Take this holder off
          </Button>
        )}
        <Button variant="secondary" size="sm" onClick={onAdd}>
          <Plus aria-hidden="true" />
          Add an account holder
        </Button>
      </div>
    </div>
  );
}
