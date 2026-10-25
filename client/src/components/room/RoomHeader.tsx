import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
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
  MoreVertical,
} from "lucide-react";

import { getUserColor, getInitials, cn } from "@/lib/utils";
import ThemeToggle from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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

const CONNECTION_META: Record<
  ConnectionStatus,
  { label: string; className: string; dot: string }
> = {
  connected: {
    label: "Live",
    className: "text-emerald-400",
    dot: "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.7)]",
  },
  reconnecting: { label: "Reconnecting", className: "text-amber-400", dot: "" },
  disconnected: { label: "Offline", className: "text-red-400", dot: "bg-red-500" },
};

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
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  const copyCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLeave = () => {
    navigate("/dashboard");
  };

  const connection = CONNECTION_META[connectionStatus];

  return (
    <header className="relative z-40 flex h-14 shrink-0 select-none items-center justify-between border-b border-border bg-panel-header/90 px-3 backdrop-blur-md transition-all md:px-5">
      {/* Left: brand + room identity */}
      <div className="flex min-w-0 items-center gap-3 md:gap-4">
        <Link
          to="/dashboard"
          title="Back to Dashboard"
          className="group flex shrink-0 items-center gap-2 text-foreground transition-colors hover:text-accent"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-accent/30 bg-accent/15 text-accent shadow-sm transition-all group-hover:scale-105 group-hover:bg-accent group-hover:text-primary-foreground">
            <Code2 className="h-4 w-4" />
          </div>
          <span className="hidden text-sm font-bold tracking-tight sm:inline">
            Code<span className="text-accent">Room</span>
          </span>
        </Link>

        <div className="hidden h-4 w-px bg-border sm:block" />

        <div className="flex min-w-0 items-center gap-2">
          <h1
            title={roomName}
            className="max-w-[92px] truncate text-xs font-semibold text-foreground sm:max-w-[200px] md:max-w-[280px] md:text-sm"
          >
            {roomName}
          </h1>

          <Button
            variant="outline"
            size="sm"
            onClick={copyCode}
            title="Click to copy room code"
            className="hidden shrink-0 gap-1.5 bg-surface/90 px-2.5 font-mono text-[11px] sm:inline-flex"
          >
            <span className="font-semibold text-foreground/80">{roomCode}</span>
            {copied ? (
              <Check className="h-3 w-3 text-emerald-400" />
            ) : (
              <Copy className="h-3 w-3 opacity-60" />
            )}
          </Button>
        </div>
      </div>

      {/* Right: status, collaborators, actions */}
      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        <div
          className={cn(
            "hidden items-center gap-1.5 rounded-lg border border-border/80 bg-surface/80 px-2.5 py-1 text-xs sm:flex",
            connection.className
          )}
        >
          {connectionStatus === "reconnecting" ? (
            <RefreshCw className="h-3 w-3 animate-spin" />
          ) : (
            <span className={cn("h-2 w-2 rounded-full", connection.dot)} />
          )}
          <span className="hidden text-[11px] font-medium md:inline">
            {connection.label}
          </span>
        </div>

        {/* Online collaborators */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              title="View online collaborators"
              className="gap-1.5 bg-surface px-2.5"
            >
              <Users className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
              <span className="text-[11px] font-semibold text-foreground">
                {onlineUsers.length}{" "}
                <span className="hidden font-normal text-muted-foreground md:inline">
                  active
                </span>
              </span>
              <div className="ml-0.5 hidden items-center -space-x-1 lg:flex">
                {onlineUsers.slice(0, 3).map((u) => (
                  <Avatar
                    key={u.id}
                    className="h-5 w-5"
                    style={{ borderColor: getUserColor(u.username) }}
                  >
                    <AvatarFallback className="text-[9px]">
                      {getInitials(u.username)}
                    </AvatarFallback>
                  </Avatar>
                ))}
                {onlineUsers.length > 3 && (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full border border-border bg-surface text-[9px] text-muted-foreground">
                    +{onlineUsers.length - 3}
                  </span>
                )}
              </div>
              <ChevronDown className="ml-0.5 h-3 w-3 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel className="flex items-center justify-between">
              <span>Collaborators ({onlineUsers.length})</span>
              {onOpenPermissions && (
                <button
                  onClick={onOpenPermissions}
                  className="text-[10px] font-semibold normal-case text-accent hover:underline"
                >
                  Manage Access
                </button>
              )}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <div className="max-h-52 space-y-0.5 overflow-y-auto">
              {onlineUsers.map((u) => {
                const memberInfo = members.find((m) => m.userId === u.id);
                const isUserOwner = memberInfo?.role === "OWNER";
                const canEditUser = isUserOwner || Boolean(memberInfo?.canEdit);

                return (
                  <div
                    key={u.id}
                    className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-xs text-foreground"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: getUserColor(u.username) }}
                      />
                      <span className="truncate font-medium">{u.username}</span>
                    </div>

                    <Badge
                      variant={
                        isUserOwner
                          ? "warning"
                          : canEditUser
                            ? "success"
                            : "outline"
                      }
                      className="shrink-0"
                    >
                      {isUserOwner ? "Owner" : canEditUser ? "Editor" : "Viewer"}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        {onOpenPermissions && (
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenPermissions}
            title={
              isOwner
                ? "Manage file edit permissions"
                : "View collaboration permissions"
            }
            className="hidden gap-1.5 bg-surface md:flex"
          >
            <Shield className="h-3.5 w-3.5 text-accent" />
            <span>Access</span>
            {pendingRequestsCount > 0 && (
              <Badge
                variant="warning"
                className="animate-pulse px-1.5 py-0 text-[10px]"
              >
                {pendingRequestsCount}
              </Badge>
            )}
          </Button>
        )}

        <Button
          variant="subtle"
          size="sm"
          onClick={onOpenShare}
          title="Share room link & code"
          className="shrink-0"
        >
          <Share2 className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Share</span>
        </Button>

        <div className="hidden md:block">
          <ThemeToggle compact />
        </div>

        {onToggleZenMode && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={isZenMode ? "subtle" : "outline"}
                size="icon-sm"
                onClick={onToggleZenMode}
                className="hidden bg-surface md:inline-flex"
              >
                {isZenMode ? (
                  <Minimize2 className="h-4 w-4" />
                ) : (
                  <Maximize2 className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {isZenMode ? "Exit Focus Mode (F11)" : "Focus Mode (F11)"}
            </TooltipContent>
          </Tooltip>
        )}

        {onOpenShortcuts && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon-sm"
                onClick={onOpenShortcuts}
                className="hidden bg-surface lg:inline-flex"
              >
                <Keyboard className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Keyboard Shortcuts (?)</TooltipContent>
          </Tooltip>
        )}

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={onOpenSettings}
              className="hidden bg-surface md:inline-flex"
            >
              <Settings className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Room settings</TooltipContent>
        </Tooltip>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleLeave}
          className="hidden gap-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive md:flex"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span>Leave</span>
        </Button>

        {/* Mobile more actions */}
        <div className="md:hidden">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="icon-sm"
                title="More actions"
                className="relative bg-surface"
              >
                <MoreVertical className="h-4 w-4" />
                {pendingRequestsCount > 0 && (
                  <span className="absolute -right-1 -top-1 h-3 w-3 animate-pulse rounded-full border-2 border-panel-header bg-amber-500" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {onOpenPermissions && (
                <DropdownMenuItem onSelect={onOpenPermissions}>
                  <Shield className="h-4 w-4 text-accent" />
                  <span>
                    {isOwner ? "Manage Permissions" : "View Permissions"}
                  </span>
                  {pendingRequestsCount > 0 && (
                    <Badge variant="warning" className="ml-auto">
                      {pendingRequestsCount}
                    </Badge>
                  )}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onSelect={onOpenSettings}>
                <Settings className="h-4 w-4" />
                <span>Room Settings</span>
              </DropdownMenuItem>
              {onToggleZenMode && (
                <DropdownMenuItem onSelect={onToggleZenMode}>
                  {isZenMode ? (
                    <>
                      <Minimize2 className="h-4 w-4 text-accent" />
                      <span>Exit Focus Mode</span>
                    </>
                  ) : (
                    <>
                      <Maximize2 className="h-4 w-4" />
                      <span>Enter Focus Mode</span>
                    </>
                  )}
                </DropdownMenuItem>
              )}
              {onOpenShortcuts && (
                <DropdownMenuItem onSelect={onOpenShortcuts}>
                  <Keyboard className="h-4 w-4" />
                  <span>Keyboard Shortcuts</span>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <div className="flex items-center justify-between px-2 py-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Theme
                </span>
                <ThemeToggle compact />
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={handleLeave}
                className="text-destructive focus:bg-destructive/10 focus:text-destructive"
              >
                <LogOut className="h-4 w-4" />
                <span>Leave Room</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
