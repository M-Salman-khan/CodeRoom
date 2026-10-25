import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogIn, Lock, KeyRound, Loader2, AlertCircle } from "lucide-react";

import { apiFetch, errorMessage } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface JoinRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialRoomCode?: string;
}

export default function JoinRoomModal({
  isOpen,
  onClose,
  initialRoomCode = "",
}: JoinRoomModalProps) {
  const navigate = useNavigate();
  const [roomCode, setRoomCode] = useState(initialRoomCode);
  const [password, setPassword] = useState("");
  const [needsPassword, setNeedsPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const code = roomCode.trim().toUpperCase();
    if (!code) {
      setError("Please enter a room code.");
      return;
    }

    setLoading(true);

    try {
      const res = await apiFetch(`/api/rooms/${code}/join`, {
        method: "POST",
        body: JSON.stringify({
          password: password.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.requiresPassword) {
          setNeedsPassword(true);
          setError(errorMessage(data, "Password required to enter this room."));
        } else {
          setError(errorMessage(data, "Room not found or could not join."));
        }
        setLoading(false);
        return;
      }

      onClose();
      navigate(`/room/${data.roomCode || code}`);
    } catch {
      setError("Network error. Could not connect to server.");
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader className="flex-row items-center gap-3 space-y-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-accent/30 bg-accent/15 text-accent">
            <LogIn className="h-4 w-4" />
          </div>
          <div className="space-y-1">
            <DialogTitle>Join a Code Room</DialogTitle>
            <DialogDescription>
              Enter a room code to jump into a session.
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
            <Label htmlFor="joinRoomCode">
              Room Code <span className="text-destructive">*</span>
            </Label>
            <div className="relative group">
              <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-accent" />
              <Input
                id="joinRoomCode"
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                placeholder="e.g. X7K29PQR"
                required
                maxLength={10}
                className="pl-10 font-mono uppercase tracking-[0.2em]"
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              Enter the room code shared by your collaborator.
            </p>
          </div>

          {needsPassword && (
            <div className="space-y-2 duration-200 animate-in fade-in slide-in-from-top-1">
              <Label htmlFor="joinPassword">
                Room Password <span className="text-destructive">*</span>
              </Label>
              <div className="relative group">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-accent" />
                <Input
                  id="joinPassword"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter room password"
                  required
                  className="pl-10"
                />
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 border-t border-border pt-4">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Joining...</span>
                </>
              ) : (
                <>
                  <LogIn className="h-4 w-4" />
                  <span>Join Room</span>
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
