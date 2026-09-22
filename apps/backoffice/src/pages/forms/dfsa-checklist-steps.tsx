import { cn } from "@atomprive/ui";
import { ChoiceCards } from "../../components/choice-cards";
import { Documents, type FormDocuments } from "../../components/form-documents";
import type { FieldFor } from "../../components/form-fields";
import type { ChecklistGroup, DfsaChecklistEntity } from "./dfsa-checklist";
import { useFirmShortName } from "./firm-name";

/**
 * One heading of the checklist. Each line is ticked off and the document it asks for is attached to it, so the
 * checklist and the file it was ticked for are never in two places.
 */
export function ChecklistStep({
  group,
  value,
  formId,
  documents,
  onChange,
  field,
}: {
  group: ChecklistGroup;
  value: DfsaChecklistEntity;
  formId: string;
  documents: FormDocuments;
  onChange: (patch: Partial<DfsaChecklistEntity>) => void;
  field: FieldFor;
}) {
  const shortName = useFirmShortName();
  const applies = value.applies[group.id];
  const tick = (id: string, on: boolean) => onChange({ obtained: { ...value.obtained, [id]: on } });

  return (
    <div className="space-y-5">
      {group.whereItApplies && (
        <ChoiceCards
          name={`applies.${group.id}`}
          legend="Does this apply to the client?"
          required
          compact
          value={applies === undefined ? null : applies ? "yes" : "no"}
          onChange={(picked) => onChange({ applies: { ...value.applies, [group.id]: picked === "yes" } })}
          choices={[
            { value: "yes", label: "Yes" },
            { value: "no", label: "No — nothing here is needed" },
          ]}
          error={field(`applies.${group.id}`).error}
        />
      )}

      {(!group.whereItApplies || applies === true) && (
        <ul className="space-y-3">
          {group.items.map((item) => {
            const on = value.obtained[item.id] === true;
            const held = documents.files.filter((file) => file.field === item.id);
            const problem = field(`obtained.${item.id}`).error;
            return (
              <li
                key={item.id}
                className={cn(
                  "rounded-xl border transition-colors",
                  on ? "border-primary-600 bg-primary-50/70" : "border-line bg-white hover:border-primary-100",
                )}
              >
                <div
                  // The whole line ticks it off, not just the box: the text, the bullets under it, the space
                  // around them. A click that lands on the attachment below, or on the text itself, is left to
                  // what it hit — the label already ticks the box, and the file controls are their own.
                  onClick={(event) => {
                    if ((event.target as HTMLElement).closest("input, button, a, label")) return;
                    tick(item.id, !on);
                  }}
                  className="flex cursor-pointer items-start gap-3 p-3.5"
                >
                  <input
                    type="checkbox"
                    id={item.id}
                    checked={on}
                    onChange={(event) => tick(item.id, event.target.checked)}
                    className="mt-0.5 size-4 shrink-0 rounded-[3px] accent-primary-600"
                  />
                  <div className="min-w-0 flex-1">
                    <label htmlFor={item.id} className="cursor-pointer text-sm leading-relaxed text-ink">
                      {/* The last line of the checklist names the firm by its short name. */}
                      {shortName ? item.text.replaceAll("{{firmShortName}}", shortName) : item.text}
                    </label>
                    {item.covers && (
                      <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-xs text-ink-muted">
                        {item.covers.map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    )}
                    {problem && <p className="mt-1.5 text-xs text-amber-700">{problem}</p>}
                  </div>
                </div>
                {/* Once it is on file, this is where the file goes. */}
                {(on || held.length > 0) && (
                  <div className="border-t border-primary-100 px-3.5 py-3">
                    <Documents formId={formId} field={item.id} documents={documents} label="Attach what was obtained" />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
