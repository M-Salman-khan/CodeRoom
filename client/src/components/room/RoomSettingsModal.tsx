import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Settings,
  Lock,
  Globe,
  Trash2,
  Loader2,
  AlertCircle,
  Check,
  Shield,
  KeyRound,
  FileText,
  Eye,
  EyeOff,
  Unlock,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { apiFetch, errorMessage } from "@/lib/auth";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface RoomSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  room: {
    id: string;
    roomCode: string;
    name: string;
    description: string | null;
    isPublic: boolean;
    hasPassword?: boolean;
    ownerId: string;
  };
  isOwner: boolean;
  onUpdated?: () => void;
}

export default function RoomSettingsModal({
  isOpen,
  onClose,
  room,
  isOwner,
  onUpdated,
}: RoomSettingsModalProps) {
  const navigate = useNavigate();

  const [name, setName] = useState(room.name);
  const [description, setDescription] = useState(room.description || "");
  const [password, setPassword] = useState("");
  const [removePassword, setRemovePassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isPublic, setIsPublic] = useState(room.isPublic);

  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setName(room.name);
      setDescription(room.description || "");
      setPassword("");
      setRemovePassword(false);
      setShowPassword(false);
      setIsPublic(room.isPublic);
      setError(null);
      setSuccess(null);
    }
  }, [isOpen, room]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOwner) return;

    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const payload: Record<string, unknown> = {
        name: name.trim(),
        description: description.trim() || "",
        isPublic,
      };

      if (removePassword) {
        payload.password = "";
      } else if (password.trim().length > 0) {
        payload.password = password.trim();
      }

      const res = await apiFetch(`/api/rooms/${room.id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(errorMessage(data, "Failed to update room settings."));
        setLoading(false);
        return;
      }

      setSuccess("Room settings saved successfully!");
      if (onUpdated) onUpdated();
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch {
      setError("Network error. Could not reach server.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRoom = async () => {
    if (!isOwner) return;
    setDeleting(true);
    try {
      const res = await apiFetch(`/api/rooms/${room.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        setError("Failed to delete room.");
        setDeleting(false);
        return;
      }

      navigate("/dashboard");
    } catch {
      setError("Network error while deleting room.");
      setDeleting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader className="flex-row items-center gap-3 space-y-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-accent/30 bg-accent/15 text-accent">
            <Settings className="h-5 w-5" />
          </div>
          <div className="min-w-0 space-y-1">
            <DialogTitle>Room Settings</DialogTitle>
            <DialogDescription className="font-mono">
              Code: {room.roomCode}
            </DialogDescription>
          </div>
        </DialogHeader>

        <form onSubmit={handleUpdate} className="space-y-5">
          {error && (
            <div className="flex items-center gap-2.5 rounded-xl border border-destructive/30 bg-destructive/10 p-3.5 text-xs text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="flex items-center gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-400">
              <Check className="h-4 w-4 shrink-0" />
              <span>{success}</span>
            </div>
          )}

          {!isOwner && (
            <div className="flex items-center gap-2.5 rounded-xl border border-border bg-secondary/40 p-3.5 text-xs text-muted-foreground">
              <Shield className="h-4 w-4 shrink-0 text-accent" />
              <span>
                You are viewing this room as a member. Only the owner can modify
                room settings.
              </span>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="settingsRoomName">Room Name</Label>
            <div className="relative">
              <FileText className="pointer-events-none absolute left-3.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="settingsRoomName"
                type="text"
                disabled={!isOwner}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Enter room name"
                className="pl-11"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="settingsRoomDescription">Description</Label>
            <Textarea
              id="settingsRoomDescription"
              rows={3}
              disabled={!isOwner}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this room's purpose..."
              className="min-h-[90px] resize-none leading-relaxed"
            />
          </div>

          {isOwner && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Room Password</Label>
                {room.hasPassword && !removePassword && (
                  <Badge variant="warning">
                    <Lock className="h-3 w-3" />
                    Protected
                  </Badge>
                )}
              </div>

              {room.hasPassword && (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-secondary/40 p-3">
                  <div className="flex items-center gap-2.5 text-xs">
                    {removePassword ? (
                      <>
                        <Unlock className="h-4 w-4 shrink-0 text-rose-400" />
                        <span className="font-medium text-rose-400">
                          Password will be removed on save
                        </span>
                      </>
                    ) : (
                      <>
                        <Lock className="h-4 w-4 shrink-0 text-amber-400" />
                        <span className="text-muted-foreground">
                          Password protection is currently enabled
                        </span>
                      </>
                    )}
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant={removePassword ? "default" : "outline"}
                    onClick={() => {
                      setRemovePassword(!removePassword);
                      if (!removePassword) setPassword("");
                    }}
                    className="shrink-0"
                  >
                    {removePassword ? "Undo" : "Remove Password"}
                  </Button>
                </div>
              )}

              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  disabled={removePassword}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={
                    room.hasPassword
                      ? "Enter new password to change (or leave empty)"
                      : "Set a password to protect this room (optional)"
                  }
                  className="pl-11 pr-11"
                />
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  disabled={removePassword}
                  onClick={() => setShowPassword(!showPassword)}
                  title={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>

              <p className="text-[11px] leading-relaxed text-muted-foreground">
                {room.hasPassword
                  ? "Leave blank to keep existing password, or type a new one to update it."
                  : "Collaborators will be asked to enter this password before entering."}
              </p>
            </div>
          )}

          {isOwner && (
            <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-secondary/40 p-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="shrink-0 rounded-lg border border-border bg-surface p-2">
                  {isPublic ? (
                    <Globe className="h-5 w-5 text-accent" />
                  ) : (
                    <Lock className="h-5 w-5 text-amber-400" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-foreground">
                    {isPublic ? "Public Access" : "Private Access"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {isPublic
                      ? "Visible to anyone with the room code"
                      : "Restricted room accessible only via invite"}
                  </div>
                </div>
              </div>
              <Switch checked={isPublic} onCheckedChange={setIsPublic} />
            </div>
          )}

          {isOwner && (
            <div className="mt-2 space-y-2.5 border-t border-destructive/20 pt-5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-destructive">
                Danger Zone
              </h3>
              <div className="flex flex-col justify-between gap-4 rounded-xl border border-destructive/30 bg-destructive/10 p-4 sm:flex-row sm:items-center">
                <div className="min-w-0">
                  <h4 className="text-sm font-semibold text-red-300">
                    Delete Room
                  </h4>
                  <p className="mt-1 text-xs leading-relaxed text-red-400/80">
                    Permanently delete this room, its code files, and
                    conversation history.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setConfirmDeleteOpen(true)}
                  disabled={deleting}
                  className="w-full shrink-0 sm:w-auto"
                >
                  {deleting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  <span>Delete Room</span>
                </Button>
              </div>
            </div>
          )}

          {isOwner && (
            <div className="flex items-center justify-end gap-3 border-t border-border pt-4">
              <Button type="button" variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                <span>Save Changes</span>
              </Button>
            </div>
          )}
        </form>
      </DialogContent>

      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this room?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete room{" "}
              <span className="font-semibold text-foreground">
                {room.name}
              </span>
              ? All files and messages will be permanently deleted. This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteRoom}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              <Trash2 className="h-4 w-4" />
              <span>Delete Room</span>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
