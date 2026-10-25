import { Router } from "express";
import { env } from "../config/env";
import { resolvePublicBaseUrl } from "../lib/public-url";

const router = Router();

/**
 * Public runtime configuration. The SPA fetches this so invitation links are
 * always generated from the server's canonical origin rather than the URL the
 * participant happens to be using (which may be localhost or a private IP).
 */
router.get("/", (_req, res) => {
  const publicUrl = resolvePublicBaseUrl();

  res.json({
    environment: env.NODE_ENV,
    // Never expose a localhost/private origin as the canonical public URL.
    publicBaseUrl: publicUrl.inviteLinksEnabled ? publicUrl.url : null,
    publicBaseUrlSource: publicUrl.source,
    isPublicBaseUrl: publicUrl.isPublic,
    inviteLinksEnabled: publicUrl.inviteLinksEnabled,
    collaboration: {
      transport: "websocket",
      yjs: true,
      // Yjs requires a real WebSocket; there is no long-polling fallback.
      fallback: false,
      roomEventsPath: "/ws",
      documentPath: "/yjs",
    },
  });
});

export default router;
