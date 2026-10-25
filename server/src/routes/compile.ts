import { Router } from "express";
import { asyncHandler } from "../lib/http";
import { requireAuth } from "../middleware/auth";
import { runLimiter } from "../middleware/rate-limit";
import {
  executeCode,
  getSupportedLanguages,
  resolveLanguage,
} from "../services/compiler";

const router = Router();

router.get(
  "/languages",
  asyncHandler(async (_req, res) => {
    const languages = getSupportedLanguages();
    res.json({ success: true, languages, total: languages.length });
  }),
);

router.post(
  "/",
  requireAuth,
  runLimiter,
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    const code = body.code;
    const language =
      typeof body.language === "string" ? body.language : undefined;
    const stdin = typeof body.stdin === "string" ? body.stdin : "";
    const filename =
      typeof body.filename === "string" ? body.filename : undefined;
    const preferEngine =
      body.preferEngine === "local" ||
      body.preferEngine === "cloud" ||
      body.preferEngine === "auto"
        ? body.preferEngine
        : "auto";
    const requestedTimeout = Number(body.timeoutMs);
    const timeoutMs = Math.min(
      Math.max(
        Number.isFinite(requestedTimeout) ? requestedTimeout : 10000,
        1000,
      ),
      20000,
    );

    if (!code || typeof code !== "string") {
      res.status(400).json({ error: "Code is required and must be a string." });
      return;
    }

    const resolved = resolveLanguage(language, filename);
    const result = await executeCode({
      code,
      language: resolved.id,
      stdin,
      filename,
      preferEngine,
      timeoutMs,
    });

    res.json({ success: true, result, language: resolved });
  }),
);

export default router;
