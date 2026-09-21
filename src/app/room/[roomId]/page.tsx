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
  Shield,
  ShieldAlert,
  CheckCircle2,
  X,
  Keyboard,
  Minimize2,
  Settings,
} from "lucide-react";
import RoomHeader, { ConnectionStatus } from "@/components/room/RoomHeader";
import FileExplorer, { FileItem } from "@/components/room/FileExplorer";
import CodeEditor, {
  SaveStatus,
  ExecutionState,
  ExecutionResult,
} from "@/components/room/CodeEditor";
import RoomChat, { ChatMessage } from "@/components/room/RoomChat";
import StatusBar from "@/components/room/StatusBar";
import ShareModal from "@/components/room/ShareModal";
import RoomSettingsModal from "@/components/room/RoomSettingsModal";
import RoomPermissionsModal, {
  PermissionRequestItem,
} from "@/components/room/RoomPermissionsModal";
import KeyboardShortcutsModal from "@/components/room/KeyboardShortcutsModal";
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
  members: Array<{
    id?: string;
    userId: string;
    username: string;
    role: string;
    canEdit?: boolean;
    allowedFiles?: string[];
    joinedAt?: string;
  }>;
  pendingRequests?: PermissionRequestItem[];
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
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Permissions state
  const [canEdit, setCanEdit] = useState(false);
  const [allowedFiles, setAllowedFiles] = useState<string[]>([]);
  const [pendingRequests, setPendingRequests] = useState<PermissionRequestItem[]>([]);
  const [myPendingRequests, setMyPendingRequests] = useState<
    Array<{ id?: string; fileId: string | null; fileName: string | null; status: string }>
  >([]);
  const [isPermissionsOpen, setIsPermissionsOpen] = useState(false);
  const [permissionToast, setPermissionToast] = useState<{
    id: string;
    message: string;
    type: "info" | "success" | "warning" | "request";
    request?: PermissionRequestItem;
  } | null>(null);

  // Single-Runner Execution state
  const [executionState, setExecutionState] = useState<ExecutionState>({
    isRunning: false,
    userId: null,
    username: null,
    fileId: null,
    fileName: null,
    startTime: null,
  });
  const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null);

  // Password Protection state
  const [requiresPassword, setRequiresPassword] = useState(false);
  const [roomPasswordInput, setRoomPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [unlocking, setUnlocking] = useState(false);

  // Files state
  const [files, setFiles] = useState<FileItem[]>([]);
  const [openFiles, setOpenFiles] = useState<FileItem[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const activeFile = files.find((f) => f.id === activeFileId) || null;

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
  const [runNotification, setRunNotification] = useState<{
    username: string;
    filename: string;
    status: string;
    executionTimeMs?: number;
  } | null>(null);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);

  // Layout & Resizing panels state
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [leftWidth, setLeftWidth] = useState(250);
  const [rightWidth, setRightWidth] = useState(310);
  const [isDraggingLeft, setIsDraggingLeft] = useState(false);
  const [isDraggingRight, setIsDraggingRight] = useState(false);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [mobileTab, setMobileTab] = useState<"files" | "editor" | "chat">("editor");

  const roomWsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isOwnerRef = useRef(isOwner);

  useEffect(() => {
    isOwnerRef.current = isOwner;
  }, [isOwner]);

  // Load saved panel widths
  useEffect(() => {
    try {
      const storedLeft = localStorage.getItem("coderoom_left_width");
      if (storedLeft) {
        const parsed = parseInt(storedLeft, 10);
        if (parsed >= 180 && parsed <= 450) setLeftWidth(parsed);
      }
      const storedRight = localStorage.getItem("coderoom_right_width");
      if (storedRight) {
        const parsed = parseInt(storedRight, 10);
        if (parsed >= 220 && parsed <= 500) setRightWidth(parsed);
      }
    } catch {}
  }, []);

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

  // Drag Resizers
  const handleLeftResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingLeft(true);
    const startX = e.clientX;
    const startWidth = leftWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX;
      const newWidth = Math.max(180, Math.min(460, startWidth + delta));
      setLeftWidth(newWidth);
    };

    const onMouseUp = () => {
      setIsDraggingLeft(false);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      try {
        localStorage.setItem("coderoom_left_width", leftWidth.toString());
      } catch {}
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  const handleRightResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingRight(true);
    const startX = e.clientX;
    const startWidth = rightWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = startX - moveEvent.clientX;
      const newWidth = Math.max(220, Math.min(500, startWidth + delta));
      setRightWidth(newWidth);
    };

    const onMouseUp = () => {
      setIsDraggingRight(false);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      try {
        localStorage.setItem("coderoom_right_width", rightWidth.toString());
      } catch {}
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  // Fetch Room Info
  const fetchRoomData = useCallback(async () => {
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
      const ownerStatus = Boolean(data.isOwner);
      setIsOwner(ownerStatus);
      setCanEdit(Boolean(data.canEdit));
      setAllowedFiles(data.allowedFiles || []);
      if (data.room?.pendingRequests) {
        setPendingRequests(data.room.pendingRequests);
      }
      if (data.myPendingRequests) {
        setMyPendingRequests(data.myPendingRequests);
      }

      // Load files
      const filesRes = await fetch(`/api/rooms/${data.room.id}/files`, { headers });
      if (filesRes.ok) {
        const filesData = await filesRes.json();
        const loadedFiles: FileItem[] = filesData.files || [];
        setFiles(loadedFiles);

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

      // Load current execution state
      try {
        const runRes = await fetch(`/api/rooms/${data.room.id}/run`, { headers });
        if (runRes.ok) {
          const runData = await runRes.json();
          if (runData?.execution) {
            setExecutionState(runData.execution);
          }
        }
      } catch {}

      setLoading(false);
    } catch {
      setError("Could not connect to the server. Please check your network.");
      setLoading(false);
    }
  }, [roomIdParam, router]);

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
              if (data.execution) {
                setExecutionState(data.execution);
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

            case "chat:clear":
              setMessages([]);
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

            case "code:run":
              if (data.user && data.filename) {
                setRunNotification({
                  username: data.user.username,
                  filename: data.filename,
                  status: data.result?.status,
                  executionTimeMs: data.result?.executionTimeMs,
                });
                setTimeout(() => {
                  setRunNotification(null);
                }, 6000);
              }
              break;

            case "permission:request": {
              const reqItem = data.request;
              if (reqItem) {
                setPendingRequests((prev) => {
                  if (prev.some((p) => p.id === reqItem.id)) return prev;
                  return [reqItem, ...prev];
                });

                if (isOwnerRef.current) {
                  setPermissionToast({
                    id: reqItem.id,
                    message: `${reqItem.username} requested permission to edit ${reqItem.fileName || "this file"}`,
                    type: "request",
                    request: reqItem,
                  });
                }

                if (reqItem.userId === user?.id) {
                  setMyPendingRequests((prev) => {
                    if (prev.some((p) => p.fileId === reqItem.fileId)) return prev;
                    return [
                      ...prev,
                      {
                        id: reqItem.id,
                        fileId: reqItem.fileId,
                        fileName: reqItem.fileName,
                        status: "PENDING",
                      },
                    ];
                  });
                }
              }
              break;
            }

            case "permission:updated": {
              const perm = data.permission;
              if (perm) {
                if (perm.userId === user?.id) {
                  setCanEdit(Boolean(perm.canEdit));
                  setAllowedFiles(perm.allowedFiles || []);
                  setMyPendingRequests((prev) =>
                    prev.filter((r) =>
                      perm.scope === "room" ? false : r.fileId !== perm.approvedFileId
                    )
                  );
                  setPermissionToast({
                    id: Date.now().toString(),
                    message: `Admin granted you edit permission!`,
                    type: "success",
                  });
                }

                setPendingRequests((prev) =>
                  prev.filter((r) =>
                    perm.scope === "room"
                      ? r.userId !== perm.userId
                      : !(r.userId === perm.userId && r.fileId === perm.approvedFileId)
                  )
                );

                setRoom((prev) => {
                  if (!prev) return prev;
                  return {
                    ...prev,
                    members: prev.members.map((m) =>
                      m.userId === perm.userId
                        ? {
                            ...m,
                            canEdit: perm.canEdit,
                            allowedFiles: perm.allowedFiles,
                            role: perm.canEdit ? "EDITOR" : m.role,
                          }
                        : m
                    ),
                  };
                });
              }
              break;
            }

            case "permission:revoked": {
              const perm = data.permission;
              if (perm) {
                if (perm.userId === user?.id) {
                  setCanEdit(Boolean(perm.canEdit));
                  setAllowedFiles(perm.allowedFiles || []);
                  setPermissionToast({
                    id: Date.now().toString(),
                    message: `Edit permission was revoked by the admin.`,
                    type: "warning",
                  });
                }

                setRoom((prev) => {
                  if (!prev) return prev;
                  return {
                    ...prev,
                    members: prev.members.map((m) =>
                      m.userId === perm.userId
                        ? {
                            ...m,
                            canEdit: perm.canEdit,
                            allowedFiles: perm.allowedFiles,
                            role: perm.canEdit ? "EDITOR" : "MEMBER",
                          }
                        : m
                    ),
                  };
                });
              }
              break;
            }

            case "permission:declined": {
              const { requestId, targetUserId, fileId } = data;
              setMyPendingRequests((prev) => {
                const wasMyRequest =
                  targetUserId === user?.id ||
                  (requestId && prev.some((r) => r.id === requestId));
                if (wasMyRequest) {
                  setPermissionToast({
                    id: Date.now().toString(),
                    message: `Admin declined your edit request.`,
                    type: "warning",
                  });
                  return prev.filter((r) =>
                    requestId ? r.id !== requestId : r.fileId !== fileId
                  );
                }
                return prev;
              });

              setPendingRequests((prev) =>
                prev.filter((r) =>
                  requestId
                    ? r.id !== requestId
                    : !(
                        r.userId === targetUserId &&
                        (!fileId || r.fileId === fileId)
                      )
                )
              );
              break;
            }

            case "permission:cancelled": {
              const { userId, fileId } = data;
              setPendingRequests((prev) =>
                prev.filter(
                  (r) => !(r.userId === userId && (!fileId || r.fileId === fileId))
                )
              );
              break;
            }

            case "execution:update": {
              if (data.execution) {
                setExecutionState(data.execution);
              }
              break;
            }

            case "execution:start": {
              if (data.execution) {
                setExecutionState(data.execution);
                if (data.execution.userId !== user?.id) {
                  setPermissionToast({
                    id: Date.now().toString(),
                    message: `${data.execution.username} is running ${data.execution.fileName}`,
                    type: "info",
                  });
                }
              }
              break;
            }

            case "execution:end": {
              setExecutionState({
                isRunning: false,
                userId: null,
                username: null,
                fileId: null,
                fileName: null,
                startTime: null,
              });
              if (data.result) {
                setExecutionResult(data.result);
              }
              break;
            }

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

  const sendWsEvent = useCallback((type: string, payload: Record<string, unknown>) => {
    if (roomWsRef.current && roomWsRef.current.readyState === WebSocket.OPEN) {
      roomWsRef.current.send(JSON.stringify({ type, payload }));
    }
  }, []);

  const handleSendMessage = useCallback(
    async (content: string) => {
      if (!room?.id || !user) return;

      if (roomWsRef.current && roomWsRef.current.readyState === WebSocket.OPEN) {
        sendWsEvent("chat:send", { content });
      } else {
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

  const handleClearChat = useCallback(async () => {
    if (!room?.id) return;
    setMessages([]);
    if (roomWsRef.current && roomWsRef.current.readyState === WebSocket.OPEN) {
      sendWsEvent("chat:clear", {});
    }
    try {
      await fetch(`/api/rooms/${room.id}/messages`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
    } catch (err) {
      console.error("Error clearing messages:", err);
    }
  }, [room?.id, sendWsEvent]);

  // File Operations
  const handleCreateFile = async (
    name: string,
    parentId: string | null,
    type: "file" | "folder",
    content: string = ""
  ) => {
    if (!room?.id) return;
    try {
      const res = await fetch(`/api/rooms/${room.id}/files`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ name, parentId, type, content }),
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

  const handleMoveFile = async (fileId: string, newParentId: string | null) => {
    if (!room?.id) return;
    try {
      const res = await fetch(`/api/rooms/${room.id}/files/${fileId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ parentId: newParentId }),
      });

      if (res.ok) {
        const data = await res.json();
        const updated = data.file;
        setFiles((prev) => prev.map((f) => (f.id === fileId ? { ...f, ...updated } : f)));
        setOpenFiles((prev) =>
          prev.map((f) => (f.id === fileId ? { ...f, ...updated } : f))
        );
        sendWsEvent("file:update", { file: updated });
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Failed to move item.");
      }
    } catch (err) {
      console.error("Error moving file:", err);
    }
  };

  const handleDuplicateFile = async (fileId: string, targetParentId?: string | null) => {
    if (!room?.id) return;
    try {
      const res = await fetch(`/api/rooms/${room.id}/files/${fileId}/duplicate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ targetParentId }),
      });

      if (res.ok) {
        const data = await res.json();
        const createdFiles: FileItem[] = data.files || [];
        setFiles((prev) => {
          const prevIds = new Set(prev.map((f) => f.id));
          const newItems = createdFiles.filter((f) => !prevIds.has(f.id));
          return [...prev, ...newItems];
        });
        createdFiles.forEach((file) => {
          sendWsEvent("file:create", { file });
        });
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Failed to duplicate item.");
      }
    } catch (err) {
      console.error("Error duplicating file:", err);
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

  // Toast auto-dismiss timer
  useEffect(() => {
    if (!permissionToast || permissionToast.type === "request") return;
    const timer = setTimeout(() => {
      setPermissionToast(null);
    }, 4000);
    return () => clearTimeout(timer);
  }, [permissionToast]);

  // Permission Actions
  const handleRequestPermission = useCallback(
    async (fileId: string) => {
      if (!room?.id || !user) return;
      const file = files.find((f) => f.id === fileId);
      const fileName = file?.name || "file";

      setMyPendingRequests((prev) => [
        ...prev.filter((r) => r.fileId !== fileId),
        { fileId, fileName, status: "PENDING" },
      ]);

      sendWsEvent("permission:request", { fileId, fileName });

      try {
        await fetch(`/api/rooms/${room.id}/permissions`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getAuthHeaders() },
          body: JSON.stringify({ action: "request", fileId }),
        });
      } catch (err) {
        console.error("Error requesting permission:", err);
      }
    },
    [room?.id, user, files, sendWsEvent]
  );

  const handleCancelPermissionRequest = useCallback(
    async (fileId: string) => {
      if (!room?.id) return;
      setMyPendingRequests((prev) => prev.filter((r) => r.fileId !== fileId));
      sendWsEvent("permission:cancel", { fileId });

      try {
        await fetch(`/api/rooms/${room.id}/permissions`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getAuthHeaders() },
          body: JSON.stringify({ action: "cancel", fileId }),
        });
      } catch (err) {
        console.error("Error cancelling permission request:", err);
      }
    },
    [room?.id, sendWsEvent]
  );

  const handleGrantPermission = useCallback(
    async (
      targetUserId: string,
      fileId?: string | null,
      scope: "file" | "room" = "file"
    ) => {
      if (!room?.id) return;
      sendWsEvent("permission:grant", { targetUserId, fileId, scope });

      try {
        const res = await fetch(`/api/rooms/${room.id}/permissions`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getAuthHeaders() },
          body: JSON.stringify({
            action: "grant",
            targetUserId,
            fileId,
            scope,
          }),
        });

        if (res.ok) {
          setPendingRequests((prev) =>
            prev.filter((r) =>
              scope === "room"
                ? r.userId !== targetUserId
                : !(r.userId === targetUserId && r.fileId === fileId)
            )
          );
        }
      } catch (err) {
        console.error("Error granting permission:", err);
      }
    },
    [room?.id, sendWsEvent]
  );

  const handleRevokePermission = useCallback(
    async (
      targetUserId: string,
      fileId?: string | null,
      scope: "file" | "room" = "file"
    ) => {
      if (!room?.id) return;
      sendWsEvent("permission:revoke", { targetUserId, fileId, scope });

      try {
        await fetch(`/api/rooms/${room.id}/permissions`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getAuthHeaders() },
          body: JSON.stringify({
            action: "revoke",
            targetUserId,
            fileId,
            scope,
          }),
        });
      } catch (err) {
        console.error("Error revoking permission:", err);
      }
    },
    [room?.id, sendWsEvent]
  );

  const handleDeclinePermission = useCallback(
    async (
      requestId?: string,
      targetUserId?: string,
      fileId?: string | null
    ) => {
      if (!room?.id) return;
      sendWsEvent("permission:decline", { requestId, targetUserId, fileId });

      setPendingRequests((prev) =>
        prev.filter((r) =>
          requestId
            ? r.id !== requestId
            : !(r.userId === targetUserId && (!fileId || r.fileId === fileId))
        )
      );

      try {
        await fetch(`/api/rooms/${room.id}/permissions`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getAuthHeaders() },
          body: JSON.stringify({
            action: "decline",
            requestId,
            targetUserId,
            fileId,
          }),
        });
      } catch (err) {
        console.error("Error declining permission:", err);
      }
    },
    [room?.id, sendWsEvent]
  );

  // Run Program Handler
  const handleRunCode = useCallback(
    async (fileId: string, code?: string) => {
      if (!room?.id) return;
      const targetFile = files.find((f) => f.id === fileId) || (activeFile?.id === fileId ? activeFile : null);
      const codeToRun = typeof code === "string" ? code : targetFile?.content || "";

      // 1. Optimistically activate running state immediately
      setExecutionState({
        isRunning: true,
        userId: user?.id || null,
        username: user?.username || "You",
        fileId,
        fileName: targetFile?.name || "code",
        startTime: Date.now(),
      });

      try {
        const res = await fetch(`/api/rooms/${room.id}/run`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getAuthHeaders() },
          body: JSON.stringify({ action: "run", fileId, code: codeToRun }),
        });

        const data = await res.json();
        if (!res.ok) {
          setExecutionState({
            isRunning: false,
            userId: null,
            username: null,
            fileId: null,
            fileName: null,
            startTime: null,
          });

          const errorMsg = data.error || "Failed to execute program.";
          setExecutionResult({
            stdout: "",
            stderr: errorMsg,
            exitCode: 1,
            executionTimeMs: 0,
            error: errorMsg,
            fileName: targetFile?.name,
            runBy: user?.username,
          });

          if (res.status === 409) {
            setPermissionToast({
              id: Date.now().toString(),
              message:
                data.error ||
                "Another user is currently running a program. Only one user can run at a time.",
              type: "warning",
            });
          } else {
            setPermissionToast({
              id: Date.now().toString(),
              message: errorMsg,
              type: "warning",
            });
          }
          return;
        }

        // 2. Apply execution result directly to state so terminal updates immediately
        if (data?.result) {
          setExecutionResult(data.result);
          setExecutionState({
            isRunning: false,
            userId: null,
            username: null,
            fileId: null,
            fileName: null,
            startTime: null,
          });
        }
      } catch (err) {
        console.error("Error running code:", err);
        setExecutionState({
          isRunning: false,
          userId: null,
          username: null,
          fileId: null,
          fileName: null,
          startTime: null,
        });
        setExecutionResult({
          stdout: "",
          stderr: "Network error: Could not reach execution server.",
          exitCode: 1,
          executionTimeMs: 0,
          error: "Network error",
          fileName: targetFile?.name,
          runBy: user?.username,
        });
      }
    },
    [room?.id, files, activeFile, user?.id, user?.username]
  );

  // Stop Program Handler
  const handleStopCode = useCallback(async () => {
    if (!room?.id) return;
    try {
      const res = await fetch(`/api/rooms/${room.id}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ action: "stop" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPermissionToast({
          id: Date.now().toString(),
          message: data.error || "Failed to stop execution.",
          type: "warning",
        });
      } else {
        setExecutionState({
          isRunning: false,
          userId: null,
          username: null,
          fileId: null,
          fileName: null,
          startTime: null,
        });
      }
    } catch (err) {
      console.error("Error stopping code execution:", err);
    }
  }, [room?.id]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const mod = isMac ? e.metaKey : e.ctrlKey;

      if (mod && e.key.toLowerCase() === "s") {
        e.preventDefault();
        setSaveStatus("saved");
      }

      if (mod && e.key === "Enter") {
        e.preventDefault();
        if (activeFileId) {
          handleRunCode(activeFileId);
        }
      }

      if (mod && e.key.toLowerCase() === "b") {
        e.preventDefault();
        setLeftPanelOpen((prev) => !prev);
      }

      if (mod && e.shiftKey && e.key.toLowerCase() === "c") {
        e.preventDefault();
        setRightPanelOpen((prev) => !prev);
      }

      const targetTag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (
        e.key === "?" &&
        targetTag !== "input" &&
        targetTag !== "textarea" &&
        !(e.target as HTMLElement)?.isContentEditable
      ) {
        e.preventDefault();
        setIsShortcutsOpen(true);
      }

      if (e.key === "F11") {
        e.preventDefault();
        setIsFocusMode((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeFileId, handleRunCode]);

  if (!mounted || loading) {
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
              <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-2">
                Room Password
              </label>
              <div className="relative group">
                <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted group-focus-within:text-accent transition-colors pointer-events-none" />
                <input
                  type="password"
                  name="roomPassword"
                  suppressHydrationWarning
                  value={roomPasswordInput}
                  onChange={(e) => setRoomPasswordInput(e.target.value)}
                  placeholder="Enter password"
                  required
                  className="input-base pl-10 pr-4 text-sm font-medium text-foreground placeholder:text-muted"
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
    <div className="h-screen bg-background text-foreground flex flex-col overflow-hidden relative selection:bg-accent/30 selection:text-white">
      {/* Room Header (Hidden in Focus Mode) */}
      {room && !isFocusMode && (
        <RoomHeader
          roomName={room.name}
          roomCode={room.roomCode}
          connectionStatus={connectionStatus}
          onlineUsers={onlineUsers}
          isOwner={isOwner}
          pendingRequestsCount={pendingRequests.length}
          members={room.members.map((m) => ({
            userId: m.userId,
            username: m.username,
            role: m.role,
            canEdit: Boolean(m.canEdit),
            allowedFiles: m.allowedFiles || [],
          }))}
          onOpenShare={() => setIsShareOpen(true)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenPermissions={() => setIsPermissionsOpen(true)}
          onOpenShortcuts={() => setIsShortcutsOpen(true)}
          onToggleZenMode={() => setIsFocusMode(!isFocusMode)}
          isZenMode={isFocusMode}
        />
      )}

      {/* Floating Exit Button in Focus Mode */}
      {isFocusMode && (
        <div className="absolute top-2 right-4 z-50 flex items-center gap-2 bg-surface/90 backdrop-blur-md border border-border rounded-xl px-3 py-1.5 shadow-xl animate-in fade-in slide-in-from-top-2 duration-150">
          <span className="text-xs font-semibold text-foreground">Focus Mode</span>
          <button
            onClick={() => setIsFocusMode(false)}
            title="Exit Focus Mode (F11)"
            className="flex items-center gap-1 text-xs text-accent hover:underline font-semibold ml-1"
          >
            <Minimize2 className="h-3.5 w-3.5" />
            <span>Exit</span>
          </button>
        </div>
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

      {/* Main Workspace Layout with Left Activity Rail + 3-Panel Splitter */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Activity Rail on Desktop */}
        {!isFocusMode && (
          <aside className="hidden md:flex w-12 bg-panel-header border-r border-border flex-col items-center justify-between py-2 shrink-0 select-none z-20">
            {/* Top Activity Icons */}
            <div className="flex flex-col items-center gap-1 w-full">
              {/* File Explorer Toggle */}
              <button
                onClick={() => setLeftPanelOpen(!leftPanelOpen)}
                title={leftPanelOpen ? "Collapse Explorer (Ctrl+B)" : "Expand Explorer (Ctrl+B)"}
                className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all relative ${
                  leftPanelOpen
                    ? "bg-accent/15 text-accent border border-accent/30 shadow-sm"
                    : "text-muted hover:text-foreground hover:bg-surface"
                }`}
              >
                <FolderTree className="h-4 w-4" />
                {leftPanelOpen && (
                  <span className="absolute -left-0.5 top-1/2 -translate-y-1/2 w-1 h-4 bg-accent rounded-r" />
                )}
              </button>

              {/* Chat Toggle */}
              <button
                onClick={() => setRightPanelOpen(!rightPanelOpen)}
                title={rightPanelOpen ? "Collapse Chat (Ctrl+Shift+C)" : "Expand Chat (Ctrl+Shift+C)"}
                className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all relative ${
                  rightPanelOpen
                    ? "bg-accent/15 text-accent border border-accent/30 shadow-sm"
                    : "text-muted hover:text-foreground hover:bg-surface"
                }`}
              >
                <MessageSquare className="h-4 w-4" />
              </button>

              {/* Permissions & Access */}
              <button
                onClick={() => setIsPermissionsOpen(true)}
                title="Room Permissions & Access"
                className="w-9 h-9 rounded-xl flex items-center justify-center text-muted hover:text-foreground hover:bg-surface transition-all relative"
              >
                <Shield className="h-4 w-4" />
                {pendingRequests.length > 0 && (
                  <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-amber-500 animate-ping" />
                )}
              </button>
            </div>

            {/* Bottom Activity Icons */}
            <div className="flex flex-col items-center gap-1 w-full">
              <button
                onClick={() => setIsShortcutsOpen(true)}
                title="Keyboard Shortcuts (?)"
                className="w-9 h-9 rounded-xl flex items-center justify-center text-muted hover:text-foreground hover:bg-surface transition-all"
              >
                <Keyboard className="h-4 w-4" />
              </button>

              <button
                onClick={() => setIsSettingsOpen(true)}
                title="Room Settings"
                className="w-9 h-9 rounded-xl flex items-center justify-center text-muted hover:text-foreground hover:bg-surface transition-all"
              >
                <Settings className="h-4 w-4" />
              </button>
            </div>
          </aside>
        )}

        {/* Left: File Explorer Panel */}
        <div
          style={{
            width: !leftPanelOpen || isFocusMode ? "0px" : undefined,
          }}
          className={`
            ${mobileTab === "files" ? "flex" : "hidden"} md:flex
            ${leftPanelOpen && !isFocusMode ? "" : "hidden"}
            h-full flex-col shrink-0 min-h-0 overflow-hidden relative z-10
          `}
        >
          <div
            style={{ width: `${leftWidth}px` }}
            className="h-full flex flex-col min-w-0"
          >
            <FileExplorer
              files={files}
              activeFileId={activeFileId}
              canCreateOrEdit={isOwner || canEdit}
              allowedFiles={allowedFiles}
              onSelectFile={handleSelectFile}
              onCreateFile={handleCreateFile}
              onRenameFile={handleRenameFile}
              onDeleteFile={handleDeleteFile}
              onMoveFile={handleMoveFile}
              onDuplicateFile={handleDuplicateFile}
            />
          </div>
        </div>

        {/* Left Drag Resizer Handle */}
        {leftPanelOpen && !isFocusMode && (
          <div
            onMouseDown={handleLeftResizeStart}
            title="Drag to resize file explorer"
            className={`hidden md:flex w-1.5 h-full ${
              isDraggingLeft ? "bg-accent" : "bg-border/40 hover:bg-accent"
            } cursor-col-resize shrink-0 transition-colors z-20 items-center justify-center group select-none`}
          >
            <div className="w-0.5 h-6 bg-border group-hover:bg-white rounded" />
          </div>
        )}

        {/* Center: Monaco Collaborative Editor Panel */}
        <div
          className={`
            ${mobileTab === "editor" ? "flex" : "hidden"} md:flex
            flex-1 h-full flex-col min-w-0 bg-panel relative overflow-hidden
          `}
        >
          {room && user && (
            <CodeEditor
              roomId={room.id}
              roomCode={room.roomCode}
              activeFile={activeFile}
              openFiles={openFiles}
              currentUser={user}
              authToken={authToken}
              isOwner={isOwner}
              canEdit={canEdit}
              allowedFiles={allowedFiles}
              pendingRequests={pendingRequests}
              myPendingRequests={myPendingRequests}
              executionState={executionState}
              executionResult={executionResult}
              onRequestPermission={handleRequestPermission}
              onCancelRequest={handleCancelPermissionRequest}
              onGrantPermission={handleGrantPermission}
              onDeclinePermission={handleDeclinePermission}
              onRunCode={handleRunCode}
              onStopCode={handleStopCode}
              onSelectTab={handleSelectFile}
              onCloseTab={handleCloseTab}
              onNewFilePrompt={() => {
                const name = window.prompt("Enter new file name (e.g. script.py):");
                if (name && name.trim()) {
                  handleCreateFile(name.trim(), null, "file");
                }
              }}
              onCursorChange={(line, column) => setCursorPos({ line, column })}
              onSaveStatusChange={(status) => setSaveStatus(status)}
              onBroadcastRun={(runData) => {
                sendWsEvent("code:run", runData);
              }}
              leftPanelOpen={leftPanelOpen}
              rightPanelOpen={rightPanelOpen}
              onToggleLeftPanel={() => setLeftPanelOpen(!leftPanelOpen)}
              onToggleRightPanel={() => setRightPanelOpen(!rightPanelOpen)}
            />
          )}
        </div>

        {/* Right Drag Resizer Handle */}
        {rightPanelOpen && !isFocusMode && (
          <div
            onMouseDown={handleRightResizeStart}
            title="Drag to resize chat panel"
            className={`hidden md:flex w-1.5 h-full ${
              isDraggingRight ? "bg-accent" : "bg-border/40 hover:bg-accent"
            } cursor-col-resize shrink-0 transition-colors z-20 items-center justify-center group select-none`}
          >
            <div className="w-0.5 h-6 bg-border group-hover:bg-white rounded" />
          </div>
        )}

        {/* Right: Room Chat Panel */}
        <div
          style={{
            width: !rightPanelOpen || isFocusMode ? "0px" : undefined,
          }}
          className={`
            ${mobileTab === "chat" ? "flex" : "hidden"} md:flex
            ${rightPanelOpen && !isFocusMode ? "" : "hidden"}
            h-full flex-col shrink-0 min-h-0 overflow-hidden relative z-10
          `}
        >
          <div
            style={{ width: `${rightWidth}px` }}
            className="h-full flex flex-col min-w-0"
          >
            {room && user && (
              <RoomChat
                roomId={room.id}
                messages={messages}
                currentUserId={user.id}
                onSendMessage={handleSendMessage}
                onClearChat={handleClearChat}
                activeFileName={activeFile?.name}
              />
            )}
          </div>
        </div>
      </div>

      {/* Bottom Status Bar (Hidden in Focus Mode) */}
      {room && !isFocusMode && (
        <StatusBar
          connectionStatus={connectionStatus}
          saveStatus={saveStatus}
          cursorPos={cursorPos}
          language={activeFile ? getLanguageFromFilename(activeFile.name) : "plaintext"}
          roomCode={room.roomCode}
          executionState={executionState}
          onOpenShortcuts={() => setIsShortcutsOpen(true)}
          onToggleZenMode={() => setIsFocusMode(!isFocusMode)}
          isZenMode={isFocusMode}
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

      {/* Real-time Code Execution Toast Notification */}
      {runNotification && (
        <div className="fixed bottom-10 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl bg-surface/95 backdrop-blur border border-border shadow-2xl animate-in fade-in slide-in-from-bottom-3 duration-200">
          <div
            className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
              runNotification.status === "success"
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
            }`}
          >
            <FileCode className="h-4 w-4" />
          </div>
          <div className="text-xs">
            <div className="font-semibold text-foreground">
              {runNotification.username} executed{" "}
              <span className="font-mono text-accent">{runNotification.filename}</span>
            </div>
            <div className="text-[11px] text-muted flex items-center gap-1.5 mt-0.5">
              <span
                className={`font-semibold ${
                  runNotification.status === "success" ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {runNotification.status === "success" ? "Success" : "Failed"}
              </span>
              {runNotification.executionTimeMs !== undefined && (
                <span>• {runNotification.executionTimeMs}ms</span>
              )}
            </div>
          </div>
          <button
            onClick={() => setRunNotification(null)}
            className="ml-2 text-muted hover:text-foreground text-xs p-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* Room Permissions Modal */}
      {room && user && (
        <RoomPermissionsModal
          isOpen={isPermissionsOpen}
          onClose={() => setIsPermissionsOpen(false)}
          isOwner={isOwner}
          currentUserId={user.id}
          members={
            room.members?.map((m) => ({
              id: m.id || m.userId,
              userId: m.userId,
              username: m.username,
              role: m.role,
              canEdit: Boolean(m.canEdit),
              allowedFiles: m.allowedFiles || [],
              joinedAt: m.joinedAt || "",
            })) || []
          }
          pendingRequests={pendingRequests}
          onGrantPermission={handleGrantPermission}
          onRevokePermission={handleRevokePermission}
          onDeclineRequest={handleDeclinePermission}
        />
      )}

      {/* Keyboard Shortcuts Modal */}
      <KeyboardShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />

      {/* Floating Permission Notification / Prompt Toast */}
      {permissionToast && (
        <div className="fixed top-16 right-4 z-50 max-w-sm sm:max-w-md w-[calc(100%-2rem)] sm:w-auto bg-surface/95 backdrop-blur-md border border-border rounded-2xl shadow-2xl p-3.5 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              {permissionToast.type === "request" && (
                <div className="h-8 w-8 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
                  <ShieldAlert className="h-4 w-4 animate-pulse" />
                </div>
              )}
              {permissionToast.type === "success" && (
                <div className="h-8 w-8 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
              )}
              {permissionToast.type === "warning" && (
                <div className="h-8 w-8 rounded-xl bg-red-500/20 text-red-400 border border-red-500/30 flex items-center justify-center shrink-0">
                  <AlertCircle className="h-4 w-4" />
                </div>
              )}
              {permissionToast.type === "info" && (
                <div className="h-8 w-8 rounded-xl bg-accent/20 text-accent border border-accent/30 flex items-center justify-center shrink-0">
                  <Shield className="h-4 w-4" />
                </div>
              )}

              <div className="min-w-0">
                <div className="text-xs font-semibold text-foreground">
                  {permissionToast.type === "request"
                    ? "Edit Request"
                    : permissionToast.type === "success"
                    ? "Access Granted"
                    : permissionToast.type === "warning"
                    ? "Access Notice"
                    : "Access Notice"}
                </div>
                <div className="text-xs text-muted mt-0.5 break-words">
                  {permissionToast.message}
                </div>
              </div>
            </div>

            <button
              onClick={() => setPermissionToast(null)}
              className="text-muted hover:text-foreground p-1 rounded-lg hover:bg-surface-hover shrink-0"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {permissionToast.type === "request" && permissionToast.request && isOwner && (
            <div className="mt-3 pt-2.5 border-t border-border flex items-center justify-end gap-2">
              <button
                onClick={() => {
                  handleDeclinePermission(
                    permissionToast.request?.id,
                    permissionToast.request?.userId,
                    permissionToast.request?.fileId
                  );
                  setPermissionToast(null);
                }}
                className="px-2.5 py-1 rounded-lg border border-border text-muted hover:text-foreground hover:bg-panel text-xs transition-colors"
              >
                Decline
              </button>
              {permissionToast.request.fileId && (
                <button
                  onClick={() => {
                    handleGrantPermission(
                      permissionToast.request!.userId,
                      permissionToast.request!.fileId,
                      "file"
                    );
                    setPermissionToast(null);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-accent/20 hover:bg-accent/30 border border-accent/40 text-accent text-xs font-semibold transition-colors"
                >
                  Allow This File
                </button>
              )}
              <button
                onClick={() => {
                  handleGrantPermission(permissionToast.request!.userId, null, "room");
                  setPermissionToast(null);
                }}
                className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors"
              >
                Allow All Files
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
