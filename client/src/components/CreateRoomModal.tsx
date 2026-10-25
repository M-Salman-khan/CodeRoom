import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Lock, Globe, FileCode2, Loader2, AlertCircle } from "lucide-react";

import { apiFetch, errorMessage } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface CreateRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (room: { id: string; roomCode: string }) => void;
}

export default function CreateRoomModal({
  isOpen,
  onClose,
  onSuccess,
}: CreateRoomModalProps) {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [password, setPassword] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmed = name.trim();
    if (!trimmed) {
      setError("Room name is required.");
      return;
    }

    setLoading(true);

    try {
      const res = await apiFetch("/api/rooms", {
        method: "POST",
        body: JSON.stringify({
          name: trimmed,
          description: description.trim() || undefined,
          password: password ? password.trim() : undefined,
          isPublic,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(errorMessage(data, "Failed to create room."));
        setLoading(false);
        return;
      }

      onClose();
      if (onSuccess) {
        onSuccess(data.room);
      } else {
        navigate(`/room/${data.room.roomCode}`);
      }
    } catch {
      setError("Network error. Could not connect to server.");
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader className="flex-row items-center gap-3 space-y-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-accent/30 bg-accent/15 text-accent">
            <Plus className="h-4 w-4" />
          </div>
          <div className="space-y-1">
            <DialogTitle>Create a Collaborative Room</DialogTitle>
            <DialogDescription>
              Spin up a real-time coding workspace in seconds.
            </DialogDescription>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3.5 text-xs text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="roomName">
              Room Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="roomName"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. My Next.js Project"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="roomDescription">
              Description{" "}
              <span className="font-normal normal-case text-muted-foreground/70">
                (optional)
              </span>
            </Label>
            <Input
              id="roomDescription"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief summary of what you are building..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="roomPassword">
              Room Password{" "}
              <span className="font-normal normal-case text-muted-foreground/70">
                (optional)
              </span>
            </Label>
            <div className="relative group">
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-accent" />
              <Input
                id="roomPassword"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Leave blank for open access"
                className="pl-10"
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              If set, collaborators must enter this password to join the room.
            </p>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border bg-secondary/40 p-3.5">
            <div className="flex items-center gap-3">
              {isPublic ? (
                <Globe className="h-5 w-5 text-accent" />
              ) : (
                <Lock className="h-5 w-5 text-amber-400" />
              )}
              <div>
                <div className="text-sm font-medium text-foreground">
                  {isPublic ? "Public Access" : "Private Access"}
                </div>
                <div className="text-xs text-muted-foreground">
                  {isPublic
                    ? "Anyone with the room code or link can join"
                    : "Only invited or authorized users can access"}
                </div>
              </div>
            </div>
            <Switch checked={isPublic} onCheckedChange={setIsPublic} />
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-border pt-4">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Creating...</span>
                </>
              ) : (
                <>
                  <FileCode2 className="h-4 w-4" />
                  <span>Create Room</span>
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
