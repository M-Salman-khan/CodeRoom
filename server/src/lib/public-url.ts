import { env, isProduction } from "../config/env";

export interface PublicBaseUrlInfo {
  /** Normalized origin, or null when no usable PUBLIC_BASE_URL is configured. */
  url: string | null;
  /** True only for a public HTTPS origin that is safe to share with remote users. */
  isPublic: boolean;
  /** The raw value used to resolve the origin (for diagnostics, never secrets). */
  source: "PUBLIC_BASE_URL" | "CLIENT_ORIGIN" | null;
  /** Whether invitation links may be generated with this origin. */
  inviteLinksEnabled: boolean;
}

const PRIVATE_IPV4_PATTERNS = [
  /^0\./,
  /^10\./,
  /^127\./,
  /^169\.254\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  // Carrier-grade NAT (100.64.0.0/10)
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,
];

/** Detect hostnames that remote participants cannot reach over the internet. */
export function isPrivateHostname(hostname: string): boolean {
  const host = hostname
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, "");

  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host.endsWith(".lan") ||
    host.endsWith(".home") ||
    host.endsWith(".corp") ||
    host.endsWith(".intranet") ||
    host.endsWith(".private") ||
    host === "0.0.0.0" ||
    host === "::" ||
    host === "::1" ||
    host === "metadata.google.internal"
  ) {
    return true;
  }

  // Single-label hostnames (e.g. `coderoom` or `college-server`) are only
  // resolvable on an internal network, never from the public internet.
  if (!host.includes(".") && !host.includes(":")) {
    return true;
  }

  if (PRIVATE_IPV4_PATTERNS.some((pattern) => pattern.test(host))) {
    return true;
  }

  // IPv6 unique-local (fc00::/7) and link-local (fe80::/10).
  if (/^f[cd][0-9a-f]{2}:/i.test(host) || /^fe[89ab][0-9a-f]:/i.test(host)) {
    return true;
  }

  return false;
}

function normalizeOrigin(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const parsed = new URL(value.trim());
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:")
      return null;
    if (parsed.username || parsed.password) return null;
    // CodeRoom is served from the origin root; ignore paths/query/hash.
    return parsed.origin;
  } catch {
    return null;
  }
}

/**
 * Resolve the canonical public origin used for invitation links.
 *
 * - Production requires an explicit, public HTTPS PUBLIC_BASE_URL.
 * - Development may fall back to CLIENT_ORIGIN, but private/local origins are
 *   only usable for invitations when ALLOW_PRIVATE_BASE_URL=true (local-only).
 * - When no safe origin exists, invite links are disabled rather than silently
 *   emitting localhost or a private LAN IP.
 */
export function resolvePublicBaseUrl(): PublicBaseUrlInfo {
  const explicit = normalizeOrigin(env.PUBLIC_BASE_URL);
  const fallback = isProduction ? null : normalizeOrigin(env.CLIENT_ORIGIN);
  const url = explicit || fallback;
  const source: PublicBaseUrlInfo["source"] = explicit
    ? "PUBLIC_BASE_URL"
    : fallback
      ? "CLIENT_ORIGIN"
      : null;

  if (!url) {
    return { url: null, isPublic: false, source, inviteLinksEnabled: false };
  }

  const hostname = new URL(url).hostname;
  const isPrivate = isPrivateHostname(hostname);
  const isHttps = new URL(url).protocol === "https:";
  const isPublic = !isPrivate && isHttps;

  // Production invitation links must be public HTTPS. A local-only override is
  // available for development/testing, but never intended for a deployed host.
  const inviteLinksEnabled =
    isPublic || (!isProduction && env.ALLOW_PRIVATE_BASE_URL);

  return { url, isPublic, source, inviteLinksEnabled };
}

/** Build a canonical room URL, or null when invitation links are disabled. */
export function buildInviteUrl(roomCode: string): string | null {
  const info = resolvePublicBaseUrl();
  if (!info.url || !info.inviteLinksEnabled) return null;
  return `${info.url}/room/${encodeURIComponent(roomCode)}`;
}
