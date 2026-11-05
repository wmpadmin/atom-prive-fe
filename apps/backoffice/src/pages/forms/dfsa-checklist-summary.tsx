import type { AttachedFile } from "@atomprive/api-client/backoffice";
import { Button } from "@atomprive/ui";
import { PencilLine } from "lucide-react";
import type { ReactNode } from "react";
import { AttachedFiles } from "../../components/attached-files";
import type { ChecklistGroup, DfsaChecklistEntity } from "./dfsa-checklist";

/** Everything ticked off, heading by heading, with what was attached against each line. */
export function DfsaChecklistSummary({
  groups,
  value,
  attachments,
  formId,
  onEdit,
}: {
  groups: ChecklistGroup[];
  value: DfsaChecklistEntity;
  attachments: AttachedFile[];
  formId: string;
  onEdit?: (stepId: string) => void;
}) {
  return (
    <div className="space-y-5">
      {groups.map((group) => {
        const applies = value.applies[group.id];
        return (
          <Part key={group.id} title={group.heading} stepId={group.id} onEdit={onEdit}>
            {group.whereItApplies && applies !== true ? (
              <p className="text-sm text-ink-muted">
                {applies === false ? "Does not apply to this client." : "Not yet said whether this applies."}
              </p>
            ) : (
              <ul className="space-y-2">
                {group.items.map((item) => {
                  const held = attachments.filter((file) => file.field === item.id);
                  return (
                    <li key={item.id} className="flex items-start gap-3 text-sm">
                      <span
                        aria-hidden="true"
                        className={value.obtained[item.id] ? "text-emerald-600" : "text-ink-muted"}
                      >
                        {value.obtained[item.id] ? "✓" : "—"}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-ink">{item.text}</span>
                        <span className="block text-xs">
                          <AttachedFiles formId={formId} files={held} />
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Part>
        );
      })}
    </div>
  );
}

function Part({
  title,
  stepId,
  onEdit,
  children,
}: {
  title: string;
  stepId: string;
  onEdit?: (stepId: string) => void;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-line bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
        <h3 className="text-sm font-bold">{title}</h3>
        {onEdit && (
          <Button variant="ghost" size="sm" onClick={() => onEdit(stepId)}>
            <PencilLine aria-hidden="true" />
            Edit
          </Button>
        )}
      </div>
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}
