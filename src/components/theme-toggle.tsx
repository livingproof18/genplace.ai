// src/components/theme-toggle.tsx
"use client";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

export function ThemeToggle() {
    const { theme, resolvedTheme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

    // When theme = "system", resolvedTheme is "light" | "dark"
    const isDark = theme === "dark" || (theme === "system" && resolvedTheme === "dark");

    // Avoid rendering theme-dependent markup on the server
    if (!mounted) {
        return (
            <button
                className="inline-flex h-10 items-center gap-2 rounded-2xl border border-border/50 px-4"
                aria-label="Toggle theme"
            // reserve icon space so layout doesn't jump
            >
                <Sun size={16} className="opacity-0" />
                <span className="text-sm">Theme</span>
            </button>
        );
    }

    return (
        <button
            onClick={() => setTheme(isDark ? "light" : "dark")}
            className="inline-flex h-10 items-center gap-2 rounded-2xl border border-border/50 px-4 cursor-pointer hover:bg-card/60"
            title="Toggle theme"
        >
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
            {/* <span className="text-sm">{isDark ? "Light" : "Dark"}</span> */}
        </button>
    );
}
