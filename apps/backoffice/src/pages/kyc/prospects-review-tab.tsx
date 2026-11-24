import type { ProspectQueue, ProspectReviewRow } from "@atomprive/api-client/backoffice";
import { Avatar, Badge, SelectInput, TextInput, cn } from "@atomprive/ui";
import { ChevronRight, Search } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate } from "react-router";
import { ColumnPicker } from "../../components/column-picker";
import { ViewTabs } from "../../components/view-tabs";
import { useColumnDrag } from "../../lib/column-drag";
import { countryName } from "../../lib/countries";
import { formatRelative } from "../../lib/labels";
import { defaultPageSize } from "../../lib/page-sizes";
import { PagedFooter } from "../../lib/paged-rows";
import { useTableView } from "../../lib/table-view";
import { reviewStateLabels, reviewStateTones } from "./kyc-labels";

const STANDINGS = [
  { id: "", label: "Every prospect" },
  { id: "WAITING", label: "Waiting on you" },
  { id: "REJECTED", label: "Rejected paper" },
  { id: "APPROVED", label: "Approved" },
] as const;

type Column = { id: string; label: string; nowrap?: boolean; cell: (row: ProspectReviewRow) => ReactNode };

const state = (value: string) => value as keyof typeof reviewStateTones;

/** How many paper names a row shows before "+N more" (24 Nov 2026). */
const FOLDED_NAMES = 2;

/** One thing the prospect sent: each paper, and the wealth table while it waits. */
type Sent = { title: string; reviewState: string; sentAt?: string | null };

function sentBy(row: ProspectReviewRow): Sent[] {
  const papers: Sent[] = row.papers.map((paper) => ({ title: paper.title, reviewState: paper.reviewState, sentAt: paper.sentAt }));
  return row.wealthWaiting ? [...papers, { title: "Wealth accumulation", reviewState: "AWAITING_REVIEW", sentAt: null }] : papers;
}

/**
 * "+N more" (24 Nov 2026): every paper the prospect sent, with its state and when it came, in a small list floating over
 * the table, so the row keeps its height however many papers there are. Fixed to the page rather than to the cell, so the
 * table's own scrolling does not cut it off; closed by a press elsewhere, Escape or a scroll.
 */
