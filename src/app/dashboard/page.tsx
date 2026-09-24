"use client";

import { useEffect, useState, useCallback, Suspense, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Code2,
  LayoutDashboard,
  FolderGit2,
  Plus,
  LogIn,
  Settings,
  LogOut,
  Users,
  Clock,
  Lock,
  Globe,
  ArrowRight,
  Copy,
  Check,
  Search,
  Loader2,
  Share2,
} from "lucide-react";
import CreateRoomModal from "@/components/CreateRoomModal";
import JoinRoomModal from "@/components/JoinRoomModal";
import ThemeToggle from "@/components/ThemeToggle";

interface RoomItem {
  id: string;
  roomCode: string;
  name: string;
  description: string | null;
  isPublic: boolean;
  passwordHash: string | null;
  ownerId: string;
  owner: { id: string; username: string };
  createdAt: string;
  updatedAt: string;
  _count: {
    members: number;
    files: number;
  };
}

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [user, setUser] = useState<{ id: string; username: string } | null>(null);
  const [rooms, setRooms] = useState<RoomItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTabFilter, setActiveTabFilter] = useState<"all" | "public" | "private" | "mine">("all");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [enteringRoomCode, setEnteringRoomCode] = useState<string | null>(null);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isJoinOpen, setIsJoinOpen] = useState(false);

  const getAuthHeaders = useCallback(() => {
    const token =
      typeof window !== "undefined"
        ? sessionStorage.getItem("coderoom_token") || localStorage.getItem("coderoom_token") || ""
        : "";
    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    return headers;
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchRooms = useCallback(async () => {
    try {
      const res = await fetch("/api/rooms", { headers: getAuthHeaders() });
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      const data = await res.json();
      if (data?.rooms) {
        setRooms(data.rooms);
      }
    } catch (err) {
      console.error("Error fetching rooms:", err);
    } finally {
      setLoading(false);
    }
  }, [router, getAuthHeaders]);

  useEffect(() => {
    // Check current user
    fetch("/api/auth/me", { headers: getAuthHeaders() })
      .then((res) => {
        if (!res.ok) {
          router.push("/login");
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data?.user) {
          setUser(data.user);
          if (data.token) {
            sessionStorage.setItem("coderoom_token", data.token);
            localStorage.setItem("coderoom_token", data.token);
          }
          fetchRooms();
        }
      })
      .catch(() => {
        router.push("/login");
      });

    // Check query params for actions
    const action = searchParams.get("action");
    if (action === "create") setIsCreateOpen(true);
    if (action === "join") setIsJoinOpen(true);
  }, [router, searchParams, fetchRooms, getAuthHeaders]);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      sessionStorage.removeItem("coderoom_token");
      localStorage.removeItem("coderoom_token");
      router.push("/login");
      router.refresh();
    } catch {
      router.push("/login");
    }
  };

  const copyRoomCode = (e: React.MouseEvent, code: string) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const copyInviteLink = (e: React.MouseEvent, code: string) => {
    e.preventDefault();
    e.stopPropagation();
    const url = `${window.location.origin}/room/${code}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(code);
    setTimeout(() => setCopiedLink(null), 2000);
  };

  const counts = useMemo(() => {
    const total = rooms.length;
    const pub = rooms.filter((r) => r.isPublic).length;
    const priv = rooms.filter((r) => !r.isPublic).length;
    const mine = rooms.filter((r) => r.ownerId === user?.id).length;
    return { total, pub, priv, mine };
  }, [rooms, user]);

  const filteredRooms = useMemo(() => {
    return rooms.filter((room) => {
      // Tab filter
      if (activeTabFilter === "public" && !room.isPublic) return false;
      if (activeTabFilter === "private" && room.isPublic) return false;
      if (activeTabFilter === "mine" && room.ownerId !== user?.id) return false;

      // Query filter
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        room.name.toLowerCase().includes(q) ||
        room.roomCode.toLowerCase().includes(q) ||
        (room.description && room.description.toLowerCase().includes(q))
      );
    });
  }, [rooms, activeTabFilter, searchQuery, user]);

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  const formatRelativeTime = (dateStr: string) => {
    try {
      const diff = Date.now() - new Date(dateStr).getTime();
      const mins = Math.floor(diff / 60000);
      if (mins < 1) return "Just now";
      if (mins < 60) return `${mins}m ago`;
      const hours = Math.floor(mins / 60);
      if (hours < 24) return `${hours}h ago`;
      const days = Math.floor(hours / 24);
      return `${days}d ago`;
    } catch {
      return "recently";
    }
  };

  if (!mounted || loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
        <p className="text-sm text-muted">Loading your collaborative rooms...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-64 border-b md:border-b-0 md:border-r border-border bg-surface flex flex-col justify-between shrink-0">
        <div>
          {/* Logo */}
          <div className="h-16 px-6 border-b border-border/80 flex items-center justify-between">
            <Link href="/dashboard" className="flex items-center gap-2.5 group">
              <div className="h-9 w-9 rounded-xl bg-accent text-white flex items-center justify-center shadow-md shadow-accent/20 group-hover:scale-105 transition-transform">
                <Code2 className="h-5 w-5" />
              </div>
              <span className="font-bold text-lg tracking-tight text-foreground">
                Code<span className="text-accent">Room</span>
              </span>
            </Link>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1.5">
            <Link
              href="/dashboard"
              className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold bg-accent/15 border border-accent/30 text-accent transition-colors shadow-sm"
            >
              <LayoutDashboard className="h-4 w-4 text-accent" />
              <span>Dashboard</span>
            </Link>

            <button
              onClick={() => setIsCreateOpen(true)}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-muted hover:text-foreground hover:bg-surface-hover transition-colors text-left"
            >
              <Plus className="h-4 w-4 text-emerald-500" />
              <span>Create Room</span>
            </button>

            <button
              onClick={() => setIsJoinOpen(true)}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-muted hover:text-foreground hover:bg-surface-hover transition-colors text-left"
            >
              <LogIn className="h-4 w-4 text-accent" />
              <span>Join Room</span>
            </button>

            <Link
              href="/settings"
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
            >
              <Settings className="h-4 w-4 text-muted" />
              <span>Settings</span>
            </Link>
          </nav>
        </div>

        {/* User profile, Theme Toggle & Logout */}
        <div className="p-4 border-t border-border space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-muted uppercase tracking-wider">Theme</span>
            <ThemeToggle compact />
          </div>

          <div className="pt-2 border-t border-border/70 flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="h-8 w-8 rounded-full bg-accent/20 border border-accent/30 text-accent font-semibold text-xs flex items-center justify-center shrink-0">
                {user?.username ? user.username.slice(0, 2).toUpperCase() : "U"}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold truncate text-foreground">{user?.username}</div>
                <div className="text-[10px] text-muted truncate">Connected</div>
              </div>
            </div>

            <button
              onClick={handleLogout}
              title="Log out"
              className="p-1.5 rounded-lg text-muted hover:text-red-400 hover:bg-surface-hover transition-colors"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 md:p-10 overflow-y-auto max-w-7xl">
        {/* Welcome Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-8 border-b border-border">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 border border-accent/20 text-xs font-medium text-accent mb-3">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Real-time Multi-User IDE</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Welcome back, <span className="text-accent">{user?.username}</span>
            </h1>
            <p className="text-sm text-muted mt-1">
              Collaborate in real time, run code with single-runner mutex, and manage your team rooms.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsJoinOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border text-foreground hover:bg-surface-hover text-sm font-semibold transition-colors"
            >
              <LogIn className="h-4 w-4 text-muted" />
              <span>Join Room</span>
            </button>

            <button
              onClick={() => setIsCreateOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-white text-sm font-semibold transition-all shadow-lg shadow-accent/25 hover:shadow-accent/40 hover:scale-[1.02] active:scale-[0.98]"
            >
              <Plus className="h-4 w-4" />
              <span>Create Room</span>
            </button>
          </div>
        </div>

        {/* Quick Stats Banner */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
          <div className="glass-card p-4 rounded-2xl">
            <div className="text-[11px] font-semibold text-muted uppercase tracking-wider">Total Rooms</div>
            <div className="text-2xl font-bold mt-1 text-foreground">{counts.total}</div>
          </div>
          <div className="glass-card p-4 rounded-2xl">
            <div className="text-[11px] font-semibold text-muted uppercase tracking-wider">Public Rooms</div>
            <div className="text-2xl font-bold mt-1 text-emerald-400">{counts.pub}</div>
          </div>
          <div className="glass-card p-4 rounded-2xl">
            <div className="text-[11px] font-semibold text-muted uppercase tracking-wider">Private Rooms</div>
            <div className="text-2xl font-bold mt-1 text-accent">{counts.priv}</div>
          </div>
          <div className="glass-card p-4 rounded-2xl">
            <div className="text-[11px] font-semibold text-muted uppercase tracking-wider">Created by Me</div>
            <div className="text-2xl font-bold mt-1 text-amber-400">{counts.mine}</div>
          </div>
        </div>

        {/* Rooms Section */}
        <div className="mt-8">
          {/* Filter & Search Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-surface border border-border text-xs font-medium overflow-x-auto no-scrollbar">
              <button
                onClick={() => setActiveTabFilter("all")}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  activeTabFilter === "all"
                    ? "bg-accent text-white font-semibold shadow-sm"
                    : "text-muted hover:text-foreground"
                }`}
              >
                All ({counts.total})
              </button>
              <button
                onClick={() => setActiveTabFilter("public")}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  activeTabFilter === "public"
                    ? "bg-accent text-white font-semibold shadow-sm"
                    : "text-muted hover:text-foreground"
                }`}
              >
                Public ({counts.pub})
              </button>
              <button
                onClick={() => setActiveTabFilter("private")}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  activeTabFilter === "private"
                    ? "bg-accent text-white font-semibold shadow-sm"
                    : "text-muted hover:text-foreground"
                }`}
              >
                Private ({counts.priv})
              </button>
              <button
                onClick={() => setActiveTabFilter("mine")}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  activeTabFilter === "mine"
                    ? "bg-accent text-white font-semibold shadow-sm"
                    : "text-muted hover:text-foreground"
                }`}
              >
                Mine ({counts.mine})
              </button>
            </div>

            <div className="relative w-full sm:w-72 group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted group-focus-within:text-accent transition-colors pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search rooms by name or code..."
                className="w-full pl-9 pr-3.5 py-2 rounded-xl input-base text-xs"
              />
            </div>
          </div>

          {filteredRooms.length === 0 ? (
            <div className="border border-border/80 border-dashed rounded-3xl p-12 text-center bg-surface/30">
              <div className="h-14 w-14 rounded-2xl bg-surface border border-border text-muted flex items-center justify-center mx-auto mb-4 shadow-sm">
                <FolderGit2 className="h-7 w-7 text-accent" />
              </div>
              <h3 className="text-base font-semibold text-foreground">
                {searchQuery ? "No matching rooms found" : "No collaborative rooms yet"}
              </h3>
              <p className="text-xs text-muted max-w-sm mx-auto mt-1.5 mb-6">
                {searchQuery
                  ? "Try searching for another room name, room code, or adjusting your filter."
                  : "Create your first collaborative room or join an existing session with an invite code."}
              </p>
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => setIsCreateOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-semibold transition-all shadow-sm"
                >
                  <Plus className="h-4 w-4" />
                  <span>Create Room</span>
                </button>
                <button
                  onClick={() => setIsJoinOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border hover:bg-surface text-foreground text-xs font-semibold transition-all"
                >
                  <LogIn className="h-4 w-4" />
                  <span>Join with Code</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredRooms.map((room) => {
                const isOwner = room.ownerId === user?.id;
                const isEntering = enteringRoomCode === room.roomCode;
                return (
                  <div
                    key={room.id}
                    onClick={(e) => {
                      const target = e.target as HTMLElement;
                      if (target.closest("button") || target.closest("a")) return;
                      setEnteringRoomCode(room.roomCode);
                      router.push(`/room/${room.roomCode}`);
                    }}
                    className={`glass-card glass-card-hover flex flex-col justify-between p-5 rounded-2xl transition-all group relative overflow-hidden cursor-pointer ${
                      isEntering ? "ring-2 ring-accent opacity-90" : ""
                    }`}
                  >
                    <div>
                      {/* Top Bar with privacy and code */}
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <div className="flex items-center gap-1.5">
                          {room.isPublic ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                              <Globe className="h-3 w-3" />
                              Public
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-accent/15 text-accent border border-accent/25">
                              <Lock className="h-3 w-3" />
                              Private
                            </span>
                          )}

                          {room.passwordHash && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-400 border border-amber-500/25">
                              <Lock className="h-3 w-3" />
                              Protected
                            </span>
                          )}

                          {isOwner && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-accent/20 text-accent border border-accent/30">
                              Owner
                            </span>
                          )}
                        </div>

                        {/* Room Code Badge with Copy */}
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={(e) => copyInviteLink(e, room.roomCode)}
                            title="Copy invite link"
                            className="p-1.5 rounded-md bg-panel/80 border border-border/80 text-muted hover:text-foreground hover:border-accent transition-colors"
                          >
                            {copiedLink === room.roomCode ? (
                              <Check className="h-3 w-3 text-emerald-400" />
                            ) : (
                              <Share2 className="h-3 w-3" />
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={(e) => copyRoomCode(e, room.roomCode)}
                            title="Copy room code"
                            className="flex items-center gap-1 text-[11px] font-mono px-2 py-1 rounded-md bg-panel/80 border border-border/80 text-muted hover:text-foreground hover:border-accent transition-colors"
                          >
                            <span>{room.roomCode}</span>
                            {copiedCode === room.roomCode ? (
                              <Check className="h-3 w-3 text-emerald-400" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Room Name & Description - Clickable directly */}
                      <Link
                        href={`/room/${room.roomCode}`}
                        onClick={() => setEnteringRoomCode(room.roomCode)}
                        className="block focus:outline-none group/title"
                      >
                        <h3 className="font-semibold text-base text-foreground group-hover:text-accent group-hover/title:underline transition-colors line-clamp-1 cursor-pointer">
                          {room.name}
                        </h3>
                      </Link>
                      <p className="text-xs text-muted mt-1.5 line-clamp-2 min-h-[32px] leading-relaxed">
                        {room.description || "No description provided."}
                      </p>
                    </div>

                    {/* Metadata & Join */}
                    <div className="mt-5 pt-4 border-t border-border/60">
                      <div className="flex items-center justify-between text-[11px] text-muted mb-4">
                        <div className="flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5 text-accent" />
                          <span>
                            {room._count?.members || 1}{" "}
                            {room._count?.members === 1 ? "member" : "members"}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5" title={`Created: ${formatDate(room.createdAt)}`}>
                          <Clock className="h-3.5 w-3.5 text-muted" />
                          <span suppressHydrationWarning>Active {formatRelativeTime(room.updatedAt)}</span>
                        </div>
                      </div>

                      <Link
                        href={`/room/${room.roomCode}`}
                        onClick={() => setEnteringRoomCode(room.roomCode)}
                        className={`w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-panel hover:bg-accent hover:text-white text-xs font-semibold border border-border/80 text-foreground transition-all group-hover:border-accent/40 shadow-sm ${
                          isEntering ? "pointer-events-none opacity-80" : ""
                        }`}
                      >
                        {isEntering ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-accent group-hover:text-white" />
                            <span>Entering Room...</span>
                          </>
                        ) : (
                          <>
                            <span>Enter Room</span>
                            <ArrowRight className="h-3.5 w-3.5" />
                          </>
                        )}
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Modals */}
      <CreateRoomModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={(createdRoom) => {
          setIsCreateOpen(false);
          if (createdRoom?.roomCode) {
            router.push(`/room/${createdRoom.roomCode}`);
          } else {
            fetchRooms();
          }
        }}
      />

      <JoinRoomModal
        isOpen={isJoinOpen}
        onClose={() => setIsJoinOpen(false)}
      />
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
          <p className="text-sm text-muted">Loading your collaborative rooms...</p>
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
