import { ApiError } from "@atomprive/api-client";
import { useAskMarketAssistant, type MarketQuote, type MarketReply } from "@atomprive/api-client/backoffice";
import { ExternalLink, Globe, Info, Newspaper, SendHorizontal, TrendingUp, User, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useStaffUser } from "../auth/session";
import { keepMarketChat, marketChatFor } from "../lib/assistant-conversation";

/**
 * The Market Assistant's conversation: market news and prices from the open web, never the firm's records.
 *
 * <p>Kept in this browser rather than on the server — nothing in it is the firm's — so it survives moving between
 * the two tabs, a refresh, another tab and closing the browser, and ends when its owner signs out. The last few
 * turns go along with each question so a follow-up can say "and that one?".
 */

type Said =
  | { who: "me"; text: string; at: string }
  | { who: "assistant"; reply: MarketReply; at: string }
  | { who: "problem"; text: string; at: string };

const SUGGESTED: { icon: LucideIcon; question: string }[] = [
  { icon: Newspaper, question: "What is the latest finance news?" },
  { icon: TrendingUp, question: "What are the top 2 performing shares today?" },
  { icon: Globe, question: "Summarise today's market movement." },
  { icon: Newspaper, question: "What is the outlook for the Australian market?" },
];

/** How many earlier questions and answers go along with a new one. */
const REMEMBERED = 6;

/** An answer as plain text, for sending back as context with the next question. */
function asText(reply: MarketReply) {
  return [reply.summary, ...reply.points.map((point) => `- ${point}`)].join("\n");
}

export function MarketAssistantChat() {
  const user = useStaffUser();
  const [said, setSaid] = useState<Said[]>(() => marketChatFor<Said>(user.id));
  const [draft, setDraft] = useState("");
  const bottom = useRef<HTMLDivElement>(null);
  const ask = useAskMarketAssistant<ApiError>({
    mutation: {
      onSuccess: (reply) => setSaid((all) => [...all, { who: "assistant", reply, at: new Date().toISOString() }]),
      onError: (error) => setSaid((all) => [...all, { who: "problem", text: error.message, at: new Date().toISOString() }]),
    },
  });

  useEffect(() => keepMarketChat(user.id, said), [user.id, said]);
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [said, ask.isPending]);

  const send = (question: string) => {
    const text = question.trim();
    if (!text || ask.isPending) return;
    // Each answer paired with the question before it; a question that failed has nothing to pair with.
    const earlier: { question: string; answer: string }[] = [];
    said.forEach((one, index) => {
      const before = said[index - 1];
      if (one.who === "assistant" && before?.who === "me") {
        earlier.push({ question: before.text.slice(0, 2000), answer: asText(one.reply).slice(0, 8000) });
      }
    });
    setSaid((all) => [...all, { who: "me", text, at: new Date().toISOString() }]);
    setDraft("");
    ask.mutate({ data: { question: text, earlier: earlier.slice(-REMEMBERED), model: null } });
  };
  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    send(draft);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        <div className="space-y-5">
          {said.map((one, index) =>
            one.who === "me" ? (
              <div key={index}>
                <div className="flex items-start gap-3">
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary-50 text-primary-600">
                    <User className="size-5" aria-hidden="true" />
                  </span>
                  <p className="flex-1 rounded-xl bg-primary-50 px-4 py-3 text-sm whitespace-pre-wrap">{one.text}</p>
                </div>
                <Time at={one.at} />
              </div>
            ) : one.who === "assistant" ? (
              <Answer key={index} reply={one.reply} at={one.at} />
            ) : (
              <p key={index} className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{one.text}</p>
            ),
          )}
          {ask.isPending && (
            <div className="flex items-center gap-3 text-sm text-ink-muted">
              <Mark />
              Reading the news and prices…
            </div>
          )}
          <section>
            <h3 className="mb-3 flex items-center gap-2 text-base font-bold">
              <TrendingUp className="size-4 text-violet-600" aria-hidden="true" />
              Suggested questions
            </h3>
            <div className="flex flex-wrap gap-2.5">
              {SUGGESTED.map(({ icon: Icon, question }) => (
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
          <div ref={bottom} />
        </div>
      </div>

      <div className="space-y-3 px-6 pt-3 pb-5">
        <form
          onSubmit={onSubmit}
          className="flex items-end gap-2 rounded-2xl border border-line bg-white p-3 focus-within:border-violet-400
            focus-within:ring-2 focus-within:ring-violet-200"
        >
          <label htmlFor="market-question" className="sr-only">Ask the market assistant</label>
          <textarea
            id="market-question"
            rows={2}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                send(draft);
              }
            }}
            placeholder="Ask about market news, a share's price or today's movers…"
            className="block min-w-0 flex-1 resize-none border-0 bg-transparent px-1 py-1 text-sm focus:ring-0 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!draft.trim() || ask.isPending}
            className="grid size-10 shrink-0 place-items-center rounded-xl bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-40"
          >
            <SendHorizontal className="size-5" aria-hidden="true" />
            <span className="sr-only">Send</span>
          </button>
        </form>
        <p className="flex items-start gap-2 rounded-xl bg-slate-50 px-4 py-3 text-xs">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            <span className="font-semibold">Not investment advice.</span> General market information from public news
            (Google News) and prices (Twelve Data), which may be delayed. It never sees the firm&rsquo;s clients or
            holdings.
          </span>
        </p>
      </div>
    </div>
  );
}

