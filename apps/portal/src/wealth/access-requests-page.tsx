import { ApiError } from "@atomprive/api-client";
import {
  getAccountsQueryKey,
  getFamilyWealthQueryKey,
  getPermissionsQueryKey,
  getReceivedQueryKey,
  getSentQueryKey,
  getWealthGrantsQueryKey,
  getWealthRequestsQueryKey,
  getWhoICanAskQueryKey,
  useAnswer,
  useAnswerWealthRequest,
  useAsk,
  useAskForWealth,
  useCancel,
  useCancelWealthRequest,
  useReceived,
  useSent,
  useWealthRequests,
  useWhoICanAsk,
  type AccountRow,
  type RequestRow,
  type WealthRequestRow,
  type WhoICanAsk,
} from "@atomprive/api-client/portal";
import { Alert, Button, Dialog } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Check, Inbox, Plus, Send, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router";
import { when } from "../lib/dates";
import { accountKind, initialsOf } from "../lib/money";
import { AccessPill } from "./access-pill";
import { SEEN_KEY } from "./requests-seen";

/**
 * Asking a family member to see their accounts or their wealth, and answering what they ask of you. Incoming
 * holds what waits on the client, Outgoing what they are waiting on, and History everything answered or taken
 * back, both ways. Whatever is agreed is sight only.
 */

const TABS = [
  { id: "incoming", label: "Incoming" },
  { id: "outgoing", label: "Outgoing" },
  { id: "history", label: "History" },
] as const;

type TabId = (typeof TABS)[number]["id"];

/** One request of either kind, read the same way. */
type Asked = {
  key: string;
  kind: "accounts" | "wealth";
  id: string;
  mine: boolean;
  requesterName: string;
  requesterPhoto: string | null;
  ownerName: string;
  ownerPhoto: string | null;
  message: string | null;
  status: string;
  askedAt: string;
  decidedAt: string | null;
  comment: string | null;
  /** What was asked for, read by the owner: "your accounts at Emirates NBD". */
  yours: string;
  /** And by the asker: "their accounts at Emirates NBD". */
  theirs: string;
  accounts: AccountRow[];
  outcome: string | null;
  expiresOn: string | null;
};

function fromAccounts(one: RequestRow): Asked {
  const bank = one.accounts[0]?.bankName ?? "their bank";
  return {
    key: `accounts-${one.id}`,
    kind: "accounts",
    id: one.id,
    mine: one.mine,
    requesterName: one.requesterName,
    requesterPhoto: one.requesterPhoto,
    ownerName: one.ownerName,
    ownerPhoto: one.ownerPhoto,
    message: one.message,
    status: one.status,
    askedAt: one.askedAt,
    decidedAt: one.decidedAt,
    comment: one.decisionComment,
    yours: `your accounts at ${bank}`,
    theirs: `accounts at ${bank}`,
    accounts: one.accounts,
    outcome: one.status === "APPROVED" ? `${one.granted} of ${one.accountsAsked} ${one.accountsAsked === 1 ? "account" : "accounts"}` : null,
    expiresOn: null,
  };
}

function fromWealth(one: WealthRequestRow): Asked {
  return {
    key: `wealth-${one.id}`,
    kind: "wealth",
    id: one.id,
    mine: one.mine,
    requesterName: one.requesterName,
    requesterPhoto: one.requesterPhoto,
    ownerName: one.ownerName,
    ownerPhoto: one.ownerPhoto,
    message: one.message,
    status: one.status,
    askedAt: one.askedAt,
    decidedAt: one.decidedAt,
    comment: one.decisionComment,
    yours: "your wealth",
    theirs: "wealth",
    accounts: [],
    outcome: one.status === "APPROVED" ? (one.expiresOn ? `Until ${when(one.expiresOn)}` : "Until taken back") : null,
    expiresOn: one.expiresOn,
  };
}

const STATUS: Record<string, { label: string; tone: string }> = {
  ASKED: { label: "Waiting", tone: "bg-access-view-soft text-access-view-ink" },
  APPROVED: { label: "Approved", tone: "bg-access-full-soft text-access-full-ink" },
  REJECTED: { label: "Rejected", tone: "bg-access-none-soft text-access-none-ink" },
  CANCELLED: { label: "Withdrawn", tone: "bg-canvas text-ink-soft" },
};

