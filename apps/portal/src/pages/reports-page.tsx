import { ApiError } from "@atomprive/api-client";
import { useAccessReport, type AccessEventRow } from "@atomprive/api-client/portal";
import { useMemo, useState } from "react";
import { asDay, exactly } from "../lib/dates";
import { Face } from "./invitation-card";
import { Aside, CONTROL, Card, Field, Heading, Headings, Nothing, Pill, Row, Table, Tabs, Tile } from "./panels";

/**
 * The client's own record of who has seen what.
 *
 * <p>Read out of the firm's audit trail rather than assembled here, which is the point of it: the same rows
 * the firm's own auditors read, narrowed to this client and to sharing. A report built from its own store
 * would be a report that can disagree with the log, and then neither is evidence of anything.
 *
 * <p>Filtering and sorting happen on what the server sent rather than by asking again. The server hands
 * over this client's sharing history in one answer, and a dropdown that triggered a fresh request would be
 * slower, no more private, and would let a filter show nothing while the data behind it was still arriving.
 */
type Tab = "all" | "reads";

/** What the server will hand over at most, said here so the figures on screen can admit to it. */
const MOST = 500;

/** The firm's own grouping of the actions, for a filter somebody can read. */
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
    // Only the people who actually appear: a filter offering somebody with nothing behind it is a filter
    // that reads as broken the first time it is used.
    const byId = new Map<string, string>();
    for (const one of all) {
      if (one.memberId) {
        byId.set(one.memberId, one.memberName);
      }
    }
    const onTab = tab === "reads" ? all.filter((one) => one.action === "access.data_read") : all;
    const narrowed = onTab.filter((one) => {
      if (member !== "ALL" && one.memberId !== member) {
        return false;
      }
      // Gated on the tab, because the control is disabled on the reads tab. A filter that still applies
      // while its own select is greyed out empties a tab whose heading promises rows, with nothing on
      // screen the client can press to undo it.
      if (tab === "all" && kind !== "ALL" && one.action !== kind) {
        return false;
      }
      const day = asDay(one.at);
      return !((from !== "" && day < from) || (to !== "" && day > to));
    });
    return {
      rows: narrowed,
      members: [...byId].sort((a, b) => a[1].localeCompare(b[1])),
      // At the cap the figures are a count of the window, not of the client's whole history, and a tile
      // labelled "Approvals" that silently means "approvals in the last 500 events" is a tile somebody
      // will read as nought approvals.
      capped: all.length >= MOST,
      counts: {
        all: all.length,
        reads: all.filter((one) => one.action === "access.data_read").length,
        approvals: all.filter((one) => one.action === "access.approved").length,
        endings: all.filter(
          (one) => one.action === "access.revoked" || one.action === "access.relinquished",
        ).length,
      },
    };
  }, [report.data, tab, member, kind, from, to]);

  const filtered = member !== "ALL" || kind !== "ALL" || from !== "" || to !== "";

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_19rem]">
      <div className="space-y-5">
        <Heading
          title="Reports"
          blurb="Every step of every sharing arrangement you are part of, in the order it happened."
        >
          <button
            type="button"
            disabled={rows.length === 0}
            onClick={() => download(rows)}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Export {rows.length > 0 ? `${rows.length} rows` : ""} as CSV
          </button>
        </Heading>

        {report.isError && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {report.error.message}
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Tile tint="bg-blue-50 text-blue-700" label="Events recorded" value={figure(counts.all, capped)}>
            {capped ? "Your most recent 500" : "Everything about your sharing"}
          </Tile>
          <Tile
            tint="bg-violet-50 text-violet-700"
            label="Account reads"
            value={figure(counts.reads, capped)}
          >
            Once a day for each person who reads one
          </Tile>
          <Tile
            tint="bg-emerald-50 text-emerald-700"
            label="Approvals"
            value={figure(counts.approvals, capped)}
          >
            Requests agreed to
          </Tile>
          <Tile tint="bg-rose-50 text-rose-700" label="Revocations" value={figure(counts.endings, capped)}>
            Access taken back or given back
          </Tile>
        </div>

        <Card
          bar={
            <Tabs
              label="Which report"
              chosen={tab}
              onChoose={setTab}
              tabs={[
                ["all", "Access audit log"],
                ["reads", `Account access activity (${counts.reads})`],
              ]}
            />
          }
        >
          <div className="flex flex-wrap items-end gap-3 border-b border-slate-200 px-5 py-3">
            <Field label="Family member">
              <select value={member} onChange={(event) => setMember(event.target.value)} className={CONTROL}>
                <option value="ALL">Everybody</option>
                {members.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Event">
              <select
                value={kind}
                onChange={(event) => setKind(event.target.value)}
                disabled={tab === "reads"}
                className={`${CONTROL} disabled:bg-slate-100 disabled:text-slate-400`}
              >
                {KINDS.map(([code, said]) => (
                  <option key={code} value={code}>
                    {said}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="From">
              <input
                type="date"
                value={from}
                max={to || undefined}
                onChange={(event) => setFrom(event.target.value)}
                className={CONTROL}
              />
            </Field>
            <Field label="To">
              <input
                type="date"
                value={to}
                min={from || undefined}
                onChange={(event) => setTo(event.target.value)}
                className={CONTROL}
              />
            </Field>
            {filtered && (
              <button
                type="button"
                onClick={() => {
                  setMember("ALL");
                  setKind("ALL");
                  setFrom("");
                  setTo("");
                }}
                className="ml-auto text-xs font-semibold text-blue-700 hover:underline"
              >
                Clear filters
              </button>
            )}
          </div>

          {report.isPending ? (
            <Nothing>Reading your report…</Nothing>
          ) : rows.length === 0 ? (
            <Nothing>
              {counts.all === 0
                ? "Nothing has happened to your sharing yet. Once you ask for access, or somebody asks you, every step of it appears here."
                : capped
                  ? "No events match those filters in your most recent 500."
                  : "No events match those filters."}
            </Nothing>
          ) : (
            <Table minWidth="58rem">
              <Headings of={["When", "Event", "Family member", "Details", "Outcome"]} />
              <tbody>
                {rows.map((one) => (
                  <Row key={one.id}>
                    <td className="px-4 py-3 text-sm whitespace-nowrap text-slate-500 tabular-nums">
                      {exactly(one.at)}
                    </td>
                    {/* Who did it sits under what was done rather than in a column of its own: beside the
                        member column it would be the same name twice on every row somebody else caused. */}
                    <td className="px-4 py-3">
                      <span className="block text-sm font-semibold whitespace-nowrap text-slate-900">
                        {one.said}
                      </span>
                      <span className="block text-xs whitespace-nowrap text-slate-500">
                        {one.byYou ? "by you" : `by ${one.memberName}`}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-2.5">
                        <Face name={one.memberName} photo={one.memberPhoto} small />
                        <span className="block truncate text-sm text-slate-900">{one.memberName}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">{one.about ?? "—"}</td>
                    <td className="px-4 py-3">
                      {one.outcome === "SUCCESS" ? (
                        <Pill tone="good">Completed</Pill>
                      ) : (
                        <Pill tone="bad">Failed</Pill>
                      )}
                    </td>
                  </Row>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      </div>

      <aside className="space-y-4">
        <Aside title="What is on this report">
          <p>
            Every request, every answer, every revocation, and every day a shared account was read &mdash;
            between you and the people in your family group.
          </p>
          {/* Said outright. "The firm's own audit trail, narrowed to you" was true of where the rows come
              from and wrong about what they cover, and a client reading it would reasonably take this for
              the record of who at the firm has opened their file. That record is kept, and it is not this
              screen. Promising it here and not showing it is worse than not promising it. */}
          <p className="border-t border-slate-100 pt-3">
            It does not show when the firm&rsquo;s own staff opened your file. That is recorded separately.
            Ask your relationship manager for it.
          </p>
          <p className="border-t border-slate-100 pt-3">
            A read is recorded once a day for each person who reads an account, rather than once a page.
            Every refresh would be truthful and would bury the days that mattered.
          </p>
          {/* Said rather than left to be discovered. A log that quietly stops at a round number is a log
              somebody will one day read as "nothing happened before this". */}
          <p className="border-t border-slate-100 pt-3">
            The report shows your most recent 500 events. For anything older, ask your relationship
            manager.
          </p>
        </Aside>

        <Aside title="Why an account is not always named">
          <p>
            An account is named where it is yours, or where it was you who read it. Where neither is true the
            report says that something happened without handing over what it was — a log is a record of what
            somebody saw, not a second way to see it.
          </p>
        </Aside>

        <Aside title="Exporting">
          <p>
            The CSV holds exactly the rows on screen, filters and all. Open it in Excel or send it to your
            accountant.
          </p>
        </Aside>
      </aside>
    </div>
  );
}

/**
 * The rows on screen, as a file.
 *
 * <p>Built in the browser from what is already here rather than asked for again. The screen has the rows
 * and the filters; a second endpoint would be a second place for the two to disagree about what "this
 * report" means.
 */
function download(rows: AccessEventRow[]) {
  const head = ["When", "Event", "Who", "Family member", "Details", "Outcome"];
  const body = rows.map((one) => [
    exactly(one.at),
    one.said,
    one.byYou ? "You" : one.memberName,
    one.memberName,
    one.about ?? "",
    one.outcome === "SUCCESS" ? "Completed" : "Failed",
  ]);
  const csv = [head, ...body].map((line) => line.map(quoted).join(",")).join("\r\n");
  // A BOM, because without one Excel reads a UTF-8 file as the local code page and a name with an accent
  // in it arrives mangled.
  const file = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = `access-report-${asDay(new Date().toISOString())}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

/** A figure that admits when it is counting a window rather than a lifetime. */
function figure(howMany: number, capped: boolean) {
  return capped ? `${howMany}+` : String(howMany);
}

/** Every field quoted, so a comma or a line break in a message cannot shift the columns along. */
function quoted(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}
