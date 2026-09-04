"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Code2, ArrowRight, Lock, User, AlertCircle, Loader2 } from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/dashboard";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!username.trim() || !password) {
      setError("Please fill in all fields.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          password,
          rememberMe,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Incorrect username or password.");
        setLoading(false);
        return;
      }

      if (data.token) {
        sessionStorage.setItem("coderoom_token", data.token);
        localStorage.setItem("coderoom_token", data.token);
      }

      router.push(redirect);
      router.refresh();
    } catch {
      setError("Network error. Could not connect to the server.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2.5 mb-4 group">
            <div className="h-10 w-10 rounded-xl bg-accent/15 border border-accent/30 flex items-center justify-center text-accent group-hover:scale-105 transition-transform">
              <Code2 className="h-6 w-6" />
            </div>
            <span className="font-bold text-2xl tracking-tight">
              Code<span className="text-accent">Room</span>
            </span>
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
          <p className="text-sm text-muted mt-1">Sign in to your collaborative code rooms</p>
        </div>

        <div className="bg-surface border border-border rounded-2xl p-6 sm:p-8 shadow-xl">
          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-center gap-2.5">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-2">
                Username
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="salman"
                  required
                  autoFocus
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-panel border border-border text-foreground placeholder:text-muted/60 text-sm focus:outline-none focus:border-accent transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-panel border border-border text-foreground placeholder:text-muted/60 text-sm focus:outline-none focus:border-accent transition-colors"
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-sm pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded border-border bg-panel text-accent focus:ring-accent"
                />
                <span className="text-muted text-xs font-medium">Remember me</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 px-4 rounded-xl bg-accent hover:bg-accent-hover text-white text-sm font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-md shadow-accent/20"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-border/70 text-center text-xs text-muted">
            Don&apos;t have an account yet?{" "}
            <Link href="/register" className="text-accent hover:underline font-medium">
              Create an account
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
