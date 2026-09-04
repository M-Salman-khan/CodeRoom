"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  X,
  Settings,
  Lock,
  Globe,
  Trash2,
  Loader2,
  AlertCircle,
  Check,
  Shield,
} from "lucide-react";

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
  const router = useRouter();

  const [name, setName] = useState(room.name);
  const [description, setDescription] = useState(room.description || "");
  const [password, setPassword] = useState("");
  const [removePassword, setRemovePassword] = useState(false);
  const [isPublic, setIsPublic] = useState(room.isPublic);

  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

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

      const res = await fetch(`/api/rooms/${room.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to update settings.");
        setLoading(false);
        return;
      }

      setSuccess("Room settings saved successfully!");
      if (onUpdated) onUpdated();
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch {
      setError("Network error. Could not update room.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRoom = async () => {
    if (!isOwner) return;
    const confirmed = window.confirm(
      `Are you sure you want to delete room "${room.name}"? All files and messages will be permanently deleted.`
    );
    if (!confirmed) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/rooms/${room.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        setError("Failed to delete room.");
        setDeleting(false);
        return;
      }

      router.push("/dashboard");
    } catch {
      setError("Network error while deleting room.");
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-accent/15 border border-accent/30 text-accent flex items-center justify-center">
              <Settings className="h-4 w-4" />
            </div>
            <div>
              <h2 className="font-semibold text-base text-foreground">Room Settings</h2>
              <p className="text-xs text-muted font-mono">{room.roomCode}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-muted hover:text-foreground p-1 rounded-lg hover:bg-surface-hover transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {error && (
            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
              <Check className="h-4 w-4 shrink-0" />
              <span>{success}</span>
            </div>
          )}

          {!isOwner && (
            <div className="p-3.5 rounded-xl bg-panel border border-border text-muted text-xs flex items-center gap-2.5">
              <Shield className="h-4 w-4 text-accent shrink-0" />
              <span>You are viewing this room as a member. Only the owner can modify room settings.</span>
            </div>
          )}

          <form onSubmit={handleUpdate} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-2">
                Room Name
              </label>
              <input
                type="text"
                disabled={!isOwner}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 rounded-xl bg-panel border border-border text-foreground text-sm focus:outline-none focus:border-accent disabled:opacity-60 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-2">
                Description
              </label>
              <textarea
                rows={3}
                disabled={!isOwner}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Room description..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-panel border border-border text-foreground text-sm focus:outline-none focus:border-accent disabled:opacity-60 transition-colors resize-none"
              />
            </div>

            {isOwner && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-2">
                    Room Password
                  </label>
                  <div className="space-y-2">
                    <input
                      type="password"
                      value={password}
                      disabled={removePassword}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={room.hasPassword ? "Leave blank to keep existing password" : "Set new password"}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-panel border border-border text-foreground text-sm focus:outline-none focus:border-accent disabled:opacity-40 transition-colors"
                    />

                    {room.hasPassword && (
                      <label className="flex items-center gap-2 text-xs text-muted cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={removePassword}
                          onChange={(e) => {
                            setRemovePassword(e.target.checked);
                            if (e.target.checked) setPassword("");
                          }}
                          className="h-3.5 w-3.5 rounded border-border bg-panel text-accent"
                        />
                        <span>Remove password protection from this room</span>
                      </label>
                    )}
                  </div>
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
                          {isPublic ? "Visible to anyone with the code" : "Restricted room"}
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

                <div className="pt-4 flex justify-end">
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-5 py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-semibold flex items-center gap-2 disabled:opacity-50 transition-colors shadow-sm"
                  >
                    {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    <span>Save Changes</span>
                  </button>
                </div>
              </>
            )}
          </form>

          {/* Danger Zone: Delete Room */}
          {isOwner && (
            <div className="mt-8 pt-6 border-t border-red-500/20">
              <h3 className="text-xs font-bold text-red-400 uppercase tracking-wider mb-2">
                Danger Zone
              </h3>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/30">
                <div>
                  <h4 className="text-sm font-semibold text-red-300">Delete Room</h4>
                  <p className="text-xs text-red-400/80">
                    Permanently delete this room and all associated code files and messages.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleDeleteRoom}
                  disabled={deleting}
                  className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold flex items-center gap-2 shrink-0 transition-colors shadow-sm disabled:opacity-50"
                >
                  {deleting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                  <span>Delete Room</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
