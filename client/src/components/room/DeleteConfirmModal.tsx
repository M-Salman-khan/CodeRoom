import { AlertTriangle, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm select-none">
        <DialogHeader>
          <div className="mb-1 flex h-11 w-11 items-center justify-center rounded-xl border border-destructive/30 bg-destructive/10 text-destructive">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <DialogTitle>
            Delete {itemType === "folder" ? "Folder" : "File"}?
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to delete{" "}
            <span className="rounded border border-border/80 bg-secondary px-1.5 py-0.5 font-mono text-xs font-semibold text-foreground">
              {itemName}
            </span>
            ?{" "}
            {itemType === "folder" &&
              "All files within this folder will be permanently removed. "}
            This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Delete</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
