import { Database, Globe, Layers, Lock, ShieldCheck, Sparkles, TrendingUp, Users, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useSearchParams } from "react-router";
import { useStaffUser } from "../../auth/session";
import { FirmAssistantChat } from "../../components/portfolio-assistant";
import { hasAuthority } from "../../lib/permissions";

/**
 * The AI Assistant: two assistants on one page, a tab each.
 *
 * <p>The Firm Assistant answers from the platform's own records, and only from what the person asking could
 * already open on screen — a question is no way round a permission. The Market Assistant answers about the
 * world outside, from the open web, and is never handed anything of the firm's.
 *
 * <p>Which tab is open is kept in the address, so a link to the Market Assistant opens on it.
 */

type Which = "firm" | "market";

const TABS: { id: Which; icon: LucideIcon; title: string; blurb: string }[] = [
  {
    id: "firm",
    icon: Layers,
    title: "Firm Assistant",
    blurb: "Ask about clients, portfolios, KYC, operations, and how to use the portal",
  },
  {
    id: "market",
    icon: TrendingUp,
    title: "Market Assistant",
    blurb: "Market news, trends and insights from the open web",
  },
];

export function AssistantPage() {
  const user = useStaffUser();
  const [params, setParams] = useSearchParams();
  const which: Which = params.get("tab") === "market" ? "market" : "firm";
  const customerId = params.get("client");
  // Portfolio questions are the portfolio desk's, which is whoever may write proposals; the server keeps to the same rule.
  const portfolioDesk = hasAuthority(user, "SEND_PROPOSALS:CHANGE");

  const open = (to: Which) =>
    setParams((now) => {
      const next = new URLSearchParams(now);
      if (to === "market") next.set("tab", "market");
      else next.delete("tab");
      return next;
    }, { replace: true });

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-violet-500/10 text-violet-600">
          <Sparkles className="size-6" aria-hidden="true" />
        </span>
        <div>
          <h1 className="text-[1.625rem] font-bold text-balance">AI Assistant</h1>
          <p className="mt-1 text-sm text-ink-muted">Your assistant for portfolio, operations and market insights.</p>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-line bg-white">
          <div role="tablist" aria-label="Which assistant" className="grid gap-2 border-b border-line p-2 sm:grid-cols-2">
            {TABS.map(({ id, icon: Icon, title, blurb }) => {
              const selected = which === id;
              return (
                <button
                  key={id}
                  id={`assistant-tab-${id}`}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  aria-controls={`assistant-panel-${id}`}
                  onClick={() => open(id)}
                  className={`flex items-start gap-3 rounded-xl border-b-2 px-4 py-3 text-left transition-colors
                    focus-visible:ring-2 focus-visible:ring-violet-300 focus-visible:outline-none ${selected
                      ? "border-violet-600 bg-violet-500/10"
                      : "border-transparent hover:bg-sidebar"}`}
                >
                  <Icon className={`mt-0.5 size-6 shrink-0 ${selected ? "text-violet-600" : "text-ink-muted"}`} aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block font-bold text-ink">{title}</span>
                    <span className="block text-xs text-ink-muted">{blurb}</span>
                  </span>
                </button>
              );
            })}
          </div>

          <div
            role="tabpanel"
            id={`assistant-panel-${which}`}
            aria-labelledby={`assistant-tab-${which}`}
            className="h-[calc(100vh-17rem)] min-h-[32rem]"
          >
            {which === "firm" ? (
              <FirmAssistantChat customerId={customerId} portfolioDesk={portfolioDesk} />
            ) : (
              <Waiting
                icon={Globe}
                title="The Market Assistant is on its way"
                body="It will answer questions about markets and the latest finance news from the open web, with its
                  sources linked under every answer. It never sees anything of the firm's or its clients'."
              />
            )}
          </div>
        </section>

        <aside aria-label="About the assistants" className="space-y-5">
          <section className="rounded-2xl border border-line bg-white p-5">
            <h2 className="mb-4 text-base font-bold">How it works</h2>
            <dl className="space-y-4 text-sm">
              <Detail icon={Users} term="Who can use it">
                Every member of staff. The Market Assistant is for staff only, never clients.
              </Detail>
              <Detail icon={Database} term="What the Firm Assistant sees">
                Only what your role can already open on screen — the same clients, the same records.
              </Detail>
              <Detail icon={ShieldCheck} term="Actions">
                It can offer to do things for you, such as sending a reminder. Nothing happens until you approve it,
                and every approval is in the audit log under your name.
              </Detail>
              <Detail icon={Lock} term="Privacy">
                Client names are replaced with aliases before anything leaves Atom Privé.
              </Detail>
              <Detail icon={Globe} term="Market Assistant">
                General market information from the open web, not investment advice.
              </Detail>
            </dl>
          </section>
        </aside>
      </div>
    </div>
  );
}

function Detail({ icon: Icon, term, children }: { icon: LucideIcon; term: string; children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-violet-600" aria-hidden="true" />
      <div>
        <dt className="font-semibold">{term}</dt>
        <dd className="text-ink-muted">{children}</dd>
      </div>
    </div>
  );
}

/** What a tab says while what it does is still being built. */
function Waiting({ icon: Icon, title, body }: { icon: LucideIcon; title: string; body: string }) {
  return (
    <div className="grid h-full place-items-center px-6 py-10">
      <div className="max-w-md text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-violet-500/10 text-violet-600">
          <Icon className="size-6" aria-hidden="true" />
        </span>
        <h2 className="mt-4 text-lg font-bold text-balance">{title}</h2>
        <p className="mt-2 text-sm text-ink-muted">{body}</p>
      </div>
    </div>
  );
}
