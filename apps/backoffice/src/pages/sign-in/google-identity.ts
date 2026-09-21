/** The slice of Google Identity Services the sign-in page uses. */
interface GoogleIdentity {
  accounts: {
    id: {
      initialize: (options: {
        client_id: string;
        callback: (response: { credential: string }) => void;
        /** Never sign in silently as a remembered account: the person picks, every time. */
        auto_select: boolean;
      }) => void;
      renderButton: (
        parent: HTMLElement,
        options: {
          type: "standard";
          theme: "outline";
          size: "large";
          text: "continue_with";
          width: number;
          logo_alignment: "center";
        },
      ) => void;
      disableAutoSelect: () => void;
    };
  };
}

declare global {
  interface Window {
    google?: GoogleIdentity;
  }
}

const SCRIPT_SRC = "https://accounts.google.com/gsi/client";

/** Loads Google's script once, however many times the button is drawn. */
export function loadGoogle(): Promise<GoogleIdentity> {
  if (window.google) return Promise.resolve(window.google);
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
    const script = existing ?? document.createElement("script");
    const failed = () => reject(new Error("Google's sign-in couldn't be reached. Sign in with your password instead."));
    script.addEventListener("load", () => (window.google ? resolve(window.google) : failed()), { once: true });
    script.addEventListener("error", failed, { once: true });
    if (!existing) {
      script.src = SCRIPT_SRC;
      script.async = true;
      document.head.append(script);
    }
  });
}

/**
 * Forgets which Google account was used, so the next sign-in shows the chooser again. Called on sign-out: otherwise
 * Google can go straight back in as the account it remembers, which is wrong on a shared machine.
 */
export function forgetGoogleAccount() {
  window.google?.accounts.id.disableAutoSelect();
}
