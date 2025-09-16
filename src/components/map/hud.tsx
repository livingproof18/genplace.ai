// src/components/map/hud.tsx
"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TimerReset, Plus } from "lucide-react";
import { toast } from "sonner";

export function Hud({
    size,
    onSizeChange,
}: {
    size: 128 | 256 | 512;
    onSizeChange: (s: 128 | 256 | 512) => void;
}) {
    // Mock token/cooldown (replace with server data later)
    const [tokens, setTokens] = useState(1);
    const [nextIn, setNextIn] = useState(90); // seconds to regen

    useEffect(() => {
        const id = setInterval(() => {
            setNextIn((s) => {
                if (s <= 1) {
                    setTokens((t) => Math.min(t + 1, 3));
                    toast("Token regenerated", { description: "You're good to place again." });
                    return 90;
                }
                return s - 1;
            });
        }, 1000);
        return () => clearInterval(id);
    }, []);

    return (
        <aside className="sticky top-16 self-start rounded-xl border p-4 bg-card/70 space-y-4 h-fit">
            <div>
                <div className="text-sm text-muted-foreground">Tokens</div>
                <div className="mt-1 flex items-center gap-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <Badge key={i} variant={i < tokens ? "default" : "secondary"} className="rounded-xl">
                            {i < tokens ? "●" : "○"}
                        </Badge>
                    ))}
                </div>
                <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                    <TimerReset className="h-4 w-4" />
                    Next in <span className="tabular-nums">{fmt(nextIn)}</span>
                </div>
            </div>

            <div>
                <div className="text-sm text-muted-foreground mb-2">Size</div>
                <div className="flex gap-2">
                    {[128, 256, 512].map((s) => (
                        <Button
                            key={s}
                            size="sm"
                            variant={size === s ? "default" : "secondary"}
                            className="rounded-xl"
                            onClick={() => onSizeChange(s as 128 | 256 | 512)}
                        >
                            {s}×{s}
                        </Button>
                    ))}
                </div>
            </div>

            <div className="pt-2">
                <Button
                    className="w-full rounded-2xl"
                    onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                >
                    <Plus className="mr-2 h-4 w-4" />
                    Generate with a prompt
                </Button>
                <p className="text-xs mt-2 text-muted-foreground">
                    Tip: Click an empty tile to start placing.
                </p>
            </div>
        </aside>
    );
}

function fmt(s: number) {
    const m = Math.floor(s / 60).toString().padStart(2, "0");
    const ss = Math.floor(s % 60).toString().padStart(2, "0");
    return `${m}:${ss}`;
}
