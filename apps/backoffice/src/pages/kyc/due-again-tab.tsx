import { Alert, cn } from "@atomprive/ui";
import { Link } from "react-router";
import { formatDate } from "../../lib/labels";
import { dueStatus, HOW_OFTEN, type FreshCopy } from "./fresh-copies";

const TONE: Record<FreshCopy["due"], string> = {
  NONE: "",
  UPCOMING: "",
  DUE_SOON: "bg-amber-50 text-amber-800",
  OVERDUE: "bg-red-50 text-red-700",
  AFTER_ONBOARDING: "bg-primary-50 text-primary-700",
};

/**
 * The KYC review queue's third tab (26 Nov 2026): every client's paper due again within 30 days or overdue, and every
 * paper asked once a client is onboarded and not yet in, soonest first. The RM is told 30 days before and again on the
 * day; nothing is blocked. A row opens the client's KYC file.
 */
export function DueAgainTab({ lines, failed }: { lines: FreshCopy[] | undefined; failed?: string }) {
  if (failed) {
    return <Alert tone="danger">{failed}</Alert>;
  }
  if (!lines) {
    return <p className="text-sm text-ink-muted">Reading what is due again…</p>;
  }
  return (
    <section className="rounded-2xl border border-line bg-white" aria-labelledby="due-again-title">
      <div className="px-5 pt-5">
        <h2 id="due-again-title" className="text-base font-bold">Due again</h2>
        <p className="mt-0.5 text-xs text-ink-muted">
          Papers whose fresh copy is due within 30 days (7 for a monthly paper) or overdue, as Compliance set on How often
          it's asked. The RM is reminded then and again on the day; nothing is blocked.
        </p>
      </div>
      {lines.length === 0 ? (
        <p className="px-5 py-6 text-sm text-ink-muted">Nothing is due again in the next 30 days.</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                {["Client", "Paper", "How often", "Last approved", "Due", "Status", "RM", "RM reminded"].map((one) => (
                  <th key={one} className="px-4 py-2 whitespace-nowrap first:pl-5">{one}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={`${line.customerId}/${line.paperId}`} className="border-t border-line hover:bg-slate-50">
                  <td className="py-2.5 pr-4 pl-5">
                    <Link to={`/kyc/${line.customerId}`} className="font-semibold text-ink hover:text-primary-700 hover:underline">
                      {line.clientName}
                    </Link>
                    <span className="block text-xs text-ink-muted">
                      {line.clientCode} · {line.clientType === "ENTITY" ? "Company or trust" : "Individual"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">{line.paper}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap">{HOW_OFTEN[line.frequency]}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap">{line.lastApproved ? formatDate(line.lastApproved) : "—"}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap">{line.dueOn ? formatDate(line.dueOn) : "—"}</td>
                  <td className="px-4 py-2.5">
                    <span className={cn("inline-block rounded-full px-2 py-0.5 text-xs font-bold whitespace-nowrap", TONE[line.due])}>
                      {dueStatus(line)}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap">{line.rms.join(", ") || "—"}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap text-ink-soft">
                    {line.reminded.length > 0 ? line.reminded.map((one) => formatDate(one)).join(", ") : "Not yet"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
