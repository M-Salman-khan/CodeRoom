"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
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
} from "lucide-react";
import CreateRoomModal from "@/components/CreateRoomModal";
import JoinRoomModal from "@/components/JoinRoomModal";

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
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isJoinOpen, setIsJoinOpen] = useState(false);

  const fetchRooms = useCallback(async () => {
    try {
      const res = await fetch("/api/rooms");
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
  }, [router]);

  useEffect(() => {
    // Check current user
    fetch("/api/auth/me")
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
  }, [router, searchParams, fetchRooms]);

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

  const filteredRooms = rooms.filter(
    (room) =>
      room.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      room.roomCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (room.description && room.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

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

  if (loading) {
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
          <div className="h-16 px-6 border-b border-border flex items-center justify-between">
            <Link href="/dashboard" className="flex items-center gap-2.5 group">
              <div className="h-8 w-8 rounded-lg bg-accent/15 border border-accent/30 flex items-center justify-center text-accent group-hover:scale-105 transition-transform">
                <Code2 className="h-5 w-5" />
              </div>
              <span className="font-bold text-lg tracking-tight">
                Code<span className="text-accent">Room</span>
              </span>
            </Link>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1.5">
            <Link
              href="/dashboard"
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium bg-panel border border-border text-foreground transition-colors"
            >
              <LayoutDashboard className="h-4 w-4 text-accent" />
              <span>Dashboard</span>
            </Link>

            <button
              onClick={() => setIsCreateOpen(true)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted hover:text-foreground hover:bg-surface-hover transition-colors text-left"
            >
              <Plus className="h-4 w-4 text-emerald-400" />
              <span>Create Room</span>
            </button>

            <button
              onClick={() => setIsJoinOpen(true)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted hover:text-foreground hover:bg-surface-hover transition-colors text-left"
            >
              <LogIn className="h-4 w-4 text-blue-400" />
              <span>Join Room</span>
            </button>

            <Link
              href="/settings"
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
            >
              <Settings className="h-4 w-4 text-purple-400" />
              <span>Settings</span>
            </Link>
          </nav>
        </div>

        {/* User profile & Logout */}
        <div className="p-4 border-t border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="h-8 w-8 rounded-full bg-accent/20 border border-accent/30 text-accent font-semibold text-xs flex items-center justify-center shrink-0">
                {user?.username ? user.username.slice(0, 2).toUpperCase() : "U"}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold truncate">{user?.username}</div>
                <div className="text-[10px] text-muted truncate">Connected</div>
              </div>
            </div>

            <button
              onClick={handleLogout}
              title="Log out"
              className="p-1.5 rounded-lg text-muted hover:text-red-400 hover:bg-panel transition-colors"
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
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Welcome back, <span className="text-accent">{user?.username}</span>
            </h1>
            <p className="text-sm text-muted mt-1">
              Manage your collaborative rooms or create a new workspace.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsJoinOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border text-foreground hover:bg-surface text-sm font-semibold transition-colors"
            >
              <LogIn className="h-4 w-4 text-muted" />
              <span>Join Room</span>
            </button>

            <button
              onClick={() => setIsCreateOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-white text-sm font-semibold transition-all shadow-md shadow-accent/20 hover:scale-[1.02]"
            >
              <Plus className="h-4 w-4" />
              <span>Create Room</span>
            </button>
          </div>
        </div>

        {/* My Rooms Section */}
        <div className="mt-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">My Rooms</h2>
              <p className="text-xs text-muted mt-0.5">
                {rooms.length} {rooms.length === 1 ? "room" : "rooms"} available
              </p>
            </div>

            {rooms.length > 0 && (
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search rooms..."
                  className="w-full pl-9 pr-3.5 py-1.5 rounded-xl bg-surface border border-border text-foreground placeholder:text-muted/60 text-xs focus:outline-none focus:border-accent transition-colors"
                />
              </div>
            )}
          </div>

          {filteredRooms.length === 0 ? (
            <div className="border border-border/80 border-dashed rounded-2xl p-12 text-center bg-surface/30">
              <div className="h-12 w-12 rounded-2xl bg-surface border border-border text-muted flex items-center justify-center mx-auto mb-4">
                <FolderGit2 className="h-6 w-6" />
              </div>
              <h3 className="text-base font-semibold text-foreground">
                {searchQuery ? "No matching rooms found" : "No rooms yet"}
              </h3>
              <p className="text-xs text-muted max-w-sm mx-auto mt-1.5 mb-6">
                {searchQuery
                  ? "Try searching for another room name or room code."
                  : "Create your first collaborative room or join an existing room with an invite code."}
              </p>
              <button
                onClick={() => setIsCreateOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-semibold transition-all shadow-sm"
              >
                <Plus className="h-4 w-4" />
                <span>Create your first collaborative room</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredRooms.map((room) => {
                const isOwner = room.ownerId === user?.id;
                return (
                  <div
                    key={room.id}
                    className="flex flex-col justify-between p-5 rounded-2xl bg-surface border border-border/80 hover:border-accent/40 transition-all hover:shadow-lg hover:shadow-black/20 group"
                  >
                    <div>
                      {/* Top Bar with privacy and code */}
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <div className="flex items-center gap-1.5">
                          {room.passwordHash ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20">
                              <Lock className="h-3 w-3" />
                              Protected
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              <Globe className="h-3 w-3" />
                              Public
                            </span>
                          )}

                          {isOwner && (
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-accent/10 text-accent border border-accent/20">
                              Owner
                            </span>
                          )}
                        </div>

                        {/* Room Code Badge */}
                        <button
                          onClick={(e) => copyRoomCode(e, room.roomCode)}
                          title="Copy room code"
                          className="flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-md bg-panel border border-border text-muted hover:text-foreground transition-colors"
                        >
                          <span>{room.roomCode}</span>
                          {copiedCode === room.roomCode ? (
                            <Check className="h-3 w-3 text-green-400" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </button>
                      </div>

                      {/* Room Name & Description */}
                      <h3 className="font-semibold text-base text-foreground group-hover:text-accent transition-colors line-clamp-1">
                        {room.name}
                      </h3>
                      <p className="text-xs text-muted mt-1 line-clamp-2 min-h-[32px]">
                        {room.description || "No description provided."}
                      </p>
                    </div>

                    {/* Metadata & Join */}
                    <div className="mt-5 pt-4 border-t border-border/60">
                      <div className="flex items-center justify-between text-[11px] text-muted mb-4">
                        <div className="flex items-center gap-1">
                          <Users className="h-3.5 w-3.5" />
                          <span>
                            {room._count?.members || 1}{" "}
                            {room._count?.members === 1 ? "member" : "members"}
                          </span>
                        </div>

                        <div className="flex items-center gap-1" title={`Created: ${formatDate(room.createdAt)}`}>
                          <Clock className="h-3.5 w-3.5" />
                          <span>Active {formatRelativeTime(room.updatedAt)}</span>
                        </div>
                      </div>

                      <Link
                        href={`/room/${room.roomCode}`}
                        className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-panel hover:bg-accent hover:text-white text-xs font-semibold border border-border text-foreground transition-all group-hover:border-accent/40"
                      >
                        <span>Enter Room</span>
                        <ArrowRight className="h-3.5 w-3.5" />
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
        onSuccess={() => {
          setIsCreateOpen(false);
          fetchRooms();
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
