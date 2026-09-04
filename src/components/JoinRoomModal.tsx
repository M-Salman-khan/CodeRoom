"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, LogIn, Lock, KeyRound, Loader2, AlertCircle } from "lucide-react";

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
  const router = useRouter();
  const [roomCode, setRoomCode] = useState(initialRoomCode);
  const [password, setPassword] = useState("");
  const [needsPassword, setNeedsPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

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
      const res = await fetch(`/api/rooms/${code}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password: password.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.requiresPassword) {
          setNeedsPassword(true);
          setError(data.error || "Password required to enter this room.");
        } else {
          setError(data.error || "Room not found or could not join.");
        }
        setLoading(false);
        return;
      }

      onClose();
      router.push(`/room/${data.roomCode || code}`);
    } catch {
      setError("Network error. Could not connect to server.");
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-accent/15 border border-accent/30 text-accent flex items-center justify-center">
              <LogIn className="h-4 w-4" />
            </div>
            <h2 className="font-semibold text-lg text-foreground">Join a Code Room</h2>
          </div>
          <button
            onClick={onClose}
            className="text-muted hover:text-foreground p-1 rounded-lg hover:bg-surface-hover transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-2">
              Room Code <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
              <input
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                placeholder="e.g. X7K29P"
                required
                autoFocus
                maxLength={10}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-panel border border-border text-foreground font-mono placeholder:font-sans placeholder:text-muted/60 text-sm focus:outline-none focus:border-accent uppercase tracking-wider transition-colors"
              />
            </div>
            <p className="text-[11px] text-muted mt-1.5">
              Enter the 6-character room code shared by your collaborator.
            </p>
          </div>

          {needsPassword && (
            <div className="animate-in fade-in slide-in-from-top-1 duration-200">
              <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-2">
                Room Password <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter room password"
                  required
                  autoFocus
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-panel border border-border text-foreground placeholder:text-muted/60 text-sm focus:outline-none focus:border-accent transition-colors"
                />
              </div>
            </div>
          )}

          <div className="pt-4 flex items-center justify-end gap-3 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-border text-muted hover:text-foreground text-sm font-medium hover:bg-surface-hover transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-white text-sm font-semibold transition-all flex items-center gap-2 disabled:opacity-50 shadow-md shadow-accent/20"
            >
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
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
