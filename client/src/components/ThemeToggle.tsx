import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface ThemeToggleProps {
  compact?: boolean;
  className?: string;
}

export default function ThemeToggle({
  compact = false,
  className = "",
}: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <Button
      variant="ghost"
      size={compact ? "icon-sm" : "sm"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      aria-label="Toggle theme"
      className={cn("select-none text-muted-foreground hover:text-foreground", className)}
    >
      {isDark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
      {!compact && (
        <span className="hidden capitalize sm:inline">
          {isDark ? "Dark" : "Light"}
        </span>
      )}
    </Button>
  );
}
