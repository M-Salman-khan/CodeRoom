"use client";

import { AlertTriangle, Trash2, X } from "lucide-react";

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  itemName: string;
  itemType: "file" | "folder";
}

export default function DeleteConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  itemName,
  itemType,
}: DeleteConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150 select-none">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150">
        <div className="p-5">
          <div className="flex items-start justify-between">
            <div className="h-10 w-10 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 flex items-center justify-center shrink-0">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <button
              onClick={onClose}
              className="text-muted hover:text-foreground p-1 rounded-lg hover:bg-surface-hover transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-3">
            <h3 className="font-semibold text-sm text-foreground">
              Delete {itemType === "folder" ? "Folder" : "File"}?
            </h3>
            <p className="text-xs text-muted mt-1.5 leading-relaxed">
              Are you sure you want to delete{" "}
              <span className="font-mono font-semibold text-foreground bg-panel px-1.5 py-0.5 rounded border border-border/80">
                {itemName}
              </span>
              ? {itemType === "folder" && "All files within this folder will be permanently removed."}{" "}
              This action cannot be undone.
            </p>
          </div>

          <div className="mt-5 flex items-center justify-end gap-2">
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-xl border border-border text-muted hover:text-foreground text-xs font-semibold hover:bg-panel transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                onConfirm();
                onClose();
              }}
              className="px-3.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Delete</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
