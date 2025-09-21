// src/components/map/top-left-controls.tsx
"use client";

import { HelpCircle, Plus, Minus, Share2, Eye, EyeOff } from "lucide-react";

type Props = {
    onHelp: () => void;
    onZoomIn: () => void;
    onZoomOut: () => void;
    onShare: () => void;
    overlaysVisible: boolean;
    onToggleOverlays: () => void;
};

export function TopLeftControls({
    onHelp,
    onZoomIn,
    onZoomOut,
    onShare,
    overlaysVisible,
    onToggleOverlays,
}: Props) {
    return (
        <div className="pointer-events-none fixed top-3 left-3 z-[1000] flex gap-2">
            {/* Help / Info */}
            <button
                onClick={onHelp}
                className="pointer-events-auto h-11 w-11 grid place-items-center rounded-full border bg-background/70 backdrop-blur shadow-md hover:bg-background/90 transition"
                aria-label="Help / Info"
                title="Help / Info"
            >
                <HelpCircle className="h-5 w-5" />
            </button>

            {/* Zoom group */}
            <div className="pointer-events-auto flex rounded-full border bg-background/70 backdrop-blur shadow-md overflow-hidden">
                <button
                    onClick={onZoomIn}
                    className="h-11 w-11 grid place-items-center hover:bg-background/90 transition"
                    aria-label="Zoom in"
                    title="Zoom in"
                >
                    <Plus className="h-5 w-5" />
                </button>
                <button
                    onClick={onZoomOut}
                    className="h-11 w-11 grid place-items-center hover:bg-background/90 transition border-l"
                    aria-label="Zoom out"
                    title="Zoom out"
                >
                    <Minus className="h-5 w-5" />
                </button>
            </div>

            {/* Social */}
            <button
                onClick={onShare}
                className="pointer-events-auto h-11 w-11 grid place-items-center rounded-full border bg-background/70 backdrop-blur shadow-md hover:bg-background/90 transition"
                aria-label="Share"
                title="Share"
            >
                <Share2 className="h-5 w-5" />
            </button>

            {/* Show/Hide overlays */}
            <button
                onClick={onToggleOverlays}
                className="pointer-events-auto h-11 w-11 grid place-items-center rounded-full border bg-background/70 backdrop-blur shadow-md hover:bg-background/90 transition"
                aria-label={overlaysVisible ? "Hide overlay" : "Show overlay"}
                title={overlaysVisible ? "Hide overlay" : "Show overlay"}
            >
                {overlaysVisible ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
            </button>
        </div>
    );
}
