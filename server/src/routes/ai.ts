import { Router } from "express";
import { asyncHandler } from "../lib/http";
import { roomFromParams } from "../lib/route-helpers";
import { requireAuth } from "../middleware/auth";
import { analyzeErrorWithAI, reviewCodeWithAI } from "../services/ai-service";

const router = Router({ mergeParams: true });

router.post(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const room = await roomFromParams(req, res);
    if (!room) return;

    const body = req.body || {};
    const action = typeof body.action === "string" ? body.action : "debug";
    const fileName =
      typeof body.fileName === "string" && body.fileName ? body.fileName : "code.txt";
    const code = typeof body.code === "string" ? body.code : "";
    const errorText = typeof body.error === "string" ? body.error : "";
    const stdout = typeof body.stdout === "string" ? body.stdout : "";

    if (action === "review") {
      const result = await reviewCodeWithAI(fileName, code);
      res.json({ success: true, result });
      return;
    }

    const result = await analyzeErrorWithAI(fileName, code, errorText, stdout);
    res.json({ success: true, result });
  })
);

export default router;
