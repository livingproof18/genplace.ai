// src/components/create/chat-composer.tsx
"use client";

import * as React from "react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Rocket, ChevronDown, Sparkles, X, Coins, Aperture, Banana, Shield } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { TokensState } from "@/hooks/use-tokens";
import type { Model, Size } from "@/components/map/types";
import { STYLE_PRESETS, type Style } from "@/lib/image-styles";
import { motion, AnimatePresence } from "framer-motion";

const DRAFT_KEY = "genplace:composer:draft";
const DRAFT_SAVED_AT_KEY = "genplace:composer:draftSavedAt";
const DRAFT_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

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

const MODEL_OPTIONS = [
    { value: "openai-1", label: "gpt-image-1", provider: "OpenAI", Icon: Aperture },
    { value: "openai-1.5", label: "gpt-image-1.5", provider: "OpenAI", Icon: Aperture },
    { value: "google-flash", label: "Nano Banana", provider: "Google Gemini", Icon: Banana },
    { value: "google-pro", label: "Nano Banana Pro", provider: "Google Gemini", Icon: Banana },
    { value: "sdxl", label: "Stable Image Core", provider: "Stability AI", Icon: Shield },
] as const;

const STYLE_OPTIONS: Array<{ value: Style; emoji: string }> = [
    { value: "auto", emoji: "✨" },
    { value: "cinematic", emoji: "🎬" },
    { value: "anime", emoji: "🌸" },
    { value: "oil", emoji: "🖌️" },
    { value: "watercolor", emoji: "💧" },
    { value: "pixel", emoji: "🟪" },
    { value: "3d", emoji: "🧊" },
    { value: "comic", emoji: "💥" },
    { value: "minimal", emoji: "◻️" },
    { value: "neon", emoji: "⚡" },
];

