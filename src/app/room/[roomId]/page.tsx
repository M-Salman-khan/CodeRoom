"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Loader2,
  AlertCircle,
  Lock,
  ArrowLeft,
  KeyRound,
  FileCode,
  MessageSquare,
  FolderTree,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
} from "lucide-react";
import RoomHeader, { ConnectionStatus } from "@/components/room/RoomHeader";
import FileExplorer, { FileItem } from "@/components/room/FileExplorer";
import CodeEditor, { SaveStatus } from "@/components/room/CodeEditor";
import RoomChat, { ChatMessage } from "@/components/room/RoomChat";
import StatusBar from "@/components/room/StatusBar";
import ShareModal from "@/components/room/ShareModal";
import RoomSettingsModal from "@/components/room/RoomSettingsModal";
import { getLanguageFromFilename } from "@/lib/utils";

interface RoomData {
  id: string;
  roomCode: string;
  name: string;
  description: string | null;
  isPublic: boolean;
  hasPassword?: boolean;
  ownerId: string;
  owner: { id: string; username: string };
  members: Array<{ userId: string; username: string; role: string }>;
}

export default function RoomPage() {
  const params = useParams();
  const router = useRouter();
  const roomIdParam = (params?.roomId as string) || "";

  const [user, setUser] = useState<{ id: string; username: string } | null>(null);
  const [room, setRoom] = useState<RoomData | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Password Protection state
  const [requiresPassword, setRequiresPassword] = useState(false);
  const [roomPasswordInput, setRoomPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [unlocking, setUnlocking] = useState(false);

  // Files state
  const [files, setFiles] = useState<FileItem[]>([]);
  const [openFiles, setOpenFiles] = useState<FileItem[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // Real-time state
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("reconnecting");
  const [onlineUsers, setOnlineUsers] = useState<Array<{ id: string; username: string }>>([]);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [cursorPos, setCursorPos] = useState({ line: 1, column: 1 });
  const [authToken, setAuthToken] = useState<string>("");

  // Modals state
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Responsive / Layout panels state
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [mobileTab, setMobileTab] = useState<"files" | "editor" | "chat">("editor");

  const roomWsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);

  const getAuthHeaders = () => {
    const token =
      typeof window !== "undefined"
        ? sessionStorage.getItem("coderoom_token") || localStorage.getItem("coderoom_token") || ""
        : "";
    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    return headers;
  };

  // Fetch Room Info
  const fetchRoomData = useCallback(
    async () => {
      try {
        const headers = getAuthHeaders();
        const res = await fetch(`/api/rooms/${roomIdParam}`, { headers });
        if (res.status === 401) {
          router.push(`/login?redirect=/room/${roomIdParam}`);
          return;
        }

        const data = await res.json();

        if (!res.ok) {
          setError(data.error || "This room could not be found.");
          setLoading(false);
          return;
        }

        if (data.requiresPassword) {
          setRequiresPassword(true);
          setRoom(data.room);
          setLoading(false);
          return;
        }

        setRequiresPassword(false);
        setRoom(data.room);
        setIsOwner(Boolean(data.isOwner));

        // Load files
        const filesRes = await fetch(`/api/rooms/${data.room.id}/files`, { headers });
        if (filesRes.ok) {
          const filesData = await filesRes.json();
          const loadedFiles: FileItem[] = filesData.files || [];
          setFiles(loadedFiles);

          // Find first code file to open
          const firstCodeFile = loadedFiles.find((f) => f.type === "file");
          if (firstCodeFile) {
            setActiveFileId(firstCodeFile.id);
            setOpenFiles([firstCodeFile]);
          }
        }

        // Load messages
        const msgRes = await fetch(`/api/rooms/${data.room.id}/messages`, { headers });
        if (msgRes.ok) {
          const msgData = await msgRes.json();
          setMessages(msgData.messages || []);
        }

        setLoading(false);
      } catch {
        setError("Could not connect to the server. Please check your network.");
        setLoading(false);
      }
    },
    [roomIdParam, router]
  );

  // Initial user auth & room data loading
  useEffect(() => {
    const headers = getAuthHeaders();
    fetch("/api/auth/me", { headers })
      .then((res) => {
        if (!res.ok) {
          router.push(`/login?redirect=/room/${roomIdParam}`);
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data?.user) {
          setUser(data.user);
          if (data.token) {
            setAuthToken(data.token);
            sessionStorage.setItem("coderoom_token", data.token);
            localStorage.setItem("coderoom_token", data.token);
          }
          fetchRoomData();
        }
      })
      .catch(() => {
        router.push(`/login?redirect=/room/${roomIdParam}`);
      });
  }, [roomIdParam, router, fetchRoomData]);

  // Handle Joining Password Protected Room
  const handleUnlockRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setUnlocking(true);

    try {
      const res = await fetch(`/api/rooms/${roomIdParam}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: roomPasswordInput }),
      });

      const data = await res.json();

      if (!res.ok) {
        setPasswordError(data.error || "Incorrect room password.");
        setUnlocking(false);
        return;
      }

      setRequiresPassword(false);
      setLoading(true);
      fetchRoomData();
    } catch {
      setPasswordError("Failed to unlock room.");
      setUnlocking(false);
    }
  };

  // Setup Room WebSocket Connection
  useEffect(() => {
    if (!room?.id || requiresPassword || !user) return;

    let isMounted = true;

    const connectWs = () => {
      if (!isMounted) return;

      const isSecure = window.location.protocol === "https:";
      const wsProtocol = isSecure ? "wss:" : "ws:";
      const wsHost = window.location.host;

      const token =
        sessionStorage.getItem("coderoom_token") ||
        localStorage.getItem("coderoom_token") ||
        "";

      const tokenParam = token ? `&token=${encodeURIComponent(token)}` : "";
      const wsUrl = `${wsProtocol}//${wsHost}/ws?roomId=${encodeURIComponent(room.id)}${tokenParam}`;

      setConnectionStatus("reconnecting");
      const ws = new WebSocket(wsUrl);
      roomWsRef.current = ws;

      ws.onopen = () => {
        if (!isMounted) return;
        setConnectionStatus("connected");
      };

      ws.onmessage = (event) => {
        if (!isMounted) return;
        try {
          const data = JSON.parse(event.data);
          const { type, message, onlineUsers, file, fileId, room: updatedRoom } = data;

          switch (type) {
            case "presence:update":
              if (Array.isArray(onlineUsers)) {
                setOnlineUsers(onlineUsers);
              }
              break;

            case "chat:message":
              if (message) {
                setMessages((prev) => {
                  if (prev.some((m) => m.id === message.id)) return prev;
                  return [...prev, message];
                });
              }
              break;

            case "file:create":
              if (file) {
                setFiles((prev) => {
                  if (prev.some((f) => f.id === file.id)) return prev;
                  return [...prev, file];
                });
              }
              break;

            case "file:rename":
            case "file:update":
              if (file) {
                setFiles((prev) =>
                  prev.map((f) => (f.id === file.id ? { ...f, ...file } : f))
                );
                setOpenFiles((prev) =>
                  prev.map((f) => (f.id === file.id ? { ...f, ...file } : f))
                );
              }
              break;

            case "file:delete":
              if (fileId) {
                setFiles((prev) => prev.filter((f) => f.id !== fileId));
                setOpenFiles((prev) => prev.filter((f) => f.id !== fileId));
                setActiveFileId((prev) => (prev === fileId ? null : prev));
              }
              break;

            case "room:update":
              if (updatedRoom) {
                setRoom((prev) => (prev ? { ...prev, ...updatedRoom } : prev));
              }
              break;

            default:
              break;
          }
        } catch (err) {
          console.error("Error processing room WS message:", err);
        }
      };

      ws.onclose = () => {
        if (!isMounted) return;
        setConnectionStatus("disconnected");
        // Auto-reconnect after 3 seconds
        reconnectTimerRef.current = setTimeout(() => {
          connectWs();
        }, 3000);
      };

      ws.onerror = () => {
        if (!isMounted) return;
        setConnectionStatus("disconnected");
      };
    };

    connectWs();

    return () => {
      isMounted = false;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      if (roomWsRef.current) {
        roomWsRef.current.close();
        roomWsRef.current = null;
      }
    };
  }, [room?.id, requiresPassword, user]);

  // Send WebSocket Event helper
  const sendWsEvent = useCallback((type: string, payload: Record<string, unknown>) => {
    if (roomWsRef.current && roomWsRef.current.readyState === WebSocket.OPEN) {
      roomWsRef.current.send(JSON.stringify({ type, payload }));
    }
  }, []);

  // Send Chat Message
  const handleSendMessage = useCallback(
    async (content: string) => {
      if (!room?.id || !user) return;

      // Send through WebSocket for instant broadcast
      if (roomWsRef.current && roomWsRef.current.readyState === WebSocket.OPEN) {
        sendWsEvent("chat:send", { content });
      } else {
        // Fallback REST call if WS not ready
        try {
          const res = await fetch(`/api/rooms/${room.id}/messages`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content }),
          });
          if (res.ok) {
            const data = await res.json();
            if (data?.message) {
              setMessages((prev) => [...prev, data.message]);
            }
          }
        } catch (err) {
          console.error("Error sending message:", err);
        }
      }
    },
    [room?.id, user, sendWsEvent]
  );

  // File Operations
  const handleCreateFile = async (
    name: string,
    parentId: string | null,
    type: "file" | "folder"
  ) => {
    if (!room?.id) return;
    try {
      const res = await fetch(`/api/rooms/${room.id}/files`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ name, parentId, type }),
      });

      if (res.ok) {
        const data = await res.json();
        const createdFile: FileItem = data.file;

        setFiles((prev) => {
          if (prev.some((f) => f.id === createdFile.id)) return prev;
          return [...prev, createdFile];
        });
        sendWsEvent("file:create", { file: createdFile });

        if (createdFile.type === "file") {
          setActiveFileId(createdFile.id);
          setOpenFiles((prev) => {
            if (prev.some((f) => f.id === createdFile.id)) return prev;
            return [...prev, createdFile];
          });
          setMobileTab("editor");
        }
      }
    } catch (err) {
      console.error("Error creating file:", err);
    }
  };

  const handleRenameFile = async (fileId: string, newName: string) => {
    if (!room?.id) return;
    try {
      const res = await fetch(`/api/rooms/${room.id}/files/${fileId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ name: newName }),
      });

      if (res.ok) {
        const data = await res.json();
        const updated = data.file;
        setFiles((prev) => prev.map((f) => (f.id === fileId ? { ...f, ...updated } : f)));
        setOpenFiles((prev) =>
          prev.map((f) => (f.id === fileId ? { ...f, ...updated } : f))
        );
        sendWsEvent("file:rename", { file: updated });
      }
    } catch (err) {
      console.error("Error renaming file:", err);
    }
  };

  const handleDeleteFile = async (fileId: string) => {
    if (!room?.id) return;
    const confirmed = window.confirm("Are you sure you want to delete this item?");
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/rooms/${room.id}/files/${fileId}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });

      if (res.ok) {
        setFiles((prev) => prev.filter((f) => f.id !== fileId));
        setOpenFiles((prev) => prev.filter((f) => f.id !== fileId));
        if (activeFileId === fileId) {
          const remaining = openFiles.filter((f) => f.id !== fileId);
          setActiveFileId(remaining.length > 0 ? remaining[0].id : null);
        }
        sendWsEvent("file:delete", { fileId });
      }
    } catch (err) {
      console.error("Error deleting file:", err);
    }
  };

  const handleSelectFile = (file: FileItem) => {
    if (file.type !== "file") return;
    setActiveFileId(file.id);
    setOpenFiles((prev) => {
      if (prev.some((f) => f.id === file.id)) return prev;
      return [...prev, file];
    });
    setMobileTab("editor");
  };

  const handleCloseTab = (fileId: string) => {
    const nextOpen = openFiles.filter((f) => f.id !== fileId);
    setOpenFiles(nextOpen);
    if (activeFileId === fileId) {
      setActiveFileId(nextOpen.length > 0 ? nextOpen[nextOpen.length - 1].id : null);
    }
  };

  const activeFile = files.find((f) => f.id === activeFileId) || null;

  if (loading) {
    return (
      <div className="h-screen bg-background flex flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
        <p className="text-sm text-muted">Connecting to collaborative room...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
        <div className="h-12 w-12 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mb-4">
          <AlertCircle className="h-6 w-6" />
        </div>
        <h2 className="text-xl font-bold text-foreground">Room Error</h2>
        <p className="text-sm text-muted max-w-sm mt-1 mb-6">{error}</p>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-semibold transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Return to Dashboard</span>
        </Link>
      </div>
    );
  }

  // Password Protected Room Modal Screen
  if (requiresPassword) {
    return (
      <div className="h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-surface border border-border rounded-2xl p-6 sm:p-8 shadow-2xl">
          <div className="text-center mb-6">
            <div className="h-12 w-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-3">
              <Lock className="h-6 w-6" />
            </div>
            <h2 className="text-xl font-bold text-foreground">Protected Room</h2>
            <p className="text-xs text-muted mt-1">
              This collaborative room requires a password to join.
            </p>
          </div>

          {passwordError && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{passwordError}</span>
            </div>
          )}

          <form onSubmit={handleUnlockRoom} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-2">
                Room Password
              </label>
              <div className="relative">
                <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
                <input
                  type="password"
                  value={roomPasswordInput}
                  onChange={(e) => setRoomPasswordInput(e.target.value)}
                  placeholder="Enter password"
                  required
                  autoFocus
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-panel border border-border text-foreground text-sm focus:outline-none focus:border-accent"
                />
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between gap-3">
              <Link
                href="/dashboard"
                className="px-4 py-2.5 rounded-xl border border-border text-muted hover:text-foreground text-xs font-semibold hover:bg-surface-hover transition-colors"
              >
                Back to Dashboard
              </Link>
              <button
                type="submit"
                disabled={unlocking}
                className="px-5 py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-semibold transition-colors flex items-center gap-2 disabled:opacity-50 shadow-sm"
              >
                {unlocking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Lock className="h-3.5 w-3.5" />}
                <span>Unlock Room</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-background text-foreground flex flex-col overflow-hidden">
      {/* Room Header */}
      {room && (
        <RoomHeader
          roomName={room.name}
          roomCode={room.roomCode}
          connectionStatus={connectionStatus}
          onlineUsers={onlineUsers}
          onOpenShare={() => setIsShareOpen(true)}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />
      )}

      {/* Mobile Tab Switcher */}
      <div className="md:hidden flex border-b border-border bg-surface select-none">
        <button
          onClick={() => setMobileTab("files")}
          className={`flex-1 py-2 text-xs font-semibold flex items-center justify-center gap-1.5 border-b-2 transition-colors ${
            mobileTab === "files"
              ? "border-accent text-accent bg-panel"
              : "border-transparent text-muted hover:text-foreground"
          }`}
        >
          <FolderTree className="h-3.5 w-3.5" />
          <span>Files ({files.length})</span>
        </button>

        <button
          onClick={() => setMobileTab("editor")}
          className={`flex-1 py-2 text-xs font-semibold flex items-center justify-center gap-1.5 border-b-2 transition-colors ${
            mobileTab === "editor"
              ? "border-accent text-accent bg-panel"
              : "border-transparent text-muted hover:text-foreground"
          }`}
        >
          <FileCode className="h-3.5 w-3.5" />
          <span>Editor</span>
        </button>

        <button
          onClick={() => setMobileTab("chat")}
          className={`flex-1 py-2 text-xs font-semibold flex items-center justify-center gap-1.5 border-b-2 transition-colors ${
            mobileTab === "chat"
              ? "border-accent text-accent bg-panel"
              : "border-transparent text-muted hover:text-foreground"
          }`}
        >
          <MessageSquare className="h-3.5 w-3.5" />
          <span>Chat ({messages.length})</span>
        </button>
      </div>

      {/* Main 3-Panel Layout */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left: File Explorer Panel */}
        <div
          className={`
            ${mobileTab === "files" ? "flex" : "hidden"} md:flex
            ${leftPanelOpen ? "w-full md:w-60 lg:w-64" : "hidden"}
            h-full flex-col shrink-0 transition-all duration-150 relative z-10
          `}
        >
          <FileExplorer
            files={files}
            activeFileId={activeFileId}
            onSelectFile={handleSelectFile}
            onCreateFile={handleCreateFile}
            onRenameFile={handleRenameFile}
            onDeleteFile={handleDeleteFile}
          />
        </div>

        {/* Center: Monaco Collaborative Editor Panel */}
        <div
          className={`
            ${mobileTab === "editor" ? "flex" : "hidden"} md:flex
            flex-1 h-full flex-col min-w-0 bg-panel relative overflow-hidden
          `}
        >
          {/* Panel Toggle buttons on desktop */}
          <div className="hidden md:flex absolute top-2 right-2 z-20 items-center gap-1">
            <button
              onClick={() => setLeftPanelOpen(!leftPanelOpen)}
              title={leftPanelOpen ? "Collapse File Explorer" : "Expand File Explorer"}
              className="p-1.5 rounded-lg bg-surface/80 hover:bg-surface border border-border text-muted hover:text-foreground transition-colors shadow-sm"
            >
              {leftPanelOpen ? (
                <PanelLeftClose className="h-3.5 w-3.5" />
              ) : (
                <PanelLeftOpen className="h-3.5 w-3.5" />
              )}
            </button>
            <button
              onClick={() => setRightPanelOpen(!rightPanelOpen)}
              title={rightPanelOpen ? "Collapse Chat Panel" : "Expand Chat Panel"}
              className="p-1.5 rounded-lg bg-surface/80 hover:bg-surface border border-border text-muted hover:text-foreground transition-colors shadow-sm"
            >
              {rightPanelOpen ? (
                <PanelRightClose className="h-3.5 w-3.5" />
              ) : (
                <PanelRightOpen className="h-3.5 w-3.5" />
              )}
            </button>
          </div>

          {room && user && (
            <CodeEditor
              roomId={room.id}
              roomCode={room.roomCode}
              activeFile={activeFile}
              openFiles={openFiles}
              currentUser={user}
              authToken={authToken}
              onSelectTab={handleSelectFile}
              onCloseTab={handleCloseTab}
              onCursorChange={(line, column) => setCursorPos({ line, column })}
              onSaveStatusChange={(status) => setSaveStatus(status)}
            />
          )}
        </div>

        {/* Right: Room Chat Panel */}
        <div
          className={`
            ${mobileTab === "chat" ? "flex" : "hidden"} md:flex
            ${rightPanelOpen ? "w-full md:w-72 lg:w-80" : "hidden"}
            h-full flex-col shrink-0 transition-all duration-150 relative z-10
          `}
        >
          {room && user && (
            <RoomChat
              roomId={room.id}
              messages={messages}
              currentUserId={user.id}
              onSendMessage={handleSendMessage}
            />
          )}
        </div>
      </div>

      {/* Bottom Status Bar */}
      {room && (
        <StatusBar
          connectionStatus={connectionStatus}
          saveStatus={saveStatus}
          cursorPos={cursorPos}
          language={activeFile ? getLanguageFromFilename(activeFile.name) : "plaintext"}
          roomCode={room.roomCode}
        />
      )}

      {/* Share Modal */}
      {room && (
        <ShareModal
          isOpen={isShareOpen}
          onClose={() => setIsShareOpen(false)}
          roomCode={room.roomCode}
          roomName={room.name}
        />
      )}

      {/* Room Settings Modal */}
      {room && (
        <RoomSettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          room={room}
          isOwner={isOwner}
          onUpdated={() => fetchRoomData()}
        />
      )}
    </div>
  );
}
