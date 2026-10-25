import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle,
  Code2,
  Loader2,
  Lock,
  User,
} from "lucide-react";

import ThemeToggle from "@/components/ThemeToggle";
import { apiFetch, errorMessage, storeToken } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function RegisterPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const usernameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    usernameInputRef.current?.focus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmed = username.trim();
    if (trimmed.length < 3 || trimmed.length > 30) {
      setError("Username must be between 3 and 30 characters.");
      return;
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
      setError(
        "Username can only contain letters, numbers, underscores, and hyphens."
      );
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const res = await apiFetch("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          username: trimmed,
          password,
          confirmPassword,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(errorMessage(data, "Failed to create account."));
        setLoading(false);
        return;
      }

      if (data.token) storeToken(data.token);
      navigate("/dashboard", { replace: true });
    } catch {
      setError("Network error. Could not connect to the server.");
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-dvh-screen flex-col items-center justify-center overflow-hidden bg-background p-4 text-foreground selection:bg-accent/30">
      <div className="absolute right-5 top-5 z-20">
        <ThemeToggle />
      </div>

      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute left-1/2 top-1/3 h-[400px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/15 blur-[120px]" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 text-center">
          <Link to="/" className="group mb-4 inline-flex items-center gap-2.5">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent text-primary-foreground shadow-lg shadow-accent/25 transition-transform group-hover:scale-105">
              <Code2 className="h-6 w-6" />
            </div>
            <span className="text-2xl font-bold tracking-tight">
              Code<span className="text-accent">Room</span>
            </span>
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Create your account
          </h1>
          <p className="mt-1.5 text-xs text-muted-foreground sm:text-sm">
            Start collaborating with your team in seconds
          </p>
        </div>

        <Card className="glass-card border-border/80 shadow-2xl">
          <CardHeader className="pb-4">
            <CardTitle className="sr-only">Register</CardTitle>
            <CardDescription className="sr-only">
              Create a new CodeRoom account
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <div
                role="alert"
                className="mb-5 flex items-center gap-2.5 rounded-xl border border-destructive/30 bg-destructive/10 p-3.5 text-xs text-destructive duration-150 animate-in fade-in sm:text-sm"
              >
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="registerUsername">Username</Label>
                <div className="group relative">
                  <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-accent" />
                  <Input
                    ref={usernameInputRef}
                    id="registerUsername"
                    type="text"
                    name="username"
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="3-30 characters"
                    required
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="registerPassword">Password</Label>
                <div className="group relative">
                  <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-accent" />
                  <Input
                    id="registerPassword"
                    type="password"
                    name="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 8 characters"
                    required
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="registerConfirm">Confirm Password</Label>
                <div className="group relative">
                  <CheckCircle className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-accent" />
                  <Input
                    id="registerConfirm"
                    type="password"
                    name="confirmPassword"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    required
                    className="pl-10"
                  />
                </div>
              </div>

              <Button
                type="submit"
                size="lg"
                disabled={loading}
                className="mt-2 w-full"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Creating account...</span>
                  </>
                ) : (
                  <>
                    <span>Create Account</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </form>

            <div className="mt-6 border-t border-border/60 pt-5 text-center text-xs text-muted-foreground">
              Already have an account?{" "}
              <Link
                to="/login"
                className="font-semibold text-accent transition-colors hover:underline"
              >
                Sign in
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
