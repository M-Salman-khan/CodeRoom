"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Code2,
  MessageSquare,
  Wifi,
  Database,
  ArrowRight,
  Plus,
  LogIn,
} from "lucide-react";

export default function LandingPage() {
  const [user, setUser] = useState<{ id: string; username: string } | null>(null);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col selection:bg-accent/30 selection:text-white">
      {/* Navigation */}
      <header className="border-b border-border/60 bg-surface/50 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="h-9 w-9 rounded-lg bg-accent/15 border border-accent/30 flex items-center justify-center text-accent group-hover:scale-105 transition-transform">
              <Code2 className="h-5 w-5" />
            </div>
            <span className="font-bold text-lg tracking-tight">
              Code<span className="text-accent">Room</span>
            </span>
            <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-accent/10 border border-accent/20 text-accent ml-1">
              v1.0
            </span>
          </Link>

          <div className="flex items-center gap-3">
            {!loading && user ? (
              <Link
                href="/dashboard"
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-white text-sm font-medium transition-colors shadow-sm"
              >
                <span>Dashboard</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="px-4 py-2 rounded-lg text-sm font-medium text-muted hover:text-foreground transition-colors hover:bg-surface"
                >
                  Login
                </Link>
                <Link
                  href="/register"
                  className="px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-white text-sm font-medium transition-colors shadow-sm"
                >
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="relative overflow-hidden pt-20 pb-16 md:pt-28 md:pb-24 border-b border-border/40">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(59,130,246,0.15),rgba(255,255,255,0))]" />

          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface border border-border text-xs font-medium text-muted mb-8">
              <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              <span>Real-time collaborative workspace</span>
            </div>

            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-balance leading-tight">
              Code together.{" "}
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400">
                Anywhere.
              </span>
            </h1>

            <p className="mt-6 text-lg sm:text-xl text-muted max-w-2xl mx-auto leading-relaxed">
              A lightweight collaborative coding room for teams, classmates, and friends.
              Edit in real time, chat, and keep total ownership of your project data.
            </p>

            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <Link
                href={user ? "/dashboard?action=create" : "/register"}
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-accent hover:bg-accent-hover text-white text-base font-semibold transition-all shadow-lg shadow-accent/20 hover:scale-[1.02]"
              >
                <Plus className="h-5 w-5" />
                <span>Create a Room</span>
              </Link>

              <Link
                href={user ? "/dashboard?action=join" : "/login?redirect=/dashboard"}
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-surface hover:bg-surface-hover border border-border text-foreground text-base font-semibold transition-all hover:scale-[1.02]"
              >
                <LogIn className="h-5 w-5 text-muted" />
                <span>Join a Room</span>
              </Link>
            </div>

            {/* Live Interactive Mockup */}
            <div className="mt-16 max-w-4xl mx-auto rounded-xl border border-border bg-panel shadow-2xl overflow-hidden text-left">
              {/* Fake Window Bar */}
              <div className="h-10 bg-panel-header border-b border-border flex items-center justify-between px-4">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-red-500/80" />
                  <div className="h-3 w-3 rounded-full bg-yellow-500/80" />
                  <div className="h-3 w-3 rounded-full bg-green-500/80" />
                  <span className="text-xs text-muted ml-2 font-mono">room: DEMO01 — main.ts</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center gap-1.5 text-xs text-green-400 font-medium">
                    <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                    3 Online
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded bg-surface border border-border text-muted font-mono">
                    DEMO01
                  </span>
                </div>
              </div>

              {/* Fake 3-Panel Preview */}
              <div className="grid grid-cols-1 md:grid-cols-12 h-72 md:h-80 font-mono text-xs overflow-hidden">
                {/* File explorer preview */}
                <div className="hidden md:block md:col-span-3 border-r border-border bg-surface/40 p-3 space-y-1 select-none">
                  <div className="text-[11px] font-semibold text-muted tracking-wider uppercase mb-2">Files</div>
                  <div className="flex items-center gap-1.5 text-foreground py-1 px-1.5 rounded bg-surface">
                    <span className="text-blue-400">📄</span> main.ts
                  </div>
                  <div className="flex items-center gap-1.5 text-muted hover:text-foreground py-1 px-1.5">
                    <span className="text-yellow-400">📄</span> utils.ts
                  </div>
                  <div className="flex items-center gap-1.5 text-muted hover:text-foreground py-1 px-1.5">
                    <span className="text-indigo-400">📄</span> README.md
                  </div>
                </div>

                {/* Code editor preview */}
                <div className="col-span-12 md:col-span-6 p-4 bg-panel space-y-1.5 leading-relaxed overflow-hidden">
                  <div className="text-muted">
                    <span className="text-purple-400">import</span> &#123; createServer &#125; <span className="text-purple-400">from</span> <span className="text-emerald-400">&quot;coderoom&quot;</span>;
                  </div>
                  <div className="text-muted">
                    <span className="text-purple-400">const</span> room = <span className="text-blue-400">createServer</span>(&#123; id: <span className="text-emerald-400">&quot;DEMO01&quot;</span> &#125;);
                  </div>
                  <div className="text-muted">
                    room.<span className="text-blue-400">on</span>(<span className="text-emerald-400">&quot;collaborate&quot;</span>, (user) =&gt; &#123;
                  </div>
                  <div className="pl-4 text-foreground flex items-center">
                    <span>console.log(<span className="text-emerald-400">`$&#123;user.name&#125; is live!`</span>);</span>
                    {/* Remote Cursor User 1 */}
                    <span className="relative inline-block ml-0.5 h-4 w-[2px] bg-blue-500 animate-pulse">
                      <span className="absolute -top-4 left-0 text-[9px] bg-blue-500 text-white font-sans px-1 rounded shadow whitespace-nowrap">
                        Salman
                      </span>
                    </span>
                  </div>
                  <div className="text-muted">&#125;);</div>
                  <div className="text-muted pl-4">
                    <span className="text-muted">&#47;&#47; Real-time CRDT synchronization</span>
                  </div>
                  <div className="text-muted pl-4 flex items-center">
                    <span>room.<span className="text-blue-400">broadcast</span>(<span className="text-emerald-400">&quot;Ready to code&quot;</span>);</span>
                    {/* Remote Cursor User 2 */}
                    <span className="relative inline-block ml-0.5 h-4 w-[2px] bg-emerald-500 animate-pulse">
                      <span className="absolute -top-4 left-0 text-[9px] bg-emerald-500 text-white font-sans px-1 rounded shadow whitespace-nowrap">
                        Rahul
                      </span>
                    </span>
                  </div>
                </div>

                {/* Chat preview */}
                <div className="hidden md:flex md:col-span-3 border-l border-border bg-surface/30 p-3 flex-col justify-between font-sans">
                  <div className="space-y-3">
                    <div className="text-[11px] font-semibold text-muted tracking-wider uppercase font-mono">Chat</div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-1 text-[11px]">
                        <span className="font-semibold text-blue-400">Salman</span>
                        <span className="text-[10px] text-muted font-mono">10:42 AM</span>
                      </div>
                      <p className="text-xs text-foreground bg-surface p-2 rounded-lg border border-border/40">
                        Anyone finished the API?
                      </p>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-1 text-[11px]">
                        <span className="font-semibold text-emerald-400">Rahul</span>
                        <span className="text-[10px] text-muted font-mono">10:43 AM</span>
                      </div>
                      <p className="text-xs text-foreground bg-surface p-2 rounded-lg border border-border/40">
                        Almost done! Testing now 👍
                      </p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-border/60">
                    <div className="bg-surface/80 rounded px-2.5 py-1.5 text-xs text-muted border border-border/60">
                      Type a message...
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Feature Section */}
        <section className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Designed for speed, clarity, and collaboration
            </h2>
            <p className="mt-3 text-muted text-sm sm:text-base">
              Everything you need to pair program or work with teams across LAN or Internet.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Feature 1 */}
            <div className="p-6 rounded-2xl bg-surface border border-border/70 hover:border-accent/40 transition-colors">
              <div className="h-10 w-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mb-4">
                <Code2 className="h-5 w-5" />
              </div>
              <h3 className="text-base font-semibold mb-2">Real-time coding</h3>
              <p className="text-sm text-muted leading-relaxed">
                Edit code together with instant synchronization. Powered by Yjs CRDTs and Monaco Editor with remote cursor indicators.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="p-6 rounded-2xl bg-surface border border-border/70 hover:border-accent/40 transition-colors">
              <div className="h-10 w-10 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center mb-4">
                <MessageSquare className="h-5 w-5" />
              </div>
              <h3 className="text-base font-semibold mb-2">Built-in chat</h3>
              <p className="text-sm text-muted leading-relaxed">
                Talk while you code. Room-scoped instant messaging with persistent history and online presence indicators.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="p-6 rounded-2xl bg-surface border border-border/70 hover:border-accent/40 transition-colors">
              <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-4">
                <Wifi className="h-5 w-5" />
              </div>
              <h3 className="text-base font-semibold mb-2">LAN + Internet</h3>
              <p className="text-sm text-muted leading-relaxed">
                Use it locally on your Wi-Fi network without internet, or access the same server remotely through a domain or public IP.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="p-6 rounded-2xl bg-surface border border-border/70 hover:border-accent/40 transition-colors">
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mb-4">
                <Database className="h-5 w-5" />
              </div>
              <h3 className="text-base font-semibold mb-2">Your data</h3>
              <p className="text-sm text-muted leading-relaxed">
                Projects and messages are stored by your own server. Self-contained database with zero external cloud dependencies.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/60 bg-surface/30 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted">
          <div className="flex items-center gap-2">
            <span className="font-bold text-foreground">CodeRoom</span>
            <span>&mdash;</span>
            <span>Code together. Anywhere.</span>
          </div>
          <p>Self-hosted collaborative code room.</p>
        </div>
      </footer>
    </div>
  );
}
