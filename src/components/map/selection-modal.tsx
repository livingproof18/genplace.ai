"use client";

import * as React from "react";
import { X, MapPin, Wand2, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";

export type TileMeta = {
    x: number; y: number; zoom: number;
    city?: string; region?: string; countryName?: string; countryCode?: string;
    countryFlagEmoji?: string;
    lat?: number; lng?: number;
    painted: boolean;
    paintedBy?: { username: string; userId: string };
};

type Props = {
    open: boolean;
    onClose: () => void;
    tile: TileMeta | null;
    onPrimary: (tile: TileMeta) => void;
    onShare: (tile: TileMeta) => Promise<void>;
    canCreate: boolean;
    disabledReason?: string;
    className?: string;
};

export function SelectionModal({
    open,
    onClose,
    tile,
    onPrimary,
    onShare,
    canCreate,
    disabledReason = "You're out of tokens — regenerates soon",
    className,
}: Props) {
    // --- Hooks at top (stable order) ---
    const { resolvedTheme } = useTheme(); // "light" | "dark" | undefined

    React.useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
        if (open) window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open, onClose]);

    // Color helpers
    const safeHsl = (h: number, s = 62, l = 45) => `hsl(${h} ${s}% ${l}%)`;
    const lightnessToTextColor = (l: number) => (l > 60 ? "#111827" : "#ffffff");

    // Memoized color generation — single hue used for both username & id so they match
    const { accentColor, avatarBg, avatarText } = React.useMemo(() => {
        const randHue = () => Math.floor(Math.random() * 360);
        const hue = randHue();
        const isDark = resolvedTheme === "dark";

        // pick slightly lighter accents for dark mode to keep contrast
        const accentLight = isDark ? 74 : 34;
        const accent = safeHsl(hue, 66, accentLight);

        // avatar background derived from same hue, but tuned lightness
        const avatarLight = isDark ? 48 : 42;
        const avatar = safeHsl(hue, 60, avatarLight);
        const avatarTextColor = lightnessToTextColor(avatarLight);

        return { accentColor: accent, avatarBg: avatar, avatarText: avatarTextColor };
    }, [open, tile?.paintedBy?.username, tile?.paintedBy?.userId, resolvedTheme]);

    const getInitials = (name?: string) => {
        if (!name) return "?";
        const parts = name.trim().split(/\s+/).slice(0, 2);
        return parts.map(p => p[0]?.toUpperCase() ?? "").join("");
    };

    // Early return safe (hooks already declared above)
    if (!open || !tile) return null;

    const parts = [
        tile.city,
        tile.region,
        tile.countryName ? `${tile.countryName} ${tile.countryFlagEmoji ?? ""}` : undefined,
    ].filter(Boolean);
    const locationLabel = parts.length > 0 ? parts.join(", ") : "Unknown location";

    const coordLabel =
        tile.lat != null && tile.lng != null
            ? `${tile.lat.toFixed(5)},${tile.lng.toFixed(5)}`
            : "—";

    // Render
    return (
        <div
            role="dialog"
            aria-label="Selected tile details"
            className={cn(
                "fixed left-1/2 -translate-x-1/2 z-[1100]",
                "w-[min(92vw,600px)]",
                "bottom-[max(1rem,env(safe-area-inset-bottom))]",
                // light / dark backgrounds + borders
                "rounded-3xl bg-white text-black shadow-[0_12px_40px_rgba(0,0,0,.35)]",
                "border border-black/10",
                "dark:bg-slate-900 dark:text-white dark:border-white/10 dark:shadow-[0_12px_40px_rgba(0,0,0,.6)]",
                "px-5 py-4 md:px-6 md:py-5",
                "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2",
                className
            )}
        >
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="grid place-items-center rounded-full bg-blue-100 text-blue-600 h-9 w-9 dark:bg-blue-900/40 dark:text-blue-300">
                        <MapPin className="h-4.5 w-4.5" />
                    </div>

                    <div className="min-w-0">
                        {/* Top line */}
                        <div className="flex flex-wrap items-center gap-2 text-[16px] md:text-xl font-medium leading-tight">
                            <span className="font-mono text-slate-700 dark:text-slate-300">{coordLabel}</span>
                            <span className="opacity-40">•</span>
                            <span className="truncate text-slate-700 dark:text-slate-300">{locationLabel}</span>
                        </div>

                        {/* Sub line */}
                        <div className="mt-1.5 text-sm md:text-base text-slate-600 dark:text-slate-400">
                            {tile.painted && tile.paintedBy ? (
                                <div className="flex items-center gap-2">
                                    <span className="text-slate-600 dark:text-slate-400">Created by</span>

                                    <div className="flex items-center gap-2">
                                        <div
                                            className="h-6 w-6 rounded-full grid place-items-center text-xs font-semibold flex-shrink-0"
                                            style={{ background: avatarBg, color: avatarText }}
                                            aria-hidden
                                        >
                                            {getInitials(tile.paintedBy.username)}
                                        </div>

                                        <span
                                            className="font-medium truncate max-w-[10rem]"
                                            style={{ color: accentColor }}
                                        >
                                            @{tile.paintedBy.username}
                                        </span>

                                        {/* same accent for id */}
                                        <span
                                            className="opacity-85 font-mono text-xs"
                                            style={{ color: accentColor }}
                                        >
                                            #{tile.paintedBy.userId}
                                        </span>
                                    </div>
                                </div>
                            ) : (
                                <>Empty</>
                            )}
                        </div>
                    </div>
                </div>

                {/* Close */}
                <button
                    aria-label="Close selection"
                    onClick={onClose}
                    className="h-8 w-8 grid place-items-center rounded-full text-black/70 hover:text-black hover:bg-black/5 active:bg-black/10 transition-colors hover:scale-[1.05] active:scale-95 hover:cursor-pointer dark:text-white/70 dark:hover:text-white dark:hover:bg-white/5"
                >
                    <X className="h-4 w-4" />
                </button>
            </div>

            {/* Actions */}
            <div className="mt-4 flex flex-wrap items-center gap-2.5">
                <button
                    aria-label={`Create new image for tile ${tile.x},${tile.y}`}
                    title={canCreate ? "Create an image for this tile" : disabledReason}
                    onClick={canCreate ? () => onPrimary(tile) : undefined}
                    disabled={!canCreate}
                    className={cn(
                        "inline-flex items-center gap-2 rounded-full px-5 h-11",
                        "bg-[hsl(var(--primary))] text-white",
                        "shadow-[0_6px_20px_rgba(59,130,246,.35)]",
                        "transition-colors motion-safe:active:scale-[0.99]",
                        "hover:brightness-105",
                        "hover:cursor-pointer",
                        !canCreate && "opacity-60 cursor-not-allowed hover:brightness-100"
                    )}
                >
                    <Wand2 className="h-4.5 w-4.5" />
                    <span className="text-[15px] font-semibold">Create</span>
                </button>

                <button
                    aria-label={`Share link to tile ${tile.x},${tile.y}`}
                    onClick={() => onShare(tile)}
                    className={cn(
                        "inline-flex items-center gap-2 rounded-full px-5 h-11",
                        "bg-gray-100 text-gray-900 border border-black/10",
                        "hover:bg-gray-200 active:bg-gray-200/90 transition-colors",
                        "hover:cursor-pointer",
                        "dark:bg-gray-800 dark:text-gray-100 dark:border-white/10 dark:hover:bg-gray-700/90"
                    )}
                >
                    <Share2 className="h-4.5 w-4.5" />
                    <span className="text-[15px] font-medium">Share</span>
                </button>
            </div>
        </div>
    );
}
