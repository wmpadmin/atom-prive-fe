import { ApiError } from "@atomprive/api-client";
import {
  useAskAssistant,
  useCreateProposal,
  useGetAssistantConversation,
  useGetAssistantStatus,
  type AssistantModel,
  type AssistantReply,
  type RebalanceSuggestion,
  type SuggestionRow,
} from "@atomprive/api-client/backoffice";
import {
  ArrowLeftRight,
  ChartColumn,
  ChartPie,
  FileText,
  Info,
  Lock,
  RefreshCw,
  SendHorizontal,
  Sparkles,
  TrendingUp,
  User,
  X,
  type LucideIcon,
} from "lucide-react";
import { SelectInput } from "@atomprive/ui";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useLocation, useNavigate } from "react-router";
import {
  ASSISTANT_DEFAULT,
  ASSISTANT_NARROWEST,
  ASSISTANT_WIDEST,
  usePreferences,
} from "../lib/preferences";
import { conversationFor } from "../lib/assistant-conversation";
import { PanelEdge } from "./panel-edge";
import { useStaffUser } from "../auth/session";


/**
 * A client's own page, wherever in the back office it is opened — their profile under /clients or their
 * portfolio under /portfolio-clients: the assistant then knows who is meant.
 */
const CLIENT_PAGE = /\/(?:portfolio-)?clients\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;

type Said =
  | { who: "me"; text: string; at: Date }
  | { who: "assistant"; reply: AssistantReply; at: Date }
  | { who: "problem"; text: string; at: Date };

const ON_A_CLIENT: { icon: LucideIcon; question: string }[] = [
  { icon: TrendingUp, question: "Is this portfolio within the drift limit?" },
  { icon: ArrowLeftRight, question: "How much to buy or sell to rebalance?" },
  { icon: ChartPie, question: "What is the current asset allocation?" },
  { icon: ChartColumn, question: "Show drift across asset classes." },
];

const ON_THE_BOOK: { icon: LucideIcon; question: string }[] = [
  { icon: TrendingUp, question: "Which of my clients are breaching?" },
  { icon: ArrowLeftRight, question: "Who needs rebalancing first?" },
  { icon: ChartPie, question: "Which client has drifted the most?" },
  { icon: ChartColumn, question: "Summarise the breaches across my book." },
];

/** The ✦ in the top bar that opens the assistant. */
export function AssistantButton({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={open}
      title="Portfolio Assistant"
      className="rounded-lg p-2 text-violet-600 hover:bg-violet-500/10 focus-visible:ring-2 focus-visible:ring-violet-300
        focus-visible:outline-none"
    >
      <Sparkles className="size-5" aria-hidden="true" />
      <span className="sr-only">Portfolio Assistant</span>
    </button>
  );
}

/**
 * The Portfolio Assistant: questions about drift, breaches and rebalancing, answered from the platform's own
 * figures. Kept mounted while closed so a conversation survives moving between screens.
 */
