"use client";


import { ConnectionStatus } from "./RoomHeader";
import { SaveStatus } from "./CodeEditor";

interface StatusBarProps {
  connectionStatus: ConnectionStatus;
  saveStatus: SaveStatus;
  cursorPos: { line: number; column: number };
  language: string;
  roomCode: string;
}

export default function StatusBar({
  connectionStatus,
  saveStatus,
  cursorPos,
  language,
  roomCode,
}: StatusBarProps) {
  return (
    <div className="h-6 bg-surface border-t border-border flex items-center justify-between px-3 text-[11px] font-mono text-muted select-none shrink-0 z-20">
      {/* Left: Connection & Autosave state */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex items-center gap-1.5 truncate">
          {connectionStatus === "connected" ? (
            <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
          ) : connectionStatus === "reconnecting" ? (
            <span className="h-2 w-2 rounded-full bg-amber-500 animate-ping shrink-0" />
          ) : (
            <span className="h-2 w-2 rounded-full bg-red-500 shrink-0" />
          )}

          {saveStatus === "saving" && (
            <span className="text-amber-400">Saving...</span>
          )}
          {saveStatus === "saved" && connectionStatus === "connected" && (
            <span className="text-emerald-400/90">Connected • Saved</span>
          )}
          {(connectionStatus !== "connected" || saveStatus === "offline") && (
            <span className="text-red-400">
              Offline — changes will synchronize when connection returns
            </span>
          )}
        </div>
      </div>

      {/* Right: Cursor position, Language, Room ID */}
      <div className="flex items-center gap-4 shrink-0">
        <span className="hidden sm:inline">
          Ln {cursorPos.line}, Col {cursorPos.column}
        </span>
        <span className="hidden md:inline uppercase">{language}</span>
        <span className="text-foreground/80 font-semibold">Room {roomCode}</span>
      </div>
    </div>
  );
}
