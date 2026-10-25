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
  const merged: Record<string, string> = { ...readEnvFile(path.join(REPO_ROOT, ".env")) };
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

export const env = {
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: intFromEnv(process.env.PORT, 3000),
  HOST: process.env.HOST || "0.0.0.0",
  MONGODB_URI: process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/coderoom",
  AUTH_SECRET:
    process.env.AUTH_SECRET ||
    "coderoom-default-fallback-secret-at-least-32-chars-long",
  CLIENT_ORIGIN: process.env.CLIENT_ORIGIN || "http://localhost:5173",
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || "",
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || "",
  CLIENT_DIST: path.resolve(REPO_ROOT, "client", "dist"),
  SERVER_ROOT,
  REPO_ROOT,
};

export const isProduction = env.NODE_ENV === "production";
