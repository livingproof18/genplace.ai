// src/components/live-ticker.tsx
"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";

type Item = { id: string; user: string; label: string; tile: string };

const USERS = ["nova", "zen", "mira", "atlas", "rio", "pulse", "aria"];
const LABELS = ["neon koi", "mecha owl", "retro city", "forest spirit", "cyber dragon", "lofi cat", "vapor sun"];

function randomItem(): Item {
    const user = USERS[Math.floor(Math.random() * USERS.length)];
    const label = LABELS[Math.floor(Math.random() * LABELS.length)];
    const tile = `${Math.floor(Math.random() * 30)},${Math.floor(Math.random() * 30)}`;
    return { id: Math.random().toString(36).slice(2), user, label, tile };
}

export function LiveTicker() {
    const [items, setItems] = useState<Item[]>(Array.from({ length: 10 }, randomItem));

    useEffect(() => {
        const id = setInterval(() => {
            setItems((prev) => [randomItem(), ...prev.slice(0, 24)]);
        }, 1500);
        return () => clearInterval(id);
    }, []);

    return (
        <section className="mx-auto max-w-7xl px-4">
            <div className="mb-3 flex items-center justify-between">
                <h2 className="text-2xl font-semibold tracking-tight">Live activity</h2>
                <span className="text-xs text-muted-foreground">Realtime preview</span>
            </div>

            <div className="relative overflow-hidden rounded-xl border bg-card/60">
                <div className="flex gap-3 p-3 animate-[marquee_22s_linear_infinite] hover:[animation-play-state:paused] whitespace-nowrap">
                    {items.concat(items).map((it, i) => (
                        <Badge key={`${it.id}-${i}`} variant="secondary" className="rounded-xl">
                            <span className="opacity-70">@{it.user}</span>&nbsp;placed&nbsp;
                            <span className="font-medium">{it.label}</span>&nbsp;at&nbsp;
                            <span className="tabular-nums">({it.tile})</span>
                        </Badge>
                    ))}
                </div>
            </div>

            <style jsx>{`
        @keyframes marquee {
          0% { transform: translateX(0%); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
        </section>
    );
}