export function AssistantPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { pathname } = useLocation();
  const customerId = CLIENT_PAGE.exec(pathname)?.[1] ?? null;
  const status = useGetAssistantStatus({ query: { enabled: open } });
  const user = useStaffUser();
  const [conversationId] = useState(() => conversationFor(user.id));
  const [said, setSaid] = useState<Said[]>([]);
  // The chat so far, read back once from the server the first time the panel opens in this tab — so a
  // refresh or a new tab picks it up where it was left, until sign-out starts a new one.
  const kept = useGetAssistantConversation(conversationId, { query: { enabled: open, staleTime: Infinity } });
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current || !kept.data) return;
    restored.current = true;
    const earlier: Said[] = kept.data.turns.flatMap((turn) => {
      const at = new Date(turn.answeredAt);
      return [
        { who: "me", text: turn.question, at },
        { who: "assistant", reply: turn.reply, at },
      ] satisfies Said[];
    });
    // Ahead of anything asked while it was loading, which came after it.
    setSaid((now) => [...earlier, ...now]);
  }, [kept.data]);
  const [draft, setDraft] = useState("");
  const bottom = useRef<HTMLDivElement>(null);
  const ask = useAskAssistant<ApiError>({
    mutation: {
      // Read the models again after each answer: one may have just used its allowance, and the picker says so.
      onSuccess: (reply) => {
        setSaid((all) => [...all, { who: "assistant", reply, at: new Date() }]);
        void status.refetch();
      },
      onError: (error) => {
        setSaid((all) => [...all, { who: "problem", text: error.message, at: new Date() }]);
        void status.refetch();
      },
    },
  });

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [said, ask.isPending]);

  const send = (question: string) => {
    const text = question.trim();
    if (!text || ask.isPending) return;
    setSaid((all) => [...all, { who: "me", text, at: new Date() }]);
    setDraft("");
    ask.mutate({ data: { conversationId, customerId, question: text, model } });
  };
  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    send(draft);
  };
  const { preferences, change } = usePreferences();
  // Live while a drag is in flight; what is on file otherwise, as with the sidebar.
  const [dragged, setDragged] = useState<number | null>(null);
  const width = dragged ?? preferences.assistantWidth;
  const held = useCallback(
    (to: number) => Math.min(Math.max(Math.round(to), ASSISTANT_NARROWEST), ASSISTANT_WIDEST),
    [],
  );
  const onDrag = useCallback((to: number) => setDragged(held(to)), [held]);
  const onSettled = useCallback(
    (to: number) => {
      change("assistantWidth", held(to));
      setDragged(null);
    },
    [change, held],
  );
  const models = status.data?.models ?? [];
  // What the reader picked last time, if the firm still offers it; otherwise the firm's default.
  const model = models.some((one) => one.id === preferences.assistantModel)
    ? preferences.assistantModel! : status.data?.defaultModel ?? null;
  const lastReply = [...said].reverse().find((one) => one.who === "assistant");
  const off = status.data && !status.data.available;
  const suggested = customerId ? ON_A_CLIENT : ON_THE_BOOK;

  return (
    <aside
      aria-label="Portfolio Assistant"
      hidden={!open}
      style={{ width }}
      className="fixed top-0 right-0 bottom-0 z-40 flex max-w-full flex-col border-l border-line bg-white shadow-2xl"
    >
      <PanelEdge
        label="How wide the assistant is"
        width={width}
        narrowest={ASSISTANT_NARROWEST}
        widest={ASSISTANT_WIDEST}
        opensAt={ASSISTANT_DEFAULT}
        onDrag={onDrag}
        onSettled={onSettled}
      />
      <header className="flex items-start gap-4 border-b border-line px-6 py-5">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-violet-500/10 text-violet-600">
          <Sparkles className="size-6" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="flex items-center gap-2 text-xl font-bold">
            Portfolio Assistant
            <span className="rounded-md bg-violet-500/15 px-2 py-0.5 text-xs font-semibold text-violet-700">AI</span>
          </h2>
          <p className="text-sm text-ink-muted">Get portfolio insights, drift analysis and rebalancing guidance.</p>
        </div>
        <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-ink-muted hover:bg-slate-100 hover:text-ink">
          <X className="size-5" aria-hidden="true" />
          <span className="sr-only">Close the assistant</span>
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        <div className="space-y-5">
          {off && (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              The assistant isn&rsquo;t switched on for this server yet. It needs the firm&rsquo;s Gemini API key.
            </p>
          )}
          {said.map((one, index) =>
            one.who === "me" ? (
              <Mine key={index} text={one.text} at={one.at} />
            ) : one.who === "assistant" ? (
              <Answer key={index} reply={one.reply} at={one.at} models={models} />
            ) : (
              <p key={index} className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{one.text}</p>
            ),
          )}
          {ask.isPending && (
            <div className="flex items-center gap-3 text-sm text-ink-muted">
              <AssistantMark />
              Looking at the figures…
            </div>
          )}
          {/* Only after an answer with trades in it: the three actions are all about those trades. */}
          {lastReply?.who === "assistant" && lastReply.reply.suggestion && !ask.isPending && (
            <FollowUps reply={lastReply.reply} onAsk={send} />
          )}
          {!off && (
            <section>
              <h3 className="mb-3 flex items-center gap-2 text-base font-bold">
                <Sparkles className="size-4 text-violet-600" aria-hidden="true" />
                Suggested questions
              </h3>
              <div className="flex flex-wrap gap-2.5">
                {suggested.map(({ icon: Icon, question }) => (
                  <button
                    key={question}
                    type="button"
                    disabled={ask.isPending}
                    onClick={() => send(question)}
                    className="flex items-center gap-2.5 rounded-full border border-line px-4 py-2 text-sm hover:border-violet-300
                      hover:bg-violet-500/10 disabled:opacity-50"
                  >
                    <Icon className="size-4 text-primary-600" aria-hidden="true" />
                    {question}
                  </button>
                ))}
              </div>
            </section>
          )}
          <div ref={bottom} />
        </div>
      </div>

      <div className="space-y-3 px-6 pt-3 pb-5">
        <form
          onSubmit={onSubmit}
          className="rounded-2xl border border-line bg-white focus-within:border-violet-400
            focus-within:ring-2 focus-within:ring-violet-200"
        >
          {/* At the top of the box, so its list has room to open downwards over the box rather than up. */}
          {models.length > 0 && model && (
            <div className="flex items-center gap-2 border-b border-line px-3 py-2">
              <span className="shrink-0 text-xs text-ink-muted">Answer with</span>
              <ModelPicker models={models} value={model} onChange={(to) => change("assistantModel", to)} />
            </div>
          )}
          <div className="flex items-end gap-2 p-3">
            <label htmlFor="assistant-question" className="sr-only">Ask the assistant</label>
            <textarea
              id="assistant-question"
              rows={2}
              value={draft}
              disabled={off}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  send(draft);
                }
              }}
              placeholder={customerId ? "Ask about this client's portfolio, drift, allocation or rebalancing…"
                : "Ask a question about portfolio, drift, allocation or rebalancing…"}
              className="block min-w-0 flex-1 resize-none border-0 bg-transparent px-1 py-1 text-sm focus:ring-0
                focus:outline-none"
            />
            <button
              type="submit"
              disabled={!draft.trim() || ask.isPending || off}
              className="grid size-10 shrink-0 place-items-center rounded-xl bg-violet-600 text-white hover:bg-violet-700
                disabled:opacity-40"
            >
              <SendHorizontal className="size-5" aria-hidden="true" />
              <span className="sr-only">Send</span>
            </button>
          </div>
        </form>
        <Privacy />
      </div>
    </aside>
  );
}

