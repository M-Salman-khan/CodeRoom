import { Loader2 } from "lucide-react";

export default function RoomLoading() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3">
      <Loader2 className="h-8 w-8 animate-spin text-accent" />
      <p className="text-sm text-muted">Entering collaborative room...</p>
    </div>
  );
}
