import { useState } from "react";
import {
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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
  onGrantPermission: (
    userId: string,
    fileId?: string | null,
    scope?: "file" | "room"
  ) => Promise<void>;
  onRevokePermission: (
    userId: string,
    fileId?: string | null,
    scope?: "file" | "room"
  ) => Promise<void>;
  onDeclineRequest: (
    requestId?: string,
    userId?: string,
    fileId?: string | null
  ) => Promise<void>;
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
  const [activeTab, setActiveTab] = useState<"requests" | "members">(
    "requests"
  );
  const [processingId, setProcessingId] = useState<string | null>(null);

  const handleGrant = async (
    userId: string,
    fileId?: string | null,
    scope?: "file" | "room"
  ) => {
    setProcessingId(userId);
    try {
      await onGrantPermission(userId, fileId, scope);
    } finally {
      setProcessingId(null);
    }
  };

  const handleRevoke = async (
    userId: string,
    fileId?: string | null,
    scope?: "file" | "room"
  ) => {
    setProcessingId(userId);
    try {
      await onRevokePermission(userId, fileId, scope);
    } finally {
      setProcessingId(null);
    }
  };

  const handleDecline = async (
    requestId?: string,
    userId?: string,
    fileId?: string | null
  ) => {
    setProcessingId(requestId || userId || "decline");
    try {
      await onDeclineRequest(requestId, userId, fileId);
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg gap-0 p-0">
        <DialogHeader className="flex-row items-center gap-3 space-y-0 border-b border-border p-5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-accent/30 bg-accent/15 text-accent">
            <Shield className="h-4 w-4" />
          </div>
          <div className="space-y-1">
            <DialogTitle className="flex items-center gap-2">
              <span>File Edit Permissions</span>
              {pendingRequests.length > 0 && (
                <Badge variant="warning">{pendingRequests.length} pending</Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              {isOwner
                ? "Manage who can edit files in this room"
                : "View room collaboration access"}
            </DialogDescription>
          </div>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as "requests" | "members")}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="px-5 pt-4">
            <TabsList className="w-full">
              <TabsTrigger value="requests" className="flex-1">
                <Clock className="h-3.5 w-3.5" />
                <span>Pending Requests</span>
                {pendingRequests.length > 0 && (
                  <span className="ml-1 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-primary-foreground">
                    {pendingRequests.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="members" className="flex-1">
                <Users className="h-3.5 w-3.5" />
                <span>Members ({members.length})</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            <TabsContent value="requests" className="mt-0 space-y-3">
              {pendingRequests.length === 0 ? (
                <div className="select-none py-10 text-center">
                  <ShieldCheck className="mx-auto mb-2 h-10 w-10 text-muted-foreground/40" />
                  <p className="text-xs font-medium text-foreground">
                    No pending edit requests
                  </p>
                  <p className="mx-auto mt-1 max-w-xs text-[11px] text-muted-foreground">
                    When viewers ask to edit a file, their request will appear
                    here in real time.
                  </p>
                </div>
              ) : (
                pendingRequests.map((req) => {
                  const isProcessing =
                    processingId === req.id || processingId === req.userId;
                  const color = getUserColor(req.username);

                  return (
                    <div
                      key={req.id}
                      className="flex flex-col gap-3 rounded-xl border border-border bg-secondary/40 p-3.5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <Avatar
                            className="h-8 w-8"
                            style={{ borderColor: color }}
                          >
                            <AvatarFallback>
                              {getInitials(req.username)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="text-xs font-semibold text-foreground">
                              {req.username}
                            </div>
                            <div className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                              <FileCode className="h-3 w-3 text-accent" />
                              <span>Asking to edit:</span>
                              <strong className="font-mono text-foreground">
                                {req.fileName || "All Files"}
                              </strong>
                            </div>
                          </div>
                        </div>

                        <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                          {new Date(req.createdAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>

                      {isOwner && (
                        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border/50 pt-2.5">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              handleDecline(req.id, req.userId, req.fileId)
                            }
                            disabled={isProcessing}
                            className="hover:bg-destructive/10 hover:text-destructive"
                          >
                            Decline
                          </Button>

                          {req.fileId && (
                            <Button
                              size="sm"
                              variant="subtle"
                              onClick={() =>
                                handleGrant(req.userId, req.fileId, "file")
                              }
                              disabled={isProcessing}
                            >
                              Allow This File
                            </Button>
                          )}

                          <Button
                            size="sm"
                            onClick={() =>
                              handleGrant(req.userId, null, "room")
                            }
                            disabled={isProcessing}
                            className="bg-emerald-600 shadow-emerald-500/20 hover:bg-emerald-500"
                          >
                            {isProcessing ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Check className="h-3 w-3" />
                            )}
                            <span>Allow All Files</span>
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </TabsContent>

            <TabsContent value="members" className="mt-0 space-y-2">
              <p className="mb-2 px-1 text-[11px] text-muted-foreground">
                Members join as <strong>Viewers</strong>. Only users with edit
                permission can modify code.
              </p>

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
                    className="flex items-center justify-between gap-3 rounded-xl border border-border bg-secondary/40 p-3"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <Avatar
                        className="h-8 w-8"
                        style={{ borderColor: color }}
                      >
                        <AvatarFallback>
                          {getInitials(member.username)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-xs font-semibold text-foreground">
                            {member.username}
                          </span>
                          {isMe && (
                            <Badge variant="outline" className="px-1.5 py-0">
                              you
                            </Badge>
                          )}
                        </div>

                        <div className="mt-0.5 flex items-center gap-1.5 text-[11px]">
                          {isMemberOwner ? (
                            <span className="flex items-center gap-1 font-medium text-amber-400">
                              👑 Room Admin (Full Access)
                            </span>
                          ) : canEditAll ? (
                            <span className="flex items-center gap-1 font-medium text-emerald-400">
                              <UserCheck className="h-3 w-3" /> Can Edit All Files
                            </span>
                          ) : allowedCount > 0 ? (
                            <span className="flex items-center gap-1 font-medium text-accent">
                              <FileCode className="h-3 w-3" /> Can Edit{" "}
                              {allowedCount} File(s)
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-muted-foreground">
                              <UserX className="h-3 w-3" /> Viewer (Read-Only)
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {isOwner && !isMemberOwner && (
                      <div className="flex shrink-0 items-center gap-2">
                        {canEditAll || allowedCount > 0 ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              handleRevoke(member.userId, null, "room")
                            }
                            disabled={isProcessing}
                            title="Revoke edit access"
                            className="border border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20"
                          >
                            {isProcessing ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Ban className="h-3 w-3" />
                            )}
                            <span>Revoke</span>
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() =>
                              handleGrant(member.userId, null, "room")
                            }
                            disabled={isProcessing}
                            title="Grant edit access to all files"
                            className="border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 shadow-none hover:bg-emerald-500/20"
                          >
                            {isProcessing ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <ShieldCheck className="h-3 w-3" />
                            )}
                            <span>Allow Edit</span>
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
