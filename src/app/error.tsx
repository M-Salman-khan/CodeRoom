"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertCircle, RefreshCw, Home } from "lucide-react";

export default function GlobalErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global application error caught by boundary:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-4 select-none">
      <div className="max-w-md w-full bg-surface border border-border rounded-2xl p-6 sm:p-8 shadow-2xl text-center">
        <div className="h-12 w-12 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="h-6 w-6" />
        </div>

        <h2 className="text-xl font-bold text-foreground">Something went wrong</h2>
        <p className="text-xs text-muted mt-2 leading-relaxed">
          An unexpected error occurred in the application. You can try refreshing or returning to the home page.
        </p>

        {error?.message && (
          <div className="mt-4 p-2.5 rounded-lg bg-panel border border-border text-[11px] font-mono text-muted text-left overflow-x-auto max-h-24">
            {error.message}
          </div>
        )}

        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-2.5">
          <button
            onClick={() => reset()}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-sm"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Try again
          </button>

          <Link
            href="/"
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-panel hover:bg-panel-header border border-border text-foreground text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
          >
            <Home className="h-3.5 w-3.5 text-muted" />
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}
