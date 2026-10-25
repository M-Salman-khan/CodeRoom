import { Router } from "express";
import { hashPassword, validatePassword, verifyPassword } from "../lib/auth";
import { asyncHandler } from "../lib/http";
import { serializeUserWithDate } from "../lib/serializers";
import { requireAuth } from "../middleware/auth";
import { User } from "../models/user";

const router = Router();

router.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user!.id).exec();
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json({ user: serializeUserWithDate(user) });
  })
);

router.patch(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    const currentPassword =
      typeof body.currentPassword === "string" ? body.currentPassword : "";
    const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";

    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: "Both current and new passwords are required" });
      return;
    }

    const validation = validatePassword(newPassword);
    if (!validation.valid) {
      res.status(400).json({ error: validation.error });
      return;
    }

    const user = await User.findById(req.user!.id).exec();
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const matches = await verifyPassword(currentPassword, user.passwordHash);
    if (!matches) {
      res.status(400).json({ error: "Incorrect current password" });
      return;
    }

    user.passwordHash = await hashPassword(newPassword);
    await user.save();

    res.json({ success: true, message: "Password updated successfully" });
  })
);

export default router;
