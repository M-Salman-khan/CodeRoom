import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
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
  Menu,
  X,
} from "lucide-react";

import ThemeToggle from "@/components/ThemeToggle";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Card,
  CardFooter,
} from "@/components/ui/card";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

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

const FEATURES = [
  {
    icon: Zap,
    title: "Real-Time CRDT Sync",
    description:
      "Powered by Yjs CRDTs over optimized WebSockets. Simultaneous edits merge deterministically without race conditions or merge conflicts.",
    footer: "Conflict-free editing",
    tone: "text-foreground bg-secondary border-border",
    footerTone: "text-muted-foreground",
  },
  {
    icon: Play,
    title: "Sandboxed Code Execution",
    description:
      "Execute Java 21, Python, TypeScript, JavaScript, C, C++, and Bash directly in the room. A distributed mutex ensures only one user runs code at a time.",
    footer: "Single-runner mutex locking",
    tone: "text-foreground bg-secondary border-border",
    footerTone: "text-muted-foreground",
  },
  {
    icon: Sparkles,
    title: "AI Review & 1-Click Fix",
    description:
      "When code errors occur, AI explains the stack trace, identifies the line of error, and suggests a fix that you can apply with one click.",
    footer: "Automated code diagnosis",
    tone: "text-foreground bg-secondary border-border",
    footerTone: "text-muted-foreground",
  },
  {
    icon: ShieldCheck,
    title: "Granular Access Control",
    description:
      "New members join as read-only viewers. With real-time permission requests, room admins can grant edit rights per file or for the entire room.",
    footer: "Protected collaboration",
    tone: "text-foreground bg-secondary border-border",
    footerTone: "text-muted-foreground",
  },
  {
    icon: MessageSquare,
    title: "Markdown Chat & Snippets",
    description:
      "Chat with your team with syntax-highlighted code blocks, 1-click snippet copy, emoji reactions, and persistent conversation history.",
    footer: "In-context discussions",
    tone: "text-foreground bg-secondary border-border",
    footerTone: "text-muted-foreground",
  },
  {
    icon: Database,
    title: "Self-Hosted & 100% Private",
    description:
      "Runs locally on Wi-Fi or behind your company reverse proxy. Zero telemetry, zero external cloud dependencies. Your code stays yours.",
    footer: "Total data sovereignty",
    tone: "text-foreground bg-secondary border-border",
    footerTone: "text-muted-foreground",
  },
];

const NAV_LINKS = [
  { href: "#demo", label: "Live Preview" },
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "How It Works" },
  { href: "#security", label: "Architecture" },
];

