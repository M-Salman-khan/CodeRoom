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
} from "lucide-react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { MonacoBinding } from "@/lib/y-monaco";
import type { editor } from "monaco-editor";
import { FileItem } from "./FileExplorer";
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

interface CodeEditorProps {
  roomId: string;
  roomCode?: string;
  activeFile: FileItem | null;
  openFiles: FileItem[];
  currentUser: { id: string; username: string };
  authToken?: string;
  onSelectTab: (file: FileItem) => void;
  onCloseTab: (fileId: string) => void;
  onCursorChange?: (line: number, column: number) => void;
  onSaveStatusChange?: (status: SaveStatus) => void;
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
  onSelectTab,
  onCloseTab,
  onCursorChange,
  onSaveStatusChange,
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
  }, []);

  const activeFileIdRef = useRef<string | null>(null);

  // Cleanup binding and provider when switching files or unmounting
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

  // Setup Yjs + Monaco Binding whenever activeFile changes or editor mounts
  const setupCollaboration = useCallback(
    (editorInstance: editor.IStandaloneCodeEditor, targetFile: FileItem) => {
      if (!editorInstance || isEditorDisposed(editorInstance)) return;
      if (!targetFile) return;

      // If we are already on this file and binding is alive, don't recreate
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

        // Construct websocket URL using current host
        const isSecure = window.location.protocol === "https:";
        const wsProtocol = isSecure ? "wss:" : "ws:";
        const wsHost = window.location.host;
        const wsUrl = `${wsProtocol}//${wsHost}/yjs`;

        // Token from prop or storage
        const token =
          authToken ||
          sessionStorage.getItem("coderoom_token") ||
          localStorage.getItem("coderoom_token") ||
          "";

        const docName = `${roomId}__${targetFile.id}`;

        // Start in saving/connecting state
        updateSaveStatus("saving");

        const provider = new WebsocketProvider(wsUrl, docName, ydoc, {
          params: token ? { token } : {},
        });
        providerRef.current = provider;

        // Set user awareness state for remote cursor
        const userColor = getUserColor(currentUser.username);
        provider.awareness.setLocalStateField("user", {
          name: currentUser.username,
          color: userColor,
        });

        // Inject dynamic CSS rules for remote cursor badges and styling
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

        // Provider connection status: only update if still on this file
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

        // Bind Yjs shared text to this specific file model
        const binding = new MonacoBinding(
          yText,
          model,
          new Set([editorInstance]),
          provider.awareness,
          monaco
        );
        bindingRef.current = binding;

        // Monitor local changes for autosave feedback
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

  // When activeFile changes, re-bind to the file
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

  // Clean up collaboration and clear editor references on unmount
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

    // Track cursor position
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
      <div className="h-10 bg-panel-header border-b border-border flex items-center justify-between px-2 overflow-x-auto shrink-0 select-none">
        <div className="flex items-center gap-1 min-w-0 overflow-x-auto no-scrollbar">
          {openFiles.map((file) => {
            const isActive = file.id === activeFile?.id;
            return (
              <div
                key={file.id}
                onClick={() => onSelectTab(file)}
                className={`group flex items-center gap-2 px-3 py-1.5 rounded-t-lg text-xs cursor-pointer border-t-2 transition-colors shrink-0 ${
                  isActive
                    ? "bg-panel text-foreground border-accent font-medium shadow-sm"
                    : "bg-surface/50 text-muted hover:text-foreground border-transparent hover:bg-surface"
                }`}
              >
                <span className="truncate max-w-[120px]">{file.name}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseTab(file.id);
                  }}
                  className="p-0.5 rounded text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>

        {/* Editor Controls & Save Status */}
        <div className="flex items-center gap-2 shrink-0 ml-2">
          {/* Save Status */}
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium text-muted">
            {saveStatus === "saved" && (
              <>
                <Check className="h-3 w-3 text-green-400" />
                <span className="hidden sm:inline text-green-400/90">Saved</span>
              </>
            )}
            {saveStatus === "saving" && (
              <>
                <RefreshCw className="h-3 w-3 text-amber-400 animate-spin" />
                <span className="hidden sm:inline text-amber-400">Saving...</span>
              </>
            )}
            {saveStatus === "offline" && (
              <>
                <WifiOff className="h-3 w-3 text-red-400" />
                <span className="hidden sm:inline text-red-400">Offline</span>
              </>
            )}
          </div>

          {/* Word Wrap Toggle */}
          <button
            onClick={() => setWordWrap(wordWrap === "on" ? "off" : "on")}
            title={`Toggle word wrap (currently ${wordWrap})`}
            className={`p-1.5 rounded hover:bg-surface text-xs transition-colors ${
              wordWrap === "on" ? "text-accent bg-accent/10" : "text-muted"
            }`}
          >
            <WrapText className="h-3.5 w-3.5" />
          </button>

          {/* Minimap Toggle */}
          <button
            onClick={() => setMinimap(!minimap)}
            title={`Toggle minimap (currently ${minimap ? "on" : "off"})`}
            className={`p-1.5 rounded hover:bg-surface text-xs transition-colors ${
              minimap ? "text-accent bg-accent/10" : "text-muted"
            }`}
          >
            <Map className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Editor Main Canvas */}
      <div className="flex-1 relative overflow-hidden">
        <Monaco
          height="100%"
          theme={editorTheme}
          onMount={handleEditorMount}
          options={{
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
            <FileCode className="h-12 w-12 text-muted/50 mb-3" />
            <h3 className="text-sm font-semibold text-foreground">No file open</h3>
            <p className="text-xs text-muted max-w-xs mt-1">
              Select a file from the explorer on the left or create a new file to start coding.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
