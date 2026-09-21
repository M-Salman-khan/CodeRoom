"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Code2,
  ArrowRight,
  Plus,
  LogIn,
  Terminal,
  ShieldCheck,
  Sparkles,
  Zap,
  Database,
  Copy,
  Check,
  ChevronRight,
  Play,
  MessageSquare,
  FileCode2,
} from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";

interface DemoSnippet {
  fileName: string;
  lang: string;
  code: string;
  terminalOutput: string;
}

const DEMO_SNIPPETS: Record<string, DemoSnippet> = {
  "main.ts": {
    fileName: "main.ts",
    lang: "typescript",
    code: `import { createRoom, type Peer } from "coderoom";

// Initialize collaborative CRDT synchronization
const room = createRoom({ id: "DEMO-8821" });

room.on("peer:join", (peer: Peer) => {
  console.log(\`✨ Welcome \${peer.username} to CodeRoom!\`);
  room.broadcast("Presence synced across distributed network.");
});

// Real-time collaborative state update
export async function runDistributedTask() {
  const result = await room.execute({ timeoutMs: 2500 });
  return { status: "success", timestamp: Date.now() };
}`,
    terminalOutput: `[info] Connected to ws://localhost:3000/yjs\n[sync] CRDT document synchronized in 8ms\n[exec] ✨ Welcome Sarah to CodeRoom!\n[exit] Exit code 0 (14ms) • All tests passed`,
  },
  "server.py": {
    fileName: "server.py",
    lang: "python",
    code: `import asyncio
from coderoom import CollaborativeEngine

async def main():
    engine = CollaborativeEngine(room_id="DEMO-8821")
    print(f"🚀 Initializing real-time runner mutex...")
    
    # Synchronized single-runner execution
    async with engine.acquire_lock():
        status = await engine.verify_integrity()
        print(f"✅ Sync verified: {status['online_users']} active peers")

if __name__ == "__main__":
    asyncio.run(main())`,
    terminalOutput: `🚀 Initializing real-time runner mutex...\n✅ Sync verified: 4 active peers\n[exit] Program executed successfully (21ms)`,
  },
  "Main.java": {
    fileName: "Main.java",
    lang: "java",
    code: `public class Main {
    public static void main(String[] args) {
        System.out.println("☕ Java 21 live in CodeRoom!");
        
        // Multi-peer synchronized execution
        int activeCollaborators = 4;
        System.out.println("Status: Real-time peer sync verified");
        System.out.println("Collaborators active: " + activeCollaborators);
    }
}`,
    terminalOutput: `☕ Java 21 live in CodeRoom!\nStatus: Real-time peer sync verified\nCollaborators active: 4\n[exit] Process finished with exit code 0 (24ms)`,
  },
  "README.md": {
    fileName: "README.md",
    lang: "markdown",
    code: `# CodeRoom 2.0 🚀

A lightning-fast collaborative coding room built for teams, classmates, and friends.

### Highlights
- ⚡ **Zero Setup**: Create a room in 1 click and share the 6-character code.
- 🔄 **Yjs CRDT Synchronization**: Sub-millisecond peer editing with remote cursor presence.
- 🛡️ **Granular Access Control**: Admin approval workflows for file editing.
- 💻 **Sandboxed Multi-Language Execution**: Run Java, Python, TypeScript, JavaScript, C++, and Bash with single-runner mutex locking.`,
    terminalOutput: `[docs] Markdown parsed cleanly\n[status] 4 collaborators currently editing`,
  },
};

