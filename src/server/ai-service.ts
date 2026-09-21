export interface AIAnalysisResult {
  title: string;
  summary: string;
  explanation: string;
  suggestedFix?: string;
  suggestedCode?: string;
  errorLine?: number | null;
  provider: "gemini" | "openai" | "heuristic";
  hasApiKey: boolean;
}

export interface AICodeReviewResult {
  summary: string;
  rating: string;
  issues: Array<{ severity: "error" | "warning" | "info"; message: string; line?: number }>;
  suggestions: string[];
  improvedCode?: string;
  provider: "gemini" | "openai" | "heuristic";
}

/**
 * Parses common compiler/runtime stack traces to find the culprit line number.
 */
function parseErrorLineNumber(errorText: string): number | null {
  // Python: File "main.py", line 4
  const pyMatch = errorText.match(/line\s+(\d+)/i);
  if (pyMatch) return parseInt(pyMatch[1], 10);

  // JS/TS: main.ts:4:12 or at main.ts:4:12
  const jsMatch = errorText.match(/:\s*(\d+):(?:\d+)/);
  if (jsMatch) return parseInt(jsMatch[1], 10);

  // GCC/G++: main.c:12:5: error
  const gccMatch = errorText.match(/:\s*(\d+):\d+:\s*(?:error|warning)/i);
  if (gccMatch) return parseInt(gccMatch[1], 10);

  return null;
}

/**
 * Built-in intelligent heuristic engine when no external API key is set.
 */
function heuristicErrorAnalysis(
  fileName: string,
  code: string,
  errorText: string
): AIAnalysisResult {
  const errorLine = parseErrorLineNumber(errorText);
  const codeLines = code.split("\n");
  const offendingLineText =
    errorLine && errorLine <= codeLines.length ? codeLines[errorLine - 1]?.trim() : "";

  let title = "Runtime / Compilation Error";
  let summary = "The program encountered an error during execution.";
  let explanation = errorText.trim();
  let suggestedFix = "";

  const lowerErr = errorText.toLowerCase();

  if (lowerErr.includes("syntaxerror")) {
    title = "Syntax Error Detected";
    summary = "There is a syntax mistake preventing the code from running.";
    suggestedFix =
      "Check for missing brackets (), curly braces {}, quotes '', or punctuation (semicolons/colons) on or before the indicated line.";
  } else if (lowerErr.includes("typeerror")) {
    title = "Type Error";
    summary = "An operation was performed on an inappropriate data type.";
    suggestedFix =
      "Ensure variables and functions are defined and not null/undefined before calling methods or accessing properties on them.";
  } else if (lowerErr.includes("referenceerror") || lowerErr.includes("nameerror")) {
    title = "Reference / Name Error";
    summary = "A variable or function was referenced before it was declared or defined.";
    suggestedFix =
      "Verify the variable spelling and make sure it is imported or declared in the current scope.";
  } else if (lowerErr.includes("zerodivisionerror") || lowerErr.includes("division by zero")) {
    title = "Division by Zero";
    summary = "An arithmetic division by zero occurred.";
    suggestedFix = "Add a guard condition to ensure denominator is not zero before dividing.";
  } else if (lowerErr.includes("indexerror") || lowerErr.includes("out of bounds")) {
    title = "Index Out of Bounds";
    summary = "Attempted to access an index outside the array/list length.";
    suggestedFix = "Check list/array bounds with length before accessing the element.";
  } else if (lowerErr.includes("indentationerror")) {
    title = "Python Indentation Error";
    summary = "Inconsistent or unexpected indentation detected.";
    suggestedFix =
      "Ensure uniform use of 2 or 4 spaces (avoid mixing tabs and spaces) inside blocks.";
  } else if (lowerErr.includes("segmentation fault")) {
    title = "Segmentation Fault (Memory Access Violation)";
    summary = "The program attempted to access an invalid memory address.";
    suggestedFix =
      "Check pointer dereferences, array buffer bounds, and ensure dynamically allocated memory is valid.";
  } else if (lowerErr.includes("compilation error")) {
    title = "Compilation Error";
    summary = "The C/C++ compiler could not compile the source file.";
    suggestedFix =
      "Review compiler diagnostic output above for missing header files, type mismatches, or missing semicolons.";
  }

  if (offendingLineText) {
    explanation += `\n\nOffending line ${errorLine}:\n\`${offendingLineText}\``;
  }

  return {
    title,
    summary,
    explanation,
    suggestedFix,
    errorLine,
    provider: "heuristic",
    hasApiKey: false,
  };
}

/**
 * Call Google Gemini API (gemini-1.5-flash or gemini-2.0-flash)
 */
async function callGemini(apiKey: string, prompt: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 2048,
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Empty response from Gemini");
  return text;
}

/**
 * Call OpenAI API (gpt-4o-mini)
 */
async function callOpenAI(apiKey: string, prompt: string): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are an expert AI software engineer and code reviewer embedded in a collaborative editor.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.2,
      max_tokens: 2048,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI API error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error("Empty response from OpenAI");
  return text;
}

/**
 * Analyze an execution error and provide intelligent explanations & fix recommendations.
 */
