"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import {
  X,
  FileCode,
  Check,
  RefreshCw,
  WifiOff,
  WrapText,
  Map,
  Lock,
  Clock,
  BellRing,
  Hand,
  Play,
  Square,
  Terminal,
  ChevronDown,
  Trash2,
  Loader2,
  Sparkles,
  Bot,
  Wand2,
  Copy,
  Plus,
  SlidersHorizontal,
  AlignLeft,
  Maximize2,
  Minimize2,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
} from "lucide-react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { MonacoBinding } from "@/lib/y-monaco";
import type { editor } from "monaco-editor";
import { FileItem, getFileBadge } from "./FileExplorer";
import { getLanguageFromFilename, getUserColor } from "@/lib/utils";

// Dynamically import Monaco Editor to avoid SSR issues
const Monaco = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="h-full flex items-center justify-center bg-panel text-muted text-xs font-mono">
      <RefreshCw className="h-4 w-4 animate-spin mr-2 text-accent" />
      Loading Monaco Editor...
    </div>
  ),
});

export type SaveStatus = "saved" | "saving" | "offline";

export interface ExecutionState {
  isRunning: boolean;
  userId: string | null;
  username: string | null;
  fileId: string | null;
  fileName: string | null;
  startTime: number | null;
}

export interface ExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  executionTimeMs: number;
  killed?: boolean;
  error?: string;
  runBy?: string;
  fileName?: string;
  stoppedBy?: string;
}

interface CodeEditorProps {
  roomId: string;
  roomCode?: string;
  activeFile: FileItem | null;
  openFiles: FileItem[];
  currentUser: { id: string; username: string };
  authToken?: string;
  isOwner?: boolean;
  canEdit?: boolean;
  allowedFiles?: string[];
  pendingRequests?: Array<{
    id: string;
    userId: string;
    username: string;
    fileId: string | null;
    fileName: string | null;
    createdAt: string;
  }>;
  myPendingRequests?: Array<{
    id?: string;
    fileId: string | null;
    fileName: string | null;
    status: string;
  }>;
  executionState?: ExecutionState;
  executionResult?: ExecutionResult | null;
  onRequestPermission?: (fileId: string) => void;
  onCancelRequest?: (fileId: string) => void;
  onGrantPermission?: (userId: string, fileId?: string | null, scope?: "file" | "room") => void;
  onDeclinePermission?: (requestId?: string, userId?: string, fileId?: string | null) => void;
  onRunCode?: (fileId: string, code?: string) => void;
  onStopCode?: () => void;
  onSelectTab: (file: FileItem) => void;
  onCloseTab: (fileId: string) => void;
  onNewFilePrompt?: () => void;
  onCursorChange?: (line: number, column: number) => void;
  onSaveStatusChange?: (status: SaveStatus) => void;
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  onBroadcastRun?: (data: { filename: string; language: string; result: any }) => void;
  leftPanelOpen?: boolean;
  rightPanelOpen?: boolean;
  onToggleLeftPanel?: () => void;
  onToggleRightPanel?: () => void;
}

interface DisposableEditor {
  _isDisposed?: boolean;
}

function isEditorDisposed(editorInstance: editor.IStandaloneCodeEditor | null): boolean {
  if (!editorInstance) return true;
  return Boolean((editorInstance as unknown as DisposableEditor)._isDisposed);
}

