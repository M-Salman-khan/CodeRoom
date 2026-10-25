import { env, isProduction } from "../config/env";
import { isPrivateHostname, resolvePublicBaseUrl } from "./public-url";

function normalizeOrigin(value: string): string | null {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

const configuredOrigins = new Set<string>();

function addConfiguredOrigin(value: string, explicitlyAllowed = false): void {
  const normalized = normalizeOrigin(value);
  if (!normalized) return;
  // Do not implicitly allow localhost/private origins in production. Operators
  // can still opt in explicitly through ALLOWED_ORIGINS if they really need to.
  if (
    isProduction &&
    !explicitlyAllowed &&
    isPrivateHostname(new URL(normalized).hostname)
  ) {
    return;
  }
  configuredOrigins.add(normalized);
}

addConfiguredOrigin(env.CLIENT_ORIGIN);
for (const candidate of env.ALLOWED_ORIGINS) {
  addConfiguredOrigin(candidate, true);
}
const publicBase = resolvePublicBaseUrl();
if (publicBase.url && publicBase.isPublic) {
  addConfiguredOrigin(publicBase.url);
}

/**
 * Exact-origin allowlist used for both HTTP CORS and WebSocket upgrades.
 *
 * In development any origin is accepted so the Vite dev server and LAN testing
 * work without extra configuration. In production only the canonical public
 * origin, CLIENT_ORIGIN, and explicitly listed ALLOWED_ORIGINS are accepted.
 * Non-browser clients (no Origin header) are allowed and still must present a
 * valid session token.
 */
export function isAllowedOrigin(
  origin: string | undefined | null,
  requestHost?: string,
): boolean {
  if (!origin) return true;
  if (!isProduction) return true;
  if (configuredOrigins.has(origin)) return true;

  // Same-origin browser requests are always safe, even when the deployment is
  // temporarily reached over localhost/HTTP (for example the loopback-only
  // compose stack before a public domain is configured).
  if (requestHost) {
    try {
      if (new URL(origin).host === requestHost) return true;
    } catch {
      /* malformed Origin: deny below */
    }
  }

  return false;
}
