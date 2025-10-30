"use client";

import * as React from "react";
import { X, RotateCcw, Check, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { TokensState } from "@/hooks/use-tokens";
import type { Model, Size } from "@/components/map/types";

export type Variant = { id: string; url: string };

type Props = {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    model: Model;
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
    genError?: string | null;
};

const TIPS = [
    "Pro tip: try lighting terms like 'volumetric light'",
    "You can add styles like watercolor, low-poly, isometric",
    "Keep prompts concise; add key adjectives",
    "Use mood words like 'dreamy', 'cinematic', 'soft light'",
];

export function GenerationPanel({
    open,
    onOpenChange,
    model,
    size,
    tokens,
    generating,
    variants,
    selectedId,
    onSelect,
    onRegenerateSlot,
    onPlace,
    hasPoint,
    cooldownMs,
    genError,
}: Props) {

    const [tipIndex, setTipIndex] = React.useState(0);

    // ⏳ Rotate tips every 3 seconds while generating
    React.useEffect(() => {
        if (!generating) return;
        const interval = setInterval(() => {
            setTipIndex((prev) => (prev + 1) % TIPS.length);
        }, 3000);
        return () => clearInterval(interval);
    }, [generating]);

    // React.useEffect(() => {
    //     const key = (e: KeyboardEvent) => {
    //         if (e.key === "Escape") onOpenChange(false);
    //     };
    //     window.addEventListener("keydown", key);
    //     return () => window.removeEventListener("keydown", key);
    // }, [onOpenChange]);


    const canPlace = !!selectedId && hasPoint && tokens.current > 0 && !generating;
    if (!open) return null;

    return (
        <section
            role="dialog"
            aria-label="Image generation"
            className={cn(
                "fixed top-[max(16px,env(safe-area-inset-top))] right-[max(16px,env(safe-area-inset-right))]",
                "w-[min(520px,92vw)] h-[min(70vh,820px)] z-[1300]",
                "rounded-3xl border border-border/40 bg-background text-foreground",
                "shadow-[0_12px_40px_rgba(0,0,0,0.25)] backdrop-blur-md flex flex-col overflow-hidden transition-all duration-300"
            )}
        >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-border/50 bg-secondary/40 backdrop-blur-sm">
                <div className="text-xs sm:text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">Model:</span> {model}
                    <span className="mx-2 opacity-50">•</span>
                    <span className="font-medium text-foreground">Size:</span> {size}
                    <span className="mx-2 opacity-50">•</span>
                    <span className="font-medium text-foreground">Cost:</span> 1 token
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onOpenChange(false)}
                    className="rounded-full h-8 w-8 text-muted-foreground cursor-pointer hover:text-foreground hover:bg-accent/40 transition"
                >
                    <X className="w-4 h-4" />
                </Button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-auto p-4 space-y-4">
                {/* === Generating State === */}
                {generating && (
                    <div>
                        {/* Progress Bar */}
                        <div className="mb-3 h-2 w-full overflow-hidden rounded-full bg-muted/50">
                            <div className="h-full w-1/3 animate-[gp_progress_1.2s_linear_infinite] bg-primary/80 rounded-full" />
                        </div>

                        <p className="text-sm text-muted-foreground mb-2">
                            Dreaming up images…
                        </p>

                        {/* Animated rotating tip */}
                        <div className="relative h-5 mb-4 overflow-hidden">
                            {TIPS.map((tip, i) => (
                                <p
                                    key={i}
                                    className={cn(
                                        "absolute left-0 top-0 w-full text-xs text-muted-foreground transition-all duration-700 ease-in-out",
                                        i === tipIndex
                                            ? "opacity-100 translate-y-0"
                                            : "opacity-0 translate-y-3"
                                    )}
                                >
                                    {tip}
                                </p>
                            ))}
                        </div>

                        {/* Skeleton placeholders */}
                        <div className="grid grid-cols-2 gap-3">
                            {[0, 1].map((i) => (
                                <Skeleton
                                    key={i}
                                    className="aspect-square rounded-2xl bg-muted/50 animate-pulse"
                                />
                            ))}
                        </div>

                        <style jsx>{`
              @keyframes gp_progress {
                from {
                  transform: translateX(-100%);
                }
                to {
                  transform: translateX(300%);
                }
              }
            `}</style>
                    </div>
                )}

                {!generating && genError && (
                    <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 p-3 text-sm">
                        {genError}
                    </div>
                )}

                {/* === Preview State === */}
                {!generating && variants.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {variants.map((v, i) => {
                            const selected = selectedId === v.id;
                            return (
                                <div key={v.id} className="relative">
                                    <button
                                        onClick={() => onSelect(v.id)}
                                        className={cn(
                                            "block aspect-square w-full overflow-hidden rounded-2xl border border-border/40 transition-transform",
                                            "hover:scale-[1.02] hover:shadow-lg active:scale-[0.98]",
                                            selected && "ring-2 ring-primary ring-offset-2"
                                        )}
                                    >
                                        <img
                                            src={v.url}
                                            alt="Variant"
                                            className="h-full w-full object-cover rounded-2xl"
                                            draggable={false}
                                        />
                                    </button>

                                    {/* Regenerate Button */}
                                    <Button
                                        size="sm"
                                        variant="secondary"
                                        onClick={() => onRegenerateSlot(i as 0 | 1)}
                                        className={cn(
                                            "absolute right-2 top-2 flex items-center gap-1 rounded-full",
                                            "bg-background text-foreground border border-border/40 shadow-sm",
                                            "hover:bg-muted hover:border-border cursor-pointer transition-colors"
                                        )}
                                    >
                                        <RotateCcw className="h-3.5 w-3.5" />
                                        Regenerate
                                    </Button>


                                    {/* Selected Badge */}
                                    {selected && (
                                        <div className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-primary text-primary-foreground px-2.5 py-1 text-xs shadow-md">
                                            <Check className="h-3.5 w-3.5" />
                                            Selected
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* === Info Banner if no point selected === */}
                {!generating && variants.length > 0 && !hasPoint && (
                    <Alert
                        variant="default"
                        className="rounded-xl border border-border/50 bg-amber-50 dark:bg-amber-950/30"
                    >
                        <Info className="h-4 w-4 text-amber-500" />
                        <AlertTitle className="font-semibold text-amber-700 dark:text-amber-300">
                            Pick a tile
                        </AlertTitle>
                        <AlertDescription className="text-sm text-muted-foreground">
                            Click anywhere on the map to place this image.
                        </AlertDescription>
                    </Alert>
                )}

                {/* === Empty State === */}
                {!generating && variants.length === 0 && (
                    <div className="text-sm text-muted-foreground">
                        No previews yet. Submit a prompt from the composer to generate images.
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-border/40 bg-background/80 backdrop-blur-md">
                <div className="flex items-center justify-between">
                    <Button
                        onClick={onPlace}
                        disabled={!canPlace}
                        className={cn(
                            "rounded-full px-6 py-2 text-sm font-medium transition-all",
                            canPlace
                                ? "bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.98] cursor-pointer"
                                : "bg-muted text-muted-foreground cursor-not-allowed opacity-70"
                        )}
                    >
                        {hasPoint ? "Place on selected tile" : "Click the map to pick a tile"}
                    </Button>

                    <div className="text-xs font-mono text-muted-foreground">
                        {tokens.current > 0
                            ? `Tokens ${tokens.current}/${tokens.max}`
                            : `Out of tokens — +1 in ${Math.ceil(cooldownMs / 1000)}s`}
                    </div>
                </div>
            </div>
        </section>
    );
}
