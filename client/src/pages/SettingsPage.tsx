import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
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
import { apiFetch, clearStoredToken } from "@/lib/auth";
import ThemeToggle from "@/components/ThemeToggle";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function SectionCard({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="glass-card">
      <CardHeader className="flex-row items-center gap-3 border-b border-border pb-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent">
          {icon}
        </div>
        <div>
          <CardTitle className="text-sm sm:text-base">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="pt-5">{children}</CardContent>
    </Card>
  );
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const { theme, setTheme, options } = useTheme();

  const [user, setUser] = useState<{
    id: string;
    username: string;
    createdAt?: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passLoading, setPassLoading] = useState(false);
  const [passError, setPassError] = useState<string | null>(null);
  const [passSuccess, setPassSuccess] = useState<string | null>(null);

  const [fontSize, setFontSize] = useState("14");
  const [tabSize, setTabSize] = useState("2");
  const [wordWrap, setWordWrap] = useState("on");
  const [minimap, setMinimap] = useState(true);
  const [editorSaved, setEditorSaved] = useState(false);


  useEffect(() => {
    apiFetch("/api/user")
      .then((res) => {
        if (!res.ok) {
          navigate("/login");
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data?.user) setUser(data.user);
      })
      .catch(() => navigate("/login"))
      .finally(() => setLoading(false));

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
  }, [navigate]);

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
      const res = await apiFetch("/api/user", {
        method: "PATCH",
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
      await apiFetch("/api/auth/logout", { method: "POST" });
    } catch {
      /* clear locally even when the request fails */
    } finally {
      clearStoredToken();
      navigate("/login", { replace: true });
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-dvh-screen flex-col items-center justify-center gap-3 bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
        <p className="text-sm text-muted-foreground">Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh-screen flex-col bg-background text-foreground md:flex-row">
      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex min-h-14 shrink-0 items-center justify-between border-b border-border bg-surface px-4 pt-safe md:hidden">
        <Link to="/dashboard" className="group flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-primary-foreground shadow-sm">
            <Code2 className="h-4 w-4" />
          </div>
          <span className="text-base font-bold tracking-tight text-foreground">
            Code<span className="text-accent">Room</span>
          </span>
        </Link>

        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/dashboard">
              <LayoutDashboard className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Dashboard</span>
            </Link>
          </Button>
          <ThemeToggle compact />
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleLogout}
            title="Log out"
            className="hover:bg-destructive/10 hover:text-destructive"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh-screen w-64 shrink-0 flex-col justify-between border-r border-border bg-surface md:flex">
        <div>
          <div className="flex h-16 items-center border-b border-border/80 px-6">
            <Link to="/dashboard" className="group flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-primary-foreground shadow-md shadow-accent/20 transition-transform group-hover:scale-105">
                <Code2 className="h-5 w-5" />
              </div>
              <span className="text-lg font-bold tracking-tight text-foreground">
                Code<span className="text-accent">Room</span>
              </span>
            </Link>
          </div>

          <nav className="space-y-1.5 p-4">
            <Button
              asChild
              variant="ghost"
              className="w-full justify-start gap-3 text-sm font-medium"
            >
              <Link to="/dashboard">
                <LayoutDashboard className="h-4 w-4 text-muted-foreground" />
                <span>Dashboard</span>
              </Link>
            </Button>

            <Button
              asChild
              variant="subtle"
              className="w-full justify-start gap-3 text-sm font-semibold"
            >
              <Link to="/settings">
                <Settings className="h-4 w-4" />
                <span>Settings</span>
              </Link>
            </Button>
          </nav>
        </div>

        <div className="space-y-3 border-t border-border p-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Quick Theme
            </span>
            <ThemeToggle compact />
          </div>

          <div className="flex items-center justify-between border-t border-border/70 pt-2">
            <div className="flex min-w-0 items-center gap-2.5">
              <Avatar className="h-8 w-8 border-accent/30">
                <AvatarFallback className="bg-accent/20 font-semibold text-accent">
                  {user?.username ? user.username.slice(0, 2).toUpperCase() : "U"}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="truncate text-xs font-semibold text-foreground">
                  {user?.username}
                </div>
                <div className="truncate text-[10px] text-muted-foreground">
                  Connected
                </div>
              </div>
            </div>

            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleLogout}
              title="Log out"
              className="hover:bg-destructive/10 hover:text-destructive"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="max-w-5xl flex-1 overflow-y-auto p-4 pb-safe sm:p-6 md:p-10">
        <div className="flex flex-col justify-between gap-4 border-b border-border pb-5 sm:flex-row sm:items-center sm:pb-6">
          <div className="flex items-center gap-3">
            <Button
              asChild
              variant="outline"
              size="icon"
              title="Back to Dashboard"
            >
              <Link to="/dashboard">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                Preferences &amp; Settings
              </h1>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Customize appearance, editor options, and manage your account.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 space-y-6 sm:mt-8 sm:space-y-8">
          {/* Appearance */}
          <SectionCard
            icon={<Palette className="h-4 w-4" />}
            title="Appearance & Theme"
            description="Select your preferred color theme across the entire application."
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
              {options.map((opt) => {
                const isActive = opt.id === theme;
                return (
                  <button
                    key={opt.id}
                    onClick={() => setTheme(opt.id)}
                    className={cn(
                      "flex flex-col justify-between rounded-2xl border p-4 text-left transition-all",
                      isActive
                        ? "border-accent bg-accent/10 shadow-lg shadow-accent/10 ring-2 ring-accent"
                        : "border-border bg-surface hover:border-accent/40 hover:bg-surface-hover"
                    )}
                  >
                    <div>
                      <div className="mb-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className="h-4 w-4 shrink-0 rounded-full border border-white/20 shadow-sm"
                            style={{ backgroundColor: opt.accentHex }}
                          />
                          <Badge variant="outline">{opt.badge}</Badge>
                        </div>
                        {isActive && (
                          <Check className="h-4 w-4 shrink-0 text-accent" />
                        )}
                      </div>

                      <div className="text-sm font-semibold text-foreground">
                        {opt.name}
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        {opt.description}
                      </p>
                    </div>

                    <div className="mt-4 flex items-center gap-1.5 border-t border-border/60 pt-3 font-mono text-[11px] text-muted-foreground">
                      <span
                        className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: opt.bgHex }}
                      />
                      <span>{opt.bgHex}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </SectionCard>

          {/* Editor Preferences */}
          <SectionCard
            icon={<Sliders className="h-4 w-4" />}
            title="Code Editor Preferences"
            description="Configure your Monaco coding environment in all rooms."
          >
            <form
              onSubmit={handleSaveEditorSettings}
              className="max-w-lg space-y-5"
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                <div className="space-y-2">
                  <Label>Font Size</Label>
                  <Select value={fontSize} onValueChange={setFontSize}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="12">12 px</SelectItem>
                      <SelectItem value="13">13 px</SelectItem>
                      <SelectItem value="14">14 px (Default)</SelectItem>
                      <SelectItem value="16">16 px</SelectItem>
                      <SelectItem value="18">18 px</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Tab Size</Label>
                  <Select value={tabSize} onValueChange={setTabSize}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2">2 spaces</SelectItem>
                      <SelectItem value="4">4 spaces</SelectItem>
                      <SelectItem value="8">8 spaces</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Word Wrap</Label>
                <Select value={wordWrap} onValueChange={setWordWrap}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="on">On (Wrap lines)</SelectItem>
                    <SelectItem value="off">
                      Off (Horizontal scroll)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-secondary/40 p-3.5">
                <div className="min-w-0">
                  <span className="block truncate text-xs font-medium text-foreground">
                    Code Minimap
                  </span>
                  <p className="text-[11px] text-muted-foreground">
                    Show miniature code overview scrollbar
                  </p>
                </div>
                <Switch checked={minimap} onCheckedChange={setMinimap} />
              </div>

              <Button type="submit" className="mt-2 w-full sm:w-auto">
                {editorSaved ? (
                  <>
                    <Check className="h-4 w-4 text-emerald-300" />
                    <span>Saved!</span>
                  </>
                ) : (
                  <span>Save Editor Preferences</span>
                )}
              </Button>
            </form>
          </SectionCard>

          {/* Profile & Security */}
          <SectionCard
            icon={<User className="h-4 w-4" />}
            title="Profile & Password"
            description="Manage your username and account credentials."
          >
            <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
              <div className="space-y-2">
                <Label>Username</Label>
                <Input
                  type="text"
                  disabled
                  value={user?.username || ""}
                  className="cursor-not-allowed font-mono"
                />
              </div>

              <div className="space-y-2">
                <Label>Account Status</Label>
                <Badge
                  variant="success"
                  className="flex h-10 w-full items-center gap-2 rounded-xl px-3.5 text-xs"
                >
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  Active &amp; Verified
                </Badge>
              </div>
            </div>

            <div className="border-t border-border pt-6">
              <div className="mb-4 flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-accent" />
                <h3 className="text-sm font-semibold">Change Password</h3>
              </div>

              {passError && (
                <div className="mb-4 flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3.5 text-xs text-destructive">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{passError}</span>
                </div>
              )}

              {passSuccess && (
                <div className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-400">
                  <Check className="h-4 w-4 shrink-0" />
                  <span>{passSuccess}</span>
                </div>
              )}

              <form
                onSubmit={handlePasswordChange}
                className="max-w-lg space-y-5"
              >
                <div className="space-y-2">
                  <Label>Current Password</Label>
                  <Input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    required
                    className="h-11"
                  />
                </div>

                <div className="space-y-2">
                  <Label>New Password (min. 8 chars)</Label>
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter at least 8 characters"
                    required
                    className="h-11"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Confirm New Password</Label>
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm your new password"
                    required
                    className="h-11"
                  />
                </div>

                <Button type="submit" disabled={passLoading} className="mt-2">
                  {passLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <KeyRound className="h-3.5 w-3.5" />
                  )}
                  <span>Update Password</span>
                </Button>
              </form>
            </div>
          </SectionCard>
        </div>
      </main>
    </div>
  );
}
