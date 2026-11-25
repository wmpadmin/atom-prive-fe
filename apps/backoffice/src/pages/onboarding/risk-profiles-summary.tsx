import { Badge, Button } from "@atomprive/ui";
import { PencilLine } from "lucide-react";
import { bandNames, profileNames, riskGroup, riskScores, type FormRiskProfile } from "./risk-profiling";

interface RiskProfilesSummaryProps {
  profiles: FormRiskProfile[];
  /** Whether each profile has every answer it needs, by its index. */
  complete: (index: number) => boolean;
  /** When given, each profile offers Edit, which opens its first step still missing something. */
  onEdit?: (index: number) => void;
}

/**
 * Each account holder's Schedule 6 (one each since 25 Nov 2026, none added or taken out), a line each, on Review and
 * on the case.
 */
export function RiskProfilesSummary({ profiles, complete, onEdit }: RiskProfilesSummaryProps) {
  return (
    <section className="rounded-xl border border-line">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-slate-50/60 px-4 py-2.5">
        <h3 className="text-sm font-bold">
          Risk questionnaires <span className="font-medium text-ink-muted">· {profiles.length} on this account</span>
        </h3>
      </div>
      <div className="overflow-x-auto px-4 py-2">
        <table className="w-full min-w-[52rem] text-sm">
          <thead>
            <tr className="text-left text-xs text-ink-muted">
              <th scope="col" className="py-2 pr-6 font-semibold whitespace-nowrap"><span className="sr-only">Risk questionnaire</span></th>
              <th scope="col" className="py-2 pr-6 font-semibold whitespace-nowrap">Filled in for</th>
              <th scope="col" className="py-2 pr-6 font-semibold whitespace-nowrap">Risk ability</th>
              <th scope="col" className="py-2 pr-6 font-semibold whitespace-nowrap">Risk tolerance</th>
              <th scope="col" className="py-2 pr-6 font-semibold whitespace-nowrap">From the matrix</th>
              <th scope="col" className="py-2 pr-6 font-semibold whitespace-nowrap">Client agrees</th>
              <th scope="col" className="py-2"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {profiles.map((profile, index) => {
              const scores = riskScores(profile);
              return (
                <tr key={index} className="border-t border-line align-middle">
                  <th scope="row" className="py-2.5 pr-6 text-left font-semibold whitespace-nowrap">
                    {riskGroup(index)}
                    {onEdit && !complete(index) && <div className="mt-1"><Badge tone="warning">Needs details</Badge></div>}
                  </th>
                  <td className="min-w-48 py-2.5 pr-6">{profile.filledInFor?.trim() || <span className="text-ink-muted">—</span>}</td>
                  <td className="py-2.5 pr-6 whitespace-nowrap tabular-nums">
                    {scores.abilityBand ? `${bandNames[scores.abilityBand]} · ${scores.ability}` : <span className="text-ink-muted">—</span>}
                  </td>
                  <td className="py-2.5 pr-6 whitespace-nowrap tabular-nums">
                    {scores.toleranceBand ? `${bandNames[scores.toleranceBand]} · ${scores.tolerance}` : <span className="text-ink-muted">—</span>}
                  </td>
                  <td className="py-2.5 pr-6">
                    {scores.profile ? <Badge tone="info">{profileNames[scores.profile]}</Badge> : <span className="text-ink-muted">—</span>}
                  </td>
                  <td className="py-2.5 pr-6">
                    {profile.agrees === null ? <span className="text-ink-muted">—</span>
                      : profile.agrees ? "Yes"
                        : `No${profile.preferredProfile ? ` — prefers ${profileNames[profile.preferredProfile]}` : ""}`}
                  </td>
                  <td className="w-px py-2.5 whitespace-nowrap">
                    <div className="flex items-center justify-end gap-2">
                      {onEdit && (
                        <Button size="sm" variant="ghost" onClick={() => onEdit(index)} aria-label={`Edit ${riskGroup(index).toLowerCase()}`}>
                          <PencilLine aria-hidden="true" />
                          Edit
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
