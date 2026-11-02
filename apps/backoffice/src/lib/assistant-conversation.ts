/**
 * Which portfolio-assistant conversation this browser is in, so the panel shows the same chat after a refresh
 * or in another tab until its owner signs out.
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

/** Signing out ends the chat: whoever signs in next, the same person included, starts a new one. */
export function forgetAssistantConversation() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing kept to forget.
  }
}
