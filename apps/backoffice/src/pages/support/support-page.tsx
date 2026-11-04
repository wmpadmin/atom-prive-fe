import { ApiError, http } from "@atomprive/api-client";
import {
  getMyStaffTicketFileUrl,
  getMyStaffTicketQueryKey,
  getMyStaffTicketsQueryKey,
  getRaiseStaffTicketUrl,
  getSupportQueueQueryKey,
  getSupportTicketFileUrl,
  getSupportTicketQueryKey,
  useCloseMyStaffTicket,
  useMyStaffTicket,
  useMyStaffTickets,
  useReopenMyStaffTicket,
  useSetTicketStatus,
  useSupportQueue,
  useSupportTicket,
  useTriageTicket,
  type TicketDetail,
  type TicketRow,
} from "@atomprive/api-client/backoffice";
import { RaiseTicketDialog } from "@atomprive/support/raise-ticket-dialog";
import { CATEGORY_LABELS, PRIORITY_LABELS, PRIORITY_TONES } from "@atomprive/support/ticket-fields";
import { statusLabel } from "@atomprive/support/ticket-status-label";
import { TicketStatus } from "@atomprive/support/ticket-status";
import { TicketView } from "@atomprive/support/ticket-view";
import { Alert, Button, SelectInput, TextInput, cn } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  Headset,
  Paperclip,
  Plus,
  Search,
  Tag,
  User,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { useStaffUser } from "../../auth/session";
import { lastPage } from "../../lib/last-page";

/**
 * Support, for every member of staff: the tickets they raised, and — for the IT Admin — every ticket with how
 * urgent it is and when it should be answered by. The list on the left, the ticket picked on the right with its
 * details, conversation, attachments and what has been done to it.
 *
 * <p>The IT Admin raises nothing here; they answer. Everybody else raises a ticket from New ticket, and reads
 * their own.
 */

type Tab = "mine" | "all" | "sla";

const STATUSES = ["OPEN", "IN_PROGRESS", "WAITING", "RESOLVED", "CLOSED"];

const PAGE = 8;

