import { ApiError } from "@atomprive/api-client";
import {
  useAskAssistant,
  useAskMarketAssistant,
  useGetAssistantConversation,
  useGetAssistantStatus,
  useGetCustomer,
  useListCustomers,
  useListMyClients,
  type AssistantReply,
  type CustomerDetail,
  type CustomerPage,
  type MarketReply,
} from "@atomprive/api-client/backoffice";
import { Button } from "@atomprive/ui";
import { keepPreviousData } from "@tanstack/react-query";
import { ArrowLeft, ChevronDown, Clock, ExternalLink, Globe, Layers, Lock, Plus, Search, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router";
import { useStaffUser } from "../../auth/session";
import { Quotes } from "../../components/market-assistant";
import { ActionCard, FollowUps, ModelPicker, Suggestion } from "../../components/portfolio-assistant";
import { conversationFor, keepMarketChat, marketChatFor, startNewConversation } from "../../lib/assistant-conversation";
import { roleLabels } from "../../lib/labels";
import { clientFileHref, clientListHref, hasAuthority } from "../../lib/permissions";
import { usePreferences } from "../../lib/preferences";

/**
 * The AI Assistant, laid out as the firm's design (AI_Assistant_Screens_v3, screens 1 and 2): one place to ask,
 * a client to focus on, and the sources an answer may draw from.
 *
 * <p>Behind it are the two assistants the platform already has. Client & portfolio data — clients, portfolios,
 * KYC, the portal — is answered by the Firm Assistant, from the platform's own records and only what the asker
 * could already open. Market data is answered by the Market Assistant from public news and prices, which never
 * sees anything of the firm's. With both sources on, each question goes to the one it is about. Files & apps
 * (Outlook, OneDrive, SharePoint) is shown as the design has it, and says it is not connected yet.
 */

type Source = "firm" | "market";

type Entry =
  | { kind: "question"; text: string; at: string; source: Source }
  | { kind: "firm"; reply: AssistantReply; at: string }
  | { kind: "market"; reply: MarketReply; at: string }
  | { kind: "problem"; text: string; at: string };

/** The Market Assistant's turns as it has always kept them in this browser. */
type MarketKept = { who: "me"; text: string; at: string } | { who: "assistant"; reply: MarketReply; at: string }
  | { who: "problem"; text: string; at: string };

const SOURCES_KEY = "atomprive.assistant.sources";

function readSources(): Record<Source, boolean> {
  try {
    const kept = JSON.parse(localStorage.getItem(SOURCES_KEY) ?? "null") as Partial<Record<Source, boolean>> | null;
    if (kept && typeof kept.firm === "boolean" && typeof kept.market === "boolean" && (kept.firm || kept.market)) {
      return { firm: kept.firm, market: kept.market };
    }
  } catch {
    // Unreadable is the same as nothing kept.
  }
  return { firm: true, market: true };
}

const ABOUT_THE_FIRM = /\b(my clients?|clients?|portfolios?|kyc|onboard\w*|proposals?|tickets?|rebalanc\w*|drift\w*|breach\w*|allocation|papers?|reminder|portal|aml|holdings?|book)\b/i;
const ABOUT_THE_MARKET = /\b(news|markets?|share prices?|shares|stocks?|equities|index|indices|movers?|outlook|yields?|fx|currenc\w+|nasdaq|s&p|dow|ftse|nifty|sensex|asx|earnings|sector|prices?)\b/i;

/**
 * Which assistant a question goes to. One source on: that one. Both on: the firm's records when the question is
 * about clients or the platform, or a client is chosen; the market when it is about prices and news.
 */
function pick(question: string, sources: Record<Source, boolean>, clientChosen: boolean): Source {
  if (!sources.market) return "firm";
  if (!sources.firm) return "market";
  if (ABOUT_THE_FIRM.test(question)) return "firm";
  if (ABOUT_THE_MARKET.test(question) && !clientChosen) return "market";
  return "firm";
}

const SOURCE_LABEL: Record<Source, string> = { firm: "Client & portfolio data", market: "Market data" };
const SOURCE_TONE: Record<Source | "files", string> = {
  firm: "border-amber-200 bg-amber-50 text-amber-900",
  market: "border-slate-300 bg-slate-100 text-ink-soft",
  files: "border-rose-400/40 bg-rose-400/10 text-rose-700",
};

function SourceTag({ source }: { source: Source | "files" }) {
  return (
    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] font-semibold whitespace-nowrap ${SOURCE_TONE[source]}`}>
      {source === "files" ? "Files & apps" : SOURCE_LABEL[source]}
    </span>
  );
}

const TRY_ON_THE_BOOK: { question: string; sources: Source[] }[] = [
  { question: "Which of my clients are breaching their drift limits?", sources: ["firm"] },
  { question: "Who needs rebalancing first?", sources: ["firm"] },
  { question: "Summarise today's market movement.", sources: ["market"] },
  { question: "What are the top performing shares today?", sources: ["market"] },
  { question: "Which client has drifted the most?", sources: ["firm"] },
  { question: "What is the latest finance news?", sources: ["market"] },
];

const TRY_FOR_ANY_DESK: { question: string; sources: Source[] }[] = [
  { question: "Which of my clients have KYC papers outstanding?", sources: ["firm"] },
  { question: "What can I do on this portal?", sources: ["firm"] },
  { question: "Summarise today's market movement.", sources: ["market"] },
  { question: "What's the status of my support tickets?", sources: ["firm"] },
  { question: "What are the top performing shares today?", sources: ["market"] },
  { question: "What is the latest finance news?", sources: ["market"] },
];

const ON_A_CLIENT_DESK = ["Is this portfolio within the drift limit?", "How much to buy or sell to rebalance?", "What is the current asset allocation?"];
const ON_A_CLIENT = ["What KYC papers are still outstanding for this client?", "How far has this client's onboarding got?", "Send this client a KYC reminder."];
const ON_NOBODY = ["Summarise today's market movement.", "What can I do on this portal?", "What is the latest finance news?"];

function greeting() {
  const hour = new Date().getHours();
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

export function AssistantPage() {
  const user = useStaffUser();
  const [params, setParams] = useSearchParams();
  const clientId = params.get("client");
  // Portfolio questions are the portfolio desk's, which is whoever may write proposals; the server keeps to the same rule.
  const portfolioDesk = hasAuthority(user, "SEND_PROPOSALS:CHANGE");
  const [sources, setSources] = useState(readSources);
  const toggle = (source: Source) =>
    setSources((now) => {
      const next = { ...now, [source]: !now[source] };
      if (!next.firm && !next.market) return now; // One stays on: an answer has to come from somewhere.
      try {
        localStorage.setItem(SOURCES_KEY, JSON.stringify(next));
      } catch {
        // Not kept: this visit still uses the choice.
      }
      return next;
    });

  const chooseClient = (id: string | null) =>
    setParams((now) => {
      const next = new URLSearchParams(now);
      if (id) next.set("client", id);
      else next.delete("client");
      return next;
    }, { replace: true });

  const chat = useConversation(clientId, sources);
  const client = useGetCustomer<CustomerDetail, ApiError>(clientId ?? "", { query: { enabled: Boolean(clientId), retry: false } });
  const clientName = client.data?.client.fullName ?? null;

  // A question brought from another screen (?ask=…), asked once the conversation so far is back.
  const asked = params.get("ask");
  const askedOnce = useRef(false);
  useEffect(() => {
    if (!asked || askedOnce.current || !chat.ready) return;
    askedOnce.current = true;
    chat.send(asked);
    setParams((now) => {
      const next = new URLSearchParams(now);
      next.delete("ask");
      return next;
    }, { replace: true });
  });

  const started = chat.entries.length > 0 || chat.pending;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-[0.14em] text-ink-muted uppercase">Workspace</p>
          <span aria-hidden="true" className="mt-1.5 block h-0.5 w-8 rounded bg-primary-600" />
          <h1 className="mt-2 text-[1.75rem] font-bold text-balance">AI Assistant</h1>
          <p className="mt-1 text-sm text-ink-muted">Ask about clients, markets and your files in one place.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/assistant/apps"
            className="inline-flex h-10 items-center rounded-lg border border-line bg-white px-4 text-sm font-semibold hover:border-primary-300">
            Connected apps
          </Link>
          <Button variant="secondary" onClick={chat.restart} disabled={chat.pending}>
            <Plus aria-hidden="true" />
            New conversation
          </Button>
        </div>
      </header>

      <ContextBar clientId={clientId} clientName={clientName} onChoose={chooseClient} sources={sources} onToggle={toggle} />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-5">
          {chat.off && (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Client and portfolio questions aren&rsquo;t switched on for this server yet. They need the firm&rsquo;s Gemini API key.
            </p>
          )}
          {started ? (
            <Conversation chat={chat} clientName={clientName} portfolioDesk={portfolioDesk} clientChosen={Boolean(clientId)} />
          ) : (
            <Welcome chat={chat} portfolioDesk={portfolioDesk} clientName={clientName} />
          )}
        </div>

        <aside aria-label="About this conversation" className="space-y-5">
          {clientId ? (
            <ClientCard clientId={clientId} detail={client.data} onClear={() => chooseClient(null)} />
          ) : (
            <YourClients onChoose={chooseClient} />
          )}
          {started && <HowSourcesArePicked />}
          <Recent entries={chat.entries} onAsk={chat.send} busy={chat.pending} />
          <YourAccess role={user.activeRole} />
        </aside>
      </div>
    </div>
  );
}

/** Both assistants' conversations, as one: the firm's kept on the server, the market's in this browser. */
function useConversation(clientId: string | null, sources: Record<Source, boolean>) {
  const user = useStaffUser();
  const status = useGetAssistantStatus();
  const [conversationId, setConversationId] = useState(() => conversationFor(user.id));
  const [entries, setEntries] = useState<Entry[]>([]);
  const kept = useGetAssistantConversation(conversationId, { query: { staleTime: 0, refetchOnMount: "always" } });
  const [restored, setRestored] = useState<string | null>(null);

  useEffect(() => {
    if (restored === conversationId || !kept.data || kept.isFetching) return;
    setRestored(conversationId);
    const firm: Entry[] = kept.data.turns.flatMap((turn) => [
      { kind: "question", text: turn.question, at: turn.answeredAt, source: "firm" },
      { kind: "firm", reply: turn.reply, at: turn.answeredAt },
    ] satisfies Entry[]);
    const market: Entry[] = marketChatFor<MarketKept>(user.id).map((one): Entry =>
      one.who === "me" ? { kind: "question", text: one.text, at: one.at, source: "market" }
        : one.who === "assistant" ? { kind: "market", reply: one.reply, at: one.at }
          : { kind: "problem", text: one.text, at: one.at });
    // Interleaved by time, ahead of anything asked while it was loading.
    const earlier = [...firm, ...market].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
    setEntries((now) => [...earlier, ...now]);
  }, [kept.data, kept.isFetching, conversationId, restored, user.id]);

  // The market's half kept as it always was, so the Market Assistant's follow-ups still see its earlier turns.
  useEffect(() => {
    if (restored !== conversationId) return;
    const market: MarketKept[] = [];
    entries.forEach((one, index) => {
      if (one.kind === "question" && one.source === "market") market.push({ who: "me", text: one.text, at: one.at });
      if (one.kind === "market") market.push({ who: "assistant", reply: one.reply, at: one.at });
      const before = entries[index - 1];
      if (one.kind === "problem" && before?.kind === "question" && before.source === "market") {
        market.push({ who: "problem", text: one.text, at: one.at });
      }
    });
    keepMarketChat(user.id, market);
  }, [entries, conversationId, restored, user.id]);

  const now = () => new Date().toISOString();
  const failed = (error: ApiError) => setEntries((all) => [...all, { kind: "problem", text: error.message, at: now() }]);
  const askFirm = useAskAssistant<ApiError>({
    mutation: {
      onSuccess: (reply) => {
        setEntries((all) => [...all, { kind: "firm", reply, at: now() }]);
        void status.refetch();
      },
      onError: (error) => {
        failed(error);
        void status.refetch();
      },
    },
  });
  const askMarket = useAskMarketAssistant<ApiError>({
    mutation: {
      onSuccess: (reply) => setEntries((all) => [...all, { kind: "market", reply, at: now() }]),
      onError: failed,
    },
  });

  const { preferences, change } = usePreferences();
  const models = status.data?.models ?? [];
  const model = models.some((one) => one.id === preferences.assistantModel)
    ? preferences.assistantModel! : status.data?.defaultModel ?? null;
  const off = Boolean(status.data && !status.data.available);
  const pending = askFirm.isPending || askMarket.isPending;

  const send = (question: string) => {
    const text = question.trim();
    if (!text || pending) return;
    let source = pick(text, sources, Boolean(clientId));
    if (source === "firm" && off && sources.market) source = "market";
    setEntries((all) => [...all, { kind: "question", text, at: now(), source }]);
    if (source === "firm") {
      askFirm.mutate({ data: { conversationId, customerId: clientId, question: text, model } });
      return;
    }
    const earlier: { question: string; answer: string }[] = [];
    entries.forEach((one, index) => {
      const before = entries[index - 1];
      if (one.kind === "market" && before?.kind === "question") {
        earlier.push({
          question: before.text.slice(0, 2000),
          answer: [one.reply.summary, ...one.reply.points.map((point) => `- ${point}`)].join("\n").slice(0, 8000),
        });
      }
    });
    askMarket.mutate({ data: { question: text, earlier: earlier.slice(-6), model: null } });
  };

  const restart = () => {
    const fresh = startNewConversation(user.id);
    keepMarketChat(user.id, []);
    setRestored(fresh);
    setEntries([]);
    setConversationId(fresh);
  };

  return {
    entries,
    pending,
    off,
    ready: restored === conversationId && Boolean(status.data),
    send,
    restart,
    models,
    model,
    pickModel: (to: string) => change("assistantModel", to),
  };
}

type Chat = ReturnType<typeof useConversation>;

/** Client and sources: what the next question is about, and where its answer may come from. */
function ContextBar({ clientId, clientName, onChoose, sources, onToggle }: {
  clientId: string | null;
  clientName: string | null;
  onChoose: (id: string | null) => void;
  sources: Record<Source, boolean>;
  onToggle: (source: Source) => void;
}) {
  return (
    <section aria-label="Client and sources" className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-2xl border border-line bg-white px-5 py-3.5">
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <span className="text-xs font-semibold tracking-[0.12em] text-ink-muted uppercase">Client</span>
        {clientId ? (
          <span className="inline-flex items-center gap-1 rounded-lg bg-brand-900 py-1 pr-1 pl-3 text-sm font-semibold text-on-fill">
            {clientName ?? "Chosen client"}
            <button type="button" onClick={() => onChoose(null)} className="grid size-6 place-items-center rounded-md hover:bg-on-fill/15"
              aria-label="Stop focusing on this client">
              <X className="size-3.5" aria-hidden="true" />
            </button>
          </span>
        ) : (
          <ClientPicker onChoose={onChoose} />
        )}
        <span className="text-xs text-ink-muted">
          {clientId ? "Questions are about this client" : "Optional · leave empty for general or multi-client questions"}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-xs font-semibold tracking-[0.12em] text-ink-muted uppercase">Sources</span>
        {(["firm", "market"] as Source[]).map((source) => (
          <button
            key={source}
            type="button"
            aria-pressed={sources[source]}
            onClick={() => onToggle(source)}
            title={sources[source] ? "On: click to leave it out" : "Off: click to use it"}
            className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${sources[source]
              ? SOURCE_TONE[source] : "border-line bg-white text-ink-muted line-through decoration-ink-muted/50"}`}
          >
            {SOURCE_LABEL[source]}
          </button>
        ))}
        <Link
          to="/assistant/apps"
          title="Outlook, OneDrive and SharePoint are not connected yet"
          className="rounded-lg border border-dashed border-rose-400/40 px-3 py-1.5 text-sm font-medium text-rose-400 hover:border-rose-400"
        >
          Files & apps · not connected yet
        </Link>
        <span className="text-xs text-ink-muted">
          {sources.firm && sources.market ? "All on · picked per question" : "Only the source that is on is used"}
        </span>
      </div>
    </section>
  );
}