export async function analyzeErrorWithAI(
  fileName: string,
  code: string,
  errorText: string,
  stdout?: string
): Promise<AIAnalysisResult> {
  const geminiKey = process.env.GEMINI_API_KEY?.trim();
  const openaiKey = process.env.OPENAI_API_KEY?.trim();

  // If external AI key is available, use real LLM
  if (geminiKey || openaiKey) {
    const prompt = `You are an expert programming AI assistant in CodeRoom. A user ran the following file and encountered an execution error.

File Name: ${fileName}

Source Code:
\`\`\`
${code}
\`\`\`

Execution Error / Stderr:
\`\`\`
${errorText}
\`\`\`
${stdout ? `Stdout context:\n\`\`\`\n${stdout}\n\`\`\`\n` : ""}

Please analyze this error and provide:
1. Root Cause: Explain precisely why this error happened.
2. Culprit Line: Mention the line number(s) if applicable.
3. How to Fix: Explain the exact correction.
4. Corrected Code: Provide the complete fixed code block inside triple backticks (\`\`\`).

Keep your response concise, clear, and practical for developers.`;

    try {
      let aiResponse = "";
      let provider: "gemini" | "openai" = "gemini";

      if (geminiKey) {
        aiResponse = await callGemini(geminiKey, prompt);
        provider = "gemini";
      } else if (openaiKey) {
        aiResponse = await callOpenAI(openaiKey, prompt);
        provider = "openai";
      }

      // Extract suggested code block if present
      const codeBlockMatch = aiResponse.match(/```(?:\w+)?\n([\s\S]*?)```/);
      const suggestedCode = codeBlockMatch ? codeBlockMatch[1].trim() : undefined;
      const errorLine = parseErrorLineNumber(errorText);

      return {
        title: "AI Error Diagnosis & Fix Suggestion",
        summary: "AI has analyzed the stack trace and provided an explanation and fix.",
        explanation: aiResponse,
        suggestedFix: "See full AI diagnosis above.",
        suggestedCode,
        errorLine,
        provider,
        hasApiKey: true,
      };
    } catch (err) {
      console.warn("External AI call failed, falling back to heuristic engine:", err);
    }
  }

  // Fallback to built-in heuristic engine
  return heuristicErrorAnalysis(fileName, code, errorText);
}

/**
 * Perform a comprehensive Code Review on the active file.
 */
export async function reviewCodeWithAI(
  fileName: string,
  code: string
): Promise<AICodeReviewResult> {
  const geminiKey = process.env.GEMINI_API_KEY?.trim();
  const openaiKey = process.env.OPENAI_API_KEY?.trim();

  if (geminiKey || openaiKey) {
    const prompt = `You are a Senior Staff Software Engineer reviewing code in CodeRoom.
Perform a thorough and constructive Code Review of this file:

File: ${fileName}
Code:
\`\`\`
${code}
\`\`\`

Format your review into:
1. **Summary & Overall Quality Rating** (e.g. Clean, Needs Improvement, Buggy)
2. **Potential Bugs & Edge Cases**
3. **Performance & Security Suggestions**
4. **Best Practices & Readability**
5. **Improved / Refactored Code Snippet** (if applicable in \`\`\` code block)

Be concise, practical, and helpful.`;

    try {
      let aiResponse = "";
      let provider: "gemini" | "openai" = "gemini";

      if (geminiKey) {
        aiResponse = await callGemini(geminiKey, prompt);
        provider = "gemini";
      } else if (openaiKey) {
        aiResponse = await callOpenAI(openaiKey, prompt);
        provider = "openai";
      }

      return {
        summary: aiResponse,
        rating: "Reviewed by AI",
        issues: [],
        suggestions: ["See detailed review above."],
        provider,
      };
    } catch (err) {
      console.warn("External AI review failed, falling back:", err);
    }
  }

  // Built-in heuristic code review
  const lines = code.split("\n");
  const suggestions: string[] = [];
  const issues: Array<{ severity: "error" | "warning" | "info"; message: string; line?: number }> = [];

  if (code.length === 0) {
    suggestions.push("The file is empty. Add your code and run again.");
  } else {
    if (lines.length > 300) {
      suggestions.push("Consider breaking down this file into smaller modular functions or components.");
    }
    if (code.includes("console.log") || code.includes("print(")) {
      suggestions.push("Remember to clean up debug log statements before pushing to production.");
    }
    if (code.includes("any") && (fileName.endsWith(".ts") || fileName.endsWith(".tsx"))) {
      issues.push({ severity: "warning", message: "Usage of 'any' type detected. Consider adding strict types." });
    }
    if (code.includes("TODO") || code.includes("FIXME")) {
      issues.push({ severity: "info", message: "Found TODO/FIXME markers in the file." });
    }
  }

  return {
    summary: `Code review for ${fileName} (${lines.length} lines). Add GEMINI_API_KEY to your .env to enable deep LLM-powered reviews!`,
    rating: "Heuristic Check",
    issues,
    suggestions: suggestions.length > 0 ? suggestions : ["Structure looks clean and concise."],
    provider: "heuristic",
  };
}
