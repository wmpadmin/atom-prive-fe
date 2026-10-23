/** An RFC 9457 problem detail, as returned by every API error. */
export interface Problem {
  status: number;
  detail?: string;
  /** Field name to message, present on validation failures. */
  errors?: Record<string, string>;
  /** Tries left before sign-in locks, on a refused authenticator code. */
  attemptsLeft?: number;
  /** When a locked sign-in can be tried again. */
  lockedUntil?: string;
}

/** Thrown for any non-2xx response so TanStack Query treats it as an error. */
export class ApiError extends Error {
  readonly status: number;
  readonly problem: Problem;

  constructor(status: number, problem: Problem) {
    super(problem.detail ?? `Request failed with status ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.problem = problem;
  }
}

interface AuthHooks {
  /** Current access token, or null when signed out. */
  getAccessToken: () => string | null;
  /** Gets a new access token using the refresh cookie; resolves false when the session has ended. */
  refreshAccessToken: () => Promise<boolean>;
  /** Called on a 403: the user's permissions may have changed since they signed in. */
  onForbidden?: () => void;
}

let auth: AuthHooks = {
  getAccessToken: () => null,
  refreshAccessToken: async () => false,
};

/** Each app wires in its own session handling once, at start-up. */
export function configureAuth(hooks: AuthHooks) {
  auth = hooks;
}

// These endpoints work without an access token, so a 401 from them must not trigger a refresh.
const isPublicAuthEndpoint = (url: string) => /\/auth\/(login|refresh|logout)$/.test(url);

/**
 * Fetch wrapper used by every generated hook. Requests go to the same origin (Vite proxies /api to
 * the backend in development) and include cookies so the refresh cookie reaches the auth endpoints.
 * An expired access token is refreshed once and the request retried. JSON responses are parsed;
 * anything else, such as a CSV export, is returned as text.
 */
export async function http<T>(url: string, options: RequestInit = {}): Promise<T> {
  let response = await send(url, options);
  if (response.status === 401 && !isPublicAuthEndpoint(url) && (await auth.refreshAccessToken())) {
    response = await send(url, options);
  }
  if (response.status === 403) {
    auth.onForbidden?.();
  }
  if (!response.ok) {
    throw new ApiError(response.status, await readProblem(response));
  }
  const text = await response.text();
  if (!text) {
    return undefined as T;
  }
  const isJson = response.headers.get("content-type")?.includes("json") ?? false;
  return (isJson ? JSON.parse(text) : text) as T;
}

function send(url: string, options: RequestInit) {
  const headers = new Headers(options.headers);
  const token = auth.getAccessToken();
  if (token && !isPublicAuthEndpoint(url)) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  // An uploaded file carries its own boundary, which only the browser can write.
  if (options.body instanceof FormData) {
    headers.delete("Content-Type");
  }
  return fetch(url, { ...options, headers, credentials: "include" });
}

async function readProblem(response: Response): Promise<Problem> {
  try {
    return { status: response.status, ...(await response.json()) };
  } catch {
    return { status: response.status };
  }
}

/**
 * A file from the API — an attached document, say — fetched with the session's token. Generated hooks parse
 * what comes back as JSON or text, which a PDF or a photograph is neither of.
 */
export async function httpFile(url: string): Promise<Blob> {
  let response = await send(url, {});
  if (response.status === 401 && (await auth.refreshAccessToken())) {
    response = await send(url, {});
  }
  if (!response.ok) {
    throw new ApiError(response.status, await readProblem(response));
  }
  return response.blob();
}

/**
 * Holds a server-sent-event stream open and calls back as each event arrives.
 *
 * <p>Fetch rather than EventSource, which cannot carry a header: the only way to authenticate an
 * EventSource is to put the token in the address, and a token in a URL ends up in browser history, in
 * proxy logs and in any screenshot of the address bar. The session's own header is used instead, through
 * the same refresh-once rule every other request follows.
 *
 * <p>Resolves when the stream ends, by the server closing it or by the caller aborting. It does not retry:
 * reconnecting is the caller's business, because only the caller knows whether it still wants to listen.
 */
export async function openEventStream(
  url: string,
  onEvent: (event: string) => void,
  signal: AbortSignal,
): Promise<void> {
  let response = await send(url, { signal, headers: { Accept: "text/event-stream" } });
  if (response.status === 401 && (await auth.refreshAccessToken())) {
    response = await send(url, { signal, headers: { Accept: "text/event-stream" } });
  }
  if (!response.ok || !response.body) {
    throw new ApiError(response.status, await readProblem(response));
  }
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  // Events arrive as blank-line-separated blocks and a block can be split across reads, so what is left
  // over is kept until the rest of it turns up.
  let pending = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        return;
      }
      pending += value;
      let split = pending.indexOf("\n\n");
      while (split !== -1) {
        const block = pending.slice(0, split);
        pending = pending.slice(split + 2);
        const name = /^event:\s*(.+)$/m.exec(block)?.[1]?.trim();
        if (name) {
          onEvent(name);
        }
        split = pending.indexOf("\n\n");
      }
    }
  } finally {
    reader.cancel().catch(() => {
      // Already closed, which is the ordinary way this ends.
    });
  }
}
