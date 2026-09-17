import { Badge } from "@atomprive/ui";
import { statusLabels, type StaffStatus } from "../../lib/labels";

const tones = { ACTIVE: "success", INVITED: "info", DEACTIVATED: "neutral" } as const;

export function StatusBadge({ status }: { status: StaffStatus }) {
  return <Badge tone={tones[status]}>{statusLabels[status]}</Badge>;
}
