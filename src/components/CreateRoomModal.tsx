"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, Plus, Lock, Globe, FileCode2, Loader2, AlertCircle } from "lucide-react";

interface CreateRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (room: { id: string; roomCode: string }) => void;
}

export default function CreateRoomModal({ isOpen, onClose, onSuccess }: CreateRoomModalProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [password, setPassword] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

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
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmed,
          description: description.trim() || undefined,
          password: password ? password.trim() : undefined,
          isPublic,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to create room.");
        setLoading(false);
        return;
      }

      onClose();
      if (onSuccess) {
        onSuccess(data.room);
      } else {
        router.push(`/room/${data.room.roomCode}`);
      }
    } catch {
      setError("Network error. Could not connect to server.");
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-accent/15 border border-accent/30 text-accent flex items-center justify-center">
              <Plus className="h-4 w-4" />
            </div>
            <h2 className="font-semibold text-lg text-foreground">Create a Collaborative Room</h2>
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
              Room Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. My Next.js Project"
              required
              autoFocus
              className="w-full px-3.5 py-2.5 rounded-xl bg-panel border border-border text-foreground placeholder:text-muted/60 text-sm focus:outline-none focus:border-accent transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-2">
              Description (Optional)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief summary of what you are building..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-panel border border-border text-foreground placeholder:text-muted/60 text-sm focus:outline-none focus:border-accent transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-2">
              Room Password (Optional)
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Leave blank for no password"
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-panel border border-border text-foreground placeholder:text-muted/60 text-sm focus:outline-none focus:border-accent transition-colors"
              />
            </div>
            <p className="text-[11px] text-muted mt-1.5">
              If set, guests must enter this password to join the room.
            </p>
          </div>

          <div className="pt-2">
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-panel border border-border">
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
                  <div className="text-xs text-muted">
                    {isPublic
                      ? "Anyone with the room code or link can join"
                      : "Only invited or authorized users can access"}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPublic(!isPublic)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  isPublic ? "bg-accent" : "bg-border"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    isPublic ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </div>

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
                  <span>Creating...</span>
                </>
              ) : (
                <>
                  <FileCode2 className="h-4 w-4" />
                  <span>Create Room</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