export function ChatComposer({
    tokens,
    prompt,
    onPrompt,
    model,
    onModel,
    style,
    onStyle,
    size,
    onSize,
    canSubmit,
    cooldownLabel,
    onSubmit,
    onClose, // new prop
}: {
    tokens: TokensState;
    prompt: string;
    onPrompt: (v: string) => void;
    model: Model;
    onModel: (m: Model) => void;
    style: Style;
    onStyle: (s: Style) => void;
    size: Size;
    onSize: (s: Size) => void;
    canSubmit: boolean;
    cooldownLabel: string;
    onSubmit: () => void;
    onClose: () => void;
}) {
    const [inspOpen, setInspOpen] = React.useState(false);
    const [sizeOpen, setSizeOpen] = React.useState(false);
    const [getTokensOpen, setGetTokensOpen] = React.useState(false);
    const taRef = React.useRef<HTMLTextAreaElement | null>(null);

    // restore draft on mount (only if prompt is empty)
    React.useEffect(() => {
        if (typeof window === "undefined") return;
        if (prompt && prompt.trim().length > 0) return; // don't overwrite existing prompt
        try {
            const raw = localStorage.getItem(DRAFT_KEY);
            const rawTs = localStorage.getItem(DRAFT_SAVED_AT_KEY);
            if (!raw || !rawTs) return;
            const savedAt = Number(rawTs || "0");
            if (Number.isFinite(savedAt) && Date.now() - savedAt <= DRAFT_EXPIRY_MS) {
                onPrompt(raw);
                // focus the textarea once restored
                setTimeout(() => taRef.current?.focus(), 60);
            } else {
                // expired — clear
                localStorage.removeItem(DRAFT_KEY);
                localStorage.removeItem(DRAFT_SAVED_AT_KEY);
            }
        } catch {
            // swallow storage errors
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // run once on mount

    React.useEffect(() => {
        const onFocusComposer = () => {
            taRef.current?.focus();
            taRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
        };
        window.addEventListener("genplace:composer:focus", onFocusComposer);
        return () => window.removeEventListener("genplace:composer:focus", onFocusComposer);
    }, []);

    const tokenHud =
        `Tokens ${tokens.current}/${tokens.max}` +
        (tokens.current < tokens.max ? ` • +1 in ${cooldownLabel.replace(/^Next \+1 in /, "")}` : "");

    const onKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement> = (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onSubmit();
        }
    };

    function saveDraftSilently(value: string) {
        if (typeof window === "undefined") return;
        try {
            if (value && value.trim().length > 0) {
                localStorage.setItem(DRAFT_KEY, value);
                localStorage.setItem(DRAFT_SAVED_AT_KEY, String(Date.now()));
            } else {
                // don't keep empty drafts
                localStorage.removeItem(DRAFT_KEY);
                localStorage.removeItem(DRAFT_SAVED_AT_KEY);
            }
        } catch {
            // ignore storage errors
        }
    }

    function handleClose() {
        // Save draft silently then call parent onClose
        saveDraftSilently(prompt);
        onClose();
    }

    return (
        <>
            <motion.div
                role="form"
                aria-label="Image generation composer"
                initial={{ opacity: 0, scale: 0.7, y: 40 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.7, y: 40 }}
                transition={{
                    type: "spring",
                    stiffness: 280,
                    damping: 24,
                    mass: 0.7,
                }}
                className={cn(
                    "fixed bottom-[max(16px,env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2",
                    "w-[min(900px,92vw)] rounded-3xl border border-border/40 shadow-[0_10px_34px_rgba(0,0,0,0.28)] backdrop-blur-md",
                    "px-5 py-4 z-[1200] transition-all duration-300",
                    "bg-white/90 text-foreground dark:bg-neutral-900/90 dark:text-neutral-100"
                )}
            >


                {/* Inner container gives relative positioning for close button */}
                <div className="relative">
                    {/* Close (top-right) */}
                    <button
                        aria-label="Close composer"
                        title="Close"
                        onClick={handleClose}
                        className={cn(
                            "absolute -top-7 -right-8 h-9 w-9 grid place-items-center rounded-full",
                            // "bg-background/90 border border-border/40 shadow-sm backdrop-blur",
                            "bg-background/90 border border-border/40 shadow-[0_2px_10px_rgba(0,0,0,0.25)] backdrop-blur",
                            "text-muted-foreground hover:text-primary hover:bg-background active:scale-[0.97]",
                            "transition-all focus:outline-none focus:ring-2 focus:ring-primary",
                            "cursor-pointer"
                        )}
                    >
                        <X className="w-4 h-4" />
                    </button>

                    {/* HUD strip (top) */}
                    <div className="flex items-center justify-between text-xs sm:text-sm mb-3">
                        <div className="font-mono text-muted-foreground">{tokenHud}</div>

                        <div className="flex items-center gap-3">
                            {/* Get more tokens */}
                            <button
                                onClick={() => setGetTokensOpen(true)}
                                className="flex items-center gap-1.5 text-xs sm:text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline transition-colors"
                            >
                                <Coins className="w-3.5 h-3.5" />
                                Get more tokens
                            </button>

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
                                        {[24, 48, 64, 96, 128, 256, 384, 512].map((s) => (
                                            <button
                                                key={s}
                                                onClick={() => {
                                                    onSize(s as Size);
                                                    setSizeOpen(false);
                                                }}
                                                className={cn(
                                                    "px-3 py-2 rounded-xl border text-sm font-medium transition-all",
                                                    // "focus:outline-none focus:ring-2 focus:ring-primary",
                                                    "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border",
                                                    "hover:bg-accent/40 hover:border-accent/60 cursor-pointer",
                                                    size === s ?
                                                        "border-primary bg-primary/10 text-primary border-2"
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
                                        "w-[220px] h-11 text-sm rounded-full border bg-secondary/50",
                                        "border-border/50 hover:bg-secondary/70 transition-colors",
                                        "focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
                                    )}
                                >
                                    <SelectValue placeholder="Select model">
                                        {(() => {
                                            const opt = MODEL_OPTIONS.find((o) => o.value === model);
                                            if (!opt) return null;
                                            const Icon = opt.Icon;
                                            return (
                                                <span className="flex items-center gap-2">
                                                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-background/60 border border-border/60">
                                                        <Icon className="h-3.5 w-3.5" />
                                                    </span>
                                                    <span className="flex flex-col leading-tight">
                                                        <span className="text-[13px] font-semibold">{opt.label}</span>
                                                        <span className="text-[11px] text-muted-foreground">{opt.provider}</span>
                                                    </span>
                                                </span>
                                            );
                                        })()}
                                    </SelectValue>
                                </SelectTrigger>

                                <SelectContent
                                    className={cn(
                                        "z-[2000] bg-popover text-popover-foreground rounded-xl border border-border/50 shadow-xl",
                                        "animate-in fade-in slide-in-from-top-1 p-1 space-y-1"
                                    )}
                                >
                                    {MODEL_OPTIONS.map((item) => (
                                        <SelectItem
                                            key={item.value}
                                            value={item.value}
                                            className={cn(
                                                "cursor-pointer rounded-md px-3 py-2 text-sm transition-colors",
                                                "data-[state=checked]:bg-primary/10 data-[state=checked]:text-primary",
                                                "hover:bg-accent/40 hover:text-foreground focus:bg-accent/50"
                                            )}
                                        >
                                            <span className="flex items-center gap-2">
                                                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-secondary/60 border border-border/60">
                                                    <item.Icon className="h-3.5 w-3.5" />
                                                </span>
                                                <span className="flex flex-col leading-tight">
                                                    <span className="text-[13px] font-semibold">{item.label}</span>
                                                    <span className="text-[11px] text-muted-foreground">{item.provider}</span>
                                                </span>
                                            </span>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            <Select value={style} onValueChange={(v) => onStyle(v as Style)}>
                                <SelectTrigger
                                    className={cn(
                                        "w-[150px] h-11 text-sm rounded-full border bg-secondary/50",
                                        "border-border/50 hover:bg-secondary/70 transition-colors",
                                        "focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
                                    )}
                                    title="Adds a visual style to your prompt"
                                >
                                    <SelectValue placeholder="Style: Auto">
                                        <span className="text-[13px] font-medium text-foreground">
                                            {STYLE_PRESETS[style]?.label ?? "Auto"}
                                        </span>
                                    </SelectValue>
                                </SelectTrigger>

                                <SelectContent
                                    className={cn(
                                        "z-[2000] bg-popover text-popover-foreground rounded-xl border border-border/50 shadow-xl",
                                        "animate-in fade-in slide-in-from-top-1 p-1 space-y-1"
                                    )}
                                >
                                    {STYLE_OPTIONS.map((item, idx) => (
                                        <React.Fragment key={item.value}>
                                            {idx === 1 && <div className="my-1 h-px bg-border/60" />}
                                        <SelectItem
                                            value={item.value}
                                            className={cn(
                                                "cursor-pointer rounded-md px-3 py-2 text-sm transition-colors",
                                                "data-[state=checked]:bg-primary/10 data-[state=checked]:text-primary",
                                                "hover:bg-accent/40 hover:text-foreground focus:bg-accent/50"
                                            )}
                                        >
                                            <span className="flex items-center gap-2">
                                                <span className="text-base">{item.emoji}</span>
                                                <span className="text-[13px] font-medium">{STYLE_PRESETS[item.value].label}</span>
                                            </span>
                                        </SelectItem>
                                        </React.Fragment>
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
                                canSubmit ? "bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95 cursor-pointer" : "bg-muted text-muted-foreground cursor-not-allowed opacity-70"
                            )}
                        >
                            <Rocket className="w-5 h-5" />
                        </Button>
                    </div>

                    {/* Inspiration Popover */}
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

            </motion.div>

            {/* "Get More Tokens" Modal (Scaffolded Store UI) */}
            <Dialog open={getTokensOpen} onOpenChange={setGetTokensOpen}>
                <DialogContent
                    className={cn(
                        "sm:max-w-lg rounded-2xl bg-background text-foreground border border-border/50 shadow-2xl",
                        "z-[3000]"
                    )}
                >
                    <DialogHeader className="flex items-center justify-between">
                        <DialogTitle className="text-lg font-semibold">Get More Tokens</DialogTitle>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setGetTokensOpen(false)}
                            className="rounded-full h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-accent/40"
                        >
                            <X className="w-4 h-4" />
                        </Button>
                    </DialogHeader>

                    <div className="mt-3 text-sm text-muted-foreground mb-5">
                        Choose a token pack below. Tokens let you generate more AI images and unlock larger canvas sizes.
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {[
                            { name: "Starter Pack", price: "$1.99", tokens: 10, desc: "Perfect for quick inspiration", highlight: false },
                            { name: "Booster Pack", price: "$4.99", tokens: 30, desc: "Best value for regular creators", highlight: true },
                            { name: "Mega Pack", price: "$9.99", tokens: 80, desc: "For power users & frequent sessions", highlight: false },
                        ].map((pack, i) => (
                            <div
                                key={i}
                                className={cn(
                                    "relative rounded-2xl border border-border/50 bg-secondary/40 p-4 text-center transition-all duration-200",
                                    "hover:shadow-lg hover:bg-secondary/60 hover:-translate-y-[2px]",
                                    pack.highlight && "ring-2 ring-primary/70 shadow-glow"
                                )}
                            >
                                {pack.highlight && (
                                    <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[10px] font-semibold px-2 py-0.5 rounded-full shadow-md">
                                        MOST POPULAR
                                    </div>
                                )}

                                <h3 className="font-semibold text-base mt-2 mb-1">{pack.name}</h3>
                                <p className="text-sm text-muted-foreground mb-2">{pack.desc}</p>
                                <div className="text-2xl font-bold text-primary mb-1">{pack.price}</div>
                                <div className="text-xs text-muted-foreground mb-3">{pack.tokens} Tokens</div>

                                <Button disabled className="w-full rounded-full text-sm bg-primary text-primary-foreground hover:bg-primary/90">
                                    Purchase
                                </Button>
                            </div>
                        ))}
                    </div>

                    <div className="mt-6 flex justify-end">
                        <Button onClick={() => setGetTokensOpen(false)} className="rounded-full px-5 py-2 text-sm bg-muted text-foreground hover:bg-accent/40">
                            Close
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
