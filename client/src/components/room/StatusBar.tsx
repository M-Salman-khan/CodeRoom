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
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
    <footer className="z-20 flex h-7 shrink-0 select-none items-center justify-between overflow-x-auto border-t border-border bg-surface px-3 font-mono text-[11px] text-muted-foreground">
      {/* Left: connection, autosave, runner mutex */}
      <div className="flex min-w-0 shrink-0 items-center gap-3">
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

        <div className="hidden h-3 w-px bg-border/70 sm:block" />

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
            <span className="max-w-[180px] truncate text-red-400">
              Offline &mdash; Pending sync
            </span>
          )}
        </div>

        {executionState?.isRunning && (
          <>
            <div className="hidden h-3 w-px bg-border/70 sm:block" />
            <span className="flex items-center gap-1 rounded border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-amber-300">
              <PlayCircle className="h-3 w-3 animate-pulse text-amber-400" />
              <span className="max-w-[140px] truncate">
                Runner: {executionState.username}
              </span>
            </span>
          </>
        )}
      </div>

      {/* Right: editor metadata + actions */}
      <div className="ml-2 flex shrink-0 items-center gap-3">
        <span className="cursor-default transition-colors hover:text-foreground">
          Ln {cursorPos.line}, Col {cursorPos.column}
        </span>

        <span className="hidden text-muted-foreground/80 sm:inline">
          Spaces: {tabSize}
        </span>

        <span className="hidden text-muted-foreground/80 md:inline">UTF-8</span>

        <div className="flex items-center gap-1 font-semibold uppercase text-foreground/90">
          <FileCode className="h-3 w-3 text-accent" />
          <span>{language}</span>
        </div>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={cycleTheme}
              className="flex items-center gap-1.5 rounded px-1.5 py-0.5 text-foreground/80 transition-colors hover:bg-surface-hover hover:text-foreground"
            >
              <span
                className="inline-block h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: currentOption.accentHex }}
              />
              <span className="hidden font-sans text-[10px] capitalize sm:inline">
                {currentOption.name.split(" ")[0]}
              </span>
            </button>
          </TooltipTrigger>
          <TooltipContent>
            Theme: {currentOption.name} (click to cycle)
          </TooltipContent>
        </Tooltip>

        <div className="hidden h-3 w-px bg-border/70 sm:block" />

        <Badge
          variant="accent"
          className="hidden font-mono text-[10px] sm:inline-flex"
        >
          #{roomCode}
        </Badge>

        {onOpenShortcuts && (
          <button
            onClick={onOpenShortcuts}
            title="Keyboard Shortcuts (?)"
            className="hidden rounded p-1 text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground sm:block"
          >
            <Keyboard className="h-3.5 w-3.5" />
          </button>
        )}

        {onToggleZenMode && (
          <button
            onClick={onToggleZenMode}
            title={isZenMode ? "Exit Focus Mode (F11)" : "Focus Mode (F11)"}
            className={cn(
              "hidden rounded p-1 transition-colors sm:block",
              isZenMode
                ? "bg-accent/20 text-accent"
                : "text-muted-foreground hover:bg-surface-hover hover:text-foreground"
            )}
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
