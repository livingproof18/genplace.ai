"use client";

import * as React from "react";
import { X, RotateCcw, Check, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TokensState } from "@/hooks/use-tokens";
import type { Model } from "@/components/map/types";

export type Variant = { id: string; url: string };
export type Size = 128 | 256 | 512;

type Props = {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    model: Model
    size: Size;
    tokens: TokensState;

    generating: boolean;
    variants: Variant[];
    selectedId: string | null;
    onSelect: (id: string | null) => void;

    onRegenerateSlot: (slot: 0 | 1) => void;
    onPlace: () => void;
    hasPoint: boolean;
    cooldownMs: number;
};

const TIPS = [
    "Pro tip: try lighting terms like 'volumetric light'",
    "You can add styles like watercolor, low-poly, isometric",
    "Keep prompts concise; add key adjectives",
];

export function GenerationPanel({
    open, onOpenChange, model, size, tokens,
    generating, variants, selectedId, onSelect,
    onRegenerateSlot, onPlace, hasPoint, cooldownMs,
}: Props) {
    React.useEffect(() => {
        const key = (e: KeyboardEvent) => {
            if (e.key === "Escape") onOpenChange(false);
        };
        window.addEventListener("keydown", key);
        return () => window.removeEventListener("keydown", key);
    }, [onOpenChange]);

    const canPlace = !!selectedId && hasPoint && tokens.current > 0 && !generating;

    if (!open) return null;

    return (
        <section
            className={cn(
                "fixed top-[max(16px,env(safe-area-inset-top))] right-[max(16px,env(safe-area-inset-right))]",
                "w-[min(520px,92vw)] h-[min(80vh,900px)] z-[1300]",
                "rounded-2xl bg-white text-black border border-black/10 shadow-[0_12px_40px_rgba(0,0,0,.35)]",
                "flex flex-col overflow-hidden"
            )}
            role="dialog"
            aria-label="Image generation"
        >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
                <div className="text-xs text-slate-700">
                    <span className="font-medium">Model:</span> {model}
                    <span className="mx-2 opacity-50">•</span>
                    <span className="font-medium">Size:</span> {size}
                    <span className="mx-2 opacity-50">•</span>
                    <span className="font-medium">Cost:</span> 1 token
                </div>
                <button onClick={() => onOpenChange(false)} aria-label="Close" className="h-8 w-8 grid place-items-center rounded-full hover:bg-black/5">
                    <X className="w-4 h-4" />
                </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-auto p-4">
                {/* Generating */}
                {generating && (
                    <div>
                        <div className="mb-3 h-2 w-full overflow-hidden rounded bg-gray-200">
                            <div className="h-full w-1/3 animate-[gp_progress_1.2s_linear_infinite] bg-blue-500" />
                        </div>
                        <p className="text-sm text-slate-600 mb-3">Dreaming up images…</p>
                        <div className="grid grid-cols-2 gap-3">
                            {[0, 1].map((i) => (
                                <div key={i} className="aspect-square rounded-xl bg-gray-200 animate-pulse" />
                            ))}
                        </div>
                        <ul className="mt-4 text-xs text-slate-500 list-disc pl-5 space-y-1">
                            {TIPS.map((t, i) => <li key={i}>{t}</li>)}
                        </ul>
                        <style jsx>{`
              @keyframes gp_progress { from { transform: translateX(-100%); } to { transform: translateX(300%); } }
            `}</style>
                    </div>
                )}

                {/* Preview */}
                {!generating && variants.length > 0 && (
                    <div className="grid grid-cols-2 gap-3">
                        {variants.map((v, i) => {
                            const selected = selectedId === v.id;
                            return (
                                <div key={v.id} className="relative">
                                    <button
                                        onClick={() => onSelect(v.id)}
                                        className={cn(
                                            "block aspect-square w-full overflow-hidden rounded-xl border",
                                            "hover:brightness-105",
                                            selected && "ring-2 ring-blue-600 ring-offset-2"
                                        )}
                                    >
                                        <img src={v.url} alt="Variant" className="h-full w-full object-cover" draggable={false} />
                                    </button>
                                    <button
                                        onClick={() => onRegenerateSlot(i as 0 | 1)}
                                        className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-md bg-white/95 px-2 py-1 text-xs shadow hover:bg-white"
                                    >
                                        <RotateCcw className="h-3.5 w-3.5" />
                                        Regenerate
                                    </button>
                                    {selected && (
                                        <div className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-md bg-blue-600 px-2 py-1 text-xs text-white shadow">
                                            <Check className="h-3.5 w-3.5" />
                                            Selected
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Idea-first banner */}
                {!generating && variants.length > 0 && !hasPoint && (
                    <div className="mt-4 rounded-lg border p-3 bg-amber-50 text-sm flex items-start gap-2">
                        <Info className="w-4 h-4 mt-0.5" />
                        <div>
                            Pick a tile on the map to place this image. (Click anywhere on the map.)
                        </div>
                    </div>
                )}

                {/* Token status */}
                {!generating && variants.length === 0 && (
                    <div className="text-sm text-slate-500">
                        No previews yet. Submit a prompt from the composer to generate images.
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="p-3 border-t bg-white">
                <div className="flex items-center justify-between">
                    <button
                        onClick={onPlace}
                        disabled={!canPlace}
                        className={cn(
                            "inline-flex items-center gap-2 rounded-md px-4 py-2 text-white",
                            canPlace ? "bg-blue-600 hover:bg-blue-700" : "bg-gray-300 cursor-not-allowed"
                        )}
                    >
                        Place (1 token)
                    </button>
                    <div className="text-xs font-mono text-slate-600">
                        {tokens.current > 0 ? `Tokens ${tokens.current}/${tokens.max}` : `Out of tokens — +1 in ${Math.ceil(cooldownMs / 1000)}s`}
                    </div>
                </div>
            </div>
        </section>
    );
}