export default function CodeEditor({
  roomId,
  activeFile,
  openFiles,
  currentUser,
  authToken,
  isOwner = false,
  canEdit = false,
  allowedFiles = [],
  pendingRequests = [],
  myPendingRequests = [],
  executionState,
  executionResult,
  onRequestPermission,
  onCancelRequest,
  onGrantPermission,
  onDeclinePermission,
  onRunCode,
  onStopCode,
  onSelectTab,
  onCloseTab,
  onNewFilePrompt,
  onCursorChange,
  onSaveStatusChange,
  onBroadcastRun: _onBroadcastRun,
  leftPanelOpen,
  rightPanelOpen,
  onToggleLeftPanel,
  onToggleRightPanel,
}: CodeEditorProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  const monacoRef = useRef<any>(null);
  const bindingRef = useRef<MonacoBinding | null>(null);
  const providerRef = useRef<WebsocketProvider | null>(null);
  const docRef = useRef<Y.Doc | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [wordWrap, setWordWrap] = useState<"on" | "off">("on");
  const [minimap, setMinimap] = useState(true);
  const [fontSize, setFontSize] = useState(14);
  const [tabSize, setTabSize] = useState(2);
  const [editorTheme, setEditorTheme] = useState("vs-dark");
  const [showPreferences, setShowPreferences] = useState(false);

  // Terminal & Execution Output
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);
  const [terminalHeight, setTerminalHeight] = useState(220);
  const [isTerminalMaximized, setIsTerminalMaximized] = useState(false);
  const [copiedOutput, setCopiedOutput] = useState(false);
  const [localResult, setLocalResult] = useState<ExecutionResult | null>(null);

  useEffect(() => {
    if (executionResult) {
      setLocalResult(executionResult);
      setIsTerminalOpen(true);
    }
  }, [executionResult]);

  useEffect(() => {
    if (executionState?.isRunning) {
      setIsTerminalOpen(true);
    }
  }, [executionState?.isRunning]);

  const canEditCurrentFile = Boolean(
    isOwner || canEdit || (activeFile && allowedFiles.includes(activeFile.id))
  );

  const isRunnable = Boolean(
    activeFile &&
      (/\.(js|jsx|ts|tsx|mjs|cjs|py|java|c|cpp|cc|cxx|sh)$/i.test(activeFile.name) ||
        ["javascript", "typescript", "python", "java", "c", "cpp", "shell"].includes(
          activeFile.language || ""
        ))
  );
  const isRunning = Boolean(executionState?.isRunning);
  const isCurrentRunner = Boolean(
    isRunning && executionState?.userId === currentUser.id
  );

  // AI review and error diagnosis state
  const [isAiDiagnosing, setIsAiDiagnosing] = useState(false);
  const [aiDiagnosis, setAiDiagnosis] = useState<{
    title: string;
    summary: string;
    explanation: string;
    suggestedFix?: string;
    suggestedCode?: string;
    errorLine?: number | null;
    provider: string;
  } | null>(null);

  const [isAiReviewOpen, setIsAiReviewOpen] = useState(false);
  const [isAiReviewing, setIsAiReviewing] = useState(false);
  const [aiReview, setAiReview] = useState<{
    summary: string;
    rating: string;
    suggestions?: string[];
    provider: string;
  } | null>(null);

  const [copiedFix, setCopiedFix] = useState(false);
  const [appliedFix, setAppliedFix] = useState(false);
  const [formattedFeedback, setFormattedFeedback] = useState(false);

  // Clear diagnosis on new result
  useEffect(() => {
    setAiDiagnosis(null);
  }, [executionResult]);

  const handleAiDiagnose = async () => {
    if (!activeFile || !localResult) return;
    setIsAiDiagnosing(true);
    const code = editorRef.current?.getValue() ?? activeFile.content ?? "";
    const errorText = [localResult.stderr, localResult.error].filter(Boolean).join("\n");

    try {
      const res = await fetch(`/api/rooms/${roomId}/ai`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "debug",
          fileName: activeFile.name,
          code,
          error: errorText,
          stdout: localResult.stdout,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data?.result) {
          setAiDiagnosis(data.result);
        }
      }
    } catch (err) {
      console.error("AI diagnosis error:", err);
    } finally {
      setIsAiDiagnosing(false);
    }
  };

  const handleAiReview = async () => {
    if (!activeFile) return;
    setIsAiReviewOpen(true);
    setIsAiReviewing(true);
    const code = editorRef.current?.getValue() ?? activeFile.content ?? "";

    try {
      const res = await fetch(`/api/rooms/${roomId}/ai`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "review",
          fileName: activeFile.name,
          code,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data?.result) {
          setAiReview(data.result);
        }
      }
    } catch (err) {
      console.error("AI review error:", err);
    } finally {
      setIsAiReviewing(false);
    }
  };

  const handleApplyFix = (fixedCode: string) => {
    if (editorRef.current && canEditCurrentFile) {
      editorRef.current.setValue(fixedCode);
      setAppliedFix(true);
      setTimeout(() => setAppliedFix(false), 2500);
    }
  };

  const handleCopyFix = (fixedCode: string) => {
    navigator.clipboard.writeText(fixedCode);
    setCopiedFix(true);
    setTimeout(() => setCopiedFix(false), 2000);
  };

  const handleCopyOutput = () => {
    if (!localResult) return;
    const fullOutput = [localResult.stdout, localResult.stderr, localResult.error]
      .filter(Boolean)
      .join("\n");
    navigator.clipboard.writeText(fullOutput);
    setCopiedOutput(true);
    setTimeout(() => setCopiedOutput(false), 2000);
  };

  const handleFormatCode = () => {
    if (editorRef.current && !isEditorDisposed(editorRef.current)) {
      editorRef.current.getAction("editor.action.formatDocument")?.run();
      setFormattedFeedback(true);
      setTimeout(() => setFormattedFeedback(false), 1500);
    }
  };

  const handleRun = () => {
    if (!activeFile || !isRunnable || isRunning) return;
    setIsTerminalOpen(true);
    setLocalResult(null);
    const currentCode = editorRef.current?.getValue() ?? activeFile.content ?? "";
    if (onRunCode) {
      onRunCode(activeFile.id, currentCode);
    }
  };

  const isRequestPending = Boolean(
    activeFile &&
      myPendingRequests?.some(
        (r) => (r.fileId === activeFile.id || !r.fileId) && r.status === "PENDING"
      )
  );

  const relevantPendingRequests = isOwner
    ? pendingRequests?.filter((r) => !r.fileId || r.fileId === activeFile?.id) || []
    : [];

  useEffect(() => {
    if (editorRef.current && !isEditorDisposed(editorRef.current)) {
      editorRef.current.updateOptions({
        readOnly: !canEditCurrentFile,
        domReadOnly: !canEditCurrentFile,
      });
    }
  }, [canEditCurrentFile]);

  const updateSaveStatus = useCallback(
    (status: SaveStatus) => {
      setSaveStatus(status);
      if (onSaveStatusChange) onSaveStatusChange(status);
    },
    [onSaveStatusChange]
  );

  // Load editor preferences from localStorage
  useEffect(() => {
    try {
      const savedWrap = localStorage.getItem("coderoom_editor_wordWrap");
      if (savedWrap === "off" || savedWrap === "on") setWordWrap(savedWrap);

      const savedMinimap = localStorage.getItem("coderoom_editor_minimap");
      if (savedMinimap !== null) setMinimap(savedMinimap === "true");

      const savedSize = localStorage.getItem("coderoom_editor_fontSize");
      if (savedSize) setFontSize(parseInt(savedSize, 10));

      const savedTab = localStorage.getItem("coderoom_editor_tabSize");
      if (savedTab) setTabSize(parseInt(savedTab, 10));

      const savedTheme = localStorage.getItem("coderoom_editor_theme");
      if (savedTheme) setEditorTheme(savedTheme);
    } catch {}

    const handleThemeEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ theme: string; editorTheme: string }>;
      if (customEvent.detail?.editorTheme) {
        setEditorTheme(customEvent.detail.editorTheme);
      }
    };
    window.addEventListener("coderoom:theme-change", handleThemeEvent);
    return () => {
      window.removeEventListener("coderoom:theme-change", handleThemeEvent);
    };
  }, []);

  const handleFontSizeChange = (size: number) => {
    setFontSize(size);
    localStorage.setItem("coderoom_editor_fontSize", size.toString());
    if (editorRef.current && !isEditorDisposed(editorRef.current)) {
      editorRef.current.updateOptions({ fontSize: size });
    }
  };

  const handleTabSizeChange = (size: number) => {
    setTabSize(size);
    localStorage.setItem("coderoom_editor_tabSize", size.toString());
    if (editorRef.current && !isEditorDisposed(editorRef.current)) {
      editorRef.current.getModel()?.updateOptions({ tabSize: size });
    }
  };

  const handleThemeChange = (theme: string) => {
    setEditorTheme(theme);
    localStorage.setItem("coderoom_editor_theme", theme);
  };

  const handleWordWrapToggle = () => {
    const nextWrap = wordWrap === "on" ? "off" : "on";
    setWordWrap(nextWrap);
    localStorage.setItem("coderoom_editor_wordWrap", nextWrap);
    if (editorRef.current && !isEditorDisposed(editorRef.current)) {
      editorRef.current.updateOptions({ wordWrap: nextWrap });
    }
  };

  const handleMinimapToggle = () => {
    const nextMinimap = !minimap;
    setMinimap(nextMinimap);
    localStorage.setItem("coderoom_editor_minimap", nextMinimap.toString());
    if (editorRef.current && !isEditorDisposed(editorRef.current)) {
      editorRef.current.updateOptions({ minimap: { enabled: nextMinimap } });
    }
  };

  // Terminal drag resize handler
  const handleTerminalResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = terminalHeight;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = startY - moveEvent.clientY;
      const newHeight = Math.max(100, Math.min(window.innerHeight * 0.75, startHeight + delta));
      setTerminalHeight(newHeight);
    };

    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  const activeFileIdRef = useRef<string | null>(null);

  const cleanupCollaboration = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    if (bindingRef.current) {
      try {
        bindingRef.current.destroy();
      } catch {}
      bindingRef.current = null;
    }
    if (providerRef.current) {
      try {
        providerRef.current.awareness.destroy();
        providerRef.current.destroy();
      } catch {}
      providerRef.current = null;
    }
    if (docRef.current) {
      try {
        docRef.current.destroy();
      } catch {}
      docRef.current = null;
    }
  }, []);

  const setupCollaboration = useCallback(
    (editorInstance: editor.IStandaloneCodeEditor, targetFile: FileItem) => {
      if (!editorInstance || isEditorDisposed(editorInstance)) return;
      if (!targetFile) return;

      if (activeFileIdRef.current === targetFile.id && bindingRef.current) {
        return;
      }

      cleanupCollaboration();

      const currentTargetFileId = targetFile.id;
      activeFileIdRef.current = currentTargetFileId;

      const monaco = monacoRef.current;
      if (!monaco) return;

      try {
        const lang = getLanguageFromFilename(targetFile.name);
        const modelUri = monaco.Uri.parse(`inmemory://coderoom/${roomId}/${targetFile.id}`);
        let model = monaco.editor.getModel(modelUri);
        if (!model || model.isDisposed()) {
          model = monaco.editor.createModel("", lang, modelUri);
        } else {
          monaco.editor.setModelLanguage(model, lang);
          model.setValue("");
        }

        editorInstance.setModel(model);

        const ydoc = new Y.Doc();
        docRef.current = ydoc;

        const isSecure = window.location.protocol === "https:";
        const wsProtocol = isSecure ? "wss:" : "ws:";
        const wsHost = window.location.host;
        const wsUrl = `${wsProtocol}//${wsHost}/yjs`;

        const token =
          authToken ||
          sessionStorage.getItem("coderoom_token") ||
          localStorage.getItem("coderoom_token") ||
          "";

        const docName = `${roomId}__${targetFile.id}`;

        updateSaveStatus("saving");

        const provider = new WebsocketProvider(wsUrl, docName, ydoc, {
          params: token ? { token } : {},
        });
        providerRef.current = provider;

        const userColor = getUserColor(currentUser.username);
        provider.awareness.setLocalStateField("user", {
          name: currentUser.username,
          color: userColor,
        });

        const updateCursorStyles = () => {
          if (activeFileIdRef.current !== currentTargetFileId) return;
          let styleTag = document.getElementById("yjs-cursor-styles") as HTMLStyleElement;
          if (!styleTag) {
            styleTag = document.createElement("style");
            styleTag.id = "yjs-cursor-styles";
            document.head.appendChild(styleTag);
          }

          let css = "";
          provider.awareness.getStates().forEach((state, clientID) => {
            if (clientID !== ydoc.clientID && state.user) {
              const { name, color } = state.user;
              css += `
                .yRemoteSelection-${clientID} {
                  background-color: ${color}33 !important;
                }
                .yRemoteSelectionHead-${clientID} {
                  border-left-color: ${color} !important;
                }
                .yRemoteSelectionHead-${clientID}::after {
                  content: "${name}";
                  background-color: ${color};
                }
              `;
            }
          });
          styleTag.innerHTML = css;
        };

        provider.awareness.on("change", updateCursorStyles);

        provider.on("status", (event: { status: string }) => {
          if (activeFileIdRef.current !== currentTargetFileId) return;
          if (event.status === "connected") {
            updateSaveStatus("saved");
          } else if (event.status === "connecting") {
            updateSaveStatus("saving");
          } else {
            updateSaveStatus("offline");
          }
        });

        const yText = ydoc.getText("monaco");

        provider.on("sync", (isSynced: boolean) => {
          if (activeFileIdRef.current !== currentTargetFileId) return;
          if (isSynced) {
            updateSaveStatus("saved");
          }
        });

        const binding = new MonacoBinding(
          yText,
          model,
          new Set([editorInstance]),
          provider.awareness,
          monaco
        );
        bindingRef.current = binding;

        yText.observe((event) => {
          if (event.transaction.local) {
            updateSaveStatus("saving");

            if (saveTimeoutRef.current) {
              clearTimeout(saveTimeoutRef.current);
            }
            saveTimeoutRef.current = setTimeout(() => {
              updateSaveStatus("saved");
            }, 2100);
          }
        });
      } catch (err) {
        console.error("Error setting up Monaco collaboration:", err);
      }
    },
    [
      roomId,
      currentUser.username,
      authToken,
      cleanupCollaboration,
      updateSaveStatus,
    ]
  );

  useEffect(() => {
    if (!activeFile) {
      cleanupCollaboration();
      activeFileIdRef.current = null;
      if (editorRef.current && monacoRef.current && !isEditorDisposed(editorRef.current)) {
        try {
          const emptyUri = monacoRef.current.Uri.parse("inmemory://coderoom-empty");
          const emptyModel =
            monacoRef.current.editor.getModel(emptyUri) ||
            monacoRef.current.editor.createModel("", "plaintext", emptyUri);
          editorRef.current.setModel(emptyModel);
        } catch {}
      }
      return;
    }

    if (editorRef.current && !isEditorDisposed(editorRef.current)) {
      setupCollaboration(editorRef.current, activeFile);
    }
  }, [activeFile, cleanupCollaboration, setupCollaboration]);

  useEffect(() => {
    return () => {
      cleanupCollaboration();
      editorRef.current = null;
      monacoRef.current = null;
    };
  }, [cleanupCollaboration]);

  const handleEditorMount = (
    editorInstance: editor.IStandaloneCodeEditor,
    monaco: typeof import("monaco-editor")
  ) => {
    editorRef.current = editorInstance;
    monacoRef.current = monaco;

    // Direct Monaco shortcut: Ctrl+Enter / Cmd+Enter runs program
    editorInstance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      handleRun();
    });

    editorInstance.onDidChangeCursorPosition((e) => {
      if (onCursorChange) {
        onCursorChange(e.position.lineNumber, e.position.column);
      }
    });

    if (activeFile) {
      setupCollaboration(editorInstance, activeFile);
    }
  };

  return (
    <div className="h-full flex flex-col bg-panel overflow-hidden">
      {/* File Tabs Bar */}
      <div className="h-10 bg-panel-header/90 border-b border-border flex items-center justify-between px-2 overflow-x-auto shrink-0 select-none">
        <div className="flex items-center gap-1 min-w-0 overflow-x-auto no-scrollbar py-1">
          {openFiles.map((file) => {
            const isActive = file.id === activeFile?.id;
            return (
              <div
                key={file.id}
                onClick={() => onSelectTab(file)}
                className={`group flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs cursor-pointer border transition-all shrink-0 ${
                  isActive
                    ? "bg-panel text-foreground border-border/80 border-t-accent font-medium shadow-sm"
                    : "bg-surface/40 text-muted hover:text-foreground border-transparent hover:bg-surface/80"
                }`}
              >
                <div className="shrink-0">{getFileBadge(file.name)}</div>
                <span className="truncate max-w-[120px] sm:max-w-[150px]">{file.name}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseTab(file.id);
                  }}
                  title="Close tab"
                  className="p-0.5 rounded text-muted hover:text-foreground hover:bg-surface-hover transition-colors opacity-60 group-hover:opacity-100"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            );
          })}

          {/* Quick (+) button for new file */}
          {onNewFilePrompt && (
            <button
              onClick={onNewFilePrompt}
              title="New File"
              className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-surface transition-colors shrink-0 ml-1"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Editor Controls, Actions, Run Button */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 ml-2">
          {/* Save Status Indicator */}
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium text-muted">
            {saveStatus === "saved" && (
              <>
                <Check className="h-3 w-3 text-emerald-400" />
                <span className="hidden lg:inline text-emerald-400/90 font-mono">Saved</span>
              </>
            )}
            {saveStatus === "saving" && (
              <>
                <RefreshCw className="h-3 w-3 text-amber-400 animate-spin" />
                <span className="hidden lg:inline text-amber-400 font-mono">Saving...</span>
              </>
            )}
            {saveStatus === "offline" && (
              <>
                <WifiOff className="h-3 w-3 text-red-400" />
                <span className="hidden lg:inline text-red-400 font-mono">Offline</span>
              </>
            )}
          </div>

          {/* Format Document Button */}
          <button
            onClick={handleFormatCode}
            disabled={!activeFile || !canEditCurrentFile}
            title="Format document (Shift+Alt+F)"
            className="p-1.5 rounded-lg hover:bg-surface text-muted hover:text-foreground text-xs transition-colors disabled:opacity-40"
          >
            {formattedFeedback ? (
              <Check className="h-3.5 w-3.5 text-emerald-400" />
            ) : (
              <AlignLeft className="h-3.5 w-3.5" />
            )}
          </button>

          {/* Editor Preferences Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowPreferences(!showPreferences)}
              title="Editor display settings"
              className={`p-1.5 rounded-lg text-xs transition-colors ${
                showPreferences ? "bg-surface text-foreground" : "text-muted hover:text-foreground hover:bg-surface"
              }`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
            </button>

            {showPreferences && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowPreferences(false)}
                />
                <div className="absolute right-0 top-full mt-1.5 w-56 bg-surface border border-border rounded-xl shadow-2xl p-3 z-50 text-xs space-y-3 animate-in fade-in slide-in-from-top-1 duration-150">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted">
                    Editor Preferences
                  </div>

                  {/* Font Size */}
                  <div className="flex items-center justify-between">
                    <span className="text-muted">Font Size:</span>
                    <div className="flex items-center gap-1">
                      {[12, 14, 16, 18].map((size) => (
                        <button
                          key={size}
                          onClick={() => handleFontSizeChange(size)}
                          className={`px-1.5 py-0.5 rounded text-[11px] font-mono ${
                            fontSize === size
                              ? "bg-accent text-white font-bold"
                              : "bg-panel hover:bg-surface-hover text-muted"
                          }`}
                        >
                          {size}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Tab Size */}
                  <div className="flex items-center justify-between">
                    <span className="text-muted">Tab Size:</span>
                    <div className="flex items-center gap-1">
                      {[2, 4].map((spaces) => (
                        <button
                          key={spaces}
                          onClick={() => handleTabSizeChange(spaces)}
                          className={`px-2 py-0.5 rounded text-[11px] font-mono ${
                            tabSize === spaces
                              ? "bg-accent text-white font-bold"
                              : "bg-panel hover:bg-surface-hover text-muted"
                          }`}
                        >
                          {spaces}sp
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Word Wrap */}
                  <div className="flex items-center justify-between pt-1 border-t border-border/60">
                    <span className="text-muted">Word Wrap</span>
                    <button
                      onClick={handleWordWrapToggle}
                      className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                        wordWrap === "on"
                          ? "bg-accent/20 text-accent font-semibold"
                          : "bg-panel text-muted"
                      }`}
                    >
                      {wordWrap === "on" ? "Enabled" : "Disabled"}
                    </button>
                  </div>

                  {/* Minimap */}
                  <div className="flex items-center justify-between">
                    <span className="text-muted">Minimap</span>
                    <button
                      onClick={handleMinimapToggle}
                      className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                        minimap
                          ? "bg-accent/20 text-accent font-semibold"
                          : "bg-panel text-muted"
                      }`}
                    >
                      {minimap ? "Shown" : "Hidden"}
                    </button>
                  </div>

                  {/* Editor Theme */}
                  <div className="pt-1 border-t border-border/60">
                    <span className="text-muted block mb-1.5">Theme</span>
                    <div className="grid grid-cols-2 gap-1.5">
                      {[
                        { id: "vs-dark", label: "VS Dark" },
                        { id: "hc-black", label: "Contrast" },
                      ].map((t) => (
                        <button
                          key={t.id}
                          onClick={() => handleThemeChange(t.id)}
                          className={`py-1 px-2 rounded text-center text-[10px] font-mono truncate ${
                            editorTheme === t.id
                              ? "bg-accent text-white font-bold"
                              : "bg-panel text-muted hover:text-foreground"
                          }`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Word Wrap Direct Toggle */}
          <button
            onClick={handleWordWrapToggle}
            title={`Word Wrap: ${wordWrap} (Alt+Z)`}
            className={`p-1.5 rounded-lg text-xs transition-colors hidden sm:block ${
              wordWrap === "on" ? "text-accent bg-accent/10" : "text-muted hover:text-foreground hover:bg-surface"
            }`}
          >
            <WrapText className="h-3.5 w-3.5" />
          </button>

          {/* Minimap Direct Toggle */}
          <button
            onClick={handleMinimapToggle}
            title={`Minimap: ${minimap ? "on" : "off"}`}
            className={`p-1.5 rounded-lg text-xs transition-colors hidden sm:block ${
              minimap ? "text-accent bg-accent/10" : "text-muted hover:text-foreground hover:bg-surface"
            }`}
          >
            <Map className="h-3.5 w-3.5" />
          </button>

          {/* Output Drawer Toggle */}
          <button
            onClick={() => setIsTerminalOpen(!isTerminalOpen)}
            title="Toggle terminal output drawer (Ctrl+J)"
            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-all ${
              isTerminalOpen
                ? "text-accent bg-accent/15 font-semibold"
                : "text-muted hover:text-foreground hover:bg-surface"
            }`}
          >
            <Terminal className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Output</span>
          </button>

          {/* AI Code Review Button */}
          <button
            onClick={handleAiReview}
            disabled={!activeFile}
            title="AI Code Review & Recommendations"
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 text-purple-300 text-xs font-medium transition-all shadow-sm disabled:opacity-40 active:scale-95"
          >
            <Sparkles className="h-3.5 w-3.5 text-purple-400" />
            <span className="hidden sm:inline">AI Review</span>
          </button>

          {/* Single-Runner Program Execution Button */}
          {isRunning ? (
            isCurrentRunner || isOwner ? (
              <button
                onClick={() => onStopCode?.()}
                title="Stop execution"
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-semibold shadow-sm transition-all animate-pulse active:scale-95"
              >
                <Square className="h-3 w-3 fill-current" />
                <span>Stop</span>
              </button>
            ) : (
              <div
                title={`Program currently running by ${executionState?.username}. Only 1 user can run code at a time.`}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-medium cursor-not-allowed select-none"
              >
                <Loader2 className="h-3 w-3 animate-spin text-amber-400" />
                <span className="max-w-[110px] truncate">
                  {executionState?.username}
                </span>
              </div>
            )
          ) : (
            <button
              onClick={handleRun}
              disabled={!activeFile || !isRunnable}
              title={
                !activeFile
                  ? "No file open. Select a file to run."
                  : !isRunnable
                  ? "Execution supported for JS, TS, Python, Java, C, C++, and Bash files"
                  : "Run Program (Ctrl+Enter)"
              }
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold shadow-sm transition-all ${
                !activeFile || !isRunnable
                  ? "bg-surface border border-border text-muted cursor-not-allowed opacity-50"
                  : "bg-emerald-600 hover:bg-emerald-500 text-white hover:scale-[1.02] active:scale-[0.98] shadow-md shadow-emerald-950/40"
              }`}
            >
              <Play className="h-3 w-3 fill-current" />
              <span>Run</span>
            </button>
          )}

          {/* Left / Right Panel Shift Toggles (Desktop only) */}
          {(onToggleLeftPanel || onToggleRightPanel) && (
            <div className="hidden md:flex items-center gap-1 pl-1 border-l border-border/80 ml-0.5">
              {onToggleLeftPanel && (
                <button
                  onClick={onToggleLeftPanel}
                  title={leftPanelOpen ? "Collapse File Explorer" : "Expand File Explorer"}
                  className="p-1.5 rounded-lg bg-surface/80 hover:bg-surface border border-border text-muted hover:text-foreground transition-colors shadow-sm"
                >
                  {leftPanelOpen ? (
                    <PanelLeftClose className="h-3.5 w-3.5" />
                  ) : (
                    <PanelLeftOpen className="h-3.5 w-3.5" />
                  )}
                </button>
              )}
              {onToggleRightPanel && (
                <button
                  onClick={onToggleRightPanel}
                  title={rightPanelOpen ? "Collapse Chat Panel" : "Expand Chat Panel"}
                  className="p-1.5 rounded-lg bg-surface/80 hover:bg-surface border border-border text-muted hover:text-foreground transition-colors shadow-sm"
                >
                  {rightPanelOpen ? (
                    <PanelRightClose className="h-3.5 w-3.5" />
                  ) : (
                    <PanelRightOpen className="h-3.5 w-3.5" />
                  )}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Breadcrumb & File Info Sub-bar */}
      {activeFile && (
        <div className="h-7 bg-panel border-b border-border/60 px-3 flex items-center justify-between text-[11px] text-muted font-mono select-none shrink-0">
          <div className="flex items-center gap-1.5 truncate">
            <span>root</span>
            <span>/</span>
            <span className="text-foreground font-semibold truncate">{activeFile.name}</span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {canEditCurrentFile ? (
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                <Check className="h-2.5 w-2.5" />
                <span>Editable</span>
              </span>
            ) : (
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                <Lock className="h-2.5 w-2.5" />
                <span>Read-Only</span>
              </span>
            )}
          </div>
        </div>
      )}

      {/* Mutual Exclusion / Single Runner Notification Bar */}
      {isRunning && !isCurrentRunner && (
        <div className="bg-amber-950/70 border-b border-amber-500/30 px-3 py-1.5 flex items-center justify-between text-xs text-amber-200 shrink-0 z-10 animate-in fade-in duration-150">
          <div className="flex items-center gap-2 min-w-0">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-400 shrink-0" />
            <span className="truncate">
              <strong>{executionState?.username}</strong> is running{" "}
              <span className="font-mono underline text-white font-semibold">
                {executionState?.fileName || "code"}
              </span>
              . Only one runner at a time.
            </span>
          </div>
          {isOwner && (
            <button
              onClick={() => onStopCode?.()}
              className="px-2.5 py-0.5 rounded bg-red-600/90 hover:bg-red-600 text-white text-[11px] font-semibold transition-colors shadow-sm shrink-0 ml-2"
            >
              Force Stop
            </button>
          )}
        </div>
      )}

      {/* Admin Quick Notification Bar for incoming Edit Permission Requests */}
      {isOwner && relevantPendingRequests.length > 0 && (
        <div className="bg-indigo-950/90 border-b border-indigo-500/40 px-3 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs shrink-0 z-10 shadow-sm animate-in fade-in duration-200">
          <div className="flex items-center gap-2 text-indigo-200">
            <BellRing className="h-4 w-4 animate-bounce text-accent shrink-0" />
            <span>
              <strong>{relevantPendingRequests[0].username}</strong> requested permission to edit{" "}
              <span className="font-mono underline font-semibold text-white">
                {relevantPendingRequests[0].fileName || "this file"}
              </span>
              {relevantPendingRequests.length > 1 && (
                <span className="text-indigo-400 ml-1">
                  (+{relevantPendingRequests.length - 1} more)
                </span>
              )}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
            {relevantPendingRequests[0].fileId && (
              <button
                onClick={() =>
                  onGrantPermission?.(
                    relevantPendingRequests[0].userId,
                    relevantPendingRequests[0].fileId,
                    "file"
                  )
                }
                className="px-2.5 py-1 rounded-lg bg-accent hover:bg-accent-hover text-white text-[11px] font-semibold transition-colors shadow-sm"
              >
                Allow This File
              </button>
            )}
            <button
              onClick={() =>
                onGrantPermission?.(
                  relevantPendingRequests[0].userId,
                  null,
                  "room"
                )
              }
              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold transition-colors shadow-sm flex items-center gap-1"
            >
              <Check className="h-3 w-3" />
              <span>Allow All Files</span>
            </button>
            <button
              onClick={() =>
                onDeclinePermission?.(
                  relevantPendingRequests[0].id,
                  relevantPendingRequests[0].userId,
                  relevantPendingRequests[0].fileId
                )
              }
              className="px-2.5 py-1 rounded-lg border border-border bg-surface hover:bg-surface-hover text-muted hover:text-foreground text-[11px] transition-colors"
            >
              Decline
            </button>
          </div>
        </div>
      )}

      {/* Non-Admin Read-Only / Permission Request Banner */}
      {!isOwner && activeFile && !canEditCurrentFile && (
        <div className="bg-amber-950/60 border-b border-amber-500/30 px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0 z-10">
          <div className="flex items-center gap-2 text-amber-200">
            <Lock className="h-3.5 w-3.5 text-amber-400 shrink-0" />
            <span>
              <strong>Read-Only:</strong> You need permission from the room owner to edit this file.
            </span>
          </div>

          <div className="flex items-center gap-2">
            {isRequestPending ? (
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 font-medium text-[11px] animate-pulse">
                  <Clock className="h-3 w-3" />
                  <span>Request Sent &mdash; Waiting for Admin Approval...</span>
                </span>
                {onCancelRequest && (
                  <button
                    onClick={() => onCancelRequest(activeFile.id)}
                    className="text-[11px] text-muted hover:text-foreground underline transition-colors"
                  >
                    Cancel
                  </button>
                )}
              </div>
            ) : (
              <button
                onClick={() => onRequestPermission?.(activeFile.id)}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-accent hover:bg-accent-hover text-white font-semibold text-xs shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <Hand className="h-3.5 w-3.5" />
                <span>Ask Admin to Edit</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Editor Canvas */}
      <div className="flex-1 relative overflow-hidden">
        <Monaco
          height="100%"
          theme={editorTheme}
          onMount={handleEditorMount}
          options={{
            readOnly: !canEditCurrentFile,
            domReadOnly: !canEditCurrentFile,
            fontSize,
            tabSize,
            wordWrap,
            minimap: { enabled: minimap },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            fontFamily: "'Geist Mono', Consolas, 'Courier New', monospace",
            fontLigatures: true,
            smoothScrolling: true,
            cursorBlinking: "smooth",
            formatOnPaste: true,
            formatOnType: true,
            renderLineHighlight: "all",
          }}
        />

        {/* Overlay when no file is active */}
        {!activeFile && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center text-center p-6 bg-panel text-muted select-none">
            <div className="h-16 w-16 rounded-2xl bg-surface border border-border/80 flex items-center justify-center mb-3 shadow-inner">
              <FileCode className="h-8 w-8 text-muted/60" />
            </div>
            <h3 className="text-base font-semibold text-foreground">No file open</h3>
            <p className="text-xs text-muted max-w-xs mt-1.5 leading-relaxed">
              Select a file from the explorer on the left or click below to create a file.
            </p>
            {onNewFilePrompt && canEditCurrentFile && (
              <button
                onClick={onNewFilePrompt}
                className="mt-4 px-4 py-2 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-semibold shadow-md shadow-accent/20 transition-all hover:scale-105"
              >
                + Create New File
              </button>
            )}
          </div>
        )}
      </div>

      {/* Terminal / Output Drawer with Resizable Drag Handle */}
      {isTerminalOpen && (
        <div
          style={{
            height: isTerminalMaximized ? "80%" : `${terminalHeight}px`,
          }}
          className="border-t border-border bg-panel flex flex-col shrink-0 text-foreground select-text z-10 shadow-2xl relative transition-all duration-75"
        >
          {/* Draggable Resizer Bar */}
          <div
            onMouseDown={handleTerminalResizeStart}
            title="Drag to resize terminal output"
            className="h-1.5 w-full bg-border/40 hover:bg-accent cursor-row-resize transition-colors select-none"
          />

          {/* Terminal Header */}
          <div className="h-8 bg-panel-header border-b border-border px-3 flex items-center justify-between text-xs select-none">
            <div className="flex items-center gap-2.5 min-w-0">
              <Terminal className="h-3.5 w-3.5 text-accent shrink-0" />
              <span className="font-semibold text-foreground">Terminal Output</span>

              {isRunning && (
                <span className="flex items-center gap-1.5 text-[11px] text-amber-400 font-mono animate-pulse">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                  Running ({executionState?.username})
                </span>
              )}

              {!isRunning && localResult && (
                <span
                  className={`text-[11px] font-mono px-2 py-0.5 rounded-md ${
                    localResult.exitCode === 0
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      : "bg-red-500/20 text-red-400 border border-red-500/30"
                  }`}
                >
                  {localResult.exitCode === 0
                    ? `Exit 0 (${localResult.executionTimeMs}ms)`
                    : `Exit ${localResult.exitCode ?? -1} (${localResult.executionTimeMs}ms)`}
                </span>
              )}

              {localResult?.runBy && (
                <span className="text-[10px] text-muted hidden sm:inline truncate">
                  by {localResult.runBy} {localResult.fileName ? `(${localResult.fileName})` : ""}
                </span>
              )}
            </div>

            {/* Terminal Actions */}
            <div className="flex items-center gap-1 shrink-0">
              {localResult && (
                <>
                  <button
                    onClick={handleCopyOutput}
                    title="Copy terminal output"
                    className="p-1 rounded hover:bg-surface-hover text-muted hover:text-foreground transition-colors"
                  >
                    {copiedOutput ? (
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </button>
                  <button
                    onClick={() => setLocalResult(null)}
                    title="Clear output"
                    className="p-1 rounded hover:bg-surface-hover text-muted hover:text-foreground transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </>
              )}

              {/* Maximize / Restore Toggle */}
              <button
                onClick={() => setIsTerminalMaximized(!isTerminalMaximized)}
                title={isTerminalMaximized ? "Restore size" : "Maximize terminal"}
                className="p-1 rounded hover:bg-surface-hover text-muted hover:text-foreground transition-colors"
              >
                {isTerminalMaximized ? (
                  <Minimize2 className="h-3.5 w-3.5" />
                ) : (
                  <Maximize2 className="h-3.5 w-3.5" />
                )}
              </button>

              {/* Minimize / Close */}
              <button
                onClick={() => setIsTerminalOpen(false)}
                title="Minimize output"
                className="p-1 rounded hover:bg-surface-hover text-muted hover:text-foreground transition-colors"
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Terminal Content */}
          <div className="flex-1 p-3 overflow-y-auto font-mono text-xs leading-relaxed space-y-2 select-text">
            {isRunning && (
              <div className="flex items-center gap-2 text-amber-400">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Executing {executionState?.fileName} by {executionState?.username}...</span>
              </div>
            )}

            {/* AI Diagnosis Prompt Banner if error occurred and not yet diagnosed */}
            {localResult &&
              (localResult.exitCode !== 0 || localResult.stderr || localResult.error) &&
              !aiDiagnosis &&
              !isRunning && (
                <div className="p-2.5 rounded-xl bg-purple-950/40 border border-purple-500/30 flex items-center justify-between gap-2.5 text-xs animate-in fade-in duration-150">
                  <div className="flex items-center gap-2 text-purple-200 min-w-0">
                    <Bot className="h-4 w-4 text-purple-400 shrink-0" />
                    <span className="truncate">
                      Execution failed. Would you like AI to explain and suggest a fix?
                    </span>
                  </div>
                  <button
                    onClick={handleAiDiagnose}
                    disabled={isAiDiagnosing}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-semibold text-[11px] shadow-sm transition-all shrink-0 disabled:opacity-60"
                  >
                    {isAiDiagnosing ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>Diagnosing...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-3.5 w-3.5" />
                        <span>Explain & Fix with AI</span>
                      </>
                    )}
                  </button>
                </div>
              )}

            {/* AI Diagnosis & Suggestion Result Card */}
            {aiDiagnosis && (
              <div className="p-3.5 rounded-xl bg-purple-950/50 border border-purple-500/40 space-y-2.5 text-xs animate-in fade-in duration-150">
                <div className="flex items-center justify-between border-b border-purple-500/30 pb-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-purple-400" />
                    <span className="font-semibold text-purple-200">{aiDiagnosis.title}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-mono">
                      {aiDiagnosis.provider === "gemini"
                        ? "Google Gemini"
                        : aiDiagnosis.provider === "openai"
                        ? "OpenAI"
                        : "CodeRoom AI"}
                    </span>
                    {aiDiagnosis.errorLine && (
                      <span className="text-[10px] text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded-full font-mono">
                        Line {aiDiagnosis.errorLine}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => setAiDiagnosis(null)}
                    title="Dismiss diagnosis"
                    className="text-muted hover:text-foreground p-0.5 rounded"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="text-foreground font-mono whitespace-pre-wrap leading-relaxed text-[11px]">
                  {aiDiagnosis.explanation}
                </div>

                {aiDiagnosis.suggestedCode && (
                  <div className="mt-2 pt-2 border-t border-purple-500/30 flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-[11px] text-purple-300 font-medium">
                      Corrected code ready:
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleCopyFix(aiDiagnosis.suggestedCode!)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface hover:bg-surface-hover text-foreground text-[11px] border border-border transition-colors"
                      >
                        {copiedFix ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                        <span>{copiedFix ? "Copied" : "Copy Fix"}</span>
                      </button>
                      {canEditCurrentFile && (
                        <button
                          onClick={() => handleApplyFix(aiDiagnosis.suggestedCode!)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-semibold text-[11px] shadow-sm transition-colors"
                        >
                          {appliedFix ? <Check className="h-3 w-3 text-white" /> : <Wand2 className="h-3 w-3" />}
                          <span>{appliedFix ? "Applied!" : "Apply to Editor"}</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {localResult ? (
              <>
                {localResult.stdout && (
                  <pre className="text-foreground whitespace-pre-wrap break-words font-mono">
                    {localResult.stdout}
                  </pre>
                )}
                {localResult.stderr && (
                  <pre className="text-red-400 whitespace-pre-wrap break-words font-mono">
                    {localResult.stderr}
                  </pre>
                )}
                {localResult.error && !localResult.stderr && (
                  <pre className="text-red-400 whitespace-pre-wrap break-words font-mono">
                    {localResult.error}
                  </pre>
                )}
                {!localResult.stdout && !localResult.stderr && !localResult.error && !isRunning && (
                  <div className="text-muted italic text-xs">
                    Program exited with code {localResult.exitCode ?? 0} with no console output.
                  </div>
                )}
              </>
            ) : (
              !isRunning && (
                <div className="text-muted text-xs">
                  No execution output. Click &quot;Run&quot; above to execute the active file.
                </div>
              )
            )}
          </div>
        </div>
      )}

      {/* AI Code Review Modal */}
      {isAiReviewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150 select-text">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-border bg-panel-header select-none">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-purple-500/20 border border-purple-500/30 text-purple-400 flex items-center justify-center">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-foreground">AI Code Review</h3>
                  <p className="text-[11px] text-muted">{activeFile?.name || "Active File"}</p>
                </div>
              </div>
              <button
                onClick={() => setIsAiReviewOpen(false)}
                className="p-1 rounded-lg text-muted hover:text-foreground hover:bg-surface transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
              {isAiReviewing ? (
                <div className="py-12 flex flex-col items-center justify-center gap-3 text-center text-muted">
                  <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
                  <p className="font-semibold text-foreground">AI is analyzing your code...</p>
                  <p className="text-xs max-w-xs text-muted">
                    Reviewing code structure, edge cases, performance, and best practices.
                  </p>
                </div>
              ) : aiReview ? (
                <div className="space-y-4">
                  <div className="p-3.5 rounded-xl bg-purple-950/30 border border-purple-500/30 flex items-center justify-between">
                    <span className="font-semibold text-purple-200">
                      Overall Assessment: {aiReview.rating}
                    </span>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-mono">
                      {aiReview.provider === "gemini"
                        ? "Google Gemini 2.0"
                        : aiReview.provider === "openai"
                        ? "OpenAI"
                        : "CodeRoom AI"}
                    </span>
                  </div>

                  <div className="p-4 rounded-xl bg-panel border border-border leading-relaxed font-mono whitespace-pre-wrap text-zinc-200">
                    {aiReview.summary}
                  </div>

                  {aiReview.suggestions && aiReview.suggestions.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-semibold text-foreground text-xs uppercase tracking-wider">
                        Key Recommendations
                      </h4>
                      <ul className="list-disc pl-5 space-y-1 text-muted">
                        {aiReview.suggestions.map((s, idx) => (
                          <li key={idx}>{s}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : null}
            </div>

            <div className="p-4 border-t border-border bg-panel flex items-center justify-between select-none">
              <span className="text-[11px] text-muted">
                Powered by CodeRoom AI Engine
              </span>
              <button
                onClick={() => setIsAiReviewOpen(false)}
                className="px-4 py-2 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-semibold transition-colors"
              >
                Close Review
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
