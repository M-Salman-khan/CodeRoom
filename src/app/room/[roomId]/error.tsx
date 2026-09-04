"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

export default function RoomErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Room client error caught by boundary:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-4 select-none">
      <div className="max-w-md w-full bg-panel border border-border rounded-2xl p-6 shadow-2xl text-center">
        <div className="h-12 w-12 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="h-6 w-6" />
        </div>

        <h2 className="text-lg font-bold text-foreground">Room Connection Issue</h2>
        <p className="text-xs text-muted mt-2 leading-relaxed">
          An unexpected issue occurred while rendering the collaborative editor. Your files and code on the server are safe.
        </p>

        {error?.message && (
          <div className="mt-4 p-2.5 rounded-lg bg-surface border border-border text-[11px] font-mono text-muted text-left overflow-x-auto max-h-24">
            {error.message}
          </div>
        )}

        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-2">
          <button
            onClick={() => reset()}
            className="w-full sm:w-auto px-4 py-2 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-sm"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Try Reconnecting
          </button>

          <Link
            href="/dashboard"
            className="w-full sm:w-auto px-4 py-2 rounded-xl bg-surface hover:bg-surface-hover border border-border text-foreground text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
          >
            <Home className="h-3.5 w-3.5 text-muted" />
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
