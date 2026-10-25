import { Loader2 } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";

/**
 * Suspense fallback used while a lazily-loaded route chunk is fetched.
 * Mirrors the legacy Next.js route loading skeleton so the layout does not jump.
 */
export default function RouteLoading() {
  return (
    <div className="flex min-h-dvh-screen flex-col bg-background">
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-xl" />
          <Skeleton className="h-4 w-40" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-24 rounded-lg" />
          <Skeleton className="h-8 w-8 rounded-lg" />
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
        <p className="text-sm text-muted-foreground">Loading CodeRoom...</p>
      </div>

      <div className="flex h-7 items-center gap-4 border-t border-border px-4">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
  );
}
