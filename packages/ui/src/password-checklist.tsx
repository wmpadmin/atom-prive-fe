import { Circle, CircleCheck, CircleX } from "lucide-react";
import { cn } from "./cn";
import { passwordRules } from "./password-rules";

/**
 * The password rules as a checklist that ticks off while the person types. Once they've tried to save, rules
 * still missing turn red, so it's clear what is stopping them.
 */
export function PasswordChecklist({ id, password, showMissing }: { id: string; password: string; showMissing: boolean }) {
  return (
    <ul id={id} className="grid gap-x-4 gap-y-1 pt-0.5 text-xs sm:grid-cols-2">
      {passwordRules.map((rule) => {
        const met = rule.isMet(password);
        const missing = !met && showMissing;
        const Icon = met ? CircleCheck : missing ? CircleX : Circle;
        return (
          <li
            key={rule.label}
            className={cn("flex items-center gap-1.5", met ? "text-ink-soft" : missing ? "text-red-600" : "text-ink-muted")}
          >
            <Icon
              aria-hidden="true"
              className={cn("size-3.5 shrink-0", met ? "text-emerald-600" : missing ? "text-red-600" : "text-slate-300")}
            />
            <span className="sr-only">{met ? "Done: " : "Missing: "}</span>
            {rule.label}
          </li>
        );
      })}
    </ul>
  );
}
