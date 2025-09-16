// src/components/map/prompt-drawer.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { GridPlacement } from "./canvas-map";

export function PromptDrawer({
    tile,
    size,
    onClose,
    onPlaced,
}: {
    tile: { x: number; y: number } | null;
    size: 128 | 256 | 512;
    onClose: () => void;
    onPlaced: (p: GridPlacement) => void;
}) {
    const [prompt, setPrompt] = useState("");
    const [imgUrl, setImgUrl] = useState<string | null>(null);
    const open = !!tile;

    useEffect(() => {
        if (!open) {
            setPrompt("");
            setImgUrl(null);
        }
    }, [open]);

    const disabled = !prompt.trim();

    async function generatePreview() {
        // TODO: replace with real moderation + provider call
        if (prompt.toLowerCase().includes("nsfw")) {
            toast.error("Content blocked", { description: "Try a safer prompt variation." });
            return;
        }
        const dataUrl = placeholderPNG(size, prompt);
        setImgUrl(dataUrl);
    }

    function place() {
        if (!tile || !imgUrl) return;
        onPlaced({
            x: tile.x,
            y: tile.y,
            url: imgUrl,
            prompt,
            size,
            placedAt: new Date().toISOString(),
        });
        toast("Placed!", { description: `Tile (${tile.x}, ${tile.y}) updated.` });
        onClose();
    }

    return (
        <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
            <SheetContent side="right" className="w-[420px] sm:w-[460px]">
                <SheetHeader>
                    <SheetTitle>Place on tile {tile ? `(${tile.x}, ${tile.y})` : ""}</SheetTitle>
                </SheetHeader>

                <div className="mt-4 space-y-3">
                    <div className="text-xs text-muted-foreground">
                        Step 1: Describe your image.
                    </div>
                    <Textarea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="e.g., a neon koi swimming through a cyberpunk alley, cinematic, vibrant"
                        className="min-h-[96px]"
                    />

                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="secondary" className="rounded-xl">{size}×{size}</Badge>
                        <span>Preview will render at selected size.</span>
                    </div>

                    <div className="flex gap-2 pt-2">
                        <Button className="rounded-xl" onClick={generatePreview} disabled={disabled}>
                            Generate preview
                        </Button>
                        <Button
                            className="rounded-xl"
                            variant="secondary"
                            onClick={onClose}
                        >
                            Cancel
                        </Button>
                    </div>

                    {imgUrl && (
                        <div className="pt-3">
                            <div className="text-sm mb-2">Preview</div>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                alt="preview"
                                src={imgUrl}
                                className="rounded-lg border w-full"
                                style={{ maxWidth: size, imageRendering: "crisp-edges" as any }}
                            />
                            <Button className="mt-3 w-full rounded-2xl" onClick={place}>
                                Place on tile
                            </Button>
                            <p className="text-xs text-muted-foreground mt-2">
                                Placing consumes a token. Tiles update live for everyone.
                            </p>
                        </div>
                    )}
                </div>
            </SheetContent>
        </Sheet>
    );
}

// quick SVG -> PNG data URL (no external calls). Replace with provider later.
function placeholderPNG(size: number, text: string) {
    const svg = `
  <svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}'>
    <defs>
      <linearGradient id='g' x1='0' x2='1'>
        <stop offset='0%' stop-color='hsl(217 91% 60%)'/>
        <stop offset='100%' stop-color='hsl(217 91% 45%)'/>
      </linearGradient>
    </defs>
    <rect width='100%' height='100%' fill='url(#g)'/>
    <foreignObject x='8' y='8' width='${size - 16}' height='${size - 16}'>
      <div xmlns='http://www.w3.org/1999/xhtml'
           style='font-family: system-ui, sans-serif; font-size: 14px; line-height:1.25; color: #fff;'>
        ${escapeHtml(text)}
      </div>
    </foreignObject>
  </svg>`;
    return `data:image/svg+xml;base64,${btoa(svg)}`;
}
function escapeHtml(s: string) {
    return s.replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[m]!));
}
