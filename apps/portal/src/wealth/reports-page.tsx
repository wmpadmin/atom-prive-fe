import { ApiError } from "@atomprive/api-client";
import { useAccessReport, type AccessEventRow } from "@atomprive/api-client/portal";
import { SelectInput } from "@atomprive/ui";
import { Ban, CheckCircle2, Download, Eye, ListChecks, type LucideIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { dayOf, writeMoment } from "../lib/display";
import { initialsOf } from "../lib/money";

/**
 * The classic portal's Reports in the new look: every step of every sharing arrangement the client is part of.
 *
 * <p>The same answer from the same endpoint as the classic screen — the firm's own audit trail narrowed to this
 * client and to sharing — filtered and counted here on what the server sent rather than by asking again, so a
 * filter can never show nothing while the rows behind it are still arriving.
 */
type Tab = "all" | "reads";

/** What the server will hand over at most, said here so the figures on screen can admit to it. */
const MOST = 500;

const KINDS = [
  ["ALL", "Every event"],
  ["access.requested", "Access requested"],
  ["access.request_cancelled", "Request withdrawn"],
  ["access.approved", "Access approved"],
  ["access.rejected", "Access refused"],
  ["access.revoked", "Access revoked"],
  ["access.relinquished", "Access given back"],
  ["access.data_read", "Account read"],
] as const;

export function ReportsPage() {
  const [tab, setTab] = useState<Tab>("all");
  const [member, setMember] = useState("ALL");
  const [kind, setKind] = useState<string>("ALL");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const report = useAccessReport<AccessEventRow[], ApiError>();

  const { rows, members, counts, capped } = useMemo(() => {
    const all = report.data ?? [];
    // Only the people who actually appear: a filter offering somebody with nothing behind them reads as broken.
    const byId = new Map<string, string>();
    for (const one of all) if (one.memberId) byId.set(one.memberId, one.memberName);
    const onTab = tab === "reads" ? all.filter((one) => one.action === "access.data_read") : all;
    const narrowed = onTab.filter((one) => {
      if (member !== "ALL" && one.memberId !== member) return false;
      // Only on the first tab, where the control is live: a filter still applying while its box is greyed out
      // would empty a tab with nothing on screen to undo it.
      if (tab === "all" && kind !== "ALL" && one.action !== kind) return false;
      const day = dayOf(one.at);
      return !((from !== "" && day < from) || (to !== "" && day > to));
    });
    return {
      rows: narrowed,
      members: [...byId].sort((a, b) => a[1].localeCompare(b[1])),
      capped: all.length >= MOST,
      counts: {
        all: all.length,
        reads: all.filter((one) => one.action === "access.data_read").length,
        approvals: all.filter((one) => one.action === "access.approved").length,
        endings: all.filter((one) => one.action === "access.revoked" || one.action === "access.relinquished").length,
      },
    };
  }, [report.data, tab, member, kind, from, to]);

  const filtered = member !== "ALL" || kind !== "ALL" || from !== "" || to !== "";
  const clear = () => {
    setMember("ALL");
    setKind("ALL");
    setFrom("");
    setTo("");
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[1.625rem] font-bold text-balance text-ink">Reports</h1>
          <p className="mt-1 text-sm text-ink-muted">Every step of every sharing arrangement you are part of, in the order it happened.</p>
        </div>
        <button
          type="button"
          disabled={rows.length === 0}
          onClick={() => download(rows)}
          className="inline-flex items-center gap-2 rounded-xl border border-line bg-white px-4 py-2 text-sm font-semibold text-ink-soft hover:bg-sidebar disabled:opacity-50"
        >
          <Download aria-hidden="true" className="size-4" />
          Export {rows.length > 0 ? `${rows.length} ${rows.length === 1 ? "row" : "rows"}` : ""} as CSV
        </button>
      </div>

      {report.isError && <p role="alert" className="rounded-xl bg-access-none-soft px-4 py-3 text-sm text-access-none-ink">{report.error.message}</p>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile icon={ListChecks} tint="bg-primary-50 text-primary-700" label="Events recorded" value={figure(counts.all, capped)} note={capped ? "Your most recent 500" : "Everything about your sharing"} />
        <Tile icon={Eye} tint="bg-violet-50 text-violet-700" label="Account reads" value={figure(counts.reads, capped)} note="Once a day for each person who reads one" />
        <Tile icon={CheckCircle2} tint="bg-access-full-soft text-access-full-ink" label="Approvals" value={figure(counts.approvals, capped)} note="Requests agreed to" />
        <Tile icon={Ban} tint="bg-access-none-soft text-access-none-ink" label="Revocations" value={figure(counts.endings, capped)} note="Access taken back or given back" />
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <section className="rounded-2xl border border-line bg-white">
          <div role="tablist" aria-label="Which report" className="flex gap-6 border-b border-line px-5">
            {(
              [
                ["all", "Access audit log"],
                ["reads", `Account access activity (${counts.reads})`],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={`-mb-px border-b-2 py-3.5 text-sm font-semibold ${tab === id ? "border-primary-600 text-ink" : "border-transparent text-ink-muted hover:text-ink"}`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-3">
            <SelectInput id="reports-member" aria-label="Family member" value={member} onChange={(event) => setMember(event.target.value)} className="w-48">
              <option value="ALL">Everyone</option>
              {members.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </SelectInput>
            <SelectInput id="reports-kind" aria-label="Event" value={tab === "reads" ? "access.data_read" : kind} disabled={tab === "reads"} onChange={(event) => setKind(event.target.value)} className="w-48">
              {KINDS.map(([code, said]) => (
                <option key={code} value={code}>
                  {said}
                </option>
              ))}
            </SelectInput>
            <label className="flex w-full items-center gap-2 text-xs text-ink-muted sm:w-auto">
              <span className="w-9 shrink-0 sm:w-auto">From</span>
              <input id="reports-from" type="date" value={from} max={to || undefined} onChange={(event) => setFrom(event.target.value)} className="h-10 min-w-0 flex-1 rounded-xl border border-line bg-white px-3 text-sm text-ink sm:flex-none" />
            </label>
            <label className="flex w-full items-center gap-2 text-xs text-ink-muted sm:w-auto">
              <span className="w-9 shrink-0 sm:w-auto">To</span>
              <input id="reports-to" type="date" value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)} className="h-10 min-w-0 flex-1 rounded-xl border border-line bg-white px-3 text-sm text-ink sm:flex-none" />
            </label>
            {filtered && (
              <button type="button" onClick={clear} className="ml-auto text-xs font-semibold text-primary-700 hover:underline">
                Clear filters
              </button>
            )}
          </div>

          {report.isPending ? (
            <div className="m-5 h-56 animate-pulse rounded-xl bg-sidebar" />
          ) : rows.length === 0 ? (
            <p className="px-5 py-12 text-center text-sm text-ink-muted">
              {counts.all === 0
                ? "Nothing has happened to your sharing yet. Once you ask for access, or somebody asks you, every step of it appears here."
                : capped
                  ? "No events match those filters in your most recent 500."
                  : "No events match those filters."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead>
                  <tr className="border-b border-line text-2xs font-semibold tracking-wider whitespace-nowrap text-ink-muted uppercase">
                    <th scope="col" className="py-3 pr-4 pl-5">When</th>
                    <th scope="col" className="px-4 py-3">Event</th>
                    <th scope="col" className="px-4 py-3">Family member</th>
                    <th scope="col" className="px-4 py-3">Details</th>
                    <th scope="col" className="py-3 pr-5 pl-4">Outcome</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {rows.map((one) => (
                    <tr key={one.id}>
                      <td className="py-3 pr-4 pl-5 whitespace-nowrap text-ink-soft tabular-nums">
                        {writeMoment(one.at)}
                        <span className="block text-xs text-ink-muted">{one.byYou ? "by you" : `by ${one.memberName}`}</span>
                      </td>
                      <td className="px-4 py-3 font-semibold whitespace-nowrap text-ink">{one.said}</td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-2.5">
                          {one.memberPhoto ? (
                            <img src={one.memberPhoto} alt="" className="size-8 rounded-full object-cover" />
                          ) : (
                            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-canvas text-2xs font-bold text-ink-soft">{initialsOf(one.memberName)}</span>
                          )}
                          <span className="truncate text-ink">{one.memberName}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3 text-ink-soft">{one.about ?? "—"}</td>
                      <td className="py-3 pr-5 pl-4">
                        {one.outcome === "SUCCESS" ? (
                          <span className="inline-flex rounded-full bg-access-full-soft px-2.5 py-0.5 text-xs font-semibold text-access-full-ink">Completed</span>
                        ) : (
                          <span className="inline-flex rounded-full bg-access-none-soft px-2.5 py-0.5 text-xs font-semibold text-access-none-ink">Failed</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <aside className="space-y-4">
          <Note title="What is on this report">
            <p>Every request, every answer, every revocation, and every day a shared account was read — between you and the people in your family group.</p>
            <p>It does not show when the firm's own staff opened your file. That is recorded separately; ask your relationship manager for it.</p>
            <p>The report shows your most recent 500 events.</p>
          </Note>
          <Note title="Why an account is not always named">
            <p>An account is named where it is yours, or where it was you who read it. Otherwise the report says something happened without showing what it was.</p>
          </Note>
          <Note title="Exporting">
            <p>The CSV holds exactly the rows on screen, filters and all, ready for Excel.</p>
          </Note>
        </aside>
      </div>
    </div>
  );
}

function Tile({ icon: Icon, tint, label, value, note }: { icon: LucideIcon; tint: string; label: string; value: string; note: string }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-line bg-white p-4">
      <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${tint}`}>
        <Icon aria-hidden="true" className="size-5" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium text-ink-muted">{label}</p>
        <p className="text-xl font-bold text-ink tabular-nums">{value}</p>
        <p className="text-xs text-ink-muted">{note}</p>
      </div>
    </div>
  );
}

function Note({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-white p-4">
      <h2 className="text-sm font-bold text-ink">{title}</h2>
      <div className="mt-2 space-y-2 text-xs leading-relaxed text-ink-soft">{children}</div>
    </section>
  );
}

/** The rows on screen as a file, built from what is already here so the two cannot disagree. */
function download(rows: AccessEventRow[]) {
  const head = ["When", "Event", "Who", "Family member", "Details", "Outcome"];
  const body = rows.map((one) => [
    writeMoment(one.at),
    one.said,
    one.byYou ? "You" : one.memberName,
    one.memberName,
    one.about ?? "",
    one.outcome === "SUCCESS" ? "Completed" : "Failed",
  ]);
  const csv = [head, ...body].map((line) => line.map(quoted).join(",")).join("\r\n");
  // A BOM, or Excel reads UTF-8 as the local code page and a name with an accent arrives mangled.
  const file = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = `access-report-${dayOf(new Date().toISOString())}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

/** A figure that admits when it is counting a window rather than a lifetime. */
function figure(howMany: number, capped: boolean) {
  return capped ? `${howMany}+` : String(howMany);
}

/** Every field quoted, so a comma or a line break cannot shift the columns along. */
function quoted(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}
