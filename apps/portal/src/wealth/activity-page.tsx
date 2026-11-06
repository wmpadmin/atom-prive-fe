import { ApiError } from "@atomprive/api-client";
import { useActivity, type Happening } from "@atomprive/api-client/portal";
import { FileSignature, FileText, KeyRound, LineChart, Mail, Search, ShieldCheck, Users, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { useSearchParams } from "react-router";
import { dayOf as dayOnClientClock, writeDate } from "../lib/display";

/**
 * Everything that happened on the client's record, newest first, under the day it happened: their papers and
 * forms, their KYC, their portfolio, access and family, and the emails the firm sent them. Filtered by kind,
 * by dates and by words, and read a page at a time.
 */

const KINDS: { id: string; label: string; icon: LucideIcon }[] = [
  { id: "documents", label: "Documents", icon: FileText },
  { id: "kyc", label: "KYC", icon: ShieldCheck },
  { id: "forms", label: "Forms", icon: FileSignature },
  { id: "portfolio", label: "Portfolio", icon: LineChart },
  { id: "access", label: "Access", icon: KeyRound },
  { id: "family", label: "Family", icon: Users },
  { id: "communications", label: "Communications", icon: Mail },
];

const PAGE = 40;

/** The local calendar day an instant falls on, as yyyy-mm-dd, for grouping and for the date filters. */
function dayOf(at: string) {
  return dayOnClientClock(at);
}

function heading(day: string) {
  const today = dayOf(new Date().toISOString());
  const yesterday = dayOf(new Date(Date.now() - 86_400_000).toISOString());
  if (day === today) return "Today";
  if (day === yesterday) return "Yesterday";
  return writeDate(day, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

function timeOf(at: string) {
  return writeDate(at, { hour: "2-digit", minute: "2-digit", hour12: false });
}

export function ActivityPage() {
  const activity = useActivity<Happening[], ApiError>();
  const [params, setParams] = useSearchParams();
  const kind = params.get("kind") ?? "all";
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [shown, setShown] = useState(PAGE);

  const all = activity.data ?? [];
  const wanted = search.trim().toLowerCase();
  const dated = all.filter((one) => {
    const day = dayOf(one.at);
    return (!from || day >= from) && (!to || day <= to) && (!wanted || `${one.title} ${one.detail}`.toLowerCase().includes(wanted));
  });
  const matching = dated.filter((one) => kind === "all" || one.kind === kind);
  const page = matching.slice(0, shown);
  const days = page.reduce<{ day: string; lines: Happening[] }[]>((groups, one) => {
    const day = dayOf(one.at);
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.lines.push(one);
    else groups.push({ day, lines: [one] });
    return groups;
  }, []);
  const pick = (id: string) => {
    setShown(PAGE);
    setParams(
      (was) => {
        const next = new URLSearchParams(was);
        if (id === "all") next.delete("kind");
        else next.set("kind", id);
        return next;
      },
      { replace: true },
    );
  };
  const filtered = Boolean(wanted || from || to || kind !== "all");

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[1.625rem] font-bold text-balance text-ink">Activity</h1>
        <p className="mt-1 text-sm text-ink-muted">Everything that has happened on your account, newest first.</p>
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Kind of activity">
        {[{ id: "all", label: "All" }, ...KINDS].map((one) => {
          const count = one.id === "all" ? dated.length : dated.filter((line) => line.kind === one.id).length;
          return (
            <button
              key={one.id}
              type="button"
              aria-pressed={kind === one.id}
              onClick={() => pick(one.id)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold whitespace-nowrap ${
                kind === one.id ? "border-primary-600 bg-primary-600 text-on-accent" : "border-line bg-white text-ink-soft hover:bg-sidebar"
              }`}
            >
              {one.label} <span className={kind === one.id ? "opacity-80" : "text-ink-muted"}>{count}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-white p-4">
        <label className="relative min-w-48 flex-1">
          <span className="sr-only">Search activity</span>
          <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-muted" />
          <input
            id="activity-search"
            type="search"
            value={search}
            placeholder="Search activity…"
            onChange={(event) => {
              setSearch(event.target.value);
              setShown(PAGE);
            }}
            className="h-10 w-full rounded-xl border border-line bg-white pr-3 pl-10 text-sm focus-visible:border-primary-600 focus-visible:outline-2 focus-visible:outline-primary-600"
          />
        </label>
        <label className="flex w-full items-center gap-2 text-xs text-ink-muted sm:w-auto">
          <span className="w-9 shrink-0 sm:w-auto">From</span>
          <input id="activity-from" type="date" value={from} max={to || undefined} onChange={(event) => setFrom(event.target.value)} className="h-10 min-w-0 flex-1 rounded-xl border border-line bg-white px-3 text-sm text-ink sm:flex-none" />
        </label>
        <label className="flex w-full items-center gap-2 text-xs text-ink-muted sm:w-auto">
          <span className="w-9 shrink-0 sm:w-auto">To</span>
          <input id="activity-to" type="date" value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)} className="h-10 min-w-0 flex-1 rounded-xl border border-line bg-white px-3 text-sm text-ink sm:flex-none" />
        </label>
        {filtered && (
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setFrom("");
              setTo("");
              pick("all");
            }}
            className="text-sm font-semibold text-primary-700 hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {activity.isError ? (
        <p className="rounded-2xl border border-line bg-white p-6 text-sm text-access-none-ink">Your activity could not be loaded. Refresh the page to try again.</p>
      ) : !activity.data ? (
        <div className="h-96 animate-pulse rounded-2xl bg-white/60" />
      ) : matching.length === 0 ? (
        <p className="rounded-2xl border border-line bg-white px-6 py-12 text-center text-sm text-ink-muted">
          {filtered ? "Nothing matches these filters." : "Nothing has happened on your account yet."}
        </p>
      ) : (
        <div className="space-y-5">
          {days.map((group) => (
            <section key={group.day} aria-label={heading(group.day)} className="rounded-2xl border border-line bg-white">
              <h2 className="border-b border-line px-5 py-3 text-2xs font-semibold tracking-wider text-ink-muted uppercase">{heading(group.day)}</h2>
              <ol className="divide-y divide-line">
                {group.lines.map((one, index) => {
                  const Icon = KINDS.find((each) => each.id === one.kind)?.icon ?? ShieldCheck;
                  return (
                    <li key={`${one.at}-${index}`} className="flex items-start gap-3 px-5 py-3">
                      <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
                        <Icon aria-hidden="true" className="size-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-ink">{one.title}</p>
                        <p className="text-sm text-ink-muted">{one.detail}</p>
                      </div>
                      <time dateTime={one.at} className="shrink-0 pt-0.5 text-xs whitespace-nowrap text-ink-muted tabular-nums">
                        {timeOf(one.at)}
                      </time>
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
          <div className="flex items-center justify-between gap-3 text-sm text-ink-muted">
            <span>
              Showing {page.length} of {matching.length}
            </span>
            {page.length < matching.length && (
              <button type="button" onClick={() => setShown((was) => was + PAGE)} className="rounded-xl border border-line bg-white px-4 py-2 font-semibold text-ink hover:bg-sidebar">
                Load more
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
