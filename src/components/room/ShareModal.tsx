"use client";

import { useState, useEffect } from "react";
import { X, Copy, Check, Share2, Wifi } from "lucide-react";

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomCode: string;
  roomName: string;
}

export default function ShareModal({
  isOpen,
  onClose,
  roomCode,
  roomName,
}: ShareModalProps) {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
  }, []);

  if (!isOpen) return null;

  const inviteUrl = `${origin}/room/${roomCode}`;

  const copyCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const copyLink = () => {
    navigator.clipboard.writeText(inviteUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-accent/15 border border-accent/30 text-accent flex items-center justify-center">
              <Share2 className="h-4 w-4" />
            </div>
            <div>
              <h2 className="font-semibold text-base text-foreground">Share Room</h2>
              <p className="text-xs text-muted truncate max-w-[240px]">{roomName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-muted hover:text-foreground p-1 rounded-lg hover:bg-surface-hover transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Room Code */}
          <div>
            <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-2">
              Room Code
            </label>
            <div className="flex items-center gap-2">
              <div className="flex-1 px-4 py-3 rounded-xl bg-panel border border-border font-mono text-center text-xl font-bold tracking-widest text-accent selection:bg-accent/20">
                {roomCode}
              </div>
              <button
                onClick={copyCode}
                className="px-4 py-3 rounded-xl bg-panel hover:bg-surface-hover border border-border text-foreground text-xs font-semibold flex items-center gap-2 transition-colors shrink-0"
              >
                {copiedCode ? (
                  <>
                    <Check className="h-4 w-4 text-green-400" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    <span>Copy Code</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Invite Link */}
          <div>
            <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-2">
              Invite Link
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={inviteUrl}
                className="flex-1 px-3.5 py-2.5 rounded-xl bg-panel border border-border font-mono text-xs text-muted truncate focus:outline-none select-all"
              />
              <button
                onClick={copyLink}
                className="px-4 py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-semibold flex items-center gap-2 transition-colors shrink-0 shadow-sm"
              >
                {copiedLink ? (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>Copy Link</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* LAN and Internet tips */}
          <div className="p-4 rounded-xl bg-panel border border-border space-y-2 text-xs text-muted leading-relaxed">
            <div className="flex items-center gap-2 text-foreground font-medium">
              <Wifi className="h-4 w-4 text-emerald-400 shrink-0" />
              <span>LAN + Internet Collaboration</span>
            </div>
            <p>
              Users on the same local network or connected remotely can join using this link or room code.
            </p>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-surface-hover border border-border text-foreground hover:bg-panel text-xs font-semibold transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
