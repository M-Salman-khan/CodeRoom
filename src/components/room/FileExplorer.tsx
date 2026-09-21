"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  Folder,
  FolderOpen,
  FolderPlus,
  FilePlus,
  FileText,
  Trash2,
  Edit2,
  ChevronRight,
  ChevronDown,
  X,
  Check,
  Search,
  ChevronsDownUp,
  FileCode2,
  Copy,
  Scissors,
  Clipboard,
  CopyPlus,
  ArrowDownToLine,
} from "lucide-react";
import DeleteConfirmModal from "./DeleteConfirmModal";

export interface FileItem {
  id: string;
  roomId: string;
  parentId: string | null;
  name: string;
  type: "file" | "folder";
  language: string | null;
  content: string;
  createdAt: string;
  updatedAt: string;
}

interface FileExplorerProps {
  files: FileItem[];
  activeFileId: string | null;
  canCreateOrEdit?: boolean;
  allowedFiles?: string[];
  onSelectFile: (file: FileItem) => void;
  onCreateFile: (
    name: string,
    parentId: string | null,
    type: "file" | "folder",
    content?: string
  ) => Promise<void>;
  onRenameFile: (fileId: string, newName: string) => Promise<void>;
  onDeleteFile: (fileId: string) => Promise<void>;
  onMoveFile: (fileId: string, newParentId: string | null) => Promise<void>;
  onDuplicateFile: (fileId: string, targetParentId?: string | null) => Promise<void>;
}

interface ClipboardState {
  action: "copy" | "cut";
  item: FileItem;
}

interface ContextMenuState {
  x: number;
  y: number;
  item: FileItem | null;
}

export function getFileBadge(filename: string) {
  const ext = filename.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "ts":
      return (
        <span className="w-4 h-4 rounded bg-blue-500/20 text-blue-400 font-bold text-[9px] flex items-center justify-center border border-blue-500/30">
          TS
        </span>
      );
    case "tsx":
      return (
        <span className="w-4 h-4 rounded bg-sky-500/20 text-sky-400 font-bold text-[9px] flex items-center justify-center border border-sky-500/30">
          TX
        </span>
      );
    case "js":
      return (
        <span className="w-4 h-4 rounded bg-yellow-500/20 text-yellow-300 font-bold text-[9px] flex items-center justify-center border border-yellow-500/30">
          JS
        </span>
      );
    case "jsx":
      return (
        <span className="w-4 h-4 rounded bg-amber-500/20 text-amber-300 font-bold text-[9px] flex items-center justify-center border border-amber-500/30">
          JX
        </span>
      );
    case "py":
      return (
        <span className="w-4 h-4 rounded bg-emerald-500/20 text-emerald-400 font-bold text-[9px] flex items-center justify-center border border-emerald-500/30">
          PY
        </span>
      );
    case "java":
      return (
        <span className="w-4 h-4 rounded bg-amber-600/20 text-amber-400 font-bold text-[9px] flex items-center justify-center border border-amber-600/30">
          JV
        </span>
      );
    case "rs":
      return (
        <span className="w-4 h-4 rounded bg-orange-500/20 text-orange-400 font-bold text-[9px] flex items-center justify-center border border-orange-500/30">
          RS
        </span>
      );
    case "go":
      return (
        <span className="w-4 h-4 rounded bg-cyan-500/20 text-cyan-400 font-bold text-[9px] flex items-center justify-center border border-cyan-500/30">
          GO
        </span>
      );
    case "json":
      return (
        <span className="w-4 h-4 rounded bg-amber-500/20 text-amber-400 font-bold text-[9px] flex items-center justify-center border border-amber-500/30">
          &#123;&#125;
        </span>
      );
    case "md":
    case "markdown":
      return (
        <span className="w-4 h-4 rounded bg-purple-500/20 text-purple-400 font-bold text-[9px] flex items-center justify-center border border-purple-500/30">
          MD
        </span>
      );
    case "html":
    case "htm":
      return (
        <span className="w-4 h-4 rounded bg-rose-500/20 text-rose-400 font-bold text-[9px] flex items-center justify-center border border-rose-500/30">
          &lt;&gt;
        </span>
      );
    case "css":
    case "scss":
    case "less":
      return (
        <span className="w-4 h-4 rounded bg-sky-500/20 text-sky-300 font-bold text-[9px] flex items-center justify-center border border-sky-500/30">
          #
        </span>
      );
    case "sql":
      return (
        <span className="w-4 h-4 rounded bg-indigo-500/20 text-indigo-400 font-bold text-[9px] flex items-center justify-center border border-indigo-500/30">
          SQL
        </span>
      );
    case "cpp":
    case "cc":
    case "cxx":
    case "c":
    case "h":
    case "hpp":
      return (
        <span className="w-4 h-4 rounded bg-blue-600/20 text-blue-300 font-bold text-[9px] flex items-center justify-center border border-blue-600/30">
          C++
        </span>
      );
    case "sh":
    case "bash":
    case "zsh":
      return (
        <span className="w-4 h-4 rounded bg-green-500/20 text-green-400 font-bold text-[9px] flex items-center justify-center border border-green-500/30">
          $_
        </span>
      );
    case "java":
    case "kt":
      return (
        <span className="w-4 h-4 rounded bg-amber-600/20 text-amber-300 font-bold text-[9px] flex items-center justify-center border border-amber-600/30">
          JV
        </span>
      );
    case "yml":
    case "yaml":
      return (
        <span className="w-4 h-4 rounded bg-red-500/20 text-red-400 font-bold text-[9px] flex items-center justify-center border border-red-500/30">
          YML
        </span>
      );
    default:
      return <FileText className="h-3.5 w-3.5 text-muted shrink-0" />;
  }
}

