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
} from "lucide-react";

export default function SettingsPage() {
  const router = useRouter();

  const [user, setUser] = useState<{ id: string; username: string; createdAt?: string } | null>(null);
  const [loading, setLoading] = useState(true);

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
  const [theme, setTheme] = useState("vs-dark");
  const [editorSaved, setEditorSaved] = useState(false);

  useEffect(() => {
    // Load current user
    fetch("/api/user")
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
      const savedTheme = localStorage.getItem("coderoom_editor_theme");
      if (savedTheme) setTheme(savedTheme);
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
        headers: { "Content-Type": "application/json" },
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
      localStorage.setItem("coderoom_editor_theme", theme);
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

  if (loading) {
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
          <div className="h-16 px-6 border-b border-border flex items-center justify-between">
            <Link href="/dashboard" className="flex items-center gap-2.5 group">
              <div className="h-8 w-8 rounded-lg bg-accent/15 border border-accent/30 flex items-center justify-center text-accent group-hover:scale-105 transition-transform">
                <Code2 className="h-5 w-5" />
              </div>
              <span className="font-bold text-lg tracking-tight">
                Code<span className="text-accent">Room</span>
              </span>
            </Link>
          </div>

          <nav className="p-4 space-y-1.5">
            <Link
              href="/dashboard"
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
            >
              <LayoutDashboard className="h-4 w-4" />
              <span>Dashboard</span>
            </Link>

            <Link
              href="/settings"
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium bg-panel border border-border text-foreground transition-colors"
            >
              <Settings className="h-4 w-4 text-purple-400" />
              <span>Settings</span>
            </Link>
          </nav>
        </div>

        <div className="p-4 border-t border-border">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-red-400 hover:bg-panel transition-colors"
          >
            <LogOut className="h-4 w-4" />
            <span>Log Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 md:p-10 overflow-y-auto max-w-4xl">
        <div className="flex items-center gap-3 mb-8">
          <Link
            href="/dashboard"
            className="p-2 rounded-xl border border-border bg-surface hover:bg-surface-hover text-muted hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
            <p className="text-xs text-muted mt-0.5">Customize your account and code editor preferences</p>
          </div>
        </div>

        <div className="space-y-8">
          {/* Account Settings */}
          <div className="p-6 rounded-2xl bg-surface border border-border">
            <div className="flex items-center gap-2.5 mb-5 pb-4 border-b border-border">
              <User className="h-5 w-5 text-accent" />
              <h2 className="font-semibold text-base text-foreground">Account Information</h2>
            </div>

            <div className="space-y-4 max-w-md">
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
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
                  <span className="h-2 w-2 rounded-full bg-green-500" />
                  Active User
                </div>
              </div>
            </div>

            {/* Change Password Form */}
            <div className="mt-8 pt-6 border-t border-border">
              <div className="flex items-center gap-2 mb-4">
                <KeyRound className="h-4 w-4 text-purple-400" />
                <h3 className="text-sm font-semibold">Change Password</h3>
              </div>

              {passError && (
                <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{passError}</span>
                </div>
              )}

              {passSuccess && (
                <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
                  <Check className="h-4 w-4 shrink-0" />
                  <span>{passSuccess}</span>
                </div>
              )}

              <form onSubmit={handlePasswordChange} className="space-y-3.5 max-w-md">
                <div>
                  <label className="block text-xs text-muted mb-1 font-medium">Current Password</label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full px-3.5 py-2 rounded-xl bg-panel border border-border text-foreground text-sm focus:outline-none focus:border-accent"
                  />
                </div>

                <div>
                  <label className="block text-xs text-muted mb-1 font-medium">New Password (min. 8 chars)</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full px-3.5 py-2 rounded-xl bg-panel border border-border text-foreground text-sm focus:outline-none focus:border-accent"
                  />
                </div>

                <div>
                  <label className="block text-xs text-muted mb-1 font-medium">Confirm New Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full px-3.5 py-2 rounded-xl bg-panel border border-border text-foreground text-sm focus:outline-none focus:border-accent"
                  />
                </div>

                <button
                  type="submit"
                  disabled={passLoading}
                  className="mt-2 px-4 py-2 rounded-xl bg-surface-hover hover:bg-accent text-foreground hover:text-white border border-border text-xs font-semibold transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {passLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5" />}
                  <span>Update Password</span>
                </button>
              </form>
            </div>
          </div>

          {/* Editor Preferences */}
          <div className="p-6 rounded-2xl bg-surface border border-border">
            <div className="flex items-center gap-2.5 mb-5 pb-4 border-b border-border">
              <Sliders className="h-5 w-5 text-indigo-400" />
              <h2 className="font-semibold text-base text-foreground">Code Editor Preferences</h2>
            </div>

            <form onSubmit={handleSaveEditorSettings} className="space-y-4 max-w-md">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-muted mb-1.5 font-medium">Font Size</label>
                  <select
                    value={fontSize}
                    onChange={(e) => setFontSize(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-panel border border-border text-foreground text-sm focus:outline-none focus:border-accent"
                  >
                    <option value="12">12 px</option>
                    <option value="13">13 px</option>
                    <option value="14">14 px (Default)</option>
                    <option value="16">16 px</option>
                    <option value="18">18 px</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-muted mb-1.5 font-medium">Tab Size</label>
                  <select
                    value={tabSize}
                    onChange={(e) => setTabSize(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-panel border border-border text-foreground text-sm focus:outline-none focus:border-accent"
                  >
                    <option value="2">2 spaces</option>
                    <option value="4">4 spaces</option>
                    <option value="8">8 spaces</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs text-muted mb-1.5 font-medium">Word Wrap</label>
                <select
                  value={wordWrap}
                  onChange={(e) => setWordWrap(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-panel border border-border text-foreground text-sm focus:outline-none focus:border-accent"
                >
                  <option value="on">On (Wrap lines)</option>
                  <option value="off">Off (Horizontal scroll)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-muted mb-1.5 font-medium">Editor Theme</label>
                <select
                  value={theme}
                  onChange={(e) => setTheme(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-panel border border-border text-foreground text-sm focus:outline-none focus:border-accent"
                >
                  <option value="vs-dark">VS Dark (Default)</option>
                  <option value="light">Light</option>
                </select>
              </div>

              <div className="pt-1 flex items-center justify-between p-3 rounded-xl bg-panel border border-border">
                <span className="text-xs font-medium text-foreground">Code Minimap</span>
                <input
                  type="checkbox"
                  checked={minimap}
                  onChange={(e) => setMinimap(e.target.checked)}
                  className="h-4 w-4 rounded border-border bg-surface text-accent focus:ring-accent"
                />
              </div>

              <button
                type="submit"
                className="mt-4 px-5 py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-semibold transition-colors flex items-center gap-2 shadow-sm"
              >
                {editorSaved ? (
                  <>
                    <Check className="h-4 w-4 text-green-300" />
                    <span>Saved!</span>
                  </>
                ) : (
                  <span>Save Editor Preferences</span>
                )}
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
