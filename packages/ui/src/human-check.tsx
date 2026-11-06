import { useEffect, useRef, useState } from "react";

/**
 * "Confirm you're a person" (Cloudflare Turnstile), drawn only when the server has asked for it (S12).
 *
 * <p>The server decides: a refusal carries `humanCheckSiteKey` once a sign-in door has been knocked on too
 * often, and until then nothing here loads, so an ordinary sign-in never fetches Cloudflare's script.
 */

const SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

interface Turnstile {
  render: (element: HTMLElement, options: Record<string, unknown>) => string;
  remove: (id: string) => void;
}

declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}

let loading: Promise<Turnstile> | null = null;

function loadTurnstile(): Promise<Turnstile> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  loading ??= new Promise<Turnstile>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT;
    script.async = true;
    script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("Turnstile did not load")));
    script.onerror = () => {
      loading = null;
      reject(new Error("Turnstile did not load"));
    };
    document.head.appendChild(script);
  });
  return loading;
}

/** The check itself. Give it a new `key` after every try: a passed check is good once. */
export function HumanCheck({ siteKey, onToken, theme = "auto" }: { siteKey: string; onToken: (token: string | null) => void; theme?: "light" | "dark" | "auto" }) {
  const box = useRef<HTMLDivElement>(null);
  const latest = useRef(onToken);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    latest.current = onToken;
  });

  useEffect(() => {
    let id: string | undefined;
    let gone = false;
    loadTurnstile()
      .then((turnstile) => {
        if (gone || !box.current) return;
        id = turnstile.render(box.current, {
          sitekey: siteKey,
          theme,
          callback: (token: string) => latest.current(token),
          "expired-callback": () => latest.current(null),
          "error-callback": () => latest.current(null),
        });
      })
      .catch(() => setFailed(true));
    return () => {
      gone = true;
      if (id && window.turnstile) window.turnstile.remove(id);
    };
  }, [siteKey, theme]);

  if (failed) {
    return (
      <p role="alert" className="text-sm text-access-none-ink">
        The &ldquo;confirm you&rsquo;re a person&rdquo; check couldn&rsquo;t load. Check your connection and reload the page.
      </p>
    );
  }
  return <div ref={box} className="min-h-[65px]" />;
}

/**
 * Whether a form has been asked for the check, and the tick to send with its next try.
 *
 * <p>Call `heard` with every answer the form gets, error or not: a refusal may ask for the check, and a tick
 * that has been sent is spent, so the check is drawn afresh for the next try.
 */
export function useHumanCheck() {
  const [siteKey, setSiteKey] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [round, setRound] = useState(0);
  return {
    siteKey,
    token,
    round,
    setToken,
    /** Still to be ticked before the form may try again. */
    waiting: siteKey !== null && token === null,
    heard(error?: unknown) {
      const asked = (error as { problem?: { humanCheckSiteKey?: string } } | undefined)?.problem?.humanCheckSiteKey;
      if (asked) setSiteKey(asked);
      if (asked || token) {
        setToken(null);
        setRound((was) => was + 1);
      }
    },
  };
}