/** The clients this reader may open: their own for a relationship manager, every client for the desks that read them all. */
function useClientList(query: string, size: number, enabled = true) {
  const user = useStaffUser();
  const mine = user.activeRole === "ADVISOR";
  const params = { query: query || undefined, page: 0, size };
  const own = useListMyClients<CustomerPage, ApiError>(params,
    { query: { enabled: enabled && mine, placeholderData: keepPreviousData, retry: false } });
  const every = useListCustomers<CustomerPage, ApiError>(params,
    { query: { enabled: enabled && !mine, placeholderData: keepPreviousData, retry: false } });
  return mine ? own : every;
}

function ClientPicker({ onChoose }: { onChoose: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [query, setQuery] = useState("");
  useEffect(() => {
    const wait = setTimeout(() => setQuery(typed.trim()), 250);
    return () => clearTimeout(wait);
  }, [typed]);
  const list = useClientList(query, 8, open);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (event: MouseEvent) => {
      if (box.current && !box.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, [open]);

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((was) => !was)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-ink-muted/50 px-3 py-1.5 text-sm font-medium hover:border-primary-400"
      >
        <Plus className="size-3.5" aria-hidden="true" />
        Select a client
        <ChevronDown className="size-3.5 text-ink-muted" aria-hidden="true" />
      </button>
      {open && (
        <div className="absolute top-full left-0 z-30 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-line bg-white p-2 shadow-lg">
          <label htmlFor="assistant-client-search" className="sr-only">Search clients</label>
          <div className="flex items-center gap-2 rounded-lg border border-line px-2.5">
            <Search className="size-4 text-ink-muted" aria-hidden="true" />
            <input
              id="assistant-client-search"
              autoFocus
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              placeholder="Name, code or email"
              className="h-9 min-w-0 flex-1 border-0 bg-transparent text-sm focus:ring-0 focus:outline-none"
            />
          </div>
          <ul className="mt-1 max-h-72 overflow-y-auto">
            {list.isError && <li className="px-2.5 py-2 text-sm text-ink-muted">Your role has no client list to choose from.</li>}
            {list.data?.items.length === 0 && <li className="px-2.5 py-2 text-sm text-ink-muted">No client matches.</li>}
            {list.data?.items.map((one) => (
              <li key={one.id}>
                <button
                  type="button"
                  onClick={() => {
                    onChoose(one.id);
                    setOpen(false);
                  }}
                  className="flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-sidebar"
                >
                  <span className="min-w-0 truncate font-medium">{one.fullName}</span>
                  <span className="shrink-0 text-xs text-ink-muted">{one.code}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** The opening view: a greeting, the box to ask in, and questions to start from. */
function Welcome({ chat, portfolioDesk, clientName }: { chat: Chat; portfolioDesk: boolean; clientName: string | null }) {
  const tries = portfolioDesk ? TRY_ON_THE_BOOK : TRY_FOR_ANY_DESK;
  return (
    <>
      <section className="rounded-2xl border border-line bg-white px-6 py-7 sm:px-8">
        <h2 className="max-w-[24ch] text-[1.75rem] leading-tight font-bold text-balance">
          {greeting()}. What would you like to look into{clientName ? ` for ${clientName}` : ""}?
        </h2>
        <p className="mt-6 mb-2 text-xs font-semibold tracking-[0.12em] text-ink-muted uppercase">Ask the assistant</p>
        <Composer
          chat={chat}
          rows={3}
          placeholder={clientName
            ? `e.g. Is ${clientName}'s portfolio within its drift limit, and what KYC papers are outstanding?`
            : "e.g. Which of my clients are breaching their drift limits?"}
        />
        <p className="mt-3 text-xs text-ink-muted">
          The assistant reads each question and picks the source it needs. Switch a source off above to leave it out.
        </p>
      </section>

      <section aria-labelledby="try-asking" className="space-y-3">
        <h2 id="try-asking" className="text-lg font-bold">Try asking</h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {tries.map((one) => (
            <li key={one.question}>
              <button
                type="button"
                disabled={chat.pending}
                onClick={() => chat.send(one.question)}
                className="flex h-full w-full flex-col items-start gap-3 rounded-xl border border-line bg-white px-4 py-4 text-left text-sm
                  hover:border-primary-300 hover:shadow-sm disabled:opacity-50"
              >
                <span className="font-medium">{one.question}</span>
                <span className="mt-auto flex flex-wrap gap-1.5">
                  {one.sources.map((source) => <SourceTag key={source} source={source} />)}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <p className="text-xs text-ink-muted">Tags show the source the assistant would use.</p>
      </section>
    </>
  );
}

function Conversation({ chat, clientName, portfolioDesk, clientChosen }: {
  chat: Chat;
  clientName: string | null;
  portfolioDesk: boolean;
  clientChosen: boolean;
}) {
  const bottom = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "nearest" });
  }, [chat.entries.length, chat.pending]);
  const lastFirm = [...chat.entries].reverse().find((one) => one.kind === "firm");
  const quick = clientChosen ? (portfolioDesk ? ON_A_CLIENT_DESK : ON_A_CLIENT) : ON_NOBODY;
  const modelLabel = (id: string) => chat.models.find((one) => one.id === id)?.label ?? id;

  return (
    <div className="space-y-4">
      {chat.entries.map((one, index) =>
        one.kind === "question" ? (
          <div key={index} className="flex justify-end">
            <p className="max-w-[85%] rounded-xl bg-brand-900 px-4 py-3 text-sm whitespace-pre-wrap text-on-fill">{one.text}</p>
          </div>
        ) : one.kind === "firm" ? (
          <AnswerCard key={index} source="firm" at={one.at} by={modelLabel(one.reply.answeredBy)}
            title={clientName ? `${clientName} · answer` : "Answer"}>
            <p className="text-sm whitespace-pre-wrap">{one.reply.summary}</p>
            {one.reply.suggestion && <Suggestion suggestion={one.reply.suggestion} />}
            {one.reply.action && <ActionCard action={one.reply.action} />}
            {one.reply.notes.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-base font-bold">Things to look at</h3>
                <ul className="space-y-2">
                  {one.reply.notes.map((note, at) => (
                    <li key={at} className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-ink">{note}</li>
                  ))}
                </ul>
              </div>
            )}
            {lastFirm === one && one.reply.suggestion && !chat.pending && <FollowUps reply={one.reply} onAsk={chat.send} />}
          </AnswerCard>
        ) : one.kind === "market" ? (
          <AnswerCard key={index} source="market" at={one.at} by={one.reply.answeredBy} title="Markets">
            <p className="text-sm whitespace-pre-wrap">{one.reply.summary}</p>
            {one.reply.points.length > 0 && (
              <ul className="list-disc space-y-1 pl-5 text-sm">
                {one.reply.points.map((point, at) => <li key={at}>{point}</li>)}
              </ul>
            )}
            {one.reply.quotes.length > 0 && <Quotes quotes={one.reply.quotes} />}
            {one.reply.sources.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs font-semibold tracking-wider text-ink-muted uppercase">Read from</p>
                <ol className="space-y-1 text-sm">
                  {one.reply.sources.map((source, at) => (
                    <li key={source.url} className="flex gap-2">
                      <span className="text-ink-muted tabular-nums">{at + 1}.</span>
                      <a href={source.url} target="_blank" rel="noopener noreferrer" className="min-w-0 text-primary-700 hover:underline">
                        {source.title}
                        <ExternalLink className="ml-1 inline size-3" aria-hidden="true" />
                        {source.outlet && <span className="block text-xs text-ink-muted">{source.outlet}</span>}
                      </a>
                    </li>
                  ))}
                </ol>
              </div>
            )}
            <p className="flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-ink-muted">
              <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              Only the question went to the market news and price providers. No client names, holdings or files left the platform.
            </p>
          </AnswerCard>
        ) : (
          <p key={index} className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{one.text}</p>
        ),
      )}
      {chat.pending && (
        <p className="flex items-center gap-2 text-sm text-ink-muted">
          <Sparkles className="size-4 animate-pulse text-primary-600" aria-hidden="true" />
          Looking it up…
        </p>
      )}
      <div ref={bottom} />

      <section aria-label="Ask a follow-up" className="rounded-2xl border border-line bg-white p-4">
        <Composer
          chat={chat}
          rows={2}
          placeholder={clientName ? `Ask anything about ${clientName} or the markets…` : "Ask anything about your clients or the markets…"}
          quick={quick}
        />
      </section>
    </div>
  );
}

function AnswerCard({ source, title, at, by, children }: {
  source: Source;
  title: string;
  at: string;
  by: string;
  children: ReactNode;
}) {
  const Icon = source === "market" ? Globe : Layers;
  return (
    <article className="space-y-4 rounded-2xl border border-line bg-white px-5 py-5 sm:px-6">
      <header className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <h2 className="flex items-center gap-3 text-lg font-bold">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary-50 text-primary-600">
              <Icon className="size-4" aria-hidden="true" />
            </span>
            {title}
          </h2>
          <span className="shrink-0 pt-2 text-xs text-ink-muted">
            {by} · {new Date(at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
          </span>
        </div>
        <p className="flex flex-wrap items-center gap-1.5 text-xs text-ink-muted">
          Sources used: <SourceTag source={source} />
          <span className="rounded border border-dashed border-line px-1.5 py-0.5 text-[11px]">
            {source === "firm" ? "Market data not needed" : "Client data not used"}
          </span>
        </p>
      </header>
      {children}
    </article>
  );
}

function Composer({ chat, rows, placeholder, quick }: { chat: Chat; rows: number; placeholder: string; quick?: string[] }) {
  const [draft, setDraft] = useState("");
  const [tried, setTried] = useState(false);
  const missing = tried && !draft.trim();
  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    if (!draft.trim()) {
      setTried(true);
      return;
    }
    setTried(false);
    chat.send(draft);
    setDraft("");
  };
  return (
    <form onSubmit={submit} className="space-y-3">
      <div className={`rounded-xl border bg-white focus-within:ring-2 ${missing
        ? "border-red-500 focus-within:ring-red-200" : "border-line focus-within:border-primary-400 focus-within:ring-primary-100"}`}>
        <label htmlFor={`assistant-question-${rows}`} className="sr-only">Ask the assistant</label>
        <textarea
          id={`assistant-question-${rows}`}
          rows={rows}
          value={draft}
          aria-invalid={missing || undefined}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) submit(event);
          }}
          placeholder={placeholder}
          className="block w-full resize-none border-0 bg-transparent px-4 pt-3 text-sm focus:ring-0 focus:outline-none"
        />
        <div className="flex flex-wrap items-center justify-end gap-2 px-3 pb-3">
          {chat.models.length > 0 && chat.model && (
            <div className="mr-auto flex min-w-48 items-center gap-2">
              <span className="shrink-0 text-xs text-ink-muted">Answer with</span>
              <ModelPicker models={chat.models} value={chat.model} onChange={chat.pickModel} />
            </div>
          )}
          <Button type="submit" disabled={chat.pending}>{chat.pending ? "Asking…" : "Ask"}</Button>
        </div>
      </div>
      {missing && <p className="text-xs text-red-600">Type a question first.</p>}
      {quick && (
        <div className="flex flex-wrap gap-2">
          {quick.map((question) => (
            <button key={question} type="button" disabled={chat.pending} onClick={() => chat.send(question)}
              className="rounded-lg border border-line px-3 py-1.5 text-sm hover:border-primary-300 hover:bg-primary-50 disabled:opacity-50">
              {question}
            </button>
          ))}
        </div>
      )}
    </form>
  );
}

function Panel({ title, children, dark = false }: { title: ReactNode; children: ReactNode; dark?: boolean }) {
  return (
    <section className={`rounded-2xl border px-5 py-5 ${dark ? "border-brand-900 bg-brand-900 text-on-fill" : "border-line bg-white"}`}>
      <h2 className="mb-3 text-lg font-bold">{title}</h2>
      {children}
    </section>
  );
}

function YourClients({ onChoose }: { onChoose: (id: string) => void }) {
  const user = useStaffUser();
  const list = useClientList("", 4);
  if (list.isError) return null;
  return (
    <Panel title="Your clients">
      <p className="mb-3 text-sm text-ink-muted">Pick a client to focus the conversation on them.</p>
      {list.data?.items.length === 0 && <p className="text-sm text-ink-muted">No clients yet.</p>}
      <div className="grid grid-cols-2 gap-2">
        {list.data?.items.map((one) => (
          <button key={one.id} type="button" onClick={() => onChoose(one.id)} title={one.fullName}
            className="truncate rounded-lg border border-line px-3 py-2 text-left text-sm font-medium hover:border-primary-300 hover:bg-primary-50">
            {one.fullName}
          </button>
        ))}
      </div>
      <Link to={clientListHref(user)} className="mt-3 inline-block text-sm font-medium text-primary-700 underline-offset-2 hover:underline">
        Search all clients
      </Link>
    </Panel>
  );
}

function ClientCard({ clientId, detail, onClear }: { clientId: string; detail: CustomerDetail | undefined; onClear: () => void }) {
  const user = useStaffUser();
  const managers = detail?.advisors.map((one) => one.advisor.id === user.id ? "you" : one.advisor.fullName) ?? [];
  return (
    <Panel title="Client">
      <p className="text-base font-semibold">{detail?.client.fullName ?? "…"}</p>
      {detail && (
        <div className="mt-2 space-y-1 text-sm text-ink-muted">
          <p>{detail.client.code} · {detail.client.type === "ENTITY" ? "Entity" : "Individual"}</p>
          <p>Relationship manager: {managers.length ? managers.join(", ") : "none yet"}</p>
        </div>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <Link to={clientFileHref(user, clientId)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm font-medium hover:border-primary-300">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to the client
        </Link>
        <button type="button" onClick={onClear} className="rounded-lg px-3 py-2 text-sm text-ink-muted hover:text-ink">
          Clear
        </button>
      </div>
    </Panel>
  );
}

function HowSourcesArePicked() {
  return (
    <Panel title="How sources are picked">
      <p className="mb-3 text-sm text-ink-muted">No need to choose a mode. The assistant reads each question and uses the source it needs:</p>
      <dl className="space-y-2.5 text-sm">
        <div className="space-y-1">
          <dt><SourceTag source="firm" /></dt>
          <dd className="text-ink-muted">clients, portfolios, drift, KYC, onboarding, your tickets</dd>
        </div>
        <div className="space-y-1">
          <dt><SourceTag source="market" /></dt>
          <dd className="text-ink-muted">prices, market news, today&rsquo;s movers</dd>
        </div>
        <div className="space-y-1">
          <dt><SourceTag source="files" /></dt>
          <dd className="text-ink-muted">emails, notes, documents: not connected yet</dd>
        </div>
      </dl>
      <p className="mt-3 border-t border-line pt-3 text-xs text-ink-muted">Switch a source off above to keep it out of every answer.</p>
      <Link to="/assistant/apps" className="mt-2 inline-block text-sm font-medium text-primary-700 underline-offset-2 hover:underline">
        Manage connected apps
      </Link>
    </Panel>
  );
}

/** The last questions in this conversation, newest first, to ask again. */
function Recent({ entries, onAsk, busy }: { entries: Entry[]; onAsk: (question: string) => void; busy: boolean }) {
  const recent = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const one of [...entries].reverse()) {
      if (one.kind !== "question" || seen.has(one.text)) continue;
      seen.add(one.text);
      out.push(one.text);
      if (out.length === 4) break;
    }
    return out;
  }, [entries]);
  if (recent.length === 0) return null;
  return (
    <Panel title="Recent">
      <ul className="divide-y divide-line">
        {recent.map((text) => (
          <li key={text}>
            <button type="button" disabled={busy} onClick={() => onAsk(text)} title="Ask again"
              className="flex w-full items-start gap-2.5 py-2.5 text-left text-sm hover:text-primary-700 disabled:opacity-50">
              <Clock className="mt-0.5 size-4 shrink-0 text-ink-muted" aria-hidden="true" />
              <span className="line-clamp-2">{text}</span>
            </button>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

const ACCESS: Record<string, string> = {
  ADVISOR: "You only see the clients assigned to you, and only what your screens already show.",
  PORTFOLIO_MANAGER: "You see the portfolios you manage, and only what your screens already show.",
  COMPLIANCE: "You see clients' files as your screens do, and nothing more.",
  OPERATIONS: "You see the clients and cases your screens show, and nothing more.",
};

function YourAccess({ role }: { role: string | null | undefined }) {
  const [more, setMore] = useState(false);
  const label = role ? roleLabels[role as keyof typeof roleLabels] ?? role : "Staff";
  return (
    <Panel dark title={<span className="flex items-start gap-2"><Lock className="mt-1.5 size-4 shrink-0" aria-hidden="true" />Your access: {label}</span>}>
      <p className="text-sm text-on-fill/80">
        {(role && ACCESS[role]) ?? "You see what your screens already show, and nothing more."} Client names are replaced with
        aliases before anything is sent to the AI.
      </p>
      <button type="button" onClick={() => setMore((was) => !was)} className="mt-3 text-sm font-medium text-on-fill underline underline-offset-2">
        {more ? "Less" : "How we protect data"}
      </button>
      {more && (
        <p className="mt-2 text-xs text-on-fill/70">
          Every client name and code in a question is swapped for an alias such as &ldquo;Client K7QM&rdquo; before it leaves
          Atom Privé, and names are put back only on your screen. Each answer is looked up with your own permissions.
          Market questions go to public news and price providers and never carry client data. Nothing is traded or sent
          without your approval, and every question and answer is kept in the audit log.
        </p>
      )}
    </Panel>
  );
}
