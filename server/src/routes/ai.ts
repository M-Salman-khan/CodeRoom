import { Router } from "express";
import { asyncHandler } from "../lib/http";
import { requireRoomMembership, roomFromParams } from "../lib/route-helpers";
import { LIMITS, byteLength } from "../lib/validation";
import { requireAuth } from "../middleware/auth";
import { aiLimiter } from "../middleware/rate-limit";
import { analyzeErrorWithAI, reviewCodeWithAI } from "../services/ai-service";

const router = Router({ mergeParams: true });

router.post(
  "/",
  requireAuth,
  aiLimiter,
  asyncHandler(async (req, res) => {
    const room = await roomFromParams(req, res);
    if (!room) return;
    if (!(await requireRoomMembership(req, res, room))) return;

    const body = req.body || {};
    const action = typeof body.action === "string" ? body.action : "debug";
    const fileName =
      typeof body.fileName === "string" && body.fileName
        ? body.fileName
        : "code.txt";
    const code = typeof body.code === "string" ? body.code : "";
    const errorText = typeof body.error === "string" ? body.error : "";
    const stdout = typeof body.stdout === "string" ? body.stdout : "";

    if (fileName.length > 200) {
      res.status(400).json({ error: "File name is too long" });
      return;
    }
    if (byteLength(code) > LIMITS.aiCodeBytes) {
      res
        .status(413)
        .json({ error: "Code sent to the AI service is too large" });
      return;
    }
    if (
      byteLength(errorText) > LIMITS.aiErrorBytes ||
      byteLength(stdout) > LIMITS.aiOutputBytes
    ) {
      res.status(413).json({
        error: "Execution output sent to the AI service is too large",
      });
      return;
    }

    if (action === "review") {
      const result = await reviewCodeWithAI(fileName, code);
      res.json({ success: true, result });
      return;
    }

    const result = await analyzeErrorWithAI(fileName, code, errorText, stdout);
    res.json({ success: true, result });
  }),
);

export default router;
