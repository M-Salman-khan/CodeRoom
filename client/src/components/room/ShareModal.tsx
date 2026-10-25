import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Check,
  Copy,
  Hash,
  Link2,
  Share2,
  ShieldCheck,
} from "lucide-react";

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
import { buildInviteUrl, getAppConfig, type AppConfig } from "@/lib/app-config";

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomCode: string;
  roomName: string;
  /** Canonical URL supplied by the server (preferred over client config). */
  shareUrl?: string | null;
}

export default function ShareModal({
  isOpen,
  onClose,
  roomCode,
  roomName,
  shareUrl,
}: ShareModalProps) {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [config, setConfig] = useState<AppConfig | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    void getAppConfig().then((next) => {
      if (active) setConfig(next);
    });
    return () => {
      active = false;
    };
  }, [isOpen]);

  const canonicalUrl = shareUrl ?? buildInviteUrl(config, roomCode) ?? "";
  const linkReady = Boolean(canonicalUrl);

  const copyCode = () => {
    void navigator.clipboard.writeText(roomCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const copyLink = () => {
    if (!canonicalUrl) return;
    void navigator.clipboard.writeText(canonicalUrl);
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
              <div className="group relative flex-1">
                <Link2 className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-accent" />
                <Input
                  type="text"
                  readOnly
                  value={linkReady ? canonicalUrl : ""}
                  placeholder={
                    config
                      ? "Invite links are not configured"
                      : "Loading server configuration..."
                  }
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                  className="select-all truncate pl-9 font-mono text-xs"
                />
              </div>
              <Button
                onClick={copyLink}
                disabled={!linkReady}
                className="shrink-0"
              >
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

            {config && !linkReady && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-[11px] leading-relaxed text-amber-700 dark:text-amber-200">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <p>
                  Invite links are disabled because this server has no public
                  HTTPS <code>PUBLIC_BASE_URL</code>. Share the room code
                  instead, or ask the administrator to configure the public
                  domain.
                </p>
              </div>
            )}
          </div>

          <div className="flex items-start gap-2.5 rounded-xl border border-border bg-secondary/40 p-4 text-xs leading-relaxed text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
            <div>
              <p className="mb-1 font-medium text-foreground">
                Internet-hosted collaboration
              </p>
              <p>
                Everyone you invite needs a browser and outbound HTTPS access to
                this CodeRoom domain. No software installation or LAN access is
                required. Live editing uses secure WebSockets ({`wss://`}) and
                there is no polling fallback.
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
