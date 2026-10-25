import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  FileCode,
  FolderTree,
  Keyboard,
  KeyRound,
  Loader2,
  Lock,
  MessageSquare,
  Minimize2,
  RefreshCw,
  Settings,
  Shield,
  ShieldAlert,
  Terminal,
  WifiOff,
  X,
} from "lucide-react";

import RoomHeader, {
  type ConnectionStatus,
} from "@/components/room/RoomHeader";
import FileExplorer, { type FileItem } from "@/components/room/FileExplorer";
import CodeEditor, {
  type ExecutionResult,
  type ExecutionState,
  type SaveStatus,
} from "@/components/room/CodeEditor";
import RoomChat, { type ChatMessage } from "@/components/room/RoomChat";
import StatusBar from "@/components/room/StatusBar";
import ShareModal from "@/components/room/ShareModal";
import RoomSettingsModal from "@/components/room/RoomSettingsModal";
import RoomPermissionsModal, {
  type PermissionRequestItem,
} from "@/components/room/RoomPermissionsModal";
import KeyboardShortcutsModal from "@/components/room/KeyboardShortcutsModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  apiFetch,
  errorMessage,
  getRoomSocketUrl,
  getStoredToken,
  storeToken,
} from "@/lib/auth";
import { getLanguageFromFilename } from "@/lib/utils";

interface RoomMember {
  id?: string;
  userId: string;
  username: string;
  role: string;
  canEdit?: boolean;
  allowedFiles?: string[];
  joinedAt?: string;
}

interface RoomData {
  id: string;
  roomCode: string;
  name: string;
  description: string | null;
  isPublic: boolean;
  hasPassword?: boolean;
  ownerId: string;
  owner: { id: string; username: string };
  members: RoomMember[];
  pendingRequests?: PermissionRequestItem[];
  /** Canonical invite URL supplied by the server; null when disabled. */
  shareUrl?: string | null;
}

interface MyPendingRequest {
  id?: string;
  fileId: string | null;
  fileName: string | null;
  status: string;
}

interface RoomFetchResponse {
  room?: RoomData;
  requiresPassword?: boolean;
  isOwner?: boolean;
  canEdit?: boolean;
  allowedFiles?: string[];
  myPendingRequests?: MyPendingRequest[];
  error?: string;
}

interface ChatQueueItem {
  clientId: string;
  content: string;
}

type MobileTab = "files" | "editor" | "output" | "chat";

interface PermissionEventPayload {
  userId?: string;
  canEdit?: boolean;
  allowedFiles?: string[];
  scope?: string;
  approvedFileId?: string | null;
}

/**
 * Loose shape of room WebSocket frames. The socket carries several event
 * families, so every field is optional and narrowed in the handler below.
 */
interface RoomWsEnvelope {
  type?: string;
  message?: ChatMessage;
  onlineUsers?: Array<{ id: string; username: string }>;
  file?: FileItem;
  fileId?: string;
  room?: Partial<RoomData>;
  request?: PermissionRequestItem;
  permission?: PermissionEventPayload;
  execution?: ExecutionState | null;
  result?: ExecutionResult & { status?: string };
  user?: { id: string; username: string };
  filename?: string;
  requestId?: string;
  targetUserId?: string;
  userId?: string;
}

interface RunNotification {
  username: string;
  filename: string;
  status?: string;
  executionTimeMs?: number;
}

const EMPTY_EXECUTION: ExecutionState = {
  isRunning: false,
  userId: null,
  username: null,
  fileId: null,
  fileName: null,
  startTime: null,
};

