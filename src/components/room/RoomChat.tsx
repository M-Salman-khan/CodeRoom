"use client";

import React, { useEffect, useRef, useState, useCallback, memo, useMemo } from "react";
import {
  Send,
  MessageSquare,
  Smile,
  Copy,
  Check,
  Search,
  X,
  Code2,
  Trash2,
  MoreVertical,
  Quote,
} from "lucide-react";
import { getUserColor, getInitials } from "@/lib/utils";

export interface ChatMessage {
  id: string;
  roomId: string;
  userId: string;
  username: string;
  content: string;
  createdAt: string;
}

interface RoomChatProps {
  roomId?: string;
  messages: ChatMessage[];
  currentUserId: string;
  onSendMessage: (content: string) => void;
  onClearChat?: () => void;
  activeFileName?: string | null;
}

const QUICK_EMOJIS = ["👍", "🚀", "❤️", "🔥", "🎉", "👀", "🙌", "💯", "💡", "🐛"];

// Helper component for message content with Markdown code blocks
function FormattedMessage({ content }: { content: string }) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleCopyCode = (code: string, index: number) => {
    navigator.clipboard.writeText(code);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  // Check if content has triple-backtick code blocks
  const parts = useMemo(() => {
    const segments: Array<
      | { type: "text"; value: string }
      | { type: "code"; lang: string; code: string }
    > = [];

    const regex = /```([a-zA-Z0-9_-]*)\n?([\s\S]*?)```/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        segments.push({
          type: "text",
          value: content.slice(lastIndex, match.index),
        });
      }

      segments.push({
        type: "code",
        lang: match[1] || "code",
        code: match[2].trim(),
      });

      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < content.length) {
      segments.push({
        type: "text",
        value: content.slice(lastIndex),
      });
    }

    return segments;
  }, [content]);

  // Helper to render text with inline code `foo`
  const renderInlineText = (text: string) => {
    const inlineRegex = /`([^`]+)`/g;
    const elements: React.ReactNode[] = [];
    let lastIdx = 0;
    let inlineMatch;

    while ((inlineMatch = inlineRegex.exec(text)) !== null) {
      if (inlineMatch.index > lastIdx) {
        elements.push(text.substring(lastIdx, inlineMatch.index));
      }
      elements.push(
        <code
          key={inlineMatch.index}
          className="px-1.5 py-0.5 rounded bg-black/40 text-amber-300 font-mono text-[11px] border border-border/60"
        >
          {inlineMatch[1]}
        </code>
      );
      lastIdx = inlineMatch.index + inlineMatch[0].length;
    }

    if (lastIdx < text.length) {
      elements.push(text.substring(lastIdx));
    }

    return elements;
  };

  return (
    <div className="space-y-1.5 leading-relaxed">
      {parts.map((part, i) => {
        if (part.type === "code") {
          const isCopied = copiedIndex === i;
          return (
            <div
              key={i}
              className="my-1.5 rounded-xl bg-[#090d13] border border-border/80 overflow-hidden font-mono text-[11px] shadow-sm"
            >
              <div className="h-6 px-2.5 bg-[#141a24] border-b border-border/60 flex items-center justify-between text-muted select-none">
                <span className="text-[10px] uppercase font-bold text-accent">
                  {part.lang}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopyCode(part.code, i)}
                  className="flex items-center gap-1 text-[10px] text-muted hover:text-foreground transition-colors"
                >
                  {isCopied ? (
                    <>
                      <Check className="h-3 w-3 text-emerald-400" />
                      <span className="text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="p-2.5 overflow-x-auto text-foreground/90 whitespace-pre leading-relaxed selection:bg-accent/30">
                {part.code}
              </pre>
            </div>
          );
        }

        return (
          <span key={i} className="whitespace-pre-wrap">
            {renderInlineText(part.value)}
          </span>
        );
      })}
    </div>
  );
}

function RoomChatComponent({
  messages,
  currentUserId,
  onSendMessage,
  onClearChat,
  activeFileName,
}: RoomChatProps) {
  const [input, setInput] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isOptionsMenuOpen, setIsOptionsMenuOpen] = useState(false);
  const [chatContextMenu, setChatContextMenu] = useState<{
    x: number;
    y: number;
    message: ChatMessage | null;
  } | null>(null);
  const [copiedToast, setCopiedToast] = useState<string | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const emojiPickerRef = useRef<HTMLDivElement | null>(null);
  const isNearBottomRef = useRef(true);
  const initialScrollDoneRef = useRef(false);

  const scrollToBottom = useCallback((instant = false) => {
    const el = scrollContainerRef.current;
    if (!el) return;
    el.scrollTo({
      top: el.scrollHeight,
      behavior: instant ? "auto" : "smooth",
    });
  }, []);

  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    isNearBottomRef.current = distanceToBottom < 80;
  }, []);

  useEffect(() => {
    if (!chatContextMenu && !isOptionsMenuOpen) return;

    const handlePointerDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target?.closest("#chat-context-menu") ||
        target?.closest("#chat-header-options-menu")
      ) {
        return;
      }
      setChatContextMenu(null);
      setIsOptionsMenuOpen(false);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setChatContextMenu(null);
        setIsOptionsMenuOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [chatContextMenu, isOptionsMenuOpen]);

  const handleCopyAll = () => {
    if (messages.length === 0) return;
    const text = messages
      .map(
        (m) =>
          `[${formatTime(m.createdAt)}] ${m.username}: ${m.content}`
      )
      .join("\n");
    navigator.clipboard.writeText(text);
    setCopiedToast("All messages copied to clipboard");
    setTimeout(() => setCopiedToast(null), 2000);
  };

  useEffect(() => {
    if (!initialScrollDoneRef.current && messages.length > 0) {
      scrollToBottom(true);
      initialScrollDoneRef.current = true;
    } else if (isNearBottomRef.current) {
      requestAnimationFrame(() => {
        scrollToBottom(false);
      });
    }
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (!showEmojiPicker) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(e.target as Node)
      ) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showEmojiPicker]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;

    onSendMessage(trimmed);
    setInput("");
    setShowEmojiPicker(false);
    isNearBottomRef.current = true;
    requestAnimationFrame(() => scrollToBottom(false));
  };

  const addEmoji = (emoji: string) => {
    setInput((prev) => prev + emoji);
    setShowEmojiPicker(false);
  };

  const handleShareFileReference = () => {
    if (!activeFileName) return;
    setInput((prev) => {
      const ref = `Take a look at \`${activeFileName}\`: `;
      return prev ? `${prev} ${ref}` : ref;
    });
  };

  const formatTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return "";
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
  };

  // Filter messages based on search query
  const displayedMessages = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return messages;
    return messages.filter(
      (m) =>
        m.content.toLowerCase().includes(q) ||
        m.username.toLowerCase().includes(q)
    );
  }, [messages, searchQuery]);

  return (
    <div className="h-full bg-surface border-l border-border flex flex-col min-h-0 overflow-hidden select-none">
      {/* Header */}
      <div className="h-10 px-3 border-b border-border flex items-center justify-between bg-panel-header shrink-0">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-accent" />
          <span className="text-[11px] font-bold tracking-wider text-muted uppercase">
            Chat
          </span>
          <span className="text-[10px] text-muted/70 font-mono">
            ({messages.length})
          </span>
        </div>

        <div className="flex items-center gap-1">
          {/* Search Toggle */}
          <button
            onClick={() => {
              setIsSearchOpen(!isSearchOpen);
              if (isSearchOpen) setSearchQuery("");
            }}
            title="Search messages"
            className={`p-1 rounded transition-colors ${
              isSearchOpen || searchQuery
                ? "text-accent bg-accent/15"
                : "text-muted hover:text-foreground hover:bg-surface"
            }`}
          >
            <Search className="h-3.5 w-3.5" />
          </button>

          {/* Clear Chat Button */}
          {onClearChat && (
            <button
              type="button"
              onClick={() => setShowClearConfirm(true)}
              disabled={messages.length === 0}
              title={messages.length === 0 ? "Chat is empty" : "Clear chat history"}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-muted hover:text-red-400 hover:bg-red-500/10 disabled:opacity-30 disabled:hover:text-muted disabled:hover:bg-transparent transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span className="text-[11px] font-medium hidden sm:inline">Clear</span>
            </button>
          )}

          {/* More Options Menu */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsOptionsMenuOpen((prev) => !prev)}
              title="More chat options"
              className={`p-1 rounded transition-colors ${
                isOptionsMenuOpen
                  ? "text-accent bg-accent/15"
                  : "text-muted hover:text-foreground hover:bg-surface"
              }`}
            >
              <MoreVertical className="h-3.5 w-3.5" />
            </button>

            {isOptionsMenuOpen && (
              <div
                id="chat-header-options-menu"
                className="absolute right-0 top-full mt-1 w-44 p-1 rounded-xl bg-[#0e131f]/95 backdrop-blur-xl border border-white/10 shadow-2xl z-40 text-xs text-zinc-200 divide-y divide-white/5 animate-in fade-in zoom-in-95 duration-100"
              >
                <div className="py-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setIsSearchOpen(true);
                      setIsOptionsMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-indigo-600/20 hover:text-white transition-colors text-left"
                  >
                    <Search className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                    <span>Search History</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleCopyAll();
                      setIsOptionsMenuOpen(false);
                    }}
                    disabled={messages.length === 0}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-indigo-600/20 hover:text-white disabled:opacity-40 disabled:hover:bg-transparent transition-colors text-left"
                  >
                    <Copy className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                    <span>Copy All Messages</span>
                  </button>
                </div>
                {onClearChat && (
                  <div className="py-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        setShowClearConfirm(true);
                        setIsOptionsMenuOpen(false);
                      }}
                      disabled={messages.length === 0}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-red-500/20 text-red-400 hover:text-red-300 disabled:opacity-40 disabled:hover:bg-transparent transition-colors text-left font-medium"
                    >
                      <Trash2 className="h-3.5 w-3.5 shrink-0" />
                      <span>Clear Chat</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Clear Chat Confirmation Banner */}
      {showClearConfirm && (
        <div className="p-2.5 border-b border-red-500/20 bg-red-500/10 backdrop-blur-sm animate-in fade-in slide-in-from-top-1 duration-150 select-none">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-medium text-red-300">
              Clear all messages for everyone?
            </span>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                className="px-2 py-0.5 rounded text-[11px] text-zinc-400 hover:text-zinc-200 hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onClearChat?.();
                  setShowClearConfirm(false);
                }}
                className="px-2 py-0.5 rounded bg-red-600 hover:bg-red-500 text-white text-[11px] font-semibold transition-colors shadow-sm"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Search Input Bar */}
      {(isSearchOpen || searchQuery) && (
        <div className="p-2 border-b border-border/80 bg-panel/60 backdrop-blur-sm animate-in fade-in duration-100">
          <div className="relative group flex items-center">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted group-focus-within:text-accent pointer-events-none transition-colors" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search chat history..."
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

      {/* Messages List */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        onContextMenu={(e) => {
          e.preventDefault();
          const menuWidth = 200;
          const menuHeight = 160;
          const x = Math.min(e.clientX, window.innerWidth - menuWidth - 8);
          const y = Math.min(e.clientY, window.innerHeight - menuHeight - 8);
          setChatContextMenu({ x, y, message: null });
        }}
        className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0 overscroll-contain select-text"
      >
        {displayedMessages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-4 text-muted select-none">
            <MessageSquare className="h-8 w-8 text-muted/30 mb-2" />
            <p className="text-xs font-semibold text-foreground">
              {searchQuery ? "No matching messages" : "No messages yet"}
            </p>
            <p className="text-[11px] text-muted mt-1 max-w-[200px]">
              {searchQuery
                ? "Try searching for a different word or author."
                : "Coordinate with your team, share ideas, or post snippets."}
            </p>
          </div>
        ) : (
          displayedMessages.map((msg, index) => {
            const isSelf = msg.userId === currentUserId;
            const userColor = getUserColor(msg.username);

            const prevMsg = displayedMessages[index - 1];
            const prevTime = prevMsg ? new Date(prevMsg.createdAt).getTime() : 0;
            const currTime = new Date(msg.createdAt).getTime();
            const isSameUserAsPrev =
              prevMsg &&
              prevMsg.userId === msg.userId &&
              !isNaN(prevTime) &&
              !isNaN(currTime) &&
              Math.abs(currTime - prevTime) < 120000;

            return (
              <div
                key={msg.id || index}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const menuWidth = 200;
                  const menuHeight = 220;
                  const x = Math.min(e.clientX, window.innerWidth - menuWidth - 8);
                  const y = Math.min(e.clientY, window.innerHeight - menuHeight - 8);
                  setChatContextMenu({ x, y, message: msg });
                }}
                className={`flex flex-col ${isSelf ? "items-end" : "items-start"} space-y-1`}
              >
                {!isSameUserAsPrev && (
                  <div
                    className={`flex items-center gap-1.5 text-xs select-none max-w-full ${
                      isSelf ? "flex-row-reverse" : "flex-row"
                    }`}
                  >
                    <div
                      style={{
                        backgroundColor: `${userColor}25`,
                        color: userColor,
                        borderColor: `${userColor}50`,
                      }}
                      className="h-5 w-5 rounded-full border text-[9px] font-bold flex items-center justify-center shrink-0 shadow-sm"
                    >
                      {getInitials(msg.username)}
                    </div>
                    <span
                      style={{ color: userColor }}
                      className="font-semibold text-xs truncate max-w-[120px]"
                    >
                      {msg.username}
                    </span>
                    {isSelf && (
                      <span className="text-[9px] text-muted font-normal">(you)</span>
                    )}
                    <span suppressHydrationWarning className="text-[10px] text-muted font-mono">
                      {formatTime(msg.createdAt)}
                    </span>
                  </div>
                )}

                <div
                  className={`max-w-[92%] text-xs leading-relaxed break-words [overflow-wrap:anywhere] shadow-sm ${
                    isSelf
                      ? "bg-accent/15 border border-accent/30 text-foreground rounded-2xl rounded-tr-sm px-3.5 py-2.5"
                      : "bg-panel border border-border/80 text-foreground rounded-2xl rounded-tl-sm px-3.5 py-2.5"
                  }`}
                >
                  <FormattedMessage content={msg.content} />
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Input bar */}
      <div className="p-2.5 border-t border-border bg-panel shrink-0 relative select-none">
        {/* Quick Emoji Bar */}
        {showEmojiPicker && (
          <div
            ref={emojiPickerRef}
            className="absolute bottom-full left-2 right-2 mb-2 p-2 bg-surface border border-border rounded-xl shadow-2xl z-30 flex flex-wrap gap-1.5 animate-in fade-in duration-100"
          >
            {QUICK_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => addEmoji(emoji)}
                className="h-7 w-7 flex items-center justify-center text-sm rounded-lg hover:bg-panel transition-transform hover:scale-110"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        <form onSubmit={handleSend} className="flex items-center gap-1.5">
          {/* Emoji Toggle */}
          <button
            type="button"
            onClick={() => setShowEmojiPicker((prev) => !prev)}
            title="Add emoji"
            className={`p-2 rounded-xl hover:bg-surface-hover text-muted hover:text-foreground transition-colors ${
              showEmojiPicker ? "text-accent bg-surface" : ""
            }`}
          >
            <Smile className="h-4 w-4" />
          </button>

          {/* Quick share active file reference button */}
          {activeFileName && (
            <button
              type="button"
              onClick={handleShareFileReference}
              title={`Reference ${activeFileName}`}
              className="p-2 rounded-xl hover:bg-surface-hover text-muted hover:text-accent transition-colors hidden sm:block"
            >
              <Code2 className="h-4 w-4" />
            </button>
          )}

          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message or ```code```..."
            className="input-base flex-1 px-3.5 py-2 text-xs font-medium text-zinc-100 placeholder:text-zinc-500 select-text transition-all"
          />

          <button
            type="submit"
            disabled={!input.trim()}
            className="p-2 rounded-xl bg-accent hover:bg-accent-hover text-white disabled:opacity-40 transition-all shrink-0 shadow-sm shadow-indigo-500/20 active:scale-95 hover:shadow-indigo-500/30"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>

      {/* Copied Toast */}
      {copiedToast && (
        <div className="absolute bottom-16 left-1/2 -translate-y-1/2 z-50 px-3 py-1.5 rounded-xl bg-[#0e131f] border border-white/15 text-xs text-zinc-100 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-150 flex items-center gap-1.5 pointer-events-none">
          <Check className="h-3.5 w-3.5 text-emerald-400" />
          <span>{copiedToast}</span>
        </div>
      )}

      {/* Chat Right-Click Context Menu */}
      {chatContextMenu && (
        <div
          id="chat-context-menu"
          style={{ top: `${chatContextMenu.y}px`, left: `${chatContextMenu.x}px` }}
          className="fixed z-50 min-w-[190px] p-1.5 rounded-xl bg-[#0e131f]/95 backdrop-blur-xl border border-white/10 shadow-2xl shadow-black/80 select-none animate-in fade-in zoom-in-95 duration-100 text-xs text-zinc-200 divide-y divide-white/5"
          onClick={(e) => e.stopPropagation()}
        >
          {chatContextMenu.message ? (
            <>
              <div className="px-2.5 py-1 text-[10px] font-semibold text-muted truncate">
                Message by {chatContextMenu.message.username}
              </div>
              <div className="py-0.5">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(chatContextMenu.message!.content);
                    setChatContextMenu(null);
                    setCopiedToast("Message copied");
                    setTimeout(() => setCopiedToast(null), 2000);
                  }}
                  className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-indigo-600/20 hover:text-white transition-colors text-left"
                >
                  <Copy className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                  <span>Copy Message</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setInput((prev) =>
                      prev
                        ? `${prev}\n> ${chatContextMenu.message!.content}\n`
                        : `> ${chatContextMenu.message!.content}\n`
                    );
                    setChatContextMenu(null);
                  }}
                  className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-indigo-600/20 hover:text-white transition-colors text-left"
                >
                  <Quote className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                  <span>Quote in Chat</span>
                </button>
              </div>
            </>
          ) : (
            <div className="px-2.5 py-1 text-[10px] font-semibold text-muted">
              Chat Options
            </div>
          )}

          <div className="py-0.5">
            <button
              type="button"
              onClick={() => {
                handleCopyAll();
                setChatContextMenu(null);
              }}
              disabled={messages.length === 0}
              className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-indigo-600/20 hover:text-white disabled:opacity-40 disabled:hover:bg-transparent transition-colors text-left"
            >
              <Copy className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
              <span>Copy All Messages</span>
            </button>
          </div>

          {onClearChat && (
            <div className="py-0.5">
              <button
                type="button"
                onClick={() => {
                  setShowClearConfirm(true);
                  setChatContextMenu(null);
                }}
                disabled={messages.length === 0}
                className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-red-500/20 text-red-400 hover:text-red-300 disabled:opacity-40 disabled:hover:bg-transparent transition-colors text-left font-medium"
              >
                <Trash2 className="h-3.5 w-3.5 shrink-0" />
                <span>Clear Chat</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const RoomChat = memo(RoomChatComponent);
export default RoomChat;