function when(at: string) {
  const day = new Date(at);
  const today = new Date().toDateString() === day.toDateString();
  return today
    ? `Today, ${day.toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit" })}`
    : day.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

/** How long is left before a ticket should be answered, or how far past it. */
function remaining(ticket: TicketRow) {
  if (!["OPEN", "IN_PROGRESS"].includes(ticket.status)) return null;
  const minutes = Math.round((new Date(ticket.slaDueAt).getTime() - Date.now()) / 60_000);
  const size = Math.abs(minutes);
  const said = size >= 1440 ? `${Math.round(size / 1440)}d` : size >= 60 ? `${Math.round(size / 60)}h` : `${size}m`;
  return minutes < 0 ? { text: `${said} overdue`, late: true } : { text: `${said} remaining`, late: false };
}

export function SupportPage() {
  const user = useStaffUser();
  // The person who is the IT Admin, whichever workspace they are working in: Support is theirs, not a desk's.
  const answers = user.roles.includes("IT_ADMIN");
  // The Admin reads every ticket as well, and answers none (4 Nov 2026).
  const readsAll = answers || user.roles.includes("ADMIN");
  const [tab, setTab] = useState<Tab>(readsAll ? "all" : "mine");
  const [typed, setTyped] = useState("");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [raising, setRaising] = useState(false);
  const queryClient = useQueryClient();

  const mine = useMyStaffTickets<TicketRow[], ApiError>({ query: { enabled: tab === "mine" } });
  const all = useSupportQueue<TicketRow[], ApiError>({ query: { enabled: readsAll && tab !== "mine" } });
  // Whether the list on screen is everybody's tickets, read as support reads them, or the reader's own.
  const everyone = tab !== "mine";
  const source = tab === "mine" ? mine : all;

  const rows = useMemo(() => {
    const words = typed.trim().toLowerCase();
    const kept = (source.data ?? []).filter((one) =>
      (!status || one.status === status) && (!priority || one.priority === priority) && (!category || one.category === category)
      && (!words || [one.reference, one.subject, one.raisedByName].some((text) => text.toLowerCase().includes(words))));
    // The SLA monitor reads the tickets still with the IT Admin, the soonest due first.
    return tab === "sla"
      ? kept.filter((one) => ["OPEN", "IN_PROGRESS"].includes(one.status))
        .sort((a, b) => new Date(a.slaDueAt).getTime() - new Date(b.slaDueAt).getTime())
      : kept;
  }, [source.data, typed, status, priority, category, tab]);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const shown = rows.slice(page * PAGE, page * PAGE + PAGE);
  const current = picked && rows.some((one) => one.id === picked) ? picked : shown[0]?.id ?? null;
  const overdue = (all.data ?? []).filter((one) => one.overdue).length;

  const sla = { id: "sla" as const, label: `SLA monitor${overdue ? ` (${overdue} overdue)` : ""}` };
  const tabs: { id: Tab; label: string }[] = answers
    ? [{ id: "all", label: "All tickets" }, sla]
    : readsAll ? [{ id: "all", label: "All tickets" }, sla, { id: "mine", label: "My tickets" }]
      : [{ id: "mine", label: "My tickets" }];
  const resetPage = () => setPage(0);

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-2xl bg-primary-50 text-primary-600">
            <Headset className="size-6" aria-hidden="true" />
          </span>
          <div>
            <h1 className="text-[1.625rem] leading-tight font-bold">Support</h1>
            <p className="text-sm text-ink-muted">
              {readsAll ? "Every ticket raised, how urgent it is and when it should be answered." : "Raise, track and follow up your support requests."}
            </p>
          </div>
        </div>
        {!answers && (
          <Button onClick={() => setRaising(true)}>
            <Plus aria-hidden="true" />
            New ticket
          </Button>
        )}
      </header>

      {/* Where each ticket stands, counted, and each a quick filter: pressing one shows those alone. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {STATUSES.map((one) => {
          const count = (source.data ?? []).filter((ticket) => ticket.status === one).length;
          return (
            <button key={one} type="button" aria-pressed={status === one}
              onClick={() => { setStatus(status === one ? "" : one); resetPage(); }}
              className={cn("rounded-2xl border bg-white px-4 py-3 text-left transition-colors",
                status === one ? "border-primary-400 ring-2 ring-primary-100" : "border-line hover:border-primary-300")}>
              <span className="block text-xs font-semibold text-ink-muted">{statusLabel(one, everyone ? "support" : "raiser")}</span>
              <span className="block text-2xl font-bold tabular-nums">{source.data ? count : "—"}</span>
            </button>
          );
        })}
      </div>

      {tabs.length > 1 && (
      <div role="tablist" aria-label="Which tickets" className="flex gap-1 border-b border-line">
        {tabs.map((one) => (
          <button key={one.id} type="button" role="tab" aria-selected={tab === one.id}
            onClick={() => { setTab(one.id); resetPage(); setPicked(null); }}
            className={cn("-mb-px border-b-2 px-3 py-2.5 text-sm font-semibold whitespace-nowrap",
              tab === one.id ? "border-primary-600 text-primary-700" : "border-transparent text-ink-muted hover:text-ink")}>
            {one.label}
          </button>
        ))}
      </div>
      )}

      {source.data && source.data.length === 0 ? (
        <section className="grid place-items-center rounded-2xl border border-line bg-white px-6 py-16 text-center">
          <span className="grid size-14 place-items-center rounded-2xl bg-primary-50 text-primary-600">
            <Headset className="size-7" aria-hidden="true" />
          </span>
          <h2 className="mt-4 text-lg font-bold">{everyone ? "No ticket has been raised yet" : "You haven't raised a ticket yet"}</h2>
          <p className="mt-1 max-w-md text-sm text-ink-muted">
            {everyone
              ? "When a client or a member of staff raises one, it appears here with how urgent it is and when it should be answered."
              : "Something not working? Raise a ticket and the IT team will reply here and by email."}
          </p>
          {!everyone && (
            <Button className="mt-5" onClick={() => setRaising(true)}>
              <Plus aria-hidden="true" />
              Raise a ticket
            </Button>
          )}
        </section>
      ) : (
      <>
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-60 flex-1">
          <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted" />
          <TextInput id="ticket-search" value={typed} onChange={(event) => { setTyped(event.target.value); resetPage(); }}
            placeholder="Search tickets (number, subject, who raised it)" aria-label="Search tickets" className="pl-9" />
        </div>
        <SelectInput id="ticket-status-filter" aria-label="Status" value={status} className="w-44"
          onChange={(event) => { setStatus(event.target.value); resetPage(); }}>
          <option value="">Status: all</option>
          {STATUSES.map((one) => <option key={one} value={one}>{statusLabel(one, everyone ? "support" : "raiser")}</option>)}
        </SelectInput>
        <SelectInput id="ticket-priority-filter" aria-label="Priority" value={priority} className="w-40"
          onChange={(event) => { setPriority(event.target.value); resetPage(); }}>
          <option value="">Priority: all</option>
          {Object.entries(PRIORITY_LABELS).map(([value, name]) => <option key={value} value={value}>{name}</option>)}
        </SelectInput>
        <SelectInput id="ticket-category-filter" aria-label="Category" value={category} className="w-48"
          onChange={(event) => { setCategory(event.target.value); resetPage(); }}>
          <option value="">Category: all</option>
          {Object.entries(CATEGORY_LABELS).map(([value, name]) => <option key={value} value={value}>{name}</option>)}
        </SelectInput>
      </div>

      {source.isError && <Alert tone="danger">{source.error.message}</Alert>}

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(22rem,1fr)]">
        <section className="min-w-0 rounded-2xl border border-line bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-ink-muted">
                  <th scope="col" className="px-4 py-3 font-semibold">Ticket</th>
                  <th scope="col" className="px-3 py-3 font-semibold">Subject</th>
                  {everyone && <th scope="col" className="px-3 py-3 font-semibold">Raised by</th>}
                  <th scope="col" className="px-3 py-3 font-semibold">Category</th>
                  <th scope="col" className="px-3 py-3 font-semibold">Priority</th>
                  <th scope="col" className="px-3 py-3 font-semibold">Status</th>
                  <th scope="col" className="px-4 py-3 font-semibold">{tab === "sla" ? "Answer by" : "Updated"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {shown.map((one) => {
                  const left = remaining(one);
                  return (
                    <tr key={one.id} onClick={() => setPicked(one.id)} aria-selected={current === one.id}
                      className={cn("cursor-pointer", current === one.id ? "bg-primary-50/70" : "hover:bg-slate-50")}>
                      <td className="px-4 py-3 font-semibold whitespace-nowrap">{one.reference}</td>
                      <td className="max-w-64 px-3 py-3"><span className="line-clamp-2">{one.subject}</span></td>
                      {everyone && (
                        <td className="px-3 py-3 whitespace-nowrap">
                          {one.raisedByName}
                          <span className="block text-2xs text-ink-muted">{one.raisedByType === "CLIENT" ? "Client" : "Staff"}</span>
                        </td>
                      )}
                      <td className="px-3 py-3 whitespace-nowrap">{CATEGORY_LABELS[one.category] ?? one.category}</td>
                      <td className="px-3 py-3">
                        <span className={cn("rounded-md px-2 py-0.5 text-xs font-semibold", PRIORITY_TONES[one.priority])}>
                          {PRIORITY_LABELS[one.priority] ?? one.priority}
                        </span>
                      </td>
                      <td className="px-3 py-3"><TicketStatus status={one.status} side={everyone ? "support" : "raiser"} /></td>
                      <td className="px-4 py-3 whitespace-nowrap text-ink-soft">
                        {tab === "sla" && left
                          ? <span className={cn("font-semibold", left.late ? "text-red-600" : "text-ink")}>{left.text}</span>
                          : when(one.updatedAt)}
                      </td>
                    </tr>
                  );
                })}
                {source.data && shown.length === 0 && (
                  <tr>
                    <td colSpan={everyone ? 7 : 6} className="px-4 py-10 text-center text-ink-muted">
                      {(source.data ?? []).length === 0
                        ? tab === "mine" ? "You haven't raised a ticket yet." : "No ticket has been raised yet."
                        : "No ticket matches these filters."}
                    </td>
                  </tr>
                )}
                {!source.data && !source.isError && (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-ink-muted">Reading the tickets…</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 text-sm">
            <span className="text-ink-muted">
              {rows.length === 0 ? "No tickets" : `Showing ${page * PAGE + 1}–${Math.min(rows.length, (page + 1) * PAGE)} of ${rows.length}`}
            </span>
            <div className="flex items-center gap-1">
              <button type="button" aria-label="Previous page" disabled={page === 0} onClick={() => setPage(page - 1)}
                className="grid size-8 place-items-center rounded-lg border border-line disabled:opacity-40">
                <ChevronLeft className="size-4" aria-hidden="true" />
              </button>
              <span className="px-2 tabular-nums">{page + 1} / {pages}</span>
              <button type="button" aria-label="Next page" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}
                className="grid size-8 place-items-center rounded-lg border border-line disabled:opacity-40">
                <ChevronRight className="size-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </section>

        {current ? (
          everyone ? <SupportSide id={current} canAct={answers} /> : <RaiserSide id={current} />
        ) : (
          <section className="rounded-2xl border border-dashed border-line px-6 py-16 text-center text-sm text-ink-muted">
            No ticket matches these filters.
          </section>
        )}
      </div>
      </>
      )}

      {raising && (
        <RaiseTicketDialog
          url={getRaiseStaffTicketUrl()}
          pageUrl={lastPage()}
          askCategory
          onClose={() => setRaising(false)}
          onRaised={(raised) => {
            setRaising(false);
            void queryClient.invalidateQueries({ queryKey: getMyStaffTicketsQueryKey() });
            setTab("mine");
            setPicked(raised.ticket.id);
          }}
        />
      )}
    </div>
  );
}

/** The ticket as the IT Admin works it: sort it, set its status, and answer it. */
function SupportSide({ id, canAct }: {
  id: string;
  /** The IT Admin answers and sorts; the Admin reads. */
  canAct: boolean;
}) {
  const queryClient = useQueryClient();
  const detail = useSupportTicket<TicketDetail, ApiError>(id);
  const refreshed = (fresh: TicketDetail) => {
    queryClient.setQueryData(getSupportTicketQueryKey(id), fresh);
    void queryClient.invalidateQueries({ queryKey: getSupportQueueQueryKey() });
  };
  const status = useSetTicketStatus<ApiError>({ mutation: { onSuccess: refreshed } });
  const triage = useTriageTicket<ApiError>({ mutation: { onSuccess: refreshed } });
  const reply = async (body: string, files: File[]) => {
    const form = new FormData();
    form.append("body", body);
    for (const file of files) form.append("files", file);
    refreshed(await http<TicketDetail>(`/api/backoffice/support/tickets/${id}/messages`, { method: "POST", body: form }));
  };
  if (!detail.data) return <SidePlaceholder failed={detail.isError} />;
  const ticket = detail.data.ticket;
  return (
    <TicketSide
      detail={detail.data}
      side="support"
      fileUrl={(fileId) => getSupportTicketFileUrl(id, fileId)}
      onReply={reply}
      canReply={canAct}
      problem={status.error?.message ?? triage.error?.message}
      controls={!canAct ? null : (
        <div className="grid grid-cols-3 gap-2">
          <Picker id="side-status" label="Status" value={ticket.status} disabled={status.isPending}
            options={STATUSES.map((one) => [one, statusLabel(one, "support")])}
            onChange={(value) => status.mutate({ id, data: { status: value } })} />
          <Picker id="side-priority" label="Priority" value={ticket.priority} disabled={triage.isPending}
            options={Object.entries(PRIORITY_LABELS)}
            onChange={(value) => triage.mutate({ id, data: { priority: value, category: ticket.category } })} />
          <Picker id="side-category" label="Category" value={ticket.category} disabled={triage.isPending}
            options={Object.entries(CATEGORY_LABELS)}
            onChange={(value) => triage.mutate({ id, data: { priority: ticket.priority, category: value } })} />
        </div>
      )}
    />
  );
}

/** The ticket as whoever raised it reads it: follow it up, close it, or reopen it. */
function RaiserSide({ id }: { id: string }) {
  const queryClient = useQueryClient();
  const detail = useMyStaffTicket<TicketDetail, ApiError>(id);
  const refreshed = (fresh: TicketDetail) => {
    queryClient.setQueryData(getMyStaffTicketQueryKey(id), fresh);
    void queryClient.invalidateQueries({ queryKey: getMyStaffTicketsQueryKey() });
  };
  const close = useCloseMyStaffTicket<ApiError>({ mutation: { onSuccess: refreshed } });
  const reopen = useReopenMyStaffTicket<ApiError>({ mutation: { onSuccess: refreshed } });
  const reply = async (body: string, files: File[]) => {
    const form = new FormData();
    form.append("body", body);
    for (const file of files) form.append("files", file);
    refreshed(await http<TicketDetail>(`/api/backoffice/support/my-tickets/${id}/messages`, { method: "POST", body: form }));
  };
  if (!detail.data) return <SidePlaceholder failed={detail.isError} />;
  const settled = ["RESOLVED", "CLOSED"].includes(detail.data.ticket.status);
  return (
    <TicketSide
      detail={detail.data}
      side="raiser"
      fileUrl={(fileId) => getMyStaffTicketFileUrl(id, fileId)}
      onReply={reply}
      problem={close.error?.message ?? reopen.error?.message}
      controls={
        settled ? (
          detail.data.canReopen && (
            <Button variant="secondary" size="sm" onClick={() => reopen.mutate({ id })} disabled={reopen.isPending}>Reopen</Button>
          )
        ) : (
          <Button variant="secondary" size="sm" onClick={() => close.mutate({ id })} disabled={close.isPending}>
            Close — it's sorted
          </Button>
        )
      }
    />
  );
}

function SidePlaceholder({ failed }: { failed: boolean }) {
  return failed
    ? <section className="rounded-2xl border border-line bg-white p-6 text-sm text-ink-muted">This ticket can't be found.</section>
    : <section className="h-96 animate-pulse rounded-2xl bg-white/60" />;
}

type SideTab = "details" | "conversation" | "attachments" | "activity";

/** One ticket on the right: its heading, the reader's controls, and four tabs. */
function TicketSide({ detail, side, fileUrl, onReply, controls, problem, canReply = true }: {
  detail: TicketDetail;
  /** Whether the reader may write on it at all: the Admin reads support's side without answering. */
  canReply?: boolean;
  side: "support" | "raiser";
  fileUrl: (fileId: string) => string;
  onReply: (body: string, files: File[]) => Promise<unknown>;
  controls: ReactNode;
  problem?: string;
}) {
  const [tab, setTab] = useState<SideTab>("details");
  const { ticket } = detail;
  const left = remaining(ticket);
  const tabs: { id: SideTab; label: string }[] = [
    { id: "details", label: "Details" },
    { id: "conversation", label: `Conversation (${detail.messages.length})` },
    { id: "attachments", label: `Attachments (${detail.files.length})` },
    { id: "activity", label: "Activity" },
  ];
  return (
    <section className="min-w-0 rounded-2xl border border-line bg-white">
      <div className="space-y-3 px-5 pt-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-lg font-bold">{ticket.reference}</span>
          <TicketStatus status={ticket.status} side={side} />
        </div>
        <h2 className="text-base font-bold text-balance">{ticket.subject}</h2>
        <dl className="grid grid-cols-3 gap-3 text-sm">
          <Fact icon={User} label="Raised by" value={ticket.raisedByName} />
          <Fact icon={Tag} label="Category" value={CATEGORY_LABELS[ticket.category] ?? ticket.category} />
          <Fact icon={Clock} label="Priority" value={
            <span className={cn("rounded-md px-2 py-0.5 text-xs font-semibold", PRIORITY_TONES[ticket.priority])}>
              {PRIORITY_LABELS[ticket.priority] ?? ticket.priority}
            </span>
          } />
        </dl>
        {controls}
        {problem && <Alert tone="danger">{problem}</Alert>}
      </div>
      <div role="tablist" aria-label="About this ticket" className="mt-4 flex gap-1 overflow-x-auto border-b border-line px-3">
        {tabs.map((one) => (
          <button key={one.id} type="button" role="tab" aria-selected={tab === one.id} onClick={() => setTab(one.id)}
            className={cn("-mb-px border-b-2 px-2.5 py-2 text-sm font-semibold whitespace-nowrap",
              tab === one.id ? "border-primary-600 text-primary-700" : "border-transparent text-ink-muted hover:text-ink")}>
            {one.label}
          </button>
        ))}
      </div>
      <div className="px-5 py-4">
        {tab === "details" && (
          <div className="space-y-4 text-sm">
            <div>
              <p className="mb-1 font-semibold">Description</p>
              <p className="whitespace-pre-wrap text-ink-soft">{detail.description}</p>
            </div>
            <dl className="grid grid-cols-2 gap-3">
              <Fact icon={CalendarClock} label="Raised" value={when(ticket.createdAt)} />
              <Fact icon={Clock} label="Answer by" value={
                <span>
                  {when(ticket.slaDueAt)}
                  {left && (
                    <span className={cn("ml-1.5 rounded-md px-1.5 py-0.5 text-2xs font-semibold",
                      left.late ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700")}>{left.text}</span>
                  )}
                </span>
              } />
              {detail.pageUrl && <Fact icon={FileText} label="Page" value={<span className="break-all">{detail.pageUrl}</span>} />}
              {detail.raisedByEmail && <Fact icon={User} label="Email" value={<span className="break-all">{detail.raisedByEmail}</span>} />}
            </dl>
          </div>
        )}
        {tab === "conversation" && (
          <TicketView detail={detail} side={side} fileUrl={fileUrl} onReply={onReply}
            canReply={canReply && ticket.status !== "CLOSED"} />
        )}
        {tab === "attachments" && (
          detail.files.length === 0 ? <p className="text-sm text-ink-muted">Nothing is attached.</p> : (
            <ul className="space-y-2 text-sm">
              {detail.files.map((one) => (
                <li key={one.id}>
                  <a href={fileUrl(one.id)} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 rounded-xl border border-line px-3 py-2 hover:border-primary-300">
                    <Paperclip className="size-4 text-ink-muted" aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate">{one.fileName}</span>
                    <span className="text-xs text-ink-muted">{Math.max(1, Math.round(one.sizeBytes / 1024))} KB</span>
                  </a>
                </li>
              ))}
            </ul>
          )
        )}
        {tab === "activity" && (
          detail.activity.length === 0 ? <p className="text-sm text-ink-muted">Nothing recorded yet.</p> : (
            <ol className="space-y-2.5 text-sm">
              {detail.activity.map((one, index) => (
                <li key={`${one.at}-${index}`} className="flex gap-3">
                  <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary-500" />
                  <span className="min-w-0 flex-1">
                    {one.what}
                    {one.by && <span className="text-ink-muted"> · {one.by}</span>}
                    <span className="block text-xs text-ink-muted">{when(one.at)}</span>
                  </span>
                </li>
              ))}
            </ol>
          )
        )}
      </div>
    </section>
  );
}

function Fact({ icon: Icon, label, value }: { icon: typeof User; label: string; value: ReactNode }) {
  return (
    <div className="flex min-w-0 gap-2">
      <Icon className="mt-0.5 size-4 shrink-0 text-ink-muted" aria-hidden="true" />
      <div className="min-w-0">
        <dt className="text-xs text-ink-muted">{label}</dt>
        <dd className="font-medium">{value}</dd>
      </div>
    </div>
  );
}

function Picker({ id, label, value, options, onChange, disabled }: {
  id: string;
  label: string;
  value: string;
  options: [string, string][];
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-2xs font-semibold tracking-wider text-ink-muted uppercase">{label}</label>
      <SelectInput id={id} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
        {options.map(([option, name]) => <option key={option} value={option}>{name}</option>)}
      </SelectInput>
    </div>
  );
}
