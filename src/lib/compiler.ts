import { spawn, execSync } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";

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

export interface RunOptions {
  code: string;
  language: string;
  stdin?: string;
  filename?: string;
  preferEngine?: "auto" | "local" | "cloud";
  timeoutMs?: number;
}

// Check which compilers are installed locally
function isCommandAvailable(command: string): boolean {
  try {
    execSync(`which ${command} 2>/dev/null`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

// Cache local tool availability
let localAvailabilityChecked = false;
let hasPython3 = false;
let hasNode = false;
let hasTsx = false;
let hasGcc = false;
let hasGpp = false;
let hasJavac = false;
let hasBash = false;
let hasPerl = false;

function checkLocalTools() {
  if (localAvailabilityChecked) return;
  hasPython3 = isCommandAvailable("python3");
  hasNode = isCommandAvailable("node");
  hasTsx = fs.existsSync(path.resolve(process.cwd(), "node_modules/.bin/tsx")) || isCommandAvailable("tsx");
  hasGcc = isCommandAvailable("gcc");
  hasGpp = isCommandAvailable("g++");
  hasJavac = isCommandAvailable("javac") && isCommandAvailable("java");
  hasBash = isCommandAvailable("bash");
  hasPerl = isCommandAvailable("perl");
  localAvailabilityChecked = true;
}

export const SUPPORTED_LANGUAGES_CATALOG: Omit<SupportedLanguage, "isLocalAvailable">[] = [
  {
    id: "python",
    name: "Python 3",
    aliases: ["python3", "py"],
    extensions: [".py"],
    monacoLanguage: "python",
    isCloudAvailable: true,
    cloudLanguageId: 109, // Python 3.13
    localCompiler: "python3",
    sampleCode: `# Python 3 Program\nimport sys\n\ndef main():\n    name = sys.stdin.readline().strip() or "World"\n    print(f"Hello, {name} from Python!")\n    print("Execution successful.")\n\nif __name__ == "__main__":\n    main()\n`,
  },
  {
    id: "javascript",
    name: "JavaScript (Node.js)",
    aliases: ["js", "node"],
    extensions: [".js", ".mjs", ".cjs"],
    monacoLanguage: "javascript",
    isCloudAvailable: true,
    cloudLanguageId: 102, // Node.js 22
    localCompiler: "node",
    sampleCode: `// JavaScript (Node.js) Program\nconst fs = require('fs');\n\nconst input = fs.readFileSync(0, 'utf-8').trim() || 'World';\nconsole.log(\`Hello, \${input} from JavaScript (Node.js)!\`);\nconsole.log("Current timestamp:", new Date().toISOString());\n`,
  },
  {
    id: "typescript",
    name: "TypeScript (tsx)",
    aliases: ["ts"],
    extensions: [".ts", ".tsx"],
    monacoLanguage: "typescript",
    isCloudAvailable: true,
    cloudLanguageId: 101, // TS 5.6
    localCompiler: "tsx",
    sampleCode: `// TypeScript Program\ninterface Message {\n  to: string;\n  content: string;\n  timestamp: number;\n}\n\nconst greet = (name: string): Message => ({\n  to: name,\n  content: \`Hello, \${name} from TypeScript!\`,\n  timestamp: Date.now(),\n});\n\nconsole.log(greet("Developer"));\n`,
  },
  {
    id: "cpp",
    name: "C++ (g++ 17)",
    aliases: ["c++", "cxx", "cc"],
    extensions: [".cpp", ".cc", ".cxx", ".hpp", ".h"],
    monacoLanguage: "cpp",
    isCloudAvailable: true,
    cloudLanguageId: 105, // C++ GCC 14
    localCompiler: "g++",
    sampleCode: `// C++17 Program\n#include <iostream>\n#include <string>\n#include <vector>\n\nint main() {\n    std::string name;\n    if (std::cin >> name) {\n        std::cout << "Hello, " << name << " from C++17!" << std::endl;\n    } else {\n        std::cout << "Hello, World from C++17!" << std::endl;\n    }\n    std::vector<int> nums = {1, 2, 3, 4, 5};\n    int sum = 0;\n    for (int n : nums) sum += n;\n    std::cout << "Sum of 1..5 is " << sum << std::endl;\n    return 0;\n}\n`,
  },
  {
    id: "c",
    name: "C (gcc)",
    aliases: ["clang"],
    extensions: [".c", ".h"],
    monacoLanguage: "c",
    isCloudAvailable: true,
    cloudLanguageId: 103, // C GCC 14
    localCompiler: "gcc",
    sampleCode: `// C Program\n#include <stdio.h>\n#include <stdlib.h>\n\nint main() {\n    char name[64];\n    if (scanf("%63s", name) == 1) {\n        printf("Hello, %s from C!\\n", name);\n    } else {\n        printf("Hello, World from C!\\n");\n    }\n    return 0;\n}\n`,
  },
  {
    id: "java",
    name: "Java (OpenJDK 21)",
    aliases: ["openjdk"],
    extensions: [".java"],
    monacoLanguage: "java",
    isCloudAvailable: true,
    cloudLanguageId: 91, // Java JDK 17
    localCompiler: "javac",
    sampleCode: `// Java Program\nimport java.util.Scanner;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner scanner = new Scanner(System.in);\n        String name = scanner.hasNextLine() ? scanner.nextLine().trim() : "";\n        if (name.isEmpty()) name = "World";\n        System.out.println("Hello, " + name + " from Java!");\n        System.out.println("Java Version: " + System.getProperty("java.version"));\n        scanner.close();\n    }\n}\n`,
  },
  {
    id: "shell",
    name: "Bash (Shell)",
    aliases: ["bash", "sh", "zsh"],
    extensions: [".sh", ".bash"],
    monacoLanguage: "shell",
    isCloudAvailable: true,
    cloudLanguageId: 46, // Bash
    localCompiler: "bash",
    sampleCode: `#!/usr/bin/env bash\necho "Hello from Bash!"\necho "Current user: $(whoami 2>/dev/null || echo user)"\necho "Date: $(date)"\n`,
  },
  {
    id: "rust",
    name: "Rust",
    aliases: ["rs"],
    extensions: [".rs"],
    monacoLanguage: "rust",
    isCloudAvailable: true,
    cloudLanguageId: 108, // Rust 1.85
    localCompiler: "rustc",
    sampleCode: `// Rust Program\nuse std::io::{self, Read};\n\nfn main() {\n    let mut input = String::new();\n    let _ = io::stdin().read_to_string(&mut input);\n    let name = if input.trim().is_empty() { "World" } else { input.trim() };\n    println!("Hello, {} from Rust!", name);\n}\n`,
  },
  {
    id: "go",
    name: "Go",
    aliases: ["golang"],
    extensions: [".go"],
    monacoLanguage: "go",
    isCloudAvailable: true,
    cloudLanguageId: 107, // Go 1.23
    localCompiler: "go",
    sampleCode: `// Go Program\npackage main\n\nimport (\n    "bufio"\n    "fmt"\n    "os"\n    "strings"\n)\n\nfunc main() {\n    reader := bufio.NewReader(os.Stdin)\n    name, _ := reader.ReadString('\\n')\n    name = strings.TrimSpace(name)\n    if name == "" {\n        name = "World"\n    }\n    fmt.Printf("Hello, %s from Go!\\n", name)\n}\n`,
  },
  {
    id: "csharp",
    name: "C# (.NET / Mono)",
    aliases: ["cs", "dotnet"],
    extensions: [".cs"],
    monacoLanguage: "csharp",
    isCloudAvailable: true,
    cloudLanguageId: 51,
    sampleCode: `using System;\n\nclass Program {\n    static void Main() {\n        string input = Console.ReadLine();\n        string name = string.IsNullOrWhiteSpace(input) ? "World" : input.Trim();\n        Console.WriteLine($"Hello, {name} from C#!");\n    }\n}\n`,
  },
  {
    id: "php",
    name: "PHP",
    aliases: [],
    extensions: [".php"],
    monacoLanguage: "php",
    isCloudAvailable: true,
    cloudLanguageId: 98,
    sampleCode: `<?php\n$input = trim(fgets(STDIN));\n$name = !empty($input) ? $input : "World";\necho "Hello, " . $name . " from PHP!\\n";\n`,
  },
  {
    id: "ruby",
    name: "Ruby",
    aliases: ["rb"],
    extensions: [".rb"],
    monacoLanguage: "ruby",
    isCloudAvailable: true,
    cloudLanguageId: 72,
    sampleCode: `# Ruby Program\ninput = STDIN.gets&.strip\nname = input.nil? || input.empty? ? "World" : input\nputs "Hello, #{name} from Ruby!"\n`,
  },
  {
    id: "kotlin",
    name: "Kotlin",
    aliases: ["kt"],
    extensions: [".kt", ".kts"],
    monacoLanguage: "kotlin",
    isCloudAvailable: true,
    cloudLanguageId: 111,
    sampleCode: `import java.util.Scanner\n\nfun main() {\n    val scanner = Scanner(System.\`in\`)\n    val name = if (scanner.hasNextLine()) scanner.nextLine().trim() else "World"\n    println("Hello, $name from Kotlin!")\n}\n`,
  },
  {
    id: "swift",
    name: "Swift",
    aliases: [],
    extensions: [".swift"],
    monacoLanguage: "swift",
    isCloudAvailable: true,
    cloudLanguageId: 83,
    sampleCode: `import Foundation\n\nlet input = readLine()?.trimmingCharacters(in: .whitespacesAndNewlines)\nlet name = (input == nil || input!.isEmpty) ? "World" : input!\nprint("Hello, \\(name) from Swift!")\n`,
  },
  {
    id: "perl",
    name: "Perl",
    aliases: ["pl"],
    extensions: [".pl"],
    monacoLanguage: "perl",
    isCloudAvailable: true,
    cloudLanguageId: 85,
    localCompiler: "perl",
    sampleCode: `#!/usr/bin/env perl\nuse strict;\nuse warnings;\nmy $input = <STDIN>;\nchomp($input) if defined $input;\nmy $name = ($input && length($input) > 0) ? $input : "World";\nprint "Hello, $name from Perl!\\n";\n`,
  },
];

export function getSupportedLanguages(): SupportedLanguage[] {
  checkLocalTools();

  return SUPPORTED_LANGUAGES_CATALOG.map((lang) => {
    let isLocal = false;
    if (lang.id === "python") isLocal = hasPython3;
    else if (lang.id === "javascript") isLocal = hasNode;
    else if (lang.id === "typescript") isLocal = hasTsx;
    else if (lang.id === "cpp") isLocal = hasGpp;
    else if (lang.id === "c") isLocal = hasGcc;
    else if (lang.id === "java") isLocal = hasJavac;
    else if (lang.id === "shell") isLocal = hasBash;
    else if (lang.id === "perl") isLocal = hasPerl;

    return {
      ...lang,
      isLocalAvailable: isLocal,
    };
  });
}

export function resolveLanguage(langQuery?: string, filename?: string): SupportedLanguage {
  const catalog = getSupportedLanguages();

  // 1. Try filename extension match
  if (filename) {
    const ext = "." + (filename.split(".").pop() || "").toLowerCase();
    const byExt = catalog.find((l) => l.extensions.includes(ext));
    if (byExt) return byExt;
  }

  // 2. Try language query match (Exact matches first, then prefix)
  if (langQuery) {
    const q = langQuery.toLowerCase().trim();

    // Priority 1: Exact matches
    const exact = catalog.find(
      (l) =>
        l.id === q ||
        l.monacoLanguage === q ||
        l.aliases.some((a) => a.toLowerCase() === q) ||
        l.name.toLowerCase() === q
    );
    if (exact) return exact;

    // Priority 2: Prefix matches
    const prefix = catalog.find(
      (l) =>
        l.id.startsWith(q) ||
        l.aliases.some((a) => a.toLowerCase().startsWith(q)) ||
        l.name.toLowerCase().startsWith(q)
    );
    if (prefix) return prefix;
  }

  // Default fallback to Python or JavaScript
  return catalog[0];
}

// Spawn process with timeout and stdin
interface SpawnExecutionOptions {
  cmd: string;
  args: string[];
  cwd: string;
  stdin?: string;
  timeoutMs: number;
}

interface ProcessOutput {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
  durationMs: number;
}

function runProcess({ cmd, args, cwd, stdin, timeoutMs }: SpawnExecutionOptions): Promise<ProcessOutput> {
  return new Promise((resolve) => {
    const startTime = Date.now();
    let stdoutData = "";
    let stderrData = "";
    let timedOut = false;
    let finished = false;

    const MAX_BUFFER = 512 * 1024; // 512KB max output buffer

    let child;
    try {
      child = spawn(cmd, args, {
        cwd,
        env: {
          ...process.env,
          NODE_ENV: "production",
          PYTHONUNBUFFERED: "1",
        },
      });
    } catch (err: unknown) {
      const durationMs = Date.now() - startTime;
      const errorMsg = err instanceof Error ? err.message : String(err);
      return resolve({
        stdout: "",
        stderr: `Failed to spawn process (${cmd}): ${errorMsg}`,
        exitCode: 1,
        timedOut: false,
        durationMs,
      });
    }

    const timer = setTimeout(() => {
      timedOut = true;
      try {
        child.kill("SIGKILL");
      } catch {}
    }, timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      if (stdoutData.length < MAX_BUFFER) {
        stdoutData += chunk.toString("utf-8");
        if (stdoutData.length >= MAX_BUFFER) {
          stdoutData += "\n[Output truncated: Exceeded 512KB buffer limit]";
          try {
            child.kill("SIGKILL");
          } catch {}
        }
      }
    });

    child.stderr.on("data", (chunk: Buffer) => {
      if (stderrData.length < MAX_BUFFER) {
        stderrData += chunk.toString("utf-8");
        if (stderrData.length >= MAX_BUFFER) {
          stderrData += "\n[Stderr truncated: Exceeded 512KB buffer limit]";
        }
      }
    });

    if (stdin && child.stdin) {
      try {
        child.stdin.write(stdin);
        child.stdin.end();
      } catch {}
    } else if (child.stdin) {
      try {
        child.stdin.end();
      } catch {}
    }

    child.on("error", (err) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      const durationMs = Date.now() - startTime;
      resolve({
        stdout: stdoutData,
        stderr: stderrData + `\nProcess error: ${err.message}`,
        exitCode: 1,
        timedOut,
        durationMs,
      });
    });

    child.on("close", (code) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      const durationMs = Date.now() - startTime;
      resolve({
        stdout: stdoutData,
        stderr: stderrData,
        exitCode: code,
        timedOut,
        durationMs,
      });
    });
  });
}

