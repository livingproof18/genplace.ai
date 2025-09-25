"use client";

import * as React from "react";
import { X, MapPin, Wand2, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type TileMeta = {
    // Grid indices (snapped)
    x: number;
    y: number;
    zoom: number;

    // Geography (reverse geocoded)
    city?: string;
    region?: string;
    countryName?: string;
    countryCode?: string;            // e.g., "GB"
    countryFlagEmoji?: string;

    // Exact coordinate (we’ll store the snapped center you computed)
    lat?: number;
    lng?: number;

    // Painting meta
    painted: boolean;
    paintedBy?: { username: string; userId: string };
};

type Props = {
    open: boolean;
    onClose: () => void;
    tile: TileMeta | null;
    onPrimary: (tile: TileMeta) => void;        // Create
    onShare: (tile: TileMeta) => Promise<void>; // Copy link
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
    React.useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
        if (open) window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open, onClose]);

    if (!open || !tile) return null;

    // Location label
    const parts = [
        tile.city,
        tile.region,
        tile.countryName ? `${tile.countryName} ${tile.countryFlagEmoji ?? ""}` : undefined,
    ].filter(Boolean);
    const locationLabel = parts.length > 0 ? parts.join(", ") : "Unknown location";

    // Lat/lng display (snapped center)
    const coordLabel =
        tile.lat != null && tile.lng != null
            ? `${tile.lat.toFixed(5)}, ${tile.lng.toFixed(5)}`
            : "—";

    return (
        <div
            role="dialog"
            aria-label="Selected tile details"
            className={cn(
                "fixed left-1/2 -translate-x-1/2 z-[1100]",
                "w-[min(92vw,680px)]",
                "bottom-[max(1rem,env(safe-area-inset-bottom))]",
                "rounded-2xl bg-white text-black shadow-[0_12px_40px_rgba(0,0,0,.35)]",
                "border border-black/10",
                "px-5 py-4 md:px-6 md:py-5",
                "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2",
                className
            )}
        >
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="grid place-items-center rounded-full bg-blue-100 text-blue-600 h-9 w-9">
                        <MapPin className="h-4.5 w-4.5" />
                    </div>

                    <div className="min-w-0">
                        {/* Top line */}
                        <div className="flex flex-wrap items-center gap-2 text-[15px] md:text-base font-medium leading-tight">
                            <span className="opacity-70">Pixel:</span>
                            <span className="font-mono tabular-nums">{tile.x},{tile.y}</span>
                            <span className="opacity-40">•</span>
                            <span className="truncate">{locationLabel}</span>
                        </div>

                        {/* Sub line: coordinates + zoom + painted info */}
                        <div className="mt-1.5 text-sm text-black/70">
                            <span className="font-mono">{coordLabel}</span>
                            <span className="opacity-40 mx-1.5">•</span>
                            <span>z{tile.zoom}</span>
                            <span className="opacity-40 mx-1.5">•</span>
                            {tile.painted && tile.paintedBy ? (
                                <>
                                    Painted by{" "}
                                    <span className="text-black font-medium">@{tile.paintedBy.username}</span>{" "}
                                    <span className="opacity-70">#{tile.paintedBy.userId}</span>
                                </>
                            ) : (
                                <>Not painted</>
                            )}
                        </div>
                    </div>
                </div>

                {/* Close */}
                <button
                    aria-label="Close selection"
                    onClick={onClose}
                    className="h-8 w-8 grid place-items-center rounded-full text-black/70 hover:text-black
                     hover:bg-black/5 active:bg-black/10 transition-colors"
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
                        "hover:bg-gray-200 active:bg-gray-200/90 transition-colors"
                    )}
                >
                    <Share2 className="h-4.5 w-4.5" />
                    <span className="text-[15px] font-medium">Share</span>
                </button>
            </div>
        </div>
    );
}
