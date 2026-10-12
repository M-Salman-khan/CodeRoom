"use client";

import { useState, useEffect } from "react";
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
  KeyRound,
  FileText,
  Eye,
  EyeOff,
  Unlock,
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
  const [showPassword, setShowPassword] = useState(false);
  const [isPublic, setIsPublic] = useState(room.isPublic);

  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Sync state when modal opens or room prop changes
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

  // Handle ESC key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const getAuthHeaders = () => {
    const token =
      typeof window !== "undefined"
        ? sessionStorage.getItem("coderoom_token") || localStorage.getItem("coderoom_token") || ""
        : "";
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return headers;
  };

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
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to update room settings.");
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
    const confirmed = window.confirm(
      `Are you sure you want to delete room "${room.name}"? All files and messages will be permanently deleted.`
    );
    if (!confirmed) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/rooms/${room.id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
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
    <div
      className="fixed inset-0 z-50 flex flex-col sm:items-center sm:justify-center sm:p-4 md:p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150 overflow-hidden"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Modal Dialog Card */}
      <div className="bg-surface sm:border sm:border-border sm:rounded-2xl w-full sm:max-w-xl h-full sm:h-auto sm:max-h-[88vh] flex flex-col shadow-2xl overflow-hidden my-auto">
        {/* Sticky Header */}
        <div className="flex items-center justify-between px-4 py-3.5 sm:px-6 sm:py-4 border-b border-border bg-panel-header shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-9 w-9 rounded-xl bg-accent/15 border border-accent/30 text-accent flex items-center justify-center shrink-0">
              <Settings className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="font-semibold text-base sm:text-lg text-foreground truncate">
                Room Settings
              </h2>
              <p className="text-xs text-muted font-mono truncate">
                Code: {room.roomCode}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-muted hover:text-foreground p-2 rounded-lg hover:bg-surface-hover transition-colors shrink-0"
            title="Close modal (Esc)"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form
          id="room-settings-form"
          onSubmit={handleUpdate}
          className="flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6 space-y-5 sm:space-y-6 overscroll-contain"
        >
          {error && (
            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2.5">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2.5">
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

          {/* Room Name */}
          <div>
            <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-2">
              Room Name
            </label>
            <div className="relative flex items-center">
              <FileText className="absolute left-3.5 h-4 w-4 text-muted pointer-events-none z-10" />
              <input
                type="text"
                disabled={!isOwner}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Enter room name"
                className="input-base w-full pl-11 pr-4 py-3 text-sm font-medium rounded-xl disabled:opacity-60"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-2">
              Description
            </label>
            <textarea
              rows={3}
              disabled={!isOwner}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this room's purpose..."
              className="input-base w-full p-3.5 text-sm rounded-xl disabled:opacity-60 resize-none leading-relaxed min-h-[90px]"
            />
          </div>

          {/* Room Password Section */}
          {isOwner && (
            <div className="pt-1 space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-muted uppercase tracking-wider">
                  Room Password
                </label>
                {room.hasPassword && !removePassword && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[10px] font-semibold">
                    <Lock className="h-3 w-3" />
                    Protected
                  </span>
                )}
              </div>

              {/* Status Banner when room already has password */}
              {room.hasPassword && (
                <div className="p-3 rounded-xl bg-panel border border-border flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 text-xs">
                    {removePassword ? (
                      <>
                        <Unlock className="h-4 w-4 text-rose-400 shrink-0" />
                        <span className="text-rose-400 font-medium">Password will be removed on save</span>
                      </>
                    ) : (
                      <>
                        <Lock className="h-4 w-4 text-amber-400 shrink-0" />
                        <span className="text-muted">Password protection is currently enabled</span>
                      </>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setRemovePassword(!removePassword);
                      if (!removePassword) setPassword("");
                    }}
                    className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors shrink-0 ${
                      removePassword
                        ? "bg-accent text-white"
                        : "bg-surface border border-border text-muted hover:text-rose-400"
                    }`}
                  >
                    {removePassword ? "Undo" : "Remove Password"}
                  </button>
                </div>
              )}

              {/* Password Input */}
              <div className="relative flex items-center">
                <KeyRound className="absolute left-3.5 h-4 w-4 text-muted pointer-events-none z-10" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  disabled={removePassword}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={
                    room.hasPassword
                      ? "Enter new password to change (or leave empty)"
                      : "Set a password to protect this room (optional)"
                  }
                  className="input-base w-full pl-11 pr-11 py-3 text-sm font-medium rounded-xl disabled:opacity-40"
                />
                <button
                  type="button"
                  disabled={removePassword}
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 p-1.5 rounded-lg text-muted hover:text-foreground transition-colors disabled:opacity-40"
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>

              <p className="text-[11px] text-muted leading-relaxed">
                {room.hasPassword
                  ? "Leave blank to keep existing password, or type a new one to update it."
                  : "Collaborators will be asked to enter this password before entering."}
              </p>
            </div>
          )}

          {/* Access Level Toggle */}
          {isOwner && (
            <div className="pt-1">
              <div className="flex items-center justify-between gap-4 p-4 rounded-xl bg-panel border border-border">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="shrink-0 p-2 rounded-lg bg-surface border border-border">
                    {isPublic ? (
                      <Globe className="h-5 w-5 text-accent" />
                    ) : (
                      <Lock className="h-5 w-5 text-amber-400" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-foreground truncate">
                      {isPublic ? "Public Access" : "Private Access"}
                    </div>
                    <div className="text-xs text-muted truncate sm:whitespace-normal">
                      {isPublic
                        ? "Visible to anyone with the room code"
                        : "Restricted room accessible only via invite"}
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
          )}

          {/* Danger Zone: Delete Room */}
          {isOwner && (
            <div className="mt-8 pt-6 border-t border-red-500/20 pb-4">
              <h3 className="text-xs font-bold text-red-400 uppercase tracking-wider mb-2.5">
                Danger Zone
              </h3>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-red-500/10 border border-red-500/30">
                <div className="min-w-0">
                  <h4 className="text-sm font-semibold text-red-300">Delete Room</h4>
                  <p className="text-xs text-red-400/80 mt-1 leading-relaxed">
                    Permanently delete this room, its code files, and conversation history.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleDeleteRoom}
                  disabled={deleting}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold flex items-center justify-center gap-2 shrink-0 transition-colors shadow-sm disabled:opacity-50"
                >
                  {deleting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  <span>Delete Room</span>
                </button>
              </div>
            </div>
          )}
        </form>

        {/* Sticky Action Footer */}
        {isOwner && (
          <div className="px-4 py-3 sm:px-6 sm:py-4 border-t border-border bg-panel-header/95 backdrop-blur flex items-center justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-border text-muted hover:text-foreground hover:bg-surface-hover text-xs font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="room-settings-form"
              disabled={loading}
              className="px-5 py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-semibold flex items-center justify-center gap-2 disabled:opacity-50 transition-colors shadow-md shadow-accent/20"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              <span>Save Changes</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
