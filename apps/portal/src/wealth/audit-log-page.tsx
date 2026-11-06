import { ApiError, httpFile } from "@atomprive/api-client";
import { getExportAuditLogUrl, useAuditLog, type AccessEventRow } from "@atomprive/api-client/portal";
import { Pagination, SelectInput } from "@atomprive/ui";
import { Building2, Search } from "lucide-react";
import { useState } from "react";
import { initialsOf } from "../lib/money";
import { ExportMenu, type Format } from "./holdings-page";
import { writeMoment } from "../lib/display";

/**
 * Who did what about the client's accounts, wealth, family and sign-in: only events they did or that were done
 * to them, out of the firm's own audit trail. Filtered by who, by type and by date, and exported as the filters
 * show it. Whoever at the firm acted is shown as the firm.
 */

const CATEGORIES: Record<string, { label: string; tone: string }> = {
  ACCOUNT_ACCESS: { label: "Account access", tone: "bg-blue-50 text-blue-700" },
  WEALTH_ACCESS: { label: "Wealth access", tone: "bg-violet-50 text-violet-700" },
  FAMILY: { label: "Family", tone: "bg-amber-50 text-amber-700" },
  SECURITY: { label: "Security", tone: "bg-slate-100 text-slate-700" },
};

const PAGE = 25;

/** The same key the server filters an export by: the other person, or "you", or "firm". */
function memberKey(one: AccessEventRow) {
  return one.memberId ?? (one.byYou ? "you" : "firm");
}

function dayOf(at: string) {
  return at.slice(0, 10);
}

function stamp(at: string) {
  return writeMoment(at);
}

function Who({ name, photo, firm }: { name: string; photo: string | null; firm: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      {firm ? (
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-600 text-on-accent">
          <Building2 aria-hidden="true" className="size-4" />
        </span>
      ) : photo ? (
        <img src={photo} alt="" className="size-8 shrink-0 rounded-full object-cover" />
      ) : (
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-50 text-2xs font-bold text-primary-700">{initialsOf(name)}</span>
      )}
      <span className="font-semibold whitespace-nowrap text-ink">{name}</span>
    </span>
  );
}

