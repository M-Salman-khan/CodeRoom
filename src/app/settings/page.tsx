"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Code2,
  LayoutDashboard,
  Settings,
  LogOut,
  User,
  KeyRound,
  Sliders,
  Check,
  Loader2,
  AlertCircle,
  ArrowLeft,
  Palette,
} from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import ThemeToggle from "@/components/ThemeToggle";

export default function SettingsPage() {
  const router = useRouter();
  const { theme, setTheme, options } = useTheme();

  const [user, setUser] = useState<{ id: string; username: string; createdAt?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passLoading, setPassLoading] = useState(false);
  const [passError, setPassError] = useState<string | null>(null);
  const [passSuccess, setPassSuccess] = useState<string | null>(null);

  // Editor settings state
  const [fontSize, setFontSize] = useState("14");
  const [tabSize, setTabSize] = useState("2");
  const [wordWrap, setWordWrap] = useState("on");
  const [minimap, setMinimap] = useState(true);
  const [editorSaved, setEditorSaved] = useState(false);

  const getAuthHeaders = () => {
    const token =
      typeof window !== "undefined"
        ? sessionStorage.getItem("coderoom_token") || localStorage.getItem("coderoom_token") || ""
        : "";
    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    return headers;
  };

  useEffect(() => {
    // Load current user
    fetch("/api/user", { headers: getAuthHeaders() })
      .then((res) => {
        if (!res.ok) {
          router.push("/login");
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data?.user) setUser(data.user);
      })
      .catch(() => router.push("/login"))
      .finally(() => setLoading(false));

    // Load editor preferences from localStorage
    try {
      const savedFontSize = localStorage.getItem("coderoom_editor_fontSize");
      if (savedFontSize) setFontSize(savedFontSize);
      const savedTabSize = localStorage.getItem("coderoom_editor_tabSize");
      if (savedTabSize) setTabSize(savedTabSize);
      const savedWordWrap = localStorage.getItem("coderoom_editor_wordWrap");
      if (savedWordWrap) setWordWrap(savedWordWrap);
      const savedMinimap = localStorage.getItem("coderoom_editor_minimap");
      if (savedMinimap !== null) setMinimap(savedMinimap === "true");
    } catch {}
  }, [router]);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassError(null);
    setPassSuccess(null);

    if (!currentPassword || !newPassword) {
      setPassError("Please provide both current and new password.");
      return;
    }

    if (newPassword.length < 8) {
      setPassError("New password must be at least 8 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPassError("New passwords do not match.");
      return;
    }

    setPassLoading(true);

    try {
      const res = await fetch("/api/user", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        setPassError(data.error || "Failed to update password.");
        setPassLoading(false);
        return;
      }

      setPassSuccess("Password updated successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      setPassError("Network error. Could not reach the server.");
    } finally {
      setPassLoading(false);
    }
  };

  const handleSaveEditorSettings = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      localStorage.setItem("coderoom_editor_fontSize", fontSize);
      localStorage.setItem("coderoom_editor_tabSize", tabSize);
      localStorage.setItem("coderoom_editor_wordWrap", wordWrap);
      localStorage.setItem("coderoom_editor_minimap", String(minimap));
      setEditorSaved(true);
      setTimeout(() => setEditorSaved(false), 2500);
    } catch {}
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      sessionStorage.removeItem("coderoom_token");
      localStorage.removeItem("coderoom_token");
      router.push("/login");
      router.refresh();
    } catch {
      router.push("/login");
    }
  };

  if (!mounted || loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
        <p className="text-sm text-muted">Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-64 border-b md:border-b-0 md:border-r border-border bg-surface flex flex-col justify-between shrink-0">
        <div>
          {/* Logo */}
          <div className="h-16 px-6 border-b border-border/80 flex items-center justify-between">
            <Link href="/dashboard" className="flex items-center gap-2.5 group">
              <div className="h-9 w-9 rounded-xl bg-accent text-white flex items-center justify-center shadow-md shadow-accent/20 group-hover:scale-105 transition-transform">
                <Code2 className="h-5 w-5" />
              </div>
              <span className="font-bold text-lg tracking-tight text-foreground">
                Code<span className="text-accent">Room</span>
              </span>
            </Link>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1.5">
            <Link
              href="/dashboard"
              className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
            >
              <LayoutDashboard className="h-4 w-4 text-muted" />
              <span>Dashboard</span>
            </Link>

            <Link
              href="/settings"
              className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold bg-accent/15 border border-accent/30 text-accent transition-colors shadow-sm"
            >
              <Settings className="h-4 w-4 text-accent" />
              <span>Settings</span>
            </Link>
          </nav>
        </div>

        {/* User profile & Logout */}
        <div className="p-4 border-t border-border space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-muted uppercase tracking-wider">Quick Theme</span>
            <ThemeToggle compact />
          </div>

          <div className="pt-2 border-t border-border/70 flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="h-8 w-8 rounded-full bg-accent/20 border border-accent/30 text-accent font-semibold text-xs flex items-center justify-center shrink-0">
                {user?.username ? user.username.slice(0, 2).toUpperCase() : "U"}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold truncate text-foreground">{user?.username}</div>
                <div className="text-[10px] text-muted truncate">Connected</div>
              </div>
            </div>

            <button
              onClick={handleLogout}
              title="Log out"
              className="p-1.5 rounded-lg text-muted hover:text-red-400 hover:bg-surface-hover transition-colors"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 md:p-10 overflow-y-auto max-w-5xl">
        {/* Header */}
        <div className="flex items-center justify-between pb-6 border-b border-border">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="p-2 rounded-xl border border-border text-muted hover:text-foreground hover:bg-surface transition-colors"
              title="Back to Dashboard"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Preferences & Settings</h1>
              <p className="text-xs text-muted mt-0.5">Customize appearance, editor options, and manage your account.</p>
            </div>
          </div>
        </div>

        <div className="mt-8 space-y-8">
          {/* Section 1: Appearance & Theme */}
          <div className="glass-card p-6 rounded-3xl">
            <div className="flex items-center justify-between pb-4 mb-5 border-b border-border">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-xl bg-accent/15 text-accent flex items-center justify-center">
                  <Palette className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="font-semibold text-base text-foreground">Appearance & Theme</h2>
                  <p className="text-xs text-muted">Select your preferred color theme across the entire application.</p>
                </div>
              </div>
            </div>

            {/* Visual Theme Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {options.map((opt) => {
                const isActive = opt.id === theme;
                return (
                  <button
                    key={opt.id}
                    onClick={() => setTheme(opt.id)}
                    className={`flex flex-col justify-between p-4 rounded-2xl border text-left transition-all ${
                      isActive
                        ? "border-accent bg-accent/10 shadow-lg shadow-accent/10 ring-2 ring-accent"
                        : "border-border bg-surface hover:border-accent/40 hover:bg-surface-hover"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span
                            className="h-4 w-4 rounded-full border border-white/20 shadow-sm"
                            style={{ backgroundColor: opt.accentHex }}
                          />
                          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-surface border border-border text-muted">
                            {opt.badge}
                          </span>
                        </div>
                        {isActive && <Check className="h-4 w-4 text-accent" />}
                      </div>

                      <div className="font-semibold text-sm text-foreground">{opt.name}</div>
                      <p className="text-xs text-muted mt-1 leading-relaxed">{opt.description}</p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-border/60 flex items-center gap-1.5 text-[11px] font-mono text-muted">
                      <span
                        className="h-2.5 w-2.5 rounded-full inline-block"
                        style={{ backgroundColor: opt.bgHex }}
                      />
                      <span>{opt.bgHex}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 2: Code Editor Preferences */}
          <div className="glass-card p-6 rounded-3xl">
            <div className="flex items-center gap-2.5 pb-4 mb-5 border-b border-border">
              <div className="h-8 w-8 rounded-xl bg-accent/15 text-accent flex items-center justify-center">
                <Sliders className="h-4 w-4" />
              </div>
              <div>
                <h2 className="font-semibold text-base text-foreground">Code Editor Preferences</h2>
                <p className="text-xs text-muted">Configure your Monaco coding environment in all rooms.</p>
              </div>
            </div>

            <form onSubmit={handleSaveEditorSettings} className="space-y-4 max-w-lg">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1.5">
                    Font Size
                  </label>
                  <select
                    value={fontSize}
                    onChange={(e) => setFontSize(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl input-base text-sm cursor-pointer"
                  >
                    <option value="12">12 px</option>
                    <option value="13">13 px</option>
                    <option value="14">14 px (Default)</option>
                    <option value="16">16 px</option>
                    <option value="18">18 px</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1.5">
                    Tab Size
                  </label>
                  <select
                    value={tabSize}
                    onChange={(e) => setTabSize(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl input-base text-sm cursor-pointer"
                  >
                    <option value="2">2 spaces</option>
                    <option value="4">4 spaces</option>
                    <option value="8">8 spaces</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1.5">
                  Word Wrap
                </label>
                <select
                  value={wordWrap}
                  onChange={(e) => setWordWrap(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl input-base text-sm cursor-pointer"
                >
                  <option value="on">On (Wrap lines)</option>
                  <option value="off">Off (Horizontal scroll)</option>
                </select>
              </div>

              <div className="pt-1 flex items-center justify-between p-3.5 rounded-xl bg-surface border border-border">
                <div>
                  <span className="text-xs font-medium text-foreground">Code Minimap</span>
                  <p className="text-[11px] text-muted">Show miniature code overview scrollbar</p>
                </div>
                <button
                  type="button"
                  onClick={() => setMinimap(!minimap)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    minimap ? "bg-accent" : "bg-border"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      minimap ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              <button
                type="submit"
                className="mt-4 px-5 py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-semibold transition-all flex items-center gap-2 shadow-md shadow-accent/20"
              >
                {editorSaved ? (
                  <>
                    <Check className="h-4 w-4 text-emerald-300" />
                    <span>Saved!</span>
                  </>
                ) : (
                  <span>Save Editor Preferences</span>
                )}
              </button>
            </form>
          </div>

          {/* Section 3: Profile & Security */}
          <div className="glass-card p-6 rounded-3xl">
            <div className="flex items-center gap-2.5 pb-4 mb-5 border-b border-border">
              <div className="h-8 w-8 rounded-xl bg-accent/15 text-accent flex items-center justify-center">
                <User className="h-4 w-4" />
              </div>
              <div>
                <h2 className="font-semibold text-base text-foreground">Profile & Password</h2>
                <p className="text-xs text-muted">Manage your username and account credentials.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">
                  Username
                </label>
                <input
                  type="text"
                  disabled
                  value={user?.username || ""}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-panel border border-border text-foreground font-mono text-sm opacity-80 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">
                  Account Status
                </label>
                <div className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium w-full">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  <span>Active & Verified</span>
                </div>
              </div>
            </div>

            {/* Change Password */}
            <div className="pt-6 border-t border-border">
              <div className="flex items-center gap-2 mb-4">
                <KeyRound className="h-4 w-4 text-accent" />
                <h3 className="text-sm font-semibold">Change Password</h3>
              </div>

              {passError && (
                <div className="mb-4 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{passError}</span>
                </div>
              )}

              {passSuccess && (
                <div className="mb-4 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
                  <Check className="h-4 w-4 shrink-0" />
                  <span>{passSuccess}</span>
                </div>
              )}

              <form onSubmit={handlePasswordChange} className="space-y-4 max-w-md">
                <div>
                  <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1.5">
                    Current Password
                  </label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full px-4 py-2.5 rounded-xl input-base text-sm"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1.5">
                    New Password (min. 8 chars)
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full px-4 py-2.5 rounded-xl input-base text-sm"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1.5">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full px-4 py-2.5 rounded-xl input-base text-sm"
                  />
                </div>

                <button
                  type="submit"
                  disabled={passLoading}
                  className="mt-2 px-5 py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-semibold transition-all flex items-center gap-2 disabled:opacity-50 shadow-md shadow-accent/20"
                >
                  {passLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5" />}
                  <span>Update Password</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
