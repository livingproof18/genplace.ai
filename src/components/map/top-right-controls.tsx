// src/components/map/top-right-controls.tsx
"use client";

import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { LocateFixed, Shuffle } from "lucide-react";
import { useTheme } from "next-themes";
import * as React from "react";

type UserStub = {
    name?: string;         // display name (e.g., "Alice Johnson")
    username?: string;     // handle (e.g., "alice")
    userId?: string;       // id string (e.g., "1234")
    firstName?: string;    // optional explicit first name
    avatarUrl?: string;    // optional real avatar URL (not used here)
};

type Props = {
    onLogin?: () => void;
    loginHref?: string;
    onLocateMe?: () => void;
    onRandom?: () => void;
    user?: UserStub | null;
};

export function TopRightControls({
    onLogin,
    loginHref = "/login",
    onLocateMe,
    onRandom,
    user = null,
}: Props) {
    const { resolvedTheme } = useTheme(); // "light" | "dark" | undefined

    // -------------------------
    // Helpers
    // -------------------------
    const safeHsl = (h: number, s = 62, l = 45) => `hsl(${h} ${s}% ${l}%)`;
    const lightnessToTextColor = (l: number) => (l > 60 ? "#111827" : "#ffffff");

    // initials from firstName/name
    const initials = React.useMemo(() => {
        const display = user?.firstName ?? user?.name ?? "";
        if (!display) return "?";
        const parts = display.trim().split(/\s+/).slice(0, 2);
        return parts.map(p => (p[0] ?? "").toUpperCase()).join("");
    }, [user?.firstName, user?.name]);

    // Colors: stable per (user.name or theme) while those dependencies don't change
    const { avatarBg, avatarText, accentColor } = React.useMemo(() => {
        // If you later want deterministic per-username colors use hash(username) % 360 instead of rand
        const randHue = () => Math.floor(Math.random() * 360);
        const hue = randHue();
        const isDark = resolvedTheme === "dark";

        const avatarLight = isDark ? 48 : 42;
        const avatar = safeHsl(hue, 60, avatarLight);
        const avatarTextColor = lightnessToTextColor(avatarLight);

        const accentLight = isDark ? 74 : 34;
        const accent = safeHsl(hue, 66, accentLight);

        return { avatarBg: avatar, avatarText: avatarTextColor, accentColor: accent };
    }, [user?.name, user?.firstName, resolvedTheme]);

    // popover open state
    const [open, setOpen] = React.useState(false);
    const rootRef = React.useRef<HTMLDivElement | null>(null);

    // close on outside click
    React.useEffect(() => {
        function onDocDown(e: MouseEvent | TouchEvent) {
            const el = rootRef.current;
            if (!el) return;
            const target = e.target as Node | null;
            if (target && !el.contains(target)) setOpen(false);
        }
        document.addEventListener("mousedown", onDocDown);
        document.addEventListener("touchstart", onDocDown);
        return () => {
            document.removeEventListener("mousedown", onDocDown);
            document.removeEventListener("touchstart", onDocDown);
        };
    }, []);

    // close on Esc
    React.useEffect(() => {
        function onKey(ev: KeyboardEvent) {
            if (ev.key === "Escape") setOpen(false);
        }
        if (open) window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open]);

    // action handlers for gallery / likes (stubbed)
    const openGallery = () => {
        setOpen(false);
        // dispatch or navigate: replace with real route or event
        window.alert("Open Gallery (stub)");
    };
    const openLikes = () => {
        setOpen(false);
        // dispatch or navigate: replace with real route or event
        window.alert("Open Likes (stub)");
    };

    return (
        <div
            ref={rootRef}
            className="pointer-events-none fixed top-3 right-3 z-[1000] flex flex-col gap-2 items-end"
            aria-live="polite"
        >
            {/* Profile / Login (pointer-events-auto inside to keep outside overlay behavior) */}
            <div className="pointer-events-auto relative">
                {user ? (
                    /* Avatar button only (no name) */
                    <button
                        onClick={() => setOpen(v => !v)}
                        title={user.name ? `Signed in as ${user.name}` : "Profile"}
                        aria-label={user.name ? `Signed in as ${user.name}` : "Profile"}
                        className="inline-grid h-9 w-9 place-items-center rounded-full shadow-sm hover:scale-[1.03] active:scale-95 transition-transform bg-white/85 dark:bg-slate-800/70 border border-black/8 dark:border-white/6"
                        style={{ padding: 2 }}
                    >
                        <span
                            className="inline-grid h-8 w-8 place-items-center rounded-full text-xs font-semibold"
                            style={{ background: avatarBg, color: avatarText }}
                            aria-hidden
                        >
                            {initials}
                        </span>
                    </button>
                ) : onLogin ? (
                    <button
                        onClick={onLogin}
                        className="control-solid-primary control-pill"
                        aria-label="Login"
                        title="Login"
                    >
                        Login
                    </button>
                ) : (
                    <Link
                        href={loginHref}
                        className="control-solid-primary control-pill"
                        aria-label="Login"
                        title="Login"
                    >
                        Login
                    </Link>
                )}

                {/* Popover: anchored beneath avatar */}
                {user && open && (
                    <div
                        role="dialog"
                        aria-label="User menu"
                        className={`
              absolute right-0 mt-2 w-[220px] rounded-xl border bg-white text-black shadow-[0_12px_40px_rgba(0,0,0,.25)]
              dark:bg-slate-900 dark:text-white dark:border-white/10
              ring-1 ring-black/5 dark:ring-white/5
              py-3 px-3
            `}
                        style={{ zIndex: 1100 }}
                    >
                        {/* Top: avatar + username/id */}
                        <div className="flex items-center gap-3 px-1">
                            <div
                                className="h-12 w-12 rounded-full grid place-items-center text-sm font-semibold flex-shrink-0"
                                style={{ background: avatarBg, color: avatarText }}
                                aria-hidden
                            >
                                {initials}
                            </div>

                            <div className="min-w-0">
                                <div
                                    className="truncate font-medium"
                                    style={{ color: accentColor }}
                                >
                                    @{user.username ?? (user.name?.replace(/\s.*$/, "")?.toLowerCase() ?? (user.firstName ?? "user"))}
                                </div>
                                <div className="text-xs font-mono text-slate-500 dark:text-slate-400 truncate">
                                    #{user.userId ?? "—"}
                                </div>
                            </div>
                        </div>

                        <div className="mt-3 border-t border-black/6 dark:border-white/6 -mx-3 px-3 pt-3 grid gap-2">
                            <button
                                onClick={openGallery}
                                className="w-full inline-flex items-center justify-center gap-2 rounded-full px-3 py-2 text-sm font-medium bg-[rgba(59,130,246,0.09)] hover:bg-[rgba(59,130,246,0.12)] dark:bg-[rgba(59,130,246,0.08)] dark:hover:bg-[rgba(59,130,246,0.12)] text-blue-600 dark:text-blue-300 transition"
                            >
                                Gallery
                            </button>

                            <button
                                onClick={openLikes}
                                className="w-full inline-flex items-center justify-center gap-2 rounded-full px-3 py-2 text-sm font-medium bg-[rgba(17,24,39,0.06)] hover:bg-[rgba(17,24,39,0.09)] dark:bg-[rgba(255,255,255,0.03)] dark:hover:bg-[rgba(255,255,255,0.05)] text-slate-800 dark:text-slate-100 transition"
                            >
                                Likes
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Theme toggle — compact glass */}
            <div className="pointer-events-auto control-glass">
                <ThemeToggle />
            </div>

            {/* Locate me — compact glass icon */}
            <button
                onClick={onLocateMe}
                className="pointer-events-auto control-glass control-icon"
                aria-label="Go to my location"
                title="Go to my location"
            >
                <LocateFixed className="icon-4" />
            </button>

            {/* Random location — compact glass icon */}
            <button
                onClick={onRandom}
                className="pointer-events-auto control-glass control-icon"
                aria-label="Take me somewhere random"
                title="Take me somewhere random"
            >
                <Shuffle className="icon-4" />
            </button>
        </div>
    );
}
