"use client";

import {
  CheckCircle2,
  RefreshCw,
  AlertCircle,
  Keyboard,
  Maximize2,
  Minimize2,
  PlayCircle,
  FileCode,
} from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { ConnectionStatus } from "./RoomHeader";
import { SaveStatus } from "./CodeEditor";

interface StatusBarProps {
  connectionStatus: ConnectionStatus;
  saveStatus: SaveStatus;
  cursorPos: { line: number; column: number };
  language: string;
  roomCode: string;
  executionState?: {
    isRunning: boolean;
    username: string | null;
  };
  tabSize?: number;
  onOpenShortcuts?: () => void;
  onToggleZenMode?: () => void;
  isZenMode?: boolean;
}

export default function StatusBar({
  connectionStatus,
  saveStatus,
  cursorPos,
  language,
  roomCode,
  executionState,
  tabSize = 2,
  onOpenShortcuts,
  onToggleZenMode,
  isZenMode = false,
}: StatusBarProps) {
  const { theme, cycleTheme, options } = useTheme();
  const currentOption = options.find((o) => o.id === theme) || options[0];

  return (
    <footer className="h-6 bg-surface border-t border-border flex items-center justify-between px-3 text-[11px] font-mono text-muted select-none shrink-0 z-20 overflow-x-auto no-scrollbar">
      {/* Left: Connection, Autosave state, Runner mutex */}
      <div className="flex items-center gap-3 min-w-0 shrink-0">
        {/* Connection status */}
        <div className="flex items-center gap-1.5">
          {connectionStatus === "connected" ? (
            <span className="flex items-center gap-1 text-emerald-400">
              <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.7)]" />
              <span className="hidden sm:inline">Connected</span>
            </span>
          ) : connectionStatus === "reconnecting" ? (
            <span className="flex items-center gap-1 text-amber-400">
              <RefreshCw className="h-3 w-3 animate-spin" />
              <span className="hidden sm:inline">Reconnecting</span>
            </span>
          ) : (
            <span className="flex items-center gap-1 text-red-400">
              <AlertCircle className="h-3 w-3" />
              <span className="hidden sm:inline">Offline</span>
            </span>
          )}
        </div>

        <div className="h-3 w-[1px] bg-border/70 hidden sm:block" />

        {/* Autosave status */}
        <div className="flex items-center gap-1">
          {saveStatus === "saving" && (
            <span className="flex items-center gap-1 text-amber-400">
              <RefreshCw className="h-2.5 w-2.5 animate-spin" />
              <span>Saving...</span>
            </span>
          )}
          {saveStatus === "saved" && connectionStatus === "connected" && (
            <span className="flex items-center gap-1 text-emerald-400/90">
              <CheckCircle2 className="h-2.5 w-2.5" />
              <span className="hidden md:inline">Saved</span>
            </span>
          )}
          {(connectionStatus !== "connected" || saveStatus === "offline") && (
            <span className="text-red-400 truncate max-w-[180px]">
              Offline &mdash; Pending sync
            </span>
          )}
        </div>

        {/* Single-runner execution status */}
        {executionState?.isRunning && (
          <>
            <div className="h-3 w-[1px] bg-border/70 hidden sm:block" />
            <div className="flex items-center gap-1 text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
              <PlayCircle className="h-3 w-3 animate-pulse text-amber-400" />
              <span className="truncate max-w-[140px]">
                Runner: {executionState.username}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Right: Position, Indentation, Encoding, Language, Room Code, Shortcuts, Zen mode */}
      <div className="flex items-center gap-3 shrink-0 ml-2">
        {/* Line & Column */}
        <span className="hover:text-foreground transition-colors cursor-default">
          Ln {cursorPos.line}, Col {cursorPos.column}
        </span>

        {/* Tab Size / Indentation */}
        <span className="hidden sm:inline text-muted/80">
          Spaces: {tabSize}
        </span>

        {/* Encoding & EOL */}
        <span className="hidden md:inline text-muted/80">
          UTF-8
        </span>

        {/* Language */}
        <div className="flex items-center gap-1 text-foreground/90 uppercase font-semibold">
          <FileCode className="h-3 w-3 text-accent" />
          <span>{language}</span>
        </div>

        {/* Theme pill with quick cycle */}
        <button
          onClick={cycleTheme}
          title={`Theme: ${currentOption.name} (Click to cycle theme)`}
          className="flex items-center gap-1.5 px-1.5 py-0.5 rounded hover:bg-surface-hover transition-colors text-foreground/80 hover:text-foreground"
        >
          <span
            className="h-2 w-2 rounded-full inline-block shrink-0"
            style={{ backgroundColor: currentOption.accentHex }}
          />
          <span className="hidden sm:inline font-sans text-[10px] capitalize">
            {currentOption.name.split(" ")[0]}
          </span>
        </button>

        <div className="h-3 w-[1px] bg-border/70 hidden sm:block" />

        {/* Room Code Badge */}
        <span className="text-accent font-semibold">
          #{roomCode}
        </span>

        {/* Keyboard Shortcuts Button */}
        {onOpenShortcuts && (
          <button
            onClick={onOpenShortcuts}
            title="Keyboard Shortcuts (?)"
            className="p-1 rounded hover:bg-surface-hover hover:text-foreground text-muted transition-colors"
          >
            <Keyboard className="h-3.5 w-3.5" />
          </button>
        )}

        {/* Zen / Focus Mode Toggle */}
        {onToggleZenMode && (
          <button
            onClick={onToggleZenMode}
            title={isZenMode ? "Exit Focus Mode (F11)" : "Focus Mode (F11)"}
            className={`p-1 rounded transition-colors ${
              isZenMode
                ? "text-accent bg-accent/20"
                : "text-muted hover:text-foreground hover:bg-surface-hover"
            }`}
          >
            {isZenMode ? (
              <Minimize2 className="h-3.5 w-3.5" />
            ) : (
              <Maximize2 className="h-3.5 w-3.5" />
            )}
          </button>
        )}
      </div>
    </footer>
  );
}
