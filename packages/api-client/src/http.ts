/** An RFC 9457 problem detail, as returned by every API error. */
export interface Problem {
  status: number;
  detail?: string;
  /** Field name to message, present on validation failures. */
  errors?: Record<string, string>;
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
  return fetch(url, { ...options, headers, credentials: "include" });
}

async function readProblem(response: Response): Promise<Problem> {
  try {
    return { status: response.status, ...(await response.json()) };
  } catch {
    return { status: response.status };
  }
}
