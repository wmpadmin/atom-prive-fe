/**
 * Which Firm Assistant conversation this browser is in, so the page shows the same chat after a refresh, in
 * another tab or after a visit elsewhere, until its owner signs out.
 *
 * <p>Only the conversation's id is kept here — a random id that means nothing on its own. The questions and
 * answers themselves, client names included, stay on the server and are read back from there; the server
 * answers only the person who asked them.
 *
 * <p>Kept per person: somebody else signing in at the same machine starts their own. Read through a
 * try/catch like the preferences beside it, because a private window or blocked site data must still give
 * a working panel — it just starts a new chat each time.
 */

const KEY = "atomprive.assistant.conversation";

type Kept = { userId: string; conversationId: string };

/** This person's conversation, or a new one where there is none — written down so the next tab finds it. */
export function conversationFor(userId: string): string {
  try {
    const held = localStorage.getItem(KEY);
    if (held) {
      const kept = JSON.parse(held) as Partial<Kept>;
      if (kept.userId === userId && typeof kept.conversationId === "string") {
        return kept.conversationId;
      }
    }
  } catch {
    // Unreadable is the same as nothing kept.
  }
  const conversationId = crypto.randomUUID();
  try {
    localStorage.setItem(KEY, JSON.stringify({ userId, conversationId } satisfies Kept));
  } catch {
    // Not kept: this tab still has its chat, a refresh starts another.
  }
  return conversationId;
}

/**
 * The Market Assistant's conversation, kept in this browser for its owner. Nothing in it is the firm's — it is
 * public news and prices — so the questions and answers themselves are kept here rather than on the server.
 */
const MARKET_KEY = "atomprive.market-assistant";

type KeptMarket<T> = { userId: string; said: T[] };

export function marketChatFor<T>(userId: string): T[] {
  try {
    const held = localStorage.getItem(MARKET_KEY);
    if (held) {
      const kept = JSON.parse(held) as Partial<KeptMarket<T>>;
      if (kept.userId === userId && Array.isArray(kept.said)) {
        return kept.said;
      }
    }
  } catch {
    // Unreadable is the same as nothing kept.
  }
  return [];
}

export function keepMarketChat<T>(userId: string, said: T[]) {
  try {
    localStorage.setItem(MARKET_KEY, JSON.stringify({ userId, said: said.slice(-40) } satisfies KeptMarket<T>));
  } catch {
    // Not kept: the chat still works, a refresh starts it again.
  }
}

/** Signing out ends both chats: whoever signs in next, the same person included, starts new ones. */
export function forgetAssistantConversation() {
  try {
    localStorage.removeItem(KEY);
    localStorage.removeItem(MARKET_KEY);
  } catch {
    // Nothing kept to forget.
  }
}
