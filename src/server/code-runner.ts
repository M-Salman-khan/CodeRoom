import { ChildProcess, spawn } from "child_process";
import fs from "fs/promises";
import path from "path";
import os from "os";

export interface ExecutionState {
  isRunning: boolean;
  userId: string | null;
  username: string | null;
  fileId: string | null;
  fileName: string | null;
  startTime: number | null;
  process?: ChildProcess | null;
  output?: string;
}

export interface ExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  executionTimeMs: number;
  error?: string;
  killed?: boolean;
}

// Map of roomId -> ExecutionState (Ensures strictly ONE runner per room at any time across server and API route bundles)
const globalForRunner = globalThis as unknown as {
  __roomExecutions?: Map<string, ExecutionState>;
};
export const roomExecutions: Map<string, ExecutionState> =
  globalForRunner.__roomExecutions || (globalForRunner.__roomExecutions = new Map<string, ExecutionState>());

export function getRoomExecutionState(roomId: string): ExecutionState {
  const current = roomExecutions.get(roomId);
  if (current && current.isRunning) {
    return {
      isRunning: true,
      userId: current.userId,
      username: current.username,
      fileId: current.fileId,
      fileName: current.fileName,
      startTime: current.startTime,
    };
  }
  return {
    isRunning: false,
    userId: null,
    username: null,
    fileId: null,
    fileName: null,
    startTime: null,
  };
}

export function isRoomExecuting(roomId: string): boolean {
  const current = roomExecutions.get(roomId);
  return Boolean(current && current.isRunning);
}

export function stopRoomExecution(
  roomId: string,
  requesterUserId: string,
  isOwner: boolean
): { success: boolean; message: string } {
  const current = roomExecutions.get(roomId);
  if (!current || !current.isRunning) {
    return { success: false, message: "No execution is currently running." };
  }

  // Only the user who started the run or the room owner can stop it
  if (current.userId !== requesterUserId && !isOwner) {
    return {
      success: false,
      message: "Only the runner or the room admin can stop the running program.",
    };
  }

  if (current.process && !current.process.killed) {
    try {
      current.process.kill("SIGKILL");
    } catch {}
  }

  roomExecutions.delete(roomId);
  return { success: true, message: "Execution stopped successfully." };
}