function Mine({ text, at }: { text: string; at: Date }) {
  return (
    <div>
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary-50 text-primary-600">
          <User className="size-5" aria-hidden="true" />
        </span>
        <p className="flex-1 rounded-xl bg-primary-50 px-4 py-3 text-sm whitespace-pre-wrap">{text}</p>
      </div>
      <Time at={at} />
    </div>
  );
}

function AssistantMark() {
  return (
    <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-violet-500/10 text-violet-600">
      <Sparkles className="size-5" aria-hidden="true" />
    </span>
  );
}

/**
 * Which model answers. The firm's own SelectInput, so the list opens below the box as everywhere else in the
 * back office, rather than the Mac's native list drawn over it. A model that has used its free allowance says
 * until when, and can still be picked — the next model answers meanwhile.
 */
function ModelPicker({ models, value, onChange }: {
  models: AssistantModel[];
  value: string;
  onChange: (to: string) => void;
}) {
  return (
    <div className="min-w-0 flex-1">
      <label htmlFor="assistant-model" className="sr-only">Model that answers</label>
      <SelectInput
        id="assistant-model"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 w-full bg-slate-50 py-1.5 text-xs font-medium"
      >
        {models.map((one) => (
          <option key={one.id} value={one.id}>
            {one.label} · {one.freeAgainAt ? `out until ${clock(one.freeAgainAt)}` : one.note}
          </option>
        ))}
      </SelectInput>
    </div>
  );
}

