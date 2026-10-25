import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateRoomCode(): string {
  // Uppercase alphanumeric excluding confusing chars: 0, O, 1, I, L
  const chars = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export function getLanguageFromFilename(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "js":
    case "mjs":
    case "cjs":
      return "javascript";
    case "jsx":
      return "javascript";
    case "ts":
      return "typescript";
    case "tsx":
      return "typescript";
    case "py":
      return "python";
    case "java":
      return "java";
    case "kt":
    case "kts":
      return "kotlin";
    case "cpp":
    case "cc":
    case "cxx":
    case "hpp":
    case "h":
      return "cpp";
    case "c":
      return "c";
    case "cs":
      return "csharp";
    case "go":
      return "go";
    case "rs":
      return "rust";
    case "html":
    case "htm":
      return "html";
    case "css":
    case "scss":
    case "less":
      return "css";
    case "json":
      return "json";
    case "md":
    case "markdown":
      return "markdown";
    case "sql":
      return "sql";
    case "sh":
    case "bash":
    case "zsh":
      return "shell";
    case "yaml":
    case "yml":
      return "yaml";
    case "xml":
      return "xml";
    case "php":
      return "php";
    case "rb":
      return "ruby";
    default:
      return "plaintext";
  }
}

// Deterministic bright/distinguishable colors for user cursors & presence
const USER_COLORS = [
  "#3B82F6", // Blue
  "#10B981", // Emerald
  "#8B5CF6", // Purple
  "#F59E0B", // Amber
  "#EC4899", // Pink
  "#06B6D4", // Cyan
  "#F97316", // Orange
  "#14B8A6", // Teal
  "#6366F1", // Indigo
  "#E11D48", // Rose
];

export function getUserColor(username: string): string {
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % USER_COLORS.length;
  return USER_COLORS[index];
}

export function getInitials(name: string): string {
  if (!name) return "?";
  const parts = name.trim().split(" ");
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}
