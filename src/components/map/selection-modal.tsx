// src/components/map/selection-modal.tsx
"use client";

import * as React from "react";
import { X, MapPin, Wand2, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";

export type TileMeta = {
    x: number;
    y: number;
    zoom: number;
    displayName?: string;               // <- preferred short label (e.g., "London")
    city?: string;
    region?: string;
    countryName?: string;
    countryCode?: string;
    countryFlagEmoji?: string;
    lat?: number;
    lng?: number;
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
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        if (open) window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open, onClose]);

    // Color helpers
    const safeHsl = (h: number, s = 62, l = 45) => `hsl(${h} ${s}% ${l}%)`;
    const lightnessToTextColor = (l: number) => (l > 60 ? "#111827" : "#ffffff");

    /**
     * Memoized color generation:
     * - hue1 => username/id accent + avatar bg
     * - hue2 => location chip (text + background)
     *
     * Both hues are chosen randomly but tuned by resolvedTheme so contrast is okay in light & dark modes.
     */
    const {
        accentColor,
        avatarBg,
        avatarText,
        locationTextColor,
        locationBgColor,
    } = React.useMemo(() => {
        const randHue = () => Math.floor(Math.random() * 360);
        const hue1 = randHue();
        const hue2 = randHue();
        const isDark = resolvedTheme === "dark";

        // Username accent (hue1)
        const accentLight = isDark ? 74 : 34;
        const accent = safeHsl(hue1, 66, accentLight);

        const avatarLight = isDark ? 48 : 42;
        const avatar = safeHsl(hue1, 60, avatarLight);
        const avatarTextColor = lightnessToTextColor(avatarLight);

        // Location chip (hue2): choose contrasting lightness for text and background depending on theme
        const locTextLight = isDark ? 86 : 28; // lighter text in dark mode, darker in light mode
        const locBgLight = isDark ? 22 : 96; // dark bg in dark mode, very light in light mode
        const locText = safeHsl(hue2, 68, locTextLight);
        const locBg = safeHsl(hue2, 20, locBgLight);

        return {
            accentColor: accent,
            avatarBg: avatar,
            avatarText: avatarTextColor,
            locationTextColor: locText,
            locationBgColor: locBg,
        };
    }, [open, tile?.paintedBy?.username, tile?.paintedBy?.userId, resolvedTheme]);

    const getInitials = (name?: string) => {
        if (!name) return "?";
        const parts = name.trim().split(/\s+/).slice(0, 2);
        return parts.map((p) => p[0]?.toUpperCase() ?? "").join("");
    };

    // Early return (hooks already declared)
    if (!open || !tile) return null;

    // Prefer a short displayName (set by reverseGeocode). Fallback to city -> region -> countryName.
    const placeName =
        (tile.displayName && tile.displayName.trim()) ||
        (tile.city && tile.city.trim()) ||
        (tile.region && tile.region.trim()) ||
        (tile.countryName && tile.countryName.trim()) ||
        null;

    const placeLabel = placeName ?? "Unknown location";

    // Compose the location chip content: show the concise place + flag (or country code)
    const flagOrCode = tile.countryFlagEmoji ?? tile.countryCode ?? "";

    // Set an aria-friendly label (keeps it short)
    const locationAria = tile.displayName
        ? `${tile.displayName}${flagOrCode ? ` ${flagOrCode}` : ""}`
        : placeLabel;

    const coordLabel =
        tile.lat != null && tile.lng != null
            ? `${tile.lat.toFixed(5)},${tile.lng.toFixed(5)}`
            : "—";

    // TEMP stub (remove in prod)
    tile.painted = true;
    tile.paintedBy = tile.paintedBy ?? { username: "alice", userId: "1234" };

    return (
        <div
            role="dialog"
            aria-label="Selected tile details"
            className={cn(
                "fixed left-1/2 -translate-x-1/2 z-[1100]",
                "w-[min(92vw,600px)]",
                "bottom-[max(1rem,env(safe-area-inset-bottom))]",
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
                        {/* Top line: coords + bullet + location chip */}
                        <div className="flex flex-wrap items-center gap-2 text-[16px] md:text-xl font-medium leading-tight">
                            <span className="font-mono text-slate-700 dark:text-slate-300">{coordLabel}</span>
                            <span className="opacity-40">•</span>

                            {/* Location chip (smaller font, padded, rounded, subtle bg) */}
                            <span
                                role="note"
                                aria-label={`Location: ${locationAria}`}
                                className="truncate inline-block text-xs md:text-sm font-semibold"
                                style={{
                                    background: locationBgColor,
                                    color: locationTextColor,
                                    padding: "4px 8px",
                                    borderRadius: 8,
                                    maxWidth: "48ch",
                                }}
                            >
                                {/* Show the concise place name + flag (or country code) */}
                                <span className="align-middle truncate">{placeLabel}</span>
                                {flagOrCode ? <span className="ml-2 align-middle">{flagOrCode}</span> : null}
                            </span>
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

                                        <span className="font-medium truncate max-w-[10rem]" style={{ color: accentColor }}>
                                            @{tile.paintedBy.username}
                                        </span>

                                        {/* same accent for id */}
                                        <span className="opacity-85 font-mono text-xs" style={{ color: accentColor }}>
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
