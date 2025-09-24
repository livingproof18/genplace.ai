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
            {/* Help */}
            <button
                onClick={onHelp}
                className="pointer-events-auto control-glass control-icon"
                aria-label="Help / Info"
                title="Help / Info"
            >
                <HelpCircle className="icon-4" />
            </button>

            {/* Zoom group */}
            <div className="pointer-events-auto control-glass flex overflow-hidden">
                <button
                    onClick={onZoomIn}
                    className="control-icon"
                    aria-label="Zoom in"
                    title="Zoom in"
                >
                    <Plus className="icon-4" />
                </button>
                <button
                    onClick={onZoomOut}
                    className="control-icon border-l border-white/10"
                    aria-label="Zoom out"
                    title="Zoom out"
                >
                    <Minus className="icon-4" />
                </button>
            </div>

            {/* Share */}
            <button
                onClick={onShare}
                className="pointer-events-auto control-glass control-icon"
                aria-label="Share"
                title="Share"
            >
                <Share2 className="icon-4" />
            </button>

            {/* Show/Hide overlays */}
            <button
                onClick={onToggleOverlays}
                className="pointer-events-auto control-glass control-icon"
                aria-label={overlaysVisible ? "Hide overlay" : "Show overlay"}
                title={overlaysVisible ? "Hide overlay" : "Show overlay"}
            >
                {overlaysVisible ? <Eye className="icon-4" /> : <EyeOff className="icon-4" />}
            </button>
        </div>
    );
}