export default function FileExplorer({
  files,
  activeFileId,
  canCreateOrEdit = true,
  allowedFiles = [],
  onSelectFile,
  onCreateFile,
  onRenameFile,
  onDeleteFile,
  onMoveFile,
  onDuplicateFile,
}: FileExplorerProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(["root"]));
  const [isCreating, setIsCreating] = useState<"file" | "folder" | null>(null);
  const [createParentId, setCreateParentId] = useState<string | null>(null);
  const [newItemName, setNewItemName] = useState("");

  const [editingFileId, setEditingFileId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  // Search filter
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Delete modal state
  const [itemToDelete, setItemToDelete] = useState<FileItem | null>(null);

  // Drag and Drop state
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [dragOverTargetId, setDragOverTargetId] = useState<string | null | "root">(null);

  // Clipboard & Context Menu state
  const [clipboard, setClipboard] = useState<ClipboardState | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  // Check if a folder is a descendant of another folder
  const isDescendant = useCallback(
    (folderId: string, potentialAncestorId: string): boolean => {
      let current = files.find((f) => f.id === folderId);
      while (current && current.parentId) {
        if (current.parentId === potentialAncestorId) return true;
        current = files.find((f) => f.id === current?.parentId);
      }
      return false;
    },
    [files]
  );

  // Validate if item can be dropped onto targetParentId
  const canDrop = useCallback(
    (sourceId: string, targetParentId: string | null): boolean => {
      if (sourceId === targetParentId) return false;
      const source = files.find((f) => f.id === sourceId);
      if (!source) return false;
      if (source.parentId === targetParentId) return false;

      // Prevent dropping folder into itself or its own subfolder
      if (source.type === "folder" && targetParentId !== null) {
        if (isDescendant(targetParentId, source.id)) return false;
      }

      return true;
    },
    [files, isDescendant]
  );

  useEffect(() => {
    if (!contextMenu) return;

    const handlePointerDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest("#file-explorer-context-menu")) return;
      setContextMenu(null);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setContextMenu(null);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [contextMenu]);

  const toggleFolder = (folderId: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  };

  const collapseAllFolders = () => {
    setExpandedFolders(new Set());
  };

  const expandAllFolders = () => {
    const allFolderIds = files.filter((f) => f.type === "folder").map((f) => f.id);
    setExpandedFolders(new Set(["root", ...allFolderIds]));
  };

  const startCreate = (type: "file" | "folder", parentId: string | null = null) => {
    setIsCreating(type);
    setCreateParentId(parentId);
    setNewItemName("");
    if (parentId) {
      setExpandedFolders((prev) => new Set(prev).add(parentId));
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim() || !isCreating) return;

    await onCreateFile(newItemName.trim(), createParentId, isCreating);
    setIsCreating(null);
    setNewItemName("");
  };

  const startRename = (file: FileItem) => {
    setEditingFileId(file.id);
    setEditName(file.name);
  };

  const handleRenameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim() || !editingFileId) return;

    await onRenameFile(editingFileId, editName.trim());
    setEditingFileId(null);
  };

  // Drag Handlers
  const handleDragStart = (e: React.DragEvent, item: FileItem) => {
    if (editingFileId || (!canCreateOrEdit && !allowedFiles.includes(item.id))) {
      e.preventDefault();
      return;
    }
    e.stopPropagation();
    e.dataTransfer.setData("text/plain", item.id);
    e.dataTransfer.effectAllowed = "move";
    setDraggedItemId(item.id);
  };

  const handleDragEnd = () => {
    setDraggedItemId(null);
    setDragOverTargetId(null);
  };

  const handleFolderDragOver = (e: React.DragEvent, folderId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (canCreateOrEdit && draggedItemId && canDrop(draggedItemId, folderId)) {
      e.dataTransfer.dropEffect = "move";
      setDragOverTargetId(folderId);
    }
  };

  const handleFolderDragLeave = (e: React.DragEvent, folderId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (dragOverTargetId === folderId) {
      setDragOverTargetId(null);
    }
  };

  const handleFolderDrop = async (e: React.DragEvent, folderId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!canCreateOrEdit) return;
    const id = e.dataTransfer.getData("text/plain") || draggedItemId;
    if (id && canDrop(id, folderId) && onMoveFile) {
      await onMoveFile(id, folderId);
      setExpandedFolders((prev) => new Set(prev).add(folderId));
    }
    setDraggedItemId(null);
    setDragOverTargetId(null);
  };

  const handleRootDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (canCreateOrEdit && draggedItemId && canDrop(draggedItemId, null)) {
      e.dataTransfer.dropEffect = "move";
      setDragOverTargetId("root");
    }
  };

  const handleRootDragLeave = () => {
    if (dragOverTargetId === "root") {
      setDragOverTargetId(null);
    }
  };

  const handleRootDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    if (!canCreateOrEdit) return;
    const id = e.dataTransfer.getData("text/plain") || draggedItemId;
    if (id && canDrop(id, null) && onMoveFile) {
      await onMoveFile(id, null);
    }
    setDraggedItemId(null);
    setDragOverTargetId(null);
  };

  const openContextMenu = (e: React.MouseEvent, item: FileItem | null) => {
    e.preventDefault();
    e.stopPropagation();
    const menuWidth = 210;
    const menuHeight = 320;
    const x = Math.max(8, Math.min(e.clientX, window.innerWidth - menuWidth - 8));
    const y = Math.max(8, Math.min(e.clientY, window.innerHeight - menuHeight - 8));
    setContextMenu({ x, y, item });
  };

  const handleCopy = (item: FileItem) => {
    setClipboard({ action: "copy", item });
    setContextMenu(null);
  };

  const handleCut = (item: FileItem) => {
    if (!canCreateOrEdit && !allowedFiles.includes(item.id)) return;
    setClipboard({ action: "cut", item });
    setContextMenu(null);
  };

  const handlePaste = useCallback(
    async (targetParentId: string | null) => {
      if (!clipboard || !canCreateOrEdit) return;
      setContextMenu(null);

      if (clipboard.action === "cut") {
        if (canDrop(clipboard.item.id, targetParentId) && onMoveFile) {
          await onMoveFile(clipboard.item.id, targetParentId);
        }
        setClipboard(null);
      } else {
        if (onDuplicateFile) {
          await onDuplicateFile(clipboard.item.id, targetParentId);
        } else {
          const parts = clipboard.item.name.split(".");
          let newName = "";
          if (parts.length > 1) {
            const ext = parts.pop();
            newName = `${parts.join(".")}_copy.${ext}`;
          } else {
            newName = `${clipboard.item.name}_copy`;
          }
          await onCreateFile(newName, targetParentId, clipboard.item.type, clipboard.item.content);
        }
      }

      if (targetParentId) {
        setExpandedFolders((prev) => new Set(prev).add(targetParentId));
      }
    },
    [clipboard, canCreateOrEdit, canDrop, onMoveFile, onDuplicateFile, onCreateFile]
  );

  const handleDuplicate = async (item: FileItem) => {
    if (!canCreateOrEdit) return;
    setContextMenu(null);
    if (onDuplicateFile) {
      await onDuplicateFile(item.id, item.parentId);
    } else {
      const parts = item.name.split(".");
      let newName = "";
      if (parts.length > 1) {
        const ext = parts.pop();
        newName = `${parts.join(".")}_copy.${ext}`;
      } else {
        newName = `${item.name}_copy`;
      }
      await onCreateFile(newName, item.parentId, item.type, item.content);
    }
  };

  // Keyboard Shortcuts for active item
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement instanceof HTMLInputElement ||
        document.activeElement instanceof HTMLTextAreaElement
      ) {
        return;
      }

      const activeFile = files.find((f) => f.id === activeFileId);

      // Copy (Ctrl+C / Cmd+C)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c" && activeFile) {
        setClipboard({ action: "copy", item: activeFile });
      }

      // Cut (Ctrl+X / Cmd+X)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "x" && activeFile) {
        if (canCreateOrEdit || allowedFiles.includes(activeFile.id)) {
          setClipboard({ action: "cut", item: activeFile });
        }
      }

      // Paste (Ctrl+V / Cmd+V)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "v" && clipboard && canCreateOrEdit) {
        const destParent = activeFile ? activeFile.parentId : null;
        handlePaste(destParent);
      }

      // Delete (Delete key)
      if (e.key === "Delete" && activeFile) {
        if (canCreateOrEdit || allowedFiles.includes(activeFile.id)) {
          setItemToDelete(activeFile);
        }
      }

      // Rename (F2 key)
      if (e.key === "F2" && activeFile) {
        if (canCreateOrEdit || allowedFiles.includes(activeFile.id)) {
          startRename(activeFile);
        }
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [activeFileId, files, clipboard, canCreateOrEdit, allowedFiles, handlePaste]);

  const activeFileItem = useMemo(
    () => files.find((f) => f.id === activeFileId) || null,
    [files, activeFileId]
  );

  // Filtered files when searching
  const filteredFiles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return null;
    return files.filter(
      (f) => f.type === "file" && f.name.toLowerCase().includes(q)
    );
  }, [files, searchQuery]);

  const fileCount = files.filter((f) => f.type === "file").length;
  const folderCount = files.filter((f) => f.type === "folder").length;

  const renderTree = (parentId: string | null = null, depth: number = 0) => {
    const currentFiles = files.filter((f) => f.parentId === parentId);

    const sorted = [...currentFiles].sort((a, b) => {
      if (a.type === b.type) return a.name.localeCompare(b.name);
      return a.type === "folder" ? -1 : 1;
    });

    return (
      <div className="space-y-0.5">
        {sorted.map((item) => {
          const isFolder = item.type === "folder";
          const isExpanded = expandedFolders.has(item.id);
          const isActive = item.id === activeFileId;
          const isEditing = editingFileId === item.id;
          const isDragging = draggedItemId === item.id;
          const isDragTarget = dragOverTargetId === item.id;
          const isCut = clipboard?.action === "cut" && clipboard.item.id === item.id;

          return (
            <div key={item.id} className="select-none">
              <div
                draggable={!isEditing && (canCreateOrEdit || allowedFiles.includes(item.id))}
                onDragStart={(e) => handleDragStart(e, item)}
                onDragEnd={handleDragEnd}
                onDragOver={isFolder ? (e) => handleFolderDragOver(e, item.id) : undefined}
                onDragLeave={isFolder ? (e) => handleFolderDragLeave(e, item.id) : undefined}
                onDrop={isFolder ? (e) => handleFolderDrop(e, item.id) : undefined}
                onContextMenu={(e) => openContextMenu(e, item)}
                style={{ paddingLeft: `${depth * 14 + 10}px` }}
                className={`group flex items-center justify-between py-1.5 pr-2 rounded-lg text-xs cursor-pointer transition-all ${
                  isDragging
                    ? "opacity-40"
                    : isCut
                    ? "opacity-50 italic"
                    : ""
                } ${
                  isDragTarget
                    ? "bg-accent/25 ring-2 ring-accent border-dashed border-accent font-medium text-foreground"
                    : isActive
                    ? "bg-accent/15 text-accent font-medium shadow-sm border-l-2 border-accent"
                    : "text-muted hover:text-foreground hover:bg-surface-hover border-l-2 border-transparent"
                }`}
                onClick={() => {
                  if (isFolder) {
                    toggleFolder(item.id);
                  } else {
                    onSelectFile(item);
                  }
                }}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {isFolder ? (
                    <>
                      {isExpanded ? (
                        <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-70" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-70" />
                      )}
                      {isExpanded ? (
                        <FolderOpen className="h-4 w-4 text-amber-400 shrink-0" />
                      ) : (
                        <Folder className="h-4 w-4 text-amber-400/80 group-hover:text-amber-400 shrink-0" />
                      )}
                    </>
                  ) : (
                    <div className="h-4 w-4 flex items-center justify-center shrink-0 ml-3.5">
                      {getFileBadge(item.name)}
                    </div>
                  )}

                  {isEditing ? (
                    <form
                      onSubmit={handleRenameSubmit}
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-1 flex-1"
                    >
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Escape") {
                            setEditingFileId(null);
                          }
                        }}
                        autoFocus
                        onBlur={() => setEditingFileId(null)}
                        className="bg-[#0b0e15] border border-indigo-500/80 rounded-md px-2 py-0.5 text-xs text-foreground focus:outline-none shadow-[0_0_0_2px_rgba(99,102,241,0.25)] w-full font-mono"
                      />
                      <button
                        type="submit"
                        className="text-green-400 p-0.5 hover:text-green-300"
                      >
                        <Check className="h-3 w-3" />
                      </button>
                    </form>
                  ) : (
                    <span className="truncate">{item.name}</span>
                  )}
                </div>

                {/* Actions on Hover */}
                {!isEditing && (
                  <div
                    className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 shrink-0 ml-1 transition-opacity"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {isFolder && canCreateOrEdit && (
                      <button
                        onClick={() => startCreate("file", item.id)}
                        title="New file in this folder"
                        className="p-1 hover:text-foreground text-muted rounded hover:bg-panel transition-colors"
                      >
                        <FilePlus className="h-3 w-3" />
                      </button>
                    )}
                    <button
                      onClick={() => handleCopy(item)}
                      title="Copy"
                      className="p-1 hover:text-foreground text-muted rounded hover:bg-panel transition-colors"
                    >
                      <Copy className="h-3 w-3" />
                    </button>
                    {(canCreateOrEdit || allowedFiles.includes(item.id)) && (
                      <>
                        <button
                          onClick={() => startRename(item)}
                          title="Rename"
                          className="p-1 hover:text-foreground text-muted rounded hover:bg-panel transition-colors"
                        >
                          <Edit2 className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => setItemToDelete(item)}
                          title="Delete"
                          className="p-1 hover:text-red-400 text-muted rounded hover:bg-panel transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Subfolder children */}
              {isFolder && isExpanded && renderTree(item.id, depth + 1)}
            </div>
          );
        })}
      </div>
    );
  };

  const isDraggingMovableToRoot =
    draggedItemId !== null && canDrop(draggedItemId, null);

  return (
    <div
      onContextMenu={(e) => openContextMenu(e, null)}
      onDragOver={handleRootDragOver}
      onDragLeave={handleRootDragLeave}
      onDrop={handleRootDrop}
      className="h-full bg-surface border-r border-border flex flex-col select-none overflow-hidden relative"
    >
      {/* Header */}
      <div className="h-10 px-3 border-b border-border flex items-center justify-between bg-panel-header shrink-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[11px] font-bold tracking-wider text-muted uppercase">
            Explorer
          </span>
          <span className="text-[10px] text-muted/70 font-mono">
            ({fileCount})
          </span>
        </div>

        <div className="flex items-center gap-0.5">
          {/* Search Toggle */}
          <button
            onClick={() => {
              setIsSearchOpen((prev) => !prev);
              if (isSearchOpen) setSearchQuery("");
            }}
            title="Filter files"
            className={`p-1 rounded transition-colors ${
              isSearchOpen || searchQuery
                ? "text-accent bg-accent/15"
                : "text-muted hover:text-foreground hover:bg-surface"
            }`}
          >
            <Search className="h-3.5 w-3.5" />
          </button>

          {/* Collapse/Expand Folders */}
          {folderCount > 0 && (
            <button
              onClick={() => {
                if (expandedFolders.size > 1) {
                  collapseAllFolders();
                } else {
                  expandAllFolders();
                }
              }}
              title={expandedFolders.size > 1 ? "Collapse All Folders" : "Expand All Folders"}
              className="p-1 rounded text-muted hover:text-foreground hover:bg-surface transition-colors"
            >
              <ChevronsDownUp className="h-3.5 w-3.5" />
            </button>
          )}

          {canCreateOrEdit ? (
            <>
              <button
                onClick={() => startCreate("file", null)}
                title="New File"
                className="p-1 rounded text-muted hover:text-foreground hover:bg-surface transition-colors"
              >
                <FilePlus className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => startCreate("folder", null)}
                title="New Folder"
                className="p-1 rounded text-muted hover:text-foreground hover:bg-surface transition-colors"
              >
                <FolderPlus className="h-3.5 w-3.5" />
              </button>
            </>
          ) : (
            <span
              title="You have read-only access."
              className="text-[10px] px-1.5 py-0.5 rounded bg-panel border border-border text-muted font-medium"
            >
              Read-Only
            </span>
          )}
        </div>
      </div>

      {/* Filter / Search Bar */}
      {(isSearchOpen || searchQuery) && (
        <div className="p-2 border-b border-border/80 bg-panel/60 backdrop-blur-sm animate-in fade-in duration-100">
          <div className="relative group flex items-center">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted group-focus-within:text-accent pointer-events-none transition-colors" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter files..."
              autoFocus
              className="input-base pl-8 pr-7 py-1.5 text-xs text-foreground placeholder:text-muted rounded-lg w-full"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-muted hover:text-foreground rounded"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Quick creation prompt */}
      {isCreating && (
        <div className="p-2.5 border-b border-border/80 bg-panel/70 backdrop-blur-sm animate-in fade-in duration-100">
          <div className="text-[10px] text-muted mb-1.5 flex items-center justify-between font-medium">
            <span className="flex items-center gap-1 truncate">
              <span>New {isCreating === "file" ? "File" : "Folder"} in:</span>
              <span className="text-accent font-mono bg-accent/10 px-1.5 py-0.5 rounded border border-accent/20 truncate">
                {createParentId
                  ? files.find((f) => f.id === createParentId)?.name || "selected folder"
                  : "root /"}
              </span>
            </span>
            <span className="text-[9px] text-muted/70 shrink-0 ml-1">Esc to cancel</span>
          </div>
          <form onSubmit={handleCreateSubmit} className="flex items-center gap-1.5">
            <span className="text-muted text-xs shrink-0 ml-0.5">
              {isCreating === "file" ? (
                <FilePlus className="h-3.5 w-3.5 text-sky-400" />
              ) : (
                <FolderPlus className="h-3.5 w-3.5 text-emerald-400" />
              )}
            </span>
            <input
              type="text"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setIsCreating(null);
                  setNewItemName("");
                }
              }}
              placeholder={isCreating === "file" ? "filename.ts" : "folder_name"}
              autoFocus
              className="input-base flex-1 px-2.5 py-1 text-xs font-mono text-foreground placeholder:text-muted rounded-lg"
            />
            <button
              type="submit"
              disabled={!newItemName.trim()}
              title="Create"
              className="p-1 text-emerald-400 hover:text-emerald-300 disabled:opacity-30 rounded hover:bg-surface/80 transition-colors"
            >
              <Check className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                setIsCreating(null);
                setNewItemName("");
              }}
              title="Cancel (Esc)"
              className="p-1 text-muted hover:text-foreground rounded hover:bg-surface/80 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </form>
        </div>
      )}

      {/* Files Tree / Filtered List */}
      <div
        className="flex-1 overflow-y-auto p-2"
        onContextMenu={(e) => openContextMenu(e, null)}
      >
        {filteredFiles !== null ? (
          <div className="space-y-0.5">
            <div className="text-[10px] uppercase font-semibold text-muted px-2 py-1">
              Matching Files ({filteredFiles.length})
            </div>
            {filteredFiles.length === 0 ? (
              <div className="p-4 text-center text-xs text-muted">
                No files match &quot;{searchQuery}&quot;
              </div>
            ) : (
              filteredFiles.map((file) => {
                const isActive = file.id === activeFileId;
                return (
                  <div
                    key={file.id}
                    onClick={() => onSelectFile(file)}
                    onContextMenu={(e) => openContextMenu(e, file)}
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition-colors ${
                      isActive
                        ? "bg-accent/15 text-accent font-medium shadow-sm border-l-2 border-accent"
                        : "text-muted hover:text-foreground hover:bg-surface-hover border-l-2 border-transparent"
                    }`}
                  >
                    {getFileBadge(file.name)}
                    <span className="truncate">{file.name}</span>
                  </div>
                );
              })
            )}
          </div>
        ) : files.length === 0 ? (
          <div className="p-6 text-center text-xs text-muted flex flex-col items-center justify-center h-full">
            <FileCode2 className="h-10 w-10 text-muted/30 mb-2" />
            <p className="font-semibold text-foreground">No files in project</p>
            <p className="text-[11px] text-muted mt-1 max-w-[160px]">
              Create code files to start collaborating.
            </p>
            {canCreateOrEdit && (
              <button
                onClick={() => startCreate("file", null)}
                className="mt-3 px-3 py-1.5 rounded-lg bg-accent/20 hover:bg-accent/30 text-accent font-semibold text-xs border border-accent/40 transition-colors"
              >
                + New File
              </button>
            )}
          </div>
        ) : (
          renderTree(null, 0)
        )}

        {/* Drop zone for moving to root */}
        {isDraggingMovableToRoot && (
          <div
            onDragOver={handleRootDragOver}
            onDragLeave={handleRootDragLeave}
            onDrop={handleRootDrop}
            className={`mt-4 p-3 border-2 border-dashed rounded-lg flex items-center justify-center gap-2 text-xs font-medium transition-colors ${
              dragOverTargetId === "root"
                ? "border-accent bg-accent/20 text-accent"
                : "border-border text-muted bg-surface/50"
            }`}
          >
            <ArrowDownToLine className="h-3.5 w-3.5" />
            <span>Drop here to move to Root</span>
          </div>
        )}
      </div>

      {/* Explorer Footer Stats */}
      <div className="h-6 px-3 border-t border-border bg-panel flex items-center justify-between text-[10px] text-muted font-mono shrink-0">
        <span>{fileCount} {fileCount === 1 ? "file" : "files"}</span>
        {folderCount > 0 && <span>{folderCount} {folderCount === 1 ? "folder" : "folders"}</span>}
      </div>

      {/* Right-click Context Menu */}
      {contextMenu && (
        <div
          id="file-explorer-context-menu"
          style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
          className="fixed z-50 min-w-[200px] p-1.5 rounded-xl bg-[#0e131f]/95 backdrop-blur-xl border border-white/10 shadow-2xl shadow-black/80 select-none animate-in fade-in zoom-in-95 duration-100 text-xs text-zinc-200 divide-y divide-white/5"
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.item ? (
            <>
              {/* Header with item name */}
              <div className="px-2.5 py-1 text-[10px] font-semibold text-muted truncate flex items-center gap-1.5">
                {contextMenu.item.type === "folder" ? (
                  <Folder className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                ) : (
                  <FileCode2 className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                )}
                <span className="truncate">{contextMenu.item.name}</span>
              </div>

              {/* Primary Actions: New File & New Folder */}
              <div className="py-0.5">
                <button
                  type="button"
                  onClick={() => {
                    if (!canCreateOrEdit) return;
                    const parentId =
                      contextMenu.item!.type === "folder"
                        ? contextMenu.item!.id
                        : contextMenu.item!.parentId;
                    startCreate("file", parentId);
                    setContextMenu(null);
                  }}
                  disabled={!canCreateOrEdit}
                  className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-indigo-600/20 hover:text-white disabled:opacity-40 disabled:hover:bg-transparent transition-colors text-left"
                >
                  <FilePlus className="h-4 w-4 text-sky-400 shrink-0" />
                  <span className="flex-1">
                    {contextMenu.item.type === "folder" ? "New File in Folder" : "New File"}
                  </span>
                  {!canCreateOrEdit && <span className="text-[9px] text-muted">(read-only)</span>}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!canCreateOrEdit) return;
                    const parentId =
                      contextMenu.item!.type === "folder"
                        ? contextMenu.item!.id
                        : contextMenu.item!.parentId;
                    startCreate("folder", parentId);
                    setContextMenu(null);
                  }}
                  disabled={!canCreateOrEdit}
                  className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-indigo-600/20 hover:text-white disabled:opacity-40 disabled:hover:bg-transparent transition-colors text-left"
                >
                  <FolderPlus className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span className="flex-1">
                    {contextMenu.item.type === "folder" ? "New Folder in Folder" : "New Folder"}
                  </span>
                  {!canCreateOrEdit && <span className="text-[9px] text-muted">(read-only)</span>}
                </button>
              </div>

              {/* Open File / Expand Folder / Duplicate File */}
              <div className="py-0.5">
                {contextMenu.item.type === "file" ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        onSelectFile(contextMenu.item!);
                        setContextMenu(null);
                      }}
                      className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-indigo-600/20 hover:text-white transition-colors text-left"
                    >
                      <FileCode2 className="h-4 w-4 text-indigo-400 shrink-0" />
                      <span>Open File</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        handleDuplicate(contextMenu.item!);
                        setContextMenu(null);
                      }}
                      disabled={!canCreateOrEdit}
                      className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-indigo-600/20 hover:text-white disabled:opacity-40 disabled:hover:bg-transparent transition-colors text-left"
                    >
                      <CopyPlus className="h-4 w-4 text-zinc-400 shrink-0" />
                      <span className="flex-1">Duplicate File</span>
                      {!canCreateOrEdit && <span className="text-[9px] text-muted">(read-only)</span>}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      toggleFolder(contextMenu.item!.id);
                      setContextMenu(null);
                    }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-indigo-600/20 hover:text-white transition-colors text-left"
                  >
                    <FolderOpen className="h-4 w-4 text-amber-400 shrink-0" />
                    <span>{expandedFolders.has(contextMenu.item.id) ? "Collapse Folder" : "Expand Folder"}</span>
                  </button>
                )}
              </div>

              {/* Copy, Cut & Paste */}
              <div className="py-0.5">
                <button
                  type="button"
                  onClick={() => handleCopy(contextMenu.item!)}
                  className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-indigo-600/20 hover:text-white transition-colors text-left"
                >
                  <div className="flex items-center gap-2.5">
                    <Copy className="h-4 w-4 text-zinc-400 shrink-0" />
                    <span>Copy</span>
                  </div>
                  <span className="text-[10px] text-muted font-mono">Ctrl+C</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleCut(contextMenu.item!)}
                  disabled={!canCreateOrEdit && !allowedFiles.includes(contextMenu.item.id)}
                  className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-indigo-600/20 hover:text-white disabled:opacity-40 disabled:hover:bg-transparent transition-colors text-left"
                >
                  <div className="flex items-center gap-2.5">
                    <Scissors className="h-4 w-4 text-zinc-400 shrink-0" />
                    <span>Cut</span>
                  </div>
                  <span className="text-[10px] text-muted font-mono">Ctrl+X</span>
                </button>

                {contextMenu.item.type === "folder" && clipboard && (
                  <button
                    type="button"
                    onClick={() => handlePaste(contextMenu.item!.id)}
                    disabled={!canCreateOrEdit}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-indigo-600/20 hover:text-white disabled:opacity-40 disabled:hover:bg-transparent transition-colors text-left"
                  >
                    <div className="flex items-center gap-2.5">
                      <Clipboard className="h-4 w-4 text-accent shrink-0" />
                      <span>Paste</span>
                    </div>
                    <span className="text-[10px] text-muted font-mono">Ctrl+V</span>
                  </button>
                )}
              </div>

              {/* Rename & Copy Name */}
              <div className="py-0.5">
                <button
                  type="button"
                  onClick={() => {
                    if (!canCreateOrEdit && !allowedFiles.includes(contextMenu.item!.id)) return;
                    startRename(contextMenu.item!);
                    setContextMenu(null);
                  }}
                  disabled={!canCreateOrEdit && !allowedFiles.includes(contextMenu.item.id)}
                  className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-indigo-600/20 hover:text-white disabled:opacity-40 disabled:hover:bg-transparent transition-colors text-left"
                >
                  <div className="flex items-center gap-2.5">
                    <Edit2 className="h-4 w-4 text-zinc-400 shrink-0" />
                    <span className="flex-1">
                      {contextMenu.item.type === "folder" ? "Rename Folder" : "Rename"}
                    </span>
                  </div>
                  <span className="text-[10px] text-muted font-mono">F2</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(contextMenu.item!.name);
                    setContextMenu(null);
                  }}
                  className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-indigo-600/20 hover:text-white transition-colors text-left"
                >
                  <Copy className="h-4 w-4 text-zinc-400 shrink-0" />
                  <span>
                    {contextMenu.item.type === "folder" ? "Copy Folder Name" : "Copy File Name"}
                  </span>
                </button>
              </div>

              {/* Delete File / Delete Folder */}
              <div className="py-0.5">
                <button
                  type="button"
                  onClick={() => {
                    if (!canCreateOrEdit && !allowedFiles.includes(contextMenu.item!.id)) return;
                    setItemToDelete(contextMenu.item!);
                    setContextMenu(null);
                  }}
                  disabled={!canCreateOrEdit && !allowedFiles.includes(contextMenu.item.id)}
                  className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-red-500/20 text-red-400 hover:text-red-300 disabled:opacity-40 disabled:hover:bg-transparent transition-colors text-left font-medium"
                >
                  <div className="flex items-center gap-2.5">
                    <Trash2 className="h-4 w-4 shrink-0" />
                    <span className="flex-1">
                      {contextMenu.item.type === "folder" ? "Delete Folder" : "Delete File"}
                    </span>
                  </div>
                  <span className="text-[10px] opacity-70 font-mono">Del</span>
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Context menu for empty explorer area / root */}
              <div className="px-2.5 py-1 text-[10px] font-semibold text-muted">
                Explorer Actions
              </div>

              {/* New File & New Folder */}
              <div className="py-0.5">
                <button
                  type="button"
                  onClick={() => {
                    if (!canCreateOrEdit) return;
                    startCreate("file", null);
                    setContextMenu(null);
                  }}
                  disabled={!canCreateOrEdit}
                  className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-indigo-600/20 hover:text-white disabled:opacity-40 disabled:hover:bg-transparent transition-colors text-left"
                >
                  <FilePlus className="h-4 w-4 text-sky-400 shrink-0" />
                  <span className="flex-1">New File</span>
                  {!canCreateOrEdit && <span className="text-[9px] text-muted">(read-only)</span>}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!canCreateOrEdit) return;
                    startCreate("folder", null);
                    setContextMenu(null);
                  }}
                  disabled={!canCreateOrEdit}
                  className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-indigo-600/20 hover:text-white disabled:opacity-40 disabled:hover:bg-transparent transition-colors text-left"
                >
                  <FolderPlus className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span className="flex-1">New Folder</span>
                  {!canCreateOrEdit && <span className="text-[9px] text-muted">(read-only)</span>}
                </button>
              </div>

              {/* Paste at Root if clipboard has item */}
              {clipboard && (
                <div className="py-0.5">
                  <button
                    type="button"
                    onClick={() => handlePaste(null)}
                    disabled={!canCreateOrEdit}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-indigo-600/20 hover:text-white disabled:opacity-40 disabled:hover:bg-transparent transition-colors text-left"
                  >
                    <div className="flex items-center gap-2.5">
                      <Clipboard className="h-4 w-4 text-accent shrink-0" />
                      <span>Paste</span>
                    </div>
                    <span className="text-[10px] text-muted font-mono">Ctrl+V</span>
                  </button>
                </div>
              )}

              {/* Active file actions if available */}
              {activeFileItem && (
                <div className="py-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      if (!canCreateOrEdit && !allowedFiles.includes(activeFileItem.id)) return;
                      startRename(activeFileItem);
                      setContextMenu(null);
                    }}
                    disabled={!canCreateOrEdit && !allowedFiles.includes(activeFileItem.id)}
                    className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-indigo-600/20 hover:text-white disabled:opacity-40 disabled:hover:bg-transparent transition-colors text-left"
                  >
                    <Edit2 className="h-4 w-4 text-zinc-400 shrink-0" />
                    <span className="flex-1 truncate">Rename ({activeFileItem.name})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!canCreateOrEdit && !allowedFiles.includes(activeFileItem.id)) return;
                      setItemToDelete(activeFileItem);
                      setContextMenu(null);
                    }}
                    disabled={!canCreateOrEdit && !allowedFiles.includes(activeFileItem.id)}
                    className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-red-500/20 text-red-400 hover:text-red-300 disabled:opacity-40 disabled:hover:bg-transparent transition-colors text-left font-medium"
                  >
                    <Trash2 className="h-4 w-4 shrink-0" />
                    <span className="flex-1 truncate">Delete File ({activeFileItem.name})</span>
                  </button>
                </div>
              )}

              {/* Expand / Collapse All */}
              <div className="py-0.5">
                <button
                  type="button"
                  onClick={() => {
                    expandAllFolders();
                    setContextMenu(null);
                  }}
                  className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-indigo-600/20 hover:text-white transition-colors text-left"
                >
                  <FolderOpen className="h-4 w-4 text-amber-400 shrink-0" />
                  <span>Expand All Folders</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    collapseAllFolders();
                    setContextMenu(null);
                  }}
                  className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-indigo-600/20 hover:text-white transition-colors text-left"
                >
                  <ChevronsDownUp className="h-4 w-4 text-zinc-400 shrink-0" />
                  <span>Collapse All Folders</span>
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {itemToDelete && (
        <DeleteConfirmModal
          isOpen={Boolean(itemToDelete)}
          onClose={() => setItemToDelete(null)}
          onConfirm={() => onDeleteFile(itemToDelete.id)}
          itemName={itemToDelete.name}
          itemType={itemToDelete.type}
        />
      )}
    </div>
  );
}
