import fs from "fs";
import path from "path";
import dotenv from "dotenv";

/**
 * Resolve the server package root both when running from `src` (tsx) and
 * from `dist` (compiled). In both cases this is `<repo>/server`.
 */
export const SERVER_ROOT = path.resolve(__dirname, "..", "..");
const REPO_ROOT = path.resolve(SERVER_ROOT, "..");

function readEnvFile(filePath: string): Record<string, string> {
  try {
    if (!fs.existsSync(filePath)) return {};
    return dotenv.parse(fs.readFileSync(filePath));
  } catch {
    return {};
  }
}

function loadEnvironment(): void {
  // Root .env is the fallback; server/.env wins when it has a non-empty value.
  const merged: Record<string, string> = {
    ...readEnvFile(path.join(REPO_ROOT, ".env")),
  };
  const serverVars = readEnvFile(path.join(SERVER_ROOT, ".env"));

  for (const [key, value] of Object.entries(serverVars)) {
    if (value.trim() !== "" || !(key in merged)) {
      merged[key] = value;
    }
  }

  for (const [key, value] of Object.entries(merged)) {
    const current = process.env[key];
    if (current === undefined || current.trim() === "") {
      process.env[key] = value;
    }
  }
}

loadEnvironment();

function intFromEnv(value: string | undefined, fallback: number): number {
  const parsed = value ? parseInt(value, 10) : NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

function boolFromEnv(value: string | undefined, fallback = false): boolean {
  if (value === undefined || value.trim() === "") return fallback;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

function trustProxyFromEnv(value: string | undefined): number | boolean {
  if (value === undefined || value.trim() === "") return 0;
  const normalized = value.trim().toLowerCase();
  if (normalized === "true") return 1;
  if (normalized === "false") return 0;
  const parsed = Number.parseInt(normalized, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function listFromEnv(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((entry) => entry.trim().replace(/\/$/, ""))
    .filter(Boolean);
}

export const env = {
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: intFromEnv(process.env.PORT, 3000),
  HOST: process.env.HOST || "0.0.0.0",
  MONGODB_URI: process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/coderoom",
  AUTH_SECRET:
    process.env.AUTH_SECRET ||
    "coderoom-default-fallback-secret-at-least-32-chars-long",
  CLIENT_ORIGIN: process.env.CLIENT_ORIGIN || "http://localhost:5173",
  ALLOWED_ORIGINS: listFromEnv(process.env.ALLOWED_ORIGINS),
  PUBLIC_BASE_URL: (process.env.PUBLIC_BASE_URL || "").trim(),
  // Only for local development. Never enable this on an internet-facing host.
  ALLOW_PRIVATE_BASE_URL: boolFromEnv(process.env.ALLOW_PRIVATE_BASE_URL),
  TRUST_PROXY: trustProxyFromEnv(process.env.TRUST_PROXY),
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || "",
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || "",
  CLIENT_DIST: path.resolve(REPO_ROOT, "client", "dist"),
  SERVER_ROOT,
  REPO_ROOT,
};

export const isProduction = env.NODE_ENV === "production";

export const DEFAULT_AUTH_SECRET =
  "coderoom-default-fallback-secret-at-least-32-chars-long";

/**
 * Secrets that have appeared in documentation, examples, or previous releases.
 * They are public knowledge and must never be accepted in production.
 */
const INSECURE_AUTH_SECRETS = new Set([
  DEFAULT_AUTH_SECRET,
  "coderoom-lan-super-secret-key-at-least-32-chars-long",
  "coderoom-dev-secret-change-me-at-least-32-chars-long",
  "change-me-to-a-long-random-secret-at-least-32-chars",
  "ci-placeholder-secret-at-least-32-characters-long",
]);

/**
 * Fail fast on unsafe production configuration. This runs before the HTTP
 * server listens so a misconfigured deployment cannot silently serve sessions
 * signed with a public development/example secret.
 */
export function validateProductionEnvironment(): void {
  if (!isProduction) return;

  if (
    INSECURE_AUTH_SECRETS.has(env.AUTH_SECRET) ||
    env.AUTH_SECRET.length < 32
  ) {
    throw new Error(
      "AUTH_SECRET must be set to a unique value of at least 32 characters in production. " +
        "Generate one with: openssl rand -base64 48",
    );
  }
}
