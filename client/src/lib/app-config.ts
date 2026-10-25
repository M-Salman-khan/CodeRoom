import { apiFetch } from "./auth";

/**
 * Runtime configuration served by GET /api/config.
 *
 * Invitation links must be built from the server's canonical origin, never from
 * `window.location.origin`: a participant may be viewing the app through
 * localhost, a LAN IP, or an internal college hostname that other people cannot
 * reach.
 */
export interface AppConfig {
  environment: string;
  publicBaseUrl: string | null;
  publicBaseUrlSource: "PUBLIC_BASE_URL" | "CLIENT_ORIGIN" | null;
  isPublicBaseUrl: boolean;
  inviteLinksEnabled: boolean;
  collaboration: {
    transport: string;
    yjs: boolean;
    fallback: boolean;
    roomEventsPath: string;
    documentPath: string;
  };
}

const FALLBACK_CONFIG: AppConfig = {
  environment: "unknown",
  publicBaseUrl: null,
  publicBaseUrlSource: null,
  isPublicBaseUrl: false,
  inviteLinksEnabled: false,
  collaboration: {
    transport: "websocket",
    yjs: true,
    fallback: false,
    roomEventsPath: "/ws",
    documentPath: "/yjs",
  },
};

let cachedConfig: Promise<AppConfig> | null = null;

export function getAppConfig(): Promise<AppConfig> {
  if (!cachedConfig) {
    cachedConfig = apiFetch("/api/config")
      .then(async (res) => {
        if (!res.ok) return FALLBACK_CONFIG;
        const data = (await res.json()) as Partial<AppConfig>;
        return {
          ...FALLBACK_CONFIG,
          ...data,
          collaboration: {
            ...FALLBACK_CONFIG.collaboration,
            ...(data.collaboration ?? {}),
          },
        };
      })
      .catch(() => FALLBACK_CONFIG);
  }
  return cachedConfig;
}

/** Build a canonical invite URL, or null when invite links are disabled. */
export function buildInviteUrl(
  config: AppConfig | null,
  roomCode: string,
): string | null {
  if (!config?.inviteLinksEnabled || !config.publicBaseUrl || !roomCode) {
    return null;
  }
  return `${config.publicBaseUrl}/room/${encodeURIComponent(roomCode)}`;
}
