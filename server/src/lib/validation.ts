/** Shared request validation limits and helpers. */

export const LIMITS = {
  roomName: 80,
  roomDescription: 1_000,
  roomPassword: 128,
  roomCode: 16,
  fileName: 120,
  fileContentBytes: 1_000_000,
  chatMessage: 2_000,
  aiCodeBytes: 200_000,
  aiErrorBytes: 20_000,
  aiOutputBytes: 20_000,
  runCodeBytes: 500_000,
} as const;

export function byteLength(value: string): number {
  return Buffer.byteLength(value, "utf8");
}

export function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export interface ValidationResult<T> {
  ok: boolean;
  value?: T;
  error?: string;
}

export function validateText(
  value: unknown,
  options: { field: string; max: number; required?: boolean },
): ValidationResult<string> {
  const cleaned = typeof value === "string" ? value.trim() : "";
  if (!cleaned) {
    return options.required
      ? { ok: false, error: `${options.field} is required` }
      : { ok: true, value: "" };
  }
  if (cleaned.length > options.max) {
    return {
      ok: false,
      error: `${options.field} must be ${options.max} characters or fewer`,
    };
  }
  return { ok: true, value: cleaned };
}

/** Reject path separators, control characters, and traversal-only names. */
export function validateFileName(name: string): string | null {
  if (!name) return "File or folder name is required";
  if (name.length > LIMITS.fileName) {
    return `File or folder names must be ${LIMITS.fileName} characters or fewer`;
  }
  if (/[/\\]/.test(name)) {
    return "File or folder names cannot contain / or \\";
  }
  if (/[\u0000-\u001f\u007f]/.test(name)) {
    return "File or folder names cannot contain control characters";
  }
  if (name === "." || name === "..") {
    return "Invalid file or folder name";
  }
  return null;
}

export function validateRoomCodeInput(code: string): boolean {
  return /^[A-Za-z0-9_-]{4,16}$/.test(code);
}
