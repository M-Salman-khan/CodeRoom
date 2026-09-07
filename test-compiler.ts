import http from "http";

const BASE_URL = "http://localhost:3000";

function request(
  method: string,
  path: string,
  body?: any
): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const postData = body ? JSON.stringify(body) : "";

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (postData) {
      headers["Content-Length"] = Buffer.byteLength(postData).toString();
    }

    const req = http.request(
      url,
      {
        method,
        headers,
      },
      (res) => {
        let rawData = "";
        res.on("data", (chunk) => {
          rawData += chunk;
        });
        res.on("end", () => {
          let data: any = rawData;
          try {
            data = JSON.parse(rawData);
          } catch {}
          resolve({
            status: res.statusCode || 0,
            data,
          });
        });
      }
    );

    req.on("error", (err) => reject(err));

    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

async function runTests() {
  console.log("=================================================");
  console.log("🧪 Starting CodeRoom Compiler & Execution Test Suite");
  console.log("=================================================\n");

  let testPassed = 0;
  let testFailed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      testPassed++;
    } else {
      console.error(`❌ FAIL: ${testName}`);
      testFailed++;
    }
  }

  // Test 1: GET /api/compile/languages
  console.log("--- 1. Testing Supported Languages API ---");
  const langsRes = await request("GET", "/api/compile/languages");
  assert(langsRes.status === 200, "GET /api/compile/languages returns 200 OK");
  assert(Array.isArray(langsRes.data.languages), "Returns languages array");
  assert(langsRes.data.languages.length >= 10, `Found ${langsRes.data.languages.length} supported languages`);

  const langIds = langsRes.data.languages.map((l: any) => l.id);
  const requiredLangs = ["python", "javascript", "typescript", "cpp", "c", "java", "shell", "rust", "go"];
  const allPresent = requiredLangs.every((l) => langIds.includes(l));
  assert(allPresent, `All core languages supported: ${requiredLangs.join(", ")}`);

  // Test 2: POST /api/compile with Python 3
  console.log("\n--- 2. Testing Python 3 Execution ---");
  const pyRes = await request("POST", "/api/compile", {
    code: 'print("Hello from CodeRoom Compiler!")\nprint(40 + 2)',
    language: "python",
  });
  assert(pyRes.status === 200, "Python compile request returns 200 OK");
  assert(pyRes.data.result.status === "success", "Python execution status is 'success'");
  assert(pyRes.data.result.stdout.includes("Hello from CodeRoom Compiler!"), "Python stdout contains expected message");
  assert(pyRes.data.result.stdout.includes("42"), "Python math evaluation output is 42");
  assert(pyRes.data.result.exitCode === 0, "Python exit code is 0");
  assert(typeof pyRes.data.result.executionTimeMs === "number", `Execution time recorded: ${pyRes.data.result.executionTimeMs}ms`);

  // Test 3: Stdin handling with Python
  console.log("\n--- 3. Testing Standard Input (stdin) ---");
  const stdinRes = await request("POST", "/api/compile", {
    code: 'import sys\nname = sys.stdin.readline().strip()\nprint(f"Welcome, {name}!")',
    language: "python",
    stdin: "Salman Khan\n",
  });
  assert(stdinRes.status === 200, "Stdin request returns 200 OK");
  assert(stdinRes.data.result.stdout.trim() === "Welcome, Salman Khan!", "Program read and processed stdin accurately");

  // Test 4: JavaScript (Node.js) execution
  console.log("\n--- 4. Testing JavaScript (Node.js) ---");
  const jsRes = await request("POST", "/api/compile", {
    code: 'const nums = [1, 2, 3, 4, 5]; console.log("Sum:", nums.reduce((a, b) => a + b, 0));',
    language: "javascript",
  });
  assert(jsRes.status === 200, "JS compile request returns 200 OK");
  assert(jsRes.data.result.status === "success", "JS execution status is 'success'");
  assert(jsRes.data.result.stdout.includes("Sum: 15"), "JS array sum is 15");

  // Test 5: TypeScript (tsx) execution
  console.log("\n--- 5. Testing TypeScript (tsx) ---");
  const tsRes = await request("POST", "/api/compile", {
    code: 'interface Greeting { msg: string }; const g: Greeting = { msg: "TS Interface Works" }; console.log(g.msg);',
    language: "typescript",
  });
  assert(tsRes.status === 200, "TS compile request returns 200 OK");
  assert(tsRes.data.result.status === "success", "TS execution status is 'success'");
  assert(tsRes.data.result.stdout.includes("TS Interface Works"), "TS interface compilation and execution verified");

  // Test 6: C++ (g++) compilation & execution
  console.log("\n--- 6. Testing C++ (g++) Compilation & Execution ---");
  const cppRes = await request("POST", "/api/compile", {
    code: '#include <iostream>\nint main() {\n    std::cout << "C++ Output: " << (100 * 2) << std::endl;\n    return 0;\n}',
    language: "cpp",
  });
  assert(cppRes.status === 200, "C++ compile request returns 200 OK");
  assert(cppRes.data.result.status === "success", "C++ compilation and run succeeded");
  assert(cppRes.data.result.stdout.includes("C++ Output: 200"), "C++ compiled binary output verified");

  // Test 7: C (gcc) compilation & execution
  console.log("\n--- 7. Testing C (gcc) Compilation & Execution ---");
  const cRes = await request("POST", "/api/compile", {
    code: '#include <stdio.h>\nint main() {\n    printf("C Language Output: %d\\n", 77);\n    return 0;\n}',
    language: "c",
  });
  assert(cRes.status === 200, "C compile request returns 200 OK");
  assert(cRes.data.result.status === "success", "C compilation and run succeeded");
  assert(cRes.data.result.stdout.includes("C Language Output: 77"), "C compiled binary output verified");

  // Test 8: Java (OpenJDK) compilation & execution
  console.log("\n--- 8. Testing Java (OpenJDK) ---");
  const javaRes = await request("POST", "/api/compile", {
    code: 'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Java OpenJDK Execution Success");\n    }\n}',
    language: "java",
  });
  assert(javaRes.status === 200, "Java compile request returns 200 OK");
  assert(javaRes.data.result.status === "success", "Java compilation and run succeeded");
  assert(javaRes.data.result.stdout.includes("Java OpenJDK Execution Success"), "Java stdout verified");

  // Test 9: Compilation / Syntax Error Handling
  console.log("\n--- 9. Testing Error Diagnostics ---");
  const errRes = await request("POST", "/api/compile", {
    code: '#include <iostream>\nint main() { INVALID_SYNTAX_ERROR; return 0; }',
    language: "cpp",
  });
  assert(errRes.status === 200, "Compiler error request returns 200 with error diagnosis");
  assert(
    errRes.data.result.status === "compilation_error" || errRes.data.result.status === "error",
    "Properly flagged as compilation_error / error"
  );
  assert(Boolean(errRes.data.result.stderr || errRes.data.result.compileOutput), "Compiler diagnostics returned in response");

  // Test 10: Infinite Loop Timeout Protection
  console.log("\n--- 10. Testing Infinite Loop Timeout Protection ---");
  const timeoutStart = Date.now();
  const timeoutRes = await request("POST", "/api/compile", {
    code: "while True:\n    pass",
    language: "python",
    timeoutMs: 2500, // 2.5s timeout
  });
  const timeoutDuration = Date.now() - timeoutStart;
  assert(timeoutRes.status === 200, "Timeout request returns 200 OK");
  assert(timeoutRes.data.result.status === "timeout", "Infinite loop was safely terminated with status 'timeout'");
  assert(timeoutDuration >= 2000 && timeoutDuration <= 5000, `Process killed after ~2.5s (took ${timeoutDuration}ms)`);

  console.log("\n=================================================");
  console.log(`📊 Compiler Test Summary: ${testPassed} Passed, ${testFailed} Failed`);
  console.log("=================================================");

  if (testFailed > 0) {
    process.exit(1);
  } else {
    console.log("🎉 ALL COMPILER TESTS PASSED SUCCESSFULLY!");
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
