// src/components/theme-toggle.tsx
"use client";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";

export function ThemeToggle() {
    const { theme, setTheme } = useTheme();
    const isDark = theme === "dark";
    return (
        <button
            onClick={() => setTheme(isDark ? "light" : "dark")}
            className="inline-flex h-10 items-center gap-2 rounded-2xl border border-border/50 px-4 hover:bg-card/60"
            title="Toggle theme"
        >
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
            <span className="text-sm">{isDark ? "Light" : "Dark"}</span>
        </button>
    );
}