const LEFT_MIN = 180;
const LEFT_MAX = 460;
const RIGHT_MIN = 220;
const RIGHT_MAX = 500;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function makeClientId(): string {
  return `pending-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export default function RoomPage() {
  const { roomId: roomIdParam = "" } = useParams<{ roomId: string }>();
  const navigate = useNavigate();

  const roomPath = `/room/${roomIdParam}`;
  const loginRedirect = `/login?redirect=${encodeURIComponent(roomPath)}`;

  // Identity / room ---------------------------------------------------------
  const [user, setUser] = useState<{ id: string; username: string } | null>(
    null,
  );
  const [room, setRoom] = useState<RoomData | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authToken, setAuthToken] = useState("");

  // Permissions -------------------------------------------------------------
  const [canEdit, setCanEdit] = useState(false);
  const [allowedFiles, setAllowedFiles] = useState<string[]>([]);
  const [pendingRequests, setPendingRequests] = useState<
    PermissionRequestItem[]
  >([]);
  const [myPendingRequests, setMyPendingRequests] = useState<
    MyPendingRequest[]
  >([]);
  const [isPermissionsOpen, setIsPermissionsOpen] = useState(false);
  const [permissionToast, setPermissionToast] = useState<{
    id: string;
    message: string;
    type: "info" | "success" | "warning" | "request";
    request?: PermissionRequestItem;
  } | null>(null);

  // Execution ---------------------------------------------------------------
  const [executionState, setExecutionState] =
    useState<ExecutionState>(EMPTY_EXECUTION);
  const [executionResult, setExecutionResult] =
    useState<ExecutionResult | null>(null);

  // Password gate -----------------------------------------------------------
  const [requiresPassword, setRequiresPassword] = useState(false);
  const [roomPasswordInput, setRoomPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [unlocking, setUnlocking] = useState(false);

  // Files -------------------------------------------------------------------
  const [files, setFiles] = useState<FileItem[]>([]);
  const [openFiles, setOpenFiles] = useState<FileItem[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);

  // Chat --------------------------------------------------------------------
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [queuedChatCount, setQueuedChatCount] = useState(0);
  const [unreadChat, setUnreadChat] = useState(0);

  // Realtime ----------------------------------------------------------------
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("reconnecting");
  const [connectionNonce, setConnectionNonce] = useState(0);
  const [wsFailureCount, setWsFailureCount] = useState(0);
  const [onlineUsers, setOnlineUsers] = useState<
    Array<{ id: string; username: string }>
  >([]);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [cursorPos, setCursorPos] = useState({ line: 1, column: 1 });

  // Modals / notifications --------------------------------------------------
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [isNewFileOpen, setIsNewFileOpen] = useState(false);
  const [newFileName, setNewFileName] = useState("");
  const [runNotification, setRunNotification] =
    useState<RunNotification | null>(null);

  // Layout ------------------------------------------------------------------
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [leftWidth, setLeftWidth] = useState(250);
  const [rightWidth, setRightWidth] = useState(310);
  const [isDraggingLeft, setIsDraggingLeft] = useState(false);
  const [isDraggingRight, setIsDraggingRight] = useState(false);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [mobileTab, setMobileTab] = useState<MobileTab>("editor");
  const [isMobile, setIsMobile] = useState(false);

  const activeFile = useMemo(
    () =>
      files.find((file) => file.id === activeFileId && file.type === "file") ??
      null,
    [files, activeFileId],
  );

  const roomMembers = useMemo(
    () =>
      (room?.members ?? []).map((member) => ({
        id: member.id || member.userId,
        userId: member.userId,
        username: member.username,
        role: member.role,
        canEdit: Boolean(member.canEdit),
        allowedFiles: member.allowedFiles ?? [],
        joinedAt: member.joinedAt ?? "",
      })),
    [room?.members],
  );

  // Refs --------------------------------------------------------------------
  const roomWsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const heartbeatTimerRef = useRef<number | null>(null);
  const reconnectAttemptRef = useRef(0);
  const runNotificationTimerRef = useRef<number | null>(null);
  const queuedChatRef = useRef<ChatQueueItem[]>([]);
  const chatVisibleRef = useRef(false);
  const isOwnerRef = useRef(false);
  const myPendingRequestsRef = useRef<MyPendingRequest[]>([]);

  useEffect(() => {
    isOwnerRef.current = isOwner;
  }, [isOwner]);

  useEffect(() => {
    myPendingRequestsRef.current = myPendingRequests;
  }, [myPendingRequests]);

  // Responsive breakpoint ---------------------------------------------------
  useEffect(() => {
    const query = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  // Restore panel widths ----------------------------------------------------
  useEffect(() => {
    try {
      const storedLeft = Number.parseInt(
        localStorage.getItem("coderoom_left_width") ?? "",
        10,
      );
      if (
        Number.isFinite(storedLeft) &&
        storedLeft >= LEFT_MIN &&
        storedLeft <= LEFT_MAX
      ) {
        setLeftWidth(storedLeft);
      }
      const storedRight = Number.parseInt(
        localStorage.getItem("coderoom_right_width") ?? "",
        10,
      );
      if (
        Number.isFinite(storedRight) &&
        storedRight >= RIGHT_MIN &&
        storedRight <= RIGHT_MAX
      ) {
        setRightWidth(storedRight);
      }
    } catch {
      /* storage unavailable */
    }
  }, []);

  // Which chat surface is currently visible? Drives the unread badge.
  useEffect(() => {
    chatVisibleRef.current = isMobile
      ? mobileTab === "chat"
      : rightPanelOpen && !isFocusMode;
    if (chatVisibleRef.current && !document.hidden) {
      setUnreadChat(0);
    }
  }, [isMobile, mobileTab, rightPanelOpen, isFocusMode]);

  useEffect(() => {
    const onVisibility = () => {
      if (!document.hidden && chatVisibleRef.current) setUnreadChat(0);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  // =========================================================================
  // WebSocket helpers
  // =========================================================================

  const sendWsEvent = useCallback(
    (type: string, payload: Record<string, unknown>): boolean => {
      const ws = roomWsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return false;
      try {
        ws.send(JSON.stringify({ type, payload }));
        return true;
      } catch {
        return false;
      }
    },
    [],
  );

  const flushQueuedChat = useCallback(() => {
    const ws = roomWsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    if (queuedChatRef.current.length === 0) return;

    const queued = queuedChatRef.current;
    queuedChatRef.current = [];

    queued.forEach((item) => {
      if (
        !sendWsEvent("chat:send", {
          content: item.content,
          clientId: item.clientId,
        })
      ) {
        queuedChatRef.current.push(item);
      }
    });

    setQueuedChatCount(queuedChatRef.current.length);
  }, [sendWsEvent]);

  // =========================================================================
  // Data loading
  // =========================================================================

  const mergeLoadedMessages = useCallback((loaded: ChatMessage[]) => {
    setMessages((prev) => {
      const loadedIds = new Set(loaded.map((message) => message.id));
      const stillPending = prev.filter(
        (message) => message.pending && !loadedIds.has(message.id),
      );
      return [...loaded, ...stillPending];
    });
  }, []);

  const fetchRoomData = useCallback(async (): Promise<void> => {
    if (!roomIdParam) {
      setError("Invalid room link.");
      setLoading(false);
      return;
    }

    try {
      const res = await apiFetch(`/api/rooms/${roomIdParam}`);

      if (res.status === 401) {
        navigate(loginRedirect);
        return;
      }

      const data = (await res.json().catch(() => ({}))) as RoomFetchResponse;

      if (!res.ok) {
        setError(errorMessage(data, "This room could not be found."));
        setLoading(false);
        return;
      }

      if (!data.room) {
        setError("This room could not be found.");
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
      setPasswordError(null);
      setRoom(data.room);
      setIsOwner(Boolean(data.isOwner));
      setCanEdit(Boolean(data.canEdit));
      setAllowedFiles(data.allowedFiles ?? []);
      setPendingRequests(data.room.pendingRequests ?? []);
      setMyPendingRequests(data.myPendingRequests ?? []);

      const roomId = data.room.id;

      const filesRes = await apiFetch(`/api/rooms/${roomId}/files`);
      if (filesRes.ok) {
        const filesData = (await filesRes.json().catch(() => ({}))) as {
          files?: FileItem[];
        };
        const loadedFiles = filesData.files ?? [];
        setFiles(loadedFiles);
        const firstFile =
          loadedFiles.find((file) => file.type === "file") ?? null;
        setOpenFiles((prev) => {
          const refreshed = prev
            .map((file) =>
              loadedFiles.find((candidate) => candidate.id === file.id),
            )
            .filter((file): file is FileItem => Boolean(file));
          if (refreshed.length > 0) return refreshed;
          return firstFile ? [firstFile] : [];
        });
        setActiveFileId((prev) => {
          if (prev && loadedFiles.some((file) => file.id === prev)) return prev;
          return firstFile?.id ?? null;
        });
      }

      const messagesRes = await apiFetch(`/api/rooms/${roomId}/messages`);
      if (messagesRes.ok) {
        const messagesData = (await messagesRes.json().catch(() => ({}))) as {
          messages?: ChatMessage[];
        };
        mergeLoadedMessages(messagesData.messages ?? []);
      }

      try {
        const runRes = await apiFetch(`/api/rooms/${roomId}/run`);
        if (runRes.ok) {
          const runData = (await runRes.json().catch(() => ({}))) as {
            execution?: ExecutionState;
          };
          if (runData.execution) setExecutionState(runData.execution);
        }
      } catch {
        /* execution state is optional */
      }

      setLoading(false);
    } catch {
      setError("Could not connect to the server. Please check your network.");
      setLoading(false);
    }
  }, [loginRedirect, mergeLoadedMessages, navigate, roomIdParam]);

  // Initial auth + room hydration ------------------------------------------
  useEffect(() => {
    let cancelled = false;

    apiFetch("/api/auth/me")
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) {
          navigate(loginRedirect);
          return;
        }
        const data = (await res.json().catch(() => ({}))) as {
          user?: { id: string; username: string };
          token?: string;
        };
        if (cancelled) return;
        if (!data.user) {
          navigate(loginRedirect);
          return;
        }
        setUser(data.user);
        if (data.token) storeToken(data.token);
        setAuthToken(data.token || getStoredToken());
        await fetchRoomData();
      })
      .catch(() => {
        if (!cancelled) navigate(loginRedirect);
      });

    return () => {
      cancelled = true;
    };
  }, [fetchRoomData, loginRedirect, navigate]);

  // =========================================================================
  // Room WebSocket with exponential backoff, jitter and heartbeat
  // =========================================================================

  useEffect(() => {
    if (!room?.id || requiresPassword || !user) return;

    const roomId = room.id;
    const currentUserId = user.id;
    let disposed = false;

    const clearReconnectTimer = () => {
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };

    const clearHeartbeat = () => {
      if (heartbeatTimerRef.current !== null) {
        window.clearInterval(heartbeatTimerRef.current);
        heartbeatTimerRef.current = null;
      }
    };

    const startHeartbeat = () => {
      clearHeartbeat();
      heartbeatTimerRef.current = window.setInterval(() => {
        const ws = roomWsRef.current;
        if (!ws) return;
        if (ws.readyState === WebSocket.OPEN) {
          try {
            ws.send(JSON.stringify({ type: "ping" }));
          } catch {
            /* socket closing */
          }
        } else if (ws.readyState !== WebSocket.CONNECTING) {
          clearHeartbeat();
          try {
            ws.close();
          } catch {
            /* already closed */
          }
        }
      }, 25_000);
    };

    const applyIncomingChat = (incoming: ChatMessage) => {
      setMessages((prev) => {
        if (prev.some((message) => message.id === incoming.id)) return prev;
        // Reconcile the optimistic copy with the server's persisted message.
        const pendingIndex = prev.findIndex(
          (message) =>
            message.pending &&
            message.userId === incoming.userId &&
            message.content === incoming.content,
        );
        if (pendingIndex >= 0) {
          const next = [...prev];
          next[pendingIndex] = incoming;
          return next;
        }
        return [...prev, incoming];
      });

      if (
        incoming.userId !== currentUserId &&
        (!chatVisibleRef.current || document.hidden)
      ) {
        setUnreadChat((count) => count + 1);
      }
    };

    const handleMessage = (event: MessageEvent) => {
      if (disposed) return;
      try {
        const data = JSON.parse(String(event.data)) as RoomWsEnvelope;

        switch (data.type) {
          case "presence:update": {
            if (Array.isArray(data.onlineUsers))
              setOnlineUsers(data.onlineUsers);
            if (data.execution) setExecutionState(data.execution);
            break;
          }

          case "chat:message": {
            if (data.message) applyIncomingChat(data.message);
            break;
          }

          case "chat:clear": {
            setMessages([]);
            queuedChatRef.current = [];
            setQueuedChatCount(0);
            setUnreadChat(0);
            break;
          }

          case "file:create": {
            if (data.file) {
              const created = data.file;
              setFiles((prev) =>
                prev.some((file) => file.id === created.id)
                  ? prev
                  : [...prev, created],
              );
            }
            break;
          }

          case "file:rename":
          case "file:update": {
            if (data.file) {
              const updated = data.file;
              setFiles((prev) =>
                prev.map((file) =>
                  file.id === updated.id ? { ...file, ...updated } : file,
                ),
              );
              setOpenFiles((prev) =>
                prev.map((file) =>
                  file.id === updated.id ? { ...file, ...updated } : file,
                ),
              );
            }
            break;
          }

          case "file:delete": {
            if (data.fileId) {
              const deletedId = data.fileId;
              setFiles((prev) => prev.filter((file) => file.id !== deletedId));
              setOpenFiles((prev) =>
                prev.filter((file) => file.id !== deletedId),
              );
              setActiveFileId((prev) => (prev === deletedId ? null : prev));
            }
            break;
          }

          case "room:update": {
            if (data.room) {
              const updatedRoom = data.room;
              setRoom((prev) => (prev ? { ...prev, ...updatedRoom } : prev));
            }
            break;
          }

          case "code:run": {
            if (data.user && data.filename) {
              setRunNotification({
                username: data.user.username,
                filename: data.filename,
                status: data.result?.status,
                executionTimeMs: data.result?.executionTimeMs,
              });
              if (runNotificationTimerRef.current !== null) {
                window.clearTimeout(runNotificationTimerRef.current);
              }
              runNotificationTimerRef.current = window.setTimeout(() => {
                setRunNotification(null);
              }, 6000);
            }
            break;
          }

          case "permission:request": {
            const request = data.request;
            if (!request) break;
            setPendingRequests((prev) =>
              prev.some((item) => item.id === request.id)
                ? prev
                : [request, ...prev],
            );

            if (isOwnerRef.current) {
              setPermissionToast({
                id: request.id,
                message: `${request.username} requested permission to edit ${
                  request.fileName || "this file"
                }`,
                type: "request",
                request,
              });
            }

            if (request.userId === currentUserId) {
              setMyPendingRequests((prev) =>
                prev.some((item) => item.fileId === request.fileId)
                  ? prev
                  : [
                      ...prev,
                      {
                        id: request.id,
                        fileId: request.fileId,
                        fileName: request.fileName,
                        status: "PENDING",
                      },
                    ],
              );
            }
            break;
          }

          case "permission:updated": {
            const permission = data.permission;
            if (!permission) break;

            if (permission.userId === currentUserId) {
              setCanEdit(Boolean(permission.canEdit));
              setAllowedFiles(permission.allowedFiles ?? []);
              setMyPendingRequests((prev) =>
                prev.filter((request) =>
                  permission.scope === "room"
                    ? false
                    : request.fileId !== permission.approvedFileId,
                ),
              );
              setPermissionToast({
                id: Date.now().toString(),
                message: "Admin granted you edit permission!",
                type: "success",
              });
            }

            setPendingRequests((prev) =>
              prev.filter((request) =>
                permission.scope === "room"
                  ? request.userId !== permission.userId
                  : !(
                      request.userId === permission.userId &&
                      request.fileId === permission.approvedFileId
                    ),
              ),
            );

            setRoom((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                members: prev.members.map((member) =>
                  member.userId === permission.userId
                    ? {
                        ...member,
                        canEdit: permission.canEdit,
                        allowedFiles: permission.allowedFiles,
                        role: permission.canEdit ? "EDITOR" : member.role,
                      }
                    : member,
                ),
              };
            });
            break;
          }

          case "permission:revoked": {
            const permission = data.permission;
            if (!permission) break;

            if (permission.userId === currentUserId) {
              setCanEdit(Boolean(permission.canEdit));
              setAllowedFiles(permission.allowedFiles ?? []);
              setPermissionToast({
                id: Date.now().toString(),
                message: "Edit permission was revoked by the admin.",
                type: "warning",
              });
            }

            setRoom((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                members: prev.members.map((member) =>
                  member.userId === permission.userId
                    ? {
                        ...member,
                        canEdit: permission.canEdit,
                        allowedFiles: permission.allowedFiles,
                        role: permission.canEdit ? "EDITOR" : "MEMBER",
                      }
                    : member,
                ),
              };
            });
            break;
          }

          case "permission:declined": {
            const { requestId, targetUserId, fileId } = data;
            const wasMine =
              targetUserId === currentUserId ||
              (requestId
                ? myPendingRequestsRef.current.some(
                    (request) => request.id === requestId,
                  )
                : false);

            if (wasMine) {
              setPermissionToast({
                id: Date.now().toString(),
                message: "Admin declined your edit request.",
                type: "warning",
              });
            }

            setMyPendingRequests((prev) =>
              prev.filter((request) =>
                requestId
                  ? request.id !== requestId
                  : request.fileId !== fileId,
              ),
            );

            setPendingRequests((prev) =>
              prev.filter((request) =>
                requestId
                  ? request.id !== requestId
                  : !(
                      request.userId === targetUserId &&
                      (!fileId || request.fileId === fileId)
                    ),
              ),
            );
            break;
          }

          case "permission:cancelled": {
            const { userId, fileId } = data;
            setPendingRequests((prev) =>
              prev.filter(
                (request) =>
                  !(
                    request.userId === userId &&
                    (!fileId || request.fileId === fileId)
                  ),
              ),
            );
            break;
          }

          case "execution:update": {
            if (data.execution) setExecutionState(data.execution);
            break;
          }

          case "execution:start": {
            if (data.execution) {
              setExecutionState(data.execution);
              if (data.execution.userId !== currentUserId) {
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
            setExecutionState(EMPTY_EXECUTION);
            if (data.result) setExecutionResult(data.result);
            break;
          }

          default:
            break;
        }
      } catch (err) {
        console.error("Error processing room WS message:", err);
      }
    };

    const scheduleReconnect = () => {
      if (disposed) return;
      if (reconnectTimerRef.current !== null) return;

      const attempt = reconnectAttemptRef.current;
      const backoff = Math.min(30_000, 1_000 * 2 ** attempt);
      const delay = Math.min(30_000, backoff + Math.random() * 500);
      reconnectAttemptRef.current = attempt + 1;

      setConnectionStatus(
        navigator.onLine === false ? "disconnected" : "reconnecting",
      );
      reconnectTimerRef.current = window.setTimeout(() => {
        reconnectTimerRef.current = null;
        connect();
      }, delay);
    };

    function connect() {
      if (disposed) return;

      if (navigator.onLine === false) {
        setConnectionStatus("disconnected");
        scheduleReconnect();
        return;
      }

      setConnectionStatus("reconnecting");

      let ws: WebSocket;
      try {
        ws = new WebSocket(getRoomSocketUrl(roomId));
      } catch {
        setConnectionStatus("disconnected");
        scheduleReconnect();
        return;
      }

      roomWsRef.current = ws;

      ws.onopen = () => {
        if (disposed || roomWsRef.current !== ws) return;
        reconnectAttemptRef.current = 0;
        setWsFailureCount(0);
        setConnectionStatus("connected");
        startHeartbeat();
        flushQueuedChat();
        sendWsEvent("presence:query", {});
      };

      ws.onmessage = (event) => {
        if (roomWsRef.current !== ws) return;
        handleMessage(event);
      };

      ws.onclose = () => {
        if (disposed || roomWsRef.current !== ws) return;
        clearHeartbeat();
        setWsFailureCount((count) => count + 1);
        setConnectionStatus("disconnected");
        scheduleReconnect();
      };

      ws.onerror = () => {
        if (disposed || roomWsRef.current !== ws) return;
        setConnectionStatus("reconnecting");
      };
    }

    const handleOnline = () => {
      reconnectAttemptRef.current = 0;
      clearReconnectTimer();
      const ws = roomWsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        setConnectionStatus("connected");
        return;
      }
      if (ws && ws.readyState === WebSocket.CONNECTING) return;
      connect();
    };

    const handleOffline = () => {
      clearHeartbeat();
      setConnectionStatus("disconnected");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    connect();

    return () => {
      disposed = true;
      clearReconnectTimer();
      clearHeartbeat();
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);

      const ws = roomWsRef.current;
      roomWsRef.current = null;
      if (ws) {
        ws.onopen = null;
        ws.onmessage = null;
        ws.onerror = null;
        ws.onclose = null;
        try {
          ws.close();
        } catch {
          /* already closed */
        }
      }
    };
  }, [
    connectionNonce,
    flushQueuedChat,
    requiresPassword,
    room?.id,
    sendWsEvent,
    user,
  ]);

  // Auto-dismiss non-actionable permission toasts ---------------------------
  useEffect(() => {
    if (!permissionToast || permissionToast.type === "request") return;
    const timer = window.setTimeout(() => setPermissionToast(null), 4000);
    return () => window.clearTimeout(timer);
  }, [permissionToast]);

  useEffect(() => {
    return () => {
      if (runNotificationTimerRef.current !== null) {
        window.clearTimeout(runNotificationTimerRef.current);
      }
    };
  }, []);

  // =========================================================================
  // Panel resizers
  // =========================================================================

  const startLeftResize = (event: ReactMouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDraggingLeft(true);
    const startX = event.clientX;
    const startWidth = leftWidth;
    let latest = startWidth;

    const onMove = (moveEvent: MouseEvent) => {
      latest = clamp(
        startWidth + (moveEvent.clientX - startX),
        LEFT_MIN,
        LEFT_MAX,
      );
      setLeftWidth(latest);
    };

    const onUp = () => {
      setIsDraggingLeft(false);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      try {
        localStorage.setItem("coderoom_left_width", latest.toString());
      } catch {
        /* ignore */
      }
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const startRightResize = (event: ReactMouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDraggingRight(true);
    const startX = event.clientX;
    const startWidth = rightWidth;
    let latest = startWidth;

    const onMove = (moveEvent: MouseEvent) => {
      latest = clamp(
        startWidth + (startX - moveEvent.clientX),
        RIGHT_MIN,
        RIGHT_MAX,
      );
      setRightWidth(latest);
    };

    const onUp = () => {
      setIsDraggingRight(false);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      try {
        localStorage.setItem("coderoom_right_width", latest.toString());
      } catch {
        /* ignore */
      }
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  // =========================================================================
  // Password gate
  // =========================================================================

  const handleUnlockRoom = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPasswordError(null);
    setUnlocking(true);

    try {
      const res = await apiFetch(`/api/rooms/${roomIdParam}/join`, {
        method: "POST",
        body: JSON.stringify({ password: roomPasswordInput }),
      });

      const data = (await res.json().catch(() => ({}))) as { error?: string };

      if (!res.ok) {
        setPasswordError(errorMessage(data, "Incorrect room password."));
        setUnlocking(false);
        return;
      }

      setRequiresPassword(false);
      setLoading(true);
      await fetchRoomData();
      toast.success("Room unlocked");
    } catch {
      setPasswordError("Failed to unlock room.");
    } finally {
      setUnlocking(false);
    }
  };

  // =========================================================================
  // Chat
  // =========================================================================

  const handleSendMessage = useCallback(
    (content: string) => {
      if (!room || !user) return;
      const trimmed = content.trim();
      if (!trimmed) return;

      const clientId = makeClientId();
      const optimistic: ChatMessage = {
        id: clientId,
        roomId: room.id,
        userId: user.id,
        username: user.username,
        content: trimmed,
        createdAt: new Date().toISOString(),
        pending: true,
      };

      setMessages((prev) => [...prev, optimistic]);
      setUnreadChat(0);

      const sent = sendWsEvent("chat:send", { content: trimmed, clientId });
      if (!sent) {
        queuedChatRef.current = [
          ...queuedChatRef.current,
          { clientId, content: trimmed },
        ];
        setQueuedChatCount(queuedChatRef.current.length);
      }
    },
    [room, sendWsEvent, user],
  );

  const handleClearChat = useCallback(async () => {
    if (!room) return;
    setMessages([]);
    queuedChatRef.current = [];
    setQueuedChatCount(0);
    setUnreadChat(0);

    sendWsEvent("chat:clear", {});

    try {
      const res = await apiFetch(`/api/rooms/${room.id}/messages`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(errorMessage(data, "Could not clear the chat."));
      }
    } catch {
      toast.error("Could not clear the chat.");
    }
  }, [room, sendWsEvent]);

  // =========================================================================
  // File operations
  // =========================================================================

  const handleCreateFile = async (
    name: string,
    parentId: string | null,
    type: "file" | "folder",
    content = "",
  ): Promise<void> => {
    if (!room) return;
    try {
      const res = await apiFetch(`/api/rooms/${room.id}/files`, {
        method: "POST",
        body: JSON.stringify({ name, parentId, type, content }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        file?: FileItem;
      };

      if (!res.ok || !data.file) {
        toast.error(errorMessage(data, `Could not create ${type}.`));
        return;
      }

      const created = data.file;
      setFiles((prev) =>
        prev.some((file) => file.id === created.id) ? prev : [...prev, created],
      );

      if (created.type === "file") {
        setActiveFileId(created.id);
        setOpenFiles((prev) =>
          prev.some((file) => file.id === created.id)
            ? prev
            : [...prev, created],
        );
        setMobileTab("editor");
      }
    } catch {
      toast.error(`Could not create ${type}.`);
    }
  };

  const handleRenameFile = async (
    fileId: string,
    newName: string,
  ): Promise<void> => {
    if (!room) return;
    try {
      const res = await apiFetch(`/api/rooms/${room.id}/files/${fileId}`, {
        method: "PATCH",
        body: JSON.stringify({ name: newName }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        file?: FileItem;
      };

      if (!res.ok || !data.file) {
        toast.error(errorMessage(data, "Could not rename the item."));
        return;
      }

      const updated = data.file;
      setFiles((prev) =>
        prev.map((file) =>
          file.id === fileId ? { ...file, ...updated } : file,
        ),
      );
      setOpenFiles((prev) =>
        prev.map((file) =>
          file.id === fileId ? { ...file, ...updated } : file,
        ),
      );
    } catch {
      toast.error("Could not rename the item.");
    }
  };

  const handleDeleteFile = async (fileId: string): Promise<void> => {
    if (!room) return;

    try {
      const res = await apiFetch(`/api/rooms/${room.id}/files/${fileId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(errorMessage(data, "Could not delete the item."));
        return;
      }

      // The server cascades to descendants; mirror that locally.
      const removedIds = new Set<string>([fileId]);
      let grew = true;
      while (grew) {
        grew = false;
        files.forEach((file) => {
          if (
            file.parentId &&
            removedIds.has(file.parentId) &&
            !removedIds.has(file.id)
          ) {
            removedIds.add(file.id);
            grew = true;
          }
        });
      }

      const remainingOpen = openFiles.filter(
        (file) => !removedIds.has(file.id),
      );
      const remainingFiles = files.filter(
        (file) => file.type === "file" && !removedIds.has(file.id),
      );

      setFiles((prev) => prev.filter((file) => !removedIds.has(file.id)));
      setOpenFiles(remainingOpen);
      setActiveFileId((current) => {
        if (!current || !removedIds.has(current)) return current;
        return remainingOpen[0]?.id ?? remainingFiles[0]?.id ?? null;
      });
    } catch {
      toast.error("Could not delete the item.");
    }
  };

  const handleMoveFile = async (
    fileId: string,
    newParentId: string | null,
  ): Promise<void> => {
    if (!room) return;
    try {
      const res = await apiFetch(`/api/rooms/${room.id}/files/${fileId}`, {
        method: "PATCH",
        body: JSON.stringify({ parentId: newParentId }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        file?: FileItem;
      };

      if (!res.ok || !data.file) {
        toast.error(errorMessage(data, "Failed to move item."));
        return;
      }

      const updated = data.file;
      setFiles((prev) =>
        prev.map((file) =>
          file.id === fileId ? { ...file, ...updated } : file,
        ),
      );
      setOpenFiles((prev) =>
        prev.map((file) =>
          file.id === fileId ? { ...file, ...updated } : file,
        ),
      );
    } catch {
      toast.error("Failed to move item.");
    }
  };

  const handleDuplicateFile = async (
    fileId: string,
    targetParentId?: string | null,
  ): Promise<void> => {
    if (!room) return;
    try {
      const res = await apiFetch(
        `/api/rooms/${room.id}/files/${fileId}/duplicate`,
        {
          method: "POST",
          body: JSON.stringify({ targetParentId }),
        },
      );
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        files?: FileItem[];
      };

      if (!res.ok) {
        toast.error(errorMessage(data, "Failed to duplicate item."));
        return;
      }

      const createdFiles = data.files ?? [];
      setFiles((prev) => {
        const knownIds = new Set(prev.map((file) => file.id));
        return [
          ...prev,
          ...createdFiles.filter((file) => !knownIds.has(file.id)),
        ];
      });
    } catch {
      toast.error("Failed to duplicate item.");
    }
  };

  const handleSelectFile = (file: FileItem) => {
    if (file.type !== "file") return;
    setActiveFileId(file.id);
    setOpenFiles((prev) =>
      prev.some((item) => item.id === file.id) ? prev : [...prev, file],
    );
    setMobileTab("editor");
  };

  const handleCloseTab = (fileId: string) => {
    const remaining = openFiles.filter((file) => file.id !== fileId);
    setOpenFiles(remaining);
    if (activeFileId === fileId) {
      setActiveFileId(
        remaining.length > 0 ? remaining[remaining.length - 1].id : null,
      );
    }
  };

  // =========================================================================
  // Permission actions (REST broadcasts to every client)
  // =========================================================================

  const handleRequestPermission = useCallback(
    async (fileId: string) => {
      if (!room || !user) return;
      const file = files.find((item) => item.id === fileId);
      const fileName = file?.name ?? "file";

      setMyPendingRequests((prev) => [
        ...prev.filter((request) => request.fileId !== fileId),
        { fileId, fileName, status: "PENDING" },
      ]);

      try {
        const res = await apiFetch(`/api/rooms/${room.id}/permissions`, {
          method: "POST",
          body: JSON.stringify({ action: "request", fileId }),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          setMyPendingRequests((prev) =>
            prev.filter((request) => request.fileId !== fileId),
          );
          toast.error(errorMessage(data, "Could not request edit permission."));
        }
      } catch {
        setMyPendingRequests((prev) =>
          prev.filter((request) => request.fileId !== fileId),
        );
        toast.error("Could not request edit permission.");
      }
    },
    [files, room, user],
  );

  const handleCancelPermissionRequest = useCallback(
    async (fileId: string) => {
      if (!room) return;
      setMyPendingRequests((prev) =>
        prev.filter((request) => request.fileId !== fileId),
      );

      try {
        const res = await apiFetch(`/api/rooms/${room.id}/permissions`, {
          method: "POST",
          body: JSON.stringify({ action: "cancel", fileId }),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          toast.error(errorMessage(data, "Could not cancel the request."));
        }
      } catch {
        toast.error("Could not cancel the request.");
      }
    },
    [room],
  );

  const handleGrantPermission = useCallback(
    async (
      targetUserId: string,
      fileId?: string | null,
      scope: "file" | "room" = "file",
    ) => {
      if (!room) return;
      setPendingRequests((prev) =>
        prev.filter((request) =>
          scope === "room"
            ? request.userId !== targetUserId
            : !(request.userId === targetUserId && request.fileId === fileId),
        ),
      );

      try {
        const res = await apiFetch(`/api/rooms/${room.id}/permissions`, {
          method: "POST",
          body: JSON.stringify({
            action: "grant",
            targetUserId,
            fileId,
            scope,
          }),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          toast.error(errorMessage(data, "Could not grant permission."));
        }
      } catch {
        toast.error("Could not grant permission.");
      }
    },
    [room],
  );

  const handleRevokePermission = useCallback(
    async (
      targetUserId: string,
      fileId?: string | null,
      scope: "file" | "room" = "file",
    ) => {
      if (!room) return;
      try {
        const res = await apiFetch(`/api/rooms/${room.id}/permissions`, {
          method: "POST",
          body: JSON.stringify({
            action: "revoke",
            targetUserId,
            fileId,
            scope,
          }),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          toast.error(errorMessage(data, "Could not revoke permission."));
        }
      } catch {
        toast.error("Could not revoke permission.");
      }
    },
    [room],
  );

  const handleDeclinePermission = useCallback(
    async (
      requestId?: string,
      targetUserId?: string,
      fileId?: string | null,
    ) => {
      if (!room) return;
      setPendingRequests((prev) =>
        prev.filter((request) =>
          requestId
            ? request.id !== requestId
            : !(
                request.userId === targetUserId &&
                (!fileId || request.fileId === fileId)
              ),
        ),
      );

      try {
        const res = await apiFetch(`/api/rooms/${room.id}/permissions`, {
          method: "POST",
          body: JSON.stringify({
            action: "decline",
            requestId,
            targetUserId,
            fileId,
          }),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          toast.error(errorMessage(data, "Could not decline the request."));
        }
      } catch {
        toast.error("Could not decline the request.");
      }
    },
    [room],
  );

  // =========================================================================
  // Execution
  // =========================================================================

  const handleRunCode = useCallback(
    async (fileId: string, code?: string) => {
      if (!room) return;
      const targetFile =
        files.find((file) => file.id === fileId) ??
        (activeFile?.id === fileId ? activeFile : null);
      const codeToRun =
        typeof code === "string" ? code : (targetFile?.content ?? "");

      setExecutionState({
        isRunning: true,
        userId: user?.id ?? null,
        username: user?.username ?? "You",
        fileId,
        fileName: targetFile?.name ?? "code",
        startTime: Date.now(),
      });

      if (isMobile) setMobileTab("output");

      try {
        const res = await apiFetch(`/api/rooms/${room.id}/run`, {
          method: "POST",
          body: JSON.stringify({ action: "run", fileId, code: codeToRun }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          result?: ExecutionResult;
        };

        if (!res.ok) {
          setExecutionState(EMPTY_EXECUTION);
          const message = errorMessage(data, "Failed to execute program.");
          setExecutionResult({
            stdout: "",
            stderr: message,
            exitCode: 1,
            executionTimeMs: 0,
            error: message,
            fileName: targetFile?.name,
            runBy: user?.username,
          });
          setPermissionToast({
            id: Date.now().toString(),
            message,
            type: "warning",
          });
          return;
        }

        if (data.result) {
          setExecutionResult(data.result);
          setExecutionState(EMPTY_EXECUTION);
        }
      } catch {
        setExecutionState(EMPTY_EXECUTION);
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
    [activeFile, files, isMobile, room, user],
  );

  const handleStopCode = useCallback(async () => {
    if (!room) return;
    try {
      const res = await apiFetch(`/api/rooms/${room.id}/run`, {
        method: "POST",
        body: JSON.stringify({ action: "stop" }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast.error(errorMessage(data, "Failed to stop execution."));
        return;
      }
      setExecutionState(EMPTY_EXECUTION);
    } catch {
      toast.error("Failed to stop execution.");
    }
  }, [room]);

  // =========================================================================
  // Keyboard shortcuts
  // =========================================================================

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().includes("MAC");
      const mod = isMac ? event.metaKey : event.ctrlKey;
      const target = event.target as HTMLElement | null;
      const targetTag = target?.tagName.toLowerCase();
      const isTyping =
        targetTag === "input" ||
        targetTag === "textarea" ||
        targetTag === "select" ||
        Boolean(target?.isContentEditable);

      if (mod && event.key.toLowerCase() === "s") {
        event.preventDefault();
        toast.success("Autosave is on — your changes are always saved.");
        return;
      }

      if (mod && event.key === "Enter") {
        const insideMonaco = Boolean(target?.closest(".monaco-editor"));
        if (isTyping && !insideMonaco) return;
        event.preventDefault();
        if (!activeFileId) {
          toast.error("Open a file before running code.");
          return;
        }
        if (executionState.isRunning) {
          toast.warning(
            `${executionState.username ?? "Another user"} is already running code in this room.`,
          );
          return;
        }
        void handleRunCode(activeFileId);
        return;
      }

      if (mod && event.key.toLowerCase() === "b") {
        event.preventDefault();
        setLeftPanelOpen((prev) => !prev);
        return;
      }

      if (mod && event.shiftKey && event.key.toLowerCase() === "c") {
        event.preventDefault();
        setRightPanelOpen((prev) => !prev);
        return;
      }

      if (event.key === "?" && !isTyping) {
        event.preventDefault();
        setIsShortcutsOpen(true);
        return;
      }

      if (event.key === "F11") {
        event.preventDefault();
        setIsFocusMode((prev) => !prev);
        return;
      }

      if (event.key === "Escape" && isFocusMode) {
        setIsFocusMode(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    activeFileId,
    executionState.isRunning,
    executionState.username,
    handleRunCode,
    isFocusMode,
  ]);

  // =========================================================================
  // Loading / error / password screens
  // =========================================================================

  if (loading) {
    return (
      <div className="flex h-dvh-screen flex-col items-center justify-center gap-3 bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
        <p className="text-sm text-muted">
          Connecting to collaborative room...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-dvh-screen flex-col items-center justify-center bg-background p-6 text-center">
        <Card className="w-full max-w-sm shadow-2xl">
          <CardHeader className="items-center">
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl border border-destructive/20 bg-destructive/10 text-destructive">
              <AlertCircle className="h-6 w-6" />
            </div>
            <CardTitle>Room Error</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 sm:flex-row">
            <Button asChild className="w-full sm:flex-1">
              <Link to="/dashboard">
                <ArrowLeft className="h-4 w-4" />
                <span>Dashboard</span>
              </Link>
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full sm:flex-1"
              onClick={() => {
                setLoading(true);
                setError(null);
                void fetchRoomData();
              }}
            >
              <RefreshCw className="h-4 w-4" />
              <span>Retry</span>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (requiresPassword) {
    return (
      <div className="flex min-h-dvh-screen flex-col items-center justify-center bg-background p-4 pb-safe">
        <Card className="w-full max-w-md shadow-2xl">
          <CardHeader className="items-center text-center">
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-500/20 bg-amber-500/10 text-amber-400">
              <Lock className="h-6 w-6" />
            </div>
            <CardTitle>Protected Room</CardTitle>
            <CardDescription>
              This collaborative room requires a password to join.
            </CardDescription>
          </CardHeader>

          <CardContent>
            {passwordError && (
              <div
                role="alert"
                className="mb-4 flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive"
              >
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{passwordError}</span>
              </div>
            )}

            <form onSubmit={handleUnlockRoom} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="roomPasswordUnlock">Room Password</Label>
                <div className="group relative">
                  <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-accent" />
                  <Input
                    id="roomPasswordUnlock"
                    type="password"
                    name="roomPassword"
                    autoComplete="current-password"
                    value={roomPasswordInput}
                    onChange={(event) =>
                      setRoomPasswordInput(event.target.value)
                    }
                    placeholder="Enter password"
                    required
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="flex flex-col-reverse items-stretch gap-2 pt-2 sm:flex-row sm:items-center sm:justify-between">
                <Button asChild variant="outline">
                  <Link to="/dashboard">Back to Dashboard</Link>
                </Button>
                <Button
                  type="submit"
                  disabled={unlocking || !roomPasswordInput}
                >
                  {unlocking ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Lock className="h-3.5 w-3.5" />
                  )}
                  <span>Unlock Room</span>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!room || !user) {
    return (
      <div className="flex h-dvh-screen flex-col items-center justify-center bg-background p-6 text-center">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Room unavailable</CardTitle>
            <CardDescription>We could not load this room.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link to="/dashboard">Back to Dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const canEditAnything = isOwner || canEdit;

  return (
    <div className="flex h-dvh-screen select-none flex-col overflow-hidden overscroll-none bg-background pt-safe text-foreground selection:bg-accent/30">
      {/* Room header */}
      {!isFocusMode && (
        <RoomHeader
          roomName={room.name}
          roomCode={room.roomCode}
          connectionStatus={connectionStatus}
          onlineUsers={onlineUsers}
          isOwner={isOwner}
          pendingRequestsCount={pendingRequests.length}
          members={roomMembers}
          onOpenShare={() => setIsShareOpen(true)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenPermissions={() => setIsPermissionsOpen(true)}
          onOpenShortcuts={() => setIsShortcutsOpen(true)}
          onToggleZenMode={() => setIsFocusMode((prev) => !prev)}
          isZenMode={isFocusMode}
        />
      )}

      {/* Focus-mode exit pill */}
      {isFocusMode && (
        <div className="absolute right-3 top-3 z-50 flex items-center gap-2 rounded-xl border border-border bg-surface/90 px-3 py-1.5 shadow-xl backdrop-blur-md">
          <span className="text-xs font-semibold text-foreground">
            Focus Mode
          </span>
          <button
            type="button"
            onClick={() => setIsFocusMode(false)}
            title="Exit Focus Mode (F11)"
            className="ml-1 flex items-center gap-1 text-xs font-semibold text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
          >
            <Minimize2 className="h-3.5 w-3.5" />
            <span>Exit</span>
          </button>
        </div>
      )}

      {/* Connection banner */}
      {connectionStatus !== "connected" && (
        <div
          role="status"
          aria-live="polite"
          className="z-30 flex shrink-0 items-center justify-between gap-2 border-b border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-[11px] text-amber-300"
        >
          <div className="flex min-w-0 items-start gap-2">
            {connectionStatus === "reconnecting" ? (
              <RefreshCw className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin" />
            ) : (
              <WifiOff className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            )}
            <div className="min-w-0">
              <span className="block truncate">
                {connectionStatus === "reconnecting"
                  ? "Connection lost - reconnecting automatically."
                  : "You are offline. Messages will be queued until the connection returns."}
              </span>
              {wsFailureCount >= 3 && (
                <span className="mt-0.5 block text-[10px] leading-snug text-amber-700 dark:text-amber-200/90">
                  The real-time WebSocket may be blocked by your network or
                  proxy. Editing requires{" "}
                  {`${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host};`}{" "}
                  there is no polling fallback. Ask your administrator to allow
                  WebSocket upgrades.
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              reconnectAttemptRef.current = 0;
              setConnectionNonce((nonce) => nonce + 1);
            }}
            className="shrink-0 rounded-md border border-amber-500/40 px-2 py-0.5 font-semibold text-amber-200 transition-colors hover:bg-amber-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50"
          >
            Retry now
          </button>
        </div>
      )}

      {/* Workspace */}
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        {/* Desktop activity rail */}
        {!isFocusMode && (
          <aside className="hidden w-12 shrink-0 select-none flex-col items-center justify-between border-r border-border bg-panel-header py-2 md:flex">
            <div className="flex w-full flex-col items-center gap-1">
              <Button
                variant={leftPanelOpen ? "subtle" : "ghost"}
                size="icon"
                onClick={() => setLeftPanelOpen((prev) => !prev)}
                title={
                  leftPanelOpen
                    ? "Collapse Explorer (Ctrl+B)"
                    : "Expand Explorer (Ctrl+B)"
                }
                aria-label={
                  leftPanelOpen
                    ? "Collapse file explorer"
                    : "Expand file explorer"
                }
                aria-pressed={leftPanelOpen}
                className="relative"
              >
                <FolderTree className="h-4 w-4" />
                {leftPanelOpen && (
                  <span className="absolute -left-0.5 top-1/2 h-4 w-1 -translate-y-1/2 rounded-r bg-accent" />
                )}
              </Button>

              <Button
                variant={rightPanelOpen ? "subtle" : "ghost"}
                size="icon"
                onClick={() => setRightPanelOpen((prev) => !prev)}
                title={
                  rightPanelOpen
                    ? "Collapse Chat (Ctrl+Shift+C)"
                    : "Expand Chat (Ctrl+Shift+C)"
                }
                aria-label={
                  rightPanelOpen ? "Collapse chat panel" : "Expand chat panel"
                }
                aria-pressed={rightPanelOpen}
              >
                <MessageSquare className="h-4 w-4" />
                {unreadChat > 0 && (
                  <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold leading-none text-destructive-foreground">
                    {unreadChat > 99 ? "99+" : unreadChat}
                  </span>
                )}
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsPermissionsOpen(true)}
                title="Room Permissions & Access"
                aria-label="Open room permissions"
                className="relative"
              >
                <Shield className="h-4 w-4" />
                {pendingRequests.length > 0 && (
                  <span className="absolute right-1 top-1 h-2 w-2 animate-ping rounded-full bg-amber-500" />
                )}
              </Button>
            </div>

            <div className="flex w-full flex-col items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsShortcutsOpen(true)}
                title="Keyboard Shortcuts (?)"
                aria-label="Show keyboard shortcuts"
              >
                <Keyboard className="h-4 w-4" />
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsSettingsOpen(true)}
                title="Room Settings"
                aria-label="Open room settings"
              >
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          </aside>
        )}

        {/* Desktop file explorer */}
        {leftPanelOpen && !isFocusMode && (
          <>
            <aside
              aria-label="File explorer"
              style={{ width: leftWidth }}
              className="hidden h-full shrink-0 flex-col overflow-hidden border-r border-border bg-surface md:flex"
            >
              <FileExplorer
                files={files}
                activeFileId={activeFileId}
                canCreateOrEdit={canEditAnything}
                allowedFiles={allowedFiles}
                onSelectFile={handleSelectFile}
                onCreateFile={handleCreateFile}
                onRenameFile={handleRenameFile}
                onDeleteFile={handleDeleteFile}
                onMoveFile={handleMoveFile}
                onDuplicateFile={handleDuplicateFile}
              />
            </aside>

            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize file explorer"
              aria-valuenow={leftWidth}
              aria-valuemin={LEFT_MIN}
              aria-valuemax={LEFT_MAX}
              tabIndex={0}
              title="Drag to resize file explorer"
              onMouseDown={startLeftResize}
              onKeyDown={(event) => {
                if (event.key !== "ArrowLeft" && event.key !== "ArrowRight")
                  return;
                event.preventDefault();
                setLeftWidth((width) =>
                  clamp(
                    width + (event.key === "ArrowRight" ? 24 : -24),
                    LEFT_MIN,
                    LEFT_MAX,
                  ),
                );
              }}
              className={`hidden h-full w-1.5 shrink-0 cursor-col-resize items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 md:flex ${
                isDraggingLeft ? "bg-accent" : "bg-border/40 hover:bg-accent"
              }`}
            >
              <div className="h-6 w-0.5 rounded bg-border group-hover:bg-white" />
            </div>
          </>
        )}

        {/* Editor + terminal (always mounted on mobile so Monaco keeps state) */}
        <section
          aria-label="Code editor"
          className="relative flex h-full min-w-0 flex-1 flex-col overflow-hidden bg-panel"
        >
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
            onNewFilePrompt={
              canEditAnything ? () => setIsNewFileOpen(true) : undefined
            }
            onCursorChange={(line, column) => setCursorPos({ line, column })}
            onSaveStatusChange={setSaveStatus}
            onBroadcastRun={(runData) => {
              sendWsEvent("code:run", runData);
            }}
            mobileTab={mobileTab}
            onSwitchMobileTab={setMobileTab}
          />
        </section>

        {/* Desktop chat panel */}
        {rightPanelOpen && !isFocusMode && (
          <>
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize chat panel"
              aria-valuenow={rightWidth}
              aria-valuemin={RIGHT_MIN}
              aria-valuemax={RIGHT_MAX}
              tabIndex={0}
              title="Drag to resize chat panel"
              onMouseDown={startRightResize}
              onKeyDown={(event) => {
                if (event.key !== "ArrowLeft" && event.key !== "ArrowRight")
                  return;
                event.preventDefault();
                setRightWidth((width) =>
                  clamp(
                    width + (event.key === "ArrowRight" ? -24 : 24),
                    RIGHT_MIN,
                    RIGHT_MAX,
                  ),
                );
              }}
              className={`hidden h-full w-1.5 shrink-0 cursor-col-resize items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 md:flex ${
                isDraggingRight ? "bg-accent" : "bg-border/40 hover:bg-accent"
              }`}
            >
              <div className="h-6 w-0.5 rounded bg-border" />
            </div>

            <aside
              aria-label="Room chat"
              style={{ width: rightWidth }}
              className="hidden h-full shrink-0 flex-col overflow-hidden border-l border-border bg-surface md:flex"
            >
              <RoomChat
                roomId={room.id}
                messages={messages}
                currentUserId={user.id}
                onSendMessage={handleSendMessage}
                onClearChat={handleClearChat}
                activeFileName={activeFile?.name}
                connectionStatus={connectionStatus}
                pendingCount={queuedChatCount}
              />
            </aside>
          </>
        )}
      </div>

      {/* Desktop status bar */}
      {!isFocusMode && (
        <div className="hidden md:block">
          <StatusBar
            connectionStatus={connectionStatus}
            saveStatus={saveStatus}
            cursorPos={cursorPos}
            language={
              activeFile
                ? getLanguageFromFilename(activeFile.name)
                : "plaintext"
            }
            roomCode={room.roomCode}
            executionState={executionState}
            onOpenShortcuts={() => setIsShortcutsOpen(true)}
            onToggleZenMode={() => setIsFocusMode(true)}
            isZenMode={isFocusMode}
          />
        </div>
      )}

      {/* Mobile bottom tab bar */}
      {!isFocusMode && (
        <nav
          aria-label="Workspace sections"
          className="flex shrink-0 items-stretch border-t border-border bg-surface pb-safe md:hidden"
        >
          {(
            [
              {
                id: "files",
                label: `Files (${files.length})`,
                icon: FolderTree,
              },
              { id: "editor", label: "Editor", icon: FileCode },
              { id: "output", label: "Output", icon: Terminal },
              { id: "chat", label: "Chat", icon: MessageSquare },
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            const active = mobileTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setMobileTab(tab.id);
                  if (tab.id === "chat") setUnreadChat(0);
                }}
                aria-pressed={active}
                aria-label={tab.label}
                className={`relative flex min-h-[48px] flex-1 flex-col items-center justify-center gap-1 px-1 py-1.5 text-[10px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/60 ${
                  active
                    ? "text-accent"
                    : "text-muted hover:text-foreground active:bg-surface-hover"
                }`}
              >
                <span className="relative">
                  <Icon className="h-5 w-5" />
                  {tab.id === "chat" && unreadChat > 0 && (
                    <span className="absolute -right-2.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold leading-none text-destructive-foreground">
                      {unreadChat > 99 ? "99+" : unreadChat}
                    </span>
                  )}
                  {tab.id === "output" && executionState.isRunning && (
                    <span className="absolute -right-1 -top-0.5 h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
                  )}
                  {tab.id === "output" &&
                    !executionState.isRunning &&
                    executionResult && (
                      <span
                        className={`absolute -right-1 -top-0.5 h-1.5 w-1.5 rounded-full ${
                          executionResult.exitCode === 0
                            ? "bg-emerald-400"
                            : "bg-red-400"
                        }`}
                      />
                    )}
                </span>
                <span className="truncate">{tab.label}</span>
                {active && (
                  <span className="absolute inset-x-4 top-0 h-0.5 rounded-b bg-accent" />
                )}
              </button>
            );
          })}
        </nav>
      )}

      {/* Mobile drawers */}
      {isMobile && (
        <>
          <Sheet
            open={mobileTab === "files"}
            onOpenChange={(open) => {
              if (!open) {
                setMobileTab((current) =>
                  current === "files" ? "editor" : current,
                );
              }
            }}
          >
            <SheetContent
              side="left"
              className="flex h-[100dvh] w-[88%] max-w-sm flex-col gap-0 border-border bg-surface p-0 pb-safe"
            >
              <SheetHeader className="flex h-11 shrink-0 flex-row items-center space-y-0 border-b border-border pl-3 pr-12">
                <SheetTitle className="text-[11px] font-bold uppercase tracking-wider text-muted">
                  Files
                </SheetTitle>
                <SheetDescription className="sr-only">
                  Browse and manage the files in this room
                </SheetDescription>
              </SheetHeader>
              <div className="min-h-0 flex-1">
                <FileExplorer
                  files={files}
                  activeFileId={activeFileId}
                  canCreateOrEdit={canEditAnything}
                  allowedFiles={allowedFiles}
                  onSelectFile={handleSelectFile}
                  onCreateFile={handleCreateFile}
                  onRenameFile={handleRenameFile}
                  onDeleteFile={handleDeleteFile}
                  onMoveFile={handleMoveFile}
                  onDuplicateFile={handleDuplicateFile}
                />
              </div>
            </SheetContent>
          </Sheet>

          <Sheet
            open={mobileTab === "chat"}
            onOpenChange={(open) => {
              if (!open) {
                setMobileTab((current) =>
                  current === "chat" ? "editor" : current,
                );
              }
            }}
          >
            <SheetContent
              side="right"
              className="flex h-[100dvh] w-[88%] max-w-sm flex-col gap-0 border-border bg-surface p-0 pb-safe"
            >
              <SheetHeader className="flex h-11 shrink-0 flex-row items-center space-y-0 border-b border-border pl-3 pr-12">
                <SheetTitle className="text-[11px] font-bold uppercase tracking-wider text-muted">
                  Team Chat
                </SheetTitle>
                <SheetDescription className="sr-only">
                  Chat with everyone in this room
                </SheetDescription>
              </SheetHeader>
              <div className="min-h-0 flex-1">
                <RoomChat
                  roomId={room.id}
                  messages={messages}
                  currentUserId={user.id}
                  onSendMessage={handleSendMessage}
                  onClearChat={handleClearChat}
                  activeFileName={activeFile?.name}
                  connectionStatus={connectionStatus}
                  pendingCount={queuedChatCount}
                />
              </div>
            </SheetContent>
          </Sheet>
        </>
      )}

      {/* Modals */}
      <ShareModal
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        roomCode={room.roomCode}
        roomName={room.name}
        shareUrl={room.shareUrl ?? null}
      />

      <RoomSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        room={room}
        isOwner={isOwner}
        onUpdated={() => {
          void fetchRoomData();
        }}
      />

      <RoomPermissionsModal
        isOpen={isPermissionsOpen}
        onClose={() => setIsPermissionsOpen(false)}
        isOwner={isOwner}
        currentUserId={user.id}
        members={roomMembers}
        pendingRequests={pendingRequests}
        onGrantPermission={handleGrantPermission}
        onRevokePermission={handleRevokePermission}
        onDeclineRequest={handleDeclinePermission}
      />

      <KeyboardShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />

      <Dialog
        open={isNewFileOpen}
        onOpenChange={(open) => {
          setIsNewFileOpen(open);
          if (!open) setNewFileName("");
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Create a new file</DialogTitle>
            <DialogDescription>
              The file is added to the room root and shared with everyone.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={async (event) => {
              event.preventDefault();
              const name = newFileName.trim();
              if (!name) return;
              await handleCreateFile(name, null, "file");
              setIsNewFileOpen(false);
              setNewFileName("");
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="newFileName">File name</Label>
              <Input
                id="newFileName"
                autoFocus
                value={newFileName}
                onChange={(event) => setNewFileName(event.target.value)}
                placeholder="e.g. script.py"
                autoComplete="off"
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsNewFileOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={!newFileName.trim()}>
                Create file
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Run notification */}
      {runNotification && (
        <div className="fixed bottom-20 right-3 z-50 flex items-center gap-3 rounded-xl border border-border bg-surface/95 px-3 py-2.5 shadow-2xl backdrop-blur animate-in fade-in slide-in-from-bottom-3 duration-200 sm:bottom-10 sm:right-6 sm:px-4 sm:py-3">
          <div
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
              runNotification.status === "success"
                ? "border-emerald-500/30 bg-emerald-500/20 text-emerald-400"
                : "border-rose-500/30 bg-rose-500/20 text-rose-400"
            }`}
          >
            <FileCode className="h-4 w-4" />
          </div>
          <div className="min-w-0 text-xs">
            <div className="truncate font-semibold text-foreground">
              {runNotification.username} executed{" "}
              <span className="font-mono text-accent">
                {runNotification.filename}
              </span>
            </div>
            <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted">
              <span
                className={`font-semibold ${
                  runNotification.status === "success"
                    ? "text-emerald-400"
                    : "text-rose-400"
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
            type="button"
            onClick={() => setRunNotification(null)}
            aria-label="Dismiss execution notification"
            className="ml-1 rounded-lg p-1 text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Permission toast */}
      {permissionToast && (
        <div className="fixed right-3 top-16 z-50 w-[calc(100%-1.5rem)] max-w-sm rounded-2xl border border-border bg-surface/95 p-3.5 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-200 sm:right-4 sm:w-auto sm:max-w-md">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-2.5">
              {permissionToast.type === "request" && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/20 text-amber-400">
                  <ShieldAlert className="h-4 w-4 animate-pulse" />
                </div>
              )}
              {permissionToast.type === "success" && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/20 text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
              )}
              {permissionToast.type === "warning" && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-red-500/30 bg-red-500/20 text-red-400">
                  <AlertCircle className="h-4 w-4" />
                </div>
              )}
              {permissionToast.type === "info" && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-accent/30 bg-accent/20 text-accent">
                  <Shield className="h-4 w-4" />
                </div>
              )}

              <div className="min-w-0">
                <div className="text-xs font-semibold text-foreground">
                  {permissionToast.type === "request"
                    ? "Edit Request"
                    : permissionToast.type === "success"
                      ? "Access Granted"
                      : "Access Notice"}
                </div>
                <div className="mt-0.5 break-words text-xs text-muted">
                  {permissionToast.message}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setPermissionToast(null)}
              aria-label="Dismiss notification"
              className="shrink-0 rounded-lg p-1 text-muted hover:bg-surface-hover hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {permissionToast.type === "request" &&
            permissionToast.request &&
            isOwner && (
              <div className="mt-3 flex flex-wrap items-center justify-end gap-2 border-t border-border pt-2.5">
                <button
                  type="button"
                  onClick={() => {
                    void handleDeclinePermission(
                      permissionToast.request?.id,
                      permissionToast.request?.userId,
                      permissionToast.request?.fileId,
                    );
                    setPermissionToast(null);
                  }}
                  className="rounded-lg border border-border px-2.5 py-1 text-xs text-muted transition-colors hover:bg-panel hover:text-foreground"
                >
                  Decline
                </button>
                {permissionToast.request.fileId && (
                  <button
                    type="button"
                    onClick={() => {
                      void handleGrantPermission(
                        permissionToast.request!.userId,
                        permissionToast.request!.fileId,
                        "file",
                      );
                      setPermissionToast(null);
                    }}
                    className="rounded-lg border border-accent/40 bg-accent/20 px-2.5 py-1 text-xs font-semibold text-accent transition-colors hover:bg-accent/30"
                  >
                    Allow This File
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    void handleGrantPermission(
                      permissionToast.request!.userId,
                      null,
                      "room",
                    );
                    setPermissionToast(null);
                  }}
                  className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-emerald-500"
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
