"use client";

import { useState, useRef, useEffect } from "react";
import { Moon, Sun, Sparkles, Terminal, Check, Palette } from "lucide-react";
import { useTheme, Theme } from "@/context/ThemeContext";

interface ThemeToggleProps {
  compact?: boolean;
  className?: string;
}

export default function ThemeToggle({ compact = false, className = "" }: ThemeToggleProps) {
  const { theme, setTheme, options } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const getThemeIcon = (t: Theme) => {
    switch (t) {
      case "light":
        return <Sun className="h-4 w-4 text-amber-500" />;
      case "cyber":
        return <Sparkles className="h-4 w-4 text-purple-400" />;
      case "forest":
        return <Terminal className="h-4 w-4 text-emerald-400" />;
      case "dark":
      default:
        return <Moon className="h-4 w-4 text-indigo-400" />;
    }
  };

  const currentOption = options.find((o) => o.id === theme) || options[0];

  return (
    <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        title={`Current Theme: ${currentOption.name} (Click to switch)`}
        className={`flex items-center gap-2 rounded-xl transition-all select-none border border-border/70 hover:border-accent/40 hover:bg-surface-hover ${
          compact
            ? "p-2 bg-surface text-foreground shadow-sm"
            : "px-3 py-2 bg-surface text-foreground text-xs font-medium shadow-sm"
        }`}
      >
        <span className="flex items-center justify-center">{getThemeIcon(theme)}</span>
        {!compact && (
          <span className="hidden sm:inline font-medium capitalize text-xs">
            {currentOption.name}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-surface border border-border/80 shadow-2xl p-1.5 z-50 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150">
          <div className="px-3 py-2 border-b border-border/60 text-[10px] uppercase font-bold tracking-wider text-muted flex items-center justify-between">
            <span>Color Theme</span>
            <Palette className="h-3 w-3 text-accent" />
          </div>

          <div className="py-1 space-y-0.5">
            {options.map((opt) => {
              const isActive = opt.id === theme;
              return (
                <button
                  key={opt.id}
                  onClick={() => {
                    setTheme(opt.id);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs transition-all ${
                    isActive
                      ? "bg-accent/15 text-accent font-semibold"
                      : "text-muted hover:text-foreground hover:bg-surface-hover"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className="h-3.5 w-3.5 rounded-full border border-white/20 shadow-sm shrink-0"
                      style={{ backgroundColor: opt.accentHex }}
                    />
                    <div className="text-left">
                      <div className="font-medium">{opt.name}</div>
                      <div className="text-[10px] text-muted line-clamp-1">{opt.description}</div>
                    </div>
                  </div>

                  {isActive && <Check className="h-4 w-4 text-accent shrink-0 ml-2" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
