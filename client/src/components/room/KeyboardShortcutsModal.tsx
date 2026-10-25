import { Keyboard, Command } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
  const isMac =
    typeof window !== "undefined" &&
    navigator.platform.toUpperCase().indexOf("MAC") >= 0;
  const modKey = isMac ? "⌘" : "Ctrl";
  const altKey = isMac ? "⌥" : "Alt";

  const shortcutGroups: ShortcutGroup[] = [
    {
      title: "Execution & Saving",
      shortcuts: [
        { keys: [modKey, "Enter"], description: "Execute active code file" },
        { keys: [modKey, "S"], description: "Autosave file & synchronize CRDT" },
        { keys: ["Shift", altKey, "F"], description: "Format active document" },
      ],
    },
    {
      title: "Navigation & Panels",
      shortcuts: [
        { keys: [modKey, "B"], description: "Toggle File Explorer sidebar" },
        { keys: [modKey, "J"], description: "Toggle Terminal Output drawer" },
        { keys: [altKey, "Z"], description: "Toggle Editor Word Wrap" },
        { keys: ["F11"], description: "Toggle Focus / Zen Mode" },
      ],
    },
    {
      title: "Editing & Helpers",
      shortcuts: [
        { keys: [modKey, "F"], description: "Find in active file" },
        { keys: [modKey, "H"], description: "Find and replace in file" },
        { keys: [modKey, "G"], description: "Go to line in editor" },
        {
          keys: ["?"],
          description: "Open this Keyboard Shortcuts cheat sheet",
        },
      ],
    },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg p-0 select-none">
        <DialogHeader className="flex-row items-center gap-3 space-y-0 border-b border-border p-5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-accent/30 bg-accent/15 text-accent">
            <Keyboard className="h-4 w-4" />
          </div>
          <div className="space-y-1">
            <DialogTitle>Keyboard Shortcuts</DialogTitle>
            <DialogDescription>
              Boost your productivity inside CodeRoom
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="max-h-[70vh] space-y-4 overflow-y-auto p-5">
          {shortcutGroups.map((group) => (
            <div key={group.title} className="space-y-2">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-accent">
                {group.title}
              </h3>
              <div className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border bg-secondary/40">
                {group.shortcuts.map((sc, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between px-3 py-2 text-xs transition-colors hover:bg-secondary/60"
                  >
                    <span className="font-normal text-foreground/90">
                      {sc.description}
                    </span>
                    <div className="ml-2 flex shrink-0 items-center gap-1">
                      {sc.keys.map((k, ki) => (
                        <kbd
                          key={ki}
                          className="inline-flex items-center gap-0.5 rounded-md border border-border bg-surface px-2 py-0.5 font-mono text-[11px] font-semibold text-foreground shadow-sm"
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

        <DialogFooter className="items-center justify-between border-t border-border bg-secondary/30 p-3.5 sm:justify-between">
          <span className="text-[11px] text-muted-foreground">
            Press{" "}
            <kbd className="rounded border border-border bg-surface px-1.5 py-0.5 font-mono text-[10px] font-semibold text-foreground">
              Esc
            </kbd>{" "}
            anytime to close
          </span>
          <Button size="sm" onClick={onClose}>
            Got it
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