function Status({ status }: { status: string }) {
  const said = STATUS[status] ?? { label: status, tone: "bg-canvas text-ink-soft" };
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${said.tone}`}>{said.label}</span>;
}

function Face({ name, photo, size = "size-10" }: { name: string; photo: string | null; size?: string }) {
  return photo ? (
    <img src={photo} alt="" className={`${size} shrink-0 rounded-full object-cover`} />
  ) : (
    <span className={`flex ${size} shrink-0 items-center justify-center rounded-full bg-primary-50 text-xs font-bold text-primary-700`}>{initialsOf(name)}</span>
  );
}

function tomorrow() {
  const day = new Date();
  day.setDate(day.getDate() + 1);
  return day.toISOString().slice(0, 10);
}

const FIELD = "h-10 w-full rounded-xl border border-line bg-white px-3 text-sm focus-visible:border-primary-600 focus-visible:outline-2 focus-visible:outline-primary-600";
const AREA = "w-full rounded-xl border border-line bg-white px-3 py-2 text-sm focus-visible:border-primary-600 focus-visible:outline-2 focus-visible:outline-primary-600";
const LABEL = "mb-1.5 block text-2xs font-semibold tracking-wider text-ink-muted uppercase";

function useRefresh() {
  const queryClient = useQueryClient();
  return () => {
    for (const queryKey of [
      getReceivedQueryKey(),
      getSentQueryKey(),
      getWealthRequestsQueryKey(),
      getWhoICanAskQueryKey(),
      getPermissionsQueryKey(),
      getWealthGrantsQueryKey(),
      getFamilyWealthQueryKey(),
      getAccountsQueryKey(),
    ]) {
      void queryClient.invalidateQueries({ queryKey });
    }
  };
}

/** Approve, with the accounts ticked and an end date if wanted; or reject, saying why. */
function AnswerDialog({ asked, agreeing, onClose }: { asked: Asked; agreeing: boolean; onClose: () => void }) {
  const refresh = useRefresh();
  const [ticked, setTicked] = useState<Set<string>>(new Set(asked.accounts.map((one) => one.id)));
  const [until, setUntil] = useState("");
  const [comment, setComment] = useState("");
  // Approve or Reject pressed with something required missing: it shows in red until it is filled.
  const [tried, setTried] = useState(false);
  const noAccounts = tried && agreeing && asked.kind === "accounts" && ticked.size === 0;
  const noReason = tried && !agreeing && !comment.trim();
  const done = {
    mutation: {
      onSuccess: () => {
        refresh();
        onClose();
      },
    },
  };
  const accounts = useAnswer<ApiError>(done);
  const wealth = useAnswerWealthRequest<ApiError>(done);
  const busy = accounts.isPending || wealth.isPending;
  const error = accounts.error ?? wealth.error;
  const submit = () => {
    const missing = agreeing
      ? asked.kind === "accounts" && ticked.size === 0 ? `share-${asked.accounts[0]?.id}` : null
      : !comment.trim() ? "answer-comment" : null;
    if (missing) {
      setTried(true);
      document.getElementById(missing)?.focus();
      return;
    }
    const expiresOn = agreeing && until ? until : null;
    const said = comment.trim() || null;
    if (asked.kind === "wealth") {
      wealth.mutate({ id: asked.id, data: { agreed: agreeing, expiresOn, comment: said } });
    } else {
      accounts.mutate({ id: asked.id, data: { accounts: agreeing ? [...ticked] : [], expiresOn, comment: said } });
    }
  };
  const toggle = (id: string) =>
    setTicked((was) => {
      const next = new Set(was);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <Dialog
      open
      onClose={onClose}
      title={agreeing ? `Approve ${asked.requesterName}'s request` : `Reject ${asked.requesterName}'s request`}
      description={
        agreeing
          ? `${asked.requesterName} will be able to see ${asked.yours}. View only: they can never change or move anything, and you can take it back at any time.`
          : `${asked.requesterName} is told your reason and nothing else.`
      }
    >
      <div className="space-y-4">
        {agreeing && asked.kind === "accounts" && (
          <fieldset>
            <legend className={LABEL}>Accounts to share</legend>
            <ul className="space-y-2">
              {asked.accounts.map((one) => (
                <li key={one.id}>
                  <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-line px-3 py-2.5 hover:bg-sidebar">
                    <input id={`share-${one.id}`} type="checkbox" checked={ticked.has(one.id)} onChange={() => toggle(one.id)} className="size-4 accent-primary-600" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-ink">{one.nickname ?? `${one.bankName} ${accountKind(one.accountType)}`}</span>
                      <span className="block text-xs text-ink-muted">•••• {one.lastFour}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            {noAccounts && <p className="mt-1 text-xs text-red-600">Choose at least one account to share.</p>}
          </fieldset>
        )}
        {agreeing && (
          <div>
            <label htmlFor="answer-until" className={LABEL}>Until (optional)</label>
            <input id="answer-until" name="answer-until" type="date" min={tomorrow()} value={until} onChange={(event) => setUntil(event.target.value)} className={FIELD} />
            <p className="mt-1 text-xs text-ink-muted">Leave empty to share until you take it back.</p>
          </div>
        )}
        <div>
          <label htmlFor="answer-comment" className={LABEL}>{agreeing ? "A note (optional)" : "Why"}</label>
          <textarea
            id="answer-comment"
            name="answer-comment"
            rows={3}
            maxLength={500}
            value={comment}
            aria-invalid={noReason || undefined}
            aria-describedby={noReason ? "answer-comment-error" : undefined}
            onChange={(event) => setComment(event.target.value)}
            className={`${AREA} aria-invalid:border-red-500`}
          />
          {noReason && <p id="answer-comment-error" className="mt-1 text-xs text-red-600">Enter a reason.</p>}
        </div>
        {error && <Alert tone="danger">{error.message}</Alert>}
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant={agreeing ? "primary" : "danger"}
            disabled={busy}
            onClick={submit}
          >
            {agreeing ? <Check aria-hidden="true" /> : <X aria-hidden="true" />}
            {busy ? "Saving…" : agreeing ? "Approve" : "Reject"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

/** Choose who, then what: one of the banks they use, or their wealth. Never a list of their accounts. */
function NewRequestDialog({ onClose }: { onClose: () => void }) {
  const refresh = useRefresh();
  const family = useWhoICanAsk<WhoICanAsk[], ApiError>();
  const [who, setWho] = useState<string>();
  const [what, setWhat] = useState<string>();
  const [message, setMessage] = useState("");
  // Send pressed before somebody and something are chosen: each missing choice is said in red until made.
  const [tried, setTried] = useState(false);
  const done = {
    mutation: {
      onSuccess: () => {
        refresh();
        onClose();
      },
    },
  };
  const askAccounts = useAsk<ApiError>(done);
  const askWealth = useAskForWealth<ApiError>(done);
  const busy = askAccounts.isPending || askWealth.isPending;
  const error = askAccounts.error ?? askWealth.error;
  const people = family.data ?? [];
  const chosen = people.find((one) => one.customerId === who);
  const nobody = tried && !who;
  const nothing = tried && !!who && !what;

  return (
    <Dialog open onClose={onClose} title="New access request" description="Ask a family member to let you see their accounts or their wealth. Nothing is shared until they approve.">
      <div className="space-y-5">
        <fieldset>
          <legend className={LABEL}>Family member</legend>
          {family.isPending ? (
            <div className="h-16 animate-pulse rounded-xl bg-sidebar" />
          ) : people.length === 0 ? (
            <p className="rounded-xl bg-sidebar px-4 py-3 text-sm text-ink-muted">There is nobody else in your family group to ask yet.</p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {people.map((one, at) => (
                <li key={one.customerId}>
                  <button
                    id={at === 0 ? "ask-who-first" : undefined}
                    type="button"
                    aria-pressed={who === one.customerId}
                    onClick={() => {
                      setWho(one.customerId);
                      setWhat(undefined);
                    }}
                    className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left ${who === one.customerId ? "border-primary-600 bg-primary-50" : "border-line hover:bg-sidebar"}`}
                  >
                    <Face name={one.fullName} photo={one.photo} size="size-9" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-ink">{one.fullName}</span>
                      {one.relationship && <span className="block text-xs text-ink-muted">{one.relationship}</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {nobody && <p className="mt-1 text-xs text-red-600">Choose a family member.</p>}
        </fieldset>

        {chosen && (
          <fieldset>
            <legend className={LABEL}>What you'd like to see</legend>
            <ul className="space-y-2">
              {[{ id: "wealth", label: "Their wealth", hint: "Portfolio, assets owned outside it, and loans" }, ...chosen.banks.map((bank) => ({ id: bank.bankId, label: `Accounts at ${bank.bankName}`, hint: "They choose which accounts to share" }))].map((one, at) => (
                <li key={one.id}>
                  <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-line px-3 py-2.5 hover:bg-sidebar">
                    <input id={at === 0 ? "ask-what-first" : undefined} type="radio" name="ask-what" checked={what === one.id} onChange={() => setWhat(one.id)} className="size-4 accent-primary-600" />
                    <span>
                      <span className="block text-sm font-semibold text-ink">{one.label}</span>
                      <span className="block text-xs text-ink-muted">{one.hint}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            {nothing && <p className="mt-1 text-xs text-red-600">Choose what you'd like to see.</p>}
          </fieldset>
        )}

        <div>
          <label htmlFor="ask-message" className={LABEL}>Message (optional)</label>
          <textarea id="ask-message" name="ask-message" rows={3} maxLength={500} value={message} onChange={(event) => setMessage(event.target.value)} className={AREA} />
        </div>
        {error && <Alert tone="danger">{error.message}</Alert>}
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            // Only held back when there is nobody to ask at all; a choice not made yet is said in red instead.
            disabled={busy || people.length === 0}
            onClick={() => {
              if (!who || !what) {
                setTried(true);
                document.getElementById(!who ? "ask-who-first" : "ask-what-first")?.focus();
                return;
              }
              const said = message.trim() || null;
              if (what === "wealth") askWealth.mutate({ data: { ownerId: who, message: said } });
              else askAccounts.mutate({ data: { ownerId: who, bankId: what, message: said } });
            }}
          >
            <Send aria-hidden="true" />
            {busy ? "Sending…" : "Send request"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

function Card({ asked, children, side }: { asked: Asked; children: ReactNode; side: "incoming" | "outgoing" }) {
  const name = side === "incoming" ? asked.requesterName : asked.ownerName;
  const photo = side === "incoming" ? asked.requesterPhoto : asked.ownerPhoto;
  return (
    <li className="flex flex-col gap-4 rounded-2xl border border-line bg-white p-5 sm:flex-row sm:items-start">
      <Face name={name} photo={photo} />
      <div className="min-w-0 flex-1">
        <p className="text-sm text-ink">
          {side === "incoming" ? (
            <>
              <b>{asked.requesterName}</b> asked to see <b>{asked.yours}</b>
            </>
          ) : (
            <>
              You asked <b>{asked.ownerName}</b> to see their <b>{asked.theirs}</b>
            </>
          )}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
          {when(asked.askedAt)} · Permission asked: <AccessPill mine={false} />
        </p>
        {asked.message && <p className="mt-2 rounded-xl bg-sidebar px-3 py-2 text-sm text-ink-soft italic">“{asked.message}”</p>}
      </div>
      <div className="flex shrink-0 gap-2">{children}</div>
    </li>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="flex flex-col items-center gap-2 rounded-2xl border border-line bg-white px-6 py-12 text-center text-sm text-ink-muted">
      <Inbox aria-hidden="true" className="size-6" />
      {children}
    </p>
  );
}

export function AccessRequestsPage() {
  const refresh = useRefresh();
  const [params, setParams] = useSearchParams();
  const tab: TabId = TABS.some((one) => one.id === params.get("tab")) ? (params.get("tab") as TabId) : "incoming";
  const [answering, setAnswering] = useState<{ asked: Asked; agreeing: boolean } | null>(null);
  const [asking, setAsking] = useState(false);

  const received = useReceived<RequestRow[], ApiError>();
  const sent = useSent<RequestRow[], ApiError>();
  const wealth = useWealthRequests<WealthRequestRow[], ApiError>();
  const cancelAccounts = useCancel<ApiError>({ mutation: { onSuccess: refresh } });
  const cancelWealth = useCancelWealthRequest<ApiError>({ mutation: { onSuccess: refresh } });

  // Having looked, the answers that came in are no longer news for the bell.
  useEffect(() => {
    try {
      localStorage.setItem(SEEN_KEY, new Date().toISOString());
    } catch {
      // Private windows refuse storage; the bell then counts answers until the page is next opened.
    }
  }, []);

  const all = [...(received.data ?? []).map(fromAccounts), ...(sent.data ?? []).map(fromAccounts), ...(wealth.data ?? []).map(fromWealth)].sort((a, b) =>
    b.askedAt.localeCompare(a.askedAt),
  );
  const incoming = all.filter((one) => !one.mine && one.status === "ASKED");
  const outgoing = all.filter((one) => one.mine && one.status === "ASKED");
  const history = all.filter((one) => one.status !== "ASKED");
  const counts: Record<TabId, number> = { incoming: incoming.length, outgoing: outgoing.length, history: history.length };
  const loaded = received.data && sent.data && wealth.data;
  const failed = received.isError || sent.isError || wealth.isError;
  const cancelError = cancelAccounts.error ?? cancelWealth.error;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[1.625rem] font-bold text-balance text-ink">Access Requests</h1>
          <p className="mt-1 text-sm text-ink-muted">Ask to see a family member's accounts or wealth, and answer what they ask of you.</p>
        </div>
        <Button onClick={() => setAsking(true)}>
          <Plus aria-hidden="true" />
          New request
        </Button>
      </div>

      <div role="tablist" aria-label="Access requests" className="flex gap-6 overflow-x-auto border-b border-line">
        {TABS.map((one) => (
          <button
            key={one.id}
            type="button"
            role="tab"
            aria-selected={tab === one.id}
            onClick={() =>
              setParams(
                (was) => {
                  const next = new URLSearchParams(was);
                  next.set("tab", one.id);
                  return next;
                },
                { replace: true },
              )
            }
            className={`-mb-px border-b-2 pb-2.5 text-sm font-semibold whitespace-nowrap ${tab === one.id ? "border-primary-600 text-primary-700" : "border-transparent text-ink-muted hover:text-ink"}`}
          >
            {one.label} ({counts[one.id]})
          </button>
        ))}
      </div>

      {cancelError && <Alert tone="danger">{cancelError.message}</Alert>}

      {failed ? (
        <p className="rounded-2xl border border-line bg-white p-6 text-sm text-access-none-ink">Your requests could not be loaded. Refresh the page to try again.</p>
      ) : !loaded ? (
        <div className="h-40 animate-pulse rounded-2xl bg-white/60" />
      ) : tab === "incoming" ? (
        incoming.length === 0 ? (
          <Empty>Nobody is waiting on an answer from you.</Empty>
        ) : (
          <ul className="space-y-3">
            {incoming.map((one) => (
              <Card key={one.key} asked={one} side="incoming">
                <Button variant="secondary" onClick={() => setAnswering({ asked: one, agreeing: false })}>
                  Reject
                </Button>
                <Button onClick={() => setAnswering({ asked: one, agreeing: true })}>Approve</Button>
              </Card>
            ))}
          </ul>
        )
      ) : tab === "outgoing" ? (
        outgoing.length === 0 ? (
          <Empty>You aren't waiting on anybody.</Empty>
        ) : (
          <ul className="space-y-3">
            {outgoing.map((one) => (
              <Card key={one.key} asked={one} side="outgoing">
                <Button
                  variant="secondary"
                  disabled={cancelAccounts.isPending || cancelWealth.isPending}
                  onClick={() => (one.kind === "wealth" ? cancelWealth.mutate({ id: one.id }) : cancelAccounts.mutate({ id: one.id }))}
                >
                  Withdraw
                </Button>
              </Card>
            ))}
          </ul>
        )
      ) : history.length === 0 ? (
        <Empty>Nothing has been answered yet.</Empty>
      ) : (
        <section className="overflow-x-auto rounded-2xl border border-line bg-white p-5">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead>
              <tr className="border-y border-line text-left text-2xs font-semibold tracking-wider whitespace-nowrap text-ink-muted uppercase">
                <th scope="col" className="py-3 pr-4 pl-3">Asked</th>
                <th scope="col" className="px-4 py-3">Who</th>
                <th scope="col" className="px-4 py-3">What</th>
                <th scope="col" className="px-4 py-3">Permission</th>
                <th scope="col" className="px-4 py-3">Status</th>
                <th scope="col" className="py-3 pr-3 pl-4">Answer</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {history.map((one) => (
                <tr key={one.key}>
                  <td className="px-3 py-2.5 whitespace-nowrap text-ink-soft">{when(one.askedAt)}</td>
                  <td className="px-3 py-2.5">
                    <span className="flex items-center gap-1.5 font-semibold whitespace-nowrap text-ink">
                      {one.mine ? "You" : one.requesterName}
                      <ArrowRight aria-hidden="true" className="size-3.5 text-ink-muted" />
                      {one.mine ? one.ownerName : "You"}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-ink-soft">{one.mine ? `Their ${one.theirs}` : one.yours.replace(/^your/, "Your")}</td>
                  <td className="px-3 py-2.5">
                    <AccessPill mine={false} />
                  </td>
                  <td className="px-3 py-2.5">
                    <Status status={one.status} />
                    {one.decidedAt && <span className="mt-0.5 block text-xs text-ink-muted">{when(one.decidedAt)}</span>}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-ink-muted">
                    {one.outcome && <span className="block font-semibold text-ink">{one.outcome}</span>}
                    {one.comment && <span className="block max-w-64">{one.comment}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {answering && <AnswerDialog asked={answering.asked} agreeing={answering.agreeing} onClose={() => setAnswering(null)} />}
      {asking && <NewRequestDialog onClose={() => setAsking(false)} />}
    </div>
  );
}