function Mark() {
  return (
    <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-violet-500/10 text-violet-600">
      <Globe className="size-5" aria-hidden="true" />
    </span>
  );
}

function Answer({ reply, at }: { reply: MarketReply; at: string }) {
  return (
    <div>
      <div className="flex items-start gap-3">
        <Mark />
        <div className="min-w-0 flex-1 space-y-4 rounded-xl border border-line px-4 py-4">
          <p className="text-sm whitespace-pre-wrap">{reply.summary}</p>
          {reply.points.length > 0 && (
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {reply.points.map((point, index) => <li key={index}>{point}</li>)}
            </ul>
          )}
          {reply.quotes.length > 0 && <Quotes quotes={reply.quotes} />}
          {reply.sources.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-semibold tracking-wider text-ink-muted uppercase">Sources</p>
              <ol className="space-y-1 text-sm">
                {reply.sources.map((source, index) => (
                  <li key={source.url} className="flex gap-2">
                    <span className="text-ink-muted tabular-nums">{index + 1}.</span>
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-w-0 text-primary-700 hover:underline"
                    >
                      {source.title}
                      <ExternalLink className="ml-1 inline size-3" aria-hidden="true" />
                      <span className="block text-xs text-ink-muted">
                        {[source.outlet, source.publishedAt && new Date(source.publishedAt)
                          .toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })]
                          .filter(Boolean).join(" · ")}
                      </span>
                    </a>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </div>
      <Time at={at} by={reply.answeredBy} />
    </div>
  );
}

/** The prices the answer was given, as Twelve Data gave them. */
function Quotes({ quotes }: { quotes: MarketQuote[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-line">
      <table className="w-full text-sm tabular-nums">
        <thead>
          <tr className="border-b border-line text-left text-xs text-ink-muted">
            <th scope="col" className="px-3 py-2 font-medium">Symbol</th>
            <th scope="col" className="px-3 py-2 font-medium">Name</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">Price</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">Day</th>
          </tr>
        </thead>
        <tbody>
          {quotes.map((quote) => (
            <tr key={quote.symbol} className="border-b border-line last:border-0">
              <td className="px-3 py-2 font-semibold">{quote.symbol}</td>
              <td className="px-3 py-2 text-ink-soft">{quote.name}</td>
              <td className="px-3 py-2 text-right whitespace-nowrap">
                {quote.price == null ? "—" : `${Number(quote.price).toFixed(2)} ${quote.currency}`}
              </td>
              <td
                className={`px-3 py-2 text-right whitespace-nowrap ${quote.changePercent == null ? ""
                  : Number(quote.changePercent) < 0 ? "text-red-700" : "text-emerald-700"}`}
              >
                {quote.changePercent == null ? "—"
                  : `${Number(quote.changePercent) > 0 ? "+" : ""}${Number(quote.changePercent).toFixed(2)}%`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-line px-3 py-1.5 text-2xs text-ink-muted">
        Twelve Data{quotes[0]?.asOf ? `, for ${quotes[0].asOf}` : ""}. Prices may be delayed.
      </p>
    </div>
  );
}

function Time({ at, by }: { at: string; by?: string }) {
  return (
    <p className="mt-1 text-right text-xs text-ink-muted">
      {by && <span>{by} · </span>}
      {new Date(at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
    </p>
  );
}
