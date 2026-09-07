"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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
  Copy,
  Scissors,
  Clipboard,
  CopyPlus,
  ArrowDownToLine,
} from "lucide-react";

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
  onSelectFile: (file: FileItem) => void;
  onCreateFile: (name: string, parentId: string | null, type: "file" | "folder") => Promise<void>;
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

function getFileIcon(filename: string) {
  const ext = filename.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "ts":
    case "tsx":
      return <span className="text-blue-400 font-bold text-[10px]">TS</span>;
    case "js":
    case "jsx":
      return <span className="text-yellow-400 font-bold text-[10px]">JS</span>;
    case "py":
      return <span className="text-emerald-400 font-bold text-[10px]">PY</span>;
    case "rs":
      return <span className="text-orange-400 font-bold text-[10px]">RS</span>;
    case "go":
      return <span className="text-cyan-400 font-bold text-[10px]">GO</span>;
    case "json":
      return <span className="text-amber-400 font-bold text-[10px]">{}</span>;
    case "md":
      return <span className="text-purple-400 font-bold text-[10px]">MD</span>;
    case "html":
      return <span className="text-rose-400 font-bold text-[10px]">&lt;&gt;</span>;
    case "css":
      return <span className="text-blue-300 font-bold text-[10px]">#</span>;
    case "sql":
      return <span className="text-indigo-400 font-bold text-[10px]">SQL</span>;
    case "cpp":
    case "c":
      return <span className="text-sky-400 font-bold text-[10px]">C++</span>;
    case "java":
    case "kt":
      return <span className="text-amber-500 font-bold text-[10px]">JV</span>;
    default:
      return <FileText className="h-3.5 w-3.5 text-muted" />;
  }
}

