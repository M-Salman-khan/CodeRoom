"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Play,
  Loader2,
  Terminal,
  Keyboard,
  Globe,
  Trash2,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Minimize2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Cpu,
  Share2,
  FileCode,
  Sparkles,
} from "lucide-react";
import { SupportedLanguage, ExecutionResult } from "@/lib/compiler";

interface CompilerPanelProps {
  activeFileName?: string;
  activeFileLanguage?: string;
  getCode: () => string;
  onInsertCode?: (snippet: string) => void;
  onBroadcastRun?: (data: {
    filename: string;
    language: string;
    result: ExecutionResult;
  }) => void;
  currentUser?: { id: string; username: string };
  roomId?: string;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  runTrigger?: number;
}

export default function CompilerPanel({
  activeFileName,
  activeFileLanguage,
  getCode,
  onInsertCode,
  onBroadcastRun,
  currentUser: _currentUser,
  roomId,
  isCollapsed: controlledIsCollapsed,
  onToggleCollapse,
  runTrigger,
}: CompilerPanelProps) {
  const [languages, setLanguages] = useState<SupportedLanguage[]>([]);
  const [selectedLangId, setSelectedLangId] = useState<string>("auto");
  const [stdin, setStdin] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"output" | "input" | "languages">("output");
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [result, setResult] = useState<ExecutionResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [broadcastWithRoom, setBroadcastWithRoom] = useState<boolean>(true);
  const [panelHeight, setPanelHeight] = useState<number>(240);
  const [isMaximized, setIsMaximized] = useState<boolean>(false);
  const [internalCollapsed, setInternalCollapsed] = useState<boolean>(false);
  const [langSearch, setLangSearch] = useState<string>("");

  const abortControllerRef = useRef<AbortController | null>(null);
  const isCollapsed = controlledIsCollapsed !== undefined ? controlledIsCollapsed : internalCollapsed;

  // Fetch supported languages catalog on mount
  useEffect(() => {
    fetch("/api/compile/languages")
      .then((res) => res.json())
      .then((data) => {
        if (data.languages && Array.isArray(data.languages)) {
          setLanguages(data.languages);
        }
      })
      .catch((err) => console.error("Failed to load languages:", err));
  }, []);

  // Determine the effective language
  const effectiveLanguage = React.useMemo(() => {
    if (selectedLangId !== "auto") {
      return languages.find((l) => l.id === selectedLangId);
    }
    if (activeFileName) {
      const ext = "." + (activeFileName.split(".").pop() || "").toLowerCase();
      const match = languages.find((l) => l.extensions.includes(ext));
      if (match) return match;
    }
    if (activeFileLanguage) {
      const match = languages.find(
        (l) =>
          l.id === activeFileLanguage ||
          l.monacoLanguage === activeFileLanguage ||
          l.aliases.includes(activeFileLanguage)
      );
      if (match) return match;
    }
    return languages[0] || null;
  }, [selectedLangId, activeFileName, activeFileLanguage, languages]);

  // Execute Code
  const handleRunCode = async () => {
    if (isRunning) return;

    const code = getCode();
    if (!code || !code.trim()) {
      setErrorMsg("Please write some code before running.");
      setActiveTab("output");
      if (isCollapsed) toggleCollapse();
      return;
    }

    if (isCollapsed) {
      toggleCollapse();
    }

    setIsRunning(true);
    setErrorMsg(null);
    setActiveTab("output");

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const abortCtrl = new AbortController();
    abortControllerRef.current = abortCtrl;

    try {
      const res = await fetch("/api/compile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abortCtrl.signal,
        body: JSON.stringify({
          code,
          language: effectiveLanguage?.id || "python",
          stdin,
          filename: activeFileName,
          roomId,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || "Failed to execute program");
        setResult(null);
      } else if (data.result) {
        setResult(data.result);
        setErrorMsg(null);

        // Broadcast to collaborative room if enabled
        if (broadcastWithRoom && onBroadcastRun && activeFileName) {
          onBroadcastRun({
            filename: activeFileName,
            language: data.result.language,
            result: data.result,
          });
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }
      const msg = err instanceof Error ? err.message : "Network error while running code.";
      setErrorMsg(msg);
    } finally {
      setIsRunning(false);
    }
  };

  const handleStopRun = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsRunning(false);
  };

  const handleCopyOutput = () => {
    if (!result && !errorMsg) return;
    const textToCopy = errorMsg || [
      result?.compileOutput ? `--- Compiler Output ---\n${result.compileOutput}\n` : "",
      result?.stdout ? `--- Standard Output ---\n${result.stdout}` : "",
      result?.stderr ? `--- Standard Error ---\n${result.stderr}` : "",
    ].filter(Boolean).join("\n");

    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClearOutput = () => {
    setResult(null);
    setErrorMsg(null);
  };

  const toggleCollapse = () => {
    if (onToggleCollapse) {
      onToggleCollapse();
    } else {
      setInternalCollapsed((prev) => !prev);
    }
  };

  // Keyboard shortcut listener for Ctrl+Enter / Cmd+Enter
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        handleRunCode();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  // Watch for external trigger (e.g. from editor toolbar Run button)
  useEffect(() => {
    if (runTrigger && runTrigger > 0) {
      handleRunCode();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runTrigger]);

  const filteredLanguages = languages.filter(
    (l) =>
      l.name.toLowerCase().includes(langSearch.toLowerCase()) ||
      l.id.toLowerCase().includes(langSearch.toLowerCase()) ||
      l.extensions.some((ext) => ext.toLowerCase().includes(langSearch.toLowerCase()))
  );

  return (
    <div
      className={`border-t border-border bg-[#0d1117] flex flex-col transition-all duration-150 z-20 ${
        isMaximized ? "absolute inset-0 z-30" : "relative"
      }`}
      style={{ height: isCollapsed ? "36px" : isMaximized ? "100%" : `${panelHeight}px` }}
    >
      {/* Compiler Top Toolbar */}
      <div className="h-9 bg-[#161b22] border-b border-border/80 px-2 flex items-center justify-between shrink-0 select-none text-xs">
        {/* Left: Tab Switchers */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              setActiveTab("output");
              if (isCollapsed) toggleCollapse();
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-colors ${
              activeTab === "output" && !isCollapsed
                ? "bg-accent/20 text-accent font-medium"
                : "text-muted hover:text-foreground hover:bg-surface/60"
            }`}
          >
            <Terminal className="h-3.5 w-3.5" />
            <span>Output</span>
            {isRunning && <Loader2 className="h-3 w-3 animate-spin text-accent ml-0.5" />}
            {result?.status === "success" && !isRunning && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            )}
            {(result?.status === "error" || result?.status === "compilation_error") && !isRunning && (
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
            )}
            {result?.status === "timeout" && !isRunning && (
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
            )}
          </button>

          <button
            onClick={() => {
              setActiveTab("input");
              if (isCollapsed) toggleCollapse();
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-colors ${
              activeTab === "input" && !isCollapsed
                ? "bg-accent/20 text-accent font-medium"
                : "text-muted hover:text-foreground hover:bg-surface/60"
            }`}
          >
            <Keyboard className="h-3.5 w-3.5" />
            <span>Input (stdin)</span>
            {stdin.trim().length > 0 && (
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
            )}
          </button>

          <button
            onClick={() => {
              setActiveTab("languages");
              if (isCollapsed) toggleCollapse();
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-colors ${
              activeTab === "languages" && !isCollapsed
                ? "bg-accent/20 text-accent font-medium"
                : "text-muted hover:text-foreground hover:bg-surface/60"
            }`}
          >
            <Globe className="h-3.5 w-3.5" />
            <span>Languages</span>
            <span className="px-1 py-0.2 rounded bg-surface text-[10px] text-muted">
              {languages.length}
            </span>
          </button>
        </div>

        {/* Center / Right: Language Select & Run Actions */}
        <div className="flex items-center gap-1.5">
          {/* Language Selector Dropdown */}
          <div className="flex items-center bg-surface/80 border border-border/70 rounded-md px-1.5 py-0.5 text-[11px]">
            <span className="text-muted mr-1.5 font-mono text-[10px]">Lang:</span>
            <select
              value={selectedLangId}
              onChange={(e) => setSelectedLangId(e.target.value)}
              className="bg-transparent text-foreground outline-none cursor-pointer text-[11px] max-w-[130px] truncate"
            >
              <option value="auto" className="bg-[#161b22] text-foreground">
                Auto ({effectiveLanguage?.name || "Detect"})
              </option>
              {languages.map((lang) => (
                <option key={lang.id} value={lang.id} className="bg-[#161b22] text-foreground">
                  {lang.name} {lang.isLocalAvailable ? "⚡" : "☁️"}
                </option>
              ))}
            </select>
            {effectiveLanguage && (
              <span
                className={`ml-1 text-[9px] px-1 py-0.2 rounded uppercase font-semibold ${
                  effectiveLanguage.isLocalAvailable
                    ? "bg-emerald-500/20 text-emerald-300"
                    : "bg-blue-500/20 text-blue-300"
                }`}
                title={
                  effectiveLanguage.isLocalAvailable
                    ? "Fast offline local execution on server"
                    : "Runs via Judge0 Cloud Sandbox"
                }
              >
                {effectiveLanguage.isLocalAvailable ? "Local" : "Cloud"}
              </span>
            )}
          </div>

          {/* Broadcast to Room Checkbox */}
          {roomId && (
            <label
              title="Share run output live with other members in the room"
              className="hidden lg:flex items-center gap-1 text-[11px] text-muted hover:text-foreground cursor-pointer px-1.5 py-0.5 rounded hover:bg-surface/50 transition-colors"
            >
              <input
                type="checkbox"
                checked={broadcastWithRoom}
                onChange={(e) => setBroadcastWithRoom(e.target.checked)}
                className="rounded accent-accent h-3 w-3 cursor-pointer"
              />
              <Share2 className="h-3 w-3 text-muted" />
              <span>Share in room</span>
            </label>
          )}

          {/* Run / Stop Button */}
          {isRunning ? (
            <button
              onClick={handleStopRun}
              className="flex items-center gap-1 px-3 py-1 rounded bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white font-semibold text-[11px] transition-colors shadow-sm"
            >
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Stop</span>
            </button>
          ) : (
            <button
              onClick={handleRunCode}
              title="Run code (Ctrl + Enter)"
              className="flex items-center gap-1.5 px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-semibold text-[11px] transition-colors shadow-sm"
            >
              <Play className="h-3 w-3 fill-current" />
              <span>Run</span>
              <kbd className="hidden sm:inline px-1 py-0.2 rounded bg-emerald-700/60 text-[9px] text-emerald-100 font-mono">
                ^Enter
              </kbd>
            </button>
          )}

          {/* Clear Button */}
          <button
            onClick={handleClearOutput}
            title="Clear output"
            disabled={!result && !errorMsg}
            className="p-1 rounded text-muted hover:text-foreground hover:bg-surface/60 disabled:opacity-30 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>

          {/* Copy Button */}
          <button
            onClick={handleCopyOutput}
            title="Copy output to clipboard"
            disabled={!result && !errorMsg}
            className="p-1 rounded text-muted hover:text-foreground hover:bg-surface/60 disabled:opacity-30 transition-colors"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
          </button>

          {/* Height toggle */}
          <button
            onClick={() => setPanelHeight((prev) => (prev <= 240 ? 360 : prev <= 360 ? 480 : 240))}
            title={`Cycle panel height (current: ${panelHeight}px)`}
            className="px-1.5 py-0.5 rounded text-muted hover:text-foreground hover:bg-surface/60 transition-colors text-[10px] font-mono hidden sm:inline-block"
          >
            {panelHeight}px
          </button>

          {/* Height / Maximize / Collapse controls */}
          <button
            onClick={() => setIsMaximized(!isMaximized)}
            title={isMaximized ? "Restore size" : "Maximize panel"}
            className="p-1 rounded text-muted hover:text-foreground hover:bg-surface/60 transition-colors"
          >
            {isMaximized ? (
              <Minimize2 className="h-3.5 w-3.5" />
            ) : (
              <Maximize2 className="h-3.5 w-3.5" />
            )}
          </button>

          <button
            onClick={toggleCollapse}
            title={isCollapsed ? "Expand panel" : "Collapse panel"}
            className="p-1 rounded text-muted hover:text-foreground hover:bg-surface/60 transition-colors"
          >
            {isCollapsed ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Main Panel Content Area */}
      {!isCollapsed && (
        <div className="flex-1 overflow-hidden flex flex-col bg-[#0d1117]">
          {/* TAB 1: Terminal Output */}
          {activeTab === "output" && (
            <div className="flex-1 overflow-auto p-3 font-mono text-xs text-foreground flex flex-col select-text leading-relaxed">
              {/* Execution Status Banner */}
              {result && (
                <div
                  className={`mb-2.5 p-2 rounded-lg border text-[11px] flex flex-wrap items-center justify-between gap-2 ${
                    result.status === "success"
                      ? "bg-emerald-950/30 border-emerald-500/30 text-emerald-300"
                      : result.status === "compilation_error"
                      ? "bg-rose-950/30 border-rose-500/30 text-rose-300"
                      : result.status === "timeout"
                      ? "bg-amber-950/30 border-amber-500/30 text-amber-300"
                      : "bg-red-950/30 border-red-500/30 text-red-300"
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    {result.status === "success" && <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
                    {result.status === "compilation_error" && <XCircle className="h-4 w-4 text-rose-400" />}
                    {result.status === "timeout" && <Clock className="h-4 w-4 text-amber-400" />}
                    {result.status === "error" && <AlertTriangle className="h-4 w-4 text-red-400" />}

                    <span className="font-semibold uppercase tracking-wider">
                      {result.status === "success"
                        ? `Execution Succeeded (Exit code ${result.exitCode ?? 0})`
                        : result.status === "compilation_error"
                        ? "Compilation Error"
                        : result.status === "timeout"
                        ? "Execution Timed Out (>10s)"
                        : `Execution Failed (Exit code ${result.exitCode ?? 1})`}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-[10px] text-muted">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {result.executionTimeMs} ms
                    </span>
                    <span className="flex items-center gap-1">
                      <Cpu className="h-3 w-3" />
                      {result.runtime}
                    </span>
                  </div>
                </div>
              )}

              {/* Compilation Error Output */}
              {result?.compileOutput && (
                <div className="mb-2 p-2.5 rounded bg-rose-950/40 border border-rose-800/40 text-rose-200">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-rose-400 mb-1">
                    Compiler Diagnostics:
                  </div>
                  <pre className="whitespace-pre-wrap font-mono text-[11px] leading-tight text-rose-300">
                    {result.compileOutput}
                  </pre>
                </div>
              )}

              {/* Standard Output */}
              {result?.stdout && (
                <pre className="whitespace-pre-wrap font-mono text-zinc-100 flex-1 leading-normal selection:bg-accent/40">
                  {result.stdout}
                </pre>
              )}

              {/* Standard Error */}
              {result?.stderr && (
                <div className="mt-2 pt-2 border-t border-border/40">
                  <div className="text-[10px] uppercase font-bold text-amber-400 mb-1">
                    Standard Error:
                  </div>
                  <pre className="whitespace-pre-wrap font-mono text-amber-300 text-[11px]">
                    {result.stderr}
                  </pre>
                </div>
              )}

              {/* Server/Network Error */}
              {errorMsg && (
                <div className="p-3 rounded bg-red-950/30 border border-red-500/40 text-red-300">
                  <div className="flex items-center gap-2 font-semibold mb-1">
                    <AlertTriangle className="h-4 w-4" />
                    <span>Error</span>
                  </div>
                  <p className="text-[11px] whitespace-pre-wrap">{errorMsg}</p>
                </div>
              )}

              {/* Idle Empty State */}
              {!result && !errorMsg && !isRunning && (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-4 text-muted select-none">
                  <Terminal className="h-8 w-8 text-muted/40 mb-2" />
                  <p className="text-xs font-medium text-foreground">Ready to compile & execute</p>
                  <p className="text-[11px] text-muted max-w-sm mt-1">
                    Click <span className="text-emerald-400 font-semibold">Run</span> or press{" "}
                    <kbd className="px-1.5 py-0.5 rounded bg-[#161b22] border border-border text-foreground text-[10px] font-mono">
                      Ctrl + Enter
                    </kbd>{" "}
                    to run your program and see output here.
                  </p>
                </div>
              )}

              {/* Running State Spinner */}
              {isRunning && (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-4 text-muted select-none">
                  <Loader2 className="h-7 w-7 text-accent animate-spin mb-2" />
                  <p className="text-xs font-medium text-foreground">
                    Compiling and running {effectiveLanguage?.name}...
                  </p>
                  <p className="text-[11px] text-muted mt-1">
                    Please wait while the program executes.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Standard Input (stdin) */}
          {activeTab === "input" && (
            <div className="flex-1 flex flex-col p-2.5 bg-[#0d1117]">
              <div className="flex items-center justify-between mb-1.5 px-1">
                <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Keyboard className="h-3.5 w-3.5 text-accent" />
                  Standard Input (stdin)
                </span>
                {stdin.length > 0 && (
                  <button
                    onClick={() => setStdin("")}
                    className="text-[11px] text-muted hover:text-foreground transition-colors"
                  >
                    Clear input
                  </button>
                )}
              </div>
              <p className="text-[11px] text-muted px-1 mb-2">
                Data entered here will be passed to your program when reading from standard input
                (e.g., <code className="text-accent">cin &gt;&gt; x</code>,{" "}
                <code className="text-accent">input()</code>,{" "}
                <code className="text-accent">Scanner.nextLine()</code>).
              </p>
              <textarea
                value={stdin}
                onChange={(e) => setStdin(e.target.value)}
                placeholder="Enter input values here (separate multiple inputs by line)..."
                className="flex-1 w-full bg-[#161b22] border border-border/80 rounded-lg p-3 font-mono text-xs text-foreground focus:outline-none focus:border-accent resize-none placeholder:text-muted/60"
              />
            </div>
          )}

          {/* TAB 3: Supported Languages Directory */}
          {activeTab === "languages" && (
            <div className="flex-1 flex flex-col p-3 overflow-hidden bg-[#0d1117]">
              <div className="flex items-center justify-between mb-2.5 gap-2">
                <div>
                  <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Globe className="h-3.5 w-3.5 text-accent" />
                    Supported Programming Languages ({languages.length})
                  </h4>
                  <p className="text-[11px] text-muted mt-0.5">
                    Offline LAN execution is powered by server local runtimes; other languages run
                    via cloud sandboxes.
                  </p>
                </div>
                <input
                  type="text"
                  placeholder="Filter languages..."
                  value={langSearch}
                  onChange={(e) => setLangSearch(e.target.value)}
                  className="bg-[#161b22] border border-border rounded-md px-2 py-1 text-xs text-foreground focus:outline-none focus:border-accent w-40"
                />
              </div>

              <div className="flex-1 overflow-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 pr-1">
                {filteredLanguages.map((lang) => {
                  const isCurrent = effectiveLanguage?.id === lang.id;
                  return (
                    <div
                      key={lang.id}
                      className={`p-2.5 rounded-lg border transition-all ${
                        isCurrent
                          ? "bg-accent/10 border-accent text-foreground"
                          : "bg-[#161b22] border-border/70 hover:border-border text-foreground"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                          <FileCode className="h-4 w-4 text-accent" />
                          <span className="text-xs font-semibold">{lang.name}</span>
                        </div>
                        <span
                          className={`text-[9px] px-1.5 py-0.5 rounded font-semibold uppercase ${
                            lang.isLocalAvailable
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                              : "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                          }`}
                        >
                          {lang.isLocalAvailable ? "Local (Fast)" : "Cloud"}
                        </span>
                      </div>

                      <div className="text-[10px] text-muted flex items-center justify-between mt-1">
                        <span>Extensions: {lang.extensions.join(", ")}</span>
                        {lang.localCompiler && (
                          <span className="font-mono text-[9px] text-zinc-400">
                            {lang.localCompiler}
                          </span>
                        )}
                      </div>

                      <div className="mt-2 pt-2 border-t border-border/40 flex items-center justify-between gap-1">
                        <button
                          onClick={() => {
                            setSelectedLangId(lang.id);
                            setActiveTab("output");
                          }}
                          className={`text-[10px] px-2 py-0.5 rounded transition-colors ${
                            isCurrent
                              ? "bg-accent text-white font-medium"
                              : "bg-surface hover:bg-surface-hover text-muted hover:text-foreground"
                          }`}
                        >
                          {isCurrent ? "Active Language" : "Select"}
                        </button>

                        {onInsertCode && lang.sampleCode && (
                          <button
                            onClick={() => {
                              onInsertCode(lang.sampleCode);
                              setSelectedLangId(lang.id);
                              setActiveTab("output");
                            }}
                            className="text-[10px] px-2 py-0.5 rounded bg-surface hover:bg-surface-hover text-muted hover:text-accent transition-colors flex items-center gap-1"
                            title="Insert sample code snippet into editor"
                          >
                            <Sparkles className="h-3 w-3" />
                            <span>Sample</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
