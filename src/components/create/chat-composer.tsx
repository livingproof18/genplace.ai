"use client";

import * as React from "react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Rocket, ChevronDown, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TokensState } from "@/hooks/use-tokens";
import { X } from "lucide-react";
import type { Model } from "@/components/map/types";

export type Size = 128 | 256 | 512;


type Props = {
    tokens: TokensState;
    prompt: string;
    onPrompt: (v: string) => void;
    model: Model;
    onModel: (m: Model) => void;
    size: Size;
    onSize: (s: Size) => void;
    canSubmit: boolean;
    cooldownLabel: string;
    onSubmit: () => void;
};

const TIPS = [
    "A tiny dragon curled on a teacup, cozy morning light",
    "Retro pixel art spaceship over neon city",
    "A fox wearing headphones in a rainy café",
    "Surreal floating islands at sunset",
    "Cute robot watering houseplants, isometric",
    "Ancient temple in a lush jungle, cinematic lighting",
    "A watercolor map of a fantasy archipelago",
    "Low-poly camper van parked under the stars",
];

export function ChatComposer({
    tokens, prompt, onPrompt, model, onModel, size, onSize, canSubmit, cooldownLabel, onSubmit,
}: Props) {
    const [inspOpen, setInspOpen] = React.useState(false);
    const [sizeOpen, setSizeOpen] = React.useState(false);
    const taRef = React.useRef<HTMLTextAreaElement | null>(null);

    const tokenHud =
        `Tokens ${tokens.current}/${tokens.max}` +
        (tokens.current < tokens.max ? ` • +1 in ${cooldownLabel.replace(/^Next \+1 in /, "")}` : "");

    const onKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement> = (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onSubmit();
        }
    };

    return (
        <div
            role="form"
            aria-label="Image generation composer"
            className={cn(
                "fixed bottom-[max(16px,env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2",
                "w-[min(900px,92vw)] rounded-3xl border border-border/40",
                "shadow-[0_10px_34px_rgba(0,0,0,0.28)] backdrop-blur-md",
                "px-5 py-4 z-[1200] transition-all duration-300",
                "bg-white/90 text-foreground dark:bg-neutral-900/90 dark:text-neutral-100"
            )}
        >
            {/* HUD strip (top) */}
            <div className="flex items-center justify-between text-xs sm:text-sm mb-3">
                <div className="font-mono text-muted-foreground">{tokenHud}</div>

                {/* Size Popover (with token cost) */}
                <Popover open={sizeOpen} onOpenChange={setSizeOpen}>
                    <PopoverTrigger asChild>
                        <button
                            className={cn(
                                "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                                "bg-secondary/50 border border-border/40 text-foreground cursor-pointer",
                                "hover:bg-secondary/70 active:bg-secondary/80 focus:outline-none focus:ring-2 focus:ring-primary"
                            )}
                        >
                            Size: {size} <span className="opacity-70">(1 token)</span>
                            <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                    </PopoverTrigger>

                    <PopoverContent
                        align="end"
                        sideOffset={8}
                        className={cn(
                            "z-[2000] w-64 rounded-2xl p-2 border shadow-lg",
                            "bg-background border-border/50",
                            "animate-in fade-in-0 slide-in-from-top-2 transition-all duration-200"
                        )}
                    >
                        <div className="grid grid-cols-3 gap-2">
                            {[128, 256, 512].map((s) => (
                                <button
                                    key={s}
                                    onClick={() => {
                                        onSize(s as Size);
                                        setSizeOpen(false);
                                    }}
                                    className={cn(
                                        "px-3 py-2 rounded-xl border text-sm font-medium transition-all",
                                        "focus:outline-none focus:ring-2 focus:ring-primary",
                                        "hover:bg-accent/40 hover:border-accent/60 cursor-pointer",
                                        size === s
                                            ? "border-primary bg-primary/10 text-primary"
                                            : "border-border/50 text-muted-foreground"
                                    )}
                                >
                                    {s}
                                    <div className="text-[10px] opacity-70">(1 token)</div>
                                </button>
                            ))}
                        </div>
                    </PopoverContent>
                </Popover>

            </div>

            {/* Textarea row (alone) */}
            <div className="mb-3">
                <Textarea
                    ref={taRef}
                    value={prompt}
                    onChange={(e) => onPrompt(e.target.value)}
                    onKeyDown={onKeyDown}
                    placeholder="Describe what you want to create..."
                    className={cn(
                        "w-full resize-none rounded-2xl px-4 py-3 text-sm leading-relaxed transition",
                        "bg-background border border-border/40 focus-visible:ring-2 focus-visible:ring-primary",
                        "dark:bg-neutral-900 dark:border-neutral-700 dark:focus-visible:ring-blue-500"
                    )}
                    rows={2}
                    style={{ maxHeight: 140 }}
                />
            </div>

            {/* Controls row (bottom) */}
            <div className="flex items-center justify-between gap-3">
                {/* Left: model dropdown + inspiration */}
                <div className="flex items-center gap-3">
                    <Select value={model} onValueChange={(v) => onModel(v as Model)}>
                        <SelectTrigger
                            className={cn(
                                "w-[190px] h-9 text-sm rounded-full border bg-secondary/50",
                                "border-border/50 hover:bg-secondary/70 transition-colors",
                                "focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
                            )}
                        >
                            <SelectValue placeholder="Select model" />
                        </SelectTrigger>

                        <SelectContent
                            className={cn(
                                "z-[2000] bg-popover text-popover-foreground rounded-xl border border-border/50 shadow-xl",
                                "animate-in fade-in slide-in-from-top-1 p-1 space-y-1 "
                            )}
                        >
                            {[
                                { value: "genplace", label: "GenPlace (default)" },
                                { value: "openai", label: "OpenAI DALL·E" },
                                { value: "google", label: "Google Imagen" },
                                { value: "sdxl", label: "Stable Diffusion XL" },
                            ].map((item) => (
                                <SelectItem
                                    key={item.value}
                                    value={item.value}
                                    className={cn(
                                        "cursor-pointer rounded-md px-3 py-2 text-sm transition-colors",
                                        "data-[state=checked]:bg-primary/10 data-[state=checked]:text-primary",
                                        "hover:bg-accent/40 hover:text-foreground focus:bg-accent/50"
                                    )}
                                >
                                    {item.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>


                    <button
                        onClick={() => setInspOpen((v) => !v)}
                        className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline text-xs font-medium cursor-pointer"
                    >
                        <Sparkles className="w-3.5 h-3.5" />
                        Need inspiration?
                    </button>
                </div>

                {/* Right: circular submit button */}
                <Button
                    aria-label="Generate image"
                    onClick={onSubmit}
                    disabled={!canSubmit}
                    size="icon"
                    className={cn(
                        "h-12 w-12 rounded-full grid place-items-center transition-all",
                        canSubmit
                            ? "bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95 cursor-pointer"
                            : "bg-muted text-muted-foreground cursor-not-allowed opacity-70"
                    )}
                >
                    <Rocket className="w-5 h-5" />
                </Button>
            </div>

            {/* Inspiration Popover (anchored to the composer; also raised z-index) */}
            {/* Inspiration Popover (anchored to the composer; also raised z-index) */}
            {inspOpen && (
                <div className="absolute bottom-full mb-3 left-0 right-0 z-[2000] rounded-2xl border border-border/50 bg-background shadow-xl p-3 animate-in fade-in slide-in-from-bottom-2">

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[240px] overflow-y-auto">
                        {TIPS.map((t, i) => (
                            <button
                                key={i}
                                onClick={() => {
                                    onPrompt(t);
                                    setInspOpen(false);
                                }}
                                className={cn(
                                    "text-left text-sm px-4 py-2 rounded-xl border transition-all duration-200",
                                    "border-border/40 text-foreground",
                                    "hover:bg-accent/30 hover:border-accent/50 hover:text-foreground",
                                    "focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary",
                                    "active:scale-[0.98] cursor-pointer"
                                )}
                            >
                                {t}
                            </button>
                        ))}
                    </div>

                    {/* Close button at bottom-center */}
                    <div className="mt-3 flex justify-center">
                        <button
                            onClick={() => setInspOpen(false)}
                            aria-label="Close inspiration"
                            className={cn(
                                "flex items-center justify-center w-8 h-8 rounded-full",
                                "text-muted-foreground hover:text-foreground hover:bg-accent/30",
                                "transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
                            )}
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}

        </div>
    );
}
