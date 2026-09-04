"use client";

import { useEffect, useRef, useState } from "react";
import {
  Send,
  MessageSquare,
  Smile,
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
}

const QUICK_EMOJIS = ["👍", "🚀", "❤️", "🔥", "🎉", "👀", "🙌", "💯"];

export default function RoomChat({
  messages,
  currentUserId,
  onSendMessage,
}: RoomChatProps) {
  const [input, setInput] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages.length]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;

    onSendMessage(trimmed);
    setInput("");
    setShowEmojiPicker(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend(e);
    }
  };

  const addEmoji = (emoji: string) => {
    setInput((prev) => prev + emoji);
    setShowEmojiPicker(false);
  };

  const formatTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
  };

  return (
    <div className="h-full bg-surface border-l border-border flex flex-col overflow-hidden">
      {/* Header */}
      <div className="h-10 px-3 border-b border-border flex items-center justify-between bg-panel-header shrink-0 select-none">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-accent" />
          <span className="text-[11px] font-semibold tracking-wider text-muted uppercase">
            Room Chat
          </span>
        </div>
        <span className="text-[10px] text-muted font-mono">
          {messages.length} messages
        </span>
      </div>

      {/* Messages List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3.5">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-4 text-muted">
            <MessageSquare className="h-8 w-8 text-muted/40 mb-2" />
            <p className="text-xs font-semibold text-foreground">No messages yet</p>
            <p className="text-[11px] text-muted mt-1">
              Start the conversation with your team!
            </p>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isSelf = msg.userId === currentUserId;
            const userColor = getUserColor(msg.username);

            // Group messages by consecutive sender if within 2 minutes
            const prevMsg = messages[index - 1];
            const isSameUserAsPrev =
              prevMsg &&
              prevMsg.userId === msg.userId &&
              Math.abs(new Date(msg.createdAt).getTime() - new Date(prevMsg.createdAt).getTime()) <
                120000;

            return (
              <div key={msg.id} className="space-y-1">
                {!isSameUserAsPrev && (
                  <div className="flex items-center gap-1.5 text-xs select-none">
                    <div
                      style={{ backgroundColor: `${userColor}25`, color: userColor, borderColor: `${userColor}50` }}
                      className="h-5 w-5 rounded-full border text-[9px] font-bold flex items-center justify-center shrink-0"
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
                    <span className="text-[10px] text-muted ml-auto font-mono">
                      {formatTime(msg.createdAt)}
                    </span>
                  </div>
                )}

                <div className={`pl-6 text-xs text-foreground leading-relaxed break-words`}>
                  <p className="bg-panel px-3 py-2 rounded-xl border border-border/60 inline-block max-w-full">
                    {msg.content}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Emoji Picker & Input */}
      <div className="p-2.5 border-t border-border bg-panel shrink-0 relative">
        {/* Quick Emoji Bar */}
        {showEmojiPicker && (
          <div className="absolute bottom-full left-2 right-2 mb-2 p-2 bg-surface border border-border rounded-xl shadow-xl z-20 flex flex-wrap gap-1.5 animate-in fade-in slide-in-from-bottom-2 duration-150">
            {QUICK_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => addEmoji(emoji)}
                className="h-7 w-7 flex items-center justify-center text-sm rounded hover:bg-panel transition-colors"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        <form onSubmit={handleSend} className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            title="Add emoji"
            className={`p-2 rounded-xl hover:bg-surface-hover text-muted hover:text-foreground transition-colors ${
              showEmojiPicker ? "text-accent bg-surface" : ""
            }`}
          >
            <Smile className="h-4 w-4" />
          </button>

          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="flex-1 px-3 py-2 rounded-xl bg-surface border border-border text-foreground placeholder:text-muted/60 text-xs focus:outline-none focus:border-accent transition-colors"
          />

          <button
            type="submit"
            disabled={!input.trim()}
            className="p-2 rounded-xl bg-accent hover:bg-accent-hover text-white disabled:opacity-40 transition-colors shrink-0 shadow-sm"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
