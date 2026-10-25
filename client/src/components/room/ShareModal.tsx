import { useState, useEffect } from "react";
import { Copy, Check, Share2, Wifi, Link2, Hash } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader className="flex-row items-center gap-3 space-y-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-accent/30 bg-accent/15 text-accent">
            <Share2 className="h-4 w-4" />
          </div>
          <div className="min-w-0 space-y-1">
            <DialogTitle>Share Room</DialogTitle>
            <DialogDescription className="truncate">
              {roomName}
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label>Room Code</Label>
            <div className="flex items-center gap-2">
              <div className="relative flex flex-1 items-center justify-center rounded-xl border border-border bg-secondary/40 px-4 py-3 shadow-inner">
                <Hash className="pointer-events-none absolute left-3.5 h-4 w-4 text-accent" />
                <span className="select-all text-center font-mono text-xl font-bold tracking-[0.3em] text-accent">
                  {roomCode}
                </span>
              </div>
              <Button
                variant="outline"
                onClick={copyCode}
                className="h-[46px] shrink-0"
              >
                {copiedCode ? (
                  <>
                    <Check className="h-4 w-4 text-emerald-400" />
                    <span className="text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    <span className="hidden sm:inline">Copy</span>
                  </>
                )}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Invite Link</Label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1 group">
                <Link2 className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-accent" />
                <Input
                  type="text"
                  readOnly
                  value={inviteUrl}
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                  className="select-all truncate pl-9 font-mono text-xs"
                />
              </div>
              <Button onClick={copyLink} className="shrink-0">
                {copiedLink ? (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </Button>
            </div>
          </div>

          <div className="flex items-start gap-2.5 rounded-xl border border-border bg-secondary/40 p-4 text-xs leading-relaxed text-muted-foreground">
            <Wifi className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
            <div>
              <p className="mb-1 font-medium text-foreground">
                LAN + Internet Collaboration
              </p>
              <p>
                Users on the same local network or connected remotely can join
                using this link or room code.
              </p>
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <Button variant="secondary" onClick={onClose}>
              Done
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