// Local Execution Runner
async function executeLocally(
  lang: SupportedLanguage,
  code: string,
  stdin?: string,
  timeoutMs: number = 8000
): Promise<ExecutionResult> {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "coderoom-exec-"));

  try {
    switch (lang.id) {
      case "python": {
        const scriptPath = path.join(tempDir, "script.py");
        fs.writeFileSync(scriptPath, code);
        const res = await runProcess({
          cmd: "python3",
          args: ["-u", "script.py"],
          cwd: tempDir,
          stdin,
          timeoutMs,
        });
        return {
          stdout: res.stdout,
          stderr: res.stderr,
          exitCode: res.exitCode,
          executionTimeMs: res.durationMs,
          status: res.timedOut ? "timeout" : res.exitCode === 0 ? "success" : "error",
          engine: "local",
          runtime: "Local Python 3 (python3)",
          language: lang.id,
        };
      }

      case "javascript": {
        const scriptPath = path.join(tempDir, "script.js");
        fs.writeFileSync(scriptPath, code);
        const res = await runProcess({
          cmd: "node",
          args: ["script.js"],
          cwd: tempDir,
          stdin,
          timeoutMs,
        });
        return {
          stdout: res.stdout,
          stderr: res.stderr,
          exitCode: res.exitCode,
          executionTimeMs: res.durationMs,
          status: res.timedOut ? "timeout" : res.exitCode === 0 ? "success" : "error",
          engine: "local",
          runtime: "Local Node.js (node)",
          language: lang.id,
        };
      }

      case "typescript": {
        const scriptPath = path.join(tempDir, "script.ts");
        fs.writeFileSync(scriptPath, code);
        const tsxBin = path.resolve(process.cwd(), "node_modules/.bin/tsx");
        const cmd = fs.existsSync(tsxBin) ? tsxBin : "tsx";
        const res = await runProcess({
          cmd,
          args: ["script.ts"],
          cwd: tempDir,
          stdin,
          timeoutMs,
        });
        return {
          stdout: res.stdout,
          stderr: res.stderr,
          exitCode: res.exitCode,
          executionTimeMs: res.durationMs,
          status: res.timedOut ? "timeout" : res.exitCode === 0 ? "success" : "error",
          engine: "local",
          runtime: "Local TypeScript (tsx)",
          language: lang.id,
        };
      }

      case "cpp": {
        const srcPath = path.join(tempDir, "main.cpp");
        fs.writeFileSync(srcPath, code);
        // Step 1: Compile with g++
        const compileRes = await runProcess({
          cmd: "g++",
          args: ["-O2", "-std=c++17", "main.cpp", "-o", "main"],
          cwd: tempDir,
          timeoutMs: 10000,
        });

        if (compileRes.exitCode !== 0 || compileRes.timedOut) {
          return {
            stdout: "",
            stderr: compileRes.stderr,
            compileOutput: compileRes.stderr || "Compilation failed",
            exitCode: compileRes.exitCode,
            executionTimeMs: compileRes.durationMs,
            status: compileRes.timedOut ? "timeout" : "compilation_error",
            engine: "local",
            runtime: "Local C++ (g++)",
            language: lang.id,
          };
        }

        // Step 2: Run executable
        const runRes = await runProcess({
          cmd: "./main",
          args: [],
          cwd: tempDir,
          stdin,
          timeoutMs,
        });

        return {
          stdout: runRes.stdout,
          stderr: runRes.stderr,
          exitCode: runRes.exitCode,
          executionTimeMs: compileRes.durationMs + runRes.durationMs,
          status: runRes.timedOut ? "timeout" : runRes.exitCode === 0 ? "success" : "error",
          engine: "local",
          runtime: "Local C++17 (g++)",
          language: lang.id,
        };
      }

      case "c": {
        const srcPath = path.join(tempDir, "main.c");
        fs.writeFileSync(srcPath, code);
        // Step 1: Compile with gcc
        const compileRes = await runProcess({
          cmd: "gcc",
          args: ["-O2", "main.c", "-o", "main"],
          cwd: tempDir,
          timeoutMs: 10000,
        });

        if (compileRes.exitCode !== 0 || compileRes.timedOut) {
          return {
            stdout: "",
            stderr: compileRes.stderr,
            compileOutput: compileRes.stderr || "Compilation failed",
            exitCode: compileRes.exitCode,
            executionTimeMs: compileRes.durationMs,
            status: compileRes.timedOut ? "timeout" : "compilation_error",
            engine: "local",
            runtime: "Local C (gcc)",
            language: lang.id,
          };
        }

        // Step 2: Run executable
        const runRes = await runProcess({
          cmd: "./main",
          args: [],
          cwd: tempDir,
          stdin,
          timeoutMs,
        });

        return {
          stdout: runRes.stdout,
          stderr: runRes.stderr,
          exitCode: runRes.exitCode,
          executionTimeMs: compileRes.durationMs + runRes.durationMs,
          status: runRes.timedOut ? "timeout" : runRes.exitCode === 0 ? "success" : "error",
          engine: "local",
          runtime: "Local C (gcc)",
          language: lang.id,
        };
      }

      case "java": {
        // Look for public class name in code, default to Main
        const match = code.match(/public\s+class\s+([A-Za-z0-9_$]+)/);
        const className = match ? match[1] : "Main";
        const srcPath = path.join(tempDir, `${className}.java`);
        fs.writeFileSync(srcPath, code);

        // Step 1: Compile with javac
        const compileRes = await runProcess({
          cmd: "javac",
          args: [`${className}.java`],
          cwd: tempDir,
          timeoutMs: 10000,
        });

        if (compileRes.exitCode !== 0 || compileRes.timedOut) {
          return {
            stdout: "",
            stderr: compileRes.stderr,
            compileOutput: compileRes.stderr || "Java compilation failed",
            exitCode: compileRes.exitCode,
            executionTimeMs: compileRes.durationMs,
            status: compileRes.timedOut ? "timeout" : "compilation_error",
            engine: "local",
            runtime: "Local Java (javac 21)",
            language: lang.id,
          };
        }

        // Step 2: Run with java
        const runRes = await runProcess({
          cmd: "java",
          args: [className],
          cwd: tempDir,
          stdin,
          timeoutMs,
        });

        return {
          stdout: runRes.stdout,
          stderr: runRes.stderr,
          exitCode: runRes.exitCode,
          executionTimeMs: compileRes.durationMs + runRes.durationMs,
          status: runRes.timedOut ? "timeout" : runRes.exitCode === 0 ? "success" : "error",
          engine: "local",
          runtime: "Local Java (OpenJDK 21)",
          language: lang.id,
        };
      }

      case "shell": {
        const scriptPath = path.join(tempDir, "script.sh");
        fs.writeFileSync(scriptPath, code);
        const res = await runProcess({
          cmd: "bash",
          args: ["script.sh"],
          cwd: tempDir,
          stdin,
          timeoutMs,
        });
        return {
          stdout: res.stdout,
          stderr: res.stderr,
          exitCode: res.exitCode,
          executionTimeMs: res.durationMs,
          status: res.timedOut ? "timeout" : res.exitCode === 0 ? "success" : "error",
          engine: "local",
          runtime: "Local Bash Shell",
          language: lang.id,
        };
      }

      case "perl": {
        const scriptPath = path.join(tempDir, "script.pl");
        fs.writeFileSync(scriptPath, code);
        const res = await runProcess({
          cmd: "perl",
          args: ["script.pl"],
          cwd: tempDir,
          stdin,
          timeoutMs,
        });
        return {
          stdout: res.stdout,
          stderr: res.stderr,
          exitCode: res.exitCode,
          executionTimeMs: res.durationMs,
          status: res.timedOut ? "timeout" : res.exitCode === 0 ? "success" : "error",
          engine: "local",
          runtime: "Local Perl",
          language: lang.id,
        };
      }

      default:
        throw new Error(`Local execution not implemented for language: ${lang.id}`);
    }
  } finally {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  }
}

