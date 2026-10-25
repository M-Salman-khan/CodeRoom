import React, { createContext, useContext, useEffect, useState, useCallback } from "react";

export type Theme = "light" | "dark";

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
    id: "light",
    name: "Light",
    badge: "Default",
    description: "Clean monochrome light interface",
    accentHex: "#18181b",
    bgHex: "#ffffff",
  },
  {
    id: "dark",
    name: "Dark",
    badge: "Dim",
    description: "Clean monochrome dark interface",
    accentHex: "#fafafa",
    bgHex: "#09090b",
  },
];

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  cycleTheme: () => void;
  options: ThemeOption[];
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_KEYS = THEME_OPTIONS.map((o) => o.id);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark");

  const applyThemeToDOM = useCallback((newTheme: Theme) => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    root.classList.remove("dark", "light");

    if (newTheme === "light") {
      root.classList.add("light");
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
      if (savedTheme === "light" || savedTheme === "dark") {
        setThemeState(savedTheme);
        applyThemeToDOM(savedTheme);
      } else {
        // Migrate old themes (cyber/forest) or fall back to dark
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
    const currentIndex = THEME_KEYS.indexOf(theme);
    const nextTheme = THEME_KEYS[(currentIndex + 1) % THEME_KEYS.length];
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
