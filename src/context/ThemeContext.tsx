"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";

export type Theme = "dark" | "light" | "cyber" | "forest";

export interface ThemeOption {
  id: Theme;
  name: string;
  badge: string;
  description: string;
  accentHex: string;
  bgHex: string;
}

export const THEME_OPTIONS: ThemeOption[] = [
  {
    id: "dark",
    name: "Obsidian Slate",
    badge: "Default",
    description: "Deep charcoal with vivid indigo accents",
    accentHex: "#6366f1",
    bgHex: "#090d16",
  },
  {
    id: "light",
    name: "Daylight Pro",
    badge: "Clean",
    description: "Crisp modern light workspace with slate borders",
    accentHex: "#4f46e5",
    bgHex: "#f8fafc",
  },
  {
    id: "cyber",
    name: "Cyber Midnight",
    badge: "Vibrant",
    description: "Cosmic deep space with glowing purple & cyan neon",
    accentHex: "#a855f7",
    bgHex: "#060714",
  },
  {
    id: "forest",
    name: "Nordic Forest",
    badge: "Terminal",
    description: "Dark matrix obsidian with mint emerald glow",
    accentHex: "#10b981",
    bgHex: "#06120d",
  },
];

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  cycleTheme: () => void;
  options: ThemeOption[];
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark");

  const applyThemeToDOM = useCallback((newTheme: Theme) => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    root.classList.remove("dark", "light", "theme-cyber", "theme-forest");

    if (newTheme === "light") {
      root.classList.add("light");
    } else if (newTheme === "cyber") {
      root.classList.add("dark", "theme-cyber");
    } else if (newTheme === "forest") {
      root.classList.add("dark", "theme-forest");
    } else {
      root.classList.add("dark");
    }

    // Keep Monaco editor theme preference synced
    const editorTheme = newTheme === "light" ? "light" : "vs-dark";
    try {
      localStorage.setItem("coderoom_editor_theme", editorTheme);
      window.dispatchEvent(
        new CustomEvent("coderoom:theme-change", {
          detail: { theme: newTheme, editorTheme },
        })
      );
    } catch {}
  }, []);

  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem("coderoom_theme") as Theme | null;
      if (savedTheme && ["dark", "light", "cyber", "forest"].includes(savedTheme)) {
        setThemeState(savedTheme);
        applyThemeToDOM(savedTheme);
      } else {
        // Fallback to dark
        applyThemeToDOM("dark");
      }
    } catch {
      applyThemeToDOM("dark");
    }
  }, [applyThemeToDOM]);

  const setTheme = useCallback(
    (newTheme: Theme) => {
      setThemeState(newTheme);
      try {
        localStorage.setItem("coderoom_theme", newTheme);
      } catch {}
      applyThemeToDOM(newTheme);
    },
    [applyThemeToDOM]
  );

  const cycleTheme = useCallback(() => {
    const themeKeys: Theme[] = ["dark", "light", "cyber", "forest"];
    const currentIndex = themeKeys.indexOf(theme);
    const nextTheme = themeKeys[(currentIndex + 1) % themeKeys.length];
    setTheme(nextTheme);
  }, [theme, setTheme]);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
        cycleTheme,
        options: THEME_OPTIONS,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
