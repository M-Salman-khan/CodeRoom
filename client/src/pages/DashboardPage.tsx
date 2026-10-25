import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  Check,
  Clock,
  Code2,
  Copy,
  FolderGit2,
  Globe,
  LayoutDashboard,
  Loader2,
  Lock,
  LogIn,
  LogOut,
  Menu,
  Plus,
  Search,
  Settings,
  Share2,
  Users,
} from "lucide-react";

import CreateRoomModal from "@/components/CreateRoomModal";
import JoinRoomModal from "@/components/JoinRoomModal";
import ThemeToggle from "@/components/ThemeToggle";
import { apiFetch, clearStoredToken, storeToken } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface RoomItem {
  id: string;
  roomCode: string;
  name: string;
  description: string | null;
  isPublic: boolean;
  hasPassword?: boolean;
  ownerId: string;
  owner: { id: string; username: string };
  createdAt: string;
  updatedAt: string;
  _count?: {
    members: number;
    files: number;
  };
}

type RoomFilter = "all" | "public" | "private" | "mine";

export default function DashboardPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [user, setUser] = useState<{ id: string; username: string } | null>(
    null
  );
  const [rooms, setRooms] = useState<RoomItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTabFilter, setActiveTabFilter] = useState<RoomFilter>("all");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [enteringRoomCode, setEnteringRoomCode] = useState<string | null>(null);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isJoinOpen, setIsJoinOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const fetchRooms = useCallback(async () => {
    try {
      const res = await apiFetch("/api/rooms");
      if (res.status === 401) {
        navigate("/login", { replace: true });
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (Array.isArray(data?.rooms)) {
        setRooms(data.rooms as RoomItem[]);
      }
    } catch (err) {
      console.error("Error fetching rooms:", err);
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    let cancelled = false;

    apiFetch("/api/auth/me")
      .then((res) => {
        if (!res.ok) {
          navigate("/login", { replace: true });
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (cancelled || !data) return;
        if (data.user) {
          setUser(data.user);
          if (data.token) storeToken(data.token);
          void fetchRooms();
        } else {
          navigate("/login", { replace: true });
        }
      })
      .catch(() => {
        if (!cancelled) navigate("/login", { replace: true });
      });

    return () => {
      cancelled = true;
    };
  }, [navigate, fetchRooms]);

  useEffect(() => {
    const action = searchParams.get("action");
    if (action === "create") setIsCreateOpen(true);
    if (action === "join") setIsJoinOpen(true);
  }, [searchParams]);

  const handleLogout = async () => {
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
    } catch {
      /* the cookie/token is cleared locally regardless */
    } finally {
      clearStoredToken();
      navigate("/login", { replace: true });
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
      if (activeTabFilter === "public" && !room.isPublic) return false;
      if (activeTabFilter === "private" && room.isPublic) return false;
      if (activeTabFilter === "mine" && room.ownerId !== user?.id) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.trim().toLowerCase();
      return (
        room.name.toLowerCase().includes(q) ||
        room.roomCode.toLowerCase().includes(q) ||
        Boolean(room.description?.toLowerCase().includes(q))
      );
    });
  }, [rooms, activeTabFilter, searchQuery, user]);

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString(undefined, {
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
      if (mins < 1) return "just now";
      if (mins < 60) return `${mins}m ago`;
      const hours = Math.floor(mins / 60);
      if (hours < 24) return `${hours}h ago`;
      const days = Math.floor(hours / 24);
      return `${days}d ago`;
    } catch {
      return "recently";
    }
  };

  const initials = user?.username
    ? user.username.slice(0, 2).toUpperCase()
    : "U";

  if (loading) {
    return (
      <div className="flex min-h-dvh-screen bg-background text-foreground">
        <div className="hidden w-64 flex-col gap-3 border-r border-border bg-surface p-4 md:flex">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
        <div className="flex-1 p-6 md:p-10">
          <Skeleton className="h-8 w-64" />
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
          <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-56 w-full rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh-screen flex-col bg-background text-foreground md:flex-row">
      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex min-h-14 shrink-0 items-center justify-between border-b border-border bg-surface px-4 pt-safe md:hidden">
        <Link to="/dashboard" className="group flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-primary-foreground shadow-sm">
            <Code2 className="h-4 w-4" />
          </div>
          <span className="text-base font-bold tracking-tight text-foreground">
            Code<span className="text-accent">Room</span>
          </span>
        </Link>

        <div className="flex items-center gap-1.5">
          <Button
            variant="subtle"
            size="icon-sm"
            onClick={() => setIsCreateOpen(true)}
            title="Create Room"
            aria-label="Create room"
            className="touch-target"
          >
            <Plus className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => setIsJoinOpen(true)}
            title="Join Room"
            aria-label="Join room"
            className="touch-target bg-surface"
          >
            <LogIn className="h-4 w-4" />
          </Button>
          <ThemeToggle compact />
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => setMobileNavOpen(true)}
            aria-label="Open navigation"
            className="bg-surface"
          >
            <Menu className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Mobile nav sheet */}
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="w-72 p-0">
          <SheetHeader className="border-b border-border text-left">
            <SheetTitle className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-primary-foreground">
                <Code2 className="h-4 w-4" />
              </div>
              Code<span className="-ml-1.5 text-accent">Room</span>
            </SheetTitle>
          </SheetHeader>
          <nav className="space-y-1.5 p-4">
            <Button
              asChild
              variant="subtle"
              className="w-full justify-start gap-3 font-semibold"
            >
              <Link to="/dashboard" onClick={() => setMobileNavOpen(false)}>
                <LayoutDashboard className="h-4 w-4" />
                <span>Dashboard</span>
              </Link>
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start gap-3"
              onClick={() => {
                setMobileNavOpen(false);
                setIsCreateOpen(true);
              }}
            >
              <Plus className="h-4 w-4 text-emerald-500" />
              <span>Create Room</span>
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start gap-3"
              onClick={() => {
                setMobileNavOpen(false);
                setIsJoinOpen(true);
              }}
            >
              <LogIn className="h-4 w-4 text-accent" />
              <span>Join Room</span>
            </Button>
            <Button
              asChild
              variant="ghost"
              className="w-full justify-start gap-3"
            >
              <Link to="/settings" onClick={() => setMobileNavOpen(false)}>
                <Settings className="h-4 w-4" />
                <span>Settings</span>
              </Link>
            </Button>
          </nav>

          <div className="absolute inset-x-0 bottom-0 border-t border-border p-4 pb-safe">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2.5">
                <Avatar className="h-8 w-8 border-accent/30">
                  <AvatarFallback className="bg-accent/20 font-semibold text-accent">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="truncate text-xs font-semibold text-foreground">
                    {user?.username}
                  </div>
                  <div className="truncate text-[10px] text-muted-foreground">
                    Connected
                  </div>
                </div>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Log Out</span>
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh-screen w-64 shrink-0 flex-col justify-between border-r border-border bg-surface md:flex">
        <div>
          <div className="flex h-16 items-center border-b border-border/80 px-6">
            <Link to="/dashboard" className="group flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-primary-foreground shadow-md shadow-accent/20 transition-transform group-hover:scale-105">
                <Code2 className="h-5 w-5" />
              </div>
              <span className="text-lg font-bold tracking-tight text-foreground">
                Code<span className="text-accent">Room</span>
              </span>
            </Link>
          </div>

          <nav className="space-y-1.5 p-4">
            <Button
              asChild
              variant="subtle"
              className="w-full justify-start gap-3 font-semibold"
            >
              <Link to="/dashboard">
                <LayoutDashboard className="h-4 w-4" />
                <span>Dashboard</span>
              </Link>
            </Button>

            <Button
              variant="ghost"
              className="w-full justify-start gap-3"
              onClick={() => setIsCreateOpen(true)}
            >
              <Plus className="h-4 w-4 text-emerald-500" />
              <span>Create Room</span>
            </Button>

            <Button
              variant="ghost"
              className="w-full justify-start gap-3"
              onClick={() => setIsJoinOpen(true)}
            >
              <LogIn className="h-4 w-4 text-accent" />
              <span>Join Room</span>
            </Button>

            <Button
              asChild
              variant="ghost"
              className="w-full justify-start gap-3"
            >
              <Link to="/settings">
                <Settings className="h-4 w-4" />
                <span>Settings</span>
              </Link>
            </Button>
          </nav>
        </div>

        <div className="space-y-3 border-t border-border p-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Theme
            </span>
            <ThemeToggle compact />
          </div>

          <div className="flex items-center justify-between border-t border-border/70 pt-2">
            <div className="flex min-w-0 items-center gap-2.5">
              <Avatar className="h-8 w-8 border-accent/30">
                <AvatarFallback className="bg-accent/20 font-semibold text-accent">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="truncate text-xs font-semibold text-foreground">
                  {user?.username}
                </div>
                <div className="truncate text-[10px] text-muted-foreground">
                  Connected
                </div>
              </div>
            </div>

            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleLogout}
              title="Log out"
              aria-label="Log out"
              className="hover:bg-destructive/10 hover:text-destructive"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="max-w-7xl flex-1 overflow-y-auto p-4 pb-safe sm:p-6 md:p-10">
        <div className="flex flex-col justify-between gap-4 border-b border-border pb-6 sm:flex-row sm:items-center sm:pb-8">
          <div>
            <Badge variant="accent" className="mb-3">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
              Real-time Multi-User IDE
            </Badge>
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl md:text-3xl">
              Welcome back, <span className="text-accent">{user?.username}</span>
            </h1>
            <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
              Collaborate in real time, run code with single-runner mutex, and
              manage your team rooms.
            </p>
          </div>

          <div className="flex w-full items-center gap-2.5 sm:w-auto sm:gap-3">
            <Button
              variant="outline"
              onClick={() => setIsJoinOpen(true)}
              className="flex-1 sm:flex-initial"
            >
              <LogIn className="h-4 w-4" />
              <span>Join Room</span>
            </Button>

            <Button
              onClick={() => setIsCreateOpen(true)}
              className="flex-1 sm:flex-initial"
            >
              <Plus className="h-4 w-4" />
              <span>Create Room</span>
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          {[
            {
              label: "Total Rooms",
              value: counts.total,
              color: "text-foreground",
            },
            {
              label: "Public Rooms",
              value: counts.pub,
              color: "text-emerald-400",
            },
            {
              label: "Private Rooms",
              value: counts.priv,
              color: "text-accent",
            },
            {
              label: "Created by Me",
              value: counts.mine,
              color: "text-amber-400",
            },
          ].map((stat) => (
            <Card key={stat.label} className="glass-card rounded-2xl">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground sm:text-[11px]">
                  {stat.label}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className={cn("text-xl font-bold sm:text-2xl", stat.color)}>
                  {stat.value}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Rooms */}
        <div className="mt-8">
          <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div className="w-full overflow-x-auto no-scrollbar">
              <ToggleGroup
                type="single"
                value={activeTabFilter}
                onValueChange={(v) => v && setActiveTabFilter(v as RoomFilter)}
                className="w-max"
              >
                <ToggleGroupItem value="all">
                  All ({counts.total})
                </ToggleGroupItem>
                <ToggleGroupItem value="public">
                  Public ({counts.pub})
                </ToggleGroupItem>
                <ToggleGroupItem value="private">
                  Private ({counts.priv})
                </ToggleGroupItem>
                <ToggleGroupItem value="mine">
                  Mine ({counts.mine})
                </ToggleGroupItem>
              </ToggleGroup>
            </div>

            <div className="group relative w-full sm:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-accent" />
              <Input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search rooms by name or code..."
                aria-label="Search rooms"
                className="h-9 pl-9 text-xs"
              />
            </div>
          </div>

          {filteredRooms.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border/80 bg-surface/30 p-8 text-center sm:p-12">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-surface text-muted shadow-sm">
                <FolderGit2 className="h-7 w-7 text-accent" />
              </div>
              <h3 className="text-base font-semibold text-foreground">
                {searchQuery
                  ? "No matching rooms found"
                  : "No collaborative rooms yet"}
              </h3>
              <p className="mx-auto mb-6 mt-1.5 max-w-sm text-xs text-muted-foreground">
                {searchQuery
                  ? "Try searching for another room name, room code, or adjusting your filter."
                  : "Create your first collaborative room or join an existing session with an invite code."}
              </p>
              <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Button
                  onClick={() => setIsCreateOpen(true)}
                  className="w-full sm:w-auto"
                >
                  <Plus className="h-4 w-4" />
                  <span>Create Room</span>
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setIsJoinOpen(true)}
                  className="w-full sm:w-auto"
                >
                  <LogIn className="h-4 w-4" />
                  <span>Join with Code</span>
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
              {filteredRooms.map((room) => {
                const isOwner = room.ownerId === user?.id;
                const isEntering = enteringRoomCode === room.roomCode;
                return (
                  <Card
                    key={room.id}
                    onClick={(e) => {
                      const target = e.target as HTMLElement;
                      if (target.closest("button") || target.closest("a")) return;
                      setEnteringRoomCode(room.roomCode);
                      navigate(`/room/${room.roomCode}`);
                    }}
                    className={cn(
                      "glass-card glass-card-hover group relative flex cursor-pointer flex-col justify-between overflow-hidden p-5 transition-all",
                      isEntering && "opacity-90 ring-2 ring-accent"
                    )}
                  >
                    <div>
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {room.isPublic ? (
                            <Badge variant="success">
                              <Globe className="h-3 w-3" />
                              Public
                            </Badge>
                          ) : (
                            <Badge variant="accent">
                              <Lock className="h-3 w-3" />
                              Private
                            </Badge>
                          )}

                          {room.hasPassword && (
                            <Badge variant="warning">
                              <Lock className="h-3 w-3" />
                              Protected
                            </Badge>
                          )}

                          {isOwner && <Badge variant="default">Owner</Badge>}
                        </div>

                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon-sm"
                            onClick={(e) => copyInviteLink(e, room.roomCode)}
                            title="Copy invite link"
                            aria-label={`Copy invite link for ${room.name}`}
                            className="h-7 w-7 bg-secondary/50"
                          >
                            {copiedLink === room.roomCode ? (
                              <Check className="h-3 w-3 text-emerald-400" />
                            ) : (
                              <Share2 className="h-3 w-3" />
                            )}
                          </Button>

                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={(e) => copyRoomCode(e, room.roomCode)}
                            title="Copy room code"
                            aria-label={`Copy room code ${room.roomCode}`}
                            className="h-7 gap-1 bg-secondary/50 px-2 font-mono text-[11px]"
                          >
                            <span>{room.roomCode}</span>
                            {copiedCode === room.roomCode ? (
                              <Check className="h-3 w-3 text-emerald-400" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                      </div>

                      <Link
                        to={`/room/${room.roomCode}`}
                        onClick={() => setEnteringRoomCode(room.roomCode)}
                        className="block focus:outline-none"
                      >
                        <h3 className="line-clamp-1 cursor-pointer text-base font-semibold text-foreground transition-colors group-hover:text-accent">
                          {room.name}
                        </h3>
                      </Link>
                      <p className="mt-1.5 line-clamp-2 min-h-[32px] text-xs leading-relaxed text-muted-foreground">
                        {room.description || "No description provided."}
                      </p>
                    </div>

                    <div className="mt-5 border-t border-border/60 pt-4">
                      <div className="mb-4 flex items-center justify-between text-[11px] text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5 text-accent" />
                          <span>
                            {room._count?.members || 1}{" "}
                            {room._count?.members === 1 ? "member" : "members"}
                          </span>
                        </div>

                        <div
                          className="flex items-center gap-1.5"
                          title={`Created: ${formatDate(room.createdAt)}`}
                        >
                          <Clock className="h-3.5 w-3.5" />
                          <span>Active {formatRelativeTime(room.updatedAt)}</span>
                        </div>
                      </div>

                      <Button
                        asChild
                        variant="secondary"
                        className={cn(
                          "w-full group-hover:border-accent/40 group-hover:bg-accent group-hover:text-primary-foreground",
                          isEntering && "pointer-events-none opacity-80"
                        )}
                      >
                        <Link
                          to={`/room/${room.roomCode}`}
                          onClick={() => setEnteringRoomCode(room.roomCode)}
                        >
                          {isEntering ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              <span>Entering Room...</span>
                            </>
                          ) : (
                            <>
                              <span>Enter Room</span>
                              <ArrowRight className="h-3.5 w-3.5" />
                            </>
                          )}
                        </Link>
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </main>

      <CreateRoomModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={(createdRoom) => {
          setIsCreateOpen(false);
          if (createdRoom?.roomCode) {
            navigate(`/room/${createdRoom.roomCode}`);
          } else {
            void fetchRooms();
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
