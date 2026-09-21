"use client";

import { useState } from "react";
import {
  X,
  Shield,
  ShieldCheck,
  Clock,
  Check,
  Ban,
  UserCheck,
  UserX,
  FileCode,
  Users,
  Loader2,
} from "lucide-react";
import { getUserColor, getInitials } from "@/lib/utils";

export interface PermissionRequestItem {
  id: string;
  userId: string;
  username: string;
  fileId: string | null;
  fileName: string | null;
  createdAt: string;
}

export interface RoomMemberItem {
  id: string;
  userId: string;
  username: string;
  role: string;
  canEdit: boolean;
  allowedFiles: string[];
  joinedAt: string;
}

interface RoomPermissionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  isOwner: boolean;
  currentUserId: string;
  members: RoomMemberItem[];
  pendingRequests: PermissionRequestItem[];
  onGrantPermission: (userId: string, fileId?: string | null, scope?: "file" | "room") => Promise<void>;
  onRevokePermission: (userId: string, fileId?: string | null, scope?: "file" | "room") => Promise<void>;
  onDeclineRequest: (requestId?: string, userId?: string, fileId?: string | null) => Promise<void>;
}

export default function RoomPermissionsModal({
  isOpen,
  onClose,
  isOwner,
  currentUserId,
  members,
  pendingRequests,
  onGrantPermission,
  onRevokePermission,
  onDeclineRequest,
}: RoomPermissionsModalProps) {
  const [activeTab, setActiveTab] = useState<"requests" | "members">("requests");
  const [processingId, setProcessingId] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGrant = async (userId: string, fileId?: string | null, scope?: "file" | "room") => {
    setProcessingId(userId);
    try {
      await onGrantPermission(userId, fileId, scope);
    } finally {
      setProcessingId(null);
    }
  };

  const handleRevoke = async (userId: string, fileId?: string | null, scope?: "file" | "room") => {
    setProcessingId(userId);
    try {
      await onRevokePermission(userId, fileId, scope);
    } finally {
      setProcessingId(null);
    }
  };

  const handleDecline = async (requestId?: string, userId?: string, fileId?: string | null) => {
    setProcessingId(requestId || userId || "decline");
    try {
      await onDeclineRequest(requestId, userId, fileId);
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border bg-panel-header">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-accent/15 border border-accent/30 text-accent flex items-center justify-center">
              <Shield className="h-4 w-4" />
            </div>
            <div>
              <h2 className="font-semibold text-base text-foreground flex items-center gap-2">
                <span>File Edit Permissions</span>
                {pendingRequests.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-400 text-[10px] font-bold">
                    {pendingRequests.length} pending
                  </span>
                )}
              </h2>
              <p className="text-xs text-muted">
                {isOwner
                  ? "Manage who can edit files in this room"
                  : "View room collaboration access"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-muted hover:text-foreground p-1 rounded-lg hover:bg-surface-hover transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-border bg-surface px-4 pt-2 gap-2">
          <button
            onClick={() => setActiveTab("requests")}
            className={`pb-2 px-3 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition-colors ${
              activeTab === "requests"
                ? "border-accent text-accent"
                : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            <Clock className="h-3.5 w-3.5" />
            <span>Pending Requests</span>
            {pendingRequests.length > 0 && (
              <span className="h-4 w-4 rounded-full bg-accent text-white text-[10px] flex items-center justify-center font-bold ml-1">
                {pendingRequests.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("members")}
            className={`pb-2 px-3 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition-colors ${
              activeTab === "members"
                ? "border-accent text-accent"
                : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            <span>Room Members ({members.length})</span>
          </button>
        </div>

        {/* Content body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {activeTab === "requests" && (
            <div className="space-y-3">
              {pendingRequests.length === 0 ? (
                <div className="text-center py-8 text-muted select-none">
                  <ShieldCheck className="h-10 w-10 mx-auto text-muted/40 mb-2" />
                  <p className="text-xs font-medium text-foreground">No pending edit requests</p>
                  <p className="text-[11px] text-muted mt-1 max-w-xs mx-auto">
                    When viewers ask to edit a file, their request will appear here in real time.
                  </p>
                </div>
              ) : (
                pendingRequests.map((req) => {
                  const isProcessing = processingId === req.id || processingId === req.userId;
                  const color = getUserColor(req.username);

                  return (
                    <div
                      key={req.id}
                      className="p-3.5 rounded-xl bg-panel border border-border flex flex-col gap-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <div
                            style={{ borderColor: color }}
                            className="h-8 w-8 rounded-full bg-surface border text-xs font-bold text-white flex items-center justify-center shrink-0 shadow-sm"
                          >
                            {getInitials(req.username)}
                          </div>
                          <div>
                            <div className="text-xs font-semibold text-foreground">
                              {req.username}
                            </div>
                            <div className="text-[11px] text-muted flex items-center gap-1 mt-0.5">
                              <FileCode className="h-3 w-3 text-accent" />
                              <span>Asking to edit:</span>
                              <strong className="text-foreground font-mono">
                                {req.fileName || "All Files"}
                              </strong>
                            </div>
                          </div>
                        </div>

                        <span className="text-[10px] text-muted font-mono shrink-0">
                          {new Date(req.createdAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>

                      {isOwner && (
                        <div className="flex items-center justify-end gap-2 pt-1 border-t border-border/50">
                          <button
                            onClick={() => handleDecline(req.id, req.userId, req.fileId)}
                            disabled={isProcessing}
                            className="px-3 py-1.5 rounded-lg border border-border text-muted hover:text-red-400 hover:bg-red-500/10 text-xs font-medium transition-colors disabled:opacity-50"
                          >
                            Decline
                          </button>

                          {req.fileId && (
                            <button
                              onClick={() => handleGrant(req.userId, req.fileId, "file")}
                              disabled={isProcessing}
                              className="px-3 py-1.5 rounded-lg bg-accent/20 hover:bg-accent/30 border border-accent/40 text-accent text-xs font-semibold transition-colors disabled:opacity-50"
                            >
                              Allow This File
                            </button>
                          )}

                          <button
                            onClick={() => handleGrant(req.userId, null, "room")}
                            disabled={isProcessing}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50 shadow-sm"
                          >
                            {isProcessing ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Check className="h-3 w-3" />
                            )}
                            <span>Allow All Files</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {activeTab === "members" && (
            <div className="space-y-2">
              <div className="text-[11px] text-muted mb-2 px-1">
                Members join as <strong>Viewers</strong>. Only users with edit permission can modify code.
              </div>

              {members.map((member) => {
                const color = getUserColor(member.username);
                const isMemberOwner = member.role === "OWNER";
                const isMe = member.userId === currentUserId;
                const canEditAll = isMemberOwner || member.canEdit;
                const allowedCount = member.allowedFiles?.length || 0;
                const isProcessing = processingId === member.userId;

                return (
                  <div
                    key={member.userId}
                    className="p-3 rounded-xl bg-panel border border-border flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        style={{ borderColor: color }}
                        className="h-8 w-8 rounded-full bg-surface border text-xs font-bold text-white flex items-center justify-center shrink-0 shadow-sm"
                      >
                        {getInitials(member.username)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-foreground truncate">
                            {member.username}
                          </span>
                          {isMe && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-surface border border-border text-muted">
                              you
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 mt-0.5 text-[11px]">
                          {isMemberOwner ? (
                            <span className="text-amber-400 font-medium flex items-center gap-1">
                              👑 Room Admin (Full Access)
                            </span>
                          ) : canEditAll ? (
                            <span className="text-emerald-400 font-medium flex items-center gap-1">
                              <UserCheck className="h-3 w-3" /> Can Edit All Files
                            </span>
                          ) : allowedCount > 0 ? (
                            <span className="text-accent font-medium flex items-center gap-1">
                              <FileCode className="h-3 w-3" /> Can Edit {allowedCount} File(s)
                            </span>
                          ) : (
                            <span className="text-muted flex items-center gap-1">
                              <UserX className="h-3 w-3" /> Viewer (Read-Only)
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Owner controls */}
                    {isOwner && !isMemberOwner && (
                      <div className="shrink-0 flex items-center gap-2">
                        {canEditAll || allowedCount > 0 ? (
                          <button
                            onClick={() => handleRevoke(member.userId, null, "room")}
                            disabled={isProcessing}
                            title="Revoke edit access"
                            className="px-2.5 py-1 rounded-lg border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-medium transition-colors disabled:opacity-50 flex items-center gap-1"
                          >
                            {isProcessing ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Ban className="h-3 w-3" />
                            )}
                            <span>Revoke</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => handleGrant(member.userId, null, "room")}
                            disabled={isProcessing}
                            title="Grant edit access to all files"
                            className="px-2.5 py-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-semibold transition-colors disabled:opacity-50 flex items-center gap-1"
                          >
                            {isProcessing ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <ShieldCheck className="h-3 w-3" />
                            )}
                            <span>Allow Edit</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