export default function LandingPage() {
  const [user, setUser] = useState<{ id: string; username: string } | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    "main.ts" | "server.py" | "Main.java" | "README.md"
  >("main.ts");
  const [copiedCode, setCopiedCode] = useState(false);
  const [demoView, setDemoView] = useState<"code" | "chat" | "terminal">("code");

  useEffect(() => {
    apiFetch("/api/auth/me")
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
    <div className="relative flex min-h-dvh-screen flex-col bg-background text-foreground selection:bg-accent/30">
      {/* Ambient background */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute left-1/2 top-[-20%] h-[600px] w-[1100px] -translate-x-1/2 rounded-full bg-foreground/[0.035] blur-[140px]" />
      </div>

      {/* Navigation */}
      <header className="sticky top-0 z-50 border-b border-border/70 bg-background/80 backdrop-blur-xl transition-all">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" className="group flex shrink-0 items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-foreground text-background shadow-sm transition-transform group-hover:scale-105 sm:h-9 sm:w-9">
              <Code2 className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-base font-bold tracking-tight text-foreground sm:text-lg">
                Code
                <span className="text-muted-foreground">
                  Room
                </span>
              </span>
              <Badge variant="accent" className="uppercase tracking-wider">
                v2.0
              </Badge>
            </div>
          </Link>

          <nav className="hidden items-center gap-7 text-xs font-medium text-muted-foreground md:flex">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="transition-colors hover:text-foreground"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeToggle compact />
            {!loading && user ? (
              <Button asChild>
                <Link to="/dashboard">
                  <span>Dashboard</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            ) : (
              <div className="hidden items-center gap-2 sm:flex">
                <Button asChild variant="ghost">
                  <Link to="/login">Sign In</Link>
                </Button>
                <Button asChild>
                  <Link to="/register">Get Started</Link>
                </Button>
              </div>
            )}

            {/* Mobile menu */}
            <Sheet>
              <SheetTrigger asChild>
                <Button
                  variant="outline"
                  size="icon-sm"
                  className="bg-surface md:hidden"
                  aria-label="Open navigation menu"
                >
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-72 p-0">
                <SheetHeader className="border-b border-border text-left">
                  <SheetTitle className="flex items-center gap-2">
                    <X className="hidden" />
                    <Button
                      asChild
                      variant="ghost"
                      size="icon-sm"
                      className="pointer-events-none -ml-2"
                    >
                      <span>
                        <Code2 className="h-4 w-4 text-accent" />
                      </span>
                    </Button>
                    Navigation
                  </SheetTitle>
                </SheetHeader>
                <nav className="flex flex-col gap-1.5 p-4">
                  {NAV_LINKS.map((link) => (
                    <SheetClose asChild key={link.href}>
                      <Button
                        asChild
                        variant="ghost"
                        className="w-full justify-start"
                      >
                        <a href={link.href}>{link.label}</a>
                      </Button>
                    </SheetClose>
                  ))}
                </nav>
                <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2 border-t border-border p-4">
                  {!loading && user ? (
                    <Button asChild>
                      <Link to="/dashboard">
                        <span>Go to Dashboard</span>
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  ) : (
                    <>
                      <Button asChild variant="outline">
                        <Link to="/login">Sign In</Link>
                      </Button>
                      <Button asChild>
                        <Link to="/register">Get Started Free</Link>
                      </Button>
                    </>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="relative pb-20 pt-16 md:pb-28 md:pt-24">
          <div className="mx-auto max-w-6xl px-4 text-center sm:px-6 lg:px-8">
            <Badge
              variant="outline"
              className="mb-8 gap-2 border-border bg-surface/90 px-3.5 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur-md"
            >
              <span className="flex h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
              <span className="font-semibold">Next-Gen Collaborative IDE</span>
              <span className="text-muted-foreground/60">&bull;</span>
              <span className="text-muted-foreground">
                Multi-User CRDTs &amp; Execution
              </span>
            </Badge>

            <h1 className="text-balance text-3xl font-extrabold leading-[1.15] tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
              Code together.{" "}
              <span className="mt-1 block text-muted-foreground sm:mt-2">
                At the speed of thought.
              </span>
            </h1>

            <p className="mx-auto mt-5 max-w-2xl text-balance text-sm leading-relaxed text-muted-foreground sm:mt-6 sm:text-lg lg:text-xl">
              Instant collaborative programming powered by{" "}
              <strong className="text-foreground">Yjs CRDTs</strong>. Run code
              in multi-language sandboxes, chat in real-time, manage file
              permissions, and debug with AI &mdash; zero cloud dependencies.
            </p>

            <div className="mx-auto mt-8 flex w-full max-w-md flex-col items-center justify-center gap-3 sm:mt-10 sm:max-w-none sm:flex-row sm:gap-4">
              <Button
                asChild
                size="lg"
                className="w-full px-6 sm:w-auto"
              >
                <Link to={user ? "/dashboard?action=create" : "/register"}>
                  <Plus className="h-5 w-5" />
                  <span>Create a Free Room</span>
                </Link>
              </Button>

              <Button
                asChild
                size="lg"
                variant="outline"
                className="w-full bg-surface/90 px-6 backdrop-blur-md sm:w-auto"
              >
                <Link
                  to={user ? "/dashboard?action=join" : "/login?redirect=/dashboard"}
                >
                  <LogIn className="h-5 w-5 text-muted-foreground" />
                  <span>Join with Room Code</span>
                </Link>
              </Button>
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-xs font-medium text-muted-foreground sm:mt-12">
              {[
                { icon: Zap, tone: "text-muted-foreground", label: "< 15ms CRDT Synchronization" },
                {
                  icon: Play,
                  tone: "text-muted-foreground",
                  label: "Python, JS, TS, C++, Bash Execution",
                },
                {
                  icon: ShieldCheck,
                  tone: "text-muted-foreground",
                  label: "Granular Permission Access",
                },
                {
                  icon: Sparkles,
                  tone: "text-muted-foreground",
                  label: "AI Error Diagnosis & Review",
                },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-1.5">
                  <item.icon className={cn("h-4 w-4 shrink-0", item.tone)} />
                  <span>{item.label}</span>
                </div>
              ))}
            </div>

            {/* Interactive mockup */}
            <div
              id="demo"
              className="mx-auto mt-12 max-w-5xl overflow-hidden rounded-2xl border border-border bg-surface/70 text-left shadow-sm backdrop-blur-md sm:mt-16"
            >
              {/* Window title bar */}
              <div className="flex h-11 select-none items-center justify-between border-b border-border/80 bg-panel-header/90 px-3 sm:px-4">
                <div className="flex items-center gap-2 sm:gap-2.5">
                  <div className="flex items-center gap-1.5">
                    <div className="h-3 w-3 rounded-full bg-[#ff5f56] shadow-sm" />
                    <div className="h-3 w-3 rounded-full bg-[#ffbd2e] shadow-sm" />
                    <div className="h-3 w-3 rounded-full bg-[#27c93f] shadow-sm" />
                  </div>
                  <div className="mx-2 hidden h-4 w-px bg-border sm:block" />
                  <span className="font-mono text-xs font-semibold text-foreground/90">
                    ROOM #CR-8821
                  </span>
                  <Badge variant="success" className="hidden sm:inline-flex">
                    Live Session
                  </Badge>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center -space-x-1.5">
                    {["#3B82F6", "#8B5CF6", "#10B981", "#F59E0B"].map(
                      (col, idx) => (
                        <div
                          key={idx}
                          style={{
                            backgroundColor: `${col}25`,
                            borderColor: col,
                          }}
                          className="flex h-5 w-5 items-center justify-center rounded-full border text-[9px] font-bold text-foreground shadow-sm"
                        >
                          {["SK", "AL", "SR", "LM"][idx]}
                        </div>
                      )
                    )}
                    <span className="hidden pl-2 text-xs font-medium text-emerald-400 sm:inline">
                      4 Online
                    </span>
                  </div>
                </div>
              </div>

              {/* Mobile view switcher */}
              <div className="border-b border-border/70 bg-surface/60 p-1.5 md:hidden">
                <ToggleGroup
                  type="single"
                  value={demoView}
                  onValueChange={(v) =>
                    v && setDemoView(v as "code" | "chat" | "terminal")
                  }
                  className="w-full"
                >
                  <ToggleGroupItem value="code" className="flex-1">
                    Code Editor
                  </ToggleGroupItem>
                  <ToggleGroupItem value="chat" className="flex-1">
                    Team Chat
                  </ToggleGroupItem>
                  <ToggleGroupItem value="terminal" className="flex-1">
                    Terminal
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>

              {/* Tabs bar */}
              <div className="flex h-9 items-center justify-between border-b border-border/70 bg-panel px-3">
                <div className="flex items-center gap-1 overflow-x-auto">
                  {(
                    ["main.ts", "server.py", "Main.java", "README.md"] as const
                  ).map((tab) => {
                    const isActive = activeTab === tab;
                    return (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={cn(
                          "flex shrink-0 items-center gap-2 rounded-md px-3 py-1 font-mono text-xs transition-all",
                          isActive
                            ? "border-b-2 border-accent bg-surface font-semibold text-foreground shadow-sm"
                            : "text-muted-foreground hover:bg-surface/50 hover:text-foreground"
                        )}
                      >
                        <FileCode2 className="h-3.5 w-3.5 shrink-0 text-accent" />
                        <span>{tab}</span>
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={handleCopyDemoCode}
                  title="Copy code"
                  className="flex shrink-0 items-center gap-1 rounded px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
                >
                  {copiedCode ? (
                    <>
                      <Check className="h-3 w-3 text-emerald-400" />
                      <span className="font-medium text-emerald-400">
                        Copied
                      </span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      <span className="hidden sm:inline">Copy</span>
                    </>
                  )}
                </button>
              </div>

              {/* 3-panel IDE */}
              <div className="grid h-80 grid-cols-1 overflow-hidden font-mono text-xs sm:h-96 md:grid-cols-12">
                {/* File tree */}
                <div className="hidden select-none space-y-1.5 border-r border-border/70 bg-surface/40 p-3.5 font-sans md:col-span-3 md:block">
                  <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Files Explorer
                  </div>

                  {[
                    { file: "main.ts", tag: "TS", tone: "bg-secondary text-foreground", edited: true },
                    { file: "server.py", tag: "PY", tone: "bg-secondary text-foreground" },
                    { file: "Main.java", tag: "JV", tone: "bg-secondary text-foreground" },
                    { file: "README.md", tag: "MD", tone: "bg-secondary text-foreground" },
                  ].map((item) => {
                    const isActive = activeTab === item.file;
                    return (
                      <div
                        key={item.file}
                        onClick={() =>
                          setActiveTab(item.file as typeof activeTab)
                        }
                        className={cn(
                          "flex cursor-pointer items-center justify-between rounded-lg px-2 py-1.5 transition-colors",
                          isActive
                            ? "bg-accent/15 font-semibold text-accent"
                            : "text-muted-foreground hover:bg-surface/60 hover:text-foreground"
                        )}
                      >
                        <div className="flex items-center gap-2 text-xs">
                          <span
                            className={cn(
                              "flex h-4 w-4 items-center justify-center rounded text-[9px] font-bold",
                              item.tone
                            )}
                          >
                            {item.tag}
                          </span>
                          <span>{item.file}</span>
                        </div>
                        {item.edited && (
                          <span className="font-mono text-[9px] text-emerald-400">
                            edited
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Editor */}
                <div
                  className={cn(
                    "col-span-12 flex-col justify-between overflow-hidden bg-panel p-3.5 sm:p-4 md:col-span-6 md:flex",
                    demoView === "code" ? "flex" : "hidden"
                  )}
                >
                  <pre className="overflow-y-auto whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-foreground/90 selection:bg-accent/30 sm:text-xs">
                    {DEMO_SNIPPETS[activeTab].code}
                  </pre>

                  <div className="flex select-none items-center justify-between border-t border-border/50 pt-2 text-[10px] text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 animate-pulse rounded-full bg-foreground/70" />
                      <span className="font-semibold text-foreground">
                        Salman (Ln 12)
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 animate-pulse rounded-full bg-muted-foreground" />
                      <span className="font-semibold text-muted-foreground">
                        Sarah (Ln 8)
                      </span>
                    </div>
                    <span className="hidden text-emerald-400 sm:inline">
                      CRDT Synced
                    </span>
                  </div>
                </div>

                {/* Chat & output */}
                <div
                  className={cn(
                    "col-span-12 h-full flex-col overflow-hidden border-l border-border/70 bg-surface/30 font-sans md:col-span-3 md:flex",
                    demoView !== "code" ? "flex" : "hidden"
                  )}
                >
                  <div
                    className={cn(
                      "flex-1 flex-col space-y-2.5 overflow-y-auto border-b border-border/60 p-3 md:flex",
                      demoView === "chat" || demoView === "code"
                        ? "flex"
                        : "hidden"
                    )}
                  >
                    <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Live Room Chat
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-[11px]">
                        <span className="font-semibold text-foreground">
                          Salman
                        </span>
                        <span className="text-[9px] text-muted-foreground">
                          10:45 AM
                        </span>
                      </div>
                      <div className="rounded-xl border border-border/60 bg-surface p-2 text-[11px] text-foreground">
                        Added the WebSocket reconnect handler 🚀
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-[11px]">
                        <span className="font-semibold text-muted-foreground">
                          Sarah
                        </span>
                        <span className="text-[9px] text-muted-foreground">
                          10:46 AM
                        </span>
                      </div>
                      <div className="rounded-xl border border-border/60 bg-surface p-2 text-[11px] text-foreground">
                        Tests passing on my end! Ready to execute.
                      </div>
                    </div>
                  </div>

                  <div
                    className={cn(
                      "border-t border-border/80 bg-panel p-2.5 font-mono text-[10px] leading-relaxed",
                      demoView === "terminal" || demoView === "code"
                        ? "block"
                        : "hidden",
                      demoView === "terminal" && "flex-1 overflow-y-auto",
                      "md:block"
                    )}
                  >
                    <div className="mb-1 flex select-none items-center justify-between text-muted-foreground">
                      <div className="flex items-center gap-1 text-accent">
                        <Terminal className="h-3 w-3" />
                        <span className="font-bold uppercase">Terminal</span>
                      </div>
                      <span className="font-semibold text-emerald-400">
                        Exit 0
                      </span>
                    </div>
                    <div className="overflow-x-auto whitespace-pre leading-normal text-emerald-400/90">
                      {DEMO_SNIPPETS[activeTab].terminalOutput}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section
          id="features"
          className="relative border-t border-border/60 py-24"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto mb-16 max-w-3xl text-center">
              <Badge
                variant="accent"
                className="mb-3 uppercase tracking-wider"
              >
                Features
              </Badge>
              <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
                Everything you need to code together seamlessly
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
                CodeRoom combines the fidelity of Monaco with CRDT
                synchronization and sandboxed execution.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((feature) => (
                <Card
                  key={feature.title}
                  className="glass-card glass-card-hover flex flex-col justify-between p-6 sm:p-7"
                >
                  <div>
                    <div
                      className={cn(
                        "mb-5 flex h-11 w-11 items-center justify-center rounded-xl border shadow-sm",
                        feature.tone
                      )}
                    >
                      <feature.icon
                        className={cn(
                          "h-5 w-5",
                          feature.title === "Sandboxed Code Execution" &&
                            "fill-current"
                        )}
                      />
                    </div>
                    <h3 className="text-lg font-bold text-foreground">
                      {feature.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {feature.description}
                    </p>
                  </div>
                  <CardFooter className="mt-6 flex items-center gap-2 border-t border-border/60 p-0 pt-4 text-xs font-semibold">
                    <span className={feature.footerTone}>{feature.footer}</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </CardFooter>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section
          id="how-it-works"
          className="border-t border-border/60 bg-surface/30 py-20"
        >
          <div className="mx-auto max-w-5xl px-4 text-center sm:px-6 lg:px-8">
            <Badge variant="accent" className="mb-3 uppercase tracking-wider">
              Workflow
            </Badge>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Start collaborating in seconds
            </h2>
            <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground sm:text-base">
              No complex git branches, no screen sharing lag, no environment
              installation headaches.
            </p>

            <div className="mt-14 grid grid-cols-1 gap-8 text-left md:grid-cols-3">
              {[
                {
                  step: "01",
                  tone: "bg-accent/20 text-accent",
                  title: "Create or Join",
                  description:
                    "Start a new room with a custom project template or enter a 6-character room code to join an ongoing session.",
                },
                {
                  step: "02",
                  tone: "bg-secondary text-foreground",
                  title: "Code Simultaneously",
                  description:
                    "Type together in real time with remote cursors, file tree navigation, tabs, and word-wrap preferences.",
                },
                {
                  step: "03",
                  tone: "bg-secondary text-foreground",
                  title: "Execute & Debug",
                  description:
                    "Run the program with one keystroke (Ctrl+Enter), inspect real console output, and diagnose errors with AI.",
                },
              ].map((item) => (
                <Card key={item.step} className="relative p-6">
                  <div
                    className={cn(
                      "mb-4 flex h-8 w-8 items-center justify-center rounded-lg font-mono text-sm font-bold",
                      item.tone
                    )}
                  >
                    {item.step}
                  </div>
                  <h3 className="text-base font-bold text-foreground">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    {item.description}
                  </p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section id="security" className="relative overflow-hidden py-20">
          <div className="relative z-10 mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
            <div className="relative overflow-hidden rounded-3xl border border-border bg-surface p-8 shadow-sm sm:p-12">

              <h2 className="text-balance text-2xl font-extrabold tracking-tight sm:text-4xl">
                Ready to transform how your team codes together?
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                Launch a room now and invite your peers with a single link. No
                downloads or credit card required.
              </p>

              <div className="mx-auto mt-8 flex w-full max-w-md flex-col items-center justify-center gap-3 sm:max-w-none sm:flex-row sm:gap-4">
                <Button asChild className="w-full sm:w-auto">
                  <Link to={user ? "/dashboard?action=create" : "/register"}>
                    Create Collaborative Room
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="secondary"
                  className="w-full sm:w-auto"
                >
                  <Link to="/login">Log In</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/70 bg-surface/50 py-8 text-xs text-muted-foreground sm:py-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 text-center sm:flex-row sm:px-6 sm:text-left lg:px-8">
          <div className="flex flex-wrap items-center justify-center gap-2.5 sm:justify-start">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent/20 text-accent">
              <Code2 className="h-4 w-4" />
            </div>
            <span className="font-bold text-foreground">CodeRoom</span>
            <span className="hidden sm:inline">&mdash;</span>
            <span>Collaborative coding for developers everywhere.</span>
          </div>

          <div className="flex items-center gap-6">
            <Link
              to="/dashboard"
              className="transition-colors hover:text-foreground"
            >
              Dashboard
            </Link>
            <Link
              to="/login"
              className="transition-colors hover:text-foreground"
            >
              Sign In
            </Link>
            <Link
              to="/register"
              className="transition-colors hover:text-foreground"
            >
              Register
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
