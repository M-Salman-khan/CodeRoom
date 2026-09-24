"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Code2,
  Share2,
  Settings,
  LogOut,
  Copy,
  Check,
  ChevronDown,
  RefreshCw,
  Shield,
  Keyboard,
  Maximize2,
  Minimize2,
  Users,
} from "lucide-react";
import { getUserColor, getInitials } from "@/lib/utils";
import ThemeToggle from "@/components/ThemeToggle";

export type ConnectionStatus = "connected" | "reconnecting" | "disconnected";

interface OnlineUser {
  id: string;
  username: string;
}

interface RoomHeaderProps {
  roomName: string;
  roomCode: string;
  connectionStatus: ConnectionStatus;
  onlineUsers: OnlineUser[];
  isOwner?: boolean;
  pendingRequestsCount?: number;
  members?: Array<{
    userId: string;
    username: string;
    role: string;
    canEdit: boolean;
    allowedFiles?: string[];
  }>;
  onOpenShare: () => void;
  onOpenSettings: () => void;
  onOpenPermissions?: () => void;
  onOpenShortcuts?: () => void;
  onToggleZenMode?: () => void;
  isZenMode?: boolean;
}

export default function RoomHeader({
  roomName,
  roomCode,
  connectionStatus,
  onlineUsers,
  isOwner = false,
  pendingRequestsCount = 0,
  members = [],
  onOpenShare,
  onOpenSettings,
  onOpenPermissions,
  onOpenShortcuts,
  onToggleZenMode,
  isZenMode = false,
}: RoomHeaderProps) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [showUsersDropdown, setShowUsersDropdown] = useState(false);

  const copyCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLeave = () => {
    router.push("/dashboard");
  };

  return (
    <header className="h-14 bg-panel-header/90 backdrop-blur-md border-b border-border flex items-center justify-between px-3 md:px-5 select-none shrink-0 relative z-40 transition-all">
      {/* Left: Brand + Room Name + Room Code */}
      <div className="flex items-center gap-3 md:gap-4 min-w-0">
        <Link
          href="/dashboard"
          title="Back to Dashboard"
          className="flex items-center gap-2 text-foreground hover:text-accent transition-colors group shrink-0"
        >
          <div className="h-8 w-8 rounded-xl bg-accent/15 border border-accent/30 text-accent flex items-center justify-center group-hover:scale-105 group-hover:bg-accent group-hover:text-white transition-all shadow-sm">
            <Code2 className="h-4 w-4" />
          </div>
          <span className="font-bold text-sm hidden sm:inline tracking-tight">
            Code<span className="text-accent">Room</span>
          </span>
        </Link>

        <div className="h-4 w-[1px] bg-border hidden sm:block shrink-0" />

        {/* Room Name & Code */}
        <div className="flex items-center gap-2 min-w-0">
          <h1
            title={roomName}
            className="font-semibold text-xs md:text-sm text-foreground truncate max-w-[120px] sm:max-w-[200px] md:max-w-[280px]"
          >
            {roomName}
          </h1>

          {/* Room Code Badge */}
          <button
            onClick={copyCode}
            title="Click to copy room code"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface/90 border border-border text-[11px] font-mono text-muted hover:text-foreground hover:border-accent/50 transition-all shrink-0 active:scale-95"
          >
            <span className="font-semibold text-foreground/80">{roomCode}</span>
            {copied ? (
              <Check className="h-3 w-3 text-emerald-400" />
            ) : (
              <Copy className="h-3 w-3 opacity-60" />
            )}
          </button>
        </div>
      </div>

      {/* Right: Status, Collaborators, Actions */}
      <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
        {/* Connection Status Indicator */}
        <div
          title={`Connection status: ${connectionStatus}`}
          className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface/80 border border-border/80 text-xs"
        >
          {connectionStatus === "connected" && (
            <>
              <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.7)]" />
              <span className="text-emerald-400 text-[11px] font-medium hidden md:inline">
                Live
              </span>
            </>
          )}
          {connectionStatus === "reconnecting" && (
            <>
              <RefreshCw className="h-3 w-3 text-amber-400 animate-spin" />
              <span className="text-amber-400 text-[11px] font-medium hidden md:inline">
                Reconnecting
              </span>
            </>
          )}
          {connectionStatus === "disconnected" && (
            <>
              <span className="h-2 w-2 rounded-full bg-red-500" />
              <span className="text-red-400 text-[11px] font-medium hidden md:inline">
                Offline
              </span>
            </>
          )}
        </div>

        {/* Online Collaborators Popover */}
        <div className="relative">
          <button
            onClick={() => setShowUsersDropdown(!showUsersDropdown)}
            title="View online collaborators"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface hover:bg-surface-hover border border-border text-xs text-muted hover:text-foreground transition-all shadow-sm"
          >
            <Users className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
            <span className="text-[11px] font-semibold text-foreground">
              {onlineUsers.length} <span className="hidden md:inline font-normal text-muted">active</span>
            </span>

            {/* Micro Avatars */}
            <div className="hidden lg:flex items-center -space-x-1 ml-0.5">
              {onlineUsers.slice(0, 3).map((u) => {
                const color = getUserColor(u.username);
                return (
                  <div
                    key={u.id}
                    style={{ borderColor: color }}
                    title={u.username}
                    className="h-5 w-5 rounded-full bg-panel border text-[9px] font-bold text-white flex items-center justify-center shrink-0 shadow-sm"
                  >
                    {getInitials(u.username)}
                  </div>
                );
              })}
              {onlineUsers.length > 3 && (
                <div className="h-5 w-5 rounded-full bg-surface border border-border text-[9px] text-muted flex items-center justify-center shrink-0">
                  +{onlineUsers.length - 3}
                </div>
              )}
            </div>

            <ChevronDown className="h-3 w-3 opacity-60 ml-0.5" />
          </button>

          {/* Dropdown list of online users */}
          {showUsersDropdown && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowUsersDropdown(false)}
              />
              <div className="absolute right-0 top-full mt-1.5 w-60 bg-surface border border-border rounded-xl shadow-2xl p-2.5 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                <div className="flex items-center justify-between px-2 py-1 mb-1 border-b border-border/60 pb-1.5">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-muted">
                    Collaborators ({onlineUsers.length})
                  </span>
                  {onOpenPermissions && (
                    <button
                      onClick={() => {
                        setShowUsersDropdown(false);
                        onOpenPermissions();
                      }}
                      className="text-[10px] text-accent hover:underline font-semibold"
                    >
                      Manage Access
                    </button>
                  )}
                </div>
                <div className="space-y-1 max-h-52 overflow-y-auto">
                  {onlineUsers.map((u) => {
                    const color = getUserColor(u.username);
                    const memberInfo = members.find((m) => m.userId === u.id);
                    const isUserOwner = memberInfo?.role === "OWNER";
                    const canEditUser = isUserOwner || Boolean(memberInfo?.canEdit);

                    return (
                      <div
                        key={u.id}
                        className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg hover:bg-panel transition-colors text-xs text-foreground"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="h-2 w-2 rounded-full shrink-0"
                            style={{ backgroundColor: color }}
                          />
                          <span className="font-medium truncate">{u.username}</span>
                        </div>

                        <span
                          className={`text-[9px] font-medium px-1.5 py-0.5 rounded shrink-0 ${
                            isUserOwner
                              ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                              : canEditUser
                              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                              : "bg-surface border border-border text-muted"
                          }`}
                        >
                          {isUserOwner ? "Owner" : canEditUser ? "Editor" : "Viewer"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Permissions / Access Button */}
        {onOpenPermissions && (
          <button
            onClick={onOpenPermissions}
            title={isOwner ? "Manage file edit permissions" : "View collaboration permissions"}
            className="relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface hover:bg-surface-hover border border-border text-foreground text-xs font-semibold transition-all shadow-sm active:scale-95"
          >
            <Shield className="h-3.5 w-3.5 text-accent" />
            <span className="hidden md:inline">Access</span>
            {pendingRequestsCount > 0 && (
              <span className="h-4 min-w-[16px] px-1 rounded-full bg-amber-500 text-slate-950 text-[10px] font-bold flex items-center justify-center animate-pulse">
                {pendingRequestsCount}
              </span>
            )}
          </button>
        )}

        {/* Share Button */}
        <button
          onClick={onOpenShare}
          title="Share room link & code"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-accent/15 hover:bg-accent/25 border border-accent/30 text-accent text-xs font-semibold transition-all shadow-sm active:scale-95"
        >
          <Share2 className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Share</span>
        </button>

        {/* Theme Switcher */}
        <ThemeToggle compact />

        {/* Focus / Zen Mode Toggle */}
        {onToggleZenMode && (
          <button
            onClick={onToggleZenMode}
            title={isZenMode ? "Exit Focus Mode (F11)" : "Focus Mode (F11)"}
            className={`p-1.5 rounded-lg border transition-all ${
              isZenMode
                ? "bg-accent/20 border-accent/40 text-accent"
                : "bg-surface border-border text-muted hover:text-foreground hover:bg-surface-hover"
            }`}
          >
            {isZenMode ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </button>
        )}

        {/* Keyboard Shortcuts Button */}
        {onOpenShortcuts && (
          <button
            onClick={onOpenShortcuts}
            title="Keyboard Shortcuts (?)"
            className="p-1.5 rounded-lg bg-surface border border-border text-muted hover:text-foreground hover:bg-surface-hover transition-colors hidden sm:block"
          >
            <Keyboard className="h-4 w-4" />
          </button>
        )}

        {/* Settings Button */}
        <button
          onClick={onOpenSettings}
          title="Room settings"
          className="p-1.5 rounded-lg bg-surface border border-border text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
        >
          <Settings className="h-4 w-4" />
        </button>

        {/* Leave Room Button */}
        <button
          onClick={handleLeave}
          title="Leave room"
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-muted hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all text-xs font-medium"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Leave</span>
        </button>
      </div>
    </header>
  );
}