export default function FileExplorer({
  files,
  activeFileId,
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

  // Drag and Drop state
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [dragOverTargetId, setDragOverTargetId] = useState<string | null | "root">(null);

  // Clipboard & Context Menu state
  const [clipboard, setClipboard] = useState<ClipboardState | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  const contextMenuRef = useRef<HTMLDivElement | null>(null);

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

  // Close context menu on outside click or Escape key
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setContextMenu(null);
      }
    };

    if (contextMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
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
    if (editingFileId) return;
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
    if (draggedItemId && canDrop(draggedItemId, folderId)) {
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
    const id = e.dataTransfer.getData("text/plain") || draggedItemId;
    if (id && canDrop(id, folderId)) {
      await onMoveFile(id, folderId);
      setExpandedFolders((prev) => new Set(prev).add(folderId));
    }
    setDraggedItemId(null);
    setDragOverTargetId(null);
  };

  const handleRootDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (draggedItemId && canDrop(draggedItemId, null)) {
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
    const id = e.dataTransfer.getData("text/plain") || draggedItemId;
    if (id && canDrop(id, null)) {
      await onMoveFile(id, null);
    }
    setDraggedItemId(null);
    setDragOverTargetId(null);
  };

  // Context Menu Handlers
  const handleItemContextMenu = (e: React.MouseEvent, item: FileItem) => {
    e.preventDefault();
    e.stopPropagation();
    const menuWidth = 190;
    const menuHeight = 260;
    const x = Math.min(e.clientX, window.innerWidth - menuWidth - 10);
    const y = Math.min(e.clientY, window.innerHeight - menuHeight - 10);
    setContextMenu({ x, y, item });
  };

  const handleBackgroundContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const menuWidth = 190;
    const menuHeight = 160;
    const x = Math.min(e.clientX, window.innerWidth - menuWidth - 10);
    const y = Math.min(e.clientY, window.innerHeight - menuHeight - 10);
    setContextMenu({ x, y, item: null });
  };

  const handleCopy = (item: FileItem) => {
    setClipboard({ action: "copy", item });
    setContextMenu(null);
  };

  const handleCut = (item: FileItem) => {
    setClipboard({ action: "cut", item });
    setContextMenu(null);
  };

  const handlePaste = async (targetParentId: string | null) => {
    if (!clipboard) return;
    setContextMenu(null);

    if (clipboard.action === "cut") {
      if (canDrop(clipboard.item.id, targetParentId)) {
        await onMoveFile(clipboard.item.id, targetParentId);
      }
      setClipboard(null);
    } else {
      await onDuplicateFile(clipboard.item.id, targetParentId);
    }

    if (targetParentId) {
      setExpandedFolders((prev) => new Set(prev).add(targetParentId));
    }
  };

  const handleDuplicate = async (item: FileItem) => {
    setContextMenu(null);
    await onDuplicateFile(item.id, item.parentId);
  };

  const handleDelete = async (item: FileItem) => {
    setContextMenu(null);
    await onDeleteFile(item.id);
  };

  // Keyboard Shortcuts for active item
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
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
        setClipboard({ action: "cut", item: activeFile });
      }

      // Paste (Ctrl+V / Cmd+V)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "v" && clipboard) {
        const destParent = activeFile ? activeFile.parentId : null;
        handlePaste(destParent);
      }

      // Delete (Delete key)
      if (e.key === "Delete" && activeFile) {
        handleDelete(activeFile);
      }

      // Rename (F2 key)
      if (e.key === "F2" && activeFile) {
        startRename(activeFile);
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [activeFileId, files, clipboard]);

  const renderTree = (parentId: string | null = null, depth: number = 0) => {
    const currentFiles = files.filter((f) => f.parentId === parentId);

    // Folders first, then files alphabetically
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
                draggable={!isEditing}
                onDragStart={(e) => handleDragStart(e, item)}
                onDragEnd={handleDragEnd}
                onDragOver={isFolder ? (e) => handleFolderDragOver(e, item.id) : undefined}
                onDragLeave={isFolder ? (e) => handleFolderDragLeave(e, item.id) : undefined}
                onDrop={isFolder ? (e) => handleFolderDrop(e, item.id) : undefined}
                onContextMenu={(e) => handleItemContextMenu(e, item)}
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
                    ? "bg-accent/15 text-accent font-medium"
                    : "text-muted hover:text-foreground hover:bg-surface-hover"
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
                        <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-60" />
                      )}
                      {isExpanded ? (
                        <FolderOpen className="h-4 w-4 text-accent shrink-0" />
                      ) : (
                        <Folder className="h-4 w-4 text-muted group-hover:text-accent shrink-0" />
                      )}
                    </>
                  ) : (
                    <div className="h-4 w-4 flex items-center justify-center shrink-0 ml-4">
                      {getFileIcon(item.name)}
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
                        autoFocus
                        onBlur={() => setEditingFileId(null)}
                        className="bg-panel border border-accent rounded px-1.5 py-0.5 text-xs text-foreground focus:outline-none w-full"
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
                    className="opacity-0 group-hover:opacity-100 flex items-center gap-1 shrink-0 ml-1 transition-opacity"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {isFolder && (
                      <button
                        onClick={() => startCreate("file", item.id)}
                        title="New file inside folder"
                        className="p-1 hover:text-foreground text-muted rounded hover:bg-panel"
                      >
                        <FilePlus className="h-3 w-3" />
                      </button>
                    )}
                    <button
                      onClick={() => handleCopy(item)}
                      title="Copy"
                      className="p-1 hover:text-foreground text-muted rounded hover:bg-panel"
                    >
                      <Copy className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => startRename(item)}
                      title="Rename"
                      className="p-1 hover:text-foreground text-muted rounded hover:bg-panel"
                    >
                      <Edit2 className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => handleDelete(item)}
                      title="Delete"
                      className="p-1 hover:text-red-400 text-muted rounded hover:bg-panel"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
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
      className="h-full bg-surface border-r border-border flex flex-col select-none overflow-hidden relative"
      onContextMenu={handleBackgroundContextMenu}
      onDragOver={handleRootDragOver}
      onDragLeave={handleRootDragLeave}
      onDrop={handleRootDrop}
    >
      {/* Header */}
      <div className="h-10 px-3 border-b border-border flex items-center justify-between bg-panel-header shrink-0">
        <span className="text-[11px] font-semibold tracking-wider text-muted uppercase">
          Explorer
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => startCreate("file", null)}
            title="New File"
            className="p-1 rounded text-muted hover:text-foreground hover:bg-surface transition-colors"
          >
            <FilePlus className="h-4 w-4" />
          </button>
          <button
            onClick={() => startCreate("folder", null)}
            title="New Folder"
            className="p-1 rounded text-muted hover:text-foreground hover:bg-surface transition-colors"
          >
            <FolderPlus className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Quick creation prompt */}
      {isCreating && (
        <div className="p-2 border-b border-border bg-panel shrink-0">
          <form onSubmit={handleCreateSubmit} className="flex items-center gap-1.5">
            <span className="text-muted text-xs shrink-0">
              {isCreating === "file" ? (
                <FilePlus className="h-3.5 w-3.5 text-accent" />
              ) : (
                <FolderPlus className="h-3.5 w-3.5 text-emerald-400" />
              )}
            </span>
            <input
              type="text"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              placeholder={isCreating === "file" ? "filename.ts" : "folder_name"}
              autoFocus
              className="flex-1 bg-surface border border-accent rounded-lg px-2 py-1 text-xs text-foreground focus:outline-none"
            />
            <button
              type="submit"
              className="p-1 text-green-400 hover:text-green-300 rounded hover:bg-surface"
            >
              <Check className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setIsCreating(null)}
              className="p-1 text-muted hover:text-foreground rounded hover:bg-surface"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </form>
        </div>
      )}

      {/* Files Tree */}
      <div className="flex-1 overflow-y-auto p-2 flex flex-col justify-between">
        <div>
          {files.length === 0 ? (
            <div className="p-4 text-center text-xs text-muted">
              <p>No files in this project.</p>
              <button
                onClick={() => startCreate("file", null)}
                className="mt-2 text-accent hover:underline font-medium"
              >
                + Create a file
              </button>
            </div>
          ) : (
            renderTree(null, 0)
          )}
        </div>

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

      {/* Custom Right-Click Context Menu */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
          className="fixed z-50 min-w-[170px] bg-panel/95 backdrop-blur-md border border-border rounded-lg shadow-2xl py-1 text-xs text-foreground select-none"
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.item ? (
            <>
              {/* Item is a File or Folder */}
              {contextMenu.item.type === "file" && (
                <button
                  onClick={() => {
                    onSelectFile(contextMenu.item!);
                    setContextMenu(null);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-accent/15 hover:text-accent text-left transition-colors"
                >
                  <FileText className="h-3.5 w-3.5 text-muted" />
                  <span>Open</span>
                </button>
              )}

              {contextMenu.item.type === "folder" && (
                <>
                  <button
                    onClick={() => {
                      startCreate("file", contextMenu.item!.id);
                      setContextMenu(null);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-accent/15 hover:text-accent text-left transition-colors"
                  >
                    <FilePlus className="h-3.5 w-3.5 text-muted" />
                    <span>New File</span>
                  </button>
                  <button
                    onClick={() => {
                      startCreate("folder", contextMenu.item!.id);
                      setContextMenu(null);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-accent/15 hover:text-accent text-left transition-colors"
                  >
                    <FolderPlus className="h-3.5 w-3.5 text-muted" />
                    <span>New Folder</span>
                  </button>
                  <div className="h-px bg-border/60 my-1" />
                </>
              )}

              <button
                onClick={() => handleCopy(contextMenu.item!)}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-accent/15 hover:text-accent text-left transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <Copy className="h-3.5 w-3.5 text-muted" />
                  <span>Copy</span>
                </div>
                <span className="text-[10px] text-muted tracking-wide">Ctrl+C</span>
              </button>

              <button
                onClick={() => handleCut(contextMenu.item!)}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-accent/15 hover:text-accent text-left transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <Scissors className="h-3.5 w-3.5 text-muted" />
                  <span>Cut</span>
                </div>
                <span className="text-[10px] text-muted tracking-wide">Ctrl+X</span>
              </button>

              {contextMenu.item.type === "folder" && clipboard && (
                <button
                  onClick={() => handlePaste(contextMenu.item!.id)}
                  className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-accent/15 hover:text-accent text-left transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <Clipboard className="h-3.5 w-3.5 text-accent" />
                    <span>Paste</span>
                  </div>
                  <span className="text-[10px] text-muted tracking-wide">Ctrl+V</span>
                </button>
              )}

              <button
                onClick={() => handleDuplicate(contextMenu.item!)}
                className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-accent/15 hover:text-accent text-left transition-colors"
              >
                <CopyPlus className="h-3.5 w-3.5 text-muted" />
                <span>Duplicate</span>
              </button>

              <div className="h-px bg-border/60 my-1" />

              <button
                onClick={() => {
                  startRename(contextMenu.item!);
                  setContextMenu(null);
                }}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-accent/15 hover:text-accent text-left transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <Edit2 className="h-3.5 w-3.5 text-muted" />
                  <span>Rename</span>
                </div>
                <span className="text-[10px] text-muted tracking-wide">F2</span>
              </button>

              <button
                onClick={() => handleDelete(contextMenu.item!)}
                className="w-full flex items-center justify-between px-3 py-1.5 text-red-400 hover:bg-red-500/15 hover:text-red-300 text-left transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Delete</span>
                </div>
                <span className="text-[10px] opacity-70 tracking-wide">Del</span>
              </button>
            </>
          ) : (
            <>
              {/* Empty background / Root context menu */}
              <button
                onClick={() => {
                  startCreate("file", null);
                  setContextMenu(null);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-accent/15 hover:text-accent text-left transition-colors"
              >
                <FilePlus className="h-3.5 w-3.5 text-muted" />
                <span>New File</span>
              </button>

              <button
                onClick={() => {
                  startCreate("folder", null);
                  setContextMenu(null);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-accent/15 hover:text-accent text-left transition-colors"
              >
                <FolderPlus className="h-3.5 w-3.5 text-muted" />
                <span>New Folder</span>
              </button>

              {clipboard && (
                <>
                  <div className="h-px bg-border/60 my-1" />
                  <button
                    onClick={() => handlePaste(null)}
                    className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-accent/15 hover:text-accent text-left transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <Clipboard className="h-3.5 w-3.5 text-accent" />
                      <span>Paste</span>
                    </div>
                    <span className="text-[10px] text-muted tracking-wide">Ctrl+V</span>
                  </button>
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
