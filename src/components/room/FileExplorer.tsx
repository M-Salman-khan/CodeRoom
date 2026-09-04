"use client";

import { useState } from "react";
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
}: FileExplorerProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(["root"]));
  const [isCreating, setIsCreating] = useState<"file" | "folder" | null>(null);
  const [createParentId, setCreateParentId] = useState<string | null>(null);
  const [newItemName, setNewItemName] = useState("");

  const [editingFileId, setEditingFileId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

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

          return (
            <div key={item.id} className="select-none">
              <div
                style={{ paddingLeft: `${depth * 14 + 10}px` }}
                className={`group flex items-center justify-between py-1.5 pr-2 rounded-lg text-xs cursor-pointer transition-colors ${
                  isActive
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
                      onClick={() => startRename(item)}
                      title="Rename"
                      className="p-1 hover:text-foreground text-muted rounded hover:bg-panel"
                    >
                      <Edit2 className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => onDeleteFile(item.id)}
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

  return (
    <div className="h-full bg-surface border-r border-border flex flex-col select-none overflow-hidden">
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
        <div className="p-2 border-b border-border bg-panel">
          <form onSubmit={handleCreateSubmit} className="flex items-center gap-1.5">
            <span className="text-muted text-xs shrink-0">
              {isCreating === "file" ? <FilePlus className="h-3.5 w-3.5 text-accent" /> : <FolderPlus className="h-3.5 w-3.5 text-emerald-400" />}
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
      <div className="flex-1 overflow-y-auto p-2">
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
    </div>
  );
}