// Cloud Execution via Judge0 CE API
async function executeCloud(
  lang: SupportedLanguage,
  code: string,
  stdin?: string
): Promise<ExecutionResult> {
  const cloudLangId = lang.cloudLanguageId;
  if (!cloudLangId) {
    throw new Error(`No cloud compiler configuration available for ${lang.name}`);
  }

  const startTime = Date.now();
  const res = await fetch("https://ce.judge0.com/submissions?base64_encoded=false&wait=true", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      source_code: code,
      language_id: cloudLangId,
      stdin: stdin || "",
    }),
  });

  const durationMs = Date.now() - startTime;

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Judge0 Cloud API returned status ${res.status}: ${errorText}`);
  }

  const data = await res.json();
  const stdout = data.stdout || "";
  const stderr = data.stderr || "";
  const compileOutput = data.compile_output || undefined;
  const statusDesc = data.status?.description || "Unknown";
  const statusId = data.status?.id;

  let executionStatus: ExecutionResult["status"] = "success";
  if (statusId === 3) {
    executionStatus = "success"; // Accepted
  } else if (statusId === 5) {
    executionStatus = "timeout"; // Time Limit Exceeded
  } else if (statusId === 6) {
    executionStatus = "compilation_error"; // Compilation Error
  } else {
    executionStatus = "error";
  }

  return {
    stdout,
    stderr: stderr || (statusId !== 3 && statusDesc !== "Accepted" ? `Status: ${statusDesc}` : ""),
    compileOutput,
    exitCode: data.exit_code !== undefined ? data.exit_code : statusId === 3 ? 0 : 1,
    executionTimeMs: data.time ? Math.round(parseFloat(data.time) * 1000) : durationMs,
    status: executionStatus,
    engine: "cloud",
    runtime: `Cloud Sandbox (${lang.name})`,
    language: lang.id,
  };
}

// Unified Execution Entry Point
export async function executeCode(options: RunOptions): Promise<ExecutionResult> {
  const { code, language, stdin, filename, preferEngine = "auto", timeoutMs = 8000 } = options;

  if (!code || code.trim().length === 0) {
    return {
      stdout: "",
      stderr: "No code provided to execute.",
      exitCode: 1,
      executionTimeMs: 0,
      status: "error",
      engine: "local",
      runtime: "System",
      language: language || "plaintext",
    };
  }

  const langConfig = resolveLanguage(language, filename);
  const shouldTryLocal =
    preferEngine === "local" ||
    (preferEngine === "auto" && langConfig.isLocalAvailable);

  if (shouldTryLocal && langConfig.isLocalAvailable) {
    try {
      return await executeLocally(langConfig, code, stdin, timeoutMs);
    } catch (err) {
      console.warn(`Local execution failed for ${langConfig.id}, attempting cloud fallback:`, err);
      if (langConfig.isCloudAvailable && preferEngine === "auto") {
        try {
          return await executeCloud(langConfig, code, stdin);
        } catch (cloudErr: unknown) {
          const cloudMsg = cloudErr instanceof Error ? cloudErr.message : String(cloudErr);
          const localMsg = err instanceof Error ? err.message : String(err);
          return {
            stdout: "",
            stderr: `Execution failed:\nLocal error: ${localMsg}\nCloud error: ${cloudMsg}`,
            exitCode: 1,
            executionTimeMs: 0,
            status: "error",
            engine: "local",
            runtime: langConfig.name,
            language: langConfig.id,
          };
        }
      }
      throw err;
    }
  }

  // Cloud execution
  if (langConfig.isCloudAvailable) {
    try {
      return await executeCloud(langConfig, code, stdin);
    } catch (cloudErr: unknown) {
      const cloudMsg = cloudErr instanceof Error ? cloudErr.message : String(cloudErr);
      return {
        stdout: "",
        stderr: `Cloud execution failed: ${cloudMsg}\n(Note: If offline or on isolated LAN, ensure local runtimes like python3, node, gcc are installed on the server.)`,
        exitCode: 1,
        executionTimeMs: 0,
        status: "error",
        engine: "cloud",
        runtime: langConfig.name,
        language: langConfig.id,
      };
    }
  }

  return {
    stdout: "",
    stderr: `Language "${langConfig.name}" is not supported for execution on this host.`,
    exitCode: 1,
    executionTimeMs: 0,
    status: "error",
    engine: "local",
    runtime: langConfig.name,
    language: langConfig.id,
  };
}