function MorePapers({ sent, more }: { sent: Sent[]; more: number }) {
  const [at, setAt] = useState<{ left: number; top: number } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!at) return;
    const close = () => setAt(null);
    const away = (event: PointerEvent) => { if (!box.current?.contains(event.target as Node)) close(); };
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") close(); };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", key);
    window.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", key);
      window.removeEventListener("scroll", close, true);
    };
  }, [at]);
  return (
    <>
      <button type="button" aria-expanded={at !== null}
        onClick={(event) => {
          event.stopPropagation();
          const place = event.currentTarget.getBoundingClientRect();
          setAt((was) => (was ? null : { left: Math.min(place.left, window.innerWidth - 440), top: place.bottom + 6 }));
        }}
        className="shrink-0 font-semibold whitespace-nowrap text-primary-700 hover:underline">
        +{more} more
      </button>
      {at && createPortal(
        <div ref={box} role="dialog" aria-label="Every paper sent" onClick={(event) => event.stopPropagation()}
          style={{ left: Math.max(8, at.left), top: at.top }}
          className="fixed z-50 max-h-80 w-[26rem] overflow-y-auto rounded-xl border border-line bg-white p-3 shadow-lg">
          <ul className="divide-y divide-line text-sm">
            {sent.map((one, index) => (
              <li key={`${one.title}-${index}`} className="flex items-center justify-between gap-3 py-1.5">
                <span className="min-w-0 truncate font-medium text-ink-soft" title={one.title}>{one.title}</span>
                <span className="flex shrink-0 items-center gap-2">
                  <Badge tone={reviewStateTones[state(one.reviewState)] ?? "info"}>
                    {reviewStateLabels[state(one.reviewState)] ?? one.reviewState}
                  </Badge>
                  <span className="w-20 text-right text-xs whitespace-nowrap text-ink-muted tabular-nums">
                    {one.sentAt ? formatRelative(one.sentAt) : "—"}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>,
        document.body,
      )}
    </>
  );
}

/**
 * The same columns as the clients in review, read off what the prospect sent to Compliance. One line a prospect
 * (24 Nov 2026), whatever they sent: the first two names with "+N more", a count per state and when the latest came in.
 */
const MOVABLE: Column[] = [
  {
    id: "uploaded",
    label: "Uploaded",
    cell: (row) => {
      const sent = sentBy(row);
      if (sent.length === 0) return <span className="text-ink-muted">Nothing sent yet</span>;
      const more = sent.length - FOLDED_NAMES;
      return (
        <span className="flex max-w-xl items-center gap-1.5">
          <span className="truncate font-semibold text-ink-soft">{sent.slice(0, FOLDED_NAMES).map((one) => one.title).join(", ")}</span>
          {more > 0 && <MorePapers sent={sent} more={more} />}
        </span>
      );
    },
  },
  {
    id: "review",
    label: "This paper",
    cell: (row) => {
      const sent = sentBy(row);
      if (sent.length === 0) return <span className="text-ink-muted">Nothing to look at</span>;
      // A count per state, the ones waiting on Compliance first.
      const counts = new Map<string, number>();
      for (const one of sent) counts.set(one.reviewState, (counts.get(one.reviewState) ?? 0) + 1);
      const order = ["AWAITING_REVIEW", "RE_UPLOAD_REQUESTED", "REJECTED", "APPROVED"];
      const states = [...counts.keys()].sort((x, y) => (order.indexOf(x) + 99) % 99 - (order.indexOf(y) + 99) % 99);
      return (
        <span className="flex flex-nowrap gap-1">
          {states.map((one) => (
            <Badge key={one} tone={reviewStateTones[state(one)] ?? "info"}>
              {counts.get(one)} {(reviewStateLabels[state(one)] ?? one).toLowerCase()}
            </Badge>
          ))}
        </span>
      );
    },
  },
  {
    id: "putOnFile",
    label: "Put on file",
    nowrap: true,
    cell: (row) => {
      const latest = row.papers.map((paper) => paper.sentAt).filter((at): at is string => !!at).sort().at(-1);
      return latest ? <span className="whitespace-nowrap text-ink-soft tabular-nums">latest {formatRelative(latest)}</span>
        : <span className="text-ink-muted">—</span>;
    },
  },
];

// Opened as a client's KYC file is (24 Nov 2026): what the KYC waits on and every paper sent, decided there.
const documentsOf = (row: ProspectReviewRow) =>
  row.customerId ? `/kyc/${row.customerId}?from=queue` : `/prospective-clients/${row.prospectId}?tab=documents`;

function who(row: ProspectReviewRow) {
  return [row.clientType === "ENTITY" ? "Entity" : "Individual", row.country && countryName(row.country),
    row.relationshipManager && `RM ${row.relationshipManager}`].filter(Boolean).join(" · ");
}

/**
 * The Prospective clients tab of the KYC review queue (24 Nov 2026), laid out exactly as the All clients tab: the four
 * counts, search and a filter, the prospects Compliance approved (waiting on the agreement), those with a paper turned
 * down, then the prospects in review with the same columns, views and column picker. A row opens the prospect's
 * Documents tab, where each paper is decided.
 */
export function ProspectsReviewTab({ data, failed }: { data?: ProspectQueue; failed?: string }) {
  const navigate = useNavigate();
  const [typed, setTyped] = useState("");
  const [standing, setStanding] = useState("");
  const [page, setPage] = useState(0);
  const [size, setSize] = useState<number>(defaultPageSize);
  const view = useTableView("kyc-queue-prospects", MOVABLE.map((one) => one.id));
  const drag = useColumnDrag(view);
  const byId = new Map(MOVABLE.map((one) => [one.id, one]));
  const shownColumns = view.shown.map((id) => byId.get(id)).filter((one) => one !== undefined);

  const all = data?.items ?? [];
  const words = typed.trim().toLowerCase();
  const matches = all.filter((row) =>
    (!words || row.fullName.toLowerCase().includes(words) || row.reference.toLowerCase().includes(words))
    && (standing === "" || (standing === "WAITING" ? row.toCheck > 0 || row.wealthWaiting
      : standing === "REJECTED" ? row.papers.some((paper) => paper.reviewState === "REJECTED")
      : row.caseState === "APPROVED")));
  const approved = matches.filter((row) => row.caseState === "APPROVED");
  const turnedDown = matches.filter((row) => row.caseState !== "APPROVED"
    && row.papers.some((paper) => paper.reviewState === "REJECTED"));
  const inReview = matches.filter((row) => row.caseState !== "APPROVED");
  const rows = inReview.slice(page * size, page * size + size);

  return (
    <div className="space-y-6">
      {failed && <p className="rounded-2xl border border-red-200 bg-red-50 px-5 py-3 text-sm text-red-700">{failed}</p>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile label="Pending review" count={data ? all.filter((row) => row.caseState !== "APPROVED").length : undefined}
          hint={data ? `${data.waiting} waiting on your decision` : ""} />
        <Tile label="Papers to check" count={data?.toCheck} hint="Sent and not decided yet" />
        <Tile label="Rejected" count={data?.rejected} hint="A paper turned down, not replaced" />
        <Tile label="Approved" count={data?.approved} hint="On to the agreement" />
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-64 flex-1">
          <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted" />
          <TextInput aria-label="Search prospects" placeholder="Search prospects" value={typed}
            onChange={(event) => { setTyped(event.target.value); setPage(0); }} className="pl-9" />
        </div>
        <SelectInput aria-label="Which prospects" value={standing} className="w-56"
          onChange={(event) => { setStanding(event.target.value); setPage(0); }}>
          {STANDINGS.map((one) => <option key={one.id} value={one.id}>{one.label}</option>)}
        </SelectInput>
      </div>

      {approved.length > 0 && (
        <section className="rounded-2xl border border-amber-300 bg-amber-50/60">
          <div className="px-5 pt-5">
            <h2 className="text-base font-bold">Approved, waiting on the agreement</h2>
            <p className="mt-0.5 text-xs text-ink-soft">
              {approved.length === 1
                ? "One prospect has every paper approved, and is waiting on the signed agreement that makes them a client."
                : `${approved.length} prospects have every paper approved, and are waiting on the signed agreement that makes them clients.`}
            </p>
          </div>
          <ul className="mt-3 divide-y divide-amber-200/70">
            {approved.map((row) => (
              <li key={row.prospectId} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar name={row.fullName} />
                  <div className="min-w-0">
                    <span className="block font-semibold">{row.fullName}</span>
                    <span className="block text-xs text-ink-muted">{row.reference} · {who(row)}</span>
                  </div>
                </div>
                <Link to={`/prospective-clients/${row.prospectId}?tab=agreement`} className="text-sm font-semibold text-primary-700 hover:underline">
                  Open the agreement
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {turnedDown.length > 0 && (
        <section className="rounded-2xl border border-red-200 bg-red-50/60">
          <div className="px-5 pt-5">
            <h2 className="text-base font-bold">Paper rejected</h2>
            <p className="mt-0.5 text-xs text-ink-soft">
              {turnedDown.length === 1
                ? "One prospect has a paper you turned down. They need a new copy before you can approve."
                : `${turnedDown.length} prospects have a paper you turned down. They need a new copy before you can approve.`}
            </p>
          </div>
          <ul className="mt-3 divide-y divide-red-200/70">
            {turnedDown.map((row) => (
              <li key={row.prospectId} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <div className="flex min-w-0 items-center gap-3 sm:w-80">
                  <Avatar name={row.fullName} />
                  <div className="min-w-0">
                    <span className="block font-semibold">{row.fullName}</span>
                    <span className="block truncate text-xs text-ink-muted">{who(row)}</span>
                  </div>
                </div>
                <div className="min-w-48 flex-1 text-sm">
                  {row.papers.filter((paper) => paper.reviewState === "REJECTED").map((paper, at) => (
                    <span key={`${paper.title}-${at}`} className="block"><span className="font-semibold text-red-700">{paper.title}</span> rejected</span>
                  ))}
                </div>
                <Link to={documentsOf(row)} className="inline-flex items-center gap-0.5 text-sm font-semibold text-primary-700 hover:underline">
                  Open<ChevronRight aria-hidden="true" className="size-4" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-2xl border border-line bg-white">
        <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5">
          <div>
            <h2 className="text-base font-bold">Prospects in review</h2>
            <p className="mt-0.5 text-xs text-ink-muted">
              {data
                ? `${inReview.length} prospect${inReview.length === 1 ? "" : "s"} pending. A prospect is ready to decide on once every paper on their checklist is in and approved.`
                : "A prospect is ready to decide on once every paper on their checklist is in and approved."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <ViewTabs
              views={view.views}
              current={view.current}
              edited={view.current === null ? view.arranged : view.changed}
              onPick={(name) => (name === null ? view.reset() : view.apply(name))}
              onSave={view.saveAs}
              onDelete={view.remove}
              firstLabel="Everyone in review"
            />
            <ColumnPicker
              columns={MOVABLE.map((one) => ({ id: one.id, label: one.label }))}
              shown={new Set(view.shown)}
              order={view.order}
              arranged={view.arranged}
              onChange={(next) => {
                for (const one of MOVABLE) {
                  if (next.has(one.id) === view.hidden.includes(one.id)) view.toggle(one.id);
                }
              }}
              onMove={view.move}
              onReset={view.reset}
            />
          </div>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                <th scope="col" className="py-3 pr-4 pl-5">Prospect</th>
                {shownColumns.map((column, at) => (
                  <th key={column.id} scope="col" {...drag.headingProps(column.id)} title={`Drag to move ${column.label}`}
                    className={cn("cursor-grab touch-none px-4 py-3 select-none", column.nowrap && "whitespace-nowrap",
                      drag.dragging === column.id && "cursor-grabbing opacity-40", drag.over === column.id && "bg-primary-50")}>
                    {column.label}
                    <span className="sr-only">, column {at + 1} of {shownColumns.length}. Use the Columns button to move or hide it.</span>
                  </th>
                ))}
                <th scope="col" className="py-3 pr-5 pl-4"><span className="sr-only">Open</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {!data && !failed && (
                <tr><td colSpan={shownColumns.length + 2} className="px-5 py-10 text-center text-ink-muted">Loading the queue…</td></tr>
              )}
              {data && rows.length === 0 && (
                <tr><td colSpan={shownColumns.length + 2} className="px-5 py-10 text-center text-ink-muted">
                  {words || standing ? "No prospect matches that."
                    : "No prospect's papers are pending. They arrive here once the desk sends something to Compliance."}
                </td></tr>
              )}
              {rows.map((row) => (
                <tr key={row.prospectId} onClick={() => void navigate(documentsOf(row))} className="cursor-pointer align-middle hover:bg-canvas/60">
                  <td className="py-3 pr-4 pl-5">
                    <div className="flex items-center gap-3">
                      <Avatar name={row.fullName} />
                      <div className="min-w-0">
                        <span className="block font-semibold">{row.fullName}</span>
                        <span className="block text-xs text-ink-muted">{who(row)}</span>
                      </div>
                    </div>
                  </td>
                  {shownColumns.map((column) => (
                    <td key={column.id} className={cn("px-4 py-3", column.nowrap && "whitespace-nowrap")}>{column.cell(row)}</td>
                  ))}
                  <td className="py-3 pr-5 pl-4 text-right">
                    <span className="inline-flex items-center gap-0.5 text-sm font-semibold whitespace-nowrap text-primary-700">
                      Open<ChevronRight aria-hidden="true" className="size-4" />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {inReview.length > 0 && (
          <PagedFooter noun={["prospect", "prospects"]}
            paged={{ page, size, total: inReview.length, onPage: setPage, onSize: (next) => { setSize(next); setPage(0); } }} />
        )}
      </section>
    </div>
  );
}

function Tile({ label, count, hint }: { label: string; count?: number; hint: string }) {
  return (
    <div className="rounded-2xl border border-line bg-white px-5 py-4">
      <p className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">{label}</p>
      <p className="mt-1 text-3xl font-bold text-ink">{count ?? "—"}</p>
      <p className="mt-0.5 text-xs text-ink-muted">{hint}</p>
    </div>
  );
}