export function AuditLogPage() {
  const log = useAuditLog<AccessEventRow[], ApiError>();
  const [member, setMember] = useState("");
  const [category, setCategory] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [problem, setProblem] = useState<string>();

  const all = log.data ?? [];
  const members = [...new Map(all.filter((one) => one.memberId).map((one) => [one.memberId!, one.memberName])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const wanted = search.trim().toLowerCase();
  const rows = all.filter(
    (one) =>
      (!member || memberKey(one) === member) &&
      (!category || one.category === category) &&
      (!from || dayOf(one.at) >= from) &&
      (!to || dayOf(one.at) <= to) &&
      (!wanted || `${one.said} ${one.memberName} ${one.about ?? ""}`.toLowerCase().includes(wanted)),
  );
  const shown = rows.slice(page * PAGE, page * PAGE + PAGE);
  const reset = () => setPage(0);
  const filtered = Boolean(member || category || from || to || wanted);

  const exportAs = async (format: Format) => {
    setExporting(true);
    setProblem(undefined);
    try {
      const blob = await httpFile(getExportAuditLogUrl({ format, category: category || undefined, member: member || undefined, from: from || undefined, to: to || undefined }));
      const href = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = href;
      link.download = `Audit log ${new Date().toISOString().slice(0, 10)}.${format}`;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(href), 1_000);
    } catch (caught) {
      setProblem(caught instanceof ApiError ? caught.message : "The file could not be made. Try again.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[1.625rem] font-bold text-balance text-ink">Audit Log</h1>
        <p className="mt-1 text-sm text-ink-muted">Every access, sharing, family and sign-in event that involves you.</p>
      </div>

      <section className="rounded-2xl border border-line bg-white p-5">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <label className="relative min-w-48 flex-1">
            <span className="sr-only">Search the log</span>
            <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-muted" />
            <input
              id="audit-search"
              type="search"
              value={search}
              placeholder="Search the log…"
              onChange={(event) => {
                setSearch(event.target.value);
                reset();
              }}
              className="h-10 w-full rounded-xl border border-line bg-white pr-3 pl-10 text-sm focus-visible:border-primary-600 focus-visible:outline-2 focus-visible:outline-primary-600"
            />
          </label>
          <SelectInput
            id="audit-user"
            aria-label="User"
            value={member}
            onChange={(event) => {
              setMember(event.target.value);
              reset();
            }}
            className="w-48"
          >
            <option value="">User: All</option>
            <option value="you">You only</option>
            <option value="firm">Atom Privé</option>
            {members.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </SelectInput>
          <SelectInput
            id="audit-type"
            aria-label="Activity type"
            value={category}
            onChange={(event) => {
              setCategory(event.target.value);
              reset();
            }}
            className="w-48"
          >
            <option value="">Type: All</option>
            {Object.entries(CATEGORIES).map(([key, one]) => (
              <option key={key} value={key}>
                {one.label}
              </option>
            ))}
          </SelectInput>
          <label className="flex w-full items-center gap-2 text-xs text-ink-muted sm:w-auto">
            <span className="w-9 shrink-0 sm:w-auto">From</span>
            <input id="audit-from" type="date" value={from} max={to || undefined} onChange={(event) => { setFrom(event.target.value); reset(); }} className="h-10 min-w-0 flex-1 rounded-xl border border-line bg-white px-3 text-sm text-ink sm:flex-none" />
          </label>
          <label className="flex w-full items-center gap-2 text-xs text-ink-muted sm:w-auto">
            <span className="w-9 shrink-0 sm:w-auto">To</span>
            <input id="audit-to" type="date" value={to} min={from || undefined} onChange={(event) => { setTo(event.target.value); reset(); }} className="h-10 min-w-0 flex-1 rounded-xl border border-line bg-white px-3 text-sm text-ink sm:flex-none" />
          </label>
          <div className="ml-auto">
            <ExportMenu onPick={(format) => void exportAs(format)} busy={exporting} formats={["csv", "pdf"]} />
          </div>
        </div>
        {problem && <p className="mb-3 text-sm text-access-none-ink">{problem}</p>}

        {log.isError ? (
          <p className="py-8 text-center text-sm text-access-none-ink">Your audit log could not be loaded. Refresh the page to try again.</p>
        ) : !log.data ? (
          <div className="h-72 animate-pulse rounded-xl bg-sidebar" />
        ) : rows.length === 0 ? (
          <p className="py-12 text-center text-sm text-ink-muted">{filtered ? "Nothing matches these filters." : "Nothing has been recorded yet."}</p>
        ) : (
          <>
            {/* On a phone, what happened leads, with who, when and the outcome under it (S64). */}
            <ul className="divide-y divide-line border-y border-line sm:hidden">
              {shown.map((one) => {
                const affected = one.byYou ? (one.memberId ? one.memberName : "You") : "You";
                return (
                  <li key={one.id} className="flex justify-between gap-3 px-1 py-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-ink">{one.said}</p>
                      <p className="text-sm text-ink-muted">
                        {one.byYou ? "You" : one.memberName} · {stamp(one.at)}
                      </p>
                      <p className="text-sm text-ink-muted">
                        {affected}
                        {one.about ? ` · ${one.about}` : ""}
                      </p>
                    </div>
                    {one.outcome === "SUCCESS" ? (
                      <span className="h-fit shrink-0 rounded-full bg-access-full-soft px-2.5 py-0.5 text-xs font-semibold text-access-full-ink">Done</span>
                    ) : (
                      <span className="h-fit shrink-0 rounded-full bg-access-none-soft px-2.5 py-0.5 text-xs font-semibold text-access-none-ink">Refused</span>
                    )}
                  </li>
                );
              })}
            </ul>
            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full min-w-[860px] text-left text-sm">
                <thead>
                  <tr className="border-y border-line text-left text-2xs font-semibold tracking-wider whitespace-nowrap text-ink-muted uppercase">
                    <th scope="col" className="py-3 pr-4 pl-3">Date &amp; time</th>
                    <th scope="col" className="px-4 py-3">User</th>
                    <th scope="col" className="px-4 py-3">Action</th>
                    <th scope="col" className="px-4 py-3">Affected</th>
                    <th scope="col" className="py-3 pr-3 pl-4">Outcome</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {shown.map((one) => {
                    const type = CATEGORIES[one.category] ?? { label: one.category, tone: "bg-canvas text-ink-soft" };
                    const affected = one.byYou ? (one.memberId ? one.memberName : "You") : "You";
                    return (
                      <tr key={one.id}>
                        <td className="px-3 py-2.5 whitespace-nowrap text-ink-soft tabular-nums">{stamp(one.at)}</td>
                        <td className="px-3 py-2.5">
                          {one.byYou ? <Who name="You" photo={null} firm={false} /> : <Who name={one.memberName} photo={one.memberPhoto} firm={!one.memberId} />}
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="block font-semibold text-ink">{one.said}</span>
                          <span className={`mt-0.5 inline-flex rounded-full px-2 py-0.5 text-2xs font-semibold ${type.tone}`}>{type.label}</span>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="block text-ink">{affected}</span>
                          {one.about && <span className="block text-xs text-ink-muted">{one.about}</span>}
                        </td>
                        <td className="px-3 py-2.5">
                          {one.outcome === "SUCCESS" ? (
                            <span className="inline-flex rounded-full bg-access-full-soft px-2.5 py-0.5 text-xs font-semibold text-access-full-ink">Done</span>
                          ) : (
                            <span className="inline-flex rounded-full bg-access-none-soft px-2.5 py-0.5 text-xs font-semibold text-access-none-ink">Refused</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-4">
              <Pagination page={page} pageSize={PAGE} totalItems={rows.length} onPageChange={setPage} noun={["event", "events"]} />
            </div>
          </>
        )}
      </section>
    </div>
  );
}