function clock(at: string) {
  return new Date(at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function Answer({ reply, at, models }: { reply: AssistantReply; at: Date; models: AssistantModel[] }) {
  const label = (id: string) => models.find((one) => one.id === id)?.label ?? id;
  return (
    <div>
      <div className="flex items-start gap-3">
        <AssistantMark />
        <div className="min-w-0 flex-1 space-y-4 rounded-xl border border-line px-4 py-4">
          <p className="text-sm whitespace-pre-wrap">{reply.summary}</p>
          {reply.suggestion && <Suggestion suggestion={reply.suggestion} />}
          {reply.notes.length > 0 && (
            <div className="rounded-xl bg-slate-50 px-4 py-3">
              <p className="mb-1.5 flex items-center gap-2 text-sm font-semibold">
                <Info className="size-4 text-primary-600" aria-hidden="true" />
                Notes
              </p>
              <ul className="list-disc space-y-1 pl-9 text-sm">
                {reply.notes.map((note, index) => <li key={index}>{note}</li>)}
              </ul>
            </div>
          )}
        </div>
      </div>
      <Time
        at={at}
        by={reply.picked
          ? `${label(reply.answeredBy)} answered: ${label(reply.picked)} is out of free answers for now`
          : label(reply.answeredBy)}
      />
    </div>
  );
}

function Suggestion({ suggestion }: { suggestion: RebalanceSuggestion }) {
  const money = new Intl.NumberFormat("en-US", { style: "currency", currency: suggestion.currency, maximumFractionDigits: 0 });
  return (
    // A container, so the table can give way to stacked rows when the panel is dragged narrow: five columns
    // in the width left over would run each figure into the next.
    <div className="@container overflow-hidden rounded-xl border border-line">
      <p className="bg-primary-50 px-4 py-2.5 text-sm font-bold text-primary-800">
        Rebalancing Suggestion
        <span className="ml-2 text-xs font-medium text-ink-muted">
          {suggestion.approach === "INSIDE_BAND" ? "Back inside the band" : "Back to target"}
        </span>
      </p>
      <ul className="divide-y divide-line text-sm tabular-nums @[480px]:hidden">
        {suggestion.rows.map((row) => (
          <li key={row.assetClass} className="space-y-1.5 px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <span className="min-w-0 font-medium break-words">{row.name}</span>
              <Action row={row} money={money} className="shrink-0 text-right" />
            </div>
            <dl className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-muted">
              <div className="flex gap-1"><dt>Target</dt><dd className="text-ink">{percent(row.target)}</dd></div>
              <div className="flex gap-1"><dt>Current</dt><dd className="text-ink">{percent(row.current)}</dd></div>
              <div className="flex items-center gap-1"><dt>Drift</dt><dd><DriftPill row={row} /></dd></div>
            </dl>
          </li>
        ))}
      </ul>
      <table className="hidden w-full table-fixed text-sm tabular-nums @[480px]:table">
        <thead>
          <tr className="border-b border-line text-left text-xs text-ink-muted">
            <th scope="col" className="w-[34%] px-4 py-2 font-medium">Asset Class</th>
            <th scope="col" className="px-2 py-2 font-medium">Target</th>
            <th scope="col" className="px-2 py-2 font-medium">Current</th>
            <th scope="col" className="px-2 py-2 font-medium">Drift</th>
            <th scope="col" className="w-[24%] px-2 py-2 font-medium">Action</th>
          </tr>
        </thead>
        <tbody>
          {suggestion.rows.map((row) => (
            <tr key={row.assetClass} className="border-b border-line last:border-0">
              <td className="px-4 py-2.5 break-words">{row.name}</td>
              <td className="px-2 py-2.5">{percent(row.target)}</td>
              <td className="px-2 py-2.5">{percent(row.current)}</td>
              <td className="px-2 py-2.5"><DriftPill row={row} /></td>
              <td className="px-2 py-2.5"><Action row={row} money={money} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      {(!suggestion.backInsideBands || suggestion.limitsBroken.length > 0) && (
        <div className="border-t border-line bg-amber-50 px-4 py-2 text-xs text-amber-800">
          {!suggestion.backInsideBands && <p>A class would still be outside its band after these trades.</p>}
          {suggestion.limitsBroken.map((said) => <p key={said}>{said}</p>)}
        </div>
      )}
    </div>
  );
}

/** How far a class is off target: red when it is past its band, green while it is within it. */
function DriftPill({ row }: { row: SuggestionRow }) {
  return (
    <span
      title={`Allowed ±${row.band} points`}
      className={`rounded-md px-1.5 py-0.5 text-xs font-semibold whitespace-nowrap ${row.standing === "BREACHED"
        ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}
    >
      {signed(row.drift)}
    </span>
  );
}

/** What to do with a class: buy or sell, as points of the portfolio and as money, or hold. */
function Action({ row, money, className }: { row: SuggestionRow; money: Intl.NumberFormat; className?: string }) {
  if (row.move === 0) {
    return <span className={`text-ink-muted ${className ?? ""}`}>Hold</span>;
  }
  return (
    <span className={className}>
      <span className="font-bold whitespace-nowrap">{row.move < 0 ? "Sell" : "Buy"} {percent(Math.abs(row.movePoints))}</span>
      <span className="block text-xs text-ink-muted">{money.format(Math.abs(row.move))}</span>
    </span>
  );
}

/** What can be done with the last answer: the three actions under it in the picture. */
function FollowUps({ reply, onAsk }: { reply: AssistantReply; onAsk: (question: string) => void }) {
  const navigate = useNavigate();
  const [problem, setProblem] = useState<string | null>(null);
  const create = useCreateProposal<ApiError>({
    mutation: {
      onSuccess: (proposal) => void navigate(`/proposals/${proposal.summary.id}`),
      onError: (error) => setProblem(error.message),
    },
  });
  const suggestion = reply.suggestion;
  const draftProposal = () => {
    if (!suggestion) return;
    setProblem(null);
    const moved = suggestion.legs.reduce((total, leg) => total + leg.amount, 0);
    const table = suggestion.rows
      .filter((row) => row.move !== 0)
      .map((row) => `${row.move < 0 ? "Sell" : "Buy"} ${row.name}: ${percent(Math.abs(row.movePoints))} (${suggestion.currency} ${
        Math.abs(row.move).toLocaleString("en-US", { maximumFractionDigits: 0 })}), from ${percent(row.current)} to ${percent(row.after)}`);
    create.mutate({
      data: {
        customerId: suggestion.customerId,
        title: suggestion.approach === "INSIDE_BAND" ? "Rebalance back inside the band" : "Rebalance to target",
        summary: reply.summary.slice(0, 400),
        body: [reply.summary, "", ...table, ...(reply.notes.length ? ["", "Notes:", ...reply.notes.map((note) => `• ${note}`)] : [])]
          .join("\n"),
        valueAmount: moved,
        valueCurrency: suggestion.currency,
        objective: "Bring the portfolio back within its model's bands",
        lines: suggestion.legs.map((leg) => ({
          fromAssetClass: leg.fromAssetClass,
          fromSubClass: null,
          fromSubSubClass: null,
          toAssetClass: leg.toAssetClass,
          toSubClass: null,
          toSubSubClass: null,
          amount: leg.amount,
          heldWhenRaised: null,
        })),
      },
    });
  };
  const chip = "flex items-center gap-2 rounded-full border border-line px-4 py-2 text-sm hover:border-violet-300 hover:bg-violet-500/10 disabled:opacity-50";
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap justify-end gap-2.5">
        <button type="button" className={chip} onClick={() => onAsk("Show me a smaller set of trades that only brings this client back inside the band.")}>
          <RefreshCw className="size-4" aria-hidden="true" />
          Show alternate options
        </button>
        <button type="button" className={chip} onClick={() => onAsk("What would these trades do to the client's risk and return?")}>
          <ChartColumn className="size-4" aria-hidden="true" />
          Impact on risk/return
        </button>
        {suggestion && suggestion.legs.length > 0 && (
          <button type="button" className={chip} disabled={create.isPending} onClick={draftProposal}>
            <FileText className="size-4" aria-hidden="true" />
            {create.isPending ? "Creating…" : "Create draft proposal"}
          </button>
        )}
      </div>
      {problem && <p className="text-right text-sm text-red-700">{problem}</p>}
    </div>
  );
}

function Privacy() {
  const [more, setMore] = useState(false);
  return (
    <div className="rounded-xl bg-slate-50 px-4 py-3 text-xs">
      <div className="flex items-start gap-3">
        <Lock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <p className="flex-1">
          <span className="font-semibold">Data Privacy:</span> This assistant uses portfolio metrics and rules only. It
          does not access or share any client personal information.
        </p>
        <button type="button" onClick={() => setMore((was) => !was)} className="font-semibold whitespace-nowrap text-primary-700 hover:underline">
          {more ? "Less" : "Learn more"}
        </button>
      </div>
      {more && (
        <p className="mt-2 pl-7 text-ink-muted">
          Before a question leaves Atom Privé, every client name and code in it is replaced with an alias such as
          &ldquo;Client K7QM&rdquo;, and the AI only ever sees figures under that alias. Names are put back only on
          your screen. Suggestions are never traded: a draft proposal still goes to the client&rsquo;s relationship
          manager. Every question and answer is kept in the audit log.
        </p>
      )}
    </div>
  );
}

function Time({ at, by }: { at: Date; by?: string }) {
  return (
    <p className="mt-1 text-right text-xs text-ink-muted">
      {by && <span>{by} · </span>}
      {at.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
    </p>
  );
}

function percent(value: number) {
  return `${value.toFixed(1)}%`;
}

function signed(value: number) {
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}