export default function LandingPage() {
  const [user, setUser] = useState<{ id: string; username: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"main.ts" | "server.py" | "Main.java" | "README.md">("main.ts");
  const [copiedCode, setCopiedCode] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => {
        if (res.ok) return res.json();
        return { user: null };
      })
      .then((data) => {
        if (data?.user) setUser(data.user);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleCopyDemoCode = () => {
    navigator.clipboard.writeText(DEMO_SNIPPETS[activeTab].code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col relative selection:bg-accent/30 selection:text-white">
      {/* Ambient background mesh glow */}
      <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[800px] sm:w-[1100px] h-[500px] bg-gradient-to-b from-accent/20 via-purple-600/10 to-transparent blur-[120px] rounded-full opacity-70" />
        <div className="absolute top-[40%] right-[-10%] w-[500px] h-[500px] bg-blue-600/10 blur-[140px] rounded-full opacity-50" />
        <div className="absolute top-[60%] left-[-10%] w-[500px] h-[500px] bg-purple-600/10 blur-[140px] rounded-full opacity-50" />
      </div>

      {/* Navigation Bar */}
      <header className="border-b border-border/70 bg-background/80 backdrop-blur-xl sticky top-0 z-50 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center shadow-lg shadow-indigo-500/25 group-hover:scale-105 transition-transform">
              <Code2 className="h-5 w-5" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-lg tracking-tight text-foreground">
                Code<span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400">Room</span>
              </span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-accent/15 border border-accent/30 text-indigo-300 ml-1">
                v2.0
              </span>
            </div>
          </Link>

          {/* Center Links */}
          <nav className="hidden md:flex items-center gap-7 text-xs font-medium text-muted">
            <a href="#demo" className="hover:text-foreground transition-colors">
              Live Preview
            </a>
            <a href="#features" className="hover:text-foreground transition-colors">
              Features
            </a>
            <a href="#how-it-works" className="hover:text-foreground transition-colors">
              How It Works
            </a>
            <a href="#security" className="hover:text-foreground transition-colors">
              Architecture
            </a>
          </nav>

          {/* Right Action buttons */}
          <div className="flex items-center gap-3">
            <ThemeToggle />
            {!loading && user ? (
              <Link
                href="/dashboard"
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white text-xs sm:text-sm font-semibold transition-all shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:scale-[1.02]"
              >
                <span>Dashboard</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold text-muted hover:text-foreground transition-colors hover:bg-surface/80 border border-transparent hover:border-border"
                >
                  Sign In
                </Link>
                <Link
                  href="/register"
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white text-xs sm:text-sm font-semibold transition-all shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:scale-[1.02]"
                >
                  Get Started Free
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative pt-16 pb-20 md:pt-24 md:pb-28">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            {/* Glowing Tag Pill */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-surface/90 border border-indigo-500/30 text-xs font-medium text-indigo-300 mb-8 shadow-sm backdrop-blur-md">
              <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
              <span className="font-semibold">Next-Gen Collaborative IDE</span>
              <span className="text-muted/60">&bull;</span>
              <span className="text-muted hover:text-white transition-colors">
                Multi-User CRDTs & Execution
              </span>
            </div>

            {/* Main Headline */}
            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.1] text-balance">
              Code together.{" "}
              <span className="block mt-1 sm:mt-2 text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 via-purple-300 to-pink-400">
                At the speed of thought.
              </span>
            </h1>

            {/* Subtitle */}
            <p className="mt-6 text-base sm:text-lg lg:text-xl text-muted max-w-2xl mx-auto leading-relaxed text-balance">
              Instant collaborative programming powered by <strong>Yjs CRDTs</strong>. Run code in multi-language sandboxes, chat in real-time, manage file permissions, and debug with AI &mdash; zero cloud dependencies.
            </p>

            {/* Action CTA Buttons */}
            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <Link
                href={user ? "/dashboard?action=create" : "/register"}
                className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white text-sm sm:text-base font-semibold transition-all shadow-xl shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:scale-[1.02] active:scale-[0.98]"
              >
                <Plus className="h-5 w-5" />
                <span>Create a Free Room</span>
              </Link>

              <Link
                href={user ? "/dashboard?action=join" : "/login?redirect=/dashboard"}
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-surface/90 hover:bg-surface border border-border/80 hover:border-indigo-500/40 text-foreground text-sm sm:text-base font-semibold transition-all hover:scale-[1.02] active:scale-[0.98] shadow-sm backdrop-blur-md"
              >
                <LogIn className="h-5 w-5 text-indigo-400" />
                <span>Join with Room Code</span>
              </Link>
            </div>

            {/* Feature Highlights Pills */}
            <div className="mt-12 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-xs text-muted font-medium">
              <div className="flex items-center gap-1.5">
                <Zap className="h-4 w-4 text-amber-400" />
                <span>&lt; 15ms CRDT Synchronization</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Play className="h-4 w-4 text-emerald-400" />
                <span>Python, JS, TS, C++, Bash Execution</span>
              </div>
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-indigo-400" />
                <span>Granular Permission Access</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-purple-400" />
                <span>AI Error Diagnosis & Review</span>
              </div>
            </div>

            {/* Interactive Live Mockup */}
            <div id="demo" className="mt-16 max-w-5xl mx-auto rounded-2xl border border-indigo-500/20 bg-surface/70 shadow-2xl shadow-indigo-950/40 overflow-hidden text-left backdrop-blur-md">
              {/* Window Title Bar */}
              <div className="h-11 bg-panel-header/90 border-b border-border/80 flex items-center justify-between px-4 select-none">
                <div className="flex items-center gap-2.5">
                  <div className="flex items-center gap-1.5">
                    <div className="h-3 w-3 rounded-full bg-[#ff5f56] shadow-sm" />
                    <div className="h-3 w-3 rounded-full bg-[#ffbd2e] shadow-sm" />
                    <div className="h-3 w-3 rounded-full bg-[#27c93f] shadow-sm" />
                  </div>

                  <div className="h-4 w-[1px] bg-border ml-1 mr-2 hidden sm:block" />

                  {/* Room Tag */}
                  <span className="text-xs font-mono font-semibold text-foreground/90">
                    ROOM #CR-8821
                  </span>
                  <span className="hidden sm:inline-flex text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    Live Session
                  </span>
                </div>

                {/* Right mockup window details */}
                <div className="flex items-center gap-3">
                  <div className="flex items-center -space-x-1.5">
                    {["#3B82F6", "#8B5CF6", "#10B981", "#F59E0B"].map((col, idx) => (
                      <div
                        key={idx}
                        style={{ backgroundColor: `${col}25`, borderColor: col }}
                        className="h-5 w-5 rounded-full border text-[9px] font-bold text-white flex items-center justify-center shadow-sm"
                      >
                        {["SK", "AL", "SR", "LM"][idx]}
                      </div>
                    ))}
                    <span className="pl-2 text-xs font-medium text-emerald-400 hidden sm:inline">
                      4 Online
                    </span>
                  </div>
                </div>
              </div>

              {/* Tabs Bar */}
              <div className="h-9 bg-panel border-b border-border/70 flex items-center justify-between px-3">
                <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                  {(["main.ts", "server.py", "Main.java", "README.md"] as const).map((tab) => {
                    const isActive = activeTab === tab;
                    return (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`flex items-center gap-2 px-3 py-1 rounded-md text-xs font-mono transition-all ${
                          isActive
                            ? "bg-surface text-foreground font-semibold border-b-2 border-accent shadow-sm"
                            : "text-muted hover:text-foreground hover:bg-surface/50"
                        }`}
                      >
                        <FileCode2 className="h-3.5 w-3.5 text-accent" />
                        <span>{tab}</span>
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={handleCopyDemoCode}
                  title="Copy code"
                  className="flex items-center gap-1 text-[11px] text-muted hover:text-foreground transition-colors px-2 py-0.5 rounded hover:bg-surface"
                >
                  {copiedCode ? (
                    <>
                      <Check className="h-3 w-3 text-emerald-400" />
                      <span className="text-emerald-400 font-medium">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>

              {/* 3-Panel IDE Content */}
              <div className="grid grid-cols-1 md:grid-cols-12 h-80 sm:h-96 font-mono text-xs overflow-hidden">
                {/* Left File Tree preview */}
                <div className="hidden md:block md:col-span-3 border-r border-border/70 bg-surface/40 p-3.5 space-y-1.5 select-none font-sans">
                  <div className="text-[10px] font-bold tracking-wider uppercase text-muted mb-2">
                    Files Explorer
                  </div>
                  <div
                    onClick={() => setActiveTab("main.ts")}
                    className={`flex items-center justify-between py-1.5 px-2 rounded-lg cursor-pointer transition-colors ${
                      activeTab === "main.ts"
                        ? "bg-accent/15 text-accent font-semibold"
                        : "text-muted hover:text-foreground hover:bg-surface/60"
                    }`}
                  >
                    <div className="flex items-center gap-2 text-xs">
                      <span className="h-4 w-4 rounded bg-blue-500/20 text-blue-400 font-bold text-[9px] flex items-center justify-center">
                        TS
                      </span>
                      <span>main.ts</span>
                    </div>
                    <span className="text-[9px] text-emerald-400 font-mono">edited</span>
                  </div>

                  <div
                    onClick={() => setActiveTab("server.py")}
                    className={`flex items-center justify-between py-1.5 px-2 rounded-lg cursor-pointer transition-colors ${
                      activeTab === "server.py"
                        ? "bg-accent/15 text-accent font-semibold"
                        : "text-muted hover:text-foreground hover:bg-surface/60"
                    }`}
                  >
                    <div className="flex items-center gap-2 text-xs">
                      <span className="h-4 w-4 rounded bg-emerald-500/20 text-emerald-400 font-bold text-[9px] flex items-center justify-center">
                        PY
                      </span>
                      <span>server.py</span>
                    </div>
                  </div>

                  <div
                    onClick={() => setActiveTab("Main.java")}
                    className={`flex items-center justify-between py-1.5 px-2 rounded-lg cursor-pointer transition-colors ${
                      activeTab === "Main.java"
                        ? "bg-accent/15 text-accent font-semibold"
                        : "text-muted hover:text-foreground hover:bg-surface/60"
                    }`}
                  >
                    <div className="flex items-center gap-2 text-xs">
                      <span className="h-4 w-4 rounded bg-amber-600/20 text-amber-400 font-bold text-[9px] flex items-center justify-center">
                        JV
                      </span>
                      <span>Main.java</span>
                    </div>
                  </div>

                  <div
                    onClick={() => setActiveTab("README.md")}
                    className={`flex items-center justify-between py-1.5 px-2 rounded-lg cursor-pointer transition-colors ${
                      activeTab === "README.md"
                        ? "bg-accent/15 text-accent font-semibold"
                        : "text-muted hover:text-foreground hover:bg-surface/60"
                    }`}
                  >
                    <div className="flex items-center gap-2 text-xs">
                      <span className="h-4 w-4 rounded bg-purple-500/20 text-purple-400 font-bold text-[9px] flex items-center justify-center">
                        MD
                      </span>
                      <span>README.md</span>
                    </div>
                  </div>
                </div>

                {/* Center Editor canvas */}
                <div className="col-span-12 md:col-span-6 bg-panel p-4 flex flex-col justify-between overflow-hidden">
                  <pre className="text-foreground/90 whitespace-pre-wrap leading-relaxed text-xs overflow-y-auto selection:bg-accent/30 font-mono">
                    {DEMO_SNIPPETS[activeTab].code}
                  </pre>

                  {/* Remote Cursor indicators */}
                  <div className="pt-2 border-t border-border/50 flex items-center justify-between text-[10px] text-muted select-none">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                      <span className="text-blue-400 font-semibold">Salman (Ln 12)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-purple-500 animate-pulse" />
                      <span className="text-purple-400 font-semibold">Sarah (Ln 8)</span>
                    </div>
                    <span className="text-emerald-400">CRDT Synced</span>
                  </div>
                </div>

                {/* Right Chat & Output preview */}
                <div className="hidden md:flex md:col-span-3 border-l border-border/70 bg-surface/30 flex-col font-sans">
                  {/* Top Chat snippet */}
                  <div className="p-3 border-b border-border/60 flex-1 overflow-y-auto space-y-2.5">
                    <div className="text-[10px] font-bold tracking-wider uppercase text-muted mb-1">
                      Live Room Chat
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-[11px]">
                        <span className="font-semibold text-blue-400">Salman</span>
                        <span className="text-[9px] text-muted">10:45 AM</span>
                      </div>
                      <div className="text-[11px] text-foreground bg-surface p-2 rounded-xl border border-border/60">
                        Added the WebSocket reconnect handler 🚀
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-[11px]">
                        <span className="font-semibold text-purple-400">Sarah</span>
                        <span className="text-[9px] text-muted">10:46 AM</span>
                      </div>
                      <div className="text-[11px] text-foreground bg-surface p-2 rounded-xl border border-border/60">
                        Tests passing on my end! Ready to execute.
                      </div>
                    </div>
                  </div>

                  {/* Bottom Console Output snippet */}
                  <div className="p-2.5 bg-panel border-t border-border/80 font-mono text-[10px] leading-relaxed">
                    <div className="flex items-center justify-between text-muted mb-1 select-none">
                      <div className="flex items-center gap-1 text-accent">
                        <Terminal className="h-3 w-3" />
                        <span className="font-bold uppercase">Terminal</span>
                      </div>
                      <span className="text-emerald-400 font-semibold">Exit 0</span>
                    </div>
                    <div className="text-emerald-400/90 whitespace-pre leading-normal">
                      {DEMO_SNIPPETS[activeTab].terminalOutput}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Feature Grid: Engineered for Engineers */}
        <section id="features" className="py-24 border-t border-border/60 relative">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/10 border border-accent/20 text-accent text-xs font-semibold uppercase tracking-wider mb-3">
                Features
              </div>
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
                Everything you need to code together seamlessly
              </h2>
              <p className="mt-3 text-muted text-sm sm:text-base leading-relaxed">
                CodeRoom combines the fidelity of Monaco with CRDT synchronization and sandboxed execution.
              </p>
            </div>

            {/* Bento Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Feature 1 */}
              <div className="glass-card glass-card-hover rounded-2xl p-6 sm:p-7 flex flex-col justify-between">
                <div>
                  <div className="h-11 w-11 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 flex items-center justify-center mb-5 shadow-sm">
                    <Zap className="h-5 w-5" />
                  </div>
                  <h3 className="text-lg font-bold text-foreground">Real-Time CRDT Sync</h3>
                  <p className="mt-2 text-sm text-muted leading-relaxed">
                    Powered by Yjs CRDTs over optimized WebSockets. Simultaneous edits merge deterministically without race conditions or merge conflicts.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-border/60 flex items-center gap-2 text-xs font-semibold text-indigo-400">
                  <span>Conflict-free editing</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </div>
              </div>

              {/* Feature 2 */}
              <div className="glass-card glass-card-hover rounded-2xl p-6 sm:p-7 flex flex-col justify-between">
                <div>
                  <div className="h-11 w-11 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mb-5 shadow-sm">
                    <Play className="h-5 w-5 fill-current" />
                  </div>
                  <h3 className="text-lg font-bold text-foreground">Sandboxed Code Execution</h3>
                  <p className="mt-2 text-sm text-muted leading-relaxed">
                    Execute Java 21, Python, TypeScript, JavaScript, C, C++, and Bash directly in the room. A distributed mutex ensures only one user runs code at a time.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-border/60 flex items-center gap-2 text-xs font-semibold text-emerald-400">
                  <span>Single-runner mutex locking</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </div>
              </div>

              {/* Feature 3 */}
              <div className="glass-card glass-card-hover rounded-2xl p-6 sm:p-7 flex flex-col justify-between">
                <div>
                  <div className="h-11 w-11 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-400 flex items-center justify-center mb-5 shadow-sm">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <h3 className="text-lg font-bold text-foreground">AI Review & 1-Click Fix</h3>
                  <p className="mt-2 text-sm text-muted leading-relaxed">
                    When code errors occur, AI explains the stack trace, identifies the line of error, and suggests a fix that you can apply with one click.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-border/60 flex items-center gap-2 text-xs font-semibold text-purple-400">
                  <span>Automated code diagnosis</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </div>
              </div>

              {/* Feature 4 */}
              <div className="glass-card glass-card-hover rounded-2xl p-6 sm:p-7 flex flex-col justify-between">
                <div>
                  <div className="h-11 w-11 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center mb-5 shadow-sm">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <h3 className="text-lg font-bold text-foreground">Granular Access Control</h3>
                  <p className="mt-2 text-sm text-muted leading-relaxed">
                    New members join as read-only viewers. With real-time permission requests, room admins can grant edit rights per file or for the entire room.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-border/60 flex items-center gap-2 text-xs font-semibold text-amber-400">
                  <span>Protected collaboration</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </div>
              </div>

              {/* Feature 5 */}
              <div className="glass-card glass-card-hover rounded-2xl p-6 sm:p-7 flex flex-col justify-between">
                <div>
                  <div className="h-11 w-11 rounded-xl bg-sky-500/15 border border-sky-500/30 text-sky-400 flex items-center justify-center mb-5 shadow-sm">
                    <MessageSquare className="h-5 w-5" />
                  </div>
                  <h3 className="text-lg font-bold text-foreground">Markdown Chat & Snippets</h3>
                  <p className="mt-2 text-sm text-muted leading-relaxed">
                    Chat with your team with syntax-highlighted code blocks, 1-click snippet copy, emoji reactions, and persistent conversation history.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-border/60 flex items-center gap-2 text-xs font-semibold text-sky-400">
                  <span>In-context discussions</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </div>
              </div>

              {/* Feature 6 */}
              <div className="glass-card glass-card-hover rounded-2xl p-6 sm:p-7 flex flex-col justify-between">
                <div>
                  <div className="h-11 w-11 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center mb-5 shadow-sm">
                    <Database className="h-5 w-5" />
                  </div>
                  <h3 className="text-lg font-bold text-foreground">Self-Hosted & 100% Private</h3>
                  <p className="mt-2 text-sm text-muted leading-relaxed">
                    Runs locally on Wi-Fi or behind your company reverse proxy. Zero telemetry, zero external cloud dependencies. Your code stays yours.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-border/60 flex items-center gap-2 text-xs font-semibold text-rose-400">
                  <span>Total data sovereignty</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section id="how-it-works" className="py-20 border-t border-border/60 bg-surface/30">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/10 border border-accent/20 text-accent text-xs font-semibold uppercase tracking-wider mb-3">
              Workflow
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
              Start collaborating in seconds
            </h2>
            <p className="mt-2 text-muted text-sm sm:text-base max-w-xl mx-auto">
              No complex git branches, no screen sharing lag, no environment installation headaches.
            </p>

            <div className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
              <div className="p-6 rounded-2xl bg-surface border border-border/80 relative">
                <div className="h-8 w-8 rounded-lg bg-accent/20 text-accent font-mono font-bold text-sm flex items-center justify-center mb-4">
                  01
                </div>
                <h3 className="font-bold text-base text-foreground">Create or Join</h3>
                <p className="text-xs text-muted mt-2 leading-relaxed">
                  Start a new room with a custom project template or enter a 6-character room code to join an ongoing session.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-surface border border-border/80 relative">
                <div className="h-8 w-8 rounded-lg bg-purple-500/20 text-purple-400 font-mono font-bold text-sm flex items-center justify-center mb-4">
                  02
                </div>
                <h3 className="font-bold text-base text-foreground">Code Simultaneously</h3>
                <p className="text-xs text-muted mt-2 leading-relaxed">
                  Type together in real time with remote cursors, file tree navigation, tabs, and word-wrap preferences.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-surface border border-border/80 relative">
                <div className="h-8 w-8 rounded-lg bg-emerald-500/20 text-emerald-400 font-mono font-bold text-sm flex items-center justify-center mb-4">
                  03
                </div>
                <h3 className="font-bold text-base text-foreground">Execute & Debug</h3>
                <p className="text-xs text-muted mt-2 leading-relaxed">
                  Run the program with one keystroke (`Ctrl+Enter`), inspect real console output, and diagnose errors with AI.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Bottom Call to Action Section */}
        <section className="py-20 relative overflow-hidden">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
            <div className="p-8 sm:p-12 rounded-3xl bg-gradient-to-b from-indigo-950/60 to-surface border border-indigo-500/30 shadow-2xl relative overflow-hidden backdrop-blur-xl">
              <div className="absolute -top-24 -left-24 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />

              <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-balance">
                Ready to transform how your team codes together?
              </h2>
              <p className="mt-4 text-sm sm:text-base text-muted max-w-xl mx-auto leading-relaxed">
                Launch a room now and invite your peers with a single link. No downloads or credit card required.
              </p>

              <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
                <Link
                  href={user ? "/dashboard?action=create" : "/register"}
                  className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white text-sm font-semibold transition-all shadow-xl shadow-indigo-500/30 hover:scale-[1.02]"
                >
                  Create Collaborative Room
                </Link>
                <Link
                  href="/login"
                  className="px-6 py-3.5 rounded-xl bg-surface hover:bg-surface-hover border border-border text-foreground text-sm font-semibold transition-all"
                >
                  Log In
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/70 bg-surface/50 py-10 text-xs text-muted">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-accent/20 text-accent flex items-center justify-center">
              <Code2 className="h-4 w-4" />
            </div>
            <span className="font-bold text-foreground">CodeRoom</span>
            <span>&mdash;</span>
            <span>Collaborative coding for developers everywhere.</span>
          </div>

          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="hover:text-foreground transition-colors">
              Dashboard
            </Link>
            <Link href="/login" className="hover:text-foreground transition-colors">
              Sign In
            </Link>
            <Link href="/register" className="hover:text-foreground transition-colors">
              Register
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
