import { useEffect, useRef } from "react";
import { loadGoogle } from "./google-identity";

/** Google draws the button at a width in pixels, and only inside these bounds. */
const MIN_WIDTH = 200;
const MAX_WIDTH = 400;

function buttonWidth(parent: HTMLElement) {
  return Math.round(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, parent.clientWidth)));
}

interface GoogleButtonProps {
  clientId: string;
  /** Called with the ID token Google hands back, which the API checks. */
  onCredential: (credential: string) => void;
  onUnavailable: (message: string) => void;
}

/**
 * Google's own "Continue with Google" button; Google insists on drawing it itself. Clicking it opens Google's
 * account chooser, which lists every account signed in on this browser, so the right one can be picked.
 */
export function GoogleButton({ clientId, onCredential, onUnavailable }: GoogleButtonProps) {
  const parent = useRef<HTMLDivElement>(null);
  // Google keeps the callback it is given, so it reads the latest one from here rather than being set up again.
  const latest = useRef(onCredential);
  useEffect(() => {
    latest.current = onCredential;
  }, [onCredential]);

  useEffect(() => {
    let current = true;
    let watcher: ResizeObserver | undefined;
    loadGoogle()
      .then((google) => {
        if (!current || !parent.current) return;
        const box = parent.current;
        google.accounts.id.initialize({
          client_id: clientId,
          callback: (response) => latest.current(response.credential),
          // Without this Google can sign someone straight back in as the account it remembers, with nothing to pick.
          auto_select: false,
        });
        // Google draws the button itself at a fixed pixel width, so it is re-drawn whenever the card changes size.
        let drawnAt = 0;
        const draw = () => {
          const width = buttonWidth(box);
          if (width === drawnAt) return;
          drawnAt = width;
          google.accounts.id.renderButton(box, {
            type: "standard",
            theme: "outline",
            size: "large",
            text: "continue_with",
            width,
            logo_alignment: "center",
          });
        };
        draw();
        watcher = new ResizeObserver(draw);
        watcher.observe(box);
      })
      .catch((caught: unknown) => current && onUnavailable(caught instanceof Error ? caught.message : "Google sign-in isn't available."));
    return () => {
      current = false;
      watcher?.disconnect();
    };
  }, [clientId, onUnavailable]);

  return <div ref={parent} className="flex min-h-10 w-full justify-center overflow-hidden" />;
}
