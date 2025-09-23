// src/components/map/selection-modal.tsx
"use client";

import { X, MapPin, Wand2, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";
import * as React from "react";

export type TileMeta = {
    x: number;
    y: number;
    zoom: number;
    countryName?: string;
    countryFlagEmoji?: string;
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
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        if (open) window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open, onClose]);

    if (!open || !tile) return null;

    const locationLabel =
        tile.countryName ? `${tile.countryName} ${tile.countryFlagEmoji ?? ""}` : "Unknown location";

    return (
        <div
            role="dialog"
            aria-label="Selected tile details"
            className={cn(
                "fixed left-1/2 -translate-x-1/2 z-[1100] bottom-6 sm:bottom-7",
                "max-w-[640px] w-[min(92vw,640px)]",
                "rounded-2xl glass ring-gradient shadow-lg backdrop-blur",
                "px-4 py-3 md:px-5 md:py-4",
                "motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95",
                className
            )}
        >
            {/* Header */}
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                    <div className="grid place-items-center rounded-full bg-primary/15 text-primary h-8 w-8">
                        <MapPin className="h-4 w-4" />
                    </div>
                    <div className="flex items-center gap-2 min-w-0 text-sm md:text-base">
                        <span className="text-muted-foreground">Tile:</span>
                        <span className="font-mono tabular-nums">{tile.x},{tile.y}</span>
                        <span className="opacity-40">•</span>
                        <span className="truncate">{locationLabel}</span>
                    </div>
                </div>

                <button
                    aria-label="Close selection"
                    onClick={onClose}
                    className="h-8 w-8 grid place-items-center rounded-full hover:bg-white/10 transition"
                >
                    <X className="h-4 w-4" />
                </button>
            </div>

            {/* Body */}
            <div className="mt-2 text-sm text-muted-foreground">
                {tile.painted && tile.paintedBy ? (
                    <span>
                        Painted by <span className="text-foreground">@{tile.paintedBy.username}</span>{" "}
                        <span className="opacity-70">#{tile.paintedBy.userId}</span>
                    </span>
                ) : (
                    <span>Not painted</span>
                )}
            </div>

            {/* Actions */}
            <div className="mt-3 flex flex-col sm:flex-row gap-2">
                <button
                    aria-label={`Create new image for tile ${tile.x},${tile.y}`}
                    title={canCreate ? "Create an image for this tile" : disabledReason}
                    onClick={canCreate ? () => onPrimary(tile) : undefined}
                    disabled={!canCreate}
                    className={cn(
                        "inline-flex items-center justify-center gap-2 rounded-xl px-4 h-11 w-full sm:flex-1",
                        "bg-primary text-primary-foreground border border-white/10 btn-glow",
                        "transition motion-safe:active:scale-[0.98] hover:brightness-110",
                        !canCreate &&
                        "bg-primary/50 text-primary-foreground/70 cursor-not-allowed hover:brightness-100"
                    )}
                >
                    <Wand2 className="h-4 w-4" />
                    <span className="font-medium">Create</span>
                </button>

                <button
                    aria-label={`Share link to tile ${tile.x},${tile.y}`}
                    onClick={() => onShare(tile)}
                    className={cn(
                        "inline-flex items-center justify-center gap-2 rounded-xl px-4 h-11 w-full sm:flex-1",
                        "border bg-card/60 hover:bg-card/80 transition"
                    )}
                >
                    <Share2 className="h-4 w-4" />
                    <span className="font-medium">Share</span>
                </button>
            </div>
        </div>
    );
}
