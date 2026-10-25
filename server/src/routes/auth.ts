import { Router } from "express";
import {
  COOKIE_NAME,
  cookieMaxAge,
  createSessionToken,
  hashPassword,
  validatePassword,
  validateUsername,
  verifyPassword,
} from "../lib/auth";
import { clearSessionCookie, setSessionCookie } from "../lib/cookies";
import { asyncHandler } from "../lib/http";
import { serializeUser } from "../lib/serializers";
import { escapeRegExp } from "../lib/utils";
import { authLimiter } from "../middleware/rate-limit";
import { extractRequestToken, resolveRequestUser } from "../middleware/auth";
import { User } from "../models/user";

const router = Router();

function usernameFilter(username: string): Record<string, unknown> {
  return { username: { $regex: `^${escapeRegExp(username)}$`, $options: "i" } };
}

router.post(
  "/register",
  authLimiter,
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    const username =
      typeof body.username === "string" ? body.username.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const confirmPassword =
      typeof body.confirmPassword === "string" ? body.confirmPassword : "";

    const usernameValidation = validateUsername(username);
    if (!usernameValidation.valid) {
      res.status(400).json({ error: usernameValidation.error });
      return;
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      res.status(400).json({ error: passwordValidation.error });
      return;
    }

    if (password !== confirmPassword) {
      res.status(400).json({ error: "Passwords do not match" });
      return;
    }

    const existing = await User.findOne(usernameFilter(username))
      .select("_id")
      .exec();
    if (existing) {
      res.status(409).json({ error: "Username already taken" });
      return;
    }

    const passwordHash = await hashPassword(password);
    const user = await User.create({ username, passwordHash });

    const token = await createSessionToken({
      id: user._id,
      username: user.username,
    });
    setSessionCookie(res, req, token, cookieMaxAge());

    res.status(201).json({
      success: true,
      user: serializeUser(user),
      token,
    });
  }),
);

router.post(
  "/login",
  authLimiter,
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    const username =
      typeof body.username === "string" ? body.username.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!username || !password) {
      res.status(400).json({ error: "Username and password are required" });
      return;
    }
    if (password.length > 128) {
      res
        .status(400)
        .json({ error: "Password must be 128 characters or fewer" });
      return;
    }

    const user = await User.findOne(usernameFilter(username)).exec();
    if (!user) {
      res.status(401).json({ error: "Incorrect username or password" });
      return;
    }

    const matches = await verifyPassword(password, user.passwordHash);
    if (!matches) {
      res.status(401).json({ error: "Incorrect username or password" });
      return;
    }

    const token = await createSessionToken({
      id: user._id,
      username: user.username,
    });
    setSessionCookie(res, req, token, cookieMaxAge());

    res.json({
      success: true,
      user: serializeUser(user),
      token,
    });
  }),
);

router.get(
  "/me",
  asyncHandler(async (req, res) => {
    const user = await resolveRequestUser(req);
    if (!user) {
      res.status(401).json({ user: null });
      return;
    }

    // Return the existing token only. Never mint a fresh one here, otherwise
    // visiting the dashboard would silently extend a session past its 1h limit.
    const token = extractRequestToken(req);

    res.json({ user, token });
  }),
);

router.post(
  "/logout",
  asyncHandler(async (req, res) => {
    clearSessionCookie(res, req);
    res.json({ success: true, message: "Logged out" });
  }),
);

// Exposed for tests/diagnostics without leaking anything sensitive.
export const authCookieName = COOKIE_NAME;

export default router;
