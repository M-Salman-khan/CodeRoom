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
} from "lucide-react";
import { getUserColor, getInitials } from "@/lib/utils";

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
  onOpenShare: () => void;
  onOpenSettings: () => void;
}

export default function RoomHeader({
  roomName,
  roomCode,
  connectionStatus,
  onlineUsers,
  onOpenShare,
  onOpenSettings,
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
    <header className="h-14 bg-panel-header border-b border-border flex items-center justify-between px-3 md:px-5 select-none shrink-0 z-30">
      {/* Left: Brand + Room Name + Room Code */}
      <div className="flex items-center gap-3 md:gap-4 min-w-0">
        <Link
          href="/dashboard"
          title="Back to Dashboard"
          className="flex items-center gap-2 text-foreground hover:text-accent transition-colors group shrink-0"
        >
          <div className="h-7 w-7 rounded-lg bg-accent/15 border border-accent/30 text-accent flex items-center justify-center group-hover:scale-105 transition-transform">
            <Code2 className="h-4 w-4" />
          </div>
          <span className="font-bold text-sm hidden sm:inline tracking-tight">
            Code<span className="text-accent">Room</span>
          </span>
        </Link>

        <div className="h-4 w-[1px] bg-border hidden sm:block shrink-0" />

        {/* Room Name */}
        <div className="flex items-center gap-2 min-w-0">
          <h1 className="font-semibold text-xs md:text-sm text-foreground truncate max-w-[120px] sm:max-w-[200px] md:max-w-[280px]">
            {roomName}
          </h1>

          {/* Room Code Badge */}
          <button
            onClick={copyCode}
            title="Click to copy room code"
            className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-surface border border-border/80 text-[11px] font-mono text-muted hover:text-foreground hover:border-accent/40 transition-colors shrink-0"
          >
            <span>{roomCode}</span>
            {copied ? (
              <Check className="h-3 w-3 text-green-400" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
          </button>
        </div>
      </div>

      {/* Right: Connection Status + Online Users + Actions */}
      <div className="flex items-center gap-2 md:gap-3 shrink-0">
        {/* Connection Status Indicator */}
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-surface/80 border border-border/60 text-xs">
          {connectionStatus === "connected" && (
            <>
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-emerald-400 text-[11px] font-medium hidden md:inline">
                Connected
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
                Disconnected
              </span>
            </>
          )}
        </div>

        {/* Online Users List / Popover */}
        <div className="relative">
          <button
            onClick={() => setShowUsersDropdown(!showUsersDropdown)}
            className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-surface/80 border border-border/60 hover:bg-surface text-xs text-muted hover:text-foreground transition-colors"
          >
            <span className="h-2 w-2 rounded-full bg-green-500 shrink-0" />
            <span className="text-[11px] font-medium">
              {onlineUsers.length} <span className="hidden sm:inline">Online</span>
            </span>

            {/* Micro Avatars */}
            <div className="hidden lg:flex items-center -space-x-1.5 ml-1">
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
              <div className="absolute right-0 top-full mt-1.5 w-48 bg-surface border border-border rounded-xl shadow-xl p-2 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                <div className="text-[10px] uppercase tracking-wider font-semibold text-muted px-2 py-1 mb-1">
                  Active Users ({onlineUsers.length})
                </div>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {onlineUsers.map((u) => {
                    const color = getUserColor(u.username);
                    return (
                      <div
                        key={u.id}
                        className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-panel transition-colors text-xs text-foreground"
                      >
                        <span
                          className="h-2 w-2 rounded-full shrink-0"
                          style={{ backgroundColor: color }}
                        />
                        <span className="font-medium truncate">{u.username}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Share Button */}
        <button
          onClick={onOpenShare}
          title="Share room link and code"
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-accent/15 hover:bg-accent/25 border border-accent/30 text-accent text-xs font-semibold transition-colors"
        >
          <Share2 className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Share</span>
        </button>

        {/* Settings Button */}
        <button
          onClick={onOpenSettings}
          title="Room settings"
          className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-surface transition-colors"
        >
          <Settings className="h-4 w-4" />
        </button>

        {/* Leave Room Button */}
        <button
          onClick={handleLeave}
          title="Leave room"
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors text-xs font-medium"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Leave</span>
        </button>
      </div>
    </header>
  );
}
