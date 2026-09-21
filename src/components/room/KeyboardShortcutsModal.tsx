"use client";

import { X, Keyboard, Command } from "lucide-react";

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ShortcutGroup {
  title: string;
  shortcuts: Array<{
    keys: string[];
    description: string;
  }>;
}

export default function KeyboardShortcutsModal({
  isOpen,
  onClose,
}: KeyboardShortcutsModalProps) {
  if (!isOpen) return null;

  const isMac =
    typeof window !== "undefined" &&
    navigator.platform.toUpperCase().indexOf("MAC") >= 0;
  const modKey = isMac ? "⌘" : "Ctrl";
  const altKey = isMac ? "⌥" : "Alt";

  const shortcutGroups: ShortcutGroup[] = [
    {
      title: "Execution & Saving",
      shortcuts: [
        {
          keys: [modKey, "Enter"],
          description: "Execute active code file",
        },
        {
          keys: [modKey, "S"],
          description: "Autosave file & synchronize CRDT",
        },
        {
          keys: ["Shift", altKey, "F"],
          description: "Format active document",
        },
      ],
    },
    {
      title: "Navigation & Panels",
      shortcuts: [
        {
          keys: [modKey, "B"],
          description: "Toggle File Explorer sidebar",
        },
        {
          keys: [modKey, "J"],
          description: "Toggle Terminal Output drawer",
        },
        {
          keys: [altKey, "Z"],
          description: "Toggle Editor Word Wrap",
        },
        {
          keys: ["F11"],
          description: "Toggle Focus / Zen Mode",
        },
      ],
    },
    {
      title: "Editing & Helpers",
      shortcuts: [
        {
          keys: [modKey, "F"],
          description: "Find in active file",
        },
        {
          keys: [modKey, "H"],
          description: "Find and replace in file",
        },
        {
          keys: [modKey, "G"],
          description: "Go to line in editor",
        },
        {
          keys: ["?"],
          description: "Open this Keyboard Shortcuts cheat sheet",
        },
      ],
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150 select-none">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-border bg-panel-header">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-accent/15 border border-accent/30 text-accent flex items-center justify-center">
              <Keyboard className="h-4 w-4" />
            </div>
            <div>
              <h2 className="font-semibold text-sm sm:text-base text-foreground flex items-center gap-2">
                <span>Keyboard Shortcuts</span>
              </h2>
              <p className="text-[11px] text-muted">
                Boost your productivity inside CodeRoom
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-muted hover:text-foreground p-1 rounded-lg hover:bg-surface-hover transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Shortcuts List */}
        <div className="p-4 sm:p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {shortcutGroups.map((group) => (
            <div key={group.title} className="space-y-2">
              <h3 className="text-[11px] font-semibold text-accent uppercase tracking-wider">
                {group.title}
              </h3>
              <div className="bg-panel border border-border rounded-xl divide-y divide-border/60 overflow-hidden">
                {group.shortcuts.map((sc, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between px-3 py-2 text-xs hover:bg-surface/50 transition-colors"
                  >
                    <span className="text-foreground/90 font-normal">
                      {sc.description}
                    </span>
                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      {sc.keys.map((k, ki) => (
                        <kbd
                          key={ki}
                          className="px-2 py-0.5 rounded bg-surface border border-border text-[11px] font-mono font-semibold text-foreground shadow-sm inline-flex items-center gap-0.5"
                        >
                          {k === "⌘" ? <Command className="h-3 w-3" /> : k}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-3.5 border-t border-border bg-panel flex items-center justify-between text-[11px] text-muted">
          <span>Press <kbd className="px-1.5 py-0.5 rounded bg-surface border border-border text-[10px] font-mono font-semibold text-foreground">Esc</kbd> anytime to close</span>
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg bg-accent hover:bg-accent-hover text-white font-semibold text-xs transition-colors shadow-sm"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
