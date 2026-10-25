/**
 * Auth helpers shared by every page.
 *
 * The API delivers the JWT both as an httpOnly cookie and in the JSON body.
 * We mirror the legacy behaviour: persist the token in sessionStorage *and*
 * localStorage under `coderoom_token`, send it as a Bearer header, and always
 * include cookies (`credentials: "include"`).
 */

export const TOKEN_KEY = "coderoom_token";

export function getStoredToken(): string {
  if (typeof window === "undefined") return "";
  try {
    return (
      sessionStorage.getItem(TOKEN_KEY) ||
      localStorage.getItem(TOKEN_KEY) ||
      ""
    );
  } catch {
    return "";
  }
}

export function storeToken(token: string): void {
  if (typeof window === "undefined" || !token) return;
  try {
    sessionStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* storage can be unavailable (private mode / quota) */
  }
}

export function clearStoredToken(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

export function getAuthHeaders(
  extra: Record<string, string> = {}
): Record<string, string> {
  const token = getStoredToken();
  return token ? { ...extra, Authorization: `Bearer ${token}` } : { ...extra };
}

/** `fetch` wrapper that always sends cookies and the bearer token. */
export function apiFetch(
  input: string,
  init: RequestInit = {}
): Promise<Response> {
  return fetch(input, {
    credentials: "include",
    ...init,
    headers: getAuthHeaders({
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...((init.headers as Record<string, string> | undefined) ?? {}),
    }),
  });
}

/** Absolute same-origin WebSocket URL for the room event socket. */
export function getRoomSocketUrl(roomId: string): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const token = getStoredToken();
  const tokenParam = token ? `&token=${encodeURIComponent(token)}` : "";
  return `${protocol}//${window.location.host}/ws?roomId=${encodeURIComponent(
    roomId
  )}${tokenParam}`;
}

/** Absolute same-origin WebSocket URL for the Yjs document provider. */
export function getYjsSocketUrl(): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/yjs`;
}

/** Extract an error message from a JSON error response. */
export function errorMessage(data: unknown, fallback: string): string {
  if (
    data &&
    typeof data === "object" &&
    "error" in data &&
    typeof (data as { error?: unknown }).error === "string"
  ) {
    return (data as { error: string }).error;
  }
  return fallback;
}
