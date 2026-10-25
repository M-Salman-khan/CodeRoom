/**
 * Type-only mirror of the server's compiler service contract.
 *
 * The standalone compiler lives on the Express server (`server/src/services/compiler.ts`)
 * and must never be bundled into the browser. These interfaces describe the JSON
 * payloads returned by `GET /api/compile/languages` and `POST /api/compile`.
 */

export interface SupportedLanguage {
  id: string;
  name: string;
  aliases: string[];
  extensions: string[];
  monacoLanguage: string;
  isLocalAvailable: boolean;
  isCloudAvailable: boolean;
  localCompiler?: string;
  cloudLanguageId?: number;
  sampleCode: string;
}

export interface ExecutionResult {
  stdout: string;
  stderr: string;
  compileOutput?: string;
  exitCode: number | null;
  executionTimeMs: number;
  status: "success" | "error" | "timeout" | "compilation_error";
  engine: "local" | "cloud";
  runtime: string;
  language: string;
}