export async function runCodeWithLock(
  roomId: string,
  user: { id: string; username: string },
  fileId: string,
  fileName: string,
  code: string,
  onStart?: () => void,
  language?: string
): Promise<ExecutionResult> {
  // 1. Strict Mutex check: only ONE user can run at a time in a room
  const existing = roomExecutions.get(roomId);
  if (existing && existing.isRunning) {
    throw new Error(
      `A program is already running in this room by ${existing.username} (${existing.fileName}). Only one user can run at a time.`
    );
  }

  const startTime = Date.now();
  let tmpDir = "";
  let childProc: ChildProcess | null = null;

  try {
    // Acquire execution lock
    roomExecutions.set(roomId, {
      isRunning: true,
      userId: user.id,
      username: user.username,
      fileId,
      fileName,
      startTime,
      process: null,
    });

    if (onStart) onStart();

    // Prepare temporary directory
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "coderoom_exec_"));
    let ext = path.extname(fileName).toLowerCase();
    if (!ext || ext === ".txt") {
      const lang = (language || "").toLowerCase();
      if (lang === "typescript") ext = ".ts";
      else if (lang === "javascript") ext = ".js";
      else if (lang === "python") ext = ".py";
      else if (lang === "java") ext = ".java";
      else if (lang === "c") ext = ".c";
      else if (lang === "cpp") ext = ".cpp";
      else if (lang === "shell" || lang === "bash") ext = ".sh";
      else ext = ".ts";
    }

    const baseName = path.basename(fileName, path.extname(fileName)) || "Main";
    const srcPath = path.join(tmpDir, `${baseName}${ext}`);
    await fs.writeFile(srcPath, code, "utf-8");

    // Determine execution command based on file extension
    let cmd = "";
    let args: string[] = [];

    const projectRoot = process.cwd();
    const tsxBin = path.join(projectRoot, "node_modules", ".bin", "tsx");

    switch (ext) {
      case ".js":
      case ".mjs":
      case ".cjs": {
        cmd = "node";
        args = [srcPath];
        break;
      }

      case ".ts":
      case ".tsx":
      case ".jsx": {
        cmd = tsxBin;
        args = [srcPath];
        break;
      }

      case ".py": {
        cmd = "python3";
        args = ["-u", srcPath];
        break;
      }

      case ".java": {
        cmd = "java";
        args = [srcPath];
        break;
      }

      case ".c": {
        const binPath = path.join(tmpDir, "main_bin");
        // Compile first
        await new Promise<void>((resolve, reject) => {
          const comp = spawn("gcc", ["-O2", srcPath, "-o", binPath]);
          let compErr = "";
          comp.stderr.on("data", (d) => (compErr += d.toString()));
          comp.on("close", (code) => {
            if (code === 0) resolve();
            else reject(new Error(`Compilation error:\n${compErr}`));
          });
        });
        cmd = binPath;
        args = [];
        break;
      }

      case ".cpp":
      case ".cc":
      case ".cxx": {
        const binPath = path.join(tmpDir, "main_bin");
        // Compile first
        await new Promise<void>((resolve, reject) => {
          const comp = spawn("g++", ["-O2", srcPath, "-o", binPath]);
          let compErr = "";
          comp.stderr.on("data", (d) => (compErr += d.toString()));
          comp.on("close", (code) => {
            if (code === 0) resolve();
            else reject(new Error(`Compilation error:\n${compErr}`));
          });
        });
        cmd = binPath;
        args = [];
        break;
      }

      case ".sh": {
        cmd = "bash";
        args = [srcPath];
        break;
      }

      default:
        throw new Error(
          `Execution not supported for extension "${ext}". Supported: .js, .ts, .py, .java, .c, .cpp, .sh`
        );
    }

    // Execute with timeout and buffer caps
    const result = await new Promise<ExecutionResult>((resolve) => {
      let stdout = "";
      let stderr = "";
      let killed = false;
      const MAX_OUTPUT = 500 * 1024; // 500 KB limit

      childProc = spawn(cmd, args, {
        cwd: tmpDir,
        env: {
          PATH: process.env.PATH,
          HOME: tmpDir,
          NODE_ENV: "development",
        },
      });

      // Update room execution state with the running process
      const state = roomExecutions.get(roomId);
      if (state) state.process = childProc;

      // 10 second timeout
      const timeout = setTimeout(() => {
        killed = true;
        if (childProc && !childProc.killed) {
          try {
            childProc.kill("SIGKILL");
          } catch {}
        }
      }, 10000);

      childProc.stdout?.on("data", (chunk: Buffer) => {
        if (stdout.length < MAX_OUTPUT) {
          stdout += chunk.toString();
          if (stdout.length >= MAX_OUTPUT) {
            stdout += "\n[Output truncated: exceeded 500KB limit]";
          }
        }
      });

      childProc.stderr?.on("data", (chunk: Buffer) => {
        if (stderr.length < MAX_OUTPUT) {
          stderr += chunk.toString();
          if (stderr.length >= MAX_OUTPUT) {
            stderr += "\n[Error output truncated]";
          }
        }
      });

      childProc.on("close", (code) => {
        clearTimeout(timeout);
        const executionTimeMs = Date.now() - startTime;
        if (killed) {
          resolve({
            stdout,
            stderr: stderr + "\n[Execution terminated: 10s timeout exceeded]",
            exitCode: code ?? -1,
            executionTimeMs,
            killed: true,
            error: "Execution timed out (10s limit)",
          });
        } else {
          resolve({
            stdout,
            stderr,
            exitCode: code ?? 0,
            executionTimeMs,
          });
        }
      });

      childProc.on("error", (err) => {
        clearTimeout(timeout);
        resolve({
          stdout,
          stderr: stderr + `\nProcess error: ${err.message}`,
          exitCode: -1,
          executionTimeMs: Date.now() - startTime,
          error: err.message,
        });
      });
    });

    return result;
  } finally {
    // Release the execution lock
    roomExecutions.delete(roomId);

    // Clean up temporary files
    if (tmpDir) {
      try {
        await fs.rm(tmpDir, { recursive: true, force: true });
      } catch {}
    }
  }
}
